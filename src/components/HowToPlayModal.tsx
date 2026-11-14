import React from 'react';
import { X } from 'lucide-react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="animate-modal-in modal-scroll-area max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#12161f] p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white sm:text-xl">How to Play</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3.5 text-sm text-slate-300 sm:space-y-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3.5 sm:p-4">
            <div className="font-semibold text-white">1. Grab Any Point on Your Blue Pen</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Click, touch, or use a stylus anywhere along your pen — tip, center, or tail — then pull back to aim. Your pen stays planted while aiming and launches with true rigid-body spin from that exact point on release.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3.5 sm:p-4">
            <div className="font-semibold text-white">2. Master Point-Based Spin & Torque</div>
            <div className="mt-2 grid grid-cols-1 gap-2 text-center text-xs sm:grid-cols-3">
              <div className="rounded-lg bg-slate-800/90 p-2.5">
                <div className="font-bold text-sky-400">Grab Tip</div>
                <div className="mt-1 text-[11px] text-slate-400">Swings tip & creates whip spin</div>
              </div>
              <div className="rounded-lg bg-slate-800/90 p-2.5">
                <div className="font-bold text-emerald-400">Grab Center</div>
                <div className="mt-1 text-[11px] text-slate-400">Straight power drive with minimal spin</div>
              </div>
              <div className="rounded-lg bg-slate-800/90 p-2.5">
                <div className="font-bold text-amber-400">Grab Tail</div>
                <div className="mt-1 text-[11px] text-slate-400">Pivots front tip toward your target</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3.5 sm:p-4">
            <div className="font-semibold text-white">3. Pull Back & Release</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Pull further for higher launch power. The dotted arc predicts your path and highlights potential hits. Knock the red AI pen off the desk before it knocks you off!
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white transition-colors hover:bg-blue-500"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
