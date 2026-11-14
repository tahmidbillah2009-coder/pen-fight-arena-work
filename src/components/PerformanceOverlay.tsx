import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { clonePerfSample, PerfSample, PerformanceMonitor } from '../game/PerformanceMonitor';

interface PerformanceOverlayProps {
  /** The game's monitor. `null` until the engine has been constructed. */
  monitor: PerformanceMonitor | null;
  /** Settings → "FPS Counter". */
  visible: boolean;
  className?: string;
}

const GOOD_FPS = 55;
const OK_FPS = 30;

function fpsTone(fps: number): { text: string; dot: string } {
  if (fps >= GOOD_FPS) {
    return { text: 'text-[#2E664B]', dot: 'bg-[#2E664B]' };
  }
  if (fps >= OK_FPS) {
    return { text: 'text-[#85581A]', dot: 'bg-[#A3702B]' };
  }
  return { text: 'text-[#9E3B36]', dot: 'bg-[#9E3B36]' };
}

function bottleneckBadge(b: 'GPU' | 'CPU' | 'BALANCED'): { text: string; bg: string } {
  if (b === 'GPU') return { text: 'text-[#85581A]', bg: 'bg-[#FBF3E2] border-[#9C6C2B]' };
  if (b === 'CPU') return { text: 'text-[#365B82]', bg: 'bg-[#E8EFF6] border-[#4F6D8A]' };
  return { text: 'text-[#2E664B]', bg: 'bg-[#E6F2EC] border-[#2E664B]' };
}

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
      className={`paper-shadow-sm select-none rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-2.5 py-1.5 font-mono-num text-[10px] leading-tight text-[#292725] ${className ?? ''}`}
      role="status"
      aria-live="off"
      aria-label="Performance monitor"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${ready ? tone.dot : 'bg-[#8D8579]'}`}
            aria-hidden="true"
          />
          <span className={`text-sm font-bold tabular-nums ${ready ? tone.text : 'text-[#6E6A64]'}`}>
            {Math.round(fps)}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wide text-[#6E6A64]">fps</span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="pointer-events-auto flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#6E6A64] hover:bg-[#EFEAE0] hover:text-[#292725]"
          title={expanded ? 'Collapse diagnostics' : 'Expand full diagnostics'}
        >
          <span>{expanded ? 'Less' : 'Diag'}</span>
          {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        </button>
      </div>

      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-2 gap-y-0.5 text-[#6E6A64]">
        <dt>avg</dt>
        <dd className="text-right font-semibold text-[#292725]">{fmt(sample?.avgFps ?? 0)}</dd>
        <dt>1% low</dt>
        <dd className="text-right font-semibold text-[#292725]">
          {fmt(sample?.onePercentLowFps && sample.onePercentLowFps > 0 ? sample.onePercentLowFps : (sample?.minFps ?? 0))}
        </dd>
        <dt>frame</dt>
        <dd className="text-right font-semibold text-[#292725]">
          {ready ? `${(sample?.frameMs ?? 0).toFixed(1)}ms` : '--'}
        </dd>
      </dl>

      <div className="mt-1 flex items-center justify-between border-t border-[#D9C5A8] pt-1 text-[9px] font-bold tracking-wide text-[#365B82]">
        <span className="truncate uppercase">{sample?.quality ?? '--'}</span>
        {sample?.resolution && (
          <span className="ml-1 text-[8px] text-[#6E6A64]">{sample.resolution}</span>
        )}
      </div>

      {expanded && sample && (
        <div className="mt-1.5 border-t border-[#D9C5A8] pt-1.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[8px] font-bold uppercase tracking-wider text-[#6E6A64]">
              Bottleneck
            </span>
            <span
              className={`rounded border px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide ${bBadge.bg} ${bBadge.text}`}
            >
              {sample.bottleneck}
            </span>
          </div>

          <dl className="grid grid-cols-[auto_auto] gap-x-2 gap-y-0.5 text-[#6E6A64]">
            <dt>cpu script</dt>
            <dd className="text-right text-[#292725]">{ready ? `${sample.cpuMs.toFixed(2)}ms` : '--'}</dd>
            <dt>physics</dt>
            <dd className="text-right text-[#292725]">{ready ? `${sample.physicsMs.toFixed(2)}ms` : '--'}</dd>
            {sample.drawCalls >= 0 && (
              <>
                <dt>draw calls</dt>
                <dd className="text-right text-[#292725]">{sample.drawCalls}</dd>
              </>
            )}
            {sample.triangles >= 0 && (
              <>
                <dt>triangles</dt>
                <dd className="text-right text-[#292725]">{(sample.triangles / 1000).toFixed(0)}k</dd>
              </>
            )}
            {sample.bodies > 0 && (
              <>
                <dt>bodies</dt>
                <dd className="text-right text-[#292725]">
                  {sample.awakeBodies}/{sample.bodies}
                </dd>
              </>
            )}
            {sample.colliders > 0 && (
              <>
                <dt>colliders</dt>
                <dd className="text-right text-[#292725]">{sample.colliders}</dd>
              </>
            )}
            {sample.memoryMB >= 0 && (
              <>
                <dt>heap</dt>
                <dd className="text-right text-[#292725]">{sample.memoryMB.toFixed(0)}MB</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
};
