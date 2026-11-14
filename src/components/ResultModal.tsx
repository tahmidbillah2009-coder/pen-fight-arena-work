import React from 'react';
import { Home, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { PEN_SPECS, RARITY_COLORS } from '../utils/Constants';
import { GameSnapshot } from '../game/GameState';
import type { ProgressionEvent } from '../game/Progression';

interface ResultModalProps {
  snapshot: GameSnapshot;
  progression?: ProgressionEvent | null;
  onPlayAgain: () => void;
  onExitToMenu: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  snapshot,
  progression,
  onPlayAgain,
  onExitToMenu,
}) => {
  if (snapshot.matchState !== 'MATCH_OVER' || !snapshot.winner) return null;

  const isVictory = snapshot.winner === 'player';
  const unlockedPens = progression?.unlockedPens ?? [];
  const completedAchievements = progression?.completedAchievements ?? [];
  const hasRewards = unlockedPens.length > 0 || completedAchievements.length > 0;

  return (
    <div className="safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 z-30 flex items-center justify-center bg-black/55">
      <div className="animate-modal-in modal-scroll-area max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-[#12161f] p-5 text-center shadow-2xl sm:p-7">
        {/* Custom SVG Victory / Defeat Emblem */}
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center sm:mb-4 sm:h-16 sm:w-16">
          {isVictory ? (
            <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
              <circle cx="32" cy="32" r="30" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="2.5" />
              <path
                d="M21 20h22v10c0 7.5-4.8 13-11 14.5C25.8 43 21 37.5 21 30V20z"
                fill="#fbbf24"
              />
              <rect x="28" y="44" width="8" height="6" fill="#d97706" />
              <rect x="23" y="50" width="18" height="4" rx="2" fill="#f59e0b" />
            </svg>
          ) : (
            <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
              <circle cx="32" cy="32" r="30" fill="#4c0519" stroke="#fb7185" strokeWidth="2.5" />
              <path
                d="M23 23l18 18M41 23L23 41"
                stroke="#fda4af"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>

        <h2
          className={`font-display text-2xl font-extrabold tracking-tight sm:text-3xl ${
            isVictory ? 'text-amber-400' : 'text-rose-400'
          }`}
        >
          {isVictory ? 'VICTORY!' : 'DEFEAT'}
        </h2>
        <p className="mt-1.5 text-xs text-slate-300 sm:text-sm">{snapshot.loserReason}</p>

        {/* Match Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-slate-900/90 p-2.5 sm:mt-5 sm:p-3">
          <div>
            <div className="text-[11px] text-slate-400">Turns</div>
            <div className="font-mono-num text-sm font-bold text-white sm:text-base">
              {snapshot.stats.turnsPlayed}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Max Power</div>
            <div className="font-mono-num text-sm font-bold text-white sm:text-base">
              {snapshot.stats.maxPowerPercent}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Hits</div>
            <div className="font-mono-num text-sm font-bold text-white sm:text-base">
              {snapshot.stats.collisions}
            </div>
          </div>
        </div>

        {/* Achievement & pen-unlock rewards from this match */}
        {hasRewards && (
          <div className="mt-3 space-y-2 text-left sm:mt-4">
            {completedAchievements.length > 0 && (
              <div className="rounded-xl border border-amber-400/35 bg-amber-950/25 p-2.5 sm:p-3">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-amber-200">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>Achievement Unlocked</span>
                </div>
                <ul className="space-y-1">
                  {completedAchievements.map((a) => (
                    <li key={a.id} className="text-[11px] text-amber-100/90">
                      <span className="font-semibold text-amber-100">{a.label}</span>
                      <span className="text-amber-100/70"> — {a.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {unlockedPens.map((pen) => {
              const spec = PEN_SPECS[pen];
              const rarity = RARITY_COLORS[spec.rarity];
              return (
                <div
                  key={pen}
                  className={`flex items-center gap-2.5 rounded-xl border p-2.5 sm:p-3 ${rarity.ring} ${rarity.bg}`}
                >
                  <Sparkles className={`h-4 w-4 shrink-0 ${rarity.text}`} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
                      New Pen Unlocked
                    </div>
                    <div className="truncate text-sm font-bold text-white">{spec.label}</div>
                    <div className="truncate text-[11px] text-slate-400">{spec.tagline}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row">
          <button
            type="button"
            onClick={onPlayAgain}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition-colors focus-visible:outline-2 focus-visible:outline-white ${
              isVictory
                ? 'bg-blue-600 hover:bg-blue-500'
                : 'bg-rose-600 hover:bg-rose-500'
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            <span>{isVictory ? 'Play Again' : 'Try Again'}</span>
          </button>

          <button
            type="button"
            onClick={onExitToMenu}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-800 px-5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            <Home className="h-4 w-4" />
            <span>Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
