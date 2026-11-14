import * as THREE from 'three';
import { PEN_HALF_LENGTH, TABLE_HALF_D, TABLE_HALF_W } from './Constants';

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _invQuat = new THREE.Quaternion();
const _tempVec = new THREE.Vector3();

/**
 * Converts client pointer coordinates to normalized device coordinates [-1, 1] relative to canvas rect.
 */
export function clientToNDC(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  out: THREE.Vector2 = _ndc
): THREE.Vector2 {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width, 1);
  const h = Math.max(rect.height, 1);
  out.x = ((clientX - rect.left) / w) * 2 - 1;
  out.y = -((clientY - rect.top) / h) * 2 + 1;
  return out;
}

/**
 * Intersects a screen pointer ray with an arbitrary horizontal plane at height `planeY`.
 */
export function intersectHorizontalPlane(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  planeY: number,
  out: THREE.Vector3
): boolean {
  clientToNDC(clientX, clientY, canvas, _ndc);
  _raycaster.setFromCamera(_ndc, camera);
  const ray = _raycaster.ray;
  if (Math.abs(ray.direction.y) < 1e-5) {
    return false;
  }
  const t = (planeY - ray.origin.y) / ray.direction.y;
  if (t < 0) {
    return false;
  }
  out.copy(ray.origin).addScaledVector(ray.direction, t);
  return true;
}

/**
 * Converts a 3D world-space point into a rigid body's local coordinates.
 */
export function worldToLocalPoint(
  worldPoint: THREE.Vector3,
  bodyPos: { x: number; y: number; z: number },
  bodyRot: { x: number; y: number; z: number; w: number },
  out: THREE.Vector3
): THREE.Vector3 {
  _tempVec.set(
    worldPoint.x - bodyPos.x,
    worldPoint.y - bodyPos.y,
    worldPoint.z - bodyPos.z
  );
  _invQuat.set(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w).invert();
  out.copy(_tempVec).applyQuaternion(_invQuat);
  return out;
}

/**
 * Converts a body-local point into 3D world-space coordinates.
 */
export function localToWorldPoint(
  localPoint: THREE.Vector3,
  bodyPos: { x: number; y: number; z: number },
  bodyRot: { x: number; y: number; z: number; w: number },
  out: THREE.Vector3
): THREE.Vector3 {
  _invQuat.set(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);
  out.copy(localPoint).applyQuaternion(_invQuat);
  out.x += bodyPos.x;
  out.y += bodyPos.y;
  out.z += bodyPos.z;
  return out;
}

/**
 * Clamps a local grab anchor safely onto the pen's longitudinal axis.
 */
export function clampLocalAnchor(
  localAnchor: THREE.Vector3,
  halfLength = PEN_HALF_LENGTH,
  radius = 0.145
): THREE.Vector3 {
  const maxZ = Math.max(0.2, halfLength - 0.08);
  localAnchor.z = THREE.MathUtils.clamp(localAnchor.z, -maxZ, maxZ);
  // Keep vertical offset centered near the core plane for clean yaw torque without flip-launch
  localAnchor.y = THREE.MathUtils.clamp(localAnchor.y, -radius * 0.28, radius * 0.55);
  localAnchor.x = THREE.MathUtils.clamp(localAnchor.x, -radius * 0.75, radius * 0.75);
  return localAnchor;
}

/**
 * Describes which part of the pen was grabbed based on local Z coordinate.
 */
export function describeAnchorZone(
  localZ: number,
  halfLength = PEN_HALF_LENGTH
): 'Tip' | 'Front' | 'Center' | 'Back' | 'Tail' {
  const norm = localZ / Math.max(0.1, halfLength); // -1 (tail) to +1 (tip)
  if (norm > 0.55) return 'Tip';
  if (norm > 0.2) return 'Front';
  if (norm < -0.55) return 'Tail';
  if (norm < -0.2) return 'Back';
  return 'Center';
}

/**
 * Checks whether an XZ coordinate is within the tabletop boundaries (with optional margin).
 */
export function isInsideTableBounds(x: number, z: number, margin = 0): boolean {
  return (
    Math.abs(x) <= TABLE_HALF_W - margin &&
    Math.abs(z) <= TABLE_HALF_D - margin
  );
}
