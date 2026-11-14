import React from 'react';
import { getPowerZone, PEN_SPECS, PowerZoneId } from '../utils/Constants';
import { DragTelemetry } from '../game/GameState';

interface PowerMeterProps {
  telemetry: DragTelemetry;
}

const ZONE_BAR_COLORS: Record<PowerZoneId, string> = {
  LOW: 'bg-sky-400',
  MEDIUM: 'bg-emerald-400',
  HIGH: 'bg-amber-400',
  MAXIMUM: 'bg-rose-500',
};

const ZONE_TEXT_COLORS: Record<PowerZoneId, string> = {
  LOW: 'text-sky-300',
  MEDIUM: 'text-emerald-300',
  HIGH: 'text-amber-300',
  MAXIMUM: 'text-rose-400',
};

export const PowerMeter: React.FC<PowerMeterProps> = ({ telemetry }) => {
  if (!telemetry.isDragging) return null;

  const powerPct = Math.round(telemetry.powerRatio * 100);
  const zoneSpec = getPowerZone(telemetry.powerRatio);
  const barColor = ZONE_BAR_COLORS[zoneSpec.id];
  const zoneTextColor = ZONE_TEXT_COLORS[zoneSpec.id];

  const penLabel = PEN_SPECS[telemetry.penType].label;
  const spinLabel =
    telemetry.spinFactor >= 0.55
      ? 'High Spin'
      : telemetry.spinFactor >= 0.25
        ? 'Curve'
        : 'Direct';

  return (
    <div className="pointer-events-none safe-pad-bottom safe-pad-x fixed inset-x-0 bottom-0 z-20 flex justify-center pb-1.5 sm:pb-3">
      <div className="w-full max-w-[min(92vw,22rem)] rounded-xl border border-white/15 bg-[#12161f]/95 px-3 py-2 shadow-2xl sm:max-w-md sm:px-4 sm:py-2.5">
        {/* Top row: Power Zone + Power % + Estimated Strength */}
        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold">
            <span className={zoneTextColor}>{zoneSpec.label}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-300">{zoneSpec.role}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono-num text-[11px] text-slate-400">
              {telemetry.canLaunch ? `${telemetry.estimatedSpeed.toFixed(1)} u/s` : 'Ready'}
            </span>
            <span className={`font-mono-num text-sm font-bold ${telemetry.canLaunch ? 'text-white' : 'text-slate-400'}`}>
              {telemetry.canLaunch ? `${powerPct}%` : 'Pull'}
            </span>
          </div>
        </div>

        {/* 4-Zone Segmented Power Bar (30% / 60% / 85% markers) */}
        <div className="relative h-2 w-full overflow-hidden rounded-md bg-slate-800 sm:h-2.5">
          <div
            className={`h-full origin-left transition-transform duration-75 ease-out ${barColor}`}
            style={{
              width: '100%',
              transform: `scaleX(${telemetry.canLaunch ? Math.max(0.05, telemetry.powerRatio) : 0.02})`,
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-[30%] w-px bg-[#0b0f17]/80"
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-[60%] w-px bg-[#0b0f17]/80"
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-[85%] w-px bg-[#0b0f17]/80"
          />
        </div>

        {/* Zone scale ticks */}
        <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-500 sm:text-[10px]">
          <span className={zoneSpec.id === 'LOW' ? 'font-semibold text-sky-300' : ''}>Low</span>
          <span className={zoneSpec.id === 'MEDIUM' ? 'font-semibold text-emerald-300' : ''}>Med</span>
          <span className={zoneSpec.id === 'HIGH' ? 'font-semibold text-amber-300' : ''}>High</span>
          <span className={zoneSpec.id === 'MAXIMUM' ? 'font-semibold text-rose-400' : ''}>Max</span>
        </div>

        {/* Bottom telemetry: Grip, Direction, Drag Distance, Pen */}
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400 sm:text-[11px]">
          <div className="flex items-center gap-1 truncate sm:gap-1.5">
            <span className="text-sky-400">{telemetry.anchorZone}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{spinLabel}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono-num text-slate-300">
              {telemetry.pullCardinal} ({telemetry.pullAngleDeg}°)
            </span>
          </div>
          <span className="shrink-0 font-mono-num text-slate-400">
            {telemetry.dragDistance.toFixed(2)}u · {penLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

