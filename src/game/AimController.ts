import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { DragStateView } from './DragController';
import { PredictedTrajectoryPoint, PhysicsManager, TrajectoryPrediction } from './PhysicsManager';

/** The per-step program `PhysicsManager.predictAbilityTrajectory` replays for a Special Shot. */
export type AbilityProgramApply = Parameters<
  PhysicsManager['predictAbilityTrajectory']
>[0]['apply'];

/**
 * Everything the aim preview needs to render a Special Shot's REAL predicted path instead of a
 * normal launch arc. `createProgram` is called with the player's own aimed direction, so the
 * preview always shows exactly what the shot's forces will do — never an auto-tracked target.
 */
export interface AbilityPreviewSource {
  colorHex: number;
  durationSeconds: number;
  coastSeconds: number;
  createProgram: (dirX: number, dirZ: number) => AbilityProgramApply;
}

export class AimController {
  public readonly group = new THREE.Group();

  // Grab anchor reticle
  private readonly grabGroup = new THREE.Group();
  private readonly grabRing: THREE.Mesh;
  private readonly grabPin: THREE.Mesh;
  private readonly grabMat: THREE.MeshBasicMaterial;

  // Pull tension tether
  private readonly pullLine: THREE.Line;
  private readonly pullLineGeo: THREE.BufferGeometry;
  private readonly pullLineMat: THREE.LineBasicMaterial;

  // Sleek direction arrow
  private readonly arrowShaft: THREE.Mesh;
  private readonly arrowHead: THREE.Mesh;
  private readonly arrowMat: THREE.MeshBasicMaterial;

  // Target landing crosshair (4-tick tactical reticle + contrast backdrop)
  private readonly landingGroup = new THREE.Group();
  private readonly landingReticleSpinGroup = new THREE.Group();
  private readonly landingMat: THREE.MeshBasicMaterial;
  private readonly landingGlowMat: THREE.MeshBasicMaterial;

  // Opponent collision lock crosshair (diagonal X lock-on)
  private readonly impactGroup = new THREE.Group();
  private readonly deflectDot: THREE.Mesh;

  private readonly dotsMesh: THREE.InstancedMesh;
  private readonly dotMat: THREE.MeshBasicMaterial;
  private readonly dotCount = 24;
  private readonly dummy = new THREE.Object3D();
  private readonly colorTmp = new THREE.Color();
  private readonly filteredPts: PredictedTrajectoryPoint[] = [];
  private readonly disposables: Array<{ dispose: () => void }> = [];

  private showTrajectory = true;
  private precisionMode = false;
  private lastPredictTime = 0;
  private cachedPrediction: TrajectoryPrediction | null = null;
  private abilityPreview: AbilityPreviewSource | null = null;

  private readonly _colorZoneLow = new THREE.Color(0x0284c7);
  private readonly _colorZoneMed = new THREE.Color(0x059669);
  private readonly _colorZoneHigh = new THREE.Color(0xd97706);
  private readonly _colorZoneMax = new THREE.Color(0xdc2626);
  private readonly _activeColor = new THREE.Color();

  constructor() {
    this.group.visible = false;

    // 1. Grab-point tactical anchor crosshair
    this.grabMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const grabDarkMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const grabBackGeo = new THREE.RingGeometry(0.15, 0.27, 28);
    grabBackGeo.rotateX(-Math.PI * 0.5);
    const grabBack = new THREE.Mesh(grabBackGeo, grabDarkMat);
    grabBack.position.y = -0.002;

    const ringGeo = new THREE.RingGeometry(0.17, 0.22, 28);
    ringGeo.rotateX(-Math.PI * 0.5);
    this.grabRing = new THREE.Mesh(ringGeo, this.grabMat);

    const grabTickGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.PlaneGeometry(0.038, 0.11);
      g.rotateX(-Math.PI * 0.5);
      const angle = (i * Math.PI) / 2;
      const dist = 0.27;
      g.rotateY(angle);
      g.translate(Math.sin(angle) * dist, 0.001, Math.cos(angle) * dist);
      grabTickGeos.push(g);
    }
    const mergedGrabTickGeo = BufferGeometryUtils.mergeGeometries(grabTickGeos, false) ?? grabTickGeos[0];
    for (const g of grabTickGeos) if (g !== mergedGrabTickGeo) g.dispose();
    const grabTicksMesh = new THREE.Mesh(mergedGrabTickGeo, this.grabMat);
    this.grabGroup.add(grabTicksMesh);

