import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Hammer,
  HelpCircle,
  Home,
  Radio,
  RotateCcw,
  Settings as SettingsIcon,
  Smartphone,
  Spline,
  Tornado,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { AbilityHudState, DifficultyLevel, GameSnapshot } from '../game/GameState';
import type { PerformanceMonitor } from '../game/PerformanceMonitor';
import { SpecialShotIconKey } from '../utils/Constants';
import { PerformanceOverlay } from './PerformanceOverlay';
import { PowerMeter } from './PowerMeter';
import { MultiplayerHUD } from './MultiplayerHUD';

interface GameHUDProps {
  snapshot: GameSnapshot;
  difficulty: DifficultyLevel;
  sfxEnabled: boolean;
  showTrajectory: boolean;
  /** Live perf monitor from the engine; the overlay renders only when `showFps` is on. */
  monitor: PerformanceMonitor | null;
  showFps: boolean;
  onToggleSfx: () => void;
  onToggleTrajectory: () => void;
  onActivateAbility: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onExitToMenu: () => void;
}

/** Every pen's Special Shot has its own icon so the button reads at a glance (shared with the selector). */
export type AbilityIconComponent = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
}>;

export const SHOT_ICONS: Record<SpecialShotIconKey, AbilityIconComponent> = {
  BURST: Zap,
  STRIKE: Hammer,
  DASH: Wind,
  CURVE: Spline,
  VORTEX: Tornado,
  SHOCKWAVE: Radio,
};

const hexToRgb = (hex: number): string =>
  `${(hex >> 16) & 0xff}, ${(hex >> 8) & 0xff}, ${hex & 0xff}`;

/**
 * Dedicated Special Shot button: shows the equipped shot's name, icon and live cooldown progress,
 * dims while unavailable, and switches to an armed "aim & release" state once primed from the HUD.
 */
