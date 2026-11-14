import { PEN_SPECS, PenAbilityId, PenTypeId } from '../utils/Constants';
import { AbilityHudState, PlayerId } from './GameState';
import { PhysicsManager } from './PhysicsManager';
import { ShotBodyLike, SpecialShotNetworkState, SpecialShotSystem } from './SpecialShots';

/**
 * PASSIVE ABILITY SYSTEM
 * ----------------------
 * Every pen owns an always-on passive ability (see `PenCatalog.PEN_SPECS[id].passive`). There is
 * nothing to activate and nothing to time: the instant a pen is equipped its tuning is written
 * straight onto the REAL Rapier rigid body and its colliders, and it stays applied for as long as
 * that pen is in play.
 *
 * A passive is only ever a bounded physical modulation — a multiplier on existing damping, a
 * collider friction bonus, a small virtual mass, a velocity ceiling or a pointer-filter strength.
 * No passive teleports a pen, resets a velocity, adds free damage or bypasses the collision and
 * turn rules. That keeps every pen honest while still giving each one a genuinely different feel.
 */

/** The passive-adjusted physical values a pen currently runs with (also consumed by SpecialShots). */
export interface PassiveBaseline {
  linearDamping: number;
  angularDamping: number;
  /** Virtual mass (kg) added on top of the collider mass — real collision momentum. */
  extraMass: number;
  capFrictionScale: number;
}

/** Passive status surfaced to the HUD badge / selector. */
export interface PassiveHudState {
  passiveId: PenAbilityId;
  name: string;
  summary: string;
  detail: string;
}

const MIN_ROT_RESPONSE = 0.4;
const MAX_ROT_RESPONSE = 1.6;
const KNOCKBACK_MIN_SPEED = 1.2;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export class PassiveAbilitySystem {
  private readonly physics: PhysicsManager;
  private readonly getPenType: (id: PlayerId) => PenTypeId;

  private readonly baselines: Record<PlayerId, PassiveBaseline> = {
    player: { linearDamping: 0.86, angularDamping: 2.05, extraMass: 0, capFrictionScale: 1 },
    bot: { linearDamping: 0.86, angularDamping: 2.05, extraMass: 0, capFrictionScale: 1 },
  };
  /**
   * While a pen is executing a Special Shot the shot owns its own spin budget, so the passive
   * angular-speed ceiling is suspended for that pen and re-applied the moment the shot ends.
   */
  private readonly shotActive: Record<PlayerId, boolean> = { player: false, bot: false };

  constructor(physics: PhysicsManager, getPenType: (id: PlayerId) => PenTypeId) {
    this.physics = physics;
    this.getPenType = getPenType;
    this.reset();
  }

  /** Applies every equipable pen's passive to its live rigid body (fresh match / pen swap). */
  public reset(playerIds?: string[]): void {
    const ids = playerIds && playerIds.length > 0
      ? playerIds
      : Object.keys(this.baselines).length > 0
        ? Object.keys(this.baselines)
        : ['player', 'bot'];

    if (playerIds && playerIds.length > 0) {
      for (const k of Object.keys(this.baselines)) {
        delete this.baselines[k];
      }
      for (const k of Object.keys(this.shotActive)) {
        delete this.shotActive[k];
      }
    }

    for (const id of ids) {
      this.shotActive[id] = false;
      try {
        this.apply(id);
      } catch {
        // Pen may not yet be configured in physics
      }
    }
  }

  /** Recomputes and writes the passive tuning for one pen onto its real physics body. */
  public apply(id: PlayerId): void {
    const spec = PEN_SPECS[this.getPenType(id)];
    const t = spec.passive.tuning;
    const rotResponse = clamp(t.rotationalResponseScale, MIN_ROT_RESPONSE, MAX_ROT_RESPONSE);

    // Damping: linear scale is literal; rotational response <1 means "heavier, slower to turn".
    const linearDamping = spec.linearDamping * t.linearDampingScale;
    const angularDamping = (spec.angularDamping * t.angularDampingScale) / rotResponse;

    // Rear-cap grip: the cap collider gains friction proportional to this pen's cap retention.
    const capFrictionScale = 1 + t.capFrictionBonus * spec.cap.retention;

    // Heavy Impact carries real virtual mass, so collisions transfer honest momentum.
    const extraMass = Math.max(0, spec.mass * (t.impactMomentumScale - 1));

    this.baselines[id] = { linearDamping, angularDamping, extraMass, capFrictionScale };

    this.physics.setPenDamping(id, linearDamping, angularDamping);
    this.physics.setCapFrictionScale(id, capFrictionScale);
    this.physics.setAdditionalMass(id, extraMass);
  }

  public getBaseline(id: PlayerId): PassiveBaseline {
    return this.baselines[id];
  }

  /** Lets the Special Shot system suspend this pen's passive angular ceiling while a shot runs. */
  public setSpecialShotActive(id: PlayerId, active: boolean): void {
    this.shotActive[id] = active;
    if (!active) {
      // Restore the passive-tuned body once the shot hands control back.
      this.apply(id);
    }
  }

  /**
   * Continuous part of every passive — runs each physics substep. Only SPIN CONTROL does work
   * here: it keeps angular velocity inside a sane band so deliberate spin survives while runaway
   * tumble is capped.
   */
  public onSubstep(): void {
    for (const id of Object.keys(this.baselines)) {
      if (this.shotActive[id]) continue;
      try {
        const spec = PEN_SPECS[this.getPenType(id)];
        if (!spec) continue;
        const ceiling = spec.passive.tuning.angularSpeedCeiling;
        if (ceiling > 0) {
          this.physics.clampAngularVelocity(id, ceiling);
        }
      } catch {
        // Spec or body not present
      }
    }
  }

  /**
   * Impact hook for knock-back resistance. The defender's post-impact velocity is scaled by a
   * bounded factor (IMPACT_GUARD removes knock-back, QUICK RECOVERY takes slightly more). The
   * impact direction and momentum transfer remain physically honest — no extra damage is dealt.
   */
  public onImpact(defender: PlayerId, impactSpeed: number): void {
    if (impactSpeed < KNOCKBACK_MIN_SPEED) return;
    const resistance = PEN_SPECS[this.getPenType(defender)].passive.tuning.knockbackResistance;
    if (resistance === 0) return;
    const factor = clamp(1 - resistance, 0.4, 1.4);
    this.physics.scaleLinearVelocity(defender, factor);
  }

  /** Pointer steadying strength the owner's drag input should use (0 = raw). */
  public getSteadying(id: PlayerId): number {
    return clamp(PEN_SPECS[this.getPenType(id)].passive.tuning.inputSteadying, 0, 1);
  }

  /** True while a pen has a meaningful steadying passive (used to widen the aim preview). */
  public isPrecisionActive(id: PlayerId): boolean {
    return this.getSteadying(id) > 0.01;
  }

  /** Multiplier on the launch impulse this pen receives — the pen's acceleration. */
  public getAccelerationScale(id: PlayerId): number {
    return clamp(PEN_SPECS[this.getPenType(id)].passive.tuning.accelerationScale, 0.5, 1.5);
  }

  public getState(id: PlayerId): PassiveHudState {
    const passive = PEN_SPECS[this.getPenType(id)].passive;
    return {
      passiveId: passive.id,
      name: passive.name,
      summary: passive.summary,
      detail: passive.detail,
    };
  }
}

