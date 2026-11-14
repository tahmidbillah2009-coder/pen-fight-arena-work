import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Crosshair,
  Hammer,
  LogOut,
  Orbit,
  RotateCcw,
  Shield,
  ShieldCheck,
  Smartphone,
  Wind,
  X,
} from 'lucide-react';
import { AbilityHudState, DifficultyLevel, GameSnapshot } from '../game/GameState';
import type { PerformanceMonitor } from '../game/PerformanceMonitor';
import { PenAbilityId } from '../utils/Constants';
import { PerformanceOverlay } from './PerformanceOverlay';
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

/** Shared icon type for always-on passive badges (reused in PenSelector & MultiplayerHUD). */
export type AbilityIconComponent = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
}>;

export const PASSIVE_ICONS: Record<PenAbilityId, AbilityIconComponent> = {
  CAP_LOCK: ShieldCheck,
  HEAVY_IMPACT: Hammer,
  QUICK_RECOVERY: Wind,
  PRECISION_PULL: Crosshair,
  SPIN_CONTROL: Orbit,
  IMPACT_GUARD: Shield,
};

/**
 * Passive Skill badge displayed in the HUD: shows the equipped pen's always-on passive skill
 * (e.g. Cap Lock · Better grip) with zero active activation required.
 */
const PassiveBadge: React.FC<{ ability: AbilityHudState }> = ({ ability }) => {
  const PassiveIcon = PASSIVE_ICONS[ability.abilityId] ?? ShieldCheck;

  return (
    <div
      title={`${ability.passiveName}: ${ability.passiveSummary}`}
      className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-[#111827]/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 shadow-sm"
    >
      <PassiveIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
      <span className="whitespace-nowrap">{ability.passiveName}</span>
      <span className="hidden text-slate-500 sm:inline" aria-hidden="true">·</span>
      <span className="hidden text-[10px] font-normal text-slate-300 sm:inline">
        {ability.passiveSummary}
      </span>
    </div>
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

          {/* Center Status & Passive Skill */}
          <div className="pointer-events-auto order-3 flex w-full flex-col items-center gap-1 sm:order-2 sm:w-auto sm:gap-1.5">
            <div className="max-w-[min(94vw,34rem)] truncate rounded-lg border border-white/10 bg-[#111827]/90 px-2.5 py-0.5 text-center text-[10px] font-medium text-slate-200 sm:px-3 sm:py-1 sm:text-xs">
              {snapshot.shotStatusText}
            </div>

            {/* Equipped pen always-on passive skill */}
            {snapshot.matchState !== 'MENU' && snapshot.matchState !== 'MATCH_OVER' && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <PassiveBadge ability={snapshot.playerAbility} />
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

      {/* Side Corner Controls: Restart & Quit only */}
      <div className="pointer-events-auto safe-pad-bottom fixed bottom-3 right-3 z-20 flex items-center gap-1 rounded-xl border border-white/12 bg-[#111827]/92 p-1 shadow-lg backdrop-blur-md sm:bottom-4 sm:right-4">
        <button
          type="button"
          onClick={onRestart}
          title="Restart Match"
          aria-label="Restart Match"
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400 sm:h-9 sm:px-3"
        >
          <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Restart</span>
        </button>
        <span className="h-4 w-px bg-white/10" aria-hidden="true" />
        <button
          type="button"
          onClick={onExitToMenu}
          title="Quit to Main Menu"
          aria-label="Quit to Main Menu"
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-rose-400 sm:h-9 sm:px-3"
        >
          <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Quit</span>
        </button>
      </div>

      {/* Non-blocking Dismissible Landscape Tip on narrow portrait phones */}
      {isNarrowPortrait && !tipDismissed && !snapshot.dragTelemetry.isDragging && (
        <div className="pointer-events-none safe-pad-bottom safe-pad-x fixed inset-x-0 bottom-14 z-10 flex justify-center">
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
                ? 'Practice Freeplay — Test angles, spin & passive control'
                : 'Knock the crimson pen off the desk'}
            </div>
          </div>
        </div>
      )}

    </>
  );
};
