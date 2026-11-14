import React from 'react';
import {
  Activity,
  ChevronRight,
  HelpCircle,
  PenTool,
  Play,
  Settings as SettingsIcon,
  Swords,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PEN_SPECS, PenTypeId, RARITY_COLORS } from '../utils/Constants';
import { DifficultyLevel } from '../game/GameState';

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
  onOpenHowToPlay,
  onOpenSettings,
  onOpenBenchmark,
  onToggleSfx,
}) => {
  const penSpec = PEN_SPECS[penType];
  const rarity = RARITY_COLORS[penSpec.rarity];
  return (
    <div className="pointer-events-none safe-pad-top safe-pad-bottom safe-pad-x fixed inset-0 z-20 flex flex-col justify-between gap-2 sm:p-6">
      {/* Top Row: Record & Quick Utility Controls */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="pointer-events-auto rounded-xl border border-white/15 bg-[#12161f]/90 px-3 py-2 text-xs text-slate-300 sm:px-4">
          <span>Record</span>
          <span aria-hidden="true" className="mx-1.5 text-slate-600 sm:mx-2">·</span>
          <span className="font-mono-num font-semibold text-blue-300">{wins}W</span>
          <span aria-hidden="true" className="mx-1 text-slate-600">/</span>
          <span className="font-mono-num font-semibold text-rose-300">{losses}L</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          {onOpenBenchmark && (
            <button
              type="button"
              onClick={onOpenBenchmark}
              aria-label="Run GPU benchmark"
              title="Run GPU/CPU Benchmark"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-[#12161f]/90 text-slate-200 transition-colors hover:bg-slate-800 hover:text-emerald-400 focus-visible:outline-2 focus-visible:outline-blue-400 sm:h-11 sm:w-11"
            >
              <Activity className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSfx}
            aria-label={sfxEnabled ? 'Mute sound' : 'Unmute sound'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-[#12161f]/90 text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-400 sm:h-11 sm:w-11"
          >
            {sfxEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-rose-400" />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-[#12161f]/90 text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-400 sm:h-11 sm:w-11"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scroll-safe responsive menu card supporting 320x568 portrait and 568x320 landscape */}
      <div className="my-auto flex min-h-0 flex-col items-center justify-center md:items-start">
        <div className="pointer-events-auto modal-scroll-area max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-[#12161f]/92 p-4 shadow-2xl sm:p-6">
          {/* Bespoke Inline SVG Title Lockup */}
          <div className="mb-3 flex items-center gap-3 sm:mb-4 sm:gap-3.5">
            <svg
              viewBox="0 0 56 56"
              className="h-10 w-10 shrink-0 sm:h-12 sm:w-12"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="52" height="52" rx="14" fill="#1e293b" stroke="#334155" strokeWidth="2" />
              <g transform="rotate(-32 28 28)">
                <rect x="12" y="19" width="24" height="6.5" rx="2" fill="#2563eb" />
                <polygon points="36,19 44,22.25 36,25.5" fill="#e2e8f0" />
              </g>
              <g transform="rotate(32 28 28)">
                <rect x="12" y="30.5" width="24" height="6.5" rx="2" fill="#e11d48" />
                <polygon points="36,30.5 44,33.75 36,37" fill="#94a3b8" />
              </g>
            </svg>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl md:text-4xl">
                PEN FIGHT ARENA
              </h1>
              <p className="text-[11px] font-medium text-slate-400 sm:text-xs">
                Tabletop Physics Duel · 1v1 vs AI
              </p>
            </div>
          </div>

          <p className="mb-4 text-xs leading-relaxed text-slate-300 sm:mb-5 sm:text-sm">
            Grab any point on your blue pen, pull back to flex and aim, and release to knock the crimson pen off the school desk.
          </p>

          {/* Equipped Pen / Collection Entry — opens the full 3D Pen Selector */}
          <div className="mb-3.5 sm:mb-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Pen Collection</span>
              <span className="font-normal text-slate-400">{unlockedCount}/6 unlocked</span>
            </div>
            <button
              type="button"
              onClick={onOpenPenSelector}
              className="group flex w-full items-center gap-3 rounded-xl border border-white/12 bg-slate-900 px-3 py-2.5 text-left transition-colors hover:border-sky-400/50 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-400"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${rarity.ring} ${rarity.bg}`}
              >
                <PenTool className={`h-4 w-4 ${rarity.text}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-white">{penSpec.label}</span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${rarity.bg} ${rarity.text}`}
                  >
                    {penSpec.rarity}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                  {penSpec.tagline}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-300" />
            </button>
          </div>

          {/* AI Difficulty Selector */}
          <div className="mb-4 sm:mb-5">
            <div className="mb-1.5 text-xs font-semibold text-slate-400 sm:mb-2">
              AI Difficulty
            </div>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-900 p-1">
              {DIFFICULTIES.map((d) => {
                const active = difficulty === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onSelectDifficulty(d.id)}
                    className={`min-h-[40px] rounded-lg px-1.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-blue-400 ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Play CTA & Secondary Buttons */}
          <div className="flex flex-col gap-2 sm:gap-2.5">
            <button
              type="button"
              disabled={!isReady}
              onClick={onOpenMultiplayer}
              className="flex min-h-[46px] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 text-sm font-bold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-white sm:min-h-[48px] hover:shadow-blue-500/25"
            >
              <Swords className="h-4 w-4" />
              <span>{isReady ? 'Local Multiplayer (1v1 – 3v3)' : 'Loading Arena...'}</span>
            </button>

            <button
              type="button"
              disabled={!isReady}
              onClick={onPlay}
              className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-800/90 px-4 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-400"
            >
              <Play className="h-3.5 w-3.5 fill-current text-sky-400" />
              <span>Quick Play vs AI</span>
            </button>

            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={onOpenHowToPlay}
                className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-slate-800/90 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-blue-400"
              >
                <HelpCircle className="h-4 w-4 shrink-0 text-sky-400" />
                <span className="whitespace-nowrap">How to Play</span>
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-slate-800/90 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-blue-400"
              >
                <SettingsIcon className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="whitespace-nowrap">Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Flat Single-Line Control Hint (hidden on ultra-short landscape phones to preserve space) */}
      <div className="hidden shrink-0 justify-center sm:flex [@media(max-height:460px)]:hidden">
        <div className="rounded-lg border border-white/10 bg-[#12161f]/88 px-4 py-1.5 text-center text-xs text-slate-300">
          Grab Any Point · Pull Back to Aim · Release to Strike · Enter to Start
        </div>
      </div>
    </div>
  );
};
