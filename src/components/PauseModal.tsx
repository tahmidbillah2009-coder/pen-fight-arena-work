import React from 'react';
import { BookOpen, Home, Play, RotateCcw, Settings as SettingsIcon } from 'lucide-react';
import { PaperDivider } from './PaperUI';

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onOpenHowToPlay: () => void;
  onExitToMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  isOpen,
  onResume,
  onRestart,
  onOpenSettings,
  onOpenHowToPlay,
  onExitToMenu,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 z-40 flex items-center justify-center bg-[#292725]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Match Paused"
    >
      <div className="animate-modal-in paper-shadow-lg w-full max-w-sm overflow-hidden rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725]">
        <div className="paper-dots-inset border-b border-[#D9C5A8] px-5 py-4 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6E6A64]">
            Match Suspended
          </div>
          <h2 className="font-display mt-0.5 text-xl font-extrabold uppercase tracking-[0.04em] text-[#292725]">
            Game Paused
          </h2>
        </div>

        <div className="space-y-2.5 p-5">
          <button
            type="button"
            onClick={onResume}
            className="paper-btn flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-[#45413C] bg-[#4F6D8A] px-4 text-xs font-bold uppercase tracking-[0.06em] text-[#FFFDF8] hover:bg-[#435E79] focus-visible:outline-2 focus-visible:outline-[#292725]"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Resume Match</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="paper-btn flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-[#45413C] bg-[#EFEAE0] px-4 text-xs font-bold text-[#292725] hover:bg-[#E4DCCB] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
          >
            <RotateCcw className="h-4 w-4 text-[#85581A]" />
            <span>Restart Match</span>
          </button>

          <PaperDivider className="my-1" />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenSettings}
              className="paper-btn flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 text-xs font-bold text-[#292725] hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
            >
              <SettingsIcon className="h-4 w-4 text-[#6E6A64]" />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={onOpenHowToPlay}
              className="paper-btn flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 text-xs font-bold text-[#292725] hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A]"
            >
              <BookOpen className="h-4 w-4 text-[#2E664B]" />
              <span>How to Play</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onExitToMenu}
            className="paper-btn flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-[#9E3B36] bg-[#F9EAE9] px-4 text-xs font-bold text-[#9E3B36] hover:bg-[#F3DCDA] focus-visible:outline-2 focus-visible:outline-[#9E3B36]"
          >
            <Home className="h-4 w-4" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
