import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import {
  BOT_SPAWN,
  EDGE_DANGER_DISTANCE,
  EDGE_WARNING_DISTANCE,
  FLOOR_Y,
  GRAVITY_Y,
  OOB_MARGIN,
  OOB_Y_THRESHOLD,
  PEN_SPECS,
  PenPhysicsSpec,
  PenTypeId,
  PHYSICS_BALANCE,
  PHYSICS_FIXED_DT,
  PHYSICS_MAX_SUBSTEPS,
  PLAYER_SPAWN,
  TABLE_FRICTION,
  TABLE_HALF_D,
  TABLE_HALF_W,
  TABLE_RESTITUTION,
  TABLE_THICKNESS,
} from '../utils/Constants';
import { CollisionCallbacks, CollisionManager } from './CollisionManager';
import { EdgeDangerLevel, PlayerId } from './GameState';

let rapierReadyPromise: Promise<void> | null = null;

export function ensureRapierInitialized(): Promise<void> {
  if (!rapierReadyPromise) {
    rapierReadyPromise = RAPIER.init();
  }
  return rapierReadyPromise;
}

export interface BodyPose {
  pos: { x: number; y: number; z: number };
  rot: { x: number; y: number; z: number; w: number };
  linvel: { x: number; y: number; z: number };
  angvel: { x: number; y: number; z: number };
}

export interface PredictedTrajectoryPoint {
  x: number;
  y: number;
  z: number;
  speed: number;
  offTable: boolean;
}

export interface TrajectoryPrediction {
  points: PredictedTrajectoryPoint[];
  collisionPoint: { x: number; y: number; z: number } | null;
  landingPoint: { x: number; y: number; z: number; isOffTable: boolean };
  botDeflectEnd: { x: number; y: number; z: number } | null;
}

/**
 * Resting height for a pen lying on its side — set by the largest collider radius, which is
 * the flared rear cap. Keeps spawns from starting embedded in the tabletop.
 */
function penRestY(spec: PenPhysicsSpec): number {
  return Math.max(spec.radius, spec.radius * spec.cap.radiusScale) + 0.005;
}

export class PhysicsManager {
  public readonly world: RAPIER.World;
  public readonly eventQueue: RAPIER.EventQueue;
  public readonly collisions = new CollisionManager();

  private penSpecs: Record<string, PenPhysicsSpec> = {
    player: PEN_SPECS.GRIP_MASTER,
    bot: PEN_SPECS.IRON_FORCE,
  };
  private bodies: Record<string, RAPIER.RigidBody> = {};
  /**
   * Live colliders per pen, in creation order: [mainBarrel, tip, tail, cap].
   * The ability system uses these to modulate real surface response (e.g. cap grip).
   */
  private penColliders: Record<string, RAPIER.Collider[]> = {
    player: [],
    bot: [],
  };
  /** Virtual mass currently added to each live body — mirrored into the prediction world. */
  private additionalMass: Record<string, number> = { player: 0, bot: 0 };
  private penSpawns: Record<string, { x: number; y: number; z: number; yaw: number }> = {
    player: PLAYER_SPAWN,
    bot: BOT_SPAWN,
  };
  private accumulator = 0;

  // Reusable lightweight prediction world (zero WASM heap churn, never mutates live world)
  private readonly predWorld: RAPIER.World;
  private readonly predEventQueue: RAPIER.EventQueue;
  private predBodies: Record<string, RAPIER.RigidBody> = {};
  private predColliderHandles: Record<string, Set<number>> = {
    player: new Set<number>(),
    bot: new Set<number>(),
  };

  /**
   * Scratch world reused by Expert-AI candidate evaluation. Building a whole Rapier world (island
   * manager, broad phase, narrow phase, solver scratch) plus the classroom environment for every
   * one of the ~24 candidate shots was the largest allocation burst of a bot turn. The world and
   * its static colliders are created once; only the two pens are re-seeded per candidate.
   */
  private simWorld: RAPIER.World | null = null;
  private simBodies: Record<PlayerId, RAPIER.RigidBody> | null = null;

  private readonly _prePosP = new THREE.Vector3();
  private readonly _preQuatP = new THREE.Quaternion();
  private readonly _preVelP = new THREE.Vector3();
  private readonly _preAngVelP = new THREE.Vector3();

  private readonly _prePosB = new THREE.Vector3();
  private readonly _preQuatB = new THREE.Quaternion();
  private readonly _preVelB = new THREE.Vector3();
  private readonly _preAngVelB = new THREE.Vector3();

  private readonly _preKinematics: Record<
    string,
    { pos: THREE.Vector3; quat: THREE.Quaternion; vel: THREE.Vector3; angVel: THREE.Vector3 }
  > = {};

  private readonly _quatTmp = new THREE.Quaternion();
  private readonly _axisZTmp = new THREE.Vector3();
  private readonly _vecTmp = new THREE.Vector3();

  constructor(playerPenType: PenTypeId = 'GRIP_MASTER', botPenType: PenTypeId = 'IRON_FORCE') {
    this.penSpecs.player = PEN_SPECS[playerPenType];
    this.penSpecs.bot = PEN_SPECS[botPenType];

    this.world = new RAPIER.World({ x: 0, y: GRAVITY_Y, z: 0 });
    this.world.timestep = PHYSICS_FIXED_DT;
    this.world.numSolverIterations = 8;
    this.eventQueue = new RAPIER.EventQueue(true);

    this.createEnvironmentColliders(this.world, this.collisions);

    this.bodies = {
      player: this.createPenBody(
        this.world,
        'player',
        PLAYER_SPAWN,
        this.penSpecs.player,
        this.collisions,
        undefined,
        this.penColliders.player
      ),
      bot: this.createPenBody(
        this.world,
        'bot',
        BOT_SPAWN,
        this.penSpecs.bot,
        this.collisions,
        undefined,
        this.penColliders.bot
      ),
    };

    // Initialize isolated trajectory prediction world
    this.predWorld = new RAPIER.World({ x: 0, y: GRAVITY_Y, z: 0 });
    this.predWorld.timestep = 1 / 60;
    this.predWorld.numSolverIterations = 6;
    this.predEventQueue = new RAPIER.EventQueue(true);

    this.createEnvironmentColliders(this.predWorld);
    this.predBodies = {
      player: this.createPenBody(
        this.predWorld,
        'player',
        PLAYER_SPAWN,
        this.penSpecs.player,
        undefined,
        this.predColliderHandles.player
      ),
      bot: this.createPenBody(
        this.predWorld,
        'bot',
        BOT_SPAWN,
        this.penSpecs.bot,
        undefined,
        this.predColliderHandles.bot
      ),
    };
  }

