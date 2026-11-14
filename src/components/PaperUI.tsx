import React from 'react';
import { X } from 'lucide-react';
import type { PenRarity } from '../utils/Constants';

export interface PaperRarityTheme {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  barFill: string;
  accentHex: string;
}

export function getPaperRarityTheme(rarity: PenRarity): PaperRarityTheme {
  switch (rarity) {
    case 'RARE':
      return {
        label: 'Rare',
        badgeBg: 'bg-[#E6EEF6]',
        badgeText: 'text-[#325170]',
        badgeBorder: 'border-[#5F7E9B]',
        barFill: '#5B7C99',
        accentHex: '#5B7C99',
      };
    case 'EPIC':
      return {
        label: 'Epic',
        badgeBg: 'bg-[#F1E8F4]',
        badgeText: 'text-[#5E3A69]',
        badgeBorder: 'border-[#7D578A]',
        barFill: '#7D578A',
        accentHex: '#7D578A',
      };
    case 'LEGENDARY':
      return {
        label: 'Legendary',
        badgeBg: 'bg-[#FBF1DC]',
        badgeText: 'text-[#754C16]',
        badgeBorder: 'border-[#9C6C2B]',
        barFill: '#A3702B',
        accentHex: '#A3702B',
      };
    case 'COMMON':
    default:
      return {
        label: 'Common',
        badgeBg: 'bg-[#EFEAE0]',
        badgeText: 'text-[#45413C]',
        badgeBorder: 'border-[#8D8579]',
        barFill: '#6B7D8F',
        accentHex: '#6B7D8F',
      };
  }
}

export const PaperDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`h-px w-full bg-[#D9C5A8]/85 ${className}`} role="separator" />
);

export const PaperSectionLabel: React.FC<{
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}> = ({ children, right, className = '' }) => (
  <div className={`flex items-center justify-between gap-2 ${className}`}>
    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6E6A64]">
      {children}
    </span>
    {right && <span className="text-[11px] font-medium text-[#6E6A64]">{right}</span>}
  </div>
);

interface PaperModalShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  maxWidthClass?: string;
  zIndexClass?: string;
  headerRight?: React.ReactNode;
  headerLeft?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const PaperModalShell: React.FC<PaperModalShellProps> = ({
  title,
  subtitle,
  icon,
  onClose,
  closeDisabled = false,
  maxWidthClass = 'max-w-xl',
  zIndexClass = 'z-40',
  headerRight,
  headerLeft,
  footer,
  children,
}) => (
  <div
    className={`safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 ${zIndexClass} flex items-center justify-center bg-[#292725]/45 p-3 sm:p-5`}
    role="dialog"
    aria-modal="true"
  >
    <div
      className={`animate-modal-in paper-shadow flex max-h-[calc(100dvh-1.5rem)] w-full ${maxWidthClass} flex-col overflow-hidden rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725]`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#D9C5A8] bg-[#F7F3EA] px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {headerLeft}
          {icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#45413C] bg-[#E8EFF6] text-[#365B82]">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-display truncate text-base font-extrabold uppercase tracking-[0.04em] text-[#292725] sm:text-lg">
              {title}
            </h2>
            {subtitle && (
              <p className="truncate text-[11px] font-medium text-[#6E6A64] sm:text-xs">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {headerRight}
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={`Close ${title}`}
            className="paper-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[#45413C] bg-[#FFFDF8] text-[#292725] hover:bg-[#EFEAE0] focus-visible:outline-2 focus-visible:outline-[#4F6D8A] disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="modal-scroll-area min-h-0 flex-1 overflow-y-auto">{children}</div>

      {footer && (
        <div className="shrink-0 border-t border-[#D9C5A8] bg-[#F7F3EA] px-4 py-3 sm:px-6">
          {footer}
        </div>
      )}
    </div>
  </div>
);

interface PaperToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

export const PaperToggle: React.FC<PaperToggleProps> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`relative inline-flex h-8 w-[60px] shrink-0 items-center rounded-lg border-[1.5px] border-[#45413C] p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-[#4F6D8A] ${
      checked ? 'bg-[#4F6D8A]' : 'bg-[#EFEAE0]'
    }`}
  >
    <span
      className={`flex h-6 w-7 items-center justify-center rounded-[5px] border border-[#45413C] bg-[#FFFDF8] text-[9px] font-bold uppercase tracking-wider text-[#292725] transition-transform duration-150 ${
        checked ? 'translate-x-[26px]' : 'translate-x-0'
      }`}
    >
      {checked ? 'ON' : 'OFF'}
    </span>
  </button>
);

export function PaperSegmented<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-1 rounded-lg border border-[#45413C] bg-[#EFEAE0] p-1"
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={`min-h-[36px] rounded-md px-2 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-[#4F6D8A] ${
              active
                ? 'border border-[#45413C] bg-[#4F6D8A] text-[#FFFDF8] shadow-[1.5px_1.5px_0px_#45413C]'
                : 'border border-transparent text-[#57534E] hover:bg-[#FFFDF8]/70 hover:text-[#292725]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
