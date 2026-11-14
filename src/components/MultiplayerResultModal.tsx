import React from 'react';
import { Award, Home, RotateCcw, Skull, Swords, Trophy, Users } from 'lucide-react';
import { GameSnapshot } from '../game/GameState';
import { PEN_SPECS } from '../utils/Constants';

interface MultiplayerResultModalProps {
  snapshot: GameSnapshot;
  onRematch: () => void;
  onExitToMenu: () => void;
}

export const MultiplayerResultModal: React.FC<MultiplayerResultModalProps> = ({
  snapshot,
  onRematch,
  onExitToMenu,
}) => {
  const mp = snapshot.multiplayer;
  if (snapshot.matchState !== 'MATCH_OVER' || !mp) return null;

  const winningTeam = mp.winningTeam;
  const isBlueVictory = winningTeam === 'blue';
  const winnerTitle = isBlueVictory ? 'TEAM BLUE VICTORY!' : 'TEAM RED VICTORY!';

  return (
    <div className="safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md">
      <div className="animate-modal-in modal-scroll-area flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col rounded-2xl border border-white/15 bg-[#10141e] shadow-2xl overflow-hidden text-center">
        {/* Victory Lockup */}
        <div
          className={`px-6 py-6 border-b border-white/10 ${
            isBlueVictory
              ? 'bg-gradient-to-b from-blue-950/80 to-slate-900/60'
              : 'bg-gradient-to-b from-rose-950/80 to-slate-900/60'
          }`}
        >
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-black/40 border border-white/15 shadow-xl">
            <Trophy
              className={`h-9 w-9 ${isBlueVictory ? 'text-blue-400' : 'text-rose-400'}`}
            />
          </div>

          <h2
            className={`font-display text-2xl sm:text-3xl font-extrabold tracking-tight ${
              isBlueVictory ? 'text-blue-300' : 'text-rose-300'
            }`}
          >
            {winnerTitle}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-300">
            {snapshot.loserReason || 'All opponent pens were knocked off the desk!'}
          </p>

          {/* Quick Team Status Chips */}
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="rounded-lg bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300 border border-blue-500/30">
              Blue Survivors: {mp.blueScore}
            </span>
            <span className="text-slate-500 text-xs">vs</span>
            <span className="rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-300 border border-rose-500/30">
              Red Survivors: {mp.redScore}
            </span>
          </div>
        </div>

        {/* Individual Player Scoreboard */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>Player Performance Breakdown</span>
            <span>{mp.mode}</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                <tr>
                  <th className="py-2.5 px-3">Player</th>
                  <th className="py-2.5 px-2">Pen Model</th>
                  <th className="py-2.5 px-2 text-center">Shots</th>
                  <th className="py-2.5 px-2 text-center">KOs</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {mp.players.map((p) => {
                  const isBlue = p.team === 'blue';
                  const spec = PEN_SPECS[p.penType];
                  return (
                    <tr
                      key={p.id}
                      className={
                        p.isEliminated ? 'opacity-50 bg-black/20' : 'hover:bg-white/5'
                      }
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              isBlue ? 'bg-blue-400' : 'bg-rose-400'
                            }`}
                          />
                          <span className="font-bold text-white truncate max-w-[120px]">
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-slate-300 truncate max-w-[100px]">
                        {spec.label}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono-num text-slate-300">
                        {p.shotsCount}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono-num font-bold text-amber-300">
                        {p.knockoutsCount}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {p.isEliminated ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                            <Skull className="h-2.5 w-2.5" />
                            <span>Out</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            <span>Survived</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions (Rematch & Menu) */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/10 bg-slate-900/90 px-5 py-3.5">
          <button
            type="button"
            onClick={onExitToMenu}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            <Home className="h-4 w-4" />
            <span>Main Menu</span>
          </button>

          <button
            type="button"
            onClick={onRematch}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Rematch</span>
          </button>
        </div>
      </div>
    </div>
  );
};
