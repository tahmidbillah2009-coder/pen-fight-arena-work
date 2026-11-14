import React from 'react';
import {
  AlertTriangle,
  Crosshair,
  Hammer,
  LogOut,
  Orbit,
  Pause,
  RotateCcw,
  Shield,
  ShieldCheck,
  Wind,
} from 'lucide-react';
import { DifficultyLevel, GameSnapshot } from '../game/GameState';
import type { PerformanceMonitor } from '../game/PerformanceMonitor';
import { PenAbilityId } from '../utils/Constants';
import { MultiplayerHUD } from './MultiplayerHUD';
import { PerformanceOverlay } from './PerformanceOverlay';

interface GameHUDProps {
  snapshot: GameSnapshot;
  difficulty: DifficultyLevel;
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
  onPause,
  onRestart,
  onOpenSettings,
  onOpenHelp,
  onExitToMenu,
}) => {
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
        onPause={onPause}
        onRestart={onRestart}
        onOpenSettings={onOpenSettings}
        onOpenHelp={onOpenHelp}
        onExitToMenu={onExitToMenu}
      />
    );
  }

  const isVertical = snapshot.arenaOrientation === 'vertical';
  const isPractice = snapshot.gameMode === 'PRACTICE';
  const isPlayerActive =
    snapshot.matchState === 'PLAYER_TURN' ||
    (snapshot.matchState === 'SHOT_IN_PROGRESS' && snapshot.activeTurn === 'player');
  const isBotActive =
    !isPractice &&
    (snapshot.matchState === 'BOT_TURN' ||
      (snapshot.matchState === 'SHOT_IN_PROGRESS' && snapshot.activeTurn === 'bot'));

  const diffLabel = difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
  const drag = snapshot.dragTelemetry;
  const powerPct = Math.round(drag.powerRatio * 100);

  const playerCard = (
    <div
      className={`pointer-events-auto paper-shadow-sm flex items-center gap-2 rounded-lg border-[1.5px] px-2.5 py-1.5 transition-colors sm:gap-3 sm:px-3.5 sm:py-2 ${
        isPlayerActive
          ? 'border-[#365B82] bg-[#E8EFF6] text-[#292725]'
          : 'border-[#45413C] bg-[#FFFDF8] text-[#292725]'
      }`}
    >
      <span className="h-5 w-1.5 rounded-sm bg-[#4F6D8A] sm:h-7 sm:w-2" aria-hidden="true" />
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 text-xs font-bold sm:gap-2 sm:text-sm">
          <span className="whitespace-nowrap">You</span>
          <span aria-hidden="true" className="text-[#8D8579]">·</span>
          <span className="font-mono-num text-[#365B82]">{snapshot.wins}W</span>
        </div>
        <div className="text-[9px] font-semibold uppercase tracking-wider text-[#6E6A64] sm:text-[10px]">
          {snapshot.matchState === 'PLAYER_TURN' ? 'Active Turn' : 'Cobalt Pen'}
        </div>
      </div>
    </div>
  );

  const botCard = (
    <div
      className={`pointer-events-auto paper-shadow-sm flex items-center gap-2 rounded-lg border-[1.5px] px-2.5 py-1.5 transition-colors sm:gap-3 sm:px-3.5 sm:py-2 ${
        isBotActive
          ? 'border-[#9E3B36] bg-[#F9EAE9] text-[#292725]'
          : 'border-[#45413C] bg-[#FFFDF8] text-[#292725]'
      }`}
    >
      {isVertical && (
        <span className="h-5 w-1.5 rounded-sm bg-[#B55450] sm:h-7 sm:w-2" aria-hidden="true" />
      )}
      <div className={`${isVertical ? 'text-left' : 'text-right'} leading-tight`}>
        <div
          className={`flex items-center ${isVertical ? 'justify-start' : 'justify-end'} gap-1.5 text-xs font-bold sm:gap-2 sm:text-sm`}
        >
          {isVertical ? (
            <>
              <span className="whitespace-nowrap">{isPractice ? 'Target' : 'Bot'}</span>
              <span aria-hidden="true" className="text-[#8D8579]">·</span>
              <span className="font-mono-num text-[#9E3B36]">{snapshot.losses}W</span>
            </>
          ) : (
            <>
              <span className="font-mono-num text-[#9E3B36]">{snapshot.losses}W</span>
              <span aria-hidden="true" className="text-[#8D8579]">·</span>
              <span className="whitespace-nowrap">{isPractice ? 'Target' : 'Bot'}</span>
            </>
          )}
        </div>
        <div className="text-[9px] font-semibold uppercase tracking-wider text-[#6E6A64] sm:text-[10px]">
          {isPractice
            ? 'Practice Target'
            : snapshot.matchState === 'BOT_TURN'
              ? 'Aiming...'
              : `${diffLabel} AI`}
        </div>
      </div>
      {!isVertical && (
        <span className="h-5 w-1.5 rounded-sm bg-[#B55450] sm:h-7 sm:w-2" aria-hidden="true" />
      )}
    </div>
  );

  const statusAndWarnings = (
    <>
      <div className="paper-shadow-sm max-w-[min(90vw,32rem)] truncate rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 py-1 text-center text-[10px] font-semibold text-[#292725] sm:text-xs">
        {snapshot.shotStatusText}
      </div>

      {snapshot.matchState !== 'MENU' &&
        snapshot.matchState !== 'MATCH_OVER' &&
        (snapshot.edgeWarning.player !== 'SAFE' || snapshot.edgeWarning.bot === 'DANGER') && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {snapshot.edgeWarning.player !== 'SAFE' && (
              <div
                className={`paper-shadow-sm flex items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 py-0.5 text-[11px] font-bold ${
                  snapshot.edgeWarning.player === 'DANGER'
                    ? 'border-[#9E3B36] bg-[#F9EAE9] text-[#9E3B36]'
                    : 'border-[#9C6C2B] bg-[#FBF3E2] text-[#85581A]'
                }`}
              >
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>
                  {snapshot.edgeWarning.playerOobProgress > 0
                    ? 'Edge Drop Risk'
                    : snapshot.edgeWarning.player === 'DANGER'
                      ? 'Danger: Near Edge'
                      : 'Edge Warning'}
                </span>
                {snapshot.edgeWarning.playerOobProgress > 0 && (
                  <span className="h-1.5 w-8 overflow-hidden rounded-full border border-[#9E3B36]/40 bg-[#FFFDF8]">
                    <span
                      className="block h-full bg-[#B55450]"
                      style={{ width: `${Math.round(snapshot.edgeWarning.playerOobProgress * 100)}%` }}
                    />
                  </span>
                )}
              </div>
            )}

            {snapshot.edgeWarning.bot === 'DANGER' && (
              <div className="paper-shadow-sm flex items-center gap-1 rounded-lg border-[1.5px] border-[#2E664B] bg-[#E6F2EC] px-2.5 py-0.5 text-[11px] font-bold text-[#2E664B]">
                <span>{isPractice ? 'Target Near Edge' : 'Bot Near Edge'}</span>
              </div>
            )}
          </div>
        )}
    </>
  );

  return (
    <>
      {isVertical ? (
        <>
          <header className="pointer-events-none safe-pad-top safe-pad-x fixed inset-x-0 top-0 z-20 w-full p-2 sm:p-3">
            <div className="flex w-full items-start justify-between gap-2">
              {botCard}
              <PerformanceOverlay
                monitor={monitor}
                visible={showFps}
                className="pointer-events-auto shrink-0"
              />
            </div>
            <div className="pointer-events-none mt-1.5 flex w-full flex-col items-center gap-1">
              {statusAndWarnings}
            </div>
          </header>

          <div className="pointer-events-none safe-pad-bottom fixed bottom-3 left-3 z-20 sm:bottom-4 sm:left-4">
            {playerCard}
          </div>
        </>
      ) : (
        <header className="pointer-events-none safe-pad-top safe-pad-x fixed inset-x-0 top-0 z-20 w-full p-2 sm:p-4">
          <div className="flex w-full flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:gap-3">
            <div className="order-1">{playerCard}</div>

            <div className="order-2 flex items-start gap-1.5 sm:order-3 sm:gap-2">
              {botCard}
              <PerformanceOverlay
                monitor={monitor}
                visible={showFps}
                className="pointer-events-auto shrink-0"
              />
            </div>

            <div className="pointer-events-none order-3 flex w-full flex-col items-center gap-1 sm:order-2 sm:w-auto sm:gap-1.5">
              {statusAndWarnings}
            </div>
          </div>
        </header>
      )}

      {/* Compact Drag Power Indicator — only rendered while actively pulling a pen */}
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

      {/* Center 3-Second Countdown Card */}
      {snapshot.matchState === 'COUNTDOWN' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center p-4">
          <div
            key={snapshot.countdownValue}
            className="animate-countdown paper-shadow-lg rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-9 py-5 text-center sm:px-12 sm:py-6"
          >
            <div className="font-display font-mono-num text-5xl font-extrabold tracking-tight text-[#4F6D8A] sm:text-7xl">
              {snapshot.countdownValue > 0 ? snapshot.countdownValue : 'FIGHT!'}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#6E6A64]">
              {isPractice
                ? 'Practice Freeplay · Test spin & control'
                : 'Knock the rival pen off the desk'}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