    const pinGeo = new THREE.SphereGeometry(0.068, 12, 12);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.grabPin = new THREE.Mesh(pinGeo, pinMat);

    this.grabGroup.add(grabBack, this.grabRing);
    this.group.add(this.grabGroup, this.grabPin);
    this.disposables.push(
      grabBackGeo,
      ringGeo,
      mergedGrabTickGeo,
      pinGeo,
      this.grabMat,
      grabDarkMat,
      pinMat
    );

    // 2. Pull displacement tether line
    this.pullLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    this.pullLineMat = new THREE.LineBasicMaterial({
      color: 0x475569,
      transparent: true,
      opacity: 0.85,
    });
    this.pullLine = new THREE.Line(this.pullLineGeo, this.pullLineMat);
    this.group.add(this.pullLine);
    this.disposables.push(this.pullLineGeo, this.pullLineMat);

    // 3. Sleek launch direction arrow (shaft + sharp chevron head)
    this.arrowMat = new THREE.MeshBasicMaterial({
      color: 0x059669,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const shaftGeo = new THREE.PlaneGeometry(0.095, 1.0);
    shaftGeo.rotateX(-Math.PI * 0.5);
    shaftGeo.translate(0, 0, 0.5);
    this.arrowShaft = new THREE.Mesh(shaftGeo, this.arrowMat);

    const headShape = new THREE.Shape();
    headShape.moveTo(0, 0.34);
    headShape.lineTo(-0.22, -0.04);
    headShape.lineTo(0, 0.06);
    headShape.lineTo(0.22, -0.04);
    headShape.closePath();
    const headGeo = new THREE.ShapeGeometry(headShape);
    headGeo.rotateX(Math.PI * 0.5);
    this.arrowHead = new THREE.Mesh(headGeo, this.arrowMat);

    this.group.add(this.arrowShaft, this.arrowHead);
    this.disposables.push(shaftGeo, headGeo, this.arrowMat);

    // 4. Physics-predicted 3D trajectory markers — unified into a single InstancedMesh draw call
    const dotGeo = new THREE.CylinderGeometry(0.056, 0.056, 0.018, 10);
    this.dotMat = new THREE.MeshBasicMaterial({
      color: 0x059669,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.dotsMesh = new THREE.InstancedMesh(dotGeo, this.dotMat, this.dotCount);
    this.dotsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dotsMesh.visible = false;
    for (let i = 0; i < this.dotCount; i++) {
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.dotsMesh.setMatrixAt(i, this.dummy.matrix);
      this.dotsMesh.setColorAt(i, this._activeColor);
    }
    this.dotsMesh.instanceMatrix.needsUpdate = true;
    if (this.dotsMesh.instanceColor) this.dotsMesh.instanceColor.needsUpdate = true;
    this.group.add(this.dotsMesh);
    this.disposables.push(dotGeo, this.dotMat);

    // 5. Target landing / resting crosshair
    this.landingMat = new THREE.MeshBasicMaterial({
      color: 0x059669,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.landingGlowMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const landBackdropGeo = new THREE.RingGeometry(0.24, 0.36, 28);
    landBackdropGeo.rotateX(-Math.PI * 0.5);
    const landBackdrop = new THREE.Mesh(landBackdropGeo, this.landingGlowMat);
    landBackdrop.position.y = -0.002;

    const landOuterGeo = new THREE.RingGeometry(0.275, 0.33, 28);
    landOuterGeo.rotateX(-Math.PI * 0.5);
    const landOuter = new THREE.Mesh(landOuterGeo, this.landingMat);

    const landDotGeo = new THREE.CircleGeometry(0.055, 14);
    landDotGeo.rotateX(-Math.PI * 0.5);
    const landCenterPip = new THREE.Mesh(landDotGeo, this.landingMat);

    const landTickGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.PlaneGeometry(0.048, 0.22);
      g.rotateX(-Math.PI * 0.5);
      const angle = (i * Math.PI) / 2;
      const dist = 0.34;
      g.rotateY(angle);
      g.translate(Math.sin(angle) * dist, 0.001, Math.cos(angle) * dist);
      landTickGeos.push(g);
    }
    const mergedLandTickGeo = BufferGeometryUtils.mergeGeometries(landTickGeos, false) ?? landTickGeos[0];
    for (const g of landTickGeos) if (g !== mergedLandTickGeo) g.dispose();
    const landTicksMesh = new THREE.Mesh(mergedLandTickGeo, this.landingMat);

    this.landingReticleSpinGroup.add(landOuter, landTicksMesh);
    this.landingGroup.add(landBackdrop, this.landingReticleSpinGroup, landCenterPip);
    this.landingGroup.visible = false;
    this.group.add(this.landingGroup);
    this.disposables.push(
      landBackdropGeo,
      landOuterGeo,
      landDotGeo,
      mergedLandTickGeo,
      this.landingMat,
      this.landingGlowMat
    );

    // 6. Predicted opponent collision lock crosshair
    const impMat = new THREE.MeshBasicMaterial({
      color: 0xe11d48,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const impBackMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const impBackGeo = new THREE.RingGeometry(0.32, 0.48, 28);
    impBackGeo.rotateX(-Math.PI * 0.5);
    const impBack = new THREE.Mesh(impBackGeo, impBackMat);
    impBack.position.y = -0.002;

    const impRingGeo = new THREE.RingGeometry(0.36, 0.43, 28);
    impRingGeo.rotateX(-Math.PI * 0.5);
    const impRing = new THREE.Mesh(impRingGeo, impMat);

    const impTickGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.PlaneGeometry(0.056, 0.26);
      g.rotateX(-Math.PI * 0.5);
      const angle = Math.PI * 0.25 + (i * Math.PI) / 2;
      const dist = 0.39;
      g.rotateY(angle);
      g.translate(Math.sin(angle) * dist, 0.001, Math.cos(angle) * dist);
      impTickGeos.push(g);
    }
    const mergedImpTickGeo = BufferGeometryUtils.mergeGeometries(impTickGeos, false) ?? impTickGeos[0];
    for (const g of impTickGeos) if (g !== mergedImpTickGeo) g.dispose();
    const impTicksMesh = new THREE.Mesh(mergedImpTickGeo, impMat);

    this.impactGroup.add(impBack, impRing, impTicksMesh);
    this.impactGroup.visible = false;

    const defGeo = new THREE.RingGeometry(0.14, 0.21, 20);
    defGeo.rotateX(-Math.PI * 0.5);
    const defMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.deflectDot = new THREE.Mesh(defGeo, defMat);
    this.deflectDot.visible = false;

    this.group.add(this.impactGroup, this.deflectDot);
    this.disposables.push(
      impBackGeo,
      impRingGeo,
      mergedImpTickGeo,
      impMat,
      impBackMat,
      defGeo,
      defMat
    );
  }

  public setTrajectoryVisible(visible: boolean): void {
    this.showTrajectory = visible;
    if (!visible) {
      this.hideTrajectoryVisuals();
    }
  }

  /**
   * PRECISION PULL feedback only. This enriches what the player can SEE (denser trajectory
   * pips, faster re-prediction, a steadier landing reticle). It never alters the launch
   * direction, impulse or any physics value, so the player's aim is always their own.
   */
  public setPrecisionMode(active: boolean): void {
    this.precisionMode = active;
  }

  /**
   * Arms the Special Shot preview. When set, the aim overlay renders the equipped pen's REAL
   * Special Shot trajectory (driven by the same per-step program the live shot uses) in the shot's
   * signature colour. Prediction runs in the isolated prediction world, so nothing here can affect
   * actual gameplay. Pass `null` to fall back to the normal launch arc.
   */
  public setAbilityPreview(source: AbilityPreviewSource | null): void {
    this.abilityPreview = source;
    if (!source) {
      this.cachedPrediction = null;
    }
  }

  private hideTrajectoryVisuals(): void {
    this.dotsMesh.visible = false;
    this.impactGroup.visible = false;
    this.landingGroup.visible = false;
    this.deflectDot.visible = false;
  }

  public update(drag: DragStateView, physics: PhysicsManager): void {
    if (!drag.isDragging) {
      this.group.visible = false;
      this.cachedPrediction = null;
      return;
    }
    this.group.visible = true;

    const now = performance.now();

    // Highlighted grab crosshair locked onto the pen's live world anchor
    this.grabGroup.position.set(
      drag.worldAnchor.x,
      Math.max(0.035, drag.worldAnchor.y - 0.075),
      drag.worldAnchor.z
    );
    this.grabGroup.rotation.y = now * 0.0009;
    this.grabPin.position.set(drag.worldAnchor.x, drag.worldAnchor.y + 0.145, drag.worldAnchor.z);

    // Dynamic pull tension tether from grabbed anchor to pointer world target
    const posAttr = this.pullLineGeo.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setXYZ(0, drag.worldAnchor.x, 0.055, drag.worldAnchor.z);
    posAttr.setXYZ(1, drag.pointerWorldPos.x, 0.055, drag.pointerWorldPos.z);
    posAttr.needsUpdate = true;

    if (!drag.canLaunch) {
      this.arrowShaft.visible = false;
      this.arrowHead.visible = false;
      this.hideTrajectoryVisuals();
      this.cachedPrediction = null;
      return;
    }

    // 4-zone power color mapping: Low (0-30%), Medium (31-60%), High (61-85%), Maximum (86-100%).
    // While a Special Shot is armed the whole overlay takes the shot's signature colour instead,
    // so the player can tell at a glance that the preview is showing ability physics, not a normal arc.
    if (this.abilityPreview) {
      this._activeColor.setHex(this.abilityPreview.colorHex);
    } else if (drag.powerZone === 'LOW') {
      this._activeColor.copy(this._colorZoneLow);
    } else if (drag.powerZone === 'MEDIUM') {
      this._activeColor.copy(this._colorZoneMed);
    } else if (drag.powerZone === 'HIGH') {
      this._activeColor.copy(this._colorZoneHigh);
    } else {
      this._activeColor.copy(this._colorZoneMax);
    }
    this.arrowMat.color.copy(this._activeColor);
    this.pullLineMat.color.copy(this._activeColor);

    // Sleek launch direction arrow from grabbed point
    const arrowLen = 0.65 + drag.powerRatio * 1.95;
    const yaw = Math.atan2(drag.launchDir.x, drag.launchDir.z);

    this.arrowShaft.visible = true;
    this.arrowShaft.position.set(drag.worldAnchor.x, 0.048, drag.worldAnchor.z);
    this.arrowShaft.rotation.y = yaw;
    this.arrowShaft.scale.set(1, 1, arrowLen);

    this.arrowHead.visible = true;
    this.arrowHead.position.set(
      drag.worldAnchor.x + drag.launchDir.x * arrowLen,
      0.049,
      drag.worldAnchor.z + drag.launchDir.z * arrowLen
    );
    this.arrowHead.rotation.y = yaw;

    if (!this.showTrajectory) {
      this.hideTrajectoryVisuals();
      return;
    }

    // Run lightweight Rapier prediction simulation (throttled ~32ms so mobile stays at 60fps;
    // PRECISION PULL tightens the refresh so the preview tracks the pull more responsively).
    // Armed Special Shots replay their real physics program in the isolated prediction world.
    const predictInterval = this.precisionMode ? 16 : 32;
    if (!this.cachedPrediction || now - this.lastPredictTime >= predictInterval) {
      this.lastPredictTime = now;
      const preview = this.abilityPreview;
      if (preview) {
        this.cachedPrediction = physics.predictAbilityTrajectory({
          durationSeconds: preview.durationSeconds,
          coastSeconds: preview.coastSeconds,
          sampleInterval: 3,
          casterId: drag.activePenId,
          apply: preview.createProgram(drag.launchDir.x, drag.launchDir.z),
        });
      } else {
        this.cachedPrediction = physics.predictTrajectory({
          localAnchor: { x: drag.localAnchor.x, y: drag.localAnchor.y, z: drag.localAnchor.z },
          impulse: {
            x: drag.launchDir.x * drag.deltaImpulse,
            y: 0.06,
            z: drag.launchDir.z * drag.deltaImpulse,
          },
          preserveOnly: drag.preserveOnly,
          shooterId: drag.activePenId,
          steps: 108,
          sampleInterval: 3,
        });
      }
    }

    this.renderPrediction(this.cachedPrediction, now);
  }

  private renderPrediction(pred: TrajectoryPrediction, nowMs: number): void {
    const rawPts = pred.points;
    const land = pred.landingPoint;

    // Filter predicted points by minimum world-space distance so decelerating dots never bunch into a blob.
    // PRECISION PULL packs the pips tighter for a finer read on the projected path.
    this.filteredPts.length = 0;
    let prevX = Number.NaN;
    let prevZ = Number.NaN;
    const minSpacingSq = (this.precisionMode ? 0.19 : 0.28) ** 2;
    const clearRadiusSq = 0.42 * 0.42;

    for (let i = 0; i < rawPts.length; i++) {
      const pt = rawPts[i];
      const dxLand = pt.x - land.x;
      const dzLand = pt.z - land.z;
      if (dxLand * dxLand + dzLand * dzLand < clearRadiusSq) {
        continue;
      }
      if (!Number.isNaN(prevX)) {
        const dx = pt.x - prevX;
        const dz = pt.z - prevZ;
        if (dx * dx + dz * dz < minSpacingSq) {
          continue;
        }
      }
      this.filteredPts.push(pt);
      prevX = pt.x;
      prevZ = pt.z;
      if (this.filteredPts.length >= this.dotCount) break;
    }

    const count = this.filteredPts.length;
    for (let i = 0; i < this.dotCount; i++) {
      if (i < count) {
        const pt = this.filteredPts[i];
        const s = 1.05 - (i / Math.max(1, count)) * 0.35;
        this.dummy.position.set(pt.x, pt.y + 0.02, pt.z);
        this.dummy.scale.set(s, 1, s);
        this.dummy.updateMatrix();
        this.dotsMesh.setMatrixAt(i, this.dummy.matrix);

        this.colorTmp.copy(pt.offTable ? this._colorZoneMax : this._activeColor);
        this.dotsMesh.setColorAt(i, this.colorTmp);
      } else {
        this.dummy.position.set(0, -100, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.dotsMesh.setMatrixAt(i, this.dummy.matrix);
      }
    }
    this.dotsMesh.instanceMatrix.needsUpdate = true;
    if (this.dotsMesh.instanceColor) this.dotsMesh.instanceColor.needsUpdate = true;
    this.dotsMesh.visible = this.showTrajectory && count > 0;

    // Projected landing / resting tactical crosshair
    const landY = land.isOffTable ? land.y + 0.045 : 0.05;
    this.landingMat.color.copy(land.isOffTable ? this._colorZoneMax : this._activeColor);
    this.landingGroup.position.set(land.x, landY, land.z);
    this.landingReticleSpinGroup.rotation.y = nowMs * 0.0011;
    const pulse = this.precisionMode ? 1.0 : 1.0 + Math.sin(nowMs * 0.006) * 0.05;
    this.landingGroup.scale.setScalar(pulse);
    this.landingGroup.visible = true;

    // Predicted opponent collision X-lock crosshair
    if (pred.collisionPoint) {
      this.impactGroup.position.set(pred.collisionPoint.x, 0.06, pred.collisionPoint.z);
      const impPulse = 1.0 + Math.sin(nowMs * 0.01) * 0.08;
      this.impactGroup.scale.setScalar(impPulse);
      this.impactGroup.rotation.y = -nowMs * 0.0014;
      this.impactGroup.visible = true;
    } else {
      this.impactGroup.visible = false;
    }

    if (pred.botDeflectEnd) {
      this.deflectDot.position.set(
        pred.botDeflectEnd.x,
        Math.max(0.055, pred.botDeflectEnd.y),
        pred.botDeflectEnd.z
      );
      this.deflectDot.visible = true;
    } else {
      this.deflectDot.visible = false;
    }
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}
