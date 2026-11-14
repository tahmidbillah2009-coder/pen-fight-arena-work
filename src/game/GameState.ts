import {
  PEN_SPECS,
  PenAbilityId,
  PenSpecialShotId,
  PenTypeId,
  PowerZoneId,
  SpecialShotIconKey,
  STARTER_PEN,
} from '../utils/Constants';
import { GameMode, MultiplayerMatchSnapshot } from './MultiplayerTypes';

export type MatchState =
  | 'MENU'
  | 'COUNTDOWN'
  | 'PLAYER_TURN'
  | 'BOT_TURN'
  | 'SHOT_IN_PROGRESS'
  | 'MATCH_OVER';

export type PlayerId = string;

export type DifficultyLevel = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT';

/** A concrete rendering tier the engine can actually apply. */
export type GraphicsQuality = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

/** What the player picked: `AUTO` lets the adaptive controller choose the tier. */
export type QualityPreference = 'AUTO' | GraphicsQuality;

export type ShadowQuality = 'OFF' | 'LOW' | 'HIGH';

export type EffectQuality = 'OFF' | 'LOW' | 'HIGH';

/** `AUTO` derives the scale from the resolved graphics tier or runtime controller. */
export type ResolutionPreference = 'AUTO' | '100' | '90' | '80' | '75' | '67';

export type EdgeDangerLevel = 'SAFE' | 'WARN' | 'DANGER';

export interface EdgeWarningState {
  player: EdgeDangerLevel;
  bot: EdgeDangerLevel;
  playerOobProgress: number; // 0..1 OOB confirmation timer progress
  botOobProgress: number;
}

export interface GameSettings {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  /** Tier preference; `AUTO` hands control to the adaptive quality controller. */
  graphicsQuality: QualityPreference;
  difficulty: DifficultyLevel;
  playerPenType: PenTypeId;
  showTrajectory: boolean;
  /** Real-time performance panel in the top-right of the gameplay screen. */
  showFps: boolean;
  /** Upper bound on shadow fidelity (the quality tier can lower it further). */
  shadowQuality: ShadowQuality;
  /** Upper bound on particle density (the quality tier can lower it further). */
  particleEffects: EffectQuality;
  /** Camera shake, hitstop, shot-follow and trails. */
  motionEffects: boolean;
  /** Rendering resolution scale relative to the device pixel ratio. */
  renderResolution: ResolutionPreference;
  /**
   * Master switch for weak hardware: pins the resolved tier to LOW, drops shadows, particles and
   * motion, renders at 75% and caps the device pixel ratio at 1.
   */
  performanceMode: boolean;
}

export interface DragTelemetry {
  isDragging: boolean;
  powerRatio: number; // 0..1
  powerZone: PowerZoneId;
  estimatedSpeed: number; // Estimated launch speed (units/sec)
  pullAngleDeg: number; // Launch direction angle in degrees (-180..180)
  pullCardinal: string; // Human-readable direction label (e.g. 'Forward', 'Forward-Right')
  dragDistance: number;
  anchorZone: 'Tip' | 'Front' | 'Center' | 'Back' | 'Tail';
  canLaunch: boolean;
  penType: PenTypeId;
  spinFactor: number; // 0..1 torque leverage
  appliedForce: number;
  isLiveThrow: boolean;
}

export interface MatchStats {
  turnsPlayed: number;
  playerShots: number;
  botShots: number;
  maxPowerPercent: number;
  collisions: number;
}

/** Live ability status surfaced to the HUD (cooldown / active window / remaining uses). */
export interface AbilityHudState {
  /** Always-on passive ability identity. */
  abilityId: PenAbilityId;
  passiveName: string;
  passiveSummary: string;
  /** Active Special Shot identity. */
  name: string;
  specialShotId: PenSpecialShotId;
  icon: SpecialShotIconKey;
  colorHex: number;
  isActive: boolean;
  activeRemaining: number;
  activeTotal: number;
  cooldownRemaining: number;
  cooldownTotal: number;
  /** -1 = unlimited this match */
  usesRemaining: number;
  maxUsesPerMatch: number;
  canActivate: boolean;
  /**
   * True once the player has primed the Special Shot from the HUD button and is now aiming
   * (the trajectory preview shows the shot's real physics path until it is fired or cancelled).
   */
  armed: boolean;
}

export interface GameSnapshot {
  matchState: MatchState;
  activeTurn: PlayerId;
  countdownValue: number; // 3, 2, 1, 0
  winner: PlayerId | null;
  loserReason: string;
  shotStatusText: string;
  dragTelemetry: DragTelemetry;
  edgeWarning: EdgeWarningState;
  stats: MatchStats;
  wins: number;
  losses: number;
  playerAbility: AbilityHudState;
  botAbility: AbilityHudState;
  gameMode: GameMode;
  multiplayer: MultiplayerMatchSnapshot | null;
  turnTimeRemaining: number;
  turnTimeTotal: number;
  isTurnTimerRunning: boolean;
  isTurnTimeoutNotice: boolean;
}

