// Pen identity, physics specs, rarity, abilities and unlock conditions live in the catalog.
export * from './PenCatalog';
import { PEN_SPECS, STARTER_PEN } from './PenCatalog';

export type PowerZoneId = 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM';

export interface PowerZoneSpec {
  id: PowerZoneId;
  label: string;
  role: string;
  minPct: number;
  maxPct: number;
}

export const POWER_ZONES: readonly PowerZoneSpec[] = [
  { id: 'LOW', label: 'Low', role: 'Positioning', minPct: 0, maxPct: 30 },
  { id: 'MEDIUM', label: 'Medium', role: 'Controlled', minPct: 31, maxPct: 60 },
  { id: 'HIGH', label: 'High', role: 'Power Strike', minPct: 61, maxPct: 85 },
  { id: 'MAXIMUM', label: 'Maximum', role: 'Full Force', minPct: 86, maxPct: 100 },
] as const;

export function getPowerZone(powerRatio: number): PowerZoneSpec {
  const pct = Math.round(Math.max(0, Math.min(1, powerRatio)) * 100);
  if (pct <= 30) return POWER_ZONES[0];
  if (pct <= 60) return POWER_ZONES[1];
  if (pct <= 85) return POWER_ZONES[2];
  return POWER_ZONES[3];
}

/**
 * Centralized Physics & Gameplay Balancing Configuration.
 * All core tuning knobs live here so match pacing, power scaling,
 * arena dimensions, and out-of-bounds rules remain consistent across
 * player input, AI evaluation, trajectory preview, and simulation.
 */
export const PHYSICS_BALANCE = {
  // Larger tabletop arena (19.5 x 12.5 vs 15.6 x 10.0 — +25% width & depth, preserved 1.56:1 ratio)
  arenaWidth: 19.5,
  arenaDepth: 12.5,
  tableThickness: 0.5,
  tableTopY: 0.0,
  floorY: -5.4,

  // Fair Out-of-Bounds & edge danger thresholds
  oobMargin: 0.16, // Pen COM must clear tabletop edge by this margin
  oobYThreshold: -0.32,
  fallYThreshold: -0.82,
  oobConfirmSeconds: 0.28, // Short confirmation window prevents false border drops
  edgeWarningDistance: 1.35,
  edgeDangerDistance: 0.62,

  // Shot power & nonlinear curve (~68% of previous 24.5 max speed)
  minLaunchSpeed: 2.3,
  maxLaunchSpeed: 16.8,
  powerCurveExponent: 1.45, // Fine precision in Low/Medium, smooth ramp to High/Max
  minDragThreshold: 0.28,
  maxDragDistance: 4.5,
  maxPhysicalFollow: 3.8,

  // Spring-damper reference & telemetry constants
  springStiffness: 185.0,
  springDamping: 26.0,
  dragMaxForce: 68.0,

  // Surface & collision response tuning (smooth varnished school desk glide + crisp plastic pen clack)
  surfaceFriction: 0.30,
  tableRestitution: 0.14,
  penRestitution: 0.44,
  linearDamping: 0.86,
  angularDamping: 2.05,
  maxCollisionSpeedCap: 20.0, // Guards against multi-contact solver amplification spikes

  // Simulation timing & settle detection
  fixedDt: 1 / 120,
  maxSubsteps: 5,
  gravityY: -28.0,
  settleLinSpeed: 0.11,
  settleAngSpeed: 0.32,
  settleHoldSeconds: 0.26,
  maxShotSeconds: 6.5,
} as const;

/**
 * Nonlinear power curve mapping drag distance [minDrag..maxDrag] -> UI/logical powerRatio [0..1].
 * Gives fine precision in Low (0-30%) and Medium (31-60%) zones while limiting top-end spikes.
 */
export function dragDistanceToPowerRatio(dragDistance: number): number {
  if (dragDistance < PHYSICS_BALANCE.minDragThreshold) return 0;
  const span = Math.max(0.1, PHYSICS_BALANCE.maxDragDistance - PHYSICS_BALANCE.minDragThreshold);
  const norm = Math.max(0, Math.min(1, (dragDistance - PHYSICS_BALANCE.minDragThreshold) / span));
  return Math.pow(norm, 0.92);
}

/**
 * Maps powerRatio [0..1] to controlled launch speed using the centralized nonlinear power curve.
 */
export function powerRatioToLaunchSpeed(powerRatio: number, mass = 1.0): number {
  const clamped = Math.max(0, Math.min(1, powerRatio));
  const curved = Math.pow(clamped, PHYSICS_BALANCE.powerCurveExponent);
  const massSpeedCapScale = 1 / Math.pow(Math.max(0.4, mass), 0.26);
  const minSpd = PHYSICS_BALANCE.minLaunchSpeed;
  const maxSpd = PHYSICS_BALANCE.maxLaunchSpeed * massSpeedCapScale;
  return minSpd + (maxSpd - minSpd) * curved;
}

