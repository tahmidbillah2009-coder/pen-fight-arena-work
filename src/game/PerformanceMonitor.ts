/**
 * Lightweight runtime performance telemetry.
 *
 * The monitor is fed one timestamp per *rendered* frame and publishes a compact snapshot at a
 * fixed 4 Hz cadence. It never touches React: subscribers (the FPS overlay) update themselves,
 * so frame timing can never trigger a re-render of the wider application.
 *
 * Frame time here is strictly the interval between render callbacks — it is the rendering FPS,
 * not the fixed physics step rate (which always runs at `PHYSICS_FIXED_DT`).
 */

/** Frame deltas inside this window give the responsive "current FPS" figure (~0.25 s at 60 fps). */
const SHORT_WINDOW = 15;
/** Frame deltas inside this window give the stable averages / minimum (~2 s at 60 fps). */
const LONG_WINDOW = 120;
/** Wall-clock interval between published samples — 4 updates per second. */
const PUBLISH_INTERVAL_MS = 250;

export interface PerfSample {
  /** Instantaneous rendering FPS over the short window. */
  fps: number;
  /** Average rendering FPS over the long window. */
  avgFps: number;
  /** Slowest single frame inside the long window, expressed as a rate. */
  minFps: number;
  /** 1% low FPS calculated from 99th percentile slowest frame deltas. */
  onePercentLowFps: number;
  /** Mean frame time (ms) over the long window. */
  frameMs: number;
  /** Milliseconds spent inside the last physics step. */
  physicsMs: number;
  /** Milliseconds spent inside the main CPU update. */
  cpuMs: number;
  /** Rigid bodies alive in the physics world. */
  bodies: number;
  /** Colliders alive in the physics world. */
  colliders: number;
  /** Rigid bodies that are currently simulated (not sleeping). */
  awakeBodies: number;
  /** Draw calls issued by the renderer, or -1 when unavailable. */
  drawCalls: number;
  /** Triangles rendered, or -1 when unavailable. */
  triangles: number;
  /** Approximate JS heap usage in MB, or -1 when the browser does not expose it. */
  memoryMB: number;
  /** Resolved graphics quality currently in use, ready for display. */
  quality: string;
  /** Active internal render resolution (e.g. '1440x810 (75%)'). */
  resolution: string;
  /** Identified performance bottleneck. */
  bottleneck: 'GPU' | 'CPU' | 'BALANCED';
}

interface PerformanceMemory {
  usedJSHeapSize: number;
}

/** Copies fields out of a mutable sample so React can diff it cheaply. */
export function clonePerfSample(sample: PerfSample): PerfSample {
  return { ...sample };
}

/** Zeroed sample used to seed the monitor and to blank the panel on a fresh match. */
const EMPTY_SAMPLE: PerfSample = {
  fps: 0,
  avgFps: 0,
  minFps: 0,
  onePercentLowFps: 0,
  frameMs: 0,
  physicsMs: 0,
  cpuMs: 0,
  bodies: 0,
  colliders: 0,
  awakeBodies: 0,
  drawCalls: -1,
  triangles: -1,
  memoryMB: -1,
  quality: '',
  resolution: '',
  bottleneck: 'BALANCED',
};

export class PerformanceMonitor {
  /** Latest published values. Mutated in place — always copy before handing to React state. */
  public readonly latest: PerfSample = { ...EMPTY_SAMPLE, quality: 'High' };

  /** True once at least one real measurement has been published. */
  public hasSamples = false;

  private readonly shortDeltas: number[] = [];
  private readonly longDeltas: number[] = [];
  private lastFrameTime = 0;
  private publishAccumulator = 0;
  private readonly listeners = new Set<(sample: PerfSample) => void>();

  /**
   * Records a rendered frame. `now` must come from `performance.now()` (a monotonic clock) so
   * the measurement tracks real frame timestamps rather than an accumulated delta.
   */
  public frame(now: number): void {
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = now;
      return;
    }
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;
    // Ignore impossible deltas: tab switches, background throttling and clock glitches.
    if (dt <= 0 || dt > 1000) return;

    pushBounded(this.shortDeltas, dt, SHORT_WINDOW);
    pushBounded(this.longDeltas, dt, LONG_WINDOW);

    this.publishAccumulator += dt;
    if (this.publishAccumulator >= PUBLISH_INTERVAL_MS) {
      this.publishAccumulator = 0;
      this.publish();
    }
  }

  public subscribe(listener: (sample: PerfSample) => void): () => void {
    this.listeners.add(listener);
    if (this.hasSamples) listener(this.latest);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Clears the rolling windows so a fresh match does not inherit a previous session's lows. */
  public reset(): void {
    this.shortDeltas.length = 0;
    this.longDeltas.length = 0;
    this.publishAccumulator = 0;
    this.lastFrameTime = 0;
    // Blank the published sample immediately, otherwise a restart would keep showing the previous
    // match's numbers for up to 250 ms. The resolved quality label is owned by the engine.
    const quality = this.latest.quality;
    Object.assign(this.latest, EMPTY_SAMPLE, { quality });
    this.hasSamples = false;
    for (const listener of this.listeners) {
      listener(this.latest);
    }
  }

  private publish(): void {
    const shortSum = sum(this.shortDeltas);
    const longSum = sum(this.longDeltas);
    const longCount = this.longDeltas.length;

    let worst = 0;
    for (let i = 0; i < longCount; i++) {
      if (this.longDeltas[i] > worst) worst = this.longDeltas[i];
    }

    const s = this.latest;
    s.fps = shortSum > 0 ? (this.shortDeltas.length * 1000) / shortSum : 0;
    s.avgFps = longSum > 0 ? (longCount * 1000) / longSum : 0;
    s.frameMs = longCount > 0 ? longSum / longCount : 0;
    s.minFps = worst > 0 ? 1000 / worst : 0;

    // True 1% Low FPS: the 99th percentile slowest frame delta inverted to FPS rate
    if (longCount > 0) {
      const sorted = [...this.longDeltas].sort((a, b) => a - b);
      const p99Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99));
      const p99Delta = sorted[p99Idx] || worst;
      s.onePercentLowFps = p99Delta > 0 ? 1000 / p99Delta : 0;
    } else {
      s.onePercentLowFps = 0;
    }

    if (s.frameMs > 17.0) {
      s.bottleneck = s.physicsMs > 6.0 || s.cpuMs > 8.0 ? 'CPU' : 'GPU';
    } else {
      s.bottleneck = 'BALANCED';
    }

    const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
    s.memoryMB = memory ? memory.usedJSHeapSize / (1024 * 1024) : -1;

    this.hasSamples = true;
    for (const listener of this.listeners) {
      listener(s);
    }
  }
}

function pushBounded(target: number[], value: number, limit: number): void {
  target.push(value);
  if (target.length > limit) target.shift();
}

function sum(values: number[]): number {
  let total = 0;
  for (let i = 0; i < values.length; i++) total += values[i];
  return total;
}
