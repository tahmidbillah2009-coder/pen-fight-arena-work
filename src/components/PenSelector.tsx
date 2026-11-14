import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Sparkles,
  X,
} from 'lucide-react';
import {
  derivePenStats,
  PEN_ORDER,
  PEN_SPECS,
  penComZ,
  PenTypeId,
  penYawInertia,
  RARITY_COLORS,
} from '../utils/Constants';
import type { AchievementProgress } from '../game/Progression';
import { PASSIVE_ICONS } from './GameHUD';
import { PenPreviewViewer } from './PenPreviewViewer';

interface PenSelectorProps {
  isOpen: boolean;
  equippedPen: PenTypeId;
  unlockedPens: PenTypeId[];
  achievements: AchievementProgress[];
  onEquip: (pen: PenTypeId) => void;
  onClose: () => void;
}

/** The four headline stats every pen is judged on. */
const HEADLINE_STATS: Array<{ key: keyof ReturnType<typeof derivePenStats>; label: string }> = [
  { key: 'speed', label: 'Speed' },
  { key: 'impact', label: 'Impact' },
  { key: 'stability', label: 'Stability' },
  { key: 'control', label: 'Control' },
];

/** Secondary physics-derived readouts for players who want the full picture. */
const DETAIL_STATS: Array<{ key: keyof ReturnType<typeof derivePenStats>; label: string }> = [
  { key: 'mass', label: 'Mass' },
  { key: 'mobility', label: 'Mobility' },
  { key: 'capRetention', label: 'Cap Retention' },
  { key: 'spin', label: 'Spin Potential' },
];