  /**
   * Reconfigures the simulation to field an arbitrary set of pens (1v1, 2v2, 3v3, 1v2, 2v3, Practice).
   * Replaces existing bodies without recreating the world or environment colliders.
   */
  public configurePens(
    pens: Array<{ id: string; penType: PenTypeId; spawn: { x: number; y: number; z: number; yaw: number } }>
  ): void {
    // 1. Remove all old dynamic pen bodies
    for (const [id, body] of Object.entries(this.bodies)) {
      this.collisions.unregisterSurface(id);
      this.world.removeRigidBody(body);
    }
    for (const [, predBody] of Object.entries(this.predBodies)) {
      this.predWorld.removeRigidBody(predBody);
    }
    this.bodies = {};
    this.penSpecs = {};
    this.penColliders = {};
    this.additionalMass = {};
    this.predBodies = {};
    this.predColliderHandles = {};
    this.penSpawns = {};

    // 2. Spawn each configured pen
    for (const p of pens) {
      const spec = PEN_SPECS[p.penType];
      this.penSpecs[p.id] = spec;
      this.additionalMass[p.id] = 0;
      this.penColliders[p.id] = [];
      this.predColliderHandles[p.id] = new Set<number>();
      this.penSpawns[p.id] = { ...p.spawn };

      this.bodies[p.id] = this.createPenBody(
        this.world,
        p.id,
        p.spawn,
        spec,
        this.collisions,
        undefined,
        this.penColliders[p.id]
      );

      this.predBodies[p.id] = this.createPenBody(
        this.predWorld,
        p.id,
        p.spawn,
        spec,
        undefined,
        this.predColliderHandles[p.id]
      );
    }
    this.accumulator = 0;
  }

  public getPenSpec(id: PlayerId): PenPhysicsSpec {
    return this.penSpecs[id];
  }

  public setPenType(id: PlayerId, penType: PenTypeId): void {
    const nextSpec = PEN_SPECS[penType];
    const oldLive = this.bodies[id];
    if (!oldLive || !this.penSpecs[id]) return;
    if (this.penSpecs[id].id === nextSpec.id) return;
    this.penSpecs[id] = nextSpec;

    const t = oldLive.translation();
    const r = oldLive.rotation();
    this.collisions.unregisterSurface(id);
    this.world.removeRigidBody(oldLive);

    const spawn = {
      x: t.x,
      y: Math.max(nextSpec.radius + 0.005, t.y),
      z: t.z,
      yaw: 0,
    };
    const newLive = this.createPenBody(
      this.world,
      id,
      spawn,
      nextSpec,
      this.collisions,
      undefined,
      this.penColliders[id]
    );
    newLive.setRotation(r, true);
    this.bodies[id] = newLive;

    // Mirror spec in prediction world
    const oldPred = this.predBodies[id];
    this.predColliderHandles[id].clear();
    this.predWorld.removeRigidBody(oldPred);
    const newPred = this.createPenBody(
      this.predWorld,
      id,
      spawn,
      nextSpec,
      undefined,
      this.predColliderHandles[id]
    );
    newPred.setRotation(r, true);
    this.predBodies[id] = newPred;

    // Mirror spec in the Expert-AI candidate world so bot evaluation keeps using the real pens.
    if (this.simWorld && this.simBodies) {
      this.simWorld.removeRigidBody(this.simBodies[id]);
      this.simBodies[id] = this.createPenBody(this.simWorld, id, spawn, nextSpec);
    }
  }

