import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Lock, Sparkles, X } from 'lucide-react';
import type { AchievementProgress } from '../game/Progression';
import {
  derivePenStats,
  PEN_ORDER,
  PEN_SPECS,
  penComZ,
  PenTypeId,
  penYawInertia,
} from '../utils/Constants';
import { PASSIVE_ICONS } from './GameHUD';
import { getPaperRarityTheme, PaperDivider } from './PaperUI';
import { PenPreviewViewer } from './PenPreviewViewer';

interface PenSelectorProps {
  isOpen: boolean;
  equippedPen: PenTypeId;
  unlockedPens: PenTypeId[];
  achievements: AchievementProgress[];
  onEquip: (pen: PenTypeId) => void;
  onClose: () => void;
}

const HEADLINE_STATS: Array<{ key: keyof ReturnType<typeof derivePenStats>; label: string }> = [
  { key: 'speed', label: 'Speed' },
  { key: 'impact', label: 'Impact' },
  { key: 'stability', label: 'Stability' },
  { key: 'control', label: 'Control' },
];

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
  const rarity = getPaperRarityTheme(spec.rarity);
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
    ['Radius', spec.radius.toFixed(3)],
    ['COM Z', `${penComZ(spec).toFixed(3)} u`],
    ['Inertia', penYawInertia(spec).toFixed(3)],
    ['Lin. Damp', spec.linearDamping.toFixed(2)],
    ['Ang. Damp', spec.angularDamping.toFixed(2)],
    ['Friction', spec.friction.toFixed(2)],
    ['Bounce', spec.restitution.toFixed(2)],
    ['Cap Grip', `${Math.round(spec.cap.retention * 100)}%`],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#292725]/45 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-modal-in paper-shadow-lg flex h-full w-full max-w-6xl flex-col overflow-hidden border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725] sm:h-[min(90dvh,780px)] sm:rounded-xl">
        {/* Header */}
        <div className="safe-pad-top flex shrink-0 items-center justify-between gap-3 border-b border-[#D9C5A8] bg-[#F7F3EA] px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="font-display truncate text-lg font-extrabold uppercase tracking-[0.04em] text-[#292725] sm:text-xl">
              Pen Collection
            </h2>
            <p className="truncate text-[11px] font-medium text-[#6E6A64] sm:text-xs">
              {unlockedPens.length}/{PEN_ORDER.length} unlocked · every pen alters real rigid-body physics
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pen collection"
            className="paper-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725] hover:bg-[#EFEAE0]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,44dvh)_minmax(0,1fr)] md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:grid-rows-1">
          {/* 3D Specimen Stage on Warm Dotted Drafting Paper */}
          <div className="paper-dots-inset relative min-h-0 overflow-hidden border-b border-[#D9C5A8] md:border-b-0 md:border-r">
            <div className="absolute inset-0">
              <PenPreviewViewer penType={penType} locked={!unlocked} />
            </div>

            {/* Rarity stamp */}
            <div
              className={`pointer-events-none paper-shadow-sm absolute left-3 top-3 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${rarity.badgeBg} ${rarity.badgeText} ${rarity.badgeBorder}`}
            >
              <Sparkles className="h-3 w-3" />
              {spec.rarity}
            </div>

            {/* Specimen Index Stamp */}
            <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-[#45413C]/60 bg-[#FFFDF8] px-2 py-0.5 font-mono-num text-[10px] font-bold text-[#6E6A64]">
              {index + 1} / {PEN_ORDER.length}
            </div>

            {!unlocked && (
              <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center">
                <div className="paper-shadow-sm flex items-center gap-1.5 rounded-lg border-[1.5px] border-[#9C6C2B] bg-[#FBF3E2] px-3 py-1 text-[11px] font-bold text-[#85581A]">
                  <Lock className="h-3.5 w-3.5" />
                  Locked — Preview Only
                </div>
              </div>
            )}

            {/* Navigation Arrows */}
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous pen"
              className="paper-btn absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725] hover:bg-[#EFEAE0] sm:left-3"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next pen"
              className="paper-btn absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725] hover:bg-[#EFEAE0] sm:right-3"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] font-medium text-[#6E6A64]">
              Drag to rotate 360° · Wheel / pinch to zoom
            </div>

            {/* Pen Title Plate */}
            <div className="pointer-events-none absolute inset-x-0 top-11 flex flex-col items-center">
              <div className="font-display text-xl font-extrabold uppercase tracking-[0.03em] text-[#292725] sm:text-2xl">
                {spec.label}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E6A64]">
                {spec.className}
              </div>
            </div>
          </div>

          {/* Details Column */}
          <div className="modal-scroll-area min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            <p className="text-xs leading-relaxed text-[#57534E] sm:text-sm">{spec.description}</p>

            {/* Headline Physics Bars */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {HEADLINE_STATS.map((row) => {
                const value = stats[row.key];
                return (
                  <div key={row.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#57534E]">
                        {row.label}
                      </span>
                      <span className="font-mono-num text-[11px] font-bold text-[#292725]">
                        {Math.round(value * 100)}
                      </span>
                    </div>
                    <span className="relative h-2 overflow-hidden rounded-full border border-[#45413C]/60 bg-[#EFEAE0]">
                      <span
                        className="absolute inset-y-0 left-0 transition-[width] duration-300"
                        style={{
                          width: `${Math.round(Math.max(0.04, value) * 100)}%`,
                          backgroundColor: rarity.barFill,
                        }}
                      />
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Secondary Readouts */}
            <div className="mt-3.5 space-y-1.5">
              {DETAIL_STATS.map((row) => {
                const value = stats[row.key];
                return (
                  <div key={row.key} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[11px] font-semibold text-[#6E6A64]">
                      {row.label}
                    </span>
                    <span className="relative h-1.5 flex-1 overflow-hidden rounded-full border border-[#45413C]/40 bg-[#EFEAE0]">
                      <span
                        className="absolute inset-y-0 left-0 transition-[width] duration-300"
                        style={{
                          width: `${Math.round(Math.max(0.04, value) * 100)}%`,
                          backgroundColor: '#7893AD',
                        }}
                      />
                    </span>
                    <span className="font-mono-num w-8 shrink-0 text-right text-[11px] font-bold text-[#292725]">
                      {Math.round(value * 100)}
                    </span>
                  </div>
                );
              })}
            </div>

            <PaperDivider className="my-4" />

            {/* Physics Configuration Grid */}
            <div className="rounded-xl border-[1.5px] border-[#45413C] bg-[#F7F3EA] p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6E6A64]">
                Physics Configuration
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                {physicsFacts.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-[10px] font-medium text-[#6E6A64]">{label}</span>
                    <span className="font-mono-num shrink-0 text-[11px] font-bold text-[#292725]">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Passive Skill */}
            <div className="mt-3 rounded-xl border-[1.5px] border-[#2E664B] bg-[#E6F2EC]/75 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#2E664B] bg-[#FFFDF8]">
                  <PassiveIcon className="h-4 w-4 text-[#2E664B]" />
                </span>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#2E664B]">
                    Passive · Always Active
                  </div>
                  <div className="truncate text-sm font-bold text-[#292725]">{passive.name}</div>
                </div>
              </div>
              <p className="mt-1.5 text-[11px] font-semibold text-[#292725]">{passive.summary}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#57534E]">{passive.detail}</p>
            </div>

            {/* Unlock Condition */}
            {!unlocked && unlockAchievement && (
              <div className="mt-3 rounded-xl border-[1.5px] border-[#9C6C2B] bg-[#FBF3E2] p-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#85581A]">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Unlock Requirement</span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-[#292725]">
                  {unlockAchievement.label} — {unlockAchievement.description} (
                  {Math.round(unlockAchievement.progress * unlockAchievement.target)}/
                  {unlockAchievement.target})
                </p>
                <span className="mt-2 block h-2 overflow-hidden rounded-full border border-[#9C6C2B]/60 bg-[#FFFDF8]">
                  <span
                    className="block h-full bg-[#A3702B]"
                    style={{ width: `${Math.round(unlockAchievement.progress * 100)}%` }}
                  />
                </span>
              </div>
            )}

            {/* Sticky Equip Bar */}
            <div className="sticky bottom-0 mt-4 flex gap-2 border-t border-[#D9C5A8] bg-[#FFFDF8] pb-1 pt-3">
              <button
                type="button"
                disabled={!unlocked || equipped}
                onClick={() => onEquip(penType)}
                className={`paper-btn flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border-[1.5px] px-4 text-xs font-bold uppercase tracking-[0.06em] ${
                  equipped
                    ? 'cursor-default border-[#2E664B] bg-[#E6F2EC] text-[#2E664B]'
                    : unlocked
                      ? 'border-[#45413C] bg-[#4F6D8A] text-[#FFFDF8] hover:bg-[#435E79]'
                      : 'cursor-not-allowed border-[#8D8579] bg-[#EFEAE0] text-[#6E6A64]'
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
