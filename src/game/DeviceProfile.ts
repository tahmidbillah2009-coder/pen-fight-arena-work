import { GraphicsQuality } from './GameState';

/**
 * Hardware profiling for the rendering pipeline.
 *
 * A single detection value is never trusted: a WebGL renderer string is combined with core
 * count, device memory, pixel ratio and pointer type to place the device in one of three
 * profiles, and the resulting tuning is then *verified and corrected* at runtime by the measured
 * frame rate (see `QualityController.updateResolution`).
 */

/** Matches the three device profiles the performance spec defines. */
export type DeviceClass = 'A' | 'B' | 'C';

/** Shadow filtering cost tiers, kept free of three.js types so this module stays renderer-agnostic. */
export type ShadowFilter = 'BASIC' | 'PCF' | 'PCF_SOFT';

export interface GpuInfo {
  vendor: string;
  renderer: string;
  /** SwiftShader / llvmpipe / Microsoft Basic Render — no real GPU acceleration. */
  isSoftware: boolean;
  isIntel: boolean;
  /**
   * Haswell / Broadwell / Bay Trail era integrated parts (HD Graphics 2000–5999, Iris 5100/6100).
   * These are the weakest desktop targets and the primary optimisation focus.
   */
  isLegacyIntel: boolean;
  /** Specifically Intel HD Graphics 4600 (Haswell GT2 desktop / mobile). */
  isIntelHd4600: boolean;
}

export interface DeviceSignals {
  hardwareConcurrency: number;
  /** `navigator.deviceMemory` in GB, or 0 when the browser does not expose it. */
  deviceMemory: number;
  devicePixelRatio: number;
  isCoarsePointer: boolean;
  /** Shorter viewport edge in CSS pixels — separates phones from tablets and desktops. */
  minViewport: number;
}

export interface DeviceTuning {
  deviceClass: DeviceClass;
  /** Highest tier AUTO quality is allowed to reach on this device. */
  graphicsCeiling: GraphicsQuality;
  /** Tier AUTO quality starts at. Deliberately conservative — it climbs only with headroom. */
  initialTier: GraphicsQuality;
  /** MSAA is the single most expensive option on older integrated GPUs. */
  antialias: boolean;
  shadowFilter: ShadowFilter;
  /** Shadow map edge in texels, or 0 when shadows are disabled outright. */
  shadowMapSize: number;
  /** Hard cap applied to `devicePixelRatio`. */
  maxPixelRatio: number;
  /** Resolution scale the adaptive controller starts from and never exceeds. */
  maxResolutionScale: number;
  /** Scales the adaptive controller may step through, richest first. */
  resolutionLadder: number[];
}

/** Detection touches the GPU stack, so it runs once per page load and is cached. */
let cachedGpu: GpuInfo | null = null;

export function detectGpu(): GpuInfo {
  if (!cachedGpu) cachedGpu = probeGpu();
  return cachedGpu;
}

function probeGpu(): GpuInfo {
  const unknown: GpuInfo = {
    vendor: '',
    renderer: '',
    isSoftware: false,
    isIntel: false,
    isLegacyIntel: false,
    isIntelHd4600: false,
  };
  if (typeof document === 'undefined') return unknown;

  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as
      | WebGLRenderingContext
      | null;
    if (!gl) return { ...unknown, isSoftware: true };

    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    const vendor = String(gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR) ?? '');
    node: {
      // Release the probe context immediately so it cannot count against the context limit.
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }

    const isSoftware = /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Microsoft Basic/i.test(
      `${vendor} ${renderer}`
    );
    const isIntel = /Intel|Iris|HD Graphics|UHD Graphics/i.test(`${vendor} ${renderer}`);
    // "UHD Graphics 6xx/7xx" and "Iris Xe" are appreciably faster than the Haswell-era parts, so
    // they are excluded from the legacy bucket even though the name overlaps.
    const isModernIntel = /UHD Graphics|Iris Xe|Arc\(/i.test(renderer);
    const isIntelHd4600 = isIntel && /4600/i.test(renderer);
    const isLegacyIntel =
      isIntelHd4600 ||
      (!isModernIntel &&
        /HD Graphics (?:[2345]\d{3})|Iris(?: Pro)? (?:5100|6100)|Haswell|Bay Trail/i.test(renderer));

    return { vendor, renderer, isSoftware, isIntel, isLegacyIntel, isIntelHd4600 };
  } catch {
    return unknown;
  }
}

