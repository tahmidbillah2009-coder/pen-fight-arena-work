import * as THREE from 'three';
import {
  DRAG_MAX_FORCE,
  DRAG_SPRING_STIFFNESS,
  dragDistanceToPowerRatio,
  getPowerZone,
  MAX_DRAG_DISTANCE,
  MAX_LAUNCH_SPEED,
  MIN_DRAG_THRESHOLD,
  PenTypeId,
  powerRatioToLaunchSpeed,
  PowerZoneId,
} from '../utils/Constants';
import {
  clampLocalAnchor,
  clientToNDC,
  describeAnchorZone,
  intersectHorizontalPlane,
  localToWorldPoint,
  worldToLocalPoint,
} from '../utils/Coordinates';
import { DragTelemetry } from './GameState';
import { PenModel } from './Pen';
import { PhysicsManager } from './PhysicsManager';

export interface DragStateView {
  activePenId: string;
  isDragging: boolean;
  canLaunch: boolean;
  preserveOnly: boolean;
  isLiveThrow: boolean;
  powerRatio: number;
  powerZone: PowerZoneId;
  estimatedSpeed: number;
  dragDistance: number;
  launchImpulse: number;
  deltaImpulse: number;
  spinFactor: number;
  appliedForce: number;
  localAnchor: THREE.Vector3;
  worldAnchor: THREE.Vector3;
  pointerWorldPos: THREE.Vector3;
  launchDir: THREE.Vector3;
}

export interface DragCallbacks {
  canDrag: () => boolean;
  canAcceptShot?: () => boolean;
  onGrabStart: () => void;
  onTelemetry: (telemetry: DragTelemetry) => void;
  onShotLaunch: (powerRatio: number) => void;
  onDragCancel: () => void;
  /**
   * True while the player has primed their Special Shot from the HUD. When a valid drag is
   * released in this state the shot — not the normal impulse — launches the pen.
   */
  isAbilityArmed: () => boolean;
  /**
   * Fired at release while armed. Returns true when the Special Shot actually started, in which
   * case the normal drag impulse is skipped so the shot's own physics program owns the motion.
   */
  onAbilityLaunch: (dirX: number, dirZ: number, powerRatio: number) => boolean;
}

interface ReleasePlan {
  canLaunch: boolean;
  preserveOnly: boolean;
  isLiveThrow: boolean;
  powerRatio: number;
  powerZone: PowerZoneId;
  estimatedSpeed: number;
  effectiveDist: number;
  targetImpulse: number;
  deltaImpulse: number;
  spinFactor: number;
  dirX: number;
  dirZ: number;
}

export class DragController {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.Camera;
  private readonly physics: PhysicsManager;
  private activePenId: string = 'player';
  private activePenModel: PenModel;
  private readonly callbacks: DragCallbacks;

  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  private activePointerId: number | null = null;
  private isDragging = false;
  private dragPlaneY = 0.16;

  private readonly localAnchor = new THREE.Vector3();
  private readonly initialGrabWorld = new THREE.Vector3();
  private readonly currentPointerWorld = new THREE.Vector3();
  private readonly smoothedPointerWorld = new THREE.Vector3();
  private readonly targetAnchorWorld = new THREE.Vector3();
  private readonly currentAnchorWorld = new THREE.Vector3();
  private readonly pullVec = new THREE.Vector3();
  private readonly launchDir = new THREE.Vector3(1, 0, 0);

  private dragDistance = 0;
  private lastAppliedForce = 0;
  /**
   * Pointer steadying (0 = raw input). Raised by the PRECISION PULL ability to filter the
   * player's own motion for finer drag control. It never alters the aim *direction* — the
   * preview always renders the exact filtered direction the aim uses.
   */
  private inputSteadying = 0;

