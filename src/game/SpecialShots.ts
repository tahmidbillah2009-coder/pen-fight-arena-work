import {
  GRAVITY_Y,
  MAX_LAUNCH_SPEED,
  PenPhysicsSpec,
  PenSpecialShotId,
  SpecialShotPhysicsParams,
} from '../utils/Constants';
import { PassiveAbilitySystem } from './Abilities';
import { AbilityHudState, PlayerId } from './GameState';
import { PhysicsManager } from './PhysicsManager';

/**
 * SPECIAL SHOT SYSTEM
 * -------------------
 * Every pen owns exactly one Active ability: a Special Shot. A Special Shot is not "more power" —
 * it is a short, parameterised *physics program* written onto the pen's real Rapier rigid body
 * every substep. All of the numbers live in `PenCatalog.PEN_SPECS[id].specialShot.physics`, so a
 * shot can be re-tuned without touching any gameplay or UI code.
 *
 * The exact same program is replayed inside the isolated prediction world for the trajectory
 * preview (`createPredictionProgram`), which guarantees that what the player sees is precisely
 * what the rigid body will do. No body is ever teleported and no velocity is ever set beyond the
 * shot's own configured ceiling — momentum, mass, center of mass, inertia, friction, restitution,
 * collision detection and the out-of-bounds rules all stay in force.
 */

/** Minimal structural view of a Rapier rigid body — lets one program drive live + prediction worlds. */
export interface ShotBodyLike {
  resetForces(wakeUp: boolean): void;
  resetTorques(wakeUp: boolean): void;
  addForce(force: { x: number; y: number; z: number }, wakeUp: boolean): void;
  addTorque(torque: { x: number; y: number; z: number }, wakeUp: boolean): void;
  applyImpulse(impulse: { x: number; y: number; z: number }, wakeUp: boolean): void;
  angvel(): { x: number; y: number; z: number };
  setAngvel(vel: { x: number; y: number; z: number }, wakeUp: boolean): void;
  linvel(): { x: number; y: number; z: number };
  setLinvel(vel: { x: number; y: number; z: number }, wakeUp: boolean): void;
  setLinearDamping(damping: number): void;
  setAngularDamping(damping: number): void;
  mass(): number;
}

/** Everything the shot program needs, resolved once when the shot begins. */
export interface ShotProgramContext {
  params: SpecialShotPhysicsParams;
  durationSeconds: number;
  dirX: number;
  dirZ: number;
  perpX: number;
  perpZ: number;
  baseLinearDamping: number;
  baseAngularDamping: number;
  gravityY: number;
  accelScale: number;
}

const SPEED_MIN = 1e-4;

/**
 * Writes one substep of a Special Shot onto a rigid body. Used verbatim by the live system and by
 * the trajectory preview, so a shot can never behave differently from its prediction.
 */
