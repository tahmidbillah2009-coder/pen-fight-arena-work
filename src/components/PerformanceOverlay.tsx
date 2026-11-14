import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, Gauge } from 'lucide-react';
import { clonePerfSample, PerfSample, PerformanceMonitor } from '../game/PerformanceMonitor';

interface PerformanceOverlayProps {
  /** The game's monitor. `null` until the engine has been constructed. */
  monitor: PerformanceMonitor | null;
  /** Settings → "FPS Counter". */
  visible: boolean;
  className?: string;
}

/** 55+ is a comfortable target, 30 is the floor we promise low-end devices. */
const GOOD_FPS = 55;
const OK_FPS = 30;

function fpsTone(fps: number): { text: string; dot: string; border: string } {
  if (fps >= GOOD_FPS) {
    return { text: 'text-emerald-300', dot: 'bg-emerald-400', border: 'border-emerald-400/35' };
  }
  if (fps >= OK_FPS) {
    return { text: 'text-amber-300', dot: 'bg-amber-400', border: 'border-amber-400/35' };
  }
  return { text: 'text-rose-300', dot: 'bg-rose-400', border: 'border-rose-400/45' };
}

function bottleneckBadge(b: 'GPU' | 'CPU' | 'BALANCED'): { text: string; bg: string } {
  if (b === 'GPU') return { text: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-500/30' };
  if (b === 'CPU') return { text: 'text-sky-300', bg: 'bg-sky-500/20 border-sky-500/30' };
  return { text: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-500/30' };
}

/**
 * Real-time performance monitor with expandable diagnostics mode.
 *
 * It subscribes directly to the engine's `PerformanceMonitor` at 4 Hz,
 * so updates re-render this component alone without touching the wider application.
 */
export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  monitor,
  visible,
  className,
}) => {
  const [sample, setSample] = useState<PerfSample | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!monitor || !visible) return;
    const unsubscribe = monitor.subscribe((next) => {
      setSample(clonePerfSample(next));
    });
    return () => {
      unsubscribe();
      setSample(null);
    };
  }, [monitor, visible]);

  if (!visible) return null;

  const fps = sample?.fps ?? 0;
  const tone = fpsTone(fps);
  const ready = sample !== null && sample.avgFps > 0;
  const bBadge = bottleneckBadge(sample?.bottleneck ?? 'BALANCED');

  const fmt = (value: number, digits = 0): string =>
    ready ? value.toFixed(digits) : '--';

  return (
    <div
      className={`select-none rounded-xl border bg-[#0b0f16]/92 px-2.5 py-1.5 font-mono-num text-[10px] leading-tight text-slate-200 shadow-xl backdrop-blur-md transition-all ${
        ready ? tone.border : 'border-white/12'
      } ${className ?? ''}`}
      role="status"
      aria-live="off"
      aria-label="Performance monitor"
    >
      {/* Header bar: FPS + expandable toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${ready ? tone.dot : 'bg-slate-500'}`}
            aria-hidden="true"
          />
          <span className={`text-sm font-bold tabular-nums ${ready ? tone.text : 'text-slate-400'}`}>
            {Math.round(fps)}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">fps</span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="pointer-events-auto flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-slate-400 hover:bg-white/10 hover:text-white"
          title={expanded ? 'Collapse diagnostics' : 'Expand full diagnostics'}
        >
          <span>{expanded ? 'Less' : 'Diag'}</span>
          {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        </button>
      </div>

      {/* Core metrics */}
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-2 gap-y-0.5 text-slate-400">
        <dt>avg</dt>
        <dd className="text-right text-slate-200">{fmt(sample?.avgFps ?? 0)}</dd>
        <dt>1% low</dt>
        <dd className="text-right text-slate-200">
          {fmt(sample?.onePercentLowFps && sample.onePercentLowFps > 0 ? sample.onePercentLowFps : (sample?.minFps ?? 0))}
        </dd>
        <dt>frame</dt>
        <dd className="text-right text-slate-200">
          {ready ? `${(sample?.frameMs ?? 0).toFixed(1)}ms` : '--'}
        </dd>
      </dl>

      {/* Quality preset & internal render resolution */}
      <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1 text-[9px] font-semibold tracking-wide text-sky-300">
        <span className="truncate uppercase">{sample?.quality ?? '--'}</span>
        {sample?.resolution && (
          <span className="ml-1 text-[8px] text-slate-400">{sample.resolution}</span>
        )}
      </div>

      {/* Detailed diagnostics mode */}
      {expanded && sample && (
        <div className="mt-1.5 border-t border-white/10 pt-1.5">
          {/* Bottleneck badge */}
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[8px] uppercase tracking-wider text-slate-500">Bottleneck</span>
            <span
              className={`rounded border px-1 py-0.2 text-[8px] font-bold uppercase tracking-wide ${bBadge.bg} ${bBadge.text}`}
            >
              {sample.bottleneck}
            </span>
          </div>

          <dl className="grid grid-cols-[auto_auto] gap-x-2 gap-y-0.5 text-slate-400">
            <dt>cpu script</dt>
            <dd className="text-right text-slate-200">{ready ? `${sample.cpuMs.toFixed(2)}ms` : '--'}</dd>
            <dt>physics</dt>
            <dd className="text-right text-slate-200">{ready ? `${sample.physicsMs.toFixed(2)}ms` : '--'}</dd>
            {sample.drawCalls >= 0 && (
              <>
                <dt>draw calls</dt>
                <dd className="text-right text-slate-200">{sample.drawCalls}</dd>
              </>
            )}
            {sample.triangles >= 0 && (
              <>
                <dt>triangles</dt>
                <dd className="text-right text-slate-200">{(sample.triangles / 1000).toFixed(0)}k</dd>
              </>
            )}
            {sample.bodies > 0 && (
              <>
                <dt>bodies</dt>
                <dd className="text-right text-slate-200">
                  {sample.awakeBodies} awake / {sample.bodies}
                </dd>
              </>
            )}
            {sample.colliders > 0 && (
              <>
                <dt>colliders</dt>
                <dd className="text-right text-slate-200">{sample.colliders}</dd>
              </>
            )}
            {sample.memoryMB >= 0 && (
              <>
                <dt>heap</dt>
                <dd className="text-right text-slate-200">{sample.memoryMB.toFixed(0)}MB</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
};