export const TABLE_WIDTH = PHYSICS_BALANCE.arenaWidth;
export const TABLE_DEPTH = PHYSICS_BALANCE.arenaDepth;
export const TABLE_THICKNESS = PHYSICS_BALANCE.tableThickness;
export const TABLE_TOP_Y = PHYSICS_BALANCE.tableTopY;
export const FLOOR_Y = PHYSICS_BALANCE.floorY;

export const TABLE_HALF_W = TABLE_WIDTH * 0.5;
export const TABLE_HALF_D = TABLE_DEPTH * 0.5;

export const OOB_MARGIN = PHYSICS_BALANCE.oobMargin;
export const OOB_Y_THRESHOLD = PHYSICS_BALANCE.oobYThreshold;
export const OOB_CONFIRM_SECONDS = PHYSICS_BALANCE.oobConfirmSeconds;
export const EDGE_WARNING_DISTANCE = PHYSICS_BALANCE.edgeWarningDistance;
export const EDGE_DANGER_DISTANCE = PHYSICS_BALANCE.edgeDangerDistance;

// Default pen physical dimensions (local length aligned along local Z axis: +Z is front tip, -Z is rear clicker)
export const PEN_LENGTH = PEN_SPECS[STARTER_PEN].length;
export const PEN_HALF_LENGTH = PEN_LENGTH * 0.5;
export const PEN_RADIUS = PEN_SPECS[STARTER_PEN].radius;
export const PEN_REST_Y = PEN_RADIUS + 0.005;

// Starting spawns positioned proportionally in the 19.5 x 12.5 arena
export const PLAYER_SPAWN = { x: -4.75, y: PEN_REST_Y, z: 0.56, yaw: 0.18 };
export const BOT_SPAWN = { x: 4.75, y: PEN_REST_Y, z: -0.56, yaw: Math.PI - 0.18 };

// Derived physics exports
export const PHYSICS_FIXED_DT = PHYSICS_BALANCE.fixedDt;
export const PHYSICS_MAX_SUBSTEPS = PHYSICS_BALANCE.maxSubsteps;
export const GRAVITY_Y = PHYSICS_BALANCE.gravityY;

export const PEN_MASS = PEN_SPECS[STARTER_PEN].mass;
export const PEN_FRICTION = PEN_SPECS[STARTER_PEN].friction;
export const PEN_RESTITUTION = PEN_SPECS[STARTER_PEN].restitution;
export const PEN_LINEAR_DAMPING = PEN_SPECS[STARTER_PEN].linearDamping;
export const PEN_ANGULAR_DAMPING = PEN_SPECS[STARTER_PEN].angularDamping;

export const TABLE_FRICTION = PHYSICS_BALANCE.surfaceFriction;
export const TABLE_RESTITUTION = PHYSICS_BALANCE.tableRestitution;

// Drag & launch derived parameters
export const MIN_DRAG_THRESHOLD = PHYSICS_BALANCE.minDragThreshold;
export const MAX_DRAG_DISTANCE = PHYSICS_BALANCE.maxDragDistance;
export const MAX_PHYSICAL_FOLLOW = PHYSICS_BALANCE.maxPhysicalFollow;
export const DRAG_SPRING_STIFFNESS = PHYSICS_BALANCE.springStiffness;
export const DRAG_SPRING_DAMPING = PHYSICS_BALANCE.springDamping;
export const DRAG_MAX_FORCE = PHYSICS_BALANCE.dragMaxForce;
export const MAX_LAUNCH_SPEED = PHYSICS_BALANCE.maxLaunchSpeed;
export const MIN_LAUNCH_IMPULSE = PHYSICS_BALANCE.minLaunchSpeed;
export const MAX_LAUNCH_IMPULSE = PHYSICS_BALANCE.maxLaunchSpeed;

// Resting-state & elimination detection
export const SETTLE_LIN_SPEED = PHYSICS_BALANCE.settleLinSpeed;
export const SETTLE_ANG_SPEED = PHYSICS_BALANCE.settleAngSpeed;
export const SETTLE_HOLD_SECONDS = PHYSICS_BALANCE.settleHoldSeconds;
export const MAX_SHOT_SECONDS = PHYSICS_BALANCE.maxShotSeconds;
export const FALL_Y_THRESHOLD = PHYSICS_BALANCE.fallYThreshold;

// Countdown duration in seconds
export const COUNTDOWN_SECONDS = 3;

// Colors
export const PLAYER_COLOR_HEX = 0x1d5fd6;
export const PLAYER_ACCENT_HEX = 0xe2e8f0;
export const BOT_COLOR_HEX = 0xd92638;
export const BOT_ACCENT_HEX = 0x262933;