  private createEnvironmentColliders(
    world: RAPIER.World,
    collisions?: CollisionManager
  ): void {
    // Tabletop collider: top face is strictly at Y = 0.0
    const tableBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -TABLE_THICKNESS * 0.5, 0)
    );
    const tableDesc = RAPIER.ColliderDesc.cuboid(TABLE_HALF_W, TABLE_THICKNESS * 0.5, TABLE_HALF_D)
      .setFriction(TABLE_FRICTION)
      .setRestitution(TABLE_RESTITUTION);
    const tableCol = world.createCollider(tableDesc, tableBody);
    collisions?.registerCollider(tableCol.handle, 'table');

    // Classroom floor collider so knocked-off pens clatter realistically on the floor
    const floorBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, FLOOR_Y - 0.25, 0)
    );
    const floorDesc = RAPIER.ColliderDesc.cuboid(45, 0.25, 45)
      .setFriction(0.6)
      .setRestitution(0.15);
    const floorCol = world.createCollider(floorDesc, floorBody);
    collisions?.registerCollider(floorCol.handle, 'floor');
  }

  private createPenBody(
    world: RAPIER.World,
    id: PlayerId,
    spawn: { x: number; y: number; z: number; yaw: number },
    spec: PenPhysicsSpec,
    collisions?: CollisionManager,
    handleSet?: Set<number>,
    colliderSink?: RAPIER.Collider[]
  ): RAPIER.RigidBody {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spawn.yaw);
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, Math.max(penRestY(spec), spawn.y), spawn.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinearDamping(spec.linearDamping)
      .setAngularDamping(spec.angularDamping)
      .setCcdEnabled(true)
      .setCanSleep(true);

    const body = world.createRigidBody(bodyDesc);

    // Rotate capsule from default Y-axis to Z-axis to match PenModel
    const capsuleRot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      Math.PI * 0.5
    );

    const halfLen = spec.length * 0.5;
    const capsuleHalfSeg = Math.max(0.45, halfLen - 0.42);
    const tipZ = halfLen - 0.12;
    const tailZ = -(halfLen - 0.18);

    const mainColDesc = RAPIER.ColliderDesc.capsule(capsuleHalfSeg, spec.radius)
      .setRotation({ x: capsuleRot.x, y: capsuleRot.y, z: capsuleRot.z, w: capsuleRot.w })
      .setFriction(spec.friction)
      .setRestitution(spec.restitution)
      .setMass(spec.massSplit.body)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    const tipColDesc = RAPIER.ColliderDesc.ball(spec.radius * 0.47)
      .setTranslation(0, 0, tipZ)
      .setFriction(spec.friction)
      .setRestitution(spec.restitution)
      .setMass(spec.massSplit.tip)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    const tailColDesc = RAPIER.ColliderDesc.ball(spec.radius * 0.76)
      .setTranslation(0, 0, tailZ)
      .setFriction(spec.friction)
      .setRestitution(spec.restitution)
      .setMass(spec.massSplit.tail)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    // Removable rear cap: a flared capsule shell hugging the very rear of the pen.
    // Its geometry (radius / length / center) is derived from the same spec.cap ratios the
    // visual mesh uses, and its mass feeds the shared rigid body so the cap weighs into the
    // pen's center of mass and rotational inertia like any other physical part.
    const capRadius = spec.radius * spec.cap.radiusScale;
    const capLen = spec.length * spec.cap.lengthRatio;
    const capCenterZ = spec.length * spec.cap.centerZRatio;
    const capHalfSeg = Math.max(0.02, capLen * 0.5 - capRadius);

    const capColDesc = RAPIER.ColliderDesc.capsule(capHalfSeg, capRadius)
      .setRotation({ x: capsuleRot.x, y: capsuleRot.y, z: capsuleRot.z, w: capsuleRot.w })
      .setTranslation(0, 0, capCenterZ)
      .setFriction(spec.friction * spec.cap.frictionScale)
      .setRestitution(spec.restitution * spec.cap.restitutionScale)
      .setMass(spec.massSplit.cap)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    const c1 = world.createCollider(mainColDesc, body);
    const c2 = world.createCollider(tipColDesc, body);
    const c3 = world.createCollider(tailColDesc, body);
    const c4 = world.createCollider(capColDesc, body);

    if (colliderSink) {
      colliderSink.length = 0;
      colliderSink.push(c1, c2, c3, c4);
    }

    if (collisions) {
      collisions.registerCollider(c1.handle, id);
      collisions.registerCollider(c2.handle, id);
      collisions.registerCollider(c3.handle, id);
      collisions.registerCollider(c4.handle, id);
    }
    if (handleSet) {
      handleSet.add(c1.handle);
      handleSet.add(c2.handle);
      handleSet.add(c3.handle);
      handleSet.add(c4.handle);
    }

    return body;
  }

  public getBody(id: PlayerId): RAPIER.RigidBody {
    return this.bodies[id];
  }

  // ---------------------------------------------------------------------------------------
  // Ability hooks — the ability system modulates the pen's REAL Rapier body & colliders
  // through these methods, so abilities change genuine physics rather than stats alone.
  // ---------------------------------------------------------------------------------------

  /** Index 3 is the rear-cap collider (creation order: barrel, tip, tail, cap). */
  public setCapFrictionScale(id: PlayerId, scale: number): void {
    const colList = this.penColliders[id];
    if (!colList) return;
    const cap = colList[3];
    if (!cap) return;
    const spec = this.penSpecs[id];
    if (!spec) return;
    cap.setFriction(spec.friction * spec.cap.frictionScale * scale);
  }

  /** Overrides the pen's linear/angular damping (restored from the spec when the effect ends). */
  public setPenDamping(id: PlayerId, linearDamping: number, angularDamping: number): void {
    const b = this.bodies[id];
    if (!b) return;
    b.setLinearDamping(linearDamping);
    b.setAngularDamping(angularDamping);
  }

  /** Clamps runaway angular velocity to a sane ceiling without freezing intentional spin. */
  public clampAngularVelocity(id: PlayerId, maxSpeed: number): void {
    const b = this.bodies[id];
    if (!b) return;
    const av = b.angvel();
    const mag = Math.hypot(av.x, av.y, av.z);
    if (mag > maxSpeed && mag > 1e-5) {
      const s = maxSpeed / mag;
      b.setAngvel({ x: av.x * s, y: av.y * s, z: av.z * s }, false);
    }
  }

  /** Scales a pen's current linear velocity by `factor` — used by bounded defensive abilities. */
  public scaleLinearVelocity(id: PlayerId, factor: number): void {
    const b = this.bodies[id];
    if (!b) return;
    const lv = b.linvel();
    b.setLinvel({ x: lv.x * factor, y: lv.y * factor, z: lv.z * factor }, false);
  }

  // ---------------------------------------------------------------------------------------
  // Special Shot physics hooks. A Special Shot is a short "physics program" of real forces,
  // impulses and torques written onto these live rigid bodies every substep. Nothing here
  // teleports a body: mass, center of mass, inertia, friction and restitution are preserved.
  // ---------------------------------------------------------------------------------------

  /** Total live mass of a pen including any passive virtual mass (kg). */
  public getEffectiveMass(id: PlayerId): number {
    return this.bodies[id]?.mass() ?? 0.05;
  }

  /**
   * Adds virtual mass on top of the collider mass. Used by HEAVY IMPACT and by Special Shots
   * that need to carry real momentum — it changes the true collision response, not a stat.
   */
  public setAdditionalMass(id: PlayerId, mass: number): void {
    const clamped = Math.max(0, mass);
    this.additionalMass[id] = clamped;
    const b = this.bodies[id];
    if (b) {
      b.setAdditionalMass(clamped, true);
    }
  }

  /** Applies a continuous world-space force for the current substep. */
  public addForce(id: PlayerId, fx: number, fy: number, fz: number): void {
    const b = this.bodies[id];
    if (b) b.addForce({ x: fx, y: fy, z: fz }, true);
  }

  /** Applies a yaw torque (N·m) for the current substep. */
  public addYawTorque(id: PlayerId, torque: number): void {
    const b = this.bodies[id];
    if (b) b.addTorque({ x: 0, y: torque, z: 0 }, true);
  }

  /** Clears accumulated forces/torques so a shot program writes a clean slate each substep. */
  public clearForces(id: PlayerId): void {
    const b = this.bodies[id];
    if (b) {
      b.resetForces(true);
      b.resetTorques(true);
    }
  }

  /** Replaces the pen's yaw spin (rad/s) while preserving any roll/pitch — VORTEX SPIN kick-off. */
  public setYawAngularVelocity(id: PlayerId, spinY: number): void {
    const b = this.bodies[id];
    if (b) {
      const av = b.angvel();
      b.setAngvel({ x: av.x, y: spinY, z: av.z }, true);
    }
  }

  /** Caps a pen's horizontal speed (m/s) — the hard ceiling that prevents velocity spikes. */
  public clampHorizontalSpeed(id: PlayerId, ceiling: number): void {
    const b = this.bodies[id];
    if (!b) return;
    const lv = b.linvel();
    const h = Math.hypot(lv.x, lv.z);
    if (h > ceiling && h > 1e-5) {
      const s = ceiling / h;
      b.setLinvel({ x: lv.x * s, y: Math.min(lv.y, 5.5), z: lv.z * s }, false);
    }
  }

  /** The pen's forward (local +Z, the writing tip) heading in the XZ plane, normalised. */
  public getForwardAxis(id: PlayerId): { x: number; z: number } {
    const b = this.bodies[id];
    if (!b) return { x: 1, z: 0 };
    const r = b.rotation();
    this._quatTmp.set(r.x, r.y, r.z, r.w);
    this._axisZTmp.set(0, 0, 1).applyQuaternion(this._quatTmp);
    this._vecTmp.set(this._axisZTmp.x, 0, this._axisZTmp.z);
    if (this._vecTmp.lengthSq() < 1e-6) return { x: 1, z: 0 };
    this._vecTmp.normalize();
    return { x: this._vecTmp.x, z: this._vecTmp.z };
  }

  /**
   * Releases a single, limited radial impulse at `origin`. Every pen inside `radius` (except the
   * source) receives an outward impulse that decreases with distance via a power falloff, so the
   * impact is physically graded rather than a flat area nuke.
   */
  public applyRadialImpulse(
    origin: { x: number; y: number; z: number },
    impulse: number,
    radius: number,
    falloff: number,
    excludeId?: PlayerId
  ): void {
    if (impulse <= 0 || radius <= 0) return;
    for (const id of Object.keys(this.bodies)) {
      if (id === excludeId) continue;
      const b = this.bodies[id];
      if (!b) continue;
      const pos = b.translation();
      const dx = pos.x - origin.x;
      const dz = pos.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist > radius) continue;
      const nx = dist > 1e-4 ? dx / dist : 1;
      const nz = dist > 1e-4 ? dz / dist : 0;
      const graded = Math.pow(Math.max(0, 1 - dist / radius), Math.max(0.25, falloff)) * impulse;
      b.applyImpulse({ x: nx * graded, y: graded * 0.18, z: nz * graded }, true);
    }
  }

  public getPose(id: PlayerId): BodyPose {
    const b = this.bodies[id];
    if (!b) {
      return {
        pos: { x: 0, y: -10, z: 0 },
        rot: { x: 0, y: 0, z: 0, w: 1 },
        linvel: { x: 0, y: 0, z: 0 },
        angvel: { x: 0, y: 0, z: 0 },
      };
    }
    const t = b.translation();
    const r = b.rotation();
    const lv = b.linvel();
    const av = b.angvel();
    return {
      pos: { x: t.x, y: t.y, z: t.z },
      rot: { x: r.x, y: r.y, z: r.z, w: r.w },
      linvel: { x: lv.x, y: lv.y, z: lv.z },
      angvel: { x: av.x, y: av.y, z: av.z },
    };
  }

  public resetPens(): void {
    for (const id in this.bodies) {
      const spawn = this.penSpawns[id] ?? (id === 'player' ? PLAYER_SPAWN : BOT_SPAWN);
      this.resetSinglePen(id, spawn);
    }
    this.accumulator = 0;
  }

  public respawnPen(id: PlayerId): void {
    const spawn = this.penSpawns[id] ?? (id === 'player' ? PLAYER_SPAWN : BOT_SPAWN);
    this.resetSinglePen(id, spawn);
  }

  private resetSinglePen(
    id: PlayerId,
    spawn: { x: number; y: number; z: number; yaw: number }
  ): void {
    const b = this.bodies[id];
    if (!b) return;
    const spec = this.penSpecs[id] ?? PEN_SPECS.GRIP_MASTER;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spawn.yaw);
    b.setTranslation({ x: spawn.x, y: penRestY(spec), z: spawn.z }, true);
    b.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.resetForces(true);
    b.resetTorques(true);
    b.wakeUp();
  }

  private applyRollingAndStiction(body: RAPIER.RigidBody, dt: number): void {
    // A sleeping body has (near-)zero velocity, so every correction below is already a no-op.
    // Bailing out here skips the WASM round-trips entirely for settled pens.
    if (body.isSleeping()) return;
    const t = body.translation();
    if (t.y <= -0.1 || t.y >= 0.38) return;

    const av = body.angvel();
    const lv = body.linvel();
    const r = body.rotation();
    this._quatTmp.set(r.x, r.y, r.z, r.w);
    this._axisZTmp.set(0, 0, 1).applyQuaternion(this._quatTmp);
    const rollRate = av.x * this._axisZTmp.x + av.y * this._axisZTmp.y + av.z * this._axisZTmp.z;
    const rollDamp = Math.exp(-5.2 * dt);
    const newRoll = rollRate * rollDamp;
    const diff = newRoll - rollRate;
    if (Math.abs(rollRate) > 0.01) {
      body.setAngvel(
        {
          x: av.x + this._axisZTmp.x * diff,
          y: av.y + this._axisZTmp.y * diff,
          z: av.z + this._axisZTmp.z * diff,
        },
        false
      );
    }
    // Gentle low-speed desk stiction so pens stop crisply instead of creeping
    const hSpeed = Math.hypot(lv.x, lv.z);
    if (hSpeed > 0.001 && hSpeed < 0.35) {
      const stiction = Math.exp(-6.5 * dt);
      body.setLinvel({ x: lv.x * stiction, y: lv.y, z: lv.z * stiction }, false);
    }
  }

  public step(
    delta: number,
    onSubstep?: (substepDt: number) => void,
    collisionCallbacks?: CollisionCallbacks
  ): void {
    const clampedDt = Math.min(delta, 0.05);
    this.accumulator += clampedDt;
    let steps = 0;

    const allSleeping = Object.values(this.bodies).every((b) => b.isSleeping());

    while (this.accumulator >= PHYSICS_FIXED_DT && steps < PHYSICS_MAX_SUBSTEPS) {
      if (onSubstep) {
        onSubstep(PHYSICS_FIXED_DT);
      }

      if (collisionCallbacks && !allSleeping) {
        for (const [id, b] of Object.entries(this.bodies)) {
          const pt = b.translation();
          const pr = b.rotation();
          const plv = b.linvel();
          const pav = b.angvel();
          let record = this._preKinematics[id];
          if (!record) {
            record = {
              pos: new THREE.Vector3(),
              quat: new THREE.Quaternion(),
              vel: new THREE.Vector3(),
              angVel: new THREE.Vector3(),
            };
            this._preKinematics[id] = record;
          }
          record.pos.set(pt.x, pt.y, pt.z);
          record.quat.set(pr.x, pr.y, pr.z, pr.w);
          record.vel.set(plv.x, plv.y, plv.z);
          record.angVel.set(pav.x, pav.y, pav.z);
        }
      }

      this.world.step(this.eventQueue);

      for (const b of Object.values(this.bodies)) {
        this.applyRollingAndStiction(b, PHYSICS_FIXED_DT);
        this.guardCollisionEnergySpike(b);
      }

      if (collisionCallbacks) {
        const nowMs = performance.now();
        this.eventQueue.drainCollisionEvents((h1, h2, started) => {
          this.collisions.handleContact(
            h1,
            h2,
            started,
            nowMs,
            (penId) => {
              const spec = this.penSpecs[penId] ?? PEN_SPECS.GRIP_MASTER;
              const pHalf = spec.length * 0.5;
              const k = this._preKinematics[penId];
              if (k) {
                return {
                  pos: k.pos,
                  quat: k.quat,
                  vel: k.vel,
                  angVel: k.angVel,
                  speed: k.vel.length(),
                  halfLength: pHalf,
                };
              }
              const b = this.bodies[penId];
              if (!b) {
                return {
                  pos: new THREE.Vector3(),
                  quat: new THREE.Quaternion(),
                  vel: new THREE.Vector3(),
                  angVel: new THREE.Vector3(),
                  speed: 0,
                  halfLength: pHalf,
                };
              }
              const t = b.translation();
              const r = b.rotation();
              const lv = b.linvel();
              const av = b.angvel();
              return {
                pos: new THREE.Vector3(t.x, t.y, t.z),
                quat: new THREE.Quaternion(r.x, r.y, r.z, r.w),
                vel: new THREE.Vector3(lv.x, lv.y, lv.z),
                angVel: new THREE.Vector3(av.x, av.y, av.z),
                speed: Math.hypot(lv.x, lv.y, lv.z),
                halfLength: pHalf,
              };
            },
            collisionCallbacks
          );
        });
      } else {
        this.eventQueue.drainCollisionEvents(() => {});
      }

      this.accumulator -= PHYSICS_FIXED_DT;
      steps++;
    }
  }

  private guardCollisionEnergySpike(body: RAPIER.RigidBody): void {
    if (body.isSleeping()) return;
    const lv = body.linvel();
    const hSpeed = Math.hypot(lv.x, lv.z);
    const cap = PHYSICS_BALANCE.maxCollisionSpeedCap;
    if (hSpeed > cap && hSpeed > 1e-5) {
      const scale = cap / hSpeed;
      body.setLinvel({ x: lv.x * scale, y: Math.min(lv.y, 4.5), z: lv.z * scale }, false);
    }
  }

  public getEdgeProximity(id: PlayerId): {
    margin: number;
    level: EdgeDangerLevel;
    isOutsideBounds: boolean;
  } {
    const b = this.bodies[id];
    if (!b) {
      return { margin: 0, level: 'DANGER', isOutsideBounds: true };
    }
    const pos = b.translation();
    const dx = TABLE_HALF_W - Math.abs(pos.x);
    const dz = TABLE_HALF_D - Math.abs(pos.z);
    const margin = Math.min(dx, dz);
    const isOutsideBounds =
      Math.abs(pos.x) > TABLE_HALF_W + OOB_MARGIN ||
      Math.abs(pos.z) > TABLE_HALF_D + OOB_MARGIN ||
      pos.y < OOB_Y_THRESHOLD;

    let level: EdgeDangerLevel = 'SAFE';
    if (isOutsideBounds || margin <= EDGE_DANGER_DISTANCE) {
      level = 'DANGER';
    } else if (margin <= EDGE_WARNING_DISTANCE) {
      level = 'WARN';
    }
    return { margin, level, isOutsideBounds };
  }

  /**
   * Live simulation size for the performance diagnostics panel: how many rigid bodies and
   * colliders exist, and how many of them are actually being integrated right now (sleeping
   * bodies cost nothing, so the awake count is the number that matters).
   */
  public getStats(): { bodies: number; colliders: number; awakeBodies: number } {
    let awakeBodies = 0;
    this.world.forEachRigidBody((body) => {
      // Fixed environment bodies are never "asleep", so counting them would report a permanent
      // floor of two active bodies. Only dynamic bodies are interesting to a perf readout.
      if (!body.isFixed() && !body.isSleeping()) awakeBodies += 1;
    });
    return {
      bodies: this.world.bodies.len(),
      colliders: this.world.colliders.len(),
      awakeBodies,
    };
  }

  public arePensSettled(linThreshold: number, angThreshold: number): boolean {
    for (const id of Object.keys(this.bodies)) {
      const b = this.bodies[id];
      if (!b) continue;
      const t = b.translation();
      // If a pen has fallen below the table and is still falling, ignore it once it hits the floor or drops deep
      if (t.y < FLOOR_Y + 0.5) continue;

      const lv = b.linvel();
      const av = b.angvel();
      const linSq = lv.x * lv.x + lv.y * lv.y + lv.z * lv.z;
      const angSq = av.x * av.x + av.y * av.y + av.z * av.z;
      if (linSq > linThreshold * linThreshold || angSq > angThreshold * angThreshold) {
        return false;
      }
    }
    return true;
  }

  /**
   * Mirrors a live pen's full dynamic state into its isolated prediction twin. Damping and virtual
   * mass are copied too, so an ability preview that temporarily re-tunes its prediction body can
   * never leak those values into a later normal arc (and vice versa).
   */
  private syncPredictionBody(id: PlayerId): void {
    const live = this.bodies[id];
    const pred = this.predBodies[id];
    if (!live || !pred) return;
    pred.setTranslation(live.translation(), true);
    pred.setRotation(live.rotation(), true);
    pred.setLinvel(live.linvel(), true);
    pred.setAngvel(live.angvel(), true);
    pred.setLinearDamping(live.linearDamping());
    pred.setAngularDamping(live.angularDamping());
    pred.setAdditionalMass(this.additionalMass[id] ?? 0, true);
    pred.resetForces(true);
    pred.resetTorques(true);
    pred.wakeUp();
  }

  /**
   * Simulates the player's shot from the exact current rigid-body pose, velocity,
   * angular momentum, and grab anchor inside an isolated Rapier prediction world.
   * Never modifies live game state.
   */
  public predictTrajectory(params: {
    localAnchor: { x: number; y: number; z: number };
    impulse: { x: number; y: number; z: number };
    preserveOnly: boolean;
    shooterId?: PlayerId;
    steps?: number;
    sampleInterval?: number;
  }): TrajectoryPrediction {
    const steps = params.steps ?? 84;
    const sampleInterval = params.sampleInterval ?? 3;
    const shooterId = params.shooterId ?? 'player';

    // Copy exact live poses & velocities into isolated prediction bodies
    for (const id of Object.keys(this.bodies)) {
      if (this.predBodies[id]) {
        this.syncPredictionBody(id);
      }
    }

    const pPred = this.predBodies[shooterId] ?? Object.values(this.predBodies)[0];
    if (!pPred) {
      return {
        points: [],
        collisionPoint: null,
        landingPoint: { x: 0, y: 0.05, z: 0, isOffTable: false },
        botDeflectEnd: null,
      };
    }

    if (!params.preserveOnly) {
      const pPos = pPred.translation();
      const pRot = pPred.rotation();
      this._quatTmp.set(pRot.x, pRot.y, pRot.z, pRot.w);
      this._vecTmp.set(params.localAnchor.x, params.localAnchor.y, params.localAnchor.z).applyQuaternion(this._quatTmp);

      const impMagSq =
        params.impulse.x * params.impulse.x +
        params.impulse.y * params.impulse.y +
        params.impulse.z * params.impulse.z;
      if (impMagSq > 1e-4) {
        pPred.applyImpulseAtPoint(
          params.impulse,
          { x: pPos.x + this._vecTmp.x, y: pPos.y, z: pPos.z + this._vecTmp.z },
          true
        );
      }
    }

    // Drain any stale queued events
    this.predEventQueue.drainCollisionEvents(() => {});

    const points: PredictedTrajectoryPoint[] = [];
    let collisionPoint: { x: number; y: number; z: number } | null = null;
    let hitTargetId: string | null = null;
    const shooterHandles = this.predColliderHandles[shooterId] ?? new Set<number>();
    const predDt = 1 / 60;

    let finalPos = pPred.translation();
    let hitFloor = false;

    for (let stepIdx = 1; stepIdx <= steps; stepIdx++) {
      this.predWorld.step(this.predEventQueue);
      for (const b of Object.values(this.predBodies)) {
        this.applyRollingAndStiction(b, predDt);
        this.guardCollisionEnergySpike(b);
      }

      this.predEventQueue.drainCollisionEvents((h1, h2, started) => {
        if (!started || collisionPoint) return;
        const shooterIsH1 = shooterHandles.has(h1);
        const shooterIsH2 = shooterHandles.has(h2);
        if (!shooterIsH1 && !shooterIsH2) return;
        const otherHandle = shooterIsH1 ? h2 : h1;
        for (const [otherId, handles] of Object.entries(this.predColliderHandles)) {
          if (otherId === shooterId) continue;
          if (handles.has(otherHandle)) {
            const otherPred = this.predBodies[otherId];
            if (!otherPred) break;
            hitTargetId = otherId;
            const pt = pPred.translation();
            const bt = otherPred.translation();
            collisionPoint = {
              x: (pt.x + bt.x) * 0.5,
              y: Math.max(0.08, (pt.y + bt.y) * 0.5),
              z: (pt.z + bt.z) * 0.5,
            };
            break;
          }
        }
      });

      const pos = pPred.translation();
      const lv = pPred.linvel();
      const av = pPred.angvel();
      const speed = Math.hypot(lv.x, lv.y, lv.z);
      const angSpeed = Math.hypot(av.x, av.y, av.z);
      const offTable =
        Math.abs(pos.x) > TABLE_HALF_W + OOB_MARGIN ||
        Math.abs(pos.z) > TABLE_HALF_D + OOB_MARGIN ||
        pos.y < OOB_Y_THRESHOLD;

      if (stepIdx % sampleInterval === 0 || stepIdx === steps) {
        points.push({
          x: pos.x,
          y: pos.y,
          z: pos.z,
          speed,
          offTable,
        });
      }

      finalPos = pos;
      if (pos.y <= FLOOR_Y + 0.35) {
        hitFloor = true;
        break;
      }

      if (stepIdx > 10 && !offTable && pos.y > -0.1 && speed < 0.16 && angSpeed < 0.45) {
        if (stepIdx % sampleInterval !== 0) {
          points.push({ x: pos.x, y: pos.y, z: pos.z, speed, offTable });
        }
        break;
      }
    }

    const hitTargetBody = hitTargetId ? this.predBodies[hitTargetId] : undefined;
    const hitEnd = hitTargetBody ? hitTargetBody.translation() : null;
    const isOffTable =
      hitFloor ||
      finalPos.y < OOB_Y_THRESHOLD ||
      Math.abs(finalPos.x) > TABLE_HALF_W + OOB_MARGIN ||
      Math.abs(finalPos.z) > TABLE_HALF_D + OOB_MARGIN;

    return {
      points,
      collisionPoint,
      landingPoint: {
        x: finalPos.x,
        y: Math.max(FLOOR_Y + 0.05, finalPos.y),
        z: finalPos.z,
        isOffTable,
      },
      botDeflectEnd: collisionPoint && hitEnd
        ? { x: hitEnd.x, y: Math.max(FLOOR_Y + 0.05, hitEnd.y), z: hitEnd.z }
        : null,
    };
  }

  /**
   * Replays a Special Shot's exact physics program inside the isolated prediction world, from the
   * current live poses. `apply` is called once per predicted step with the pen's rigid body, the
   * elapsed shot time and the step dt — the caller writes the very same forces / torques / damping
   * that the live SpecialShotSystem writes, so the preview is literally what the body will do.
   * The live world is never touched.
   */
  public predictAbilityTrajectory(params: {
    durationSeconds: number;
    coastSeconds?: number;
    sampleInterval?: number;
    casterId?: PlayerId;
    apply: (body: RAPIER.RigidBody, elapsed: number, dt: number) => void;
  }): TrajectoryPrediction {
    const predDt = 1 / 60;
    const totalSeconds = params.durationSeconds + (params.coastSeconds ?? 1.8);
    const steps = Math.max(10, Math.round(totalSeconds / predDt));
    const sampleInterval = params.sampleInterval ?? 3;
    const casterId = params.casterId ?? 'player';

    for (const id of Object.keys(this.bodies)) {
      if (this.predBodies[id]) {
        this.syncPredictionBody(id);
      }
    }

    const pPred = this.predBodies[casterId] ?? Object.values(this.predBodies)[0];
    if (!pPred) {
      return {
        points: [],
        collisionPoint: null,
        landingPoint: { x: 0, y: 0.05, z: 0, isOffTable: false },
        botDeflectEnd: null,
      };
    }
    this.predEventQueue.drainCollisionEvents(() => {});

    const points: PredictedTrajectoryPoint[] = [];
    let collisionPoint: { x: number; y: number; z: number } | null = null;
    let hitTargetId: string | null = null;
    const casterHandles = this.predColliderHandles[casterId] ?? new Set<number>();

    let finalPos = pPred.translation();
    let hitFloor = false;

    for (let stepIdx = 0; stepIdx < steps; stepIdx++) {
      const elapsed = stepIdx * predDt;
      if (elapsed <= params.durationSeconds) {
        pPred.resetForces(true);
        pPred.resetTorques(true);
        params.apply(pPred, elapsed, predDt);
      }

      this.predWorld.step(this.predEventQueue);
      for (const b of Object.values(this.predBodies)) {
        this.applyRollingAndStiction(b, predDt);
        this.guardCollisionEnergySpike(b);
      }

      this.predEventQueue.drainCollisionEvents((h1, h2, started) => {
        if (!started || collisionPoint) return;
        const casterIsH1 = casterHandles.has(h1);
        const casterIsH2 = casterHandles.has(h2);
        if (!casterIsH1 && !casterIsH2) return;
        const otherHandle = casterIsH1 ? h2 : h1;
        for (const [otherId, handles] of Object.entries(this.predColliderHandles)) {
          if (otherId === casterId) continue;
          if (handles.has(otherHandle)) {
            const otherPred = this.predBodies[otherId];
            if (!otherPred) break;
            hitTargetId = otherId;
            const pt = pPred.translation();
            const bt = otherPred.translation();
            collisionPoint = {
              x: (pt.x + bt.x) * 0.5,
              y: Math.max(0.08, (pt.y + bt.y) * 0.5),
              z: (pt.z + bt.z) * 0.5,
            };
            break;
          }
        }
      });

      const pos = pPred.translation();
      const lv = pPred.linvel();
      const av = pPred.angvel();
      const speed = Math.hypot(lv.x, lv.y, lv.z);
      const angSpeed = Math.hypot(av.x, av.y, av.z);
      const offTable =
        Math.abs(pos.x) > TABLE_HALF_W + OOB_MARGIN ||
        Math.abs(pos.z) > TABLE_HALF_D + OOB_MARGIN ||
        pos.y < OOB_Y_THRESHOLD;

      if (stepIdx % sampleInterval === 0 || stepIdx === steps - 1) {
        points.push({ x: pos.x, y: pos.y, z: pos.z, speed, offTable });
      }

      finalPos = pos;
      if (pos.y <= FLOOR_Y + 0.35) {
        hitFloor = true;
        break;
      }
      if (stepIdx > 14 && !offTable && pos.y > -0.1 && speed < 0.16 && angSpeed < 0.45) {
        if (stepIdx % sampleInterval !== 0) {
          points.push({ x: pos.x, y: pos.y, z: pos.z, speed, offTable });
        }
        break;
      }
    }

    const hitTargetBody = hitTargetId ? this.predBodies[hitTargetId] : undefined;
    const hitEnd = hitTargetBody ? hitTargetBody.translation() : null;
    const isOffTable =
      hitFloor ||
      finalPos.y < OOB_Y_THRESHOLD ||
      Math.abs(finalPos.x) > TABLE_HALF_W + OOB_MARGIN ||
      Math.abs(finalPos.z) > TABLE_HALF_D + OOB_MARGIN;

    return {
      points,
      collisionPoint,
      landingPoint: {
        x: finalPos.x,
        y: Math.max(FLOOR_Y + 0.05, finalPos.y),
        z: finalPos.z,
        isOffTable,
      },
      botDeflectEnd: collisionPoint && hitEnd
        ? { x: hitEnd.x, y: Math.max(FLOOR_Y + 0.05, hitEnd.y), z: hitEnd.z }
        : null,
    };
  }

  /**
   * Runs a fast, deterministic headless Rapier simulation from the current board state
   * for Expert AI shot evaluation using identical physics rules & active pen specs.
   */
  public simulateCandidateShot(
    shooter: PlayerId,
    localAnchor: { x: number; y: number; z: number },
    impulse: { x: number; y: number; z: number },
    stepsCount = 56
  ): {
    playerPos: { x: number; y: number; z: number };
    botPos: { x: number; y: number; z: number };
    playerFell: boolean;
    botFell: boolean;
  } {
    const simWorld = this.acquireSimWorld();
    const { player: pBody, bot: bBody } = this.resetSimBodies();

    const shooterBody = shooter === 'player' ? pBody : bBody;
    const sPos = shooterBody.translation();
    const sRot = shooterBody.rotation();
    const q = this._quatTmp.set(sRot.x, sRot.y, sRot.z, sRot.w);
    const worldOffset = this._vecTmp.set(localAnchor.x, 0, localAnchor.z).applyQuaternion(q);
    const applyPt = {
      x: sPos.x + worldOffset.x,
      y: sPos.y,
      z: sPos.z + worldOffset.z,
    };

    shooterBody.applyImpulseAtPoint(impulse, applyPt, true);

    let playerFell = false;
    let botFell = false;

    for (let i = 0; i < stepsCount; i++) {
      simWorld.step();
      this.applyRollingAndStiction(pBody, 1 / 60);
      this.applyRollingAndStiction(bBody, 1 / 60);
      this.guardCollisionEnergySpike(pBody);
      this.guardCollisionEnergySpike(bBody);
      const pt = pBody.translation();
      const bt = bBody.translation();
      if (
        pt.y < OOB_Y_THRESHOLD ||
        Math.abs(pt.x) > TABLE_HALF_W + OOB_MARGIN ||
        Math.abs(pt.z) > TABLE_HALF_D + OOB_MARGIN
      ) {
        playerFell = true;
      }
      if (
        bt.y < OOB_Y_THRESHOLD ||
        Math.abs(bt.x) > TABLE_HALF_W + OOB_MARGIN ||
        Math.abs(bt.z) > TABLE_HALF_D + OOB_MARGIN
      ) {
        botFell = true;
      }
    }

    const finalP = pBody.translation();
    const finalB = bBody.translation();
    return {
      playerPos: { x: finalP.x, y: finalP.y, z: finalP.z },
      botPos: { x: finalB.x, y: finalB.y, z: finalB.z },
      playerFell,
      botFell,
    };
  }

  /**
   * Lazily builds the reusable candidate-evaluation world. The static classroom environment never
   * changes between candidates, so it only needs to exist once for the whole match.
   */
  private acquireSimWorld(): RAPIER.World {
    if (!this.simWorld) {
      const world = new RAPIER.World({ x: 0, y: GRAVITY_Y, z: 0 });
      // Mirrors the live world's coarse settings so candidate scoring matches gameplay.
      world.timestep = 1 / 60;
      world.numSolverIterations = 6;
      this.createEnvironmentColliders(world);
      this.simWorld = world;
      this.simBodies = {
        player: this.createPenBody(world, 'player', PLAYER_SPAWN, this.penSpecs.player),
        bot: this.createPenBody(world, 'bot', BOT_SPAWN, this.penSpecs.bot),
      };
    }
    return this.simWorld;
  }

  /**
   * Teleports both scratch pens onto the live board state, clears their velocities and wakes them,
   * so every candidate starts from an identical, deterministic configuration.
   */
  private resetSimBodies(): Record<PlayerId, RAPIER.RigidBody> {
    const simBodies = this.simBodies!;
    const pPose = this.getPose('player');
    const bPose = this.getPose('bot');

    const pBody = simBodies.player;
    pBody.setTranslation(pPose.pos, true);
    pBody.setRotation(pPose.rot, true);
    pBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    pBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

    const bBody = simBodies.bot;
    bBody.setTranslation(bPose.pos, true);
    bBody.setRotation(bPose.rot, true);
    bBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    bBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

    return simBodies;
  }

  public dispose(): void {
    this.collisions.clear();
    this.eventQueue.free();
    this.world.free();
    this.predEventQueue.free();
    this.predWorld.free();
    this.simWorld?.free();
    this.simWorld = null;
    this.simBodies = null;
  }
}