/** Extra gates / notifications the host game wires into the unified ability system. */
export interface AbilitySystemOptions {
  /** Master gate — the host decides whether this pen is even allowed to act right now. */
  canActivate?: (id: PlayerId) => boolean;
  /** Raised the moment a Special Shot actually starts (both live and replicated paths). */
  onActivate?: (id: PlayerId) => void;
  /** Raised the instant a cooldown finishes so the HUD can chime "ready". */
  onReady?: (id: PlayerId) => void;
}

/**
 * UNIFIED ABILITY SYSTEM
 * ----------------------
 * One facade over the two halves of a pen's kit — the always-on PASSIVE (`PassiveAbilitySystem`)
 * and the player-triggered ACTIVE Special Shot (`SpecialShotSystem`) — plus the small amount of
 * state only the host game cares about:
 *
 *  - `canActivate` merges the host's turn/state gate with the shot's own cooldown & use budget.
 *  - `armed` models the HUD flow: pressing the Special Shot button primes the shot and turns the
 *    aim preview into the shot's real physics path; the pen then fires it on drag-release (or on
 *    a second press), so a special shot is always aimed by the player and never auto-targeted.
 *
 * All tuning still lives in `PenCatalog.PEN_SPECS`, so nothing here needs editing to re-balance a
 * pen, and no gameplay/UI code has to know how a shot is actually simulated.
 */
export class AbilitySystem {
  public readonly passive: PassiveAbilitySystem;
  public readonly shots: SpecialShotSystem;

  private readonly physics: PhysicsManager;
  private readonly options: AbilitySystemOptions;
  private armed: Record<PlayerId, boolean> = { player: false, bot: false };

  constructor(
    physics: PhysicsManager,
    getPenType: (id: PlayerId) => PenTypeId,
    options: AbilitySystemOptions = {}
  ) {
    this.physics = physics;
    this.options = options;
    this.passive = new PassiveAbilitySystem(physics, getPenType);
    this.shots = new SpecialShotSystem(
      physics,
      this.passive,
      (id) => PEN_SPECS[getPenType(id)],
      (id) => this.options.onReady?.(id)
    );
  }