export const PenSelector: React.FC<PenSelectorProps> = ({
  isOpen,
  equippedPen,
  unlockedPens,
  achievements,
  onEquip,
  onClose,
}) => {
  const initialIndex = Math.max(0, PEN_ORDER.indexOf(equippedPen));
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) setIndex(Math.max(0, PEN_ORDER.indexOf(equippedPen)));
  }, [isOpen, equippedPen]);

  const penType = PEN_ORDER[index];
  const spec = PEN_SPECS[penType];
  const stats = useMemo(() => derivePenStats(spec), [spec]);
  const unlocked = unlockedPens.includes(penType);
  const equipped = equippedPen === penType;
  const rarity = RARITY_COLORS[spec.rarity];
  const PassiveIcon = PASSIVE_ICONS[spec.passive.id];
  const passive = spec.passive;

  const step = useCallback((delta: number) => {
    setIndex((prev) => (prev + delta + PEN_ORDER.length) % PEN_ORDER.length);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, step, onClose]);

  if (!isOpen) return null;

  const unlock = spec.unlock;
  const unlockAchievement =
    unlock.type === 'ACHIEVEMENT'
      ? achievements.find((a) => a.id === unlock.achievementId)
      : undefined;

  const physicsFacts: Array<[string, string]> = [
    ['Mass', `${spec.mass.toFixed(2)} kg`],
    ['Length', `${spec.length.toFixed(2)} u`],
    ['Barrel Radius', spec.radius.toFixed(3)],
    ['Center of Mass', `${penComZ(spec).toFixed(3)} u`],
    ['Yaw Inertia', penYawInertia(spec).toFixed(3)],
    ['Lin. Damping', spec.linearDamping.toFixed(2)],
    ['Ang. Damping', spec.angularDamping.toFixed(2)],
    ['Friction', spec.friction.toFixed(2)],
    ['Restitution', spec.restitution.toFixed(2)],
    ['Cap Retention', `${Math.round(spec.cap.retention * 100)}%`],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/78 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="animate-modal-in flex h-full w-full max-w-6xl flex-col overflow-hidden border-white/12 bg-[#0d1117]/97 sm:h-[min(90dvh,780px)] sm:rounded-3xl sm:border sm:shadow-2xl">
        {/* Header */}
        <div className="safe-pad-top flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="font-display truncate text-lg font-extrabold tracking-tight text-white sm:text-xl">
              Pen Collection
            </h2>
            <p className="truncate text-[11px] text-slate-400 sm:text-xs">
              {unlockedPens.length}/{PEN_ORDER.length} unlocked · every pen changes real physics
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pen collection"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,46dvh)_minmax(0,1fr)] md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:grid-rows-1">
          {/* 3D preview stage */}
          <div className="relative min-h-0 overflow-hidden border-b border-white/10 bg-gradient-to-b from-[#151c2b] to-[#0b0f16] md:border-b-0 md:border-r">
            <div className="absolute inset-0">
              <PenPreviewViewer penType={penType} locked={!unlocked} />
            </div>

            {/* Rarity chip */}
            <div
              className={`pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${rarity.ring} ${rarity.bg} ${rarity.text}`}
            >
              <Sparkles className="h-3 w-3" />
              {spec.rarity}
            </div>

            {!unlocked && (
              <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center">
                <div className="flex items-center gap-2 rounded-full border border-amber-400/45 bg-slate-950/85 px-3 py-1.5 text-[11px] font-semibold text-amber-200">
                  <Lock className="h-3.5 w-3.5" />
                  Locked — preview only
                </div>
              </div>
            )}

            {/* Navigation */}
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous pen"
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-slate-950/65 text-white transition-colors hover:bg-slate-800 sm:left-3"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next pen"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-slate-950/65 text-white transition-colors hover:bg-slate-800 sm:right-3"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] text-slate-500">
              Drag to rotate 360° · Wheel / pinch to zoom
            </div>

            {/* Pen name plate */}
            <div className="pointer-events-none absolute inset-x-0 top-11 flex flex-col items-center">
              <div className="font-display text-xl font-extrabold tracking-tight text-white drop-shadow sm:text-2xl">
                {spec.label}
              </div>
              <div className="text-[11px] font-medium text-slate-300">{spec.className}</div>
            </div>
          </div>

          {/* Details */}
          <div className="modal-scroll-area min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
            <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">{spec.description}</p>

            {/* Headline stats (Speed / Impact / Stability / Control) — derived from real physics */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {HEADLINE_STATS.map((row) => {
                const value = stats[row.key];
                return (
                  <div key={row.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-300">{row.label}</span>
                      <span className="font-mono-num text-[11px] font-bold text-white">
                        {Math.round(value * 100)}
                      </span>
                    </div>
                    <span className="relative h-2 overflow-hidden rounded-full bg-slate-800">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
                        style={{
                          width: `${Math.round(Math.max(0.04, value) * 100)}%`,
                          background: `linear-gradient(90deg, ${rarity.glow}88, ${rarity.glow})`,
                        }}
                      />
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Secondary physical readouts */}
            <div className="mt-3 space-y-1.5">
              {DETAIL_STATS.map((row) => {
                const value = stats[row.key];
                return (
                  <div key={row.key} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[11px] font-medium text-slate-400">
                      {row.label}
                    </span>
                    <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
                        style={{
                          width: `${Math.round(Math.max(0.04, value) * 100)}%`,
                          background: `linear-gradient(90deg, ${rarity.glow}88, ${rarity.glow})`,
                        }}
                      />
                    </span>
                    <span className="font-mono-num w-9 shrink-0 text-right text-[11px] text-slate-300">
                      {Math.round(value * 100)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Real physics configuration */}
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Physics Configuration
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                {physicsFacts.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-[10px] text-slate-500">{label}</span>
                    <span className="font-mono-num shrink-0 text-[11px] font-semibold text-slate-200">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* PASSIVE ABILITY — always active while this pen is equipped */}
            <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-950/20 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-500/12">
                  <PassiveIcon className="h-4 w-4 text-emerald-300" />
                </span>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-emerald-400/80">
                    Passive · always active
                  </div>
                  <div className="truncate text-sm font-bold text-white">{passive.name}</div>
                </div>
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-emerald-200/90">{passive.summary}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{passive.detail}</p>
            </div>

            {/* Unlock state */}
            {!unlocked && unlockAchievement && (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-950/25 p-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-200">
                  <Lock className="h-3.5 w-3.5" />
                  <span>How to unlock</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-100/85">
                  {unlockAchievement.label} — {unlockAchievement.description} (
                  {Math.round(unlockAchievement.progress * unlockAchievement.target)}/
                  {unlockAchievement.target})
                </p>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-amber-950">
                  <span
                    className="block h-full bg-amber-400"
                    style={{ width: `${Math.round(unlockAchievement.progress * 100)}%` }}
                  />
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="sticky bottom-0 mt-4 flex gap-2 bg-[#0d1117]/95 pt-2">
              <button
                type="button"
                disabled={!unlocked || equipped}
                onClick={() => onEquip(penType)}
                className={`flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors ${
                  equipped
                    ? 'cursor-default border border-emerald-400/45 bg-emerald-600/15 text-emerald-300'
                    : unlocked
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'cursor-not-allowed border border-white/10 bg-slate-800/70 text-slate-500'
                }`}
              >
                {equipped ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Equipped</span>
                  </>
                ) : unlocked ? (
                  <span>Select &amp; Equip</span>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Locked</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
