import React from 'react';
import { Award, CheckCircle2, Swords, Trophy } from 'lucide-react';
import { AchievementProgress, PlayerProfile } from '../game/Progression';
import { PEN_ORDER, PEN_SPECS } from '../utils/Constants';
import { MultiplayerStorage } from '../utils/MultiplayerStorage';
import { PaperDivider, PaperModalShell, PaperSectionLabel } from './PaperUI';

interface StatsModalProps {
  isOpen: boolean;
  profile: PlayerProfile;
  achievements: AchievementProgress[];
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  profile,
  achievements,
  onClose,
}) => {
  if (!isOpen) return null;

  const mp = MultiplayerStorage.load();
  const soloTotal = profile.wins + profile.losses;
  const winRate = soloTotal > 0 ? Math.round((profile.wins / soloTotal) * 100) : 0;

  return (
    <PaperModalShell
      title="Player Statistics"
      subtitle="Solo records, local multiplayer tallies & pen unlocks"
      icon={<Award className="h-4 w-4" />}
      onClose={onClose}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="paper-btn min-h-[40px] rounded-lg border-[1.5px] border-[#45413C] bg-[#4F6D8A] px-5 text-xs font-bold uppercase tracking-[0.06em] text-[#FFFDF8] hover:bg-[#435E79]"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-5 p-4 sm:p-6">
        {/* Solo Record Cards */}
        <div>
          <PaperSectionLabel className="mb-2" right="vs AI Career">
            Solo Arena Summary
          </PaperSectionLabel>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="paper-shadow-sm rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A64]">
                Matches
              </div>
              <div className="font-mono-num mt-1 text-xl font-bold text-[#292725]">
                {profile.matchesPlayed}
              </div>
            </div>
            <div className="paper-shadow-sm rounded-lg border-[1.5px] border-[#45413C] bg-[#E8EFF6] p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#365B82]">
                Wins
              </div>
              <div className="font-mono-num mt-1 text-xl font-bold text-[#365B82]">
                {profile.wins}
              </div>
            </div>
            <div className="paper-shadow-sm rounded-lg border-[1.5px] border-[#45413C] bg-[#F9EAE9] p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#9E3B36]">
                Losses
              </div>
              <div className="font-mono-num mt-1 text-xl font-bold text-[#9E3B36]">
                {profile.losses}
              </div>
            </div>
            <div className="paper-shadow-sm rounded-lg border-[1.5px] border-[#45413C] bg-[#FBF3E2] p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#85581A]">
                Win Rate
              </div>
              <div className="font-mono-num mt-1 text-xl font-bold text-[#85581A]">
                {winRate}%
              </div>
            </div>
          </div>
        </div>

        {/* Local Multiplayer Ledger */}
        <div className="rounded-xl border-[1.5px] border-[#45413C] bg-[#F7F3EA] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-[#4F6D8A]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#292725]">
                Local Multiplayer Ledger
              </span>
            </div>
            <span className="font-mono-num text-xs font-bold text-[#6E6A64]">
              {mp.matchesPlayed} {mp.matchesPlayed === 1 ? 'Match' : 'Matches'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-[#365B82]/40 bg-[#E8EFF6] px-2 py-2">
              <div className="text-[10px] font-bold uppercase text-[#365B82]">Team Blue</div>
              <div className="font-mono-num text-base font-bold text-[#292725]">
                {mp.blueWins}W
              </div>
            </div>
            <div className="rounded-lg border border-[#9E3B36]/40 bg-[#F9EAE9] px-2 py-2">
              <div className="text-[10px] font-bold uppercase text-[#9E3B36]">Team Red</div>
              <div className="font-mono-num text-base font-bold text-[#292725]">
                {mp.redWins}W
              </div>
            </div>
            <div className="rounded-lg border border-[#8D8579]/40 bg-[#FFFDF8] px-2 py-2">
              <div className="text-[10px] font-bold uppercase text-[#6E6A64]">Draws</div>
              <div className="font-mono-num text-base font-bold text-[#292725]">
                {mp.draws}
              </div>
            </div>
          </div>
        </div>

        <PaperDivider />

        {/* Unlock Milestones & Pen Collection Progress */}
        <div>
          <PaperSectionLabel
            className="mb-2.5"
            right={`${profile.unlockedPens.length}/${PEN_ORDER.length} Pens Unlocked`}
          >
            Milestones &amp; Pen Rewards
          </PaperSectionLabel>

          <div className="space-y-2.5">
            {achievements.map((item) => {
              const rewardSpec = PEN_SPECS[item.rewardPen];
              const pct = Math.round(item.progress * 100);
              const valueCount = Math.min(
                item.target,
                item.metric === 'wins' ? profile.wins : profile.matchesPlayed
              );
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border-[1.5px] p-3 ${
                    item.complete
                      ? 'border-[#2E664B] bg-[#E6F2EC]/65'
                      : 'border-[#45413C] bg-[#FFFDF8]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {item.complete ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2E664B]" />
                        ) : (
                          <Trophy className="h-4 w-4 shrink-0 text-[#85581A]" />
                        )}
                        <span className="truncate text-xs font-bold text-[#292725]">
                          {item.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#6E6A64]">
                        {item.description} · Unlocks <strong className="text-[#292725]">{rewardSpec.label}</strong>
                      </p>
                    </div>
                    <span className="font-mono-num shrink-0 rounded border border-[#45413C] bg-[#FFFDF8] px-2 py-0.5 text-[11px] font-bold text-[#292725]">
                      {valueCount}/{item.target}
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full border border-[#45413C]/60 bg-[#EFEAE0]">
                    <div
                      className="h-full transition-[width] duration-300"
                      style={{
                        width: `${Math.max(item.complete ? 100 : 4, pct)}%`,
                        backgroundColor: item.complete ? '#2E664B' : '#7893AD',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PaperModalShell>
  );
};
