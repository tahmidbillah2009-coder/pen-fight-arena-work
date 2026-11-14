import React, { useEffect, useState } from 'react';
import { Award, Bot, ChevronRight, Clock, Flame, Swords, Users } from 'lucide-react';
import {
  GameMode,
  MULTIPLAYER_MODES,
  TeamId,
  TURN_TIMER_OPTIONS,
  TurnTimerOption,
} from '../game/MultiplayerTypes';
import { LocalMultiplayerRecord, MultiplayerStorage } from '../utils/MultiplayerStorage';
import { PaperDivider, PaperModalShell, PaperSectionLabel } from './PaperUI';

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
    <PaperModalShell
      title="Game Mode Selection"
      subtitle="Same-device hot-seat multiplayer, solo AI & practice freeplay"
      icon={<Swords className="h-4 w-4" />}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      zIndexClass="z-30"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 truncate text-xs text-[#6E6A64]">
            {isMultiplayer ? (
              <span>
                Selected: <strong className="text-[#292725]">{currentModeSpec?.label}</strong> ·{' '}
                <strong className="text-[#365B82]">{currentModeSpec?.playerCount} Players</strong>
              </span>
            ) : (
              <span>
                Selected:{' '}
                <strong className="text-[#292725]">
                  {isAiMode ? 'Player vs AI' : 'Practice Mode'}
                </strong>
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="paper-btn min-h-[40px] rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-4 text-xs font-bold text-[#292725] hover:bg-[#EFEAE0]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProceed}
              className="paper-btn flex min-h-[40px] items-center gap-1.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#4F6D8A] px-5 text-xs font-bold uppercase tracking-[0.05em] text-[#FFFDF8] hover:bg-[#435E79]"
            >
              <span>{isMultiplayer ? 'Player Setup' : 'Start Match'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 p-4 sm:p-6">
        {/* Local Multiplayer Modes */}
        <div>
          <PaperSectionLabel className="mb-2.5" right="2 to 6 Players · Pass & Play">
            Local Multiplayer Modes
          </PaperSectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {MULTIPLAYER_MODES.map((mode) => {
              const isSelected = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedMode(mode.id)}
                  aria-pressed={isSelected}
                  className={`paper-btn flex flex-col items-start rounded-xl border-[1.5px] p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'border-[#365B82] bg-[#E8EFF6]'
                      : 'border-[#45413C] bg-[#FFFDF8] hover:bg-[#F7F3EA]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-display text-sm font-extrabold uppercase tracking-[0.03em] text-[#292725]">
                      {mode.label}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded border border-[#45413C]/40 bg-[#FFFDF8] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#292725]">
                      <Users className="h-3 w-3 text-[#4F6D8A]" />
                      {mode.playerCount}P
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-[#6E6A64]">{mode.sublabel}</div>

                  <div className="mt-3 flex w-full items-center gap-1.5 text-[10px] font-bold">
                    <span className="rounded border border-[#365B82]/50 bg-[#E8EFF6] px-1.5 py-0.5 text-[#365B82]">
                      Blue {mode.blueCount}
                    </span>
                    <span className="text-[#6E6A64]">vs</span>
                    <span className="rounded border border-[#9E3B36]/50 bg-[#F9EAE9] px-1.5 py-0.5 text-[#9E3B36]">
                      Red {mode.redCount}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Solo & Practice */}
        <div>
          <PaperSectionLabel className="mb-2.5">Solo &amp; Practice Modes</PaperSectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedMode('VS_AI')}
              aria-pressed={selectedMode === 'VS_AI'}
              className={`paper-btn flex items-center gap-3 rounded-xl border-[1.5px] p-3.5 text-left ${
                selectedMode === 'VS_AI'
                  ? 'border-[#365B82] bg-[#E8EFF6]'
                  : 'border-[#45413C] bg-[#FFFDF8] hover:bg-[#F7F3EA]'
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#45413C] bg-[#EFEAE0] text-[#365B82]">
                <Bot className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#292725]">Player vs AI</span>
                  <span className="rounded border border-[#45413C]/40 bg-[#FFFDF8] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#292725]">
                    1P
                  </span>
                </span>
                <span className="block text-[11px] text-[#6E6A64]">Classic 1v1 duel against bot</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode('PRACTICE')}
              aria-pressed={selectedMode === 'PRACTICE'}
              className={`paper-btn flex items-center gap-3 rounded-xl border-[1.5px] p-3.5 text-left ${
                selectedMode === 'PRACTICE'
                  ? 'border-[#2E664B] bg-[#E6F2EC]'
                  : 'border-[#45413C] bg-[#FFFDF8] hover:bg-[#F7F3EA]'
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#45413C] bg-[#EFEAE0] text-[#2E664B]">
                <Flame className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#292725]">Practice Mode</span>
                  <span className="rounded border border-[#45413C]/40 bg-[#FFFDF8] px-1.5 py-0.5 text-[10px] font-bold text-[#2E664B]">
                    Freeplay
                  </span>
                </span>
                <span className="block text-[11px] text-[#6E6A64]">Unlimited shots &amp; target resets</span>
              </span>
            </button>
          </div>
        </div>

        {/* Turn Timer & Starting Team */}
        {isMultiplayer && (
          <>
            <PaperDivider />
            <div className="space-y-4 rounded-xl border-[1.5px] border-[#45413C] bg-[#F7F3EA] p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#292725]">
                <Clock className="h-4 w-4 text-[#4F6D8A]" />
                <span>Turn Timer &amp; Match Rules</span>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-[#57534E]">
                  <span className="font-semibold">Turn Duration</span>
                  <span className="font-mono-num font-bold text-[#292725]">
                    {turnTimer === 0 ? 'Unlimited' : `${turnTimer}s per turn`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {TURN_TIMER_OPTIONS.map((opt) => {
                    const active = turnTimer === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTurnTimer(opt.value)}
                        aria-pressed={active}
                        className={`min-h-[38px] rounded-lg border px-2 text-xs font-bold transition-colors ${
                          active
                            ? 'border-[#45413C] bg-[#4F6D8A] text-[#FFFDF8] shadow-[1.5px_1.5px_0px_#45413C]'
                            : 'border-[#45413C]/50 bg-[#FFFDF8] text-[#57534E] hover:bg-[#EFEAE0] hover:text-[#292725]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-[#6E6A64]">
                  Turns automatically skip when time expires. Active shots are never interrupted.
                </p>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-semibold text-[#57534E]">
                  First Turn Advantage
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStartingTeam('blue')}
                    aria-pressed={startingTeam === 'blue'}
                    className={`flex min-h-[40px] items-center justify-center gap-2 rounded-lg border-[1.5px] text-xs font-bold transition-colors ${
                      startingTeam === 'blue'
                        ? 'border-[#365B82] bg-[#E8EFF6] text-[#365B82] shadow-[1.5px_1.5px_0px_#365B82]'
                        : 'border-[#45413C]/50 bg-[#FFFDF8] text-[#57534E] hover:bg-[#EFEAE0]'
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-[#4F6D8A]" />
                    <span>Team Blue Starts</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStartingTeam('red')}
                    aria-pressed={startingTeam === 'red'}
                    className={`flex min-h-[40px] items-center justify-center gap-2 rounded-lg border-[1.5px] text-xs font-bold transition-colors ${
                      startingTeam === 'red'
                        ? 'border-[#9E3B36] bg-[#F9EAE9] text-[#9E3B36] shadow-[1.5px_1.5px_0px_#9E3B36]'
                        : 'border-[#45413C]/50 bg-[#FFFDF8] text-[#57534E] hover:bg-[#EFEAE0]'
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-[#B55450]" />
                    <span>Team Red Starts</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Local Scoreboard Summary */}
        {records.matchesPlayed > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#45413C] bg-[#EFEAE0] px-4 py-2.5 text-xs text-[#57534E]">
            <span className="flex items-center gap-1.5 font-semibold text-[#292725]">
              <Award className="h-4 w-4 text-[#85581A]" />
              <span>Local Scoreboard</span>
            </span>
            <div className="flex items-center gap-2 font-mono-num font-bold">
              <span className="text-[#365B82]">Blue {records.blueWins}W</span>
              <span className="text-[#8D8579]">·</span>
              <span className="text-[#9E3B36]">Red {records.redWins}W</span>
              <span className="text-[#8D8579]">·</span>
              <span className="text-[#292725]">{records.matchesPlayed} Matches</span>
            </div>
          </div>
        )}
      </div>
    </PaperModalShell>
  );
};