export function applyShotProgram(
  body: ShotBodyLike,
  ctx: ShotProgramContext,
  elapsed: number,
  dt: number
): void {
  const p = ctx.params;
  body.resetForces(true);
  body.resetTorques(true);

  const remaining = ctx.durationSeconds - elapsed;
  const ramp = p.rampSeconds > 0 ? Math.min(1, Math.max(0, elapsed) / p.rampSeconds) : 1;
  const release = p.stabilizeSeconds > 0 ? Math.min(1, Math.max(0, remaining) / p.stabilizeSeconds) : 1;
  const gate = Math.max(0, Math.min(ramp, release));

  const isFirstFrame = elapsed <= dt * 0.5;

  if (isFirstFrame) {
    // Controlled launch kick — an impulse scaled off the pen's own normal maximum shot speed.
    const speed = MAX_LAUNCH_SPEED * p.initialSpeedScale * ctx.accelScale;
    if (speed > SPEED_MIN) {
      const impulse = speed * body.mass();
      body.applyImpulse(
        { x: ctx.dirX * impulse, y: impulse * 0.04, z: ctx.dirZ * impulse },
        true
      );
    }
    // Dedicated spin budget for vortex-style shots.
    if (p.spinAngularSpeed !== 0) {
      const av = body.angvel();
      body.setAngvel({ x: av.x, y: p.spinAngularSpeed, z: av.z }, true);
    }
    // Shot-local damping envelope (restored to the passive baseline when the shot ends).
    body.setLinearDamping(ctx.baseLinearDamping + p.linearDamping);
    body.setAngularDamping(ctx.baseAngularDamping + p.angularDamping);
  }

  if (isFirstFrame || (remaining <= p.stabilizeSeconds && p.stabilizeSeconds > 0)) {
    // Tail-end damping: bleeds any built-up spin off so nothing can spin forever.
    const tailBoost = remaining <= p.stabilizeSeconds ? 4 : 1;
    body.setAngularDamping(ctx.baseAngularDamping + p.angularDamping * tailBoost);
  }

  if (gate > 0) {
    const forward = p.forwardForce * gate;
    if (forward !== 0) {
      body.addForce({ x: ctx.dirX * forward, y: 0, z: ctx.dirZ * forward }, true);
    }
    if (p.lateralForce !== 0) {
      const lateral = p.lateralForce * gate;
      body.addForce({ x: ctx.perpX * lateral, y: 0, z: ctx.perpZ * lateral }, true);
    }
    if (p.torque !== 0) {
      body.addTorque({ x: 0, y: p.torque * gate, z: 0 }, true);
    }
    if (p.liftRatio > 0) {
      // Counteracts part of gravity so the shot flies flatter instead of nose-diving.
      const lift = -ctx.gravityY * body.mass() * p.liftRatio * gate;
      body.addForce({ x: 0, y: lift, z: 0 }, true);
    }
  }

  // Hard speed ceiling — guarantees no velocity spikes however forces are stacked.
  if (p.speedCeiling > 0) {
    const lv = body.linvel();
    const h = Math.hypot(lv.x, lv.z);
    if (h > p.speedCeiling) {
      const s = p.speedCeiling / h;
      body.setLinvel({ x: lv.x * s, y: Math.min(lv.y, 5.5), z: lv.z * s }, true);
    }
  }

  // Spin safety band — keeps a vortex shot inside a physically sane angular velocity.
  if (p.spinAngularSpeed > 0) {
    const av = body.angvel();
    const spin = Math.hypot(av.x, av.y, av.z);
    const ceiling = p.spinAngularSpeed * 1.3;
    if (spin > ceiling && spin > SPEED_MIN) {
      const s = ceiling / spin;
      body.setAngvel({ x: av.x * s, y: av.y * s, z: av.z * s }, true);
    }
  }
}

interface ActiveShot {
  spec: PenPhysicsSpec;
  ctx: ShotProgramContext;
  elapsed: number;
  pendingKick: boolean;
  shockwaveFired: boolean;
}

/** Authoritative, serialisable shot state — the hook a future multiplayer build replicates. */
export interface SpecialShotNetworkState {
  shotId: PenSpecialShotId;
  dirX: number;
  dirZ: number;
  isActive: boolean;
  activeRemaining: number;
  cooldownRemaining: number;
  usesRemaining: number;
}

export class SpecialShotSystem {
  private readonly physics: PhysicsManager;
  private readonly abilities: PassiveAbilitySystem;
  private readonly getPenSpec: (id: PlayerId) => PenPhysicsSpec;
  private readonly onReady?: (id: PlayerId) => void;

  private readonly active: Record<PlayerId, ActiveShot | null> = { player: null, bot: null };
  private readonly cooldown: Record<PlayerId, number> = { player: 0, bot: 0 };
  private readonly uses: Record<PlayerId, number> = { player: -1, bot: -1 };

  constructor(
    physics: PhysicsManager,
    abilities: PassiveAbilitySystem,
    getPenSpec: (id: PlayerId) => PenPhysicsSpec,
    onReady?: (id: PlayerId) => void
  ) {
    this.physics = physics;
    this.abilities = abilities;
    this.getPenSpec = getPenSpec;
    this.onReady = onReady;
    this.reset();
  }

  /** Fresh match / pen swap: no active windows, no cooldowns, uses refilled. */
  public reset(playerIds?: string[]): void {
    const ids = playerIds && playerIds.length > 0
      ? playerIds
      : Object.keys(this.uses).length > 0
        ? Object.keys(this.uses)
        : ['player', 'bot'];

    for (const id of ids) {
      try {
        const spec = this.getPenSpec(id);
        this.active[id] = null;
        this.cooldown[id] = 0;
        this.uses[id] = spec.specialShot.maxUsesPerMatch;
      } catch {
        // Spec may not yet be registered
      }
    }
  }

