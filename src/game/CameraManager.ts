import * as THREE from 'three';
import { TABLE_HALF_D, TABLE_HALF_W } from '../utils/Constants';

export class CameraManager {
  public readonly camera: THREE.PerspectiveCamera;

  private readonly baseLookAt = new THREE.Vector3(0, -0.32, 0.65);
  private readonly targetPosition = new THREE.Vector3(0, 18.0, 17.5);
  private readonly currentPosition = new THREE.Vector3(0, 18.0, 17.5);
  private readonly currentLookAt = new THREE.Vector3(0, -0.32, 0.65);

  private shakeIntensity = 0;
  private menuOrbitTime = 0;
  private isMenuMode = true;
  private aspect = 1;
  private viewportWidth = 1280;
  private viewportHeight = 720;

  /** Subtle "camera follow" weight + target while a Special Shot is in flight. */
  private shotFocusWeight = 0;
  private readonly shotFocusPoint = new THREE.Vector3();
  private readonly _lookTmp = new THREE.Vector3();

  // Reusable math helpers for bounding-box framing solver
  private readonly _dir = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _up = new THREE.Vector3();
  private readonly _corner = new THREE.Vector3();

  constructor(width: number, height: number) {
    this.viewportWidth = Math.max(width, 1);
    this.viewportHeight = Math.max(height, 1);
    this.aspect = this.viewportWidth / this.viewportHeight;
    this.camera = new THREE.PerspectiveCamera(36, this.aspect, 0.2, 160);
    this.recomputeFraming();
    this.currentPosition.copy(this.targetPosition);
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  public setMenuMode(enabled: boolean): void {
    this.isMenuMode = enabled;
  }

  public resize(width: number, height: number): void {
    const w = Math.max(width, 1);
    const h = Math.max(height, 1);
    if (this.viewportWidth === w && this.viewportHeight === h) return;
    this.viewportWidth = w;
    this.viewportHeight = h;
    this.aspect = this.viewportWidth / this.viewportHeight;
    this.camera.aspect = this.aspect;
    this.recomputeFraming();
    // If orientation or window size changed significantly, snap closer so it settles instantly
    if (this.currentPosition.distanceTo(this.targetPosition) > 10) {
      this.currentPosition.lerp(this.targetPosition, 0.75);
    }
  }

  private recomputeFraming(): void {
    // Slightly widen FOV on tall portrait mobile screens to preserve crisp perspective without excessive camera distance
    const isPortrait = this.aspect < 1.0;
    const portraitBlend = THREE.MathUtils.clamp((1.0 - this.aspect) / 0.55, 0, 1);
    const fov = THREE.MathUtils.lerp(36, 43, portraitBlend);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    // Fixed isometric pitch angle (~47 deg)
    const pitch = THREE.MathUtils.degToRad(47);
    // Direction from lookAt toward camera: (0, sin(pitch), cos(pitch))
    const camOffsetUnitY = Math.sin(pitch);
    const camOffsetUnitZ = Math.cos(pitch);

    // Camera view basis (world +X is camera right, world look vector is -camOffsetUnit)
    this._dir.set(0, -camOffsetUnitY, -camOffsetUnitZ).normalize();
    this._right.set(1, 0, 0);
    this._up.crossVectors(this._right, this._dir).normalize();

    const vFovRad = THREE.MathUtils.degToRad(fov);
    const tanHalfV = Math.tan(vFovRad * 0.5);
    const tanHalfH = tanHalfV * this.aspect;

    // Reserve clean screen margin for top HUD / bottom power bar
    const isShortLandscape = !isPortrait && this.viewportHeight < 500;
    const fillH = isPortrait ? 0.92 : 0.88;
    const fillV = isShortLandscape ? 0.76 : 0.82;

    // Bounding box of full playable tabletop + edge margin (for pen sweeps & visible desk edge)
    const halfW = TABLE_HALF_W + 0.35;
    const halfD = TABLE_HALF_D + 0.35;
    const ys = [-0.60, 0.35];

    let requiredDist = 12.0;

    for (const sx of [-halfW, halfW]) {
      for (const sz of [-halfD, halfD]) {
        for (const sy of ys) {
          this._corner.set(sx, sy, sz).sub(this.baseLookAt);
          const projX = Math.abs(this._corner.dot(this._right));
          const projY = Math.abs(this._corner.dot(this._up));
          const depthOffset = -this._corner.dot(this._dir);

          const dH = projX / (tanHalfH * fillH) + depthOffset;
          const dV = projY / (tanHalfV * fillV) + depthOffset;
          requiredDist = Math.max(requiredDist, dH, dV);
        }
      }
    }

    this.targetPosition.set(
      0,
      this.baseLookAt.y + camOffsetUnitY * requiredDist,
      this.baseLookAt.z + camOffsetUnitZ * requiredDist
    );
  }

  public addShake(amount: number): void {
    this.shakeIntensity = Math.min(0.45, this.shakeIntensity + amount);
  }

  /**
   * Short camera follow for a Special Shot. Only the look target is nudged toward the acting pen
   * (a fraction of the way, damped by `strength`), so the framing stays stable and readable —
   * there is no zoom, no roll and no extra shake. Pass `null` to release the focus.
   */
  public setShotFocus(position: { x: number; y: number; z: number } | null, strength = 1): void {
    if (position) {
      this.shotFocusPoint.set(position.x, Math.max(0, position.y), position.z);
      this.shotFocusWeight = THREE.MathUtils.clamp(strength, 0, 1);
    } else {
      this.shotFocusWeight = 0;
    }
  }

  public update(delta: number): void {
    const dt = Math.min(delta, 0.05);

    let desiredX = this.targetPosition.x;
    let desiredY = this.targetPosition.y;
    let desiredZ = this.targetPosition.z;

    if (this.isMenuMode) {
      this.menuOrbitTime += dt * 0.32;
      desiredX += Math.sin(this.menuOrbitTime) * 2.1;
      desiredY += Math.cos(this.menuOrbitTime * 0.7) * 0.4;
    }

    const lambda = 8.0;
    this.currentPosition.x = THREE.MathUtils.damp(this.currentPosition.x, desiredX, lambda, dt);
    this.currentPosition.y = THREE.MathUtils.damp(this.currentPosition.y, desiredY, lambda, dt);
    this.currentPosition.z = THREE.MathUtils.damp(this.currentPosition.z, desiredZ, lambda, dt);

    this.camera.position.copy(this.currentPosition);

    if (this.shakeIntensity > 0.001) {
      const s = this.shakeIntensity;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.8;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 14, dt);
    } else {
      this.shakeIntensity = 0;
    }

    this.currentLookAt.copy(this.baseLookAt);
    if (this.shotFocusWeight > 0.001) {
      // Ease a fraction of the way toward the acting pen — a soft follow, never a hard cut.
      this._lookTmp.copy(this.baseLookAt);
      this._lookTmp.x += (this.shotFocusPoint.x - this.baseLookAt.x) * 0.22 * this.shotFocusWeight;
      this._lookTmp.z += (this.shotFocusPoint.z - this.baseLookAt.z) * 0.22 * this.shotFocusWeight;
      this.currentLookAt.copy(this._lookTmp);
    }
    this.camera.lookAt(this.currentLookAt);
  }
}