export function readDeviceSignals(): DeviceSignals {
  if (typeof window === 'undefined') {
    return {
      hardwareConcurrency: 4,
      deviceMemory: 0,
      devicePixelRatio: 1,
      isCoarsePointer: false,
      minViewport: 1080,
    };
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    hardwareConcurrency: nav.hardwareConcurrency || 4,
    deviceMemory: nav.deviceMemory || 0,
    devicePixelRatio: window.devicePixelRatio || 1,
    isCoarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    minViewport: Math.min(window.innerWidth || 1080, window.innerHeight || 1080),
  };
}

/** Scales the adaptive controller is allowed to pick from, richest first. */
const FULL_LADDER = [1, 0.9, 0.8, 0.75, 0.67];

/**
 * Maps detected hardware onto a rendering configuration.
 *
 * The three profiles are not "low / medium / high" in disguise — each one makes a different
 * structural choice about *where* the frame budget goes:
 *
 *  - **A** (dedicated / modern integrated): full MSAA, PCF soft shadows at 2048, full resolution.
 *  - **B** (moderate integrated, mid-range mobile): no MSAA, PCF shadows at 1024, capped pixel
 *    ratio. Costs are trimmed where they are least visible first.
 *  - **C** (legacy integrated such as Intel HD Graphics 4600, entry-level mobile): no MSAA, PCF
 *    shadows at 1024 with on-demand updates, a pixel-ratio cap of 1 and a resolution ladder that
 *    starts at 75%. Fill rate — not geometry — is what limits these parts at 1920x1080, so the
 *    resolution scale is the main lever and everything else is left as high as it will hold.
 */
export function buildDeviceTuning(gpu: GpuInfo, s: DeviceSignals): DeviceTuning {
  if (gpu.isSoftware || !gpu.renderer) {
    return {
      deviceClass: 'C',
      graphicsCeiling: 'LOW',
      initialTier: 'LOW',
      antialias: false,
      shadowFilter: 'BASIC',
      shadowMapSize: 0,
      maxPixelRatio: 1,
      maxResolutionScale: 0.75,
      resolutionLadder: [0.75, 0.67],
    };
  }

  if (gpu.isLegacyIntel || gpu.isIntelHd4600) {
    return {
      deviceClass: 'C',
      // Intel HD 4600 optimization profile:
      // Cap DPR to 1.0 (no fill-rate blowup on 125%/150% Windows scaling), disable MSAA,
      // use tight bounds 1024 PCF shadows with on-demand caching, and full resolution ladder.
      graphicsCeiling: 'HIGH',
      initialTier: 'MEDIUM',
      antialias: false,
      shadowFilter: 'PCF',
      shadowMapSize: 1024,
      maxPixelRatio: 1,
      maxResolutionScale: 1,
      resolutionLadder: FULL_LADDER,
    };
  }

  const weakMemory = s.deviceMemory > 0 && s.deviceMemory <= 2;
  const weakCpu = s.hardwareConcurrency <= 4;
  const isProfileB =
    gpu.isIntel || s.isCoarsePointer || weakCpu || weakMemory || s.deviceMemory === 0;

  if (isProfileB) {
    return {
      deviceClass: 'B',
      graphicsCeiling: 'HIGH',
      initialTier: 'MEDIUM',
      antialias: false,
      shadowFilter: 'PCF',
      shadowMapSize: 1024,
      maxPixelRatio: Math.min(1.5, s.devicePixelRatio),
      maxResolutionScale: 1,
      resolutionLadder: FULL_LADDER,
    };
  }

  return {
    deviceClass: 'A',
    graphicsCeiling: 'ULTRA',
    initialTier: 'HIGH',
    antialias: true,
    shadowFilter: 'PCF_SOFT',
    shadowMapSize: 2048,
    maxPixelRatio: 2,
    maxResolutionScale: 1,
    resolutionLadder: FULL_LADDER,
  };
}

/** Convenience wrapper used at engine start-up. */
export function profileDevice(): DeviceTuning {
  return buildDeviceTuning(detectGpu(), readDeviceSignals());
}