  public canActivate(id: PlayerId): boolean {
    if (this.uses[id] === undefined) {
      try {
        const spec = this.getPenSpec(id);
        this.active[id] = null;
        this.cooldown[id] = 0;
        this.uses[id] = spec.specialShot.maxUsesPerMatch;
      } catch {
        return false;
      }
    }
    if (this.active[id]) return false;
    if ((this.cooldown[id] ?? 0) > 0) return false;
    if (this.uses[id] === 0) return false;
    return true;
  }

  public isActive(id: PlayerId): boolean {
    return this.active[id] !== null;
  }

  /** Trail colour for the shot currently running (or null when idle). */
  public getActiveColor(id: PlayerId): number | null {
    const a = this.active[id];
    return a ? a.spec.specialShot.colorHex : null;
  }

  /** Remaining shot duration as a 0..1 envelope — used to fade trails and camera focus. */
  public getActiveProgress(id: PlayerId): number {
    const a = this.active[id];
    if (!a) return 0;
    return Math.max(0, Math.min(1, 1 - a.elapsed / a.spec.specialShot.durationSeconds));
  }

  public activate(id: PlayerId, dirX: number, dirZ: number, accelScale = 1): boolean {
    if (!this.canActivate(id)) return false;
    const length = Math.hypot(dirX, dirZ);
    if (length < 1e-4) return false;
    this.beginShot(id, dirX / length, dirZ / length, 0, accelScale);
    return true;
  }

  private beginShot(
    id: PlayerId,
    dirX: number,
    dirZ: number,
    elapsedPreset: number,
    accelScale: number
  ): void {
    const spec = this.getPenSpec(id);
    const shot = spec.specialShot;
    const baseline = this.abilities.getBaseline(id);

    this.active[id] = {
      spec,
      ctx: {
        params: shot.physics,
        durationSeconds: shot.durationSeconds,
        dirX,
        dirZ,
        perpX: -dirZ,
        perpZ: dirX,
        baseLinearDamping: baseline.linearDamping,
        baseAngularDamping: baseline.angularDamping,
        gravityY: GRAVITY_Y,
        accelScale,
      },
      elapsed: elapsedPreset,
      pendingKick: elapsedPreset <= 0,
      shockwaveFired: false,
    };

    // Suspend the passive angular ceiling and give the shot its own virtual mass budget.
    this.abilities.setSpecialShotActive(id, true);
    if (shot.physics.addedMass > 0) {
      this.physics.setAdditionalMass(id, baseline.extraMass + shot.physics.addedMass);
    }

    this.cooldown[id] = shot.cooldownSeconds;
    if (this.uses[id] > 0) this.uses[id] -= 1;
  }

  /** Advances cooldowns and raises the cooldown-ready notification. Runs once per rendered frame. */
  public update(dt: number): void {
    for (const id of Object.keys(this.cooldown)) {
      if (this.cooldown[id] > 0) {
        const before = this.cooldown[id];
        this.cooldown[id] = Math.max(0, before - dt);
        if (this.cooldown[id] === 0 && before > 0) {
          this.onReady?.(id);
        }
      }
    }
  }

  /** Physics-substep hook — advances and writes the live shot program. */
  public onSubstep(dt: number): void {
    for (const id of Object.keys(this.active)) {
      const a = this.active[id];
      if (!a) continue;

      a.elapsed += dt;
      if (a.elapsed > a.spec.specialShot.durationSeconds) {
        this.endShot(id);
        continue;
      }

      const body = this.physics.getBody(id);
      if (a.pendingKick) {
        // Run the first frame at elapsed = 0 so the initial kick lands exactly once.
        applyShotProgram(body, a.ctx, 0, dt);
        a.pendingKick = false;
      } else {
        applyShotProgram(body, a.ctx, a.elapsed, dt);
      }
    }
  }

  private endShot(id: PlayerId): void {
    if (!this.active[id]) return;
    this.active[id] = null;
    this.physics.clearForces(id);
    // Restores damping, cap friction and virtual mass to the pen's passive baseline.
    this.abilities.setSpecialShotActive(id, false);
  }

  /**
   * Fired on every pen-to-pen impact. A SHOCKWAVE-style shot releases exactly one limited radial
   * impulse on its first heavy contact — graded by distance, never repeatable in the same shot.
   * Returns true when a pulse was actually released so the caller can play its visual feedback.
   */
  public onImpact(attackerId: PlayerId, point: { x: number; y: number; z: number }, impactSpeed: number): boolean {
    const a = this.active[attackerId];
    if (!a) return false;
    const p = a.spec.specialShot.physics;
    if (a.shockwaveFired || p.radialImpulse <= 0 || p.radialRadius <= 0) return false;
    if (impactSpeed < 1.8) return false;

    a.shockwaveFired = true;
    this.physics.applyRadialImpulse(point, p.radialImpulse, p.radialRadius, p.radialFalloff, attackerId);
    return true;
  }

