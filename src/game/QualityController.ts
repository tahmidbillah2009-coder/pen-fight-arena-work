import {
  EffectQuality,
  GameSettings,
  GraphicsQuality,
  QualityPreference,
  ResolutionPreference,
  ShadowQuality,
} from './GameState';

/**
 * The fully-resolved rendering configuration the engine actually applies — the product of the
 * user's quality preference, the adaptive tier chosen from measured performance, and the
 * per-feature ceilings the player set in Settings.
 */
export interface QualityProfile {
  quality: GraphicsQuality;
  shadow: ShadowQuality;
  particles: EffectQuality;
  motion: boolean;
  /** Multiplier applied to the device pixel ratio (1 = full, 0.75 = 75%). */
  resolutionScale: number;
  performanceMode: boolean;
}

export type BottleneckType = 'GPU' | 'CPU' | 'BALANCED';

/** Ordering helpers — higher is better for each OFF/LOW/HIGH feature tier. */
const EFFECT_ORDER: Record<EffectQuality, number> = { OFF: 0, LOW: 1, HIGH: 2 };
const SHADOW_ORDER: Record<ShadowQuality, number> = { OFF: 0, LOW: 1, HIGH: 2 };
const QUALITY_ORDER: Record<GraphicsQuality, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, ULTRA: 3 };

/** What each tier means before the player's explicit overrides are folded in. */
const TIER_DEFAULTS: Record<
  GraphicsQuality,
  { shadow: ShadowQuality; particles: EffectQuality; motion: boolean; resolutionScale: number }
> = {
  LOW: { shadow: 'OFF', particles: 'LOW', motion: false, resolutionScale: 0.75 },
  MEDIUM: { shadow: 'LOW', particles: 'HIGH', motion: true, resolutionScale: 0.85 },
  HIGH: { shadow: 'HIGH', particles: 'HIGH', motion: true, resolutionScale: 1 },
  ULTRA: { shadow: 'HIGH', particles: 'HIGH', motion: true, resolutionScale: 1 },
};

/** Sustained FPS below this triggers an automatic downgrade in AUTO mode. */
const DOWNGRADE_FPS = 48;
/** Sustained FPS above this allows an automatic upgrade in AUTO mode. */
const UPGRADE_FPS = 58;
/** Seconds of sustained low FPS before dropping a tier or resolution. */
const DOWNGRADE_HOLD = 2.0;
/** Seconds of sustained high FPS before climbing a tier (deliberately much longer). */
const UPGRADE_HOLD = 7.0;
/** Minimum seconds between any two automatic tier changes — prevents oscillation. */
const CHANGE_COOLDOWN = 5.0;

const RESOLUTION_LADDER = [1.0, 0.9, 0.8, 0.75, 0.67];

/**
 * Owns the resolved graphics tier and intelligent dynamic resolution scaling.
 *
 * `AUTO` mode reacts to measured rendering FPS and frame time breakdown (CPU vs GPU bound)
 * using an asymmetric hysteresis plus a cooldown, settling on the optimal configuration
 * for target hardware (such as Intel HD 4600).
 */
export class QualityController {
  /** Tier the device was profiled at — the ceiling AUTO is allowed to reach. */
  public readonly deviceCeiling: GraphicsQuality;
  /** Tier the adaptive logic last chose (only meaningful in AUTO mode). */
  private autoTier: GraphicsQuality;
  /** Current index in RESOLUTION_LADDER for dynamic render resolution scaling. */
  private autoResolutionIndex = 0;

  private cooldown = 0;
  private lowHold = 0;
  private highHold = 0;
  public detectedBottleneck: BottleneckType = 'BALANCED';

  constructor(deviceRecommendation: GraphicsQuality) {
    this.deviceCeiling = deviceRecommendation;
    this.autoTier = deviceRecommendation;
    // For LOW/MEDIUM initial tiers on older GPUs, start with a balanced resolution step
    if (deviceRecommendation === 'LOW') {
      this.autoResolutionIndex = 3; // 0.75
    } else if (deviceRecommendation === 'MEDIUM') {
      this.autoResolutionIndex = 1; // 0.9
    } else {
      this.autoResolutionIndex = 0; // 1.0
    }
  }

  /** Resolved tier for the current preference. */
  public getTier(preference: QualityPreference): GraphicsQuality {
    return preference === 'AUTO' ? this.autoTier : preference;
  }

  public getDynamicResolutionScale(): number {
    return RESOLUTION_LADDER[this.autoResolutionIndex] ?? 1.0;
  }

