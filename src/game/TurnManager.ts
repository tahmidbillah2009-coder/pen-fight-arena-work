import {
  COUNTDOWN_SECONDS,
  FALL_Y_THRESHOLD,
  MAX_SHOT_SECONDS,
  OOB_CONFIRM_SECONDS,
  SETTLE_ANG_SPEED,
  SETTLE_HOLD_SECONDS,
  SETTLE_LIN_SPEED,
} from '../utils/Constants';
import { abilityHudDefaults, EdgeWarningState, GameStateManager, PlayerId } from './GameState';
import {
  computeMultiplayerSpawn,
  generateTurnQueue,
  MultiplayerMatchConfig,
  MultiplayerMatchSnapshot,
  MultiplayerPlayerState,
  TeamId,
} from './MultiplayerTypes';
import { PhysicsManager } from './PhysicsManager';

export interface TurnEvents {
  onCountdownTick: (value: number) => void;
  onStartPlayerTurn: (playerId: string) => void;
  onStartBotTurn: () => void;
  onPenFell: (penId: PlayerId) => void;
  onMatchOver: (winner: PlayerId, reason: string) => void;
  onTurnTimeout?: (playerId: string) => void;
  onTurnTransition?: (player: MultiplayerPlayerState) => void;
  onTimerWarning?: (secondsRemaining: number) => void;
}

export class TurnManager {
  private readonly state: GameStateManager;
  private readonly physics: PhysicsManager;
  private readonly events: TurnEvents;

  // Match configuration & multiplayer tracking
  private multiplayerConfig: MultiplayerMatchConfig | null = null;
  private players: MultiplayerPlayerState[] = [];
  private turnQueue: string[] = [];
  private currentTurnIndex = 0;
  private roundNumber = 1;
  private activePlayerId: string = 'player';
  private winningTeam: TeamId | null = null;

  // Turn timer state (monotonic performance.now() based)
  private turnTimerTotal = 15; // 0 = unlimited
  private turnTimeRemaining = 15;
  private isTimerRunning = false;
  private isPaused = false;
  private lastTimerSecondInt = 15;
  private turnTimeoutNotice = false;
  private timeoutNoticeTimer = 0;
  private transitionTimer = 0;
  private isTransitioning = false;

  // Knockout and collision attribution
  private lastAttacker: Record<string, string> = {};

  // Standard match loop state
  private countdownTimer = 0;
  private lastCountdownInt = 0;
  private shotTimer = 0;
  private settleTimer = 0;
  private oobTimers: Record<string, number> = {};
  private fellNotified: Record<string, boolean> = {};
  private firstFallen: PlayerId | null = null;
  private lastShooter: PlayerId = 'player';
  private lastEdgeWarning: EdgeWarningState = {
    player: 'SAFE',
    bot: 'SAFE',
    playerOobProgress: 0,
    botOobProgress: 0,
  };

  constructor(state: GameStateManager, physics: PhysicsManager, events: TurnEvents) {
    this.state = state;
    this.physics = physics;
    this.events = events;
  }

  public getActivePlayerId(): string {
    return this.activePlayerId;
  }

  public getPlayers(): MultiplayerPlayerState[] {
    return this.players;
  }

  public getMultiplayerConfig(): MultiplayerMatchConfig | null {
    return this.multiplayerConfig;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public recordPenContact(penA: string, penB: string, speed: number): void {
    if (speed < 0.8) return;
    // Record mutual interaction: whoever hit whom last is remembered for knockout crediting
    this.lastAttacker[penB] = penA;
    this.lastAttacker[penA] = penB;
  }

  /**
   * Starts a new match. Can be single-player (vs AI / Practice) or local hot-seat multiplayer.
   */
  public startNewMatch(multiplayerConfig?: MultiplayerMatchConfig): void {
    this.state.resetMatchStats();
    this.countdownTimer = COUNTDOWN_SECONDS;
    this.lastCountdownInt = COUNTDOWN_SECONDS;
    this.shotTimer = 0;
    this.settleTimer = 0;
    this.firstFallen = null;
    this.lastShooter = 'player';
    this.oobTimers = {};
    this.fellNotified = {};
    this.lastAttacker = {};
    this.turnTimeoutNotice = false;
    this.timeoutNoticeTimer = 0;
    this.transitionTimer = 0;
    this.isTransitioning = false;
    this.winningTeam = null;

    if (multiplayerConfig && multiplayerConfig.mode !== 'VS_AI' && multiplayerConfig.mode !== 'PRACTICE') {
      // --- MULTIPLAYER SETUP ---
      this.multiplayerConfig = multiplayerConfig;
      this.turnTimerTotal = multiplayerConfig.turnTimerSeconds;
      this.turnTimeRemaining = multiplayerConfig.turnTimerSeconds;
      this.lastTimerSecondInt = Math.ceil(this.turnTimeRemaining);

      this.players = multiplayerConfig.players.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        penType: p.penType,
        isEliminated: false,
        shotsCount: 0,
        knockoutsCount: 0,
        ability: abilityHudDefaults(p.penType),
      }));

