import React, { useState } from 'react';
import {
  Clock,
  Crosshair,
  Hammer,
  LogOut,
  Orbit,
  RotateCcw,
  Shield,
  ShieldCheck,
  Skull,
  Wind,
} from 'lucide-react';
import { GameSnapshot } from '../game/GameState';
import { PerformanceMonitor } from '../game/PerformanceMonitor';
import { PenAbilityId } from '../utils/Constants';
import { PerformanceOverlay } from './PerformanceOverlay';

interface MultiplayerHUDProps {
  snapshot: GameSnapshot;
  sfxEnabled: boolean;
  showTrajectory: boolean;
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

const PASSIVE_ICONS: Record<PenAbilityId, React.ComponentType<{ className?: string }>> = {
  CAP_LOCK: ShieldCheck,
  HEAVY_IMPACT: Hammer,
  QUICK_RECOVERY: Wind,
  PRECISION_PULL: Crosshair,
  SPIN_CONTROL: Orbit,
  IMPACT_GUARD: Shield,
};

export const MultiplayerHUD: React.FC<MultiplayerHUDProps> = ({
  snapshot,
  monitor,
  showFps,
  onRestart,
  onExitToMenu,
}) => {
  const [rosterCollapsed, setRosterCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const mp = snapshot.multiplayer;
  if (!mp) return null;

  const activePlayer = mp.players.find((p) => p.id === mp.activePlayerId);
  const activeAbility = activePlayer ? activePlayer.ability : snapshot.playerAbility;
  const isBlueTeamActive = activePlayer?.team === 'blue';

  const bluePlayers = mp.players.filter((p) => p.team === 'blue');
  const redPlayers = mp.players.filter((p) => p.team === 'red');

  const timerSec = Math.max(0, Math.ceil(snapshot.turnTimeRemaining));
  const timerProgress =
    snapshot.turnTimeTotal > 0
      ? Math.max(0, Math.min(1, snapshot.turnTimeRemaining / snapshot.turnTimeTotal))
      : 1;
  const isTimerDanger = timerSec <= 3 && snapshot.isTurnTimerRunning;
  const isTimerWarning = timerSec <= 5 && timerSec > 3 && snapshot.isTurnTimerRunning;

  const PassiveIcon = PASSIVE_ICONS[activeAbility.abilityId] ?? ShieldCheck;

  return (
    <>
      {/* Top Main Multiplayer Header Bar — flex-wrap handles 320px portrait cleanly alongside desktop */}
      <header className="pointer-events-none safe-pad-top safe-pad-x fixed inset-x-0 top-0 z-20 w-full p-2 sm:p-3">
        <div className="flex w-full flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:gap-3">
          {/* Team Blue Panel (Left) — tap header on mobile to expand/collapse roster */}
          <div
            onClick={() => setRosterCollapsed((prev) => !prev)}
            className={`pointer-events-auto order-1 flex cursor-pointer flex-col rounded-xl border p-2 sm:p-2.5 transition-all shadow-md backdrop-blur-md max-w-[46%] sm:max-w-[15rem] ${
              isBlueTeamActive && snapshot.matchState === 'PLAYER_TURN'
                ? 'border-blue-400 bg-[#0e172a]/95 ring-1 ring-blue-400/50 shadow-blue-500/20'
                : 'border-white/10 bg-[#0e172a]/85'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="h-4 w-1.5 rounded-sm bg-blue-500 sm:h-5 sm:w-2 shrink-0" />
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                <span className="text-[11px] sm:text-xs font-extrabold text-blue-300 uppercase tracking-wide whitespace-nowrap">
                  Blue Team
                </span>
                <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-mono-num font-bold text-blue-200 border border-blue-500/30 whitespace-nowrap">
                  {mp.blueScore} Alive
                </span>
                {mp.blueKnockouts > 0 && (
                  <span className="hidden sm:inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono-num font-bold text-amber-300 border border-amber-500/30">
                    {mp.blueKnockouts} KO
                  </span>
                )}
              </div>
            </div>

            {!rosterCollapsed && (
              <div className="mt-1.5 space-y-1">
                {bluePlayers.map((p) => {
                  const isActive = p.id === mp.activePlayerId && snapshot.matchState === 'PLAYER_TURN';
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                        p.isEliminated
                          ? 'opacity-40 line-through text-slate-500'
                          : isActive
                            ? 'bg-blue-500/25 text-white font-bold'
                            : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate max-w-[85px] sm:max-w-[115px]">{p.name}</span>
                      <div className="flex items-center gap-1 shrink-0 font-mono-num text-[9px] text-slate-400">
                        {p.isEliminated ? (
                          <Skull className="h-3 w-3 text-rose-400" />
                        ) : (
                          <>
                            <span>{p.shotsCount}S</span>
                            {p.knockoutsCount > 0 && (
                              <span className="text-amber-300 font-bold">{p.knockoutsCount}KO</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Group: Team Red Panel + Non-overlapping PerformanceOverlay */}
          <div className="order-2 flex items-start gap-1.5 sm:order-3 sm:gap-2">
            <div
              onClick={() => setRosterCollapsed((prev) => !prev)}
              className={`pointer-events-auto flex cursor-pointer flex-col rounded-xl border p-2 sm:p-2.5 transition-all shadow-md backdrop-blur-md max-w-[12rem] sm:max-w-[15rem] ${
                !isBlueTeamActive && snapshot.matchState === 'PLAYER_TURN'
                  ? 'border-rose-400 bg-[#1e1017]/95 ring-1 ring-rose-400/50 shadow-rose-500/20'
                  : 'border-white/10 bg-[#1e1017]/85'
              }`}
            >
              <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5">
                  {mp.redKnockouts > 0 && (
                    <span className="hidden sm:inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono-num font-bold text-amber-300 border border-amber-500/30">
                      {mp.redKnockouts} KO
                    </span>
                  )}
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono-num font-bold text-rose-200 border border-rose-500/30 whitespace-nowrap">
                    {mp.redScore} Alive
                  </span>
                  <span className="text-[11px] sm:text-xs font-extrabold text-rose-300 uppercase tracking-wide whitespace-nowrap">
                    Red Team
                  </span>
                </div>
                <span className="h-4 w-1.5 rounded-sm bg-rose-500 sm:h-5 sm:w-2 shrink-0" />
              </div>

              {!rosterCollapsed && (
                <div className="mt-1.5 space-y-1">
                  {redPlayers.map((p) => {
                    const isActive = p.id === mp.activePlayerId && snapshot.matchState === 'PLAYER_TURN';
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                          p.isEliminated
                            ? 'opacity-40 line-through text-slate-500'
                            : isActive
                              ? 'bg-rose-500/25 text-white font-bold'
                              : 'text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1 shrink-0 font-mono-num text-[9px] text-slate-400">
                          {p.isEliminated ? (
                            <Skull className="h-3 w-3 text-rose-400" />
                          ) : (
                            <>
                              <span>{p.shotsCount}S</span>
                              {p.knockoutsCount > 0 && (
                                <span className="text-amber-300 font-bold">{p.knockoutsCount}KO</span>
                              )}
                            </>
                          )}
                        </div>
                        <span className="truncate max-w-[85px] sm:max-w-[115px] text-right">
                          {p.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <PerformanceOverlay
              monitor={monitor}
              visible={showFps}
              className="pointer-events-auto shrink-0 hidden md:block"
            />
          </div>

          {/* Center Stage: Countdown Timer, Status & Active Passive Skill */}
          <div className="pointer-events-auto order-3 flex w-full flex-col items-center gap-1.5 sm:order-2 sm:w-auto">

            {/* Turn Countdown Timer + Smooth Progress Bar */}
            {snapshot.turnTimeTotal > 0 && snapshot.matchState === 'PLAYER_TURN' && !snapshot.isTurnTimeoutNotice && (
              <div
                className={`relative overflow-hidden flex items-center gap-2 rounded-xl border px-3.5 py-1.5 shadow-lg transition-colors ${
                  isTimerDanger
                    ? 'border-rose-400 bg-rose-950/95 text-rose-200 animate-pulse ring-2 ring-rose-500/50'
                    : isTimerWarning
                      ? 'border-amber-400 bg-amber-950/90 text-amber-200'
                      : 'border-white/15 bg-slate-900/92 text-white'
                }`}
              >
                <Clock
                  className={`h-4 w-4 ${
                    isTimerDanger ? 'text-rose-400' : isTimerWarning ? 'text-amber-400' : 'text-sky-400'
                  }`}
                />
                <span className="font-mono-num font-extrabold text-sm sm:text-base">
                  {timerSec}s
                </span>
                <span className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
                  {isTimerDanger
                    ? 'Hurry!'
                    : isTimerWarning
                      ? '5s Warning'
                      : mp.transitionPlayer
                        ? 'Ready'
                        : 'Turn Timer'}
                </span>
                <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/40" aria-hidden="true">
                  <span
                    className={`block h-full transition-[width] duration-100 ease-linear ${
                      isTimerDanger ? 'bg-rose-400' : isTimerWarning ? 'bg-amber-400' : 'bg-sky-400'
                    }`}
                    style={{ width: `${Math.round(timerProgress * 100)}%` }}
                  />
                </span>
              </div>
            )}

            {/* Status Text / Timeout Flash */}
            {snapshot.isTurnTimeoutNotice ? (
              <div className="rounded-lg border border-rose-500 bg-rose-950/95 px-3.5 py-1 text-center text-xs font-extrabold text-rose-200 shadow-xl ring-2 ring-rose-500/40">
                TIME&apos;S UP! {activePlayer?.name.toUpperCase()}&apos;S TURN SKIPPED
              </div>
            ) : (
              <div className="max-w-[min(92vw,28rem)] truncate rounded-lg border border-white/10 bg-[#111827]/90 px-3 py-0.5 text-center text-[10px] sm:text-xs font-medium text-slate-200">
                {snapshot.shotStatusText}
              </div>
            )}

            {/* Active Player Passive Skill Badge */}
            {activePlayer && snapshot.matchState === 'PLAYER_TURN' && !snapshot.isTurnTimeoutNotice && (
              <div
                title={`${activeAbility.passiveName}: ${activeAbility.passiveSummary}`}
                className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-[#111827]/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 shadow-sm"
              >
                <PassiveIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span className="whitespace-nowrap">{activeAbility.passiveName}</span>
                <span className="hidden text-slate-500 sm:inline" aria-hidden="true">·</span>
                <span className="hidden text-[10px] font-normal text-slate-300 sm:inline">
                  {activeAbility.passiveSummary}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Turn Queue Strip & Round Indicator */}
        <div className="pointer-events-auto mt-2 flex items-center justify-center gap-1.5 overflow-x-auto px-2">
          <span className="shrink-0 rounded bg-slate-900/90 border border-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
            Round {mp.roundNumber}
          </span>
          <span className="text-slate-500 text-[10px]">·</span>
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {mp.turnQueue.map((pid, idx) => {
              const p = mp.players.find((pl) => pl.id === pid);
              if (!p) return null;
              const isCurrent = pid === mp.activePlayerId;
              const isEliminated = p.isEliminated;
              const isBlue = p.team === 'blue';
              return (
                <span
                  key={`${pid}_${idx}`}
                  className={`flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-all ${
                    isEliminated
                      ? 'opacity-30 line-through bg-black/40 text-slate-500'
                      : isCurrent
                        ? isBlue
                          ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-md font-bold'
                          : 'bg-rose-600 text-white ring-2 ring-rose-400 shadow-md font-bold'
                        : isBlue
                          ? 'bg-blue-950/60 text-blue-300 border border-blue-500/20'
                          : 'bg-rose-950/60 text-rose-300 border border-rose-500/20'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isBlue ? 'bg-blue-400' : 'bg-rose-400'}`} />
                  <span>{p.name}</span>
                </span>
              );
            })}
          </div>
        </div>
      </header>

      {/* 3-Second Match Start Countdown */}
      {snapshot.matchState === 'COUNTDOWN' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4">
          <div
            key={snapshot.countdownValue}
            className="animate-countdown rounded-2xl border border-white/20 bg-[#111827]/95 px-8 py-5 text-center shadow-2xl sm:px-12 sm:py-7 backdrop-blur-md"
          >
            <div className="font-display font-mono-num text-5xl font-extrabold tracking-tight text-amber-400 sm:text-7xl">
              {snapshot.countdownValue > 0 ? snapshot.countdownValue : 'FIGHT!'}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {mp.mode} · Knock opposing pens off the desk!
            </div>
          </div>
        </div>
      )}

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
    </>
  );
};
