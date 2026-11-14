import { useEffect, useRef, useState } from 'react';
import { BenchmarkModal } from './components/BenchmarkModal';
import { GameHUD } from './components/GameHUD';
import { HowToPlayModal } from './components/HowToPlayModal';
import { MainMenu } from './components/MainMenu';
import { MultiplayerModeModal } from './components/MultiplayerModeModal';
import { MultiplayerResultModal } from './components/MultiplayerResultModal';
import { PenSelector } from './components/PenSelector';
import { PlayerSetupModal } from './components/PlayerSetupModal';
import { ResultModal } from './components/ResultModal';
import { SettingsModal } from './components/Settings';
import { PenFightGame } from './game/Game';
import { abilityHudDefaults, DifficultyLevel, GameSettings, GameSnapshot } from './game/GameState';
import {
  GameMode,
  MultiplayerMatchConfig,
  PlayerConfig,
  TeamId,
  TurnTimerOption,
} from './game/MultiplayerTypes';
import {
  AchievementProgress,
  createDefaultProfile,
  LocalStorageProgressionRepository,
  PlayerProfile,
  ProgressionEvent,
  ProgressionManager,
} from './game/Progression';
import { isPenTypeId, PenTypeId, resolveArenaOrientation, STARTER_PEN } from './utils/Constants';
import { MultiplayerStorage } from './utils/MultiplayerStorage';

// v2: the performance settings block (FPS counter, quality tiers, resolution) was added, and the
// FPS meter now defaults to visible. Bumping the key retires the v1 payload so those defaults
// actually apply instead of being overridden by a stale "showFps: false".
const SETTINGS_STORAGE_KEY = 'pen_fight_arena_settings_v2';
const RECORD_STORAGE_KEY = 'pen_fight_arena_record_v1';

const QUALITY_PREFS = ['AUTO', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'];
const TIER_VALUES = ['OFF', 'LOW', 'HIGH'];
const RESOLUTION_PREFS = ['AUTO', '100', '90', '80', '75', '67'];

/** Rejects values from older builds (e.g. the retired `BALANCED` tier) before they reach the engine. */
function sanitizeSettings(merged: GameSettings, defaults: GameSettings): GameSettings {
  if (!QUALITY_PREFS.includes(merged.graphicsQuality)) merged.graphicsQuality = defaults.graphicsQuality;
  if (!TIER_VALUES.includes(merged.shadowQuality)) merged.shadowQuality = defaults.shadowQuality;
  if (!TIER_VALUES.includes(merged.particleEffects)) merged.particleEffects = defaults.particleEffects;
  if (!RESOLUTION_PREFS.includes(merged.renderResolution)) merged.renderResolution = defaults.renderResolution;
  return merged;
}

function getDefaultSettings(): GameSettings {
  return {
    sfxEnabled: true,
    musicEnabled: false,
    graphicsQuality: 'AUTO',
    difficulty: 'NORMAL',
    playerPenType: STARTER_PEN,
    showTrajectory: true,
    showFps: true,
    shadowQuality: 'HIGH',
    particleEffects: 'HIGH',
    motionEffects: true,
    renderResolution: 'AUTO',
    performanceMode: false,
  };
}

function loadInitialSettings(): GameSettings {
  const defaults = getDefaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const merged = { ...defaults, ...JSON.parse(raw) } as GameSettings;
    // Guard against stale pen ids from an older catalog build.
    if (!isPenTypeId(merged.playerPenType)) merged.playerPenType = defaults.playerPenType;
    return sanitizeSettings(merged, defaults);
  } catch {
    return defaults;
  }
}

function loadInitialRecord(): { wins: number; losses: number } {
  try {
    const raw = localStorage.getItem(RECORD_STORAGE_KEY);
    if (!raw) return { wins: 0, losses: 0 };
    const parsed = JSON.parse(raw) as { wins?: number; losses?: number };
    return {
      wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
      losses: typeof parsed.losses === 'number' ? parsed.losses : 0,
    };
  } catch {
    return { wins: 0, losses: 0 };
  }
}

/**
 * Builds the progression service. A pre-existing player profile is honoured as-is; only a
 * brand-new profile is seeded from the legacy win/loss record so achievements stay truthful.
 * Swapping `LocalStorageProgressionRepository` for a server-backed repository is all a future
 * online build needs to do — nothing above this interface changes.
 */
