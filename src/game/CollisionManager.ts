import * as THREE from 'three';
import { PEN_HALF_LENGTH } from '../utils/Constants';
import { PlayerId } from './GameState';

export type ColliderSurface = PlayerId | 'table' | 'floor';

export interface PenKinematicsSnapshot {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
  speed: number;
  halfLength?: number;
}

export interface CollisionCallbacks {
  onPenPenImpact: (
    point: THREE.Vector3,
    normal: THREE.Vector3,
    impactSpeed: number,
    penA?: string,
    penB?: string
  ) => void;
  onPenTableImpact: (
    penId: PlayerId,
    surface: 'table' | 'floor',
    point: THREE.Vector3,
    impactSpeed: number
  ) => void;
}

const _axisA = new THREE.Vector3();
const _axisB = new THREE.Vector3();
const _a0 = new THREE.Vector3();
const _a1 = new THREE.Vector3();
const _b0 = new THREE.Vector3();
const _b1 = new THREE.Vector3();
const _cpA = new THREE.Vector3();
const _cpB = new THREE.Vector3();
const _rA = new THREE.Vector3();
const _rB = new THREE.Vector3();
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _angCross = new THREE.Vector3();
const _impactPt = new THREE.Vector3();
const _impactNormal = new THREE.Vector3();

function closestPointsBetweenSegments(
  p1: THREE.Vector3,
  q1: THREE.Vector3,
  p2: THREE.Vector3,
  q2: THREE.Vector3,
  c1: THREE.Vector3,
  c2: THREE.Vector3
): void {
  const d1x = q1.x - p1.x;
  const d1y = q1.y - p1.y;
  const d1z = q1.z - p1.z;
  const d2x = q2.x - p2.x;
  const d2y = q2.y - p2.y;
  const d2z = q2.z - p2.z;
  const rx = p1.x - p2.x;
  const ry = p1.y - p2.y;
  const rz = p1.z - p2.z;

  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;

  let s = 0;
  let t = 0;
  const eps = 1e-6;

  if (a <= eps && e <= eps) {
    c1.copy(p1);
    c2.copy(p2);
    return;
  }
  if (a <= eps) {
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= eps) {
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      s = denom !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / denom)) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (b - c) / a));
      }
    }
  }

  c1.set(p1.x + d1x * s, p1.y + d1y * s, p1.z + d1z * s);
  c2.set(p2.x + d2x * t, p2.y + d2y * t, p2.z + d2z * t);
}

export class CollisionManager {
  private readonly handleMap = new Map<number, ColliderSurface>();
  private readonly lastPenPenTimes = new Map<string, number>();
  private lastTableTime: Record<string, number> = {};

  public registerCollider(handle: number, surface: ColliderSurface): void {
    this.handleMap.set(handle, surface);
  }

  public unregisterSurface(surface: ColliderSurface): void {
    for (const [handle, s] of this.handleMap.entries()) {
      if (s === surface) {
        this.handleMap.delete(handle);
      }
    }
  }

  public clear(): void {
    this.handleMap.clear();
    this.lastPenPenTimes.clear();
    this.lastTableTime = {};
  }

  public getSurface(handle: number): ColliderSurface | undefined {
    return this.handleMap.get(handle);
  }

  public handleContact(
    h1: number,
    h2: number,
    started: boolean,
    nowMs: number,
    getPenKinematics: (id: PlayerId) => PenKinematicsSnapshot,
    callbacks: CollisionCallbacks
  ): void {
    if (!started) return;
    const s1 = this.handleMap.get(h1);
    const s2 = this.handleMap.get(h2);
    if (!s1 || !s2) return;

    // Pen-to-pen collision between any two different pens
    if (s1 !== 'table' && s1 !== 'floor' && s2 !== 'table' && s2 !== 'floor' && s1 !== s2) {
      const pairKey = s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
      const prevPairTime = this.lastPenPenTimes.get(pairKey) ?? 0;
      if (nowMs - prevPairTime < 75) return;
      const p = getPenKinematics(s1);
      const b = getPenKinematics(s2);
      if (!p || !b) return;

      // Compute exact contact point between the two pen capsule centerlines
      const segHalfP = (p.halfLength ?? PEN_HALF_LENGTH) - 0.14;
      const segHalfB = (b.halfLength ?? PEN_HALF_LENGTH) - 0.14;
      _axisA.set(0, 0, 1).applyQuaternion(p.quat);
      _axisB.set(0, 0, 1).applyQuaternion(b.quat);
      _a0.copy(p.pos).addScaledVector(_axisA, -segHalfP);
      _a1.copy(p.pos).addScaledVector(_axisA, segHalfP);
      _b0.copy(b.pos).addScaledVector(_axisB, -segHalfB);
      _b1.copy(b.pos).addScaledVector(_axisB, segHalfB);

      closestPointsBetweenSegments(_a0, _a1, _b0, _b1, _cpA, _cpB);
      _impactPt.copy(_cpA).add(_cpB).multiplyScalar(0.5);

      _impactNormal.copy(_cpB).sub(_cpA);
      if (_impactNormal.lengthSq() > 1e-6) {
        _impactNormal.normalize();
      } else {
        _impactNormal.copy(b.pos).sub(p.pos).setY(0).normalize();
      }

      // Compute true pre-impact relative velocity at the exact contact point (linear + angular lever)
      _rA.copy(_impactPt).sub(p.pos);
      _rB.copy(_impactPt).sub(b.pos);

      _angCross.crossVectors(p.angVel, _rA);
      _vA.copy(p.vel).add(_angCross);

      _angCross.crossVectors(b.angVel, _rB);
      _vB.copy(b.vel).add(_angCross);

      const impactSpeed = _vA.sub(_vB).length();
      if (impactSpeed > 0.6) {
        this.lastPenPenTimes.set(pairKey, nowMs);
        callbacks.onPenPenImpact(_impactPt.clone(), _impactNormal.clone(), impactSpeed, s1, s2);
      }
      return;
    }

    // Pen-to-table or pen-to-floor impact
    const penId = s1 !== 'table' && s1 !== 'floor' ? s1 : s2 !== 'table' && s2 !== 'floor' ? s2 : null;
    const other = penId === s1 ? s2 : s1;
    if (penId && (other === 'table' || other === 'floor')) {
      const prevTime = this.lastTableTime[penId] ?? 0;
      if (nowMs - prevTime < 80) return;
      const info = getPenKinematics(penId);
      if (!info) return;
      const impactSpeed = Math.abs(info.vel.y) + info.speed * 0.25;
      if (impactSpeed > 0.55) {
        this.lastTableTime[penId] = nowMs;
        callbacks.onPenTableImpact(penId, other, info.pos.clone(), impactSpeed);
      }
    }
  }
}
