import * as THREE from 'three';
import { EffectQuality, PlayerId } from './GameState';

/**
 * SPECIAL SHOT MOTION TRAILS
 * --------------------------
 * A pooled, allocation-free ribbon that traces each pen's writing tip while its Special Shot is
 * running. Ring buffers (up to 6 pens simultaneously for 3v3 multiplayer) feed a single
 * InstancedMesh, so trails cost one draw call and nothing is allocated per frame. Beads taper
 * toward the tail and dissolve shortly after the shot ends.
 */

const MAX_SEGMENTS = 48;
const REDUCED_SEGMENTS = 18;
const MAX_TRAILS = 6;
const MIN_STEP_SQ = 0.0025; // ~5cm between beads keeps the ribbon smooth and cheap

interface TrailState {
  colorHex: number;
  head: number;
  count: number;
  linger: number;
  running: boolean;
  readonly xs: Float32Array;
  readonly ys: Float32Array;
  readonly zs: Float32Array;
}

export class ShotTrailSystem {
  public readonly group = new THREE.Group();

  private readonly geo: THREE.SphereGeometry;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly colorTmp = new THREE.Color();
  private readonly trails = new Map<PlayerId, TrailState>();

  private segments = MAX_SEGMENTS;
  private quality: EffectQuality = 'HIGH';

  constructor() {
    this.geo = new THREE.SphereGeometry(0.072, 8, 6);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, MAX_SEGMENTS * MAX_TRAILS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    for (let i = 0; i < MAX_SEGMENTS * MAX_TRAILS; i++) {
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.colorTmp);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.group.add(this.mesh);

    this.getOrCreate('player');
    this.getOrCreate('bot');
  }

  private createState(): TrailState {
    return {
      colorHex: 0xffffff,
      head: 0,
      count: 0,
      linger: 0,
      running: false,
      xs: new Float32Array(MAX_SEGMENTS),
      ys: new Float32Array(MAX_SEGMENTS),
      zs: new Float32Array(MAX_SEGMENTS),
    };
  }

  private getOrCreate(id: PlayerId): TrailState {
    let t = this.trails.get(id);
    if (!t) {
      // Recycle an idle slot if we somehow exceed MAX_TRAILS keys across sessions.
      if (this.trails.size >= MAX_TRAILS) {
        for (const [existingId, state] of this.trails.entries()) {
          if (!state.running && state.count === 0) {
            this.trails.delete(existingId);
            break;
          }
        }
      }
      t = this.createState();
      this.trails.set(id, t);
    }
    return t;
  }

  /**
   * Applies the resolved effect tier. `OFF` hides the ribbon entirely and short-circuits its
   * update, `LOW` gives a shorter, non-glowing ribbon, `HIGH` is the full additive ribbon.
   */
  public setQuality(tier: EffectQuality): void {
    if (this.quality === tier) return;
    this.quality = tier;
    this.group.visible = tier !== 'OFF';
    if (tier === 'OFF') {
      this.reset();
      return;
    }

    const reduced = tier === 'LOW';
    this.segments = reduced ? REDUCED_SEGMENTS : MAX_SEGMENTS;
    this.mat.blending = reduced ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.mat.opacity = reduced ? 0.72 : 0.9;
    this.mat.needsUpdate = true;
    for (const t of this.trails.values()) {
      t.count = Math.min(t.count, this.segments);
      t.head = t.head % this.segments;
    }
    this.hideAll();
  }

  /** Starts a fresh ribbon for a pen in the shot's own colour. */
  public begin(id: PlayerId, colorHex: number): void {
    const t = this.getOrCreate(id);
    t.colorHex = colorHex;
    t.head = 0;
    t.count = 0;
    t.linger = 0;
    t.running = true;
  }

  /** Appends a bead at the pen's tip. `colorHex` is ignored unless it differs from the current run. */
  public push(id: PlayerId, x: number, y: number, z: number, colorHex: number): void {
    const t = this.getOrCreate(id);
    if (!t.running || t.colorHex !== colorHex) {
      this.begin(id, colorHex);
    }
    const cap = this.segments;
    if (t.count > 0) {
      const last = (t.head - 1 + cap) % cap;
      const dx = x - t.xs[last];
      const dy = y - t.ys[last];
      const dz = z - t.zs[last];
      if (dx * dx + dy * dy + dz * dz < MIN_STEP_SQ) {
        t.linger = 0.3;
        return;
      }
    }
    t.xs[t.head] = x;
    t.ys[t.head] = y;
    t.zs[t.head] = z;
    t.head = (t.head + 1) % cap;
    if (t.count < cap) t.count++;
    t.linger = 0.3;
  }

  /** Stops growing the ribbon; the existing beads dissolve over the next few frames. */
  public end(id: PlayerId): void {
    const t = this.trails.get(id);
    if (!t || !t.running) return;
    t.running = false;
    if (t.linger <= 0) t.linger = 0.22;
  }

  public reset(): void {
    this.trails.clear();
    this.hideAll();
  }

  public update(dt: number): void {
    // Effects disabled: nothing to fade and nothing to rebuild.
    if (this.quality === 'OFF') return;
    const cap = this.segments;
    for (const t of this.trails.values()) {
      if (!t.running && t.count > 0) {
        t.linger -= dt;
        if (t.linger <= 0) {
          t.count = Math.max(0, t.count - Math.max(1, Math.round(dt * cap * 4)));
        }
      }
    }
    this.rebuild();
  }

  private rebuild(): void {
    const cap = this.segments;
    const maxInstances = MAX_SEGMENTS * MAX_TRAILS;
    let slot = 0;

    for (const t of this.trails.values()) {
      if (slot + cap > maxInstances) break;
      this.colorTmp.setHex(t.colorHex);
      for (let i = 0; i < cap; i++) {
        if (i >= t.count) {
          this.dummy.position.set(0, -100, 0);
          this.dummy.scale.setScalar(0.001);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(slot, this.dummy.matrix);
        } else {
          const idx = (t.head - t.count + i + cap) % cap;
          const fade = t.count > 1 ? i / (t.count - 1) : 1;
          this.dummy.position.set(t.xs[idx], t.ys[idx], t.zs[idx]);
          this.dummy.scale.setScalar(0.28 + 0.72 * fade);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(slot, this.dummy.matrix);
          this.mesh.setColorAt(slot, this.colorTmp);
        }
        slot += 1;
      }
    }

    // Ensure unused instances stay parked below the floor.
    if (slot < maxInstances) {
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      while (slot < maxInstances) {
        this.mesh.setMatrixAt(slot, this.dummy.matrix);
        slot += 1;
      }
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private hideAll(): void {
    this.dummy.position.set(0, -100, 0);
    this.dummy.scale.setScalar(0.001);
    this.dummy.updateMatrix();
    for (let i = 0; i < MAX_SEGMENTS * MAX_TRAILS; i++) {
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