/** Builds the idle HUD ability state for a freshly equipped pen (passive + Special Shot). */
export function abilityHudDefaults(penType: PenTypeId): AbilityHudState {
  const spec = PEN_SPECS[penType];
  const shot = spec.specialShot;
  return {
    abilityId: spec.passive.id,
    passiveName: spec.passive.name,
    passiveSummary: spec.passive.summary,
    name: shot.name,
    specialShotId: shot.id,
    icon: shot.icon,
    colorHex: shot.colorHex,
    isActive: false,
    activeRemaining: 0,
    activeTotal: shot.durationSeconds,
    cooldownRemaining: 0,
    cooldownTotal: shot.cooldownSeconds,
    usesRemaining: shot.maxUsesPerMatch,
    maxUsesPerMatch: shot.maxUsesPerMatch,
    canActivate: false,
    armed: false,
  };
}

export class GameStateManager {
  private snapshot: GameSnapshot;
  private listeners = new Set<(snapshot: GameSnapshot) => void>();

  constructor(initialWins = 0, initialLosses = 0, playerPenType: PenTypeId = STARTER_PEN) {
    this.snapshot = {
      matchState: 'MENU',
      activeTurn: 'player',
      countdownValue: 3,
      winner: null,
      loserReason: '',
      shotStatusText: 'Ready to play',
      dragTelemetry: {
        isDragging: false,
        powerRatio: 0,
        powerZone: 'LOW',
        estimatedSpeed: 0,
        pullAngleDeg: 0,
        pullCardinal: 'Forward',
        dragDistance: 0,
        anchorZone: 'Center',
        canLaunch: false,
        penType: playerPenType,
        spinFactor: 0,
        appliedForce: 0,
        isLiveThrow: false,
      },
      edgeWarning: {
        player: 'SAFE',
        bot: 'SAFE',
        playerOobProgress: 0,
        botOobProgress: 0,
      },
      stats: {
        turnsPlayed: 0,
        playerShots: 0,
        botShots: 0,
        maxPowerPercent: 0,
        collisions: 0,
      },
      wins: initialWins,
      losses: initialLosses,
      playerAbility: abilityHudDefaults(playerPenType),
      botAbility: abilityHudDefaults('IRON_FORCE'),
      gameMode: 'VS_AI',
      multiplayer: null,
      turnTimeRemaining: 15,
      turnTimeTotal: 15,
      isTurnTimerRunning: false,
      isTurnTimeoutNotice: false,
    };
  }

  public getSnapshot(): GameSnapshot {
    return this.snapshot;
  }

  public subscribe(listener: (snapshot: GameSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public update(patch: Partial<GameSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
    };
    this.emit();
  }

  public updateDragTelemetry(telemetry: DragTelemetry): void {
    this.snapshot = {
      ...this.snapshot,
      dragTelemetry: telemetry,
    };
    this.emit();
  }

  /**
   * Publishes a player's ability status. Values are quantised and diffed so a running
   * cooldown does not trigger a React re-render on every animation frame.
   */
  public updateAbility(id: PlayerId, state: AbilityHudState): void {
    const quantised: AbilityHudState = {
      ...state,
      activeRemaining: Math.round(state.activeRemaining * 10) / 10,
      cooldownRemaining: Math.round(state.cooldownRemaining * 10) / 10,
    };
    const current = id === 'player' ? this.snapshot.playerAbility : this.snapshot.botAbility;
    if (
      current.abilityId === quantised.abilityId &&
      current.isActive === quantised.isActive &&
      current.activeRemaining === quantised.activeRemaining &&
      current.cooldownRemaining === quantised.cooldownRemaining &&
      current.usesRemaining === quantised.usesRemaining &&
      current.canActivate === quantised.canActivate &&
      current.armed === quantised.armed
    ) {
      return;
    }
    if (id === 'player') {
      this.snapshot = { ...this.snapshot, playerAbility: quantised };
    } else if (id === 'bot') {
      this.snapshot = { ...this.snapshot, botAbility: quantised };
    }

    if (this.snapshot.multiplayer) {
      const pIdx = this.snapshot.multiplayer.players.findIndex((p) => p.id === id);
      if (pIdx >= 0) {
        const nextPlayers = [...this.snapshot.multiplayer.players];
        nextPlayers[pIdx] = {
          ...nextPlayers[pIdx],
          ability: quantised,
        };
        this.snapshot = {
          ...this.snapshot,
          multiplayer: {
            ...this.snapshot.multiplayer,
            players: nextPlayers,
          },
        };
      }
    }

    this.emit();
  }

  public resetMatchStats(): void {
    this.snapshot = {
      ...this.snapshot,
      winner: null,
      loserReason: '',
      edgeWarning: {
        player: 'SAFE',
        bot: 'SAFE',
        playerOobProgress: 0,
        botOobProgress: 0,
      },
      stats: {
        turnsPlayed: 0,
        playerShots: 0,
        botShots: 0,
        maxPowerPercent: 0,
        collisions: 0,
      },
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }
}
