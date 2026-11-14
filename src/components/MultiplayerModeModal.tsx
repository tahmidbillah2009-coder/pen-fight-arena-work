import React, { useEffect, useState } from 'react';
import {
  Award,
  Bot,
  ChevronRight,
  Clock,
  Flame,
  Swords,
  Users,
  X,
} from 'lucide-react';
import {
  GameMode,
  MULTIPLAYER_MODES,
  TeamId,
  TURN_TIMER_OPTIONS,
  TurnTimerOption,
} from '../game/MultiplayerTypes';
import { LocalMultiplayerRecord, MultiplayerStorage } from '../utils/MultiplayerStorage';

interface MultiplayerModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (
    mode: GameMode,
    timerOption: TurnTimerOption,
    startingTeam: TeamId
  ) => void;
}

export const MultiplayerModeModal: React.FC<MultiplayerModeModalProps> = ({
  isOpen,
  onClose,
  onSelectMode,
}) => {
  const [records, setRecords] = useState<LocalMultiplayerRecord>(() => MultiplayerStorage.load());
  const [selectedMode, setSelectedMode] = useState<GameMode>(records.lastMode || '1v1');
  const [turnTimer, setTurnTimer] = useState<TurnTimerOption>(records.timerPreference ?? 15);
  const [startingTeam, setStartingTeam] = useState<TeamId>(records.startingTeamPreference || 'blue');

  useEffect(() => {
    if (!isOpen) return;
    const latest = MultiplayerStorage.load();
    setRecords(latest);
    setSelectedMode(latest.lastMode || '1v1');
    setTurnTimer(latest.timerPreference ?? 15);
    setStartingTeam(latest.startingTeamPreference || 'blue');
  }, [isOpen]);

  if (!isOpen) return null;

  const currentModeSpec = MULTIPLAYER_MODES.find((m) => m.id === selectedMode);
  const isAiMode = selectedMode === 'VS_AI';
  const isPracticeMode = selectedMode === 'PRACTICE';
  const isMultiplayer = !isAiMode && !isPracticeMode;

  const handleProceed = () => {
    MultiplayerStorage.saveModePreference(selectedMode, turnTimer, startingTeam);
    onSelectMode(selectedMode, turnTimer, startingTeam);
  };

  return (
    <div className="safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm">
      <div className="animate-modal-in modal-scroll-area flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col rounded-2xl border border-white/15 bg-[#10141e] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Swords className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
                MATCH MODE SELECTION
              </h2>
              <p className="text-xs text-slate-400">
                Same-device hot-seat multiplayer · One shared screen &amp; arena
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Mode Selection Grid */}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>LOCAL MULTIPLAYER MODES</span>
              <span className="text-[11px] text-blue-400">2 to 6 Players · Pass &amp; Play</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {MULTIPLAYER_MODES.map((mode) => {
                const isSelected = selectedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSelectedMode(mode.id)}
                    className={`group relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? 'border-blue-400 bg-blue-950/40 shadow-lg shadow-blue-500/10 ring-1 ring-blue-400'
                        : 'border-white/10 bg-slate-900/60 hover:border-white/25 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-display text-base font-extrabold text-white">
                        {mode.label}
                      </span>
                      <span className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                        <Users className="h-3 w-3 text-sky-400" />
                        {mode.playerCount} Players
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-slate-400">{mode.sublabel}</div>

                    {/* Team distribution badge */}
                    <div className="mt-3 flex w-full items-center gap-1.5 text-[11px] font-medium">
                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-1.5 py-0.5 text-blue-300 font-semibold border border-blue-500/30">
                        Blue: {mode.blueCount}
                      </span>
                      <span className="text-slate-500 text-xs">vs</span>
                      <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-300 font-semibold border border-rose-500/30">
                        Red: {mode.redCount}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Solo & Practice Options */}
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-400">
              SOLO &amp; PRACTICE MODES
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedMode('VS_AI')}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  selectedMode === 'VS_AI'
                    ? 'border-blue-400 bg-blue-950/40 ring-1 ring-blue-400'
                    : 'border-white/10 bg-slate-900/60 hover:border-white/25 hover:bg-slate-900'
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">Player vs AI</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">1P</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Classic 1v1 duel against bot</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode('PRACTICE')}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  selectedMode === 'PRACTICE'
                    ? 'border-emerald-400 bg-emerald-950/35 ring-1 ring-emerald-400'
                    : 'border-white/10 bg-slate-900/60 hover:border-white/25 hover:bg-slate-900'
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Flame className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">Practice Mode</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">Freeplay</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Unlimited shots &amp; respawn targets</div>
                </div>
              </button>
            </div>
          </div>

          {/* Pre-Match Settings (Turn Duration & Starting Team) */}
          {isMultiplayer && (
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Clock className="h-4 w-4 text-amber-400" />
                <span>Turn Timer &amp; Match Rules</span>
              </div>

              {/* Turn Duration selection */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300">
                  <span>Turn Duration</span>
                  <span className="font-semibold text-amber-300">
                    {turnTimer === 0 ? 'Unlimited' : `${turnTimer} seconds per turn`}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {TURN_TIMER_OPTIONS.map((opt) => {
                    const active = turnTimer === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTurnTimer(opt.value)}
                        className={`min-h-[38px] rounded-lg border px-2 text-xs font-semibold transition-all ${
                          active
                            ? 'border-amber-400 bg-amber-950/60 text-amber-200'
                            : 'border-white/10 bg-slate-950/50 text-slate-400 hover:text-white hover:border-white/20'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Turns automatically skip when time expires. Shots in motion are never cancelled.
                </p>
              </div>

              {/* Starting Team Selection */}
              <div>
                <div className="mb-1.5 text-xs text-slate-300">First Turn Advantage</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStartingTeam('blue')}
                    className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-all ${
                      startingTeam === 'blue'
                        ? 'border-blue-400 bg-blue-900/50 text-blue-200'
                        : 'border-white/10 bg-slate-950/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                    <span>Team Blue Starts</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStartingTeam('red')}
                    className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-all ${
                      startingTeam === 'red'
                        ? 'border-rose-400 bg-rose-900/50 text-rose-200'
                        : 'border-white/10 bg-slate-950/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span>Team Red Starts</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Local Multiplayer Records Summary */}
          {records.matchesPlayed > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-amber-400" />
                <span>Local Scoreboard:</span>
              </span>
              <div className="flex items-center gap-2 font-mono-num">
                <span className="font-semibold text-blue-300">Blue {records.blueWins}W</span>
                <span className="text-slate-600">·</span>
                <span className="font-semibold text-rose-300">Red {records.redWins}W</span>
                <span className="text-slate-600">·</span>
                <span>{records.matchesPlayed} Matches</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-slate-900/80 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="text-xs text-slate-400 min-w-0 truncate">
            {isMultiplayer ? (
              <span>
                Selected: <strong className="text-white">{currentModeSpec?.label}</strong> ·{' '}
                <strong className="text-sky-300">{currentModeSpec?.playerCount} Players</strong>
              </span>
            ) : (
              <span>
                Selected: <strong className="text-white">{isAiMode ? 'Player vs AI' : 'Practice Mode'}</strong>
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-700 sm:px-4"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleProceed}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-colors hover:bg-blue-500 sm:px-5"
            >
              <span>{isMultiplayer ? 'Next: Player Setup' : 'Start Match'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
