import React from 'react';
import { PenTool, Zap } from 'lucide-react';
import { getPenSkinSpec, MultiplayerPlayerState } from '../game/MultiplayerTypes';
import { PEN_SPECS, RARITY_COLORS } from '../utils/Constants';

interface TurnTransitionBannerProps {
  player: MultiplayerPlayerState | null;
  onDismiss?: () => void;
}

export const TurnTransitionBanner: React.FC<TurnTransitionBannerProps> = ({
  player,
  onDismiss,
}) => {
  if (!player) return null;

  const isBlue = player.team === 'blue';
  const spec = PEN_SPECS[player.penType];
  const rarity = RARITY_COLORS[spec.rarity];
  const skinSpec = getPenSkinSpec(player.skinId);

  return (
    <div
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      aria-label={`${player.name}'s turn, tap or press Space to aim`}
      className="pointer-events-auto fixed inset-0 z-35 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm transition-opacity cursor-pointer select-none"
    >
      <div
        className={`relative flex w-full max-w-md flex-col items-center rounded-2xl border p-6 text-center shadow-2xl transition-all animate-modal-in ${
          isBlue
            ? 'border-blue-400/80 bg-gradient-to-b from-blue-950/95 via-[#0e1628]/95 to-slate-950/95 shadow-blue-500/20'
            : 'border-rose-400/80 bg-gradient-to-b from-rose-950/95 via-[#230e16]/95 to-slate-950/95 shadow-rose-500/20'
        }`}
      >
        {/* Team Pill */}
        <div
          className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-widest ${
            isBlue
              ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
              : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isBlue ? 'bg-blue-400' : 'bg-rose-400'}`} />
          <span>{isBlue ? 'TEAM BLUE' : 'TEAM RED'}</span>
        </div>

        {/* Player Display Name */}
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">
          {player.name}
        </h2>
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-4 animate-pulse">
          YOUR TURN — AIM YOUR PEN!
        </div>

        {/* Pen & Abilities Card */}
        <div className="w-full rounded-xl border border-white/10 bg-black/40 p-3.5 text-left space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-white truncate">
              {spec.label}
              {skinSpec.id !== 'team_default' ? ` · ${skinSpec.label}` : ''}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 ${rarity.bg} ${rarity.text}`}
            >
              {spec.rarity}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 truncate">
              <PenTool className="h-3 w-3 shrink-0 text-sky-400" />
              <span className="truncate">{spec.passive.name}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Zap className="h-3 w-3 shrink-0 text-amber-400" />
              <span className="truncate">{spec.specialShot.name}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 text-[10px] text-slate-400">
          Tap anywhere or press Space to aim immediately
        </div>
      </div>
    </div>
  );
};
