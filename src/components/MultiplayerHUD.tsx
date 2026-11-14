import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Hammer,
  HelpCircle,
  Home,
  Radio,
  RotateCcw,
  Settings as SettingsIcon,
  Skull,
  Spline,
  Tornado,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { GameSnapshot } from '../game/GameState';
import { PerformanceMonitor } from '../game/PerformanceMonitor';
import { SpecialShotIconKey } from '../utils/Constants';
import { PerformanceOverlay } from './PerformanceOverlay';
import { PowerMeter } from './PowerMeter';

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

const SHOT_ICONS: Record<SpecialShotIconKey, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  BURST: Zap,
  STRIKE: Hammer,
  DASH: Wind,
  CURVE: Spline,
  VORTEX: Tornado,
  SHOCKWAVE: Radio,
};

const hexToRgb = (hex: number): string =>
  `${(hex >> 16) & 0xff}, ${(hex >> 8) & 0xff}, ${hex & 0xff}`;

export const MultiplayerHUD: React.FC<MultiplayerHUDProps> = ({
  snapshot,
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
  const [rosterCollapsed, setRosterCollapsed] = useState(false);
  const mp = snapshot.multiplayer;
  if (!mp) return null;

  const activePlayer = mp.players.find((p) => p.id === mp.activePlayerId);
  const activeAbility = activePlayer ? activePlayer.ability : snapshot.playerAbility;
  const isBlueTeamActive = activePlayer?.team === 'blue';

  const bluePlayers = mp.players.filter((p) => p.team === 'blue');
  const redPlayers = mp.players.filter((p) => p.team === 'red');

  const timerSec = Math.ceil(snapshot.turnTimeRemaining);
  const isTimerDanger = timerSec <= 3 && snapshot.isTurnTimerRunning;
  const isTimerWarning = timerSec <= 5 && timerSec > 3 && snapshot.isTurnTimerRunning;

  const ShotIcon = SHOT_ICONS[activeAbility.icon] ?? Zap;
  const abilityArmed = activeAbility.armed;
  const abilityCooling = !activeAbility.isActive && activeAbility.cooldownRemaining > 0;
  const abilityEnabled = activeAbility.canActivate && snapshot.matchState === 'PLAYER_TURN';

  const rgb = hexToRgb(activeAbility.colorHex);

  return (
    <>
      {/* Top Main Multiplayer Header Bar */}
      <header className="pointer-events-none safe-pad-top safe-pad-x fixed inset-x-0 top-0 z-20 w-full p-2 sm:p-3">
        <div className="flex w-full items-start justify-between gap-2">
          {/* Team Blue Panel (Left) */}
          <div
            className={`pointer-events-auto flex flex-col rounded-xl border p-2 sm:p-2.5 transition-all shadow-md backdrop-blur-md max-w-[40%] sm:max-w-none ${
              isBlueTeamActive && snapshot.matchState === 'PLAYER_TURN'
                ? 'border-blue-400 bg-[#0e172a]/95 ring-1 ring-blue-400/50 shadow-blue-500/20'
                : 'border-white/10 bg-[#0e172a]/85'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-4 w-1.5 rounded-sm bg-blue-500 sm:h-5 sm:w-2" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-extrabold text-blue-300 uppercase tracking-wide">
                  Blue Team
                </span>
                <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-mono-num font-bold text-blue-200 border border-blue-500/30">
                  {mp.blueScore} Alive
                </span>
              </div>
            </div>

            {/* Blue Players Roster */}
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
                      <span className="truncate max-w-[85px] sm:max-w-[120px]">
                        {p.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 font-mono-num text-[9px] text-slate-400">
                        {p.isEliminated ? (
                          <Skull className="h-3 w-3 text-rose-400" />
                        ) : (
                          <>
                            <span>{p.shotsCount}S</span>
                            {p.knockoutsCount > 0 && (
                              <span className="text-amber-300 font-bold">
                                {p.knockoutsCount}KO
                              </span>
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

          {/* Center Stage: Timer & Active Player & Quick Controls */}
          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            {/* Quick Actions (Restart, Sound, Trajectory, Help, Settings, Menu) */}
            <div className="flex items-center gap-0.5 rounded-xl border border-white/12 bg-[#111827]/95 px-1 py-0.5 shadow-lg backdrop-blur-md sm:gap-1 sm:px-2 sm:py-1">
              <button
                type="button"
                onClick={onRestart}
                title="Restart Match"
                aria-label="Restart Match"
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={onToggleSfx}
                title={sfxEnabled ? 'Mute Sound' : 'Enable Sound'}
                aria-label={sfxEnabled ? 'Mute Sound' : 'Enable Sound'}
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
              >
                {sfxEnabled ? <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-400" />}
              </button>
              <button
                type="button"
                onClick={onToggleTrajectory}
                title={showTrajectory ? 'Hide Trajectory Arc' : 'Show Trajectory Arc'}
                aria-label={showTrajectory ? 'Hide Trajectory Arc' : 'Show Trajectory Arc'}
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
              >
                {showTrajectory ? <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" /> : <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" />}
              </button>
              <button
                type="button"
                onClick={() => setRosterCollapsed(!rosterCollapsed)}
                title={rosterCollapsed ? 'Expand Rosters' : 'Collapse Rosters'}
                aria-label="Toggle Rosters"
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white sm:hidden"
              >
                {rosterCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={onOpenHelp}
                title="How to Play"
                aria-label="How to Play"
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                title="Settings"
                aria-label="Settings"
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <SettingsIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={onExitToMenu}
                title="Exit to Main Menu"
                aria-label="Exit to Main Menu"
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>

            {/* Turn Countdown Timer & Turn Notification */}
            {snapshot.turnTimeTotal > 0 && snapshot.matchState === 'PLAYER_TURN' && (
              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-1 shadow-lg transition-all ${
                  isTimerDanger
                    ? 'border-rose-400 bg-rose-950/95 text-rose-200 animate-pulse ring-2 ring-rose-500/50'
                    : isTimerWarning
                      ? 'border-amber-400 bg-amber-950/90 text-amber-200'
                      : 'border-white/15 bg-slate-900/90 text-white'
                }`}
              >
                <Clock className={`h-4 w-4 ${isTimerDanger ? 'text-rose-400' : isTimerWarning ? 'text-amber-400' : 'text-sky-400'}`} />
                <span className="font-mono-num font-extrabold text-sm sm:text-base">
                  {timerSec}s
                </span>
                <span className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
                  {isTimerDanger ? "Hurry! Time Running Out" : "Turn Timer"}
                </span>
              </div>
            )}

            {/* Status Text / Timeout Flash */}
            {snapshot.isTurnTimeoutNotice ? (
              <div className="animate-bounce rounded-lg border border-rose-500 bg-rose-950 px-3 py-1 text-center text-xs font-bold text-rose-200 shadow-xl">
                TIME&apos;S UP! TURN SKIPPED
              </div>
            ) : (
              <div className="max-w-[min(90vw,26rem)] truncate rounded-lg border border-white/10 bg-[#111827]/90 px-3 py-0.5 text-center text-[10px] sm:text-xs font-medium text-slate-200">
                {snapshot.shotStatusText}
              </div>
            )}

            {/* Active Player Special Shot Button */}
            {activePlayer && snapshot.matchState === 'PLAYER_TURN' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onActivateAbility}
                  disabled={!abilityEnabled}
                  title={`${activeAbility.name} (E key)`}
                  className={`relative flex min-h-[38px] items-center gap-2 rounded-lg border px-3 py-1 text-xs font-bold transition-all ${
                    abilityArmed
                      ? 'border-sky-300 bg-sky-950 text-sky-100 ring-2 ring-sky-400 shadow-md animate-pulse'
                      : abilityEnabled
                        ? 'border-emerald-400/80 bg-emerald-950/90 text-emerald-100 hover:bg-emerald-900 shadow-sm'
                        : 'border-white/10 bg-slate-950/80 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <ShotIcon className="h-3.5 w-3.5" style={{ color: `rgb(${rgb})` }} />
                  <span>{activeAbility.name}</span>
                  <span className="rounded bg-black/40 px-1 py-0.5 text-[9px] font-mono-num">
                    {abilityArmed
                      ? 'Aim & Release'
                      : abilityCooling
                        ? `${activeAbility.cooldownRemaining.toFixed(1)}s`
                        : 'Ready (E)'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Team Red Panel (Right) */}
          <div
            className={`pointer-events-auto flex flex-col rounded-xl border p-2 sm:p-2.5 transition-all shadow-md backdrop-blur-md max-w-[40%] sm:max-w-none ${
              !isBlueTeamActive && snapshot.matchState === 'PLAYER_TURN'
                ? 'border-rose-400 bg-[#1e1017]/95 ring-1 ring-rose-400/50 shadow-rose-500/20'
                : 'border-white/10 bg-[#1e1017]/85'
            }`}
          >
            <div className="flex items-center justify-end gap-2">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono-num font-bold text-rose-200 border border-rose-500/30">
                  {mp.redScore} Alive
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-rose-300 uppercase tracking-wide">
                  Red Team
                </span>
              </div>
              <span className="h-4 w-1.5 rounded-sm bg-rose-500 sm:h-5 sm:w-2" />
            </div>

            {/* Red Players Roster */}
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
                              <span className="text-amber-300 font-bold">
                                {p.knockoutsCount}KO
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <span className="truncate max-w-[85px] sm:max-w-[120px] text-right">
                        {p.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Turn Queue Strip & Round Indicator */}
        <div className="pointer-events-auto mt-2 flex items-center justify-center gap-1.5 overflow-x-auto px-2">
          <span className="rounded bg-slate-900/90 border border-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
            Round {mp.roundNumber}
          </span>
          <span className="text-slate-500 text-[10px]">·</span>
          <div className="flex items-center gap-1 overflow-x-auto">
            {mp.turnQueue.map((pid, idx) => {
              const p = mp.players.find((pl) => pl.id === pid);
              if (!p) return null;
              const isCurrent = pid === mp.activePlayerId;
              const isEliminated = p.isEliminated;
              const isBlue = p.team === 'blue';
              return (
                <span
                  key={`${pid}_${idx}`}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-all ${
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

      {/* Real-time FPS Overlay */}
      {showFps && (
        <div className="fixed top-14 right-3 z-25 pointer-events-auto">
          <PerformanceOverlay monitor={monitor} visible={showFps} />
        </div>
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

      {/* Live Drag Power Meter */}
      <PowerMeter telemetry={snapshot.dragTelemetry} />
    </>
  );
};