      // Generate turn queue
      let queue = generateTurnQueue(multiplayerConfig.players);
      if (multiplayerConfig.startingTeam === 'red') {
        // If Red starts, rotate until first player is Red
        const firstRedIdx = queue.findIndex((id) => {
          const p = this.players.find((pl) => pl.id === id);
          return p?.team === 'red';
        });
        if (firstRedIdx > 0) {
          queue = [...queue.slice(firstRedIdx), ...queue.slice(0, firstRedIdx)];
        }
      }
      this.turnQueue = queue;
      this.currentTurnIndex = 0;
      this.activePlayerId = this.turnQueue[0] || 'blue_1';
      this.roundNumber = 1;
      this.isTimerRunning = false;

      // Spawn pens dynamically
      const bluePlayers = this.players.filter((p) => p.team === 'blue');
      const redPlayers = this.players.filter((p) => p.team === 'red');
      const spawnConfigs = this.players.map((p) => {
        const teamTotal = p.team === 'blue' ? bluePlayers.length : redPlayers.length;
        const teamIdx = p.team === 'blue'
          ? bluePlayers.findIndex((pl) => pl.id === p.id)
          : redPlayers.findIndex((pl) => pl.id === p.id);
        const spawn = computeMultiplayerSpawn(p.team, Math.max(0, teamIdx), teamTotal);
        return {
          id: p.id,
          penType: p.penType,
          spawn,
        };
      });

      this.physics.configurePens(spawnConfigs);
      this.physics.resetPens();

