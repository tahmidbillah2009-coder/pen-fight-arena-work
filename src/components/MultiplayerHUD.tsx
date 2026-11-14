import React, { useState } from 'react';
import { Clock, LogOut, Pause, RotateCcw, Skull } from 'lucide-react';
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
  onPause: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onExitToMenu: () => void;
}

export const MultiplayerHUD: React.FC<MultiplayerHUDProps> = ({
  snapshot,
  monitor,
  showFps,
  onPause,
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

  const drag = snapshot.dragTelemetry;
  const powerPct = Math.round(drag.powerRatio * 100);

  const blueTeamCard = (
    <div
      onClick={() => setRosterCollapsed((prev) => !prev)}
      className={`pointer-events-auto paper-shadow-sm flex cursor-pointer flex-col rounded-lg border-[1.5px] p-2 sm:p-2.5 transition-colors ${
        isVertical ? 'max-w-[calc(100vw-8.5rem)] sm:max-w-[15rem]' : 'max-w-[46%] sm:max-w-[15rem]'
      } ${
        isBlueTeamActive && snapshot.matchState === 'PLAYER_TURN'
          ? 'border-[#365B82] bg-[#E8EFF6]'
          : 'border-[#45413C] bg-[#FFFDF8]'
      }`}
    >
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="h-4 w-1.5 shrink-0 rounded-sm bg-[#4F6D8A] sm:h-5 sm:w-2" />
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#365B82] sm:text-xs whitespace-nowrap">
            Blue
          </span>
          <span className="rounded border border-[#365B82]/40 bg-[#FFFDF8] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#365B82] whitespace-nowrap">
            {mp.blueScore} Alive
          </span>
          {mp.blueKnockouts > 0 && (
            <span className="hidden sm:inline-block rounded border border-[#9C6C2B]/50 bg-[#FBF3E2] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#85581A]">
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
                    ? 'line-through text-[#8D8579] opacity-60'
                    : isActive
                      ? 'border border-[#365B82]/40 bg-[#FFFDF8] font-bold text-[#292725]'
                      : 'text-[#57534E]'
                }`}
              >
                <span className="max-w-[85px] truncate sm:max-w-[115px]">{p.name}</span>
                <div className="flex shrink-0 items-center gap-1 font-mono-num text-[9px] text-[#6E6A64]">
                  {p.isEliminated ? (
                    <Skull className="h-3 w-3 text-[#9E3B36]" />
                  ) : (
                    <>
                      <span>{p.shotsCount}S</span>
                      {p.knockoutsCount > 0 && (
                        <span className="font-bold text-[#85581A]">{p.knockoutsCount}KO</span>
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
      className={`pointer-events-auto paper-shadow-sm flex max-w-[12.5rem] cursor-pointer flex-col rounded-lg border-[1.5px] p-2 sm:max-w-[15rem] sm:p-2.5 transition-colors ${
        !isBlueTeamActive && snapshot.matchState === 'PLAYER_TURN'
          ? 'border-[#9E3B36] bg-[#F9EAE9]'
          : 'border-[#45413C] bg-[#FFFDF8]'
      }`}
    >
      <div className={`flex items-center ${isVertical ? 'justify-start' : 'justify-end'} gap-1.5 sm:gap-2`}>
        {isVertical && (
          <span className="h-4 w-1.5 shrink-0 rounded-sm bg-[#B55450] sm:h-5 sm:w-2" />
        )}
        <div className={`flex flex-wrap items-center ${isVertical ? 'justify-start' : 'justify-end'} gap-1 sm:gap-1.5`}>
          {isVertical ? (
            <>
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#9E3B36] sm:text-xs whitespace-nowrap">
                Red
              </span>
              <span className="rounded border border-[#9E3B36]/40 bg-[#FFFDF8] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#9E3B36] whitespace-nowrap">
                {mp.redScore} Alive
              </span>
            </>
          ) : (
            <>
              {mp.redKnockouts > 0 && (
                <span className="hidden sm:inline-block rounded border border-[#9C6C2B]/50 bg-[#FBF3E2] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#85581A]">
                  {mp.redKnockouts} KO
                </span>
              )}
              <span className="rounded border border-[#9E3B36]/40 bg-[#FFFDF8] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#9E3B36] whitespace-nowrap">
                {mp.redScore} Alive
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#9E3B36] sm:text-xs whitespace-nowrap">
                Red
              </span>
            </>
          )}
        </div>
        {!isVertical && (
          <span className="h-4 w-1.5 shrink-0 rounded-sm bg-[#B55450] sm:h-5 sm:w-2" />
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
                    ? 'line-through text-[#8D8579] opacity-60'
                    : isActive
                      ? 'border border-[#9E3B36]/40 bg-[#FFFDF8] font-bold text-[#292725]'
                      : 'text-[#57534E]'
                }`}
              >
                <div className="flex shrink-0 items-center gap-1 font-mono-num text-[9px] text-[#6E6A64]">
                  {p.isEliminated ? (
                    <Skull className="h-3 w-3 text-[#9E3B36]" />
                  ) : (
                    <>
                      <span>{p.shotsCount}S</span>
                      {p.knockoutsCount > 0 && (
                        <span className="font-bold text-[#85581A]">{p.knockoutsCount}KO</span>
                      )}
                    </>
                  )}
                </div>
                <span className="max-w-[85px] truncate text-right sm:max-w-[115px]">
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
        className={`paper-shadow-sm relative flex items-center gap-1.5 overflow-hidden rounded-lg border-[1.5px] px-2.5 py-1 ${
          isTimerDanger
            ? 'border-[#9E3B36] bg-[#F9EAE9] text-[#9E3B36]'
            : isTimerWarning
              ? 'border-[#9C6C2B] bg-[#FBF3E2] text-[#85581A]'
              : 'border-[#45413C] bg-[#FFFDF8] text-[#292725]'
        }`}
      >
        <Clock className="h-3.5 w-3.5" />
        <span className="font-mono-num text-xs font-bold sm:text-sm">{timerSec}s</span>
        <span className="absolute inset-x-0 bottom-0 h-[2.5px] bg-[#EFEAE0]" aria-hidden="true">
          <span
            className={`block h-full transition-[width] duration-100 ease-linear ${
              isTimerDanger ? 'bg-[#B55450]' : isTimerWarning ? 'bg-[#A3702B]' : 'bg-[#4F6D8A]'
            }`}
            style={{ width: `${Math.round(timerProgress * 100)}%` }}
          />
        </span>
      </div>
    ) : null;

  const isFreshTurn = Boolean(mp.transitionPlayer) && snapshot.matchState === 'PLAYER_TURN';

  const minimalTurnPill = snapshot.isTurnTimeoutNotice ? (
    <div className="paper-shadow-sm rounded-lg border-[1.5px] border-[#9E3B36] bg-[#F9EAE9] px-3 py-1 text-center text-[11px] font-bold text-[#9E3B36]">
      Time&apos;s up · {activePlayer?.name} skipped
    </div>
  ) : activePlayer && snapshot.matchState === 'PLAYER_TURN' ? (
    <div
      className={`paper-shadow-sm flex max-w-[min(90vw,22rem)] items-center gap-1.5 rounded-lg border-[1.5px] px-3 py-1 text-[11px] font-bold transition-colors sm:text-xs ${
        isBlueTeamActive
          ? isFreshTurn
            ? 'border-[#365B82] bg-[#E8EFF6] text-[#292725]'
            : 'border-[#45413C] bg-[#FFFDF8] text-[#292725]'
          : isFreshTurn
            ? 'border-[#9E3B36] bg-[#F9EAE9] text-[#292725]'
            : 'border-[#45413C] bg-[#FFFDF8] text-[#292725]'
      }`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          isBlueTeamActive ? 'bg-[#4F6D8A]' : 'bg-[#B55450]'
        }`}
      />
      <span className="truncate">{activePlayer.name}&apos;s turn</span>
    </div>
  ) : snapshot.matchState === 'SHOT_IN_PROGRESS' ? (
    <div className="paper-shadow-sm max-w-[min(90vw,22rem)] truncate rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 py-0.5 text-center text-[10px] font-semibold text-[#57534E] sm:text-xs">
      {snapshot.shotStatusText}
    </div>
  ) : null;

  return (
    <>
      {isVertical ? (
        <>
          <header className="pointer-events-none safe-pad-top safe-pad-x fixed inset-x-0 top-0 z-20 w-full p-2 sm:p-3">
            <div className="flex w-full items-start justify-between gap-2">
              {redTeamCard}
              <div className="flex items-start gap-1.5">
                {timerBanner}
                <PerformanceOverlay
                  monitor={monitor}
                  visible={showFps}
                  className="pointer-events-auto hidden shrink-0 md:block"
                />
              </div>
            </div>

            {minimalTurnPill && (
              <div className="pointer-events-none mt-1.5 flex w-full justify-center">
                {minimalTurnPill}
              </div>
            )}
          </header>

          <div className="pointer-events-none safe-pad-bottom fixed bottom-3 left-3 z-20 sm:bottom-4 sm:left-4">
            {blueTeamCard}
          </div>
        </>
      ) : (
        <header className="pointer-events-none safe-pad-top safe-pad-x fixed inset-x-0 top-0 z-20 w-full p-2 sm:p-3">
          <div className="flex w-full flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:gap-3">
            <div className="order-1">{blueTeamCard}</div>

            <div className="order-2 flex items-start gap-1.5 sm:order-3 sm:gap-2">
              {redTeamCard}
              <PerformanceOverlay
                monitor={monitor}
                visible={showFps}
                className="pointer-events-auto hidden shrink-0 md:block"
              />
            </div>

            <div className="pointer-events-none order-3 flex w-full flex-wrap items-center justify-center gap-1.5 sm:order-2 sm:w-auto">
              {timerBanner}
              {minimalTurnPill}
            </div>
          </div>
        </header>
      )}

      {/* Compact Drag Power Indicator — only visible while dragging */}
      {drag.isDragging && (
        <div className="pointer-events-none safe-pad-bottom fixed bottom-3 left-1/2 z-20 -translate-x-1/2 sm:bottom-4">
          <div className="paper-shadow-sm flex items-center gap-2.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 py-1.5 text-[11px] font-bold text-[#292725]">
            <span className="uppercase tracking-wider text-[#6E6A64]">{drag.anchorZone}</span>
            <span className="h-2 w-20 overflow-hidden rounded-full border border-[#45413C] bg-[#EFEAE0]">
              <span
                className="block h-full transition-[width] duration-75"
                style={{
                  width: `${Math.max(4, powerPct)}%`,
                  backgroundColor:
                    powerPct > 85 ? '#B55450' : powerPct > 60 ? '#A3702B' : '#4F6D8A',
                }}
              />
            </span>
            <span className="font-mono-num text-[#292725]">{powerPct}%</span>
          </div>
        </div>
      )}

      {/* 3-Second Match Start Countdown */}
      {snapshot.matchState === 'COUNTDOWN' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4">
          <div
            key={snapshot.countdownValue}
            className="animate-countdown paper-shadow-lg rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-8 py-5 text-center sm:px-12 sm:py-7"
          >
            <div className="font-display font-mono-num text-5xl font-extrabold tracking-tight text-[#4F6D8A] sm:text-7xl">
              {snapshot.countdownValue > 0 ? snapshot.countdownValue : 'FIGHT!'}
            </div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#6E6A64]">
              {mp.mode} · Knock opposing pens off the desk
            </div>
          </div>
        </div>
      )}

      {/* Minimal Mini Corner Controls: Pause, Restart & Quit icons */}
      <div className="pointer-events-none safe-pad-bottom fixed bottom-3 right-3 z-20 sm:bottom-4 sm:right-4">
        <div className="pointer-events-auto paper-shadow-sm flex items-center gap-0.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] p-1">
          <button
            type="button"
            onClick={onPause}
            title="Pause Match"
            aria-label="Pause Match"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#292725] transition-colors hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
          <span className="h-4 w-px bg-[#D9C5A8]" aria-hidden="true" />
          <button
            type="button"
            onClick={onRestart}
            title="Restart Match"
            aria-label="Restart Match"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#292725] transition-colors hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <span className="h-4 w-px bg-[#D9C5A8]" aria-hidden="true" />
          <button
            type="button"
            onClick={onExitToMenu}
            title="Quit to Main Menu"
            aria-label="Quit to Main Menu"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#9E3B36] transition-colors hover:bg-[#F9EAE9] focus-visible:outline-2 focus-visible:outline-[#9E3B36]"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
};