  // Bound event listeners
  private readonly handlePointerDown: (e: PointerEvent) => void;
  private readonly handlePointerMove: (e: PointerEvent) => void;
  private readonly handlePointerUp: (e: PointerEvent) => void;
  private readonly handleWindowBlur: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    physics: PhysicsManager,
    playerPen: PenModel,
    callbacks: DragCallbacks
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.physics = physics;
    this.activePenId = 'player';
    this.activePenModel = playerPen;
    this.callbacks = callbacks;

    this.handlePointerDown = this.onPointerDown.bind(this);
    this.handlePointerMove = this.onPointerMove.bind(this);
    this.handlePointerUp = this.onPointerUp.bind(this);
    this.handleWindowBlur = this.cancelDrag.bind(this);

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    window.addEventListener('blur', this.handleWindowBlur);
  }

  public setActivePen(penId: string, penModel: PenModel): void {
    if (this.isDragging) {
      this.cancelDrag();
    }
    this.activePenId = penId;
    this.activePenModel = penModel;
  }

  public getActivePenId(): string {
    return this.activePenId;
  }

  public getIsDragging(): boolean {
    return this.isDragging;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.callbacks.canDrag()) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (this.activePointerId !== null) return;

    clientToNDC(e.clientX, e.clientY, this.canvas, this.ndc);
    this.raycaster.setFromCamera(this.ndc, this.camera);

    // Prefer exact 3D hit on visible pen components; fallback to generous proxy cylinder for touch
    let chosenHit: THREE.Intersection | undefined;
    const visualHits = this.raycaster.intersectObjects(this.activePenModel.visualMeshes, false);
    if (visualHits.length > 0) {
      chosenHit = visualHits[0];
    } else {
      const proxyHits = this.raycaster.intersectObject(this.activePenModel.raycastProxy, false);
      if (proxyHits.length > 0) {
        chosenHit = proxyHits[0];
      }
    }
    if (!chosenHit) return;

    const body = this.physics.getBody(this.activePenId);
    const spec = this.physics.getPenSpec(this.activePenId);
    const pos = body.translation();
    const rot = body.rotation();

    worldToLocalPoint(chosenHit.point, pos, rot, this.localAnchor);
    clampLocalAnchor(this.localAnchor, spec.length * 0.5, spec.radius);

    localToWorldPoint(this.localAnchor, pos, rot, this.initialGrabWorld);
    this.currentAnchorWorld.copy(this.initialGrabWorld);
    this.targetAnchorWorld.copy(this.initialGrabWorld);
    this.currentPointerWorld.copy(this.initialGrabWorld);
    this.smoothedPointerWorld.copy(this.initialGrabWorld);
    this.dragPlaneY = Math.max(spec.radius, this.initialGrabWorld.y);

    this.activePointerId = e.pointerId;
    this.isDragging = true;
    this.dragDistance = 0;
    this.lastAppliedForce = 0;
    this.pullVec.set(0, 0, 0);

    if (e.cancelable) {
      e.preventDefault();
    }
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture isn't supported
    }

    body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    body.resetForces(true);
    body.resetTorques(true);

    this.callbacks.onGrabStart();
    this.emitTelemetry();
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isDragging || e.pointerId !== this.activePointerId) return;

    if (
      !intersectHorizontalPlane(
        e.clientX,
        e.clientY,
        this.canvas,
        this.camera,
        this.dragPlaneY,
        this.currentPointerWorld
      )
    ) {
      return;
    }

    // PRECISION PULL: gently filter the raw pointer motion (exponential steadying). The
    // filtered position is what both the aim preview and the release impulse use, so the
    // player always sees the exact direction the shot will take.
    if (this.inputSteadying > 0) {
      const alpha = 1 / (1 + this.inputSteadying * 5);
      this.smoothedPointerWorld.lerp(this.currentPointerWorld, alpha);
      this.currentPointerWorld.copy(this.smoothedPointerWorld);
    }

    this.pullVec.set(
      this.currentPointerWorld.x - this.initialGrabWorld.x,
      0,
      this.currentPointerWorld.z - this.initialGrabWorld.z
    );

    const rawDist = this.pullVec.length();
    this.dragDistance = Math.min(rawDist, MAX_DRAG_DISTANCE);

    if (rawDist > 1e-4) {
      this.pullVec.divideScalar(rawDist);
      this.launchDir.copy(this.pullVec).negate();
    } else {
      this.pullVec.set(0, 0, 0);
    }

    // Clamp pointer aim indicator within desk bounds without moving the physical pen
    const { halfW, halfD } = this.physics.getArenaBounds();
    const safeX = THREE.MathUtils.clamp(
      this.currentPointerWorld.x,
      -halfW + 0.35,
      halfW - 0.35
    );
    const safeZ = THREE.MathUtils.clamp(
      this.currentPointerWorld.z,
      -halfD + 0.35,
      halfD - 0.35
    );
    this.targetAnchorWorld.set(safeX, this.dragPlaneY, safeZ);
    this.lastAppliedForce = Math.min(DRAG_MAX_FORCE, DRAG_SPRING_STIFFNESS * this.dragDistance);

    this.emitTelemetry();
  }

  private describeLaunchDirection(dirX: number, dirZ: number): { angleDeg: number; cardinal: string } {
    // World +X = Right (toward bot side), -Z = Up-desk, +Z = Down-desk
    const angleRad = Math.atan2(-dirZ, dirX);
    const angleDeg = Math.round(THREE.MathUtils.radToDeg(angleRad));
    const dirs = ['Right', 'Fwd-Right', 'Forward', 'Fwd-Left', 'Left', 'Back-Left', 'Back', 'Back-Right'];
    const idx = Math.round(((angleRad + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
    return { angleDeg, cardinal: dirs[idx] };
  }

  private computeReleasePlan(): ReleasePlan {
    const body = this.physics.getBody(this.activePenId);
    const spec = this.physics.getPenSpec(this.activePenId);
    const pos = body.translation();
    const rot = body.rotation();
    const lv = body.linvel();
    const av = body.angvel();

    localToWorldPoint(this.localAnchor, pos, rot, this.currentAnchorWorld);

    const effectiveDist = this.dragDistance;
    const dirX = this.launchDir.x;
    const dirZ = this.launchDir.z;

    // Lever arm from rigid-body center of mass to exact grabbed anchor
    const com = body.localCom();
    const rx = this.currentAnchorWorld.x - pos.x;
    const rz = this.currentAnchorWorld.z - pos.z;
    const rPerp = rz * dirX - rx * dirZ;
    const spinFactor = THREE.MathUtils.clamp(Math.abs(rPerp) / (spec.length * 0.44), 0, 1);

    // True rigid-body yaw inertia I_yy ≈ (1/12) m L^2 + m * comZ^2
    const inertiaY = (spec.mass * spec.length * spec.length) / 12 + spec.mass * com.z * com.z;
    const invEffectiveMass = 1 / spec.mass + (rPerp * rPerp) / Math.max(inertiaY, 0.05);
    const effectiveMass = 1 / invEffectiveMass;
    const massRatio = THREE.MathUtils.clamp(effectiveMass / spec.mass, 0.25, 1.0);

    const canLaunch = effectiveDist >= MIN_DRAG_THRESHOLD;
    if (!canLaunch) {
      return {
        canLaunch: false,
        preserveOnly: true,
        isLiveThrow: false,
        powerRatio: 0,
        powerZone: 'LOW',
        estimatedSpeed: 0,
        effectiveDist,
        targetImpulse: 0,
        deltaImpulse: 0,
        spinFactor,
        dirX,
        dirZ,
      };
    }

    // Nonlinear drag-distance curve + virtual spring constraint saturation + grab leverage
    const rawPowerRatio = dragDistanceToPowerRatio(effectiveDist);
    const forceFactor = THREE.MathUtils.clamp(this.lastAppliedForce / Math.max(1, DRAG_MAX_FORCE), 0, 1);
    const powerRatio = THREE.MathUtils.clamp(rawPowerRatio * 0.9 + forceFactor * 0.1, 0.02, 1);

    // Controlled speed scaled by mass, rotational inertia leverage, and capped by MAX_LAUNCH_SPEED
    const curvedSpeed = powerRatioToLaunchSpeed(powerRatio, spec.mass);
    const leverageScale = 0.88 + 0.12 * massRatio;
    const angSpeed = Math.hypot(av.x, av.y, av.z);
    const rotPenalty = 1 / (1 + angSpeed * 0.02);
    const maxSpeedForPen = MAX_LAUNCH_SPEED / Math.pow(Math.max(0.4, spec.mass), 0.26);
    const desiredSpeed = THREE.MathUtils.clamp(
      curvedSpeed * leverageScale * rotPenalty,
      0,
      maxSpeedForPen
    );

    // Subtract any existing forward velocity along launchDir so total speed stays strictly capped
    const vAlong = Math.max(0, lv.x * dirX + lv.z * dirZ);
    const deltaSpeed = Math.max(0, desiredSpeed - vAlong);
    const targetImpulse = desiredSpeed * spec.mass;
    const deltaImpulse = deltaSpeed * spec.mass;
    const zone = getPowerZone(powerRatio);

    return {
      canLaunch: true,
      preserveOnly: deltaImpulse < 0.05,
      isLiveThrow: false,
      powerRatio,
      powerZone: zone.id,
      estimatedSpeed: desiredSpeed,
      effectiveDist,
      targetImpulse,
      deltaImpulse,
      spinFactor,
      dirX,
      dirZ,
    };
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.isDragging || e.pointerId !== this.activePointerId) return;

    this.releaseCapture(e.pointerId);
    const body = this.physics.getBody(this.activePenId);
    if (!body) {
      this.resetInternalState();
      this.callbacks.onDragCancel();
      return;
    }
    body.resetForces(true);
    body.resetTorques(true);

    // Atomic turn-deadline race check: if the turn expired just prior to release, abort safely.
    if (this.callbacks.canAcceptShot && !this.callbacks.canAcceptShot()) {
      this.resetInternalState();
      this.callbacks.onDragCancel();
      return;
    }

    const plan = this.computeReleasePlan();

    // Armed Special Shot: hand the aimed direction to the ability system instead of applying the
    // normal drag impulse, so the shot's own physics program provides the launch. If the shot
    // could not start (e.g. it just went on cooldown) we fall through to a normal shot.
    if (plan.canLaunch && this.callbacks.isAbilityArmed()) {
      const fired = this.callbacks.onAbilityLaunch(plan.dirX, plan.dirZ, plan.powerRatio);
      if (fired) {
        this.resetInternalState();
        this.callbacks.onShotLaunch(plan.powerRatio);
        return;
      }
    }

    if (plan.canLaunch && plan.deltaImpulse > 0.08) {
      const pos = body.translation();
      const rot = body.rotation();
      localToWorldPoint(this.localAnchor, pos, rot, this.currentAnchorWorld);

      body.wakeUp();
      body.applyImpulseAtPoint(
        { x: plan.dirX * plan.deltaImpulse, y: 0.06, z: plan.dirZ * plan.deltaImpulse },
        { x: this.currentAnchorWorld.x, y: pos.y, z: this.currentAnchorWorld.z },
        true
      );
    }

    this.resetInternalState();

    if (plan.canLaunch) {
      this.callbacks.onShotLaunch(plan.powerRatio);
    } else {
      this.callbacks.onDragCancel();
    }
  }

  public cancelDrag(): void {
    if (!this.isDragging) return;
    if (this.activePointerId !== null) {
      this.releaseCapture(this.activePointerId);
    }
    const body = this.physics.getBody(this.activePenId);
    if (body) {
      body.resetForces(true);
      body.resetTorques(true);
    }
    this.resetInternalState();
    this.callbacks.onDragCancel();
  }

  private releaseCapture(pointerId: number): void {
    try {
      if (this.canvas.hasPointerCapture(pointerId)) {
        this.canvas.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore
    }
  }

  private resetInternalState(): void {
    this.activePointerId = null;
    this.isDragging = false;
    this.dragDistance = 0;
    this.lastAppliedForce = 0;
    this.smoothedPointerWorld.set(0, 0, 0);
    this.pullVec.set(0, 0, 0);
    this.emitTelemetry();
  }

  /** Called by the game loop with the currently active PRECISION PULL steadying strength. */
  public setInputSteadying(factor: number): void {
    this.inputSteadying = THREE.MathUtils.clamp(factor, 0, 1);
  }

  /**
   * Keeps the active player's pen anchored stationary in place during drag aiming
   * so pulling back never shifts or rotates the pen prematurely.
   */
  public applySubstepForce(_substepDt = 1 / 120): void {
    if (!this.isDragging) return;

    const body = this.physics.getBody(this.activePenId);
    if (!body) return;
    body.resetForces(true);
    body.resetTorques(true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
  }

  public getStateView(): DragStateView {
    if (!this.isDragging) {
      return {
        activePenId: this.activePenId,
        isDragging: false,
        canLaunch: false,
        preserveOnly: true,
        isLiveThrow: false,
        powerRatio: 0,
        powerZone: 'LOW',
        estimatedSpeed: 0,
        dragDistance: 0,
        launchImpulse: 0,
        deltaImpulse: 0,
        spinFactor: 0,
        appliedForce: 0,
        localAnchor: this.localAnchor,
        worldAnchor: this.currentAnchorWorld,
        pointerWorldPos: this.currentPointerWorld,
        launchDir: this.launchDir,
      };
    }

    const plan = this.computeReleasePlan();
    this.launchDir.set(plan.dirX, 0, plan.dirZ);

    return {
      activePenId: this.activePenId,
      isDragging: true,
      canLaunch: plan.canLaunch,
      preserveOnly: plan.preserveOnly,
      isLiveThrow: plan.isLiveThrow,
      powerRatio: plan.powerRatio,
      powerZone: plan.powerZone,
      estimatedSpeed: plan.estimatedSpeed,
      dragDistance: plan.effectiveDist,
      launchImpulse: plan.targetImpulse,
      deltaImpulse: plan.deltaImpulse,
      spinFactor: plan.spinFactor,
      appliedForce: this.lastAppliedForce,
      localAnchor: this.localAnchor,
      worldAnchor: this.currentAnchorWorld,
      pointerWorldPos: this.currentPointerWorld,
      launchDir: this.launchDir,
    };
  }

  public emitTelemetry(): void {
    const spec = this.physics.getPenSpec(this.activePenId);
    if (!spec) return;
    const penType: PenTypeId = spec.id;
    if (!this.isDragging) {
      this.callbacks.onTelemetry({
        isDragging: false,
        powerRatio: 0,
        powerZone: 'LOW',
        estimatedSpeed: 0,
        pullAngleDeg: 0,
        pullCardinal: 'Right',
        dragDistance: 0,
        anchorZone: describeAnchorZone(this.localAnchor.z, spec.length * 0.5),
        canLaunch: false,
        penType,
        spinFactor: 0,
        appliedForce: 0,
        isLiveThrow: false,
      });
      return;
    }

    const plan = this.computeReleasePlan();
    const dirInfo = this.describeLaunchDirection(plan.dirX, plan.dirZ);
    this.callbacks.onTelemetry({
      isDragging: true,
      powerRatio: plan.powerRatio,
      powerZone: plan.powerZone,
      estimatedSpeed: plan.estimatedSpeed,
      pullAngleDeg: dirInfo.angleDeg,
      pullCardinal: dirInfo.cardinal,
      dragDistance: plan.effectiveDist,
      anchorZone: describeAnchorZone(this.localAnchor.z, spec.length * 0.5),
      canLaunch: plan.canLaunch,
      penType,
      spinFactor: plan.spinFactor,
      appliedForce: this.lastAppliedForce,
      isLiveThrow: plan.isLiveThrow,
    });
  }

  public dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    window.removeEventListener('blur', this.handleWindowBlur);
  }
}
