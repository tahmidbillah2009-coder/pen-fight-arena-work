import React from 'react';
import { Home, RotateCcw, Skull, Sliders, Trophy } from 'lucide-react';
import { GameSnapshot } from '../game/GameState';
import { PEN_SPECS } from '../utils/Constants';

interface MultiplayerResultModalProps {
  snapshot: GameSnapshot;
  onRematch: () => void;
  onChangeSetup?: () => void;
  onExitToMenu: () => void;
}

export const MultiplayerResultModal: React.FC<MultiplayerResultModalProps> = ({
  snapshot,
  onRematch,
  onChangeSetup,
  onExitToMenu,
}) => {
  const mp = snapshot.multiplayer;
  if (snapshot.matchState !== 'MATCH_OVER' || !mp) return null;

  const winningTeam = mp.winningTeam;
  const isBlueVictory = winningTeam === 'blue';
  const winnerTitle = isBlueVictory ? 'Team Blue Victory' : 'Team Red Victory';

  return (
    <div
      className="safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 z-40 flex items-center justify-center bg-[#292725]/45 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-modal-in paper-shadow-lg flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-center text-[#292725]">
        {/* Header Stamp */}
        <div
          className={`border-b border-[#D9C5A8] px-6 py-5 ${
            isBlueVictory ? 'bg-[#E8EFF6]' : 'bg-[#F9EAE9]'
          }`}
        >
          <div className="paper-shadow-sm mx-auto mb-2.5 flex h-13 w-13 items-center justify-center rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8]">
            <Trophy className={`h-7 w-7 ${isBlueVictory ? 'text-[#365B82]' : 'text-[#9E3B36]'}`} />
          </div>

          <h2
            className={`font-display text-2xl font-extrabold uppercase tracking-[0.04em] sm:text-3xl ${
              isBlueVictory ? 'text-[#365B82]' : 'text-[#9E3B36]'
            }`}
          >
            {winnerTitle}
          </h2>
          <p className="mt-1 text-xs font-medium text-[#57534E] sm:text-sm">
            {snapshot.loserReason || 'All opponent pens were knocked off the desk.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span className="rounded-lg border border-[#365B82] bg-[#FFFDF8] px-3 py-1 font-mono-num text-xs font-bold text-[#365B82]">
              Blue: {mp.blueScore} Left · {mp.blueKnockouts} KO
            </span>
            <span className="text-xs font-bold uppercase text-[#6E6A64]">vs</span>
            <span className="rounded-lg border border-[#9E3B36] bg-[#FFFDF8] px-3 py-1 font-mono-num text-xs font-bold text-[#9E3B36]">
              Red: {mp.redScore} Left · {mp.redKnockouts} KO
            </span>
          </div>
        </div>

        {/* Scoreboard Table */}
        <div className="modal-scroll-area space-y-3 overflow-y-auto p-4 sm:p-5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-[#6E6A64]">
            <span>Player Match Breakdown</span>
            <span className="font-mono-num">
              {mp.mode} · {mp.roundNumber} {mp.roundNumber === 1 ? 'Round' : 'Rounds'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#D9C5A8] bg-[#F7F3EA] text-[10px] font-bold uppercase tracking-wider text-[#6E6A64]">
                <tr>
                  <th className="px-3 py-2.5">Player</th>
                  <th className="px-2 py-2.5">Pen</th>
                  <th className="px-2 py-2.5 text-center">Shots</th>
                  <th className="px-2 py-2.5 text-center">KOs</th>
                  <th className="px-2 py-2.5 text-center">Skips</th>
                  <th className="px-3 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0] font-medium">
                {mp.players.map((p) => {
                  const isBlue = p.team === 'blue';
                  const spec = PEN_SPECS[p.penType];
                  return (
                    <tr
                      key={p.id}
                      className={p.isEliminated ? 'bg-[#F7F3EA] opacity-70' : 'hover:bg-[#F7F3EA]/60'}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                              isBlue ? 'bg-[#4F6D8A]' : 'bg-[#B55450]'
                            }`}
                          />
                          <span className="max-w-[110px] truncate font-bold text-[#292725]">
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-[96px] truncate px-2 py-2.5 text-[#57534E]">
                        {spec.label}
                      </td>
                      <td className="font-mono-num px-2 py-2.5 text-center text-[#292725]">
                        {p.shotsCount}
                      </td>
                      <td className="font-mono-num px-2 py-2.5 text-center font-bold text-[#85581A]">
                        {p.knockoutsCount}
                      </td>
                      <td className="font-mono-num px-2 py-2.5 text-center text-[#6E6A64]">
                        {p.skipsCount}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {p.isEliminated ? (
                          <span className="inline-flex items-center gap-1 rounded border border-[#9E3B36]/50 bg-[#F9EAE9] px-1.5 py-0.5 text-[10px] font-bold text-[#9E3B36]">
                            <Skull className="h-2.5 w-2.5" />
                            <span>Out</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border border-[#2E664B]/50 bg-[#E6F2EC] px-1.5 py-0.5 text-[10px] font-bold text-[#2E664B]">
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

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#D9C5A8] bg-[#F7F3EA] px-4 py-3.5 sm:px-5">
          <button
            type="button"
            onClick={onExitToMenu}
            className="paper-btn flex min-h-[42px] items-center gap-1.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3.5 text-xs font-bold text-[#292725] hover:bg-[#EFEAE0]"
          >
            <Home className="h-4 w-4" />
            <span>Main Menu</span>
          </button>

          <div className="flex items-center gap-2">
            {onChangeSetup && (
              <button
                type="button"
                onClick={onChangeSetup}
                className="paper-btn flex min-h-[42px] items-center gap-1.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#EFEAE0] px-3.5 text-xs font-bold text-[#292725] hover:bg-[#E4DCCB]"
              >
                <Sliders className="h-3.5 w-3.5 text-[#4F6D8A]" />
                <span>Setup Players</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRematch}
              className="paper-btn flex min-h-[42px] items-center gap-2 rounded-lg border-[1.5px] border-[#45413C] bg-[#4F6D8A] px-5 text-xs font-bold uppercase tracking-[0.06em] text-[#FFFDF8] hover:bg-[#435E79]"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Rematch</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