const AbilityChip: React.FC<{ ability: AbilityHudState; onActivate: () => void }> = ({
  ability,
  onActivate,
}) => {
  const ShotIcon = SHOT_ICONS[ability.icon] ?? Zap;
  const limited = ability.maxUsesPerMatch >= 0;
  const spent = limited && ability.usesRemaining <= 0;
  const armed = ability.armed;
  const cooling = !ability.isActive && ability.cooldownRemaining > 0;
  const enabled = ability.canActivate;

  // Progress toward the next state: shot completion while firing, cooldown fill while waiting.
  const progress = ability.isActive
    ? ability.activeTotal > 0
      ? 1 - ability.activeRemaining / ability.activeTotal
      : 1
    : cooling
      ? ability.cooldownTotal > 0
        ? 1 - ability.cooldownRemaining / ability.cooldownTotal
        : 1
      : 1;

  const stateLabel = ability.isActive
    ? `${ability.activeRemaining.toFixed(1)}s`
    : armed
      ? 'Aim'
      : cooling
        ? `${ability.cooldownRemaining.toFixed(1)}s`
        : spent
          ? 'Spent'
          : 'Ready';

  const tone = ability.isActive
    ? 'border-amber-400/80 bg-amber-950/92 text-amber-100 animate-pulse'
    : armed
      ? 'border-sky-300/90 bg-sky-950/92 text-sky-100 shadow-[0_0_0_2px_rgba(56,189,248,0.35)]'
      : enabled
        ? 'border-emerald-400/65 bg-emerald-950/88 text-emerald-100 hover:bg-emerald-900/80'
        : 'border-white/10 bg-[#111827]/85 text-slate-400';

  const rgb = hexToRgb(ability.colorHex);

  return (
    <button
      type="button"
      onClick={onActivate}
      disabled={!enabled}
      aria-label={
        armed ? `Release ${ability.name}` : ability.name
      }
      aria-pressed={armed}
      title={`${ability.name} · ${ability.passiveName} — press or tap, then drag to aim & release (E)`}
      className={`pointer-events-auto relative flex min-h-[42px] flex-col overflow-hidden rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${tone}`}
    >
      <span className="flex items-center gap-1.5">
        <ShotIcon
          className={`h-3.5 w-3.5 shrink-0 ${armed ? 'animate-pulse' : ''}`}
          style={{ color: `rgb(${rgb})` }}
        />
        <span className="whitespace-nowrap">{ability.name}</span>
        <span className="font-mono-num rounded bg-black/30 px-1.5 py-0.5 text-[10px]">
          {stateLabel}
        </span>
        {limited && (
          <span className="flex items-center gap-0.5" aria-hidden="true">
            {Array.from({ length: ability.maxUsesPerMatch }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i < ability.usesRemaining ? 'bg-current' : 'bg-white/15'
                }`}
              />
            ))}
          </span>
        )}
      </span>
      {armed && (
        <span className="mt-0.5 whitespace-nowrap text-[9px] font-medium uppercase tracking-wide text-sky-300">
          Drag &amp; release to fire
        </span>
      )}
      {/* Cooldown / shot-progress bar */}
      <span
        className="absolute inset-x-0 bottom-0 h-[3px] bg-black/40"
        aria-hidden="true"
      >
        <span
          className="block h-full transition-[width] duration-150 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: `rgb(${rgb})` }}
        />
      </span>
    </button>
  );
};

export const GameHUD: React.FC<GameHUDProps> = ({
  snapshot,
  difficulty,
  sfxEnabled,
  showTrajectory,
  monitor,
  showFps,
  onToggleSfx,
  onToggleTrajectory,
  onActivateAbility,
  onRestart,
  onOpenSettings,
  onOpenHelp,
  onExitToMenu,
}) => {
  const [isNarrowPortrait, setIsNarrowPortrait] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsNarrowPortrait(w < 500 && h > w);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    window.addEventListener('orientationchange', checkViewport);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('orientationchange', checkViewport);
    };
  }, []);

  if (snapshot.multiplayer) {
    return (
      <MultiplayerHUD
        snapshot={snapshot}
        sfxEnabled={sfxEnabled}
        showTrajectory={showTrajectory}
        monitor={monitor}
        showFps={showFps}
        onToggleSfx={onToggleSfx}
        onToggleTrajectory={onToggleTrajectory}
        onActivateAbility={onActivateAbility}
        onRestart={onRestart}
        onOpenSettings={onOpenSettings}
        onOpenHelp={onOpenHelp}
        onExitToMenu={onExitToMenu}
      />
    );
  }

  const isPractice = snapshot.gameMode === 'PRACTICE';
  const isPlayerActive =
    snapshot.matchState === 'PLAYER_TURN' ||
    (snapshot.matchState === 'SHOT_IN_PROGRESS' && snapshot.activeTurn === 'player');
  const isBotActive =
    !isPractice &&
    (snapshot.matchState === 'BOT_TURN' ||
      (snapshot.matchState === 'SHOT_IN_PROGRESS' && snapshot.activeTurn === 'bot'));

  const diffLabel = difficulty.charAt(0) + difficulty.slice(1).toLowerCase();

  return (
    <>
      {/* Responsive Top Perimeter HUD — adapts cleanly from 320px portrait to Ultrawide */}
      <header className="pointer-events-none safe-pad-top safe-pad-x fixed inset-x-0 top-0 z-20 w-full p-2 sm:p-4">
        <div className="flex w-full flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:gap-3">
          {/* Player Status Card */}
          <div
            className={`pointer-events-auto order-1 flex items-center gap-2 rounded-xl border px-2 py-1 transition-colors sm:gap-3 sm:px-3.5 sm:py-2 ${
              isPlayerActive
                ? 'border-blue-400/75 bg-[#111827]/95 shadow-lg'
                : 'border-white/10 bg-[#111827]/85'
            }`}
          >
            <span className="h-5 w-1.5 rounded-sm bg-blue-500 sm:h-7 sm:w-2" aria-hidden="true" />
            <div className="leading-tight">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white sm:gap-2 sm:text-sm">
                <span className="whitespace-nowrap">You</span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="font-mono-num text-blue-300">{snapshot.wins}W</span>
              </div>
              <div className="text-[9px] text-slate-400 sm:text-[11px]">
                {snapshot.matchState === 'PLAYER_TURN' ? 'Active Turn' : 'Cobalt Pen'}
              </div>
            </div>
          </div>

          {/* Right Group: Bot Status Card + PerformanceOverlay (order-2 on mobile top row, order-3 on >=sm) */}
          <div className="order-2 flex items-center gap-1.5 sm:order-3 sm:gap-2">
            <div
              className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-2 py-1 transition-colors sm:gap-3 sm:px-3.5 sm:py-2 ${
                isBotActive
                  ? 'border-rose-400/75 bg-[#111827]/95 shadow-lg'
                  : 'border-white/10 bg-[#111827]/85'
              }`}
            >
              <div className="text-right leading-tight">
                <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-white sm:gap-2 sm:text-sm">
                  <span className="font-mono-num text-rose-300">{snapshot.losses}W</span>
                  <span aria-hidden="true" className="text-slate-500">·</span>
                  <span className="whitespace-nowrap">{isPractice ? 'Target' : 'Bot'}</span>
                </div>
                <div className="text-[9px] text-slate-400 sm:text-[11px]">
                  {isPractice
                    ? 'Practice Freeplay'
                    : snapshot.matchState === 'BOT_TURN'
                      ? 'Aiming...'
                      : `${diffLabel} AI`}
                </div>
              </div>
              <span className="h-5 w-1.5 rounded-sm bg-rose-500 sm:h-7 sm:w-2" aria-hidden="true" />
            </div>

            {/* Real-time performance panel */}
            <PerformanceOverlay
              monitor={monitor}
              visible={showFps}
              className="pointer-events-auto shrink-0"
            />
          </div>

          {/* Center Controls & Status (wraps cleanly to centered 2nd row on <640px phones, centered 1st row on >=640px) */}
          <div className="pointer-events-auto order-3 flex w-full flex-col items-center gap-1 sm:order-2 sm:w-auto sm:gap-1.5">
            <div className="flex items-center gap-0.5 rounded-xl border border-white/12 bg-[#111827]/92 px-1 py-0.5 shadow-lg sm:gap-1 sm:px-2 sm:py-1">
              <button
                type="button"
                onClick={onRestart}
                title="Restart Match"
                aria-label="Restart Match"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400 sm:h-9 sm:w-9"
              >
                <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={onToggleSfx}
                title={sfxEnabled ? 'Mute Sound' : 'Enable Sound'}
                aria-label={sfxEnabled ? 'Mute Sound' : 'Enable Sound'}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400 sm:h-9 sm:w-9"
              >
                {sfxEnabled ? <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-400" />}
              </button>
              <button
                type="button"
                onClick={onToggleTrajectory}
                title={showTrajectory ? 'Hide Trajectory Arc' : 'Show Trajectory Arc'}
                aria-label={showTrajectory ? 'Hide Trajectory Arc' : 'Show Trajectory Arc'}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400 sm:h-9 sm:w-9"
              >
                {showTrajectory ? <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" /> : <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" />}
              </button>
              <button
                type="button"
                onClick={onOpenHelp}
                title="How to Play"
                aria-label="How to Play"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400 sm:h-9 sm:w-9"
              >
                <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                title="Settings"
                aria-label="Settings"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400 sm:h-9 sm:w-9"
              >
                <SettingsIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={onExitToMenu}
                title="Exit to Main Menu"
                aria-label="Exit to Main Menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400 sm:h-9 sm:w-9"
              >
                <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>

            <div className="max-w-[min(94vw,34rem)] truncate rounded-lg border border-white/10 bg-[#111827]/90 px-2.5 py-0.5 text-center text-[10px] font-medium text-slate-200 sm:px-3 sm:py-1 sm:text-xs">
              {snapshot.shotStatusText}
            </div>

            {/* Equipped pen ability + live opponent ability activation */}
            {snapshot.matchState !== 'MENU' && snapshot.matchState !== 'MATCH_OVER' && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <AbilityChip ability={snapshot.playerAbility} onActivate={onActivateAbility} />
                {snapshot.botAbility.isActive && (
                  <div className="pointer-events-none flex items-center gap-1 rounded-lg border border-rose-400/50 bg-rose-950/85 px-2 py-1 text-[10px] font-semibold text-rose-200">
                    <Zap className="h-3 w-3" />
                    <span className="whitespace-nowrap">Bot: {snapshot.botAbility.name}</span>
                  </div>
                )}
              </div>
            )}

            {snapshot.matchState !== 'MENU' && snapshot.matchState !== 'MATCH_OVER' && (snapshot.edgeWarning.player !== 'SAFE' || snapshot.edgeWarning.bot === 'DANGER') && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {snapshot.edgeWarning.player !== 'SAFE' && (
                  <div
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold shadow-md ${
                      snapshot.edgeWarning.player === 'DANGER'
                        ? 'border-rose-400/75 bg-rose-950/92 text-rose-200'
                        : 'border-amber-400/70 bg-amber-950/92 text-amber-200'
                    }`}
                  >
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>
                      {snapshot.edgeWarning.playerOobProgress > 0
                        ? 'Edge Drop Risk!'
                        : snapshot.edgeWarning.player === 'DANGER'
                          ? 'Danger: Near Edge'
                          : 'Edge Warning'}
                    </span>
                    {snapshot.edgeWarning.playerOobProgress > 0 && (
                      <span className="h-1.5 w-8 overflow-hidden rounded-full bg-rose-900">
                        <span
                          className="block h-full bg-rose-400"
                          style={{ width: `${Math.round(snapshot.edgeWarning.playerOobProgress * 100)}%` }}
                        />
                      </span>
                    )}
                  </div>
                )}

                {snapshot.edgeWarning.bot === 'DANGER' && (
                  <div className="flex items-center gap-1 rounded-lg border border-emerald-400/60 bg-emerald-950/90 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200 shadow-md">
                    <span>{isPractice ? 'Target Near Edge' : 'Bot Near Edge'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Non-blocking Dismissible Landscape Tip on narrow portrait phones */}
      {isNarrowPortrait && !tipDismissed && !snapshot.dragTelemetry.isDragging && (
        <div className="pointer-events-none safe-pad-bottom safe-pad-x fixed inset-x-0 bottom-0 z-10 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/12 bg-[#111827]/90 px-3 py-1.5 text-[11px] text-slate-300 shadow-lg">
            <Smartphone className="h-3.5 w-3.5 shrink-0 rotate-90 text-sky-400" />
            <span>Rotate to landscape for a larger desk view</span>
            <button
              type="button"
              onClick={() => setTipDismissed(true)}
              aria-label="Dismiss tip"
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Center 3-Second Countdown */}
      {snapshot.matchState === 'COUNTDOWN' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center p-4">
          <div
            key={snapshot.countdownValue}
            className="animate-countdown rounded-2xl border border-white/20 bg-[#111827]/92 px-8 py-5 text-center shadow-2xl sm:px-10 sm:py-6"
          >
            <div className="font-display font-mono-num text-5xl font-extrabold tracking-tight text-amber-400 sm:text-7xl">
              {snapshot.countdownValue > 0 ? snapshot.countdownValue : 'FIGHT!'}
            </div>
            <div className="mt-1 text-xs font-medium text-slate-300">
              {isPractice
                ? 'Practice Freeplay — Test angles, spins & Special Shots'
                : 'Knock the crimson pen off the desk'}
            </div>
          </div>
        </div>
      )}

      {/* Live Drag Power Meter */}
      <PowerMeter telemetry={snapshot.dragTelemetry} />
    </>
  );
};
