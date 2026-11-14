import * as THREE from 'three';
import { EffectQuality } from './GameState';

// Impact palettes, hoisted to module scope so a collision burst never allocates an array.
const PALETTE_COOL = [0xfef3c7, 0xfde68a, 0xfcd34d];
const PALETTE_WARM = [0xffffff, 0xfbbf24, 0xf59e0b, 0x60a5fa];
const PALETTE_HOT = [0xffffff, 0xfef08a, 0xf97316, 0x38bdf8, 0xf43f5e];
const PALETTE_CONFETTI = [0x3b82f6, 0xf59e0b, 0x10b981, 0xef4444, 0xfbbf24];

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotSpeedX: number;
  rotSpeedY: number;
  life: number;
  maxLife: number;
  scale: number;
  drag: number;
  color: THREE.Color;
}

interface ShockwaveRing {
  active: boolean;
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxScale: number;
  baseOpacity: number;
}

export class ParticleSystem {
  public readonly group = new THREE.Group();
  public readonly mesh: THREE.InstancedMesh;

  private readonly particles: Particle[] = [];
  private readonly shockwaves: ShockwaveRing[] = [];
  private readonly maxCount = 180;
  private readonly dummy = new THREE.Object3D();
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly ringGeo: THREE.RingGeometry;
  private readonly _tangent = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);
  /** Resolved particle tier: OFF disables effects entirely, LOW thin-density, HIGH full. */
  private quality: EffectQuality = 'HIGH';

  /**
   * Sets the particle tier. OFF hides the whole pool (including the pooled shockwave rings) and
   * short-circuits every spawn, so a weak device pays nothing at all for effects.
   */
  public setQuality(tier: EffectQuality): void {
    if (this.quality === tier) return;
    this.quality = tier;
    const visible = tier !== 'OFF';
    this.group.visible = visible;
    if (!visible) this.clearActive();
  }

  private get density(): number {
    return this.quality === 'LOW' ? 0.42 : 1;
  }

  /** Parks every live particle/ring so nothing pops back into view when effects are re-enabled. */
  private clearActive(): void {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const sw of this.shockwaves) {
      sw.active = false;
      sw.mesh.visible = false;
    }
  }

  constructor() {
    this.geo = new THREE.OctahedronGeometry(0.068, 0);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.94,
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    for (let i = 0; i < this.maxCount; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(0, -100, 0),
        vel: new THREE.Vector3(),
        rotSpeedX: 8,
        rotSpeedY: 6,
        life: 0,
        maxLife: 1,
        scale: 0,
        drag: 1.5,
        color: new THREE.Color(0xffffff),
      });
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, new THREE.Color(0xffffff));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.group.add(this.mesh);

    // Pooled 3D impact shockwave rings at exact pen collision points
    this.ringGeo = new THREE.RingGeometry(0.18, 0.28, 28);
    this.ringGeo.rotateX(-Math.PI * 0.5);
    for (let i = 0; i < 6; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(this.ringGeo, ringMat);
      ringMesh.visible = false;
      this.group.add(ringMesh);
      this.shockwaves.push({
        active: false,
        mesh: ringMesh,
        life: 0,
        maxLife: 0.25,
        maxScale: 1,
        baseOpacity: 0.7,
      });
    }
  }

  /**
   * Triggers a velocity-scaled impact spark burst and expanding shockwave ring at the exact pen-to-pen contact point.
   */
  public spawnCollisionBurst(
    origin: THREE.Vector3,
    normal: THREE.Vector3,
    impactSpeed: number
  ): void {
    if (this.quality === 'OFF') return;
    const intensity = THREE.MathUtils.clamp((impactSpeed - 0.6) / 16.0, 0.08, 1.0);
    const density = this.density;
    const sparkCount = Math.max(
      3,
      Math.round(THREE.MathUtils.lerp(7, 36, Math.pow(intensity, 0.85)) * density)
    );
    const baseSpeed = THREE.MathUtils.lerp(2.4, 10.5, intensity);
    const baseScale = THREE.MathUtils.lerp(0.62, 1.75, intensity);
    const baseLife = THREE.MathUtils.lerp(0.22, 0.48, intensity);

    // Build an orthonormal tangent perpendicular to collision normal in XZ plane
    this._tangent.crossVectors(normal, this._up);
    if (this._tangent.lengthSq() < 1e-4) {
      this._tangent.set(1, 0, 0);
    } else {
      this._tangent.normalize();
    }

    // Color palette shifts hotter with collision velocity (module-level, never allocated here)
    const palette =
      intensity < 0.35 ? PALETTE_COOL : intensity < 0.7 ? PALETTE_WARM : PALETTE_HOT;

    let spawned = 0;
    for (let i = 0; i < this.maxCount && spawned < sparkCount; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      p.active = true;
      p.pos.copy(origin);

      // Spray primarily outward perpendicular to the pen collision seam + radial scatter
      const angle = Math.random() * Math.PI * 2;
      const radialSpeed = (0.4 + Math.random() * 0.85) * baseSpeed;
      const seamSpread = (Math.random() - 0.5) * 2.0 * radialSpeed * 0.85;
      const normalKick = (Math.random() - 0.5) * 1.4 * radialSpeed * 0.6;

      p.vel.set(
        this._tangent.x * seamSpread + normal.x * normalKick + Math.cos(angle) * radialSpeed * 0.45,
        1.5 + Math.random() * baseSpeed * 0.85,
        this._tangent.z * seamSpread + normal.z * normalKick + Math.sin(angle) * radialSpeed * 0.45
      );

      p.maxLife = baseLife * (0.75 + Math.random() * 0.5);
      p.life = p.maxLife;
      p.scale = baseScale * (0.65 + Math.random() * 0.7);
      p.drag = 2.6;
      p.rotSpeedX = 6 + Math.random() * 14;
      p.rotSpeedY = 6 + Math.random() * 14;
      p.color.setHex(palette[spawned % palette.length]);
      this.mesh.setColorAt(i, p.color);
      spawned++;
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    // Trigger expanding shockwave ring scaled by collision intensity
    this.spawnShockwave(origin, this.quality === 'LOW' ? intensity * 0.7 : intensity);
  }

  private spawnShockwave(origin: THREE.Vector3, intensity: number): void {
    for (const sw of this.shockwaves) {
      if (sw.active) continue;
      sw.active = true;
      sw.maxLife = THREE.MathUtils.lerp(0.18, 0.34, intensity);
      sw.life = sw.maxLife;
      sw.maxScale = THREE.MathUtils.lerp(1.3, 4.6, intensity);
      sw.baseOpacity = THREE.MathUtils.lerp(0.45, 0.92, intensity);

      sw.mesh.position.set(origin.x, Math.max(0.03, origin.y * 0.35), origin.z);
      sw.mesh.scale.setScalar(0.35);
      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(intensity > 0.65 ? 0xfbbf24 : 0xfef08a);
      mat.opacity = sw.baseOpacity;
      sw.mesh.visible = true;
      break;
    }
  }

  public spawnBurst(
    origin: THREE.Vector3,
    count: number,
    colorHex: number,
    speed = 4.5
  ): void {
    if (this.quality === 'OFF') return;
    const budget = this.quality === 'LOW' ? Math.max(2, Math.round(count * 0.5)) : count;
    let spawned = 0;
    for (let i = 0; i < this.maxCount && spawned < budget; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      p.active = true;
      p.pos.copy(origin);
      const theta = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.75) * speed;
      p.vel.set(
        Math.cos(theta) * spd,
        1.8 + Math.random() * speed * 0.75,
        Math.sin(theta) * spd
      );
      p.maxLife = 0.28 + Math.random() * 0.26;
      p.life = p.maxLife;
      p.scale = 0.7 + Math.random() * 0.85;
      p.drag = 1.5;
      p.rotSpeedX = 8;
      p.rotSpeedY = 6;
      p.color.setHex(colorHex);
      this.mesh.setColorAt(i, p.color);
      spawned++;
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public spawnConfetti(origin: THREE.Vector3): void {
    for (let c = 0; c < PALETTE_CONFETTI.length; c++) {
      this.spawnBurst(origin, 10, PALETTE_CONFETTI[c], 6.5);
    }
  }

  /**
   * Expanding coloured ring for a Special Shot pulse (activation flourish / SHOCKWAVE release).
   * Reuses the pooled shockwave rings so no geometry is ever created at runtime.
   */
  public spawnAbilityRing(origin: THREE.Vector3, colorHex: number, maxScale = 4.0): void {
    if (this.quality === 'OFF') return;
    for (const sw of this.shockwaves) {
      if (sw.active) continue;
      sw.active = true;
      sw.maxLife = 0.42;
      sw.life = sw.maxLife;
      sw.maxScale = Math.max(0.6, maxScale);
      sw.baseOpacity = 0.82;
      sw.mesh.position.set(origin.x, Math.max(0.04, origin.y * 0.35), origin.z);
      sw.mesh.scale.setScalar(0.4);
      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(colorHex);
      mat.opacity = sw.baseOpacity;
      sw.mesh.visible = true;
      break;
    }
  }

  public update(delta: number): void {
    // Effects disabled: skip the whole simulation — the pool is already parked and hidden.
    if (this.quality === 'OFF') return;
    const dt = Math.min(delta, 0.05);
    let anyDirty = false;

    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      anyDirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.dummy.position.set(0, -100, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      const damp = Math.exp(-p.drag * dt);
      p.vel.x *= damp;
      p.vel.z *= damp;
      p.vel.y = p.vel.y * damp - 18 * dt;
      p.pos.addScaledVector(p.vel, dt);

      // Bounce lightly if spark hits tabletop level
      if (p.pos.y < 0.03 && p.vel.y < 0) {
        p.pos.y = 0.03;
        p.vel.y *= -0.35;
      }

      const t = p.life / p.maxLife;
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.x += dt * p.rotSpeedX;
      this.dummy.rotation.y += dt * p.rotSpeedY;
      this.dummy.scale.setScalar(p.scale * (0.25 + 0.75 * t));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    if (anyDirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }

    // Update expanding shockwave rings
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      sw.life -= dt;
      if (sw.life <= 0) {
        sw.active = false;
        sw.mesh.visible = false;
        continue;
      }
      const progress = 1 - sw.life / sw.maxLife;
      const eased = 1 - Math.pow(1 - progress, 3);
      sw.mesh.scale.setScalar(0.35 + (sw.maxScale - 0.35) * eased);
      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = sw.baseOpacity * (1 - progress);
    }
  }

  public dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.ringGeo.dispose();
    for (const sw of this.shockwaves) {
      (sw.mesh.material as THREE.Material).dispose();
    }
  }
}
