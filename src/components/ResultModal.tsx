import React from 'react';
import { Home, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { GameSnapshot } from '../game/GameState';
import type { ProgressionEvent } from '../game/Progression';
import { PEN_SPECS } from '../utils/Constants';
import { getPaperRarityTheme } from './PaperUI';

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
    <div
      className="safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 z-30 flex items-center justify-center bg-[#292725]/45 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-modal-in modal-scroll-area paper-shadow-lg max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8] p-5 text-center text-[#292725] sm:p-7">
        {/* Editorial Ink Stamp Emblem */}
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center sm:mb-4 sm:h-16 sm:w-16">
          {isVictory ? (
            <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
              <circle cx="32" cy="32" r="29" fill="#E8EFF6" stroke="#45413C" strokeWidth="2.5" />
              <path
                d="M21 20h22v10c0 7.5-4.8 13-11 14.5C25.8 43 21 37.5 21 30V20z"
                fill="#D9C5A8"
                stroke="#45413C"
                strokeWidth="2"
              />
              <rect x="28" y="44" width="8" height="6" fill="#4F6D8A" stroke="#45413C" strokeWidth="1.5" />
              <rect x="23" y="50" width="18" height="4" rx="1.5" fill="#45413C" />
            </svg>
          ) : (
            <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
              <circle cx="32" cy="32" r="29" fill="#F9EAE9" stroke="#45413C" strokeWidth="2.5" />
              <path
                d="M23 23l18 18M41 23L23 41"
                stroke="#9E3B36"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>

        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6E6A64]">
          Match Report
        </div>
        <h2
          className={`font-display mt-0.5 text-2xl font-extrabold uppercase tracking-[0.04em] sm:text-3xl ${
            isVictory ? 'text-[#365B82]' : 'text-[#9E3B36]'
          }`}
        >
          {isVictory ? 'Victory' : 'Defeat'}
        </h2>
        <p className="mt-1.5 text-xs text-[#57534E] sm:text-sm">{snapshot.loserReason}</p>

        {/* Match Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border-[1.5px] border-[#45413C] bg-[#F7F3EA] p-3 sm:mt-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A64]">Turns</div>
            <div className="font-mono-num mt-0.5 text-sm font-bold text-[#292725] sm:text-base">
              {snapshot.stats.turnsPlayed}
            </div>
          </div>
          <div className="border-x border-[#D9C5A8]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A64]">
              Max Power
            </div>
            <div className="font-mono-num mt-0.5 text-sm font-bold text-[#292725] sm:text-base">
              {snapshot.stats.maxPowerPercent}%
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A64]">Hits</div>
            <div className="font-mono-num mt-0.5 text-sm font-bold text-[#292725] sm:text-base">
              {snapshot.stats.collisions}
            </div>
          </div>
        </div>

        {/* Achievement & Pen Unlock Slips */}
        {hasRewards && (
          <div className="mt-3 space-y-2 text-left sm:mt-4">
            {completedAchievements.length > 0 && (
              <div className="rounded-xl border-[1.5px] border-[#9C6C2B] bg-[#FBF3E2] p-3">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#85581A]">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>Milestone Reached</span>
                </div>
                <ul className="space-y-1">
                  {completedAchievements.map((a) => (
                    <li key={a.id} className="text-xs text-[#292725]">
                      <span className="font-bold">{a.label}</span>
                      <span className="text-[#6E6A64]"> — {a.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {unlockedPens.map((pen) => {
              const spec = PEN_SPECS[pen];
              const rarity = getPaperRarityTheme(spec.rarity);
              return (
                <div
                  key={pen}
                  className={`flex items-center gap-2.5 rounded-xl border-[1.5px] p-3 ${rarity.badgeBorder} ${rarity.badgeBg}`}
                >
                  <Sparkles className={`h-4 w-4 shrink-0 ${rarity.badgeText}`} />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A64]">
                      New Pen Unlocked
                    </div>
                    <div className="truncate text-sm font-bold text-[#292725]">{spec.label}</div>
                    <div className="truncate text-[11px] text-[#57534E]">{spec.tagline}</div>
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
            className={`paper-btn flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border-[1.5px] border-[#45413C] px-5 text-xs font-bold uppercase tracking-[0.06em] text-[#FFFDF8] ${
              isVictory
                ? 'bg-[#4F6D8A] hover:bg-[#435E79]'
                : 'bg-[#9E3B36] hover:bg-[#86312D]'
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            <span>{isVictory ? 'Play Again' : 'Try Again'}</span>
          </button>

          <button
            type="button"
            onClick={onExitToMenu}
            className="paper-btn flex min-h-[44px] items-center justify-center gap-2 rounded-lg border-[1.5px] border-[#45413C] bg-[#EFEAE0] px-5 text-xs font-bold uppercase tracking-[0.06em] text-[#292725] hover:bg-[#E4DCCB]"
          >
            <Home className="h-4 w-4" />
            <span>Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
