import React from 'react';
import {
  Activity,
  Award,
  BookOpen,
  Compass,
  PenTool,
  Play,
  Settings as SettingsIcon,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DifficultyLevel } from '../game/GameState';
import { PEN_SPECS, PenTypeId } from '../utils/Constants';
import { getPaperRarityTheme, PaperDivider, PaperSectionLabel } from './PaperUI';

interface MainMenuProps {
  difficulty: DifficultyLevel;
  penType: PenTypeId;
  sfxEnabled: boolean;
  wins: number;
  losses: number;
  unlockedCount: number;
  isReady: boolean;
  onSelectDifficulty: (level: DifficultyLevel) => void;
  onOpenPenSelector: () => void;
  onPlay: () => void;
  onOpenMultiplayer: () => void;
  onOpenArenas: () => void;
  onOpenStats: () => void;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onOpenBenchmark?: () => void;
  onToggleSfx: () => void;
}

const DIFFICULTIES: Array<{ id: DifficultyLevel; label: string }> = [
  { id: 'EASY', label: 'Easy' },
  { id: 'NORMAL', label: 'Normal' },
  { id: 'HARD', label: 'Hard' },
  { id: 'EXPERT', label: 'Expert' },
];

export const MainMenu: React.FC<MainMenuProps> = ({
  difficulty,
  penType,
  sfxEnabled,
  wins,
  losses,
  unlockedCount,
  isReady,
  onSelectDifficulty,
  onOpenPenSelector,
  onPlay,
  onOpenMultiplayer,
  onOpenArenas,
  onOpenStats,
  onOpenHowToPlay,
  onOpenSettings,
  onOpenBenchmark,
  onToggleSfx,
}) => {
  const penSpec = PEN_SPECS[penType];
  const rarity = getPaperRarityTheme(penSpec.rarity);

  return (
    <div className="pointer-events-none safe-pad-top safe-pad-bottom safe-pad-x fixed inset-0 z-20 flex flex-col justify-between gap-2 p-3 sm:p-6">
      {/* Top Row: Compact Record Chip & Paper Utility Icons */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenStats}
          className="pointer-events-auto paper-btn flex min-h-[40px] items-center gap-2 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 py-1.5 text-xs text-[#292725] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
          title="View Statistics"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6E6A64]">
            Record
          </span>
          <span aria-hidden="true" className="h-3.5 w-px bg-[#D9C5A8]" />
          <span className="font-mono-num font-bold text-[#365B82]">{wins}W</span>
          <span aria-hidden="true" className="text-[#6E6A64]">/</span>
          <span className="font-mono-num font-bold text-[#9E3B36]">{losses}L</span>
        </button>

        <div className="pointer-events-auto flex items-center gap-2">
          {onOpenBenchmark && (
            <button
              type="button"
              onClick={onOpenBenchmark}
              aria-label="Run hardware benchmark"
              title="Hardware Benchmark"
              className="paper-btn flex h-10 w-10 items-center justify-center rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725] hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
            >
              <Activity className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSfx}
            aria-label={sfxEnabled ? 'Mute sound' : 'Unmute sound'}
            title={sfxEnabled ? 'Sound On' : 'Sound Muted'}
            className="paper-btn flex h-10 w-10 items-center justify-center rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725] hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
          >
            {sfxEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-[#9E3B36]" />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
            className="paper-btn flex h-10 w-10 items-center justify-center rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725] hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Editorial Card */}
      <div className="my-auto flex min-h-0 flex-col items-center justify-center md:items-start">
        <div className="pointer-events-auto modal-scroll-area paper-shadow-lg max-h-full w-full max-w-[430px] overflow-y-auto rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8]">
          {/* Dotted Paper Header Strip */}
          <div className="paper-dots-inset border-b border-[#D9C5A8] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center gap-3.5">
              {/* Custom Editorial Ink Stamp Emblem */}
              <svg
                viewBox="0 0 56 56"
                className="paper-shadow-sm h-11 w-11 shrink-0 rounded-lg sm:h-12 sm:w-12"
                aria-hidden="true"
              >
                <rect
                  x="1"
                  y="1"
                  width="54"
                  height="54"
                  rx="8"
                  fill="#FFFDF8"
                  stroke="#45413C"
                  strokeWidth="2"
                />
                <g transform="rotate(-32 28 28)">
                  <rect x="12" y="19" width="23" height="6" rx="1.5" fill="#4F6D8A" stroke="#292725" strokeWidth="1.2" />
                  <polygon points="35,19 43,22 35,25" fill="#FFFDF8" stroke="#292725" strokeWidth="1.2" />
                </g>
                <g transform="rotate(32 28 28)">
                  <rect x="12" y="31" width="23" height="6" rx="1.5" fill="#B55450" stroke="#292725" strokeWidth="1.2" />
                  <polygon points="35,31 43,34 35,37" fill="#D9C5A8" stroke="#292725" strokeWidth="1.2" />
                </g>
              </svg>

              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6E6A64]">
                  Tabletop Physics Edition
                </div>
                <h1 className="font-display text-2xl font-extrabold uppercase tracking-[0.03em] text-[#292725] sm:text-[28px] leading-tight">
                  PEN FIGHT ARENA
                </h1>
              </div>
            </div>

            <p className="mt-2.5 text-xs leading-relaxed text-[#57534E]">
              Grab any point along your pen, pull back to build torque, and knock rivals off the classroom wooden desk.
            </p>
          </div>

          {/* Card Body */}
          <div className="space-y-4 p-4 sm:p-6">
            {/* Primary Dusty-Blue Play CTA + Local Multiplayer */}
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={!isReady}
                onClick={onPlay}
                className="paper-btn flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#4F6D8A] px-5 text-sm font-bold uppercase tracking-[0.06em] text-[#FFFDF8] hover:bg-[#435E79] focus-visible:outline-2 focus-visible:outline-[#292725] disabled:cursor-wait disabled:opacity-60"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{isReady ? 'Play vs AI' : 'Preparing Desk...'}</span>
              </button>

              <button
                type="button"
                disabled={!isReady}
                onClick={onOpenMultiplayer}
                className="paper-btn flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-[#45413C] bg-[#EFEAE0] px-4 text-xs font-bold uppercase tracking-[0.05em] text-[#292725] hover:bg-[#E5DEC9] focus-visible:outline-2 focus-visible:outline-[#4F6D8A] disabled:cursor-wait disabled:opacity-60"
              >
                <Swords className="h-4 w-4 text-[#4F6D8A]" />
                <span>Local Multiplayer &amp; Modes</span>
              </button>
            </div>

            <PaperDivider />

            {/* Difficulty Strip */}
            <div>
              <PaperSectionLabel className="mb-1.5" right="Solo AI">
                AI Difficulty
              </PaperSectionLabel>
              <div className="grid grid-cols-4 gap-1 rounded-lg border border-[#45413C] bg-[#EFEAE0] p-1">
                {DIFFICULTIES.map((d) => {
                  const active = difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onSelectDifficulty(d.id)}
                      aria-pressed={active}
                      className={`min-h-[36px] rounded-md px-1 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-[#4F6D8A] ${
                        active
                          ? 'border border-[#45413C] bg-[#7893AD] text-[#1A1918] shadow-[1.5px_1.5px_0px_#45413C]'
                          : 'border border-transparent text-[#6E6A64] hover:text-[#292725]'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <PaperDivider />

            {/* Equipped Pen Compact Strip + Secondary Editorial Grid */}
            <div className="space-y-2.5">
              <PaperSectionLabel right={`${unlockedCount}/6 Unlocked`}>
                Stationery &amp; Records
              </PaperSectionLabel>

              <button
                type="button"
                onClick={onOpenPenSelector}
                className="paper-btn flex w-full items-center gap-3 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 py-2.5 text-left hover:bg-[#F7F3EA] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#45413C] bg-[#EFEAE0] text-[#292725]">
                  <PenTool className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-[#292725]">
                      {penSpec.label}
                    </span>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${rarity.badgeBg} ${rarity.badgeText} ${rarity.badgeBorder}`}
                    >
                      {penSpec.rarity}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[#6E6A64]">
                    Pen Collection · {penSpec.passive.name}
                  </span>
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onOpenArenas}
                  className="paper-btn flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 text-xs font-bold text-[#292725] hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
                >
                  <Compass className="h-3.5 w-3.5 text-[#4F6D8A]" />
                  <span>Arena Selection</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenStats}
                  className="paper-btn flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 text-xs font-bold text-[#292725] hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
                >
                  <Award className="h-3.5 w-3.5 text-[#85581A]" />
                  <span>Statistics</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="paper-btn flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 text-xs font-bold text-[#292725] hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
                >
                  <SettingsIcon className="h-3.5 w-3.5 text-[#6E6A64]" />
                  <span>Settings</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenHowToPlay}
                  className="paper-btn flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 text-xs font-bold text-[#292725] hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
                >
                  <BookOpen className="h-3.5 w-3.5 text-[#2E664B]" />
                  <span>How to Play</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Paper Tip Slip */}
      <div className="hidden shrink-0 justify-center sm:flex [@media(max-height:460px)]:hidden">
        <div className="paper-shadow-sm rounded-lg border border-[#45413C] bg-[#FFFDF8] px-4 py-1.5 text-center text-[11px] font-medium text-[#57534E]">
          Grab any point on your pen · Pull back to aim · Release to launch · Press Enter to start
        </div>
      </div>
    </div>
  );
};