  /** Radius/colour of the active shot's radial pulse, for the visual effect. */
  public getShockwaveStyle(id: PlayerId): { radius: number; colorHex: number } | null {
    const a = this.active[id];
    if (!a || a.spec.specialShot.physics.radialRadius <= 0) return null;
    return { radius: a.spec.specialShot.physics.radialRadius, colorHex: a.spec.specialShot.colorHex };
  }

  /** The exact program to replay in the prediction world for the trajectory preview. */
  public createPredictionProgram(
    id: PlayerId,
    dirX: number,
    dirZ: number
  ): (body: ShotBodyLike, elapsed: number, dt: number) => void {
    const spec = this.getPenSpec(id);
    const shot = spec.specialShot;
    const baseline = this.abilities.getBaseline(id);
    const length = Math.hypot(dirX, dirZ) || 1;
    const dx = dirX / length;
    const dz = dirZ / length;
    const ctx: ShotProgramContext = {
      params: shot.physics,
      durationSeconds: shot.durationSeconds,
      dirX: dx,
      dirZ: dz,
      perpX: -dz,
      perpZ: dx,
      baseLinearDamping: baseline.linearDamping,
      baseAngularDamping: baseline.angularDamping,
      gravityY: GRAVITY_Y,
      accelScale: this.abilities.getAccelerationScale(id),
    };
    return (body, elapsed, dt) => applyShotProgram(body, ctx, elapsed, dt);
  }

  /** Live HUD state for a pen's Special Shot (passive identity included for the badge). */
  public getHudState(id: PlayerId, canActivate: boolean): AbilityHudState {
    const spec = this.getPenSpec(id);
    const shot = spec.specialShot;
    const a = this.active[id];
    return {
      abilityId: spec.passive.id,
      passiveName: spec.passive.name,
      passiveSummary: spec.passive.summary,
      name: shot.name,
      specialShotId: shot.id,
      icon: shot.icon,
      colorHex: shot.colorHex,
      isActive: a !== null,
      activeRemaining: a ? Math.max(0, shot.durationSeconds - a.elapsed) : 0,
      activeTotal: shot.durationSeconds,
      cooldownRemaining: this.cooldown[id],
      cooldownTotal: shot.cooldownSeconds,
      usesRemaining: this.uses[id],
      maxUsesPerMatch: shot.maxUsesPerMatch,
      canActivate,
      // Overwritten by the AbilitySystem facade with the real armed state.
      armed: false,
    };
  }

  public getNetworkState(id: PlayerId): SpecialShotNetworkState {
    const shot = this.getPenSpec(id).specialShot;
    const a = this.active[id];
    return {
      shotId: shot.id,
      dirX: a?.ctx.dirX ?? 0,
      dirZ: a?.ctx.dirZ ?? 0,
      isActive: a !== null,
      activeRemaining: a ? Math.max(0, shot.durationSeconds - a.elapsed) : 0,
      cooldownRemaining: this.cooldown[id],
      usesRemaining: this.uses[id],
    };
  }

  /**
   * Applies an authoritative shot window from a remote peer. Cooldowns and use limits are adopted
   * verbatim; an active window is replayed locally with the very same program and direction so the
   * local physics resolves identically to the sender's.
   */
  public applyNetworkState(id: PlayerId, state: SpecialShotNetworkState): void {
    const shot = this.getPenSpec(id).specialShot;
    if (state.shotId !== shot.id) return;
    this.cooldown[id] = Math.max(0, state.cooldownRemaining);
    this.uses[id] = state.usesRemaining;

    if (state.isActive) {
      const baseline = this.abilities.getBaseline(id);
      this.beginShot(
        id,
        state.dirX,
        state.dirZ,
        Math.max(0, shot.durationSeconds - state.activeRemaining),
        this.abilities.getAccelerationScale(id)
      );
      // A remote window is mid-flight: never replay its initial kick locally.
      const a = this.active[id];
      if (a) {
        a.pendingKick = false;
        a.ctx.baseLinearDamping = baseline.linearDamping;
      }
    } else if (this.active[id]) {
      this.endShot(id);
    }
  }
}