  /** Fresh match / pen swap: clears armed state, active windows, cooldowns and use budgets. */
  public reset(playerIds?: string[]): void {
    this.armed = {};
    const ids = playerIds && playerIds.length > 0 ? playerIds : ['player', 'bot'];
    for (const id of ids) {
      this.armed[id] = false;
    }
    this.passive.reset(ids);
    this.shots.reset(ids);
  }

  /** Re-writes a pen's passive tuning onto its (possibly rebuilt) rigid body — used after a pen swap. */
  public applyPassive(id: PlayerId): void {
    this.passive.apply(id);
  }

  /** Turn/state gate merged with the shot's cooldown & use budget. */
  public canActivate(id: PlayerId): boolean {
    if (this.options.canActivate && !this.options.canActivate(id)) return false;
    return this.shots.canActivate(id);
  }

  public isArmed(id: PlayerId): boolean {
    return Boolean(this.armed[id]);
  }

  /** Primes the Special Shot so the aim preview shows its physics path. No-op when unavailable. */
  public arm(id: PlayerId): boolean {
    if (this.armed[id] || !this.canActivate(id)) return false;
    this.armed[id] = true;
    return true;
  }

  public disarm(id: PlayerId): void {
    this.armed[id] = false;
  }

  public isActive(id: PlayerId): boolean {
    return this.shots.isActive(id);
  }

  public getActiveColor(id: PlayerId): number | null {
    return this.shots.getActiveColor(id);
  }

  public getActiveProgress(id: PlayerId): number {
    return this.shots.getActiveProgress(id);
  }

  public getShockwaveStyle(id: PlayerId): { radius: number; colorHex: number } | null {
    return this.shots.getShockwaveStyle(id);
  }

  /**
   * Fires the pen's Special Shot. `dirX/dirZ` is the aimed launch direction; when omitted the
   * pen's own forward (nose) heading is used, so an ability can never be fired without a real
   * orientation. Returns true only when the shot genuinely started.
   */
  public activate(id: PlayerId, dirX?: number, dirZ?: number, accelScale = 1): boolean {
    const dir = this.resolveDirection(id, dirX, dirZ);
    if (!dir || !this.canActivate(id)) return false;
    const started = this.shots.activate(id, dir.x, dir.z, accelScale);
    if (!started) return false;
    this.armed[id] = false;
    this.options.onActivate?.(id);
    return true;
  }

  private resolveDirection(
    id: PlayerId,
    dirX?: number,
    dirZ?: number
  ): { x: number; z: number } | null {
    if (typeof dirX === 'number' && typeof dirZ === 'number') {
      const len = Math.hypot(dirX, dirZ);
      if (len > 1e-4) return { x: dirX / len, z: dirZ / len };
    }
    const forward = this.physics.getForwardAxis(id);
    const fallbackLen = Math.hypot(forward.x, forward.z);
    if (fallbackLen < 1e-4) return null;
    return { x: forward.x / fallbackLen, z: forward.z / fallbackLen };
  }

  /** Physics-substep hook — passives first, then the live Special Shot program. */
  public onSubstep(dt: number): void {
    this.passive.onSubstep();
    this.shots.onSubstep(dt);
  }

  /** Per-frame hook — advances cooldowns and raises the "ready" notification. */
  public update(dt: number): void {
    this.shots.update(dt);
  }

  /** Impact hook — passive knock-back resistance, then any Special Shot impact effect. */
  public onImpact(
    id: PlayerId,
    point: { x: number; y: number; z: number },
    impactSpeed: number
  ): boolean {
    this.passive.onImpact(id, impactSpeed);
    return this.shots.onImpact(id, point, impactSpeed);
  }

  public getSteadying(id: PlayerId): number {
    return this.passive.getSteadying(id);
  }

  public isPrecisionActive(id: PlayerId): boolean {
    return this.passive.isPrecisionActive(id);
  }

  public getAccelerationScale(id: PlayerId): number {
    return this.passive.getAccelerationScale(id);
  }

  /** Live HUD state: passive identity + Special Shot cooldown/active/armed status. */
  public getState(id: PlayerId): AbilityHudState {
    const state = this.shots.getHudState(id, this.canActivate(id));
    state.armed = this.armed[id];
    return state;
  }

  /** The exact program to replay in the prediction world for the Special Shot aim preview. */
  public createPredictionProgram(
    id: PlayerId,
    dirX: number,
    dirZ: number
  ): (body: ShotBodyLike, elapsed: number, dt: number) => void {
    return this.shots.createPredictionProgram(id, dirX, dirZ);
  }

  public getNetworkState(id: PlayerId): SpecialShotNetworkState {
    return this.shots.getNetworkState(id);
  }

  /** Replication entry point — adopts an authoritative remote shot window locally. */
  public applyNetworkState(state: SpecialShotNetworkState): void {
    for (const id of ['player', 'bot'] as const) {
      this.shots.applyNetworkState(id, state);
    }
  }
}