function createProgressionManager(): ProgressionManager {
  const repo = new LocalStorageProgressionRepository();
  const existing = repo.load();
  const legacy = loadInitialRecord();
  const isFresh = !existing || (existing.matchesPlayed === 0 && existing.unlockedPens.length <= 1);
  const seed: PlayerProfile = isFresh
    ? {
        ...(existing ?? createDefaultProfile()),
        matchesPlayed: legacy.wins + legacy.losses,
        wins: legacy.wins,
        losses: legacy.losses,
      }
    : (existing as PlayerProfile);
  return new ProgressionManager(repo, seed);
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<PenFightGame | null>(null);

  const [progression] = useState(createProgressionManager);

  const [settings, setSettings] = useState<GameSettings>(() => ({
    ...loadInitialSettings(),
    playerPenType: progression.getEquippedPen(),
  }));
  const [isReady, setIsReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [penSelectorOpen, setPenSelectorOpen] = useState(false);
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);
  const [unlockedPens, setUnlockedPens] = useState<PenTypeId[]>(
    () => progression.getProfile().unlockedPens
  );
  const [achievements, setAchievements] = useState<AchievementProgress[]>(() =>
    progression.getAchievementProgress()
  );
  const [progressionEvent, setProgressionEvent] = useState<ProgressionEvent | null>(null);
  const matchRecordedRef = useRef(false);

  // ── Multiplayer flow state ──────────────────────────────────────────────────
  const [multiplayerModeOpen, setMultiplayerModeOpen] = useState(false);
  const [playerSetupOpen, setPlayerSetupOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<GameMode>('1v1');
  const [pendingTimer, setPendingTimer] = useState<TurnTimerOption>(15);
  const [pendingStartingTeam, setPendingStartingTeam] = useState<TeamId>('blue');
  const multiplayerResultRecordedRef = useRef(false);
  const lastMultiplayerConfigRef = useRef<MultiplayerMatchConfig | null>(null);

  const initialRecord = useRef({
    wins: progression.getProfile().wins,
    losses: progression.getProfile().losses,
  });

  const [snapshot, setSnapshot] = useState<GameSnapshot>({
    matchState: 'MENU',
    activeTurn: 'player',
    countdownValue: 3,
    winner: null,
    loserReason: '',
    shotStatusText: 'Loading arena...',
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
      penType: settings.playerPenType,
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
    wins: initialRecord.current.wins,
    losses: initialRecord.current.losses,
    playerAbility: abilityHudDefaults(settings.playerPenType),
    botAbility: abilityHudDefaults('IRON_FORCE'),
    gameMode: 'VS_AI',
    multiplayer: null,
    turnTimeRemaining: 15,
    turnTimeTotal: 15,
    isTurnTimerRunning: false,
    isTurnTimeoutNotice: false,
    arenaOrientation:
      typeof window !== 'undefined'
        ? resolveArenaOrientation(window.innerWidth, window.innerHeight)
        : 'horizontal',
  });

  // Keep the UI collection in sync with the persisted profile (unlocks / achievements).
  useEffect(() => {
    const unsub = progression.subscribe((profile) => {
      setUnlockedPens([...profile.unlockedPens]);
      setAchievements(progression.getAchievementProgress());
    });
    return unsub;
  }, [progression]);

  // Initialize Three.js + Rapier3D game engine once inside isolated container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const game = new PenFightGame(
      container,
      settings,
      initialRecord.current.wins,
      initialRecord.current.losses,
      (lost) => setContextLost(lost)
    );
    gameRef.current = game;

    const unsub = game.state.subscribe((nextSnap) => {
      setSnapshot(nextSnap);
      try {
        localStorage.setItem(
          RECORD_STORAGE_KEY,
          JSON.stringify({ wins: nextSnap.wins, losses: nextSnap.losses })
        );
      } catch {
        // Ignore storage quota errors
      }
      // Record finished solo VS_AI matches once to award achievements / unlock pens.
      if (
        nextSnap.matchState === 'MATCH_OVER' &&
        nextSnap.winner &&
        !nextSnap.multiplayer &&
        nextSnap.gameMode === 'VS_AI'
      ) {
        if (!matchRecordedRef.current) {
          matchRecordedRef.current = true;
          setProgressionEvent(progression.recordMatch(nextSnap.winner));
        }
      } else {
        matchRecordedRef.current = false;
        setProgressionEvent(null);
      }
      // Record multiplayer match result once when it ends.
      if (nextSnap.matchState === 'MATCH_OVER' && nextSnap.multiplayer) {
        if (!multiplayerResultRecordedRef.current) {
          multiplayerResultRecordedRef.current = true;
          MultiplayerStorage.recordMatch(
            nextSnap.multiplayer.winningTeam,
            nextSnap.multiplayer.mode
          );
        }
      } else if (nextSnap.matchState !== 'MATCH_OVER') {
        multiplayerResultRecordedRef.current = false;
      }
    });

    let active = true;
    void game.init().then(() => {
      if (active) {
        setIsReady(true);
      }
    });

    return () => {
      active = false;
      unsub();
      game.dispose();
      gameRef.current = null;
    };
    // Mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync settings changes to game engine & localStorage
  useEffect(() => {
    gameRef.current?.applySettings(settings);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  // A full-screen modal hides the arena, so the render/physics loop is halted instead of
  // continuing to burn GPU and CPU behind an opaque overlay.
  useEffect(() => {
    gameRef.current?.setSuspended(
      settingsOpen ||
        helpOpen ||
        penSelectorOpen ||
        benchmarkOpen ||
        multiplayerModeOpen ||
        playerSetupOpen
    );
  }, [
    settingsOpen,
    helpOpen,
    penSelectorOpen,
    benchmarkOpen,
    multiplayerModeOpen,
    playerSetupOpen,
    isReady,
  ]);

  // Keyboard shortcuts (Enter/Space to start or dismiss banner, E to arm/fire ability, Escape for modals)
  useEffect(() => {
    const anyModalOpen =
      settingsOpen ||
      helpOpen ||
      penSelectorOpen ||
      benchmarkOpen ||
      multiplayerModeOpen ||
      playerSetupOpen;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target !== null &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
        } else if (settingsOpen) {
          setSettingsOpen(false);
        } else if (penSelectorOpen) {
          setPenSelectorOpen(false);
        } else if (benchmarkOpen) {
          setBenchmarkOpen(false);
        } else if (playerSetupOpen) {
          setPlayerSetupOpen(false);
        } else if (multiplayerModeOpen) {
          setMultiplayerModeOpen(false);
        } else if (snapshot.matchState !== 'MENU') {
          setSettingsOpen(true);
        }
        return;
      }

      if (isTextInput) return;

      // Prevent browser spacebar scroll or accidental focused button activation during active matches.
      if (e.key === ' ' && snapshot.matchState !== 'MENU' && !anyModalOpen) {
        e.preventDefault();
        return;
      }

      if (
        (e.key === 'Enter' || e.key === ' ') &&
        snapshot.matchState === 'MENU' &&
        !anyModalOpen &&
        isReady
      ) {
        e.preventDefault();
        gameRef.current?.startMatch();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    snapshot.matchState,
    snapshot.isTurnTimeoutNotice,
    settingsOpen,
    helpOpen,
    penSelectorOpen,
    benchmarkOpen,
    multiplayerModeOpen,
    playerSetupOpen,
    isReady,
  ]);

  const handleDifficultyChange = (difficulty: DifficultyLevel) => {
    setSettings((prev) => ({ ...prev, difficulty }));
  };

  /** Every equip goes through the progression service, which refuses locked pens. */
  const handleEquipPen = (pen: PenTypeId) => {
    if (!progression.equip(pen)) return;
    setSettings((prev) => ({ ...prev, playerPenType: pen }));
  };

  const handleToggleSfx = () => {
    gameRef.current?.audio.unlock();
    setSettings((prev) => ({ ...prev, sfxEnabled: !prev.sfxEnabled }));
  };

  const handleToggleTrajectory = () => {
    setSettings((prev) => ({ ...prev, showTrajectory: !prev.showTrajectory }));
  };

  const isInMatch = snapshot.matchState !== 'MENU';

  return (
    <main
      className="relative w-full h-[100dvh] min-w-0 min-h-0 overflow-hidden bg-[#e6dccb]"
      style={{ width: '100%', height: '100dvh', minWidth: 0, minHeight: 0 }}
    >
      {/* Isolated WebGL Canvas Mount */}
      <div
        ref={canvasMountRef}
        className="game-canvas-container absolute inset-0 h-full w-full min-w-0 min-h-0 overflow-hidden"
      />

      {/* WebGL Context Lost Fallback */}
      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 text-center">
          <div className="max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-6">
            <h2 className="font-display text-xl font-bold text-white">
              Graphics Context Paused
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Your browser temporarily suspended WebGL rendering. Reload the page to restore the 3D arena.
            </p>
          </div>
        </div>
      )}

      {/* Main Menu Overlay */}
      {snapshot.matchState === 'MENU' && (
        <MainMenu
          difficulty={settings.difficulty}
          penType={settings.playerPenType}
          sfxEnabled={settings.sfxEnabled}
          wins={snapshot.wins}
          losses={snapshot.losses}
          unlockedCount={unlockedPens.length}
          isReady={isReady}
          onSelectDifficulty={handleDifficultyChange}
          onOpenPenSelector={() => setPenSelectorOpen(true)}
          onPlay={() => gameRef.current?.startMatch()}
          onOpenMultiplayer={() => setMultiplayerModeOpen(true)}
          onOpenHowToPlay={() => setHelpOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenBenchmark={() => setBenchmarkOpen(true)}
          onToggleSfx={handleToggleSfx}
        />
      )}

      {/* In-Game HUD */}
      {isInMatch && (
        <GameHUD
          snapshot={snapshot}
          difficulty={settings.difficulty}
          sfxEnabled={settings.sfxEnabled}
          showTrajectory={settings.showTrajectory}
          monitor={gameRef.current?.monitor ?? null}
          showFps={settings.showFps}
          onToggleSfx={handleToggleSfx}
          onToggleTrajectory={handleToggleTrajectory}
          onActivateAbility={() => gameRef.current?.activatePlayerAbility()}
          onRestart={() => gameRef.current?.restartMatch()}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          onExitToMenu={() => gameRef.current?.returnToMenu()}
        />
      )}

      {/* Match Result Modal (Solo vs AI only) */}
      {!snapshot.multiplayer && snapshot.gameMode === 'VS_AI' && (
        <ResultModal
          snapshot={snapshot}
          progression={progressionEvent}
          onPlayAgain={() => gameRef.current?.restartMatch()}
          onExitToMenu={() => gameRef.current?.returnToMenu()}
        />
      )}

      {/* Local Multiplayer Match Result Modal */}
      <MultiplayerResultModal
        snapshot={snapshot}
        onRematch={() => gameRef.current?.restartMatch()}
        onChangeSetup={() => {
          const prev = lastMultiplayerConfigRef.current;
          if (prev) {
            setPendingMode(prev.mode);
            setPendingTimer(prev.turnTimerSeconds);
            setPendingStartingTeam(prev.startingTeam ?? 'blue');
          }
          gameRef.current?.returnToMenu();
          setPlayerSetupOpen(true);
        }}
        onExitToMenu={() => gameRef.current?.returnToMenu()}
      />

      {/* Local Multiplayer Mode Selector */}
      <MultiplayerModeModal
        isOpen={multiplayerModeOpen}
        onClose={() => setMultiplayerModeOpen(false)}
        onSelectMode={(mode, timerOption, startingTeam) => {
          setPendingMode(mode);
          setPendingTimer(timerOption);
          setPendingStartingTeam(startingTeam);
          setMultiplayerModeOpen(false);
          if (mode === 'VS_AI') {
            lastMultiplayerConfigRef.current = null;
            gameRef.current?.startMatch();
          } else if (mode === 'PRACTICE') {
            lastMultiplayerConfigRef.current = null;
            gameRef.current?.startMatch({
              mode: 'PRACTICE',
              players: [],
              turnTimerSeconds: 0,
              startingTeam: 'blue',
            });
          } else {
            setPlayerSetupOpen(true);
          }
        }}
      />

      {/* Local Multiplayer Player & Pen Setup */}
      <PlayerSetupModal
        isOpen={playerSetupOpen}
        mode={pendingMode}
        turnTimer={pendingTimer}
        startingTeam={pendingStartingTeam}
        onBack={() => {
          setPlayerSetupOpen(false);
          setMultiplayerModeOpen(true);
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onStartMatch={(players: PlayerConfig[], startingPlayerId: string, customTurnOrder: string[]) => {
          const config: MultiplayerMatchConfig = {
            mode: pendingMode,
            players,
            turnTimerSeconds: pendingTimer,
            startingTeam: pendingStartingTeam,
            startingPlayerId,
            customTurnOrder,
          };
          lastMultiplayerConfigRef.current = config;
          setPlayerSetupOpen(false);
          gameRef.current?.startMatch(config);
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        isInMatch={isInMatch}
        isMultiplayer={Boolean(snapshot.multiplayer)}
        settings={settings}
        onUpdateSettings={setSettings}
        onOpenPenSelector={() => {
          setSettingsOpen(false);
          setPenSelectorOpen(true);
        }}
        onRestartMatch={() => gameRef.current?.restartMatch()}
        onOpenHowToPlay={() => setHelpOpen(true)}
        onOpenBenchmark={() => setBenchmarkOpen(true)}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Hardware Benchmark Modal */}
      <BenchmarkModal
        isOpen={benchmarkOpen}
        game={gameRef.current}
        onClose={() => setBenchmarkOpen(false)}
      />

      {/* 3D Pen Collection / Selector */}
      <PenSelector
        isOpen={penSelectorOpen}
        equippedPen={settings.playerPenType}
        unlockedPens={unlockedPens}
        achievements={achievements}
        onEquip={handleEquipPen}
        onClose={() => setPenSelectorOpen(false)}
      />

      {/* How to Play Modal */}
      <HowToPlayModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