  /**
   * Folds the quality tier together with the player's per-feature ceilings.
   * Performance Mode short-circuits everything to the cheapest configuration.
   */
  public resolve(settings: GameSettings): QualityProfile {
    const tier = this.getTier(settings.graphicsQuality);
    const base = TIER_DEFAULTS[tier];

    if (settings.performanceMode) {
      return {
        quality: 'LOW',
        shadow: 'OFF',
        particles: minEffect(settings.particleEffects, 'LOW'),
        motion: false,
        resolutionScale: 0.75,
        performanceMode: true,
      };
    }

    const dynamicScale = this.getDynamicResolutionScale();
    const resolvedScale = resolveScale(
      settings.renderResolution,
      Math.min(base.resolutionScale, dynamicScale)
    );

    return {
      quality: tier,
      shadow: minShadow(settings.shadowQuality, base.shadow),
      particles: minEffect(settings.particleEffects, base.particles),
      motion: settings.motionEffects && base.motion,
      resolutionScale: resolvedScale,
      performanceMode: false,
    };
  }

  /**
   * Advances the adaptive controller with bottleneck detection.
   * Returns true when any setting or resolution changed (so the engine re-applies profile).
   */
  public updateAdvanced(
    dt: number,
    avgFps: number,
    frameMs: number,
    physicsMs: number,
    enabled: boolean
  ): boolean {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);

    // Identify bottleneck
    if (frameMs > 17.0) {
      if (physicsMs > 6.0) {
        this.detectedBottleneck = 'CPU';
      } else {
        this.detectedBottleneck = 'GPU';
      }
    } else {
      this.detectedBottleneck = 'BALANCED';
    }

    if (!enabled || !Number.isFinite(avgFps) || avgFps <= 0) {
      this.lowHold = 0;
      this.highHold = 0;
      return false;
    }

    if (avgFps < DOWNGRADE_FPS) {
      this.lowHold += dt;
      this.highHold = 0;
    } else if (avgFps > UPGRADE_FPS) {
      this.highHold += dt;
      this.lowHold = 0;
    } else {
      this.lowHold = 0;
      this.highHold = 0;
    }

    if (this.cooldown > 0) return false;

    // Sustained GPU pressure: step down resolution ladder first if GPU-bound, then drop tier
    if (this.lowHold >= DOWNGRADE_HOLD) {
      this.lowHold = 0;
      this.cooldown = CHANGE_COOLDOWN;

      // If GPU bound and resolution ladder has room, lower resolution scale first
      if (
        this.detectedBottleneck === 'GPU' &&
        this.autoResolutionIndex < RESOLUTION_LADDER.length - 1
      ) {
        this.autoResolutionIndex++;
        return true;
      }

      // Otherwise drop quality tier
      if (QUALITY_ORDER[this.autoTier] > 0) {
        if (this.autoTier === 'ULTRA') this.autoTier = 'HIGH';
        else if (this.autoTier === 'HIGH') this.autoTier = 'MEDIUM';
        else this.autoTier = 'LOW';
        return true;
      }

      // If already at lowest tier, ensure lowest resolution ladder
      if (this.autoResolutionIndex < RESOLUTION_LADDER.length - 1) {
        this.autoResolutionIndex++;
        return true;
      }
      return false;
    }

    // Sustained high FPS: carefully climb resolution, then tier if headroom allows
    if (this.highHold >= UPGRADE_HOLD) {
      this.highHold = 0;
      this.cooldown = CHANGE_COOLDOWN;

      // First restore resolution scale
      if (this.autoResolutionIndex > 0) {
        this.autoResolutionIndex--;
        return true;
      }

      // Then restore quality tier up to device ceiling
      if (QUALITY_ORDER[this.autoTier] < QUALITY_ORDER[this.deviceCeiling]) {
        if (this.autoTier === 'LOW') this.autoTier = 'MEDIUM';
        else if (this.autoTier === 'MEDIUM') this.autoTier = 'HIGH';
        else if (this.autoTier === 'HIGH' && this.deviceCeiling === 'ULTRA') {
          this.autoTier = 'ULTRA';
        }
        return true;
      }
      return false;
    }

    return false;
  }

  /**
   * Backward-compatible update method.
   */
  public update(dt: number, avgFps: number, enabled: boolean): GraphicsQuality | null {
    const changed = this.updateAdvanced(dt, avgFps, avgFps > 0 ? 1000 / avgFps : 16.6, 1.5, enabled);
    return changed ? this.autoTier : null;
  }

  /** Human-readable tier name for the performance panel. */
  public label(preference: QualityPreference): string {
    const tier = this.getTier(preference);
    const name = tier.charAt(0) + tier.slice(1).toLowerCase();
    const res = Math.round(this.getDynamicResolutionScale() * 100);
    return preference === 'AUTO' ? `${name} (${res}%)` : name;
  }
}

function minEffect(a: EffectQuality, b: EffectQuality): EffectQuality {
  return EFFECT_ORDER[a] <= EFFECT_ORDER[b] ? a : b;
}

function minShadow(a: ShadowQuality, b: ShadowQuality): ShadowQuality {
  return SHADOW_ORDER[a] <= SHADOW_ORDER[b] ? a : b;
}

function resolveScale(preference: ResolutionPreference, fallback: number): number {
  if (preference === '100') return 1.0;
  if (preference === '90') return 0.9;
  if (preference === '80') return 0.8;
  if (preference === '75') return 0.75;
  if (preference === '67') return 0.67;
  return fallback;
}
