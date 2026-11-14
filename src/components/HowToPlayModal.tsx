import React from 'react';
import { BookOpen } from 'lucide-react';
import { PaperModalShell } from './PaperUI';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <PaperModalShell
      title="How to Play"
      subtitle="Grab, spin & knock opposing pens off the desk"
      icon={<BookOpen className="h-4 w-4" />}
      onClose={onClose}
      maxWidthClass="max-w-lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="paper-btn flex min-h-[42px] w-full items-center justify-center rounded-lg border-[1.5px] border-[#45413C] bg-[#4F6D8A] text-xs font-bold uppercase tracking-[0.06em] text-[#FFFDF8] hover:bg-[#435E79]"
        >
          Got It
        </button>
      }
    >
      <div className="space-y-3.5 p-4 sm:p-6">
        <div className="rounded-xl border-[1.5px] border-[#45413C] bg-[#F7F3EA] p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#365B82]">
            1. Grab Any Point on Your Pen
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#57534E]">
            Click, touch, or drag anywhere along your pen — tip, center, or tail — then pull back to aim. Your pen launches with true rigid-body spin from that exact anchor point on release.
          </p>
        </div>

        <div className="rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8] p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#292725]">
            2. Master Point-Based Spin &amp; Torque
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-2 text-center text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-[#365B82]/50 bg-[#E8EFF6] p-2.5">
              <div className="font-bold text-[#365B82]">Grab Tip</div>
              <div className="mt-1 text-[11px] text-[#57534E]">
                Swings tip &amp; builds whip spin
              </div>
            </div>
            <div className="rounded-lg border border-[#2E664B]/50 bg-[#E6F2EC] p-2.5">
              <div className="font-bold text-[#2E664B]">Grab Center</div>
              <div className="mt-1 text-[11px] text-[#57534E]">
                Straight power drive, low spin
              </div>
            </div>
            <div className="rounded-lg border border-[#9C6C2B]/50 bg-[#FBF3E2] p-2.5">
              <div className="font-bold text-[#85581A]">Grab Tail</div>
              <div className="mt-1 text-[11px] text-[#57534E]">
                Pivots front tip toward target
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border-[1.5px] border-[#45413C] bg-[#F7F3EA] p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#9E3B36]">
            3. Pull Back &amp; Release
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#57534E]">
            Pull further for higher launch power. The dotted prediction arc shows your live physics path and potential collisions. Knock opposing pens off the desk to win!
          </p>
        </div>
      </div>
    </PaperModalShell>
  );
};
