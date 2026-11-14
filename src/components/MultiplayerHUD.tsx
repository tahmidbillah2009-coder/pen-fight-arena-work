import React, { useState } from 'react';
import { Clock, LogOut, RotateCcw, Skull } from 'lucide-react';
import { GameSnapshot } from '../game/GameState';
import { PerformanceMonitor } from '../game/PerformanceMonitor';
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

  const isVertical = snapshot.arenaOrientation === 'vertical';
  const activePlayer = mp.players.find((p) => p.id === mp.activePlayerId);
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

  const blueTeamCard = (
    <div
      onClick={() => setRosterCollapsed((prev) => !prev)}
      className={`pointer-events-auto flex cursor-pointer flex-col rounded-xl border p-2 sm:p-2.5 transition-all shadow-md backdrop-blur-md ${
        isVertical ? 'max-w-[calc(100vw-6.75rem)] sm:max-w-[15rem]' : 'max-w-[46%] sm:max-w-[15rem]'
      } ${
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
  );

  const redTeamCard = (
    <div
      onClick={() => setRosterCollapsed((prev) => !prev)}
      className={`pointer-events-auto flex cursor-pointer flex-col rounded-xl border p-2 sm:p-2.5 transition-all shadow-md backdrop-blur-md max-w-[12.5rem] sm:max-w-[15rem] ${
        !isBlueTeamActive && snapshot.matchState === 'PLAYER_TURN'
          ? 'border-rose-400 bg-[#1e1017]/95 ring-1 ring-rose-400/50 shadow-rose-500/20'
          : 'border-white/10 bg-[#1e1017]/85'
      }`}
    >
      <div className={`flex items-center ${isVertical ? 'justify-start' : 'justify-end'} gap-1.5 sm:gap-2`}>
        {isVertical && (
          <span className="h-4 w-1.5 rounded-sm bg-rose-500 sm:h-5 sm:w-2 shrink-0" />
        )}
        <div className={`flex flex-wrap items-center ${isVertical ? 'justify-start' : 'justify-end'} gap-1 sm:gap-1.5`}>
          {isVertical ? (
            <>
              <span className="text-[11px] sm:text-xs font-extrabold text-rose-300 uppercase tracking-wide whitespace-nowrap">
                Red Team
              </span>
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono-num font-bold text-rose-200 border border-rose-500/30 whitespace-nowrap">
                {mp.redScore} Alive
              </span>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
        {!isVertical && (
          <span className="h-4 w-1.5 rounded-sm bg-rose-500 sm:h-5 sm:w-2 shrink-0" />
        )}
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
  );

  const timerBanner =
    snapshot.turnTimeTotal > 0 &&
    snapshot.matchState === 'PLAYER_TURN' &&
    !snapshot.isTurnTimeoutNotice ? (
      <div
        className={`relative overflow-hidden flex items-center gap-1.5 rounded-xl border px-2.5 py-1 shadow-md transition-colors ${
          isTimerDanger
            ? 'border-rose-400 bg-rose-950/95 text-rose-200 animate-pulse'
            : isTimerWarning
              ? 'border-amber-400 bg-amber-950/90 text-amber-200'
              : 'border-white/15 bg-slate-900/90 text-white'
        }`}
      >
        <Clock
          className={`h-3.5 w-3.5 ${
            isTimerDanger ? 'text-rose-400' : isTimerWarning ? 'text-amber-400' : 'text-sky-400'
          }`}
        />
        <span className="font-mono-num font-bold text-xs sm:text-sm">{timerSec}s</span>
        {isTimerDanger && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-300">
            !
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 h-[2.5px] bg-black/40" aria-hidden="true">
          <span
            className={`block h-full transition-[width] duration-100 ease-linear ${
              isTimerDanger ? 'bg-rose-400' : isTimerWarning ? 'bg-amber-400' : 'bg-sky-400'
            }`}
            style={{ width: `${Math.round(timerProgress * 100)}%` }}
          />
        </span>
      </div>
    ) : null;

  const isFreshTurn = Boolean(mp.transitionPlayer) && snapshot.matchState === 'PLAYER_TURN';

  const minimalTurnPill = snapshot.isTurnTimeoutNotice ? (
    <div className="rounded-lg border border-rose-500/80 bg-rose-950/95 px-3 py-1 text-center text-[11px] font-bold text-rose-200 shadow-md">
      Time&apos;s up · {activePlayer?.name} skipped
    </div>
  ) : activePlayer && snapshot.matchState === 'PLAYER_TURN' ? (
    <div
      className={`flex max-w-[min(90vw,22rem)] items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] sm:text-xs font-semibold transition-all shadow-sm ${
        isBlueTeamActive
          ? isFreshTurn
            ? 'border-blue-400 bg-blue-950/95 text-white ring-2 ring-blue-400/60'
            : 'border-blue-400/40 bg-[#0e172a]/88 text-slate-100'
          : isFreshTurn
            ? 'border-rose-400 bg-rose-950/95 text-white ring-2 ring-rose-400/60'
            : 'border-rose-400/40 bg-[#1e1017]/88 text-slate-100'
      }`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          isBlueTeamActive ? 'bg-blue-400' : 'bg-rose-400'
        }`}
      />
      <span className="truncate">{activePlayer.name}&apos;s turn</span>
    </div>
  ) : snapshot.matchState === 'SHOT_IN_PROGRESS' ? (
    <div className="max-w-[min(90vw,22rem)] truncate rounded-full border border-white/10 bg-[#111827]/85 px-3 py-0.5 text-center text-[10px] sm:text-xs font-medium text-slate-300">
      {snapshot.shotStatusText}
    </div>
  ) : null;

  return (
    <>
      {isVertical ? (
        <>
          {/* Minimal Portrait Top Perimeter: Red Team + Timer + Single Turn Pill */}
          <header className="pointer-events-none safe-pad-top safe-pad-x fixed inset-x-0 top-0 z-20 w-full p-2 sm:p-3">
            <div className="flex w-full items-start justify-between gap-2">
              {redTeamCard}
              <div className="flex items-start gap-1.5">
                {timerBanner}
                <PerformanceOverlay
                  monitor={monitor}
                  visible={showFps}
                  className="pointer-events-auto shrink-0 hidden md:block"
                />
              </div>
            </div>

            {minimalTurnPill && (
              <div className="pointer-events-none mt-1.5 flex w-full justify-center">
                {minimalTurnPill}
              </div>
            )}
          </header>

          {/* Portrait Bottom-Left: Blue Team (bottom pens) */}
          <div className="pointer-events-none safe-pad-bottom fixed bottom-3 left-3 z-20 sm:bottom-4 sm:left-4">
            {blueTeamCard}
          </div>
        </>
      ) : (
        /* Minimal Horizontal Perimeter HUD — desktop, laptop, and landscape */
        <header className="pointer-events-none safe-pad-top safe-pad-x fixed inset-x-0 top-0 z-20 w-full p-2 sm:p-3">
          <div className="flex w-full flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:gap-3">
            <div className="order-1">{blueTeamCard}</div>

            <div className="order-2 flex items-start gap-1.5 sm:order-3 sm:gap-2">
              {redTeamCard}
              <PerformanceOverlay
                monitor={monitor}
                visible={showFps}
                className="pointer-events-auto shrink-0 hidden md:block"
              />
            </div>

            <div className="pointer-events-none order-3 flex w-full flex-wrap items-center justify-center gap-1.5 sm:order-2 sm:w-auto">
              {timerBanner}
              {minimalTurnPill}
            </div>
          </div>
        </header>
      )}

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

      {/* Side Corner Controls: Mini Restart & Quit icons only */}
      <div className="pointer-events-none safe-pad-bottom fixed bottom-3 right-3 z-20 sm:bottom-4 sm:right-4">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-white/12 bg-[#111827]/92 p-1 shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={onRestart}
            title="Restart Match"
            aria-label="Restart Match"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <span className="h-4 w-px bg-white/10" aria-hidden="true" />
          <button
            type="button"
            onClick={onExitToMenu}
            title="Quit to Main Menu"
            aria-label="Quit to Main Menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-rose-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
};