      this.updateMultiplayerSnapshot();
      this.state.update({
        matchState: 'COUNTDOWN',
        gameMode: multiplayerConfig.mode,
        activeTurn: this.activePlayerId,
        countdownValue: COUNTDOWN_SECONDS,
        shotStatusText: 'Get ready...',
        turnTimeRemaining: this.turnTimeRemaining,
        turnTimeTotal: this.turnTimerTotal,
        isTurnTimerRunning: false,
        isTurnTimeoutNotice: false,
      });
    } else {
      // --- SINGLE PLAYER / VS AI SETUP ---
      this.multiplayerConfig = null;
      this.turnTimerTotal = 0;
      this.turnTimeRemaining = 0;
      this.isTimerRunning = false;
      this.activePlayerId = 'player';
      this.turnQueue = ['player', 'bot'];
      this.currentTurnIndex = 0;
      this.roundNumber = 1;
      this.players = [];

      this.physics.resetPens();
      this.state.update({
        matchState: 'COUNTDOWN',
        gameMode: multiplayerConfig?.mode ?? 'VS_AI',
        activeTurn: 'player',
        countdownValue: COUNTDOWN_SECONDS,
        shotStatusText: 'Get ready...',
        multiplayer: null,
        turnTimeRemaining: 0,
        turnTimeTotal: 0,
        isTurnTimerRunning: false,
        isTurnTimeoutNotice: false,
      });
    }

    this.events.onCountdownTick(COUNTDOWN_SECONDS);
  }

  public returnToMenu(): void {
    this.physics.resetPens();
    this.oobTimers = {};
    this.fellNotified = {};
    this.firstFallen = null;
    this.isTimerRunning = false;
    this.isTransitioning = false;
    this.state.update({
      matchState: 'MENU',
      activeTurn: 'player',
      shotStatusText: 'Ready to play',
      isTurnTimerRunning: false,
      isTurnTimeoutNotice: false,
      edgeWarning: {
        player: 'SAFE',
        bot: 'SAFE',
        playerOobProgress: 0,
        botOobProgress: 0,
      },
    });
  }

  /**
   * Raised the instant a valid shot is launched by any player or bot.
   * Stops the countdown timer immediately to prevent mid-shot cancellation.
   */
  public notifyShotLaunched(shooter: PlayerId, powerRatio: number): void {
    this.lastShooter = shooter;
    this.shotTimer = 0;
    this.settleTimer = 0;
    this.isTimerRunning = false; // Stop timer immediately on shot release!

    // Update player shot stats in multiplayer
    if (this.multiplayerConfig) {
      const pIdx = this.players.findIndex((p) => p.id === shooter);
      if (pIdx >= 0) {
        this.players[pIdx].shotsCount += 1;
      }
    }

    const prevStats = this.state.getSnapshot().stats;
    const powerPct = Math.round(powerRatio * 100);
    const shooterName = this.getPlayerDisplayName(shooter);

    this.updateMultiplayerSnapshot();
    this.state.update({
      matchState: 'SHOT_IN_PROGRESS',
      shotStatusText: `${shooterName} struck with ${powerPct}% power!`,
      isTurnTimerRunning: false,
      stats: {
        ...prevStats,
        turnsPlayed: prevStats.turnsPlayed + 1,
        playerShots: prevStats.playerShots + (shooter === 'player' || shooter.startsWith('blue') ? 1 : 0),
        botShots: prevStats.botShots + (shooter === 'bot' || shooter.startsWith('red') ? 1 : 0),
        maxPowerPercent: Math.max(prevStats.maxPowerPercent, powerPct),
      },
    });
  }

  public update(delta: number): void {
    const dt = Math.min(delta, 0.05);
    const snap = this.state.getSnapshot();

    // 1. Initial Match Countdown (3..2..1..Fight)
    if (snap.matchState === 'COUNTDOWN') {
      this.countdownTimer -= dt;
      const ceilVal = Math.max(0, Math.ceil(this.countdownTimer));
      if (ceilVal !== this.lastCountdownInt && ceilVal >= 0) {
        this.lastCountdownInt = ceilVal;
        this.state.update({ countdownValue: ceilVal });
        this.events.onCountdownTick(ceilVal);
      }

      if (this.countdownTimer <= 0) {
        if (this.multiplayerConfig) {
          this.beginMultiplayerTurn(this.activePlayerId);
        } else {
          this.beginSinglePlayerTurn('player');
        }
      }
      return;
    }

    // 2. Timeout Notice Display Phase (brief non-blocking display before next turn)
    if (this.turnTimeoutNotice) {
      this.timeoutNoticeTimer -= dt;
      if (this.timeoutNoticeTimer <= 0) {
        this.turnTimeoutNotice = false;
        this.state.update({ isTurnTimeoutNotice: false });
        this.advanceMultiplayerTurnQueue();
      }
      return;
    }

    // 3. Turn Transition Phase (smooth active player presentation banner)
    if (this.isTransitioning) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        this.isTransitioning = false;
        this.startActivePlayerTurn();
      }
      return;
    }

    // 4. Live Turn Timer Countdown during PLAYER_TURN
    if (snap.matchState === 'PLAYER_TURN' && this.isTimerRunning && !this.isPaused && this.turnTimerTotal > 0) {
      this.turnTimeRemaining -= dt;

      const ceilVal = Math.max(0, Math.ceil(this.turnTimeRemaining));
      if (ceilVal !== this.lastTimerSecondInt) {
        this.lastTimerSecondInt = ceilVal;
        if (ceilVal <= 5 && ceilVal > 0) {
          this.events.onTimerWarning?.(ceilVal);
        }
        this.state.update({
          turnTimeRemaining: Math.max(0, this.turnTimeRemaining),
        });
      }

      // Check for Timeout
      if (this.turnTimeRemaining <= 0) {
        this.handleTurnTimeout();
        return;
      }
    }

    // 5. Shot in motion & collision settling
    if (snap.matchState === 'SHOT_IN_PROGRESS') {
      this.shotTimer += dt;
      this.checkFallenPens(dt);

      const settled = this.physics.arePensSettled(SETTLE_LIN_SPEED, SETTLE_ANG_SPEED);
      const hasPendingOob = Object.values(this.oobTimers).some((t) => t > 0);

      if (settled && !hasPendingOob) {
        this.settleTimer += dt;
      } else {
        this.settleTimer = 0;
      }

      const fellQuickResolve = this.firstFallen !== null && this.shotTimer > 0.85;
      if (this.settleTimer >= SETTLE_HOLD_SECONDS || fellQuickResolve || this.shotTimer >= MAX_SHOT_SECONDS) {
        this.resolveAfterShot();
      }
    } else if (snap.matchState === 'PLAYER_TURN' || snap.matchState === 'BOT_TURN') {
      // Continuous check in case a pen slowly tilts or rolls off while at rest
      this.checkFallenPens(dt);
      if (this.firstFallen !== null && !this.multiplayerConfig) {
        this.resolveAfterShot();
      }
    }
  }

  /**
   * Handles timeout when the active player does not shoot in time.
   */
  private handleTurnTimeout(): void {
    this.isTimerRunning = false;
    this.turnTimeRemaining = 0;
    this.turnTimeoutNotice = true;
    this.timeoutNoticeTimer = 1.2; // 1.2s clear visual timeout notification

    const timedOutPlayer = this.getPlayerDisplayName(this.activePlayerId);
    this.events.onTurnTimeout?.(this.activePlayerId);

    this.state.update({
      shotStatusText: `TIME'S UP! ${timedOutPlayer.toUpperCase()}'S TURN SKIPPED`,
      isTurnTimerRunning: false,
      isTurnTimeoutNotice: true,
      turnTimeRemaining: 0,
    });
  }

  /**
   * Inspects all pens for desk drops or boundary breaches.
   */
  private checkFallenPens(dt: number): void {
    const penIds = this.multiplayerConfig
      ? this.players.map((p) => p.id)
      : ['player', 'bot'];

    for (const id of penIds) {
      const pose = this.physics.getPose(id);
      const prox = this.physics.getEdgeProximity(id);
      let timer = this.oobTimers[id] ?? 0;

      if (pose.pos.y < FALL_Y_THRESHOLD) {
        timer = OOB_CONFIRM_SECONDS;
      } else if (prox.isOutsideBounds) {
        timer += dt;
      } else {
        timer = 0;
      }
      this.oobTimers[id] = timer;

      // Trigger elimination if confirmed fallen
      if (!this.fellNotified[id] && timer >= OOB_CONFIRM_SECONDS) {
        this.fellNotified[id] = true;
        if (this.firstFallen === null) {
          this.firstFallen = id;
        }

        // Attribution: credit knockout to attacker
        const attackerId = this.lastAttacker[id];
        if (attackerId && attackerId !== id) {
          const attackerPlayer = this.players.find((p) => p.id === attackerId);
          if (attackerPlayer) {
            attackerPlayer.knockoutsCount += 1;
          }
        }

        // Mark player eliminated in multiplayer
        if (this.multiplayerConfig) {
          const targetPlayer = this.players.find((p) => p.id === id);
          if (targetPlayer) {
            targetPlayer.isEliminated = true;
          }
        }

        this.events.onPenFell(id);
      }
    }

    // Update edge warning indicator for HUD
    if (!this.multiplayerConfig) {
      const pProx = this.physics.getEdgeProximity('player');
      const bProx = this.physics.getEdgeProximity('bot');
      const pTimer = this.oobTimers.player ?? 0;
      const bTimer = this.oobTimers.bot ?? 0;
      const nextWarning: EdgeWarningState = {
        player: pProx.level,
        bot: bProx.level,
        playerOobProgress: Math.min(1, pTimer / Math.max(0.01, OOB_CONFIRM_SECONDS)),
        botOobProgress: Math.min(1, bTimer / Math.max(0.01, OOB_CONFIRM_SECONDS)),
      };
      if (
        nextWarning.player !== this.lastEdgeWarning.player ||
        nextWarning.bot !== this.lastEdgeWarning.bot ||
        Math.abs(nextWarning.playerOobProgress - this.lastEdgeWarning.playerOobProgress) > 0.08 ||
        Math.abs(nextWarning.botOobProgress - this.lastEdgeWarning.botOobProgress) > 0.08
      ) {
        this.lastEdgeWarning = nextWarning;
        this.state.update({ edgeWarning: nextWarning });
      }
    }
  }

  /**
   * Resolves the turn outcome after all pens stop moving.
   */
  private resolveAfterShot(): void {
    if (this.multiplayerConfig) {
      this.resolveMultiplayerShot();
    } else {
      this.resolveSinglePlayerShot();
    }
  }

  private resolveMultiplayerShot(): void {
    const blueAlive = this.players.filter((p) => p.team === 'blue' && !p.isEliminated);
    const redAlive = this.players.filter((p) => p.team === 'red' && !p.isEliminated);

    // Win Condition Checks
    if (redAlive.length === 0 && blueAlive.length > 0) {
      this.finishMultiplayerMatch('blue', 'TEAM BLUE WINS! Knocked all opposing pens off the desk!');
      return;
    }
    if (blueAlive.length === 0 && redAlive.length > 0) {
      this.finishMultiplayerMatch('red', 'TEAM RED WINS! Knocked all opposing pens off the desk!');
      return;
    }
    if (blueAlive.length === 0 && redAlive.length === 0) {
      // Both teams eliminated in the same shot — resolve by who dropped first!
      const firstTeam = this.players.find((p) => p.id === this.firstFallen)?.team;
      const winner: TeamId = firstTeam === 'blue' ? 'red' : 'blue';
      const winnerName = winner === 'blue' ? 'TEAM BLUE' : 'TEAM RED';
      this.finishMultiplayerMatch(winner, `${winnerName} WINS! Opponent fell off the desk first!`);
      return;
    }

    // Match continues — advance to next non-eliminated player!
    this.advanceMultiplayerTurnQueue();
  }

  private advanceMultiplayerTurnQueue(): void {
    const totalSlots = this.turnQueue.length;
    let nextIdx = (this.currentTurnIndex + 1) % totalSlots;
    let foundEligible = false;

    for (let i = 0; i < totalSlots; i++) {
      const candidateId = this.turnQueue[nextIdx];
      const p = this.players.find((pl) => pl.id === candidateId);
      if (p && !p.isEliminated) {
        foundEligible = true;
        break;
      }
      nextIdx = (nextIdx + 1) % totalSlots;
    }

    if (!foundEligible) {
      // Safety fallback: if no eligible player, check remaining survivors
      this.resolveMultiplayerShot();
      return;
    }

    if (nextIdx <= this.currentTurnIndex) {
      this.roundNumber += 1;
    }

    this.currentTurnIndex = nextIdx;
    this.activePlayerId = this.turnQueue[nextIdx];
    this.beginMultiplayerTurn(this.activePlayerId);
  }

  private beginMultiplayerTurn(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;

    this.firstFallen = null;
    this.turnTimeoutNotice = false;
    this.isTransitioning = true;
    this.transitionTimer = 1.0; // 1.0s transition animation

    this.events.onTurnTransition?.(player);

    const teamLabel = player.team === 'blue' ? 'Team Blue' : 'Team Red';
    this.state.update({
      matchState: 'PLAYER_TURN',
      activeTurn: playerId,
      shotStatusText: `${player.name} (${teamLabel}) — Aim your pen!`,
      isTurnTimerRunning: false,
      isTurnTimeoutNotice: false,
      turnTimeRemaining: this.turnTimerTotal,
      turnTimeTotal: this.turnTimerTotal,
    });
    this.updateMultiplayerSnapshot();
  }

  private startActivePlayerTurn(): void {
    const player = this.players.find((p) => p.id === this.activePlayerId);
    if (!player) return;

    this.turnTimeRemaining = this.turnTimerTotal;
    this.lastTimerSecondInt = Math.ceil(this.turnTimeRemaining);
    this.isTimerRunning = this.turnTimerTotal > 0;

    const teamLabel = player.team === 'blue' ? 'Team Blue' : 'Team Red';
    this.state.update({
      matchState: 'PLAYER_TURN',
      activeTurn: this.activePlayerId,
      shotStatusText: `${player.name} (${teamLabel}) — Pull back to strike!`,
      isTurnTimerRunning: this.isTimerRunning,
      turnTimeRemaining: this.turnTimeRemaining,
      turnTimeTotal: this.turnTimerTotal,
      isTurnTimeoutNotice: false,
    });
    this.updateMultiplayerSnapshot();
    this.events.onStartPlayerTurn(this.activePlayerId);
  }

  private finishMultiplayerMatch(winner: TeamId, reason: string): void {
    this.winningTeam = winner;
    this.isTimerRunning = false;
    this.isTransitioning = false;
    this.updateMultiplayerSnapshot();

    const winnerId = winner === 'blue' ? 'player' : 'bot';
    this.state.update({
      matchState: 'MATCH_OVER',
      winner: winnerId,
      loserReason: reason,
      shotStatusText: `${winner === 'blue' ? 'Team Blue' : 'Team Red'} Victory!`,
      isTurnTimerRunning: false,
      isTurnTimeoutNotice: false,
    });
    this.events.onMatchOver(winnerId, reason);
  }

  private resolveSinglePlayerShot(): void {
    const pFell = this.fellNotified.player;
    const bFell = this.fellNotified.bot;

    if (pFell || bFell) {
      let winner: PlayerId;
      let reason: string;

      if (bFell && !pFell) {
        winner = 'player';
        reason = 'Opponent pen was knocked off the desk!';
      } else if (pFell && !bFell) {
        winner = 'bot';
        reason = 'Your pen fell off the desk!';
      } else {
        winner = this.firstFallen === 'player' ? 'bot' : 'player';
        reason =
          winner === 'player'
            ? 'Double drop — opponent fell off the desk first!'
            : 'Double drop — your pen fell off the desk first!';
      }

      const snap = this.state.getSnapshot();
      this.state.update({
        matchState: 'MATCH_OVER',
        winner,
        loserReason: reason,
        shotStatusText: winner === 'player' ? 'Victory!' : 'Defeat',
        wins: snap.wins + (winner === 'player' ? 1 : 0),
        losses: snap.losses + (winner === 'bot' ? 1 : 0),
      });
      this.events.onMatchOver(winner, reason);
      return;
    }

    // Nobody fell — advance turn
    const nextTurn: PlayerId = this.lastShooter === 'player' ? 'bot' : 'player';
    this.beginSinglePlayerTurn(nextTurn);
  }

  private beginSinglePlayerTurn(turn: PlayerId): void {
    if (turn === 'player') {
      this.state.update({
        matchState: 'PLAYER_TURN',
        activeTurn: 'player',
        shotStatusText: 'Your turn — grab & pull your blue pen',
      });
      this.events.onStartPlayerTurn('player');
    } else {
      this.state.update({
        matchState: 'BOT_TURN',
        activeTurn: 'bot',
        shotStatusText: 'Opponent is lining up a shot...',
      });
      this.events.onStartBotTurn();
    }
  }

  private getPlayerDisplayName(id: string): string {
    const p = this.players.find((pl) => pl.id === id);
    if (p) return p.name;
    if (id === 'player') return 'Player';
    if (id === 'bot') return 'Bot';
    return id;
  }

  private updateMultiplayerSnapshot(): void {
    if (!this.multiplayerConfig) return;
    const blueCount = this.players.filter((p) => p.team === 'blue' && !p.isEliminated).length;
    const redCount = this.players.filter((p) => p.team === 'red' && !p.isEliminated).length;
    const activePlayer = this.players.find((p) => p.id === this.activePlayerId) ?? null;

    const snap: MultiplayerMatchSnapshot = {
      mode: this.multiplayerConfig.mode,
      players: [...this.players],
      activePlayerId: this.activePlayerId,
      turnQueue: [...this.turnQueue],
      currentTurnIndex: this.currentTurnIndex,
      roundNumber: this.roundNumber,
      turnTimeRemaining: Math.max(0, this.turnTimeRemaining),
      turnTimeTotal: this.turnTimerTotal,
      isTurnTimerRunning: this.isTimerRunning,
      isTurnTimeoutNotice: this.turnTimeoutNotice,
      winningTeam: this.winningTeam,
      transitionPlayer: this.isTransitioning ? activePlayer : null,
      blueScore: blueCount,
      redScore: redCount,
    };

    this.state.update({
      multiplayer: snap,
      turnTimeRemaining: Math.max(0, this.turnTimeRemaining),
      turnTimeTotal: this.turnTimerTotal,
      isTurnTimerRunning: this.isTimerRunning,
      isTurnTimeoutNotice: this.turnTimeoutNotice,
    });
  }
}
