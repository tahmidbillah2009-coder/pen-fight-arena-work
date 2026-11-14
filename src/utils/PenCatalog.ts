/**
 * PEN CATALOG
 * ------------
 * The single source of truth for every playable pen: its REAL Rapier physics configuration
 * (mass, center of mass via mass distribution, collider dimensions, rotational inertia,
 * linear/angular damping, friction, restitution, rear-cap retention) plus its collection
 * metadata (rarity, class, unique ability, unlock condition).
 *
 * Physics values are authored as explicit numbers (not derived from PHYSICS_BALANCE) so this
 * module has zero imports and can never participate in a circular dependency with Constants.
 */

export type PenTypeId =
  | 'GRIP_MASTER'
  | 'IRON_FORCE'
  | 'SPEED_DEMON'
  | 'PRECISION_X'
  | 'SPIN_MASTER'
  | 'TITAN_GUARD';

export type PenRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export type PenAbilityId =
  | 'CAP_LOCK'
  | 'HEAVY_IMPACT'
  | 'QUICK_RECOVERY'
  | 'PRECISION_PULL'
  | 'SPIN_CONTROL'
  | 'IMPACT_GUARD';

/**
 * Active ability identity. Every pen owns exactly one Special Shot, a physics-driven
 * movement pattern triggered from the HUD (see `src/game/SpecialShots.ts`).
 */
export type PenSpecialShotId =
  | 'CAP_BURST'
  | 'TITAN_STRIKE'
  | 'PHANTOM_DASH'
  | 'CURVE_SHOT'
  | 'VORTEX_SPIN'
  | 'SHOCKWAVE';

/** Icon key resolved to a vector icon in the HUD / selector. */
export type SpecialShotIconKey =
  | 'BURST'
  | 'STRIKE'
  | 'DASH'
  | 'CURVE'
  | 'VORTEX'
  | 'SHOCKWAVE';

export type PenVisualStyle =
  | 'GRIP_RINGS'
  | 'HEAVY_BRASS'
  | 'SLIM_LIGHT'
  | 'PRECISION'
  | 'SPIN_RIDGED'
  | 'ARMORED';

export type AchievementId =
  | 'FIRST_MATCH'
  | 'FIRST_WIN'
  | 'THREE_WINS'
  | 'FIVE_WINS'
  | 'TEN_WINS';

export interface AchievementDef {
  id: AchievementId;
  label: string;
  description: string;
  metric: 'matchesPlayed' | 'wins';
  target: number;
  rewardPen: PenTypeId;
}

/** Achievement-based rewards — the progression hook that grants new pens. */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'FIRST_MATCH',
    label: 'Rookie Duelist',
    description: 'Play your first match',
    metric: 'matchesPlayed',
    target: 1,
    rewardPen: 'SPEED_DEMON',
  },
  {
    id: 'FIRST_WIN',
    label: 'First Blood',
    description: 'Win 1 match',
    metric: 'wins',
    target: 1,
    rewardPen: 'PRECISION_X',
  },
  {
    id: 'THREE_WINS',
    label: 'Spinner',
    description: 'Win 3 matches',
    metric: 'wins',
    target: 3,
    rewardPen: 'SPIN_MASTER',
  },
  {
    id: 'FIVE_WINS',
    label: 'Heavy Hitter',
    description: 'Win 5 matches',
    metric: 'wins',
    target: 5,
    rewardPen: 'IRON_FORCE',
  },
  {
    id: 'TEN_WINS',
    label: 'Arena Champion',
    description: 'Win 10 matches',
    metric: 'wins',
    target: 10,
    rewardPen: 'TITAN_GUARD',
  },
] as const;

export type PenUnlock = { type: 'STARTER' } | { type: 'ACHIEVEMENT'; achievementId: AchievementId };

/**
 * Removable rear cap geometry & surface response for a specific pen, shared by the visual
 * PenModel and the Rapier collider builder so the rendered cap and its physics shape stay
 * perfectly aligned. Positions use the pen's local frame: +Z is the front writing tip, -Z rear.
 */
export interface PenCapSpec {
  /** Cap length as a fraction of the pen's total length */
  lengthRatio: number;
  /** Cap outer radius as a multiple of the barrel radius (slip-on caps flare slightly) */
  radiusScale: number;
  /** Local-Z position of the cap's center as a fraction of pen length (negative = rear) */
  centerZRatio: number;
  /** Extra surface grip of the cap shell vs. the bare barrel */
  frictionScale: number;
  /** Impact cushioning of the cap shell (relative restitution) */
  restitutionScale: number;
  /**
   * Retention strength 0..1+ — how firmly the cap stays seated. Drives the CAP LOCK ability
   * and the cap collider's grip, giving each pen a genuinely different rear-cap behaviour.
   */
  retention: number;
}

/**
 * Always-on PASSIVE ability tuning. These scalars are applied to the pen's REAL Rapier body
 * for as long as the pen is equipped — swapping pen changes the physics immediately and
 * nothing ever has to be "activated". Every value is a bounded multiplier on an existing
 * physical quantity (damping, collider friction, launch impulse, post-impact velocity), so
 * no passive can teleport a pen, add free damage or bypass the collision / turn rules.
 */
export interface PassiveAbilityTuning {
  /** Multiplier on the pen's angular damping — higher resists tumble & wobble. */
  angularDampingScale: number;
  /** Multiplier on the pen's linear damping — higher bleeds speed & settles sooner. */
  linearDampingScale: number;
  /** Extra rear-cap collider grip (scaled by the pen's cap retention). 0 = none. */
  capFrictionBonus: number;
  /** Multiplier on the launch impulse the player/AI imparts — the pen's acceleration. */
  accelerationScale: number;
  /** Multiplier on the extra impulse this pen delivers to an opponent pen on impact. */
  impactMomentumScale: number;
  /** Fraction of incoming knock-back velocity removed (0..1). Negative = takes more. */
  knockbackResistance: number;
  /** Continuous angular-speed ceiling in rad/s (-1 = uncapped). */
  angularSpeedCeiling: number;
  /** Pointer steadying applied to the OWNER's drag input (0 = raw, 1 = heavily filtered). */
  inputSteadying: number;
  /** Multiplier on the rotational response to impacts (<1 = heavier, slower to turn). */
  rotationalResponseScale: number;
}

export interface PenPassiveSpec {
  id: PenAbilityId;
  name: string;
  /** One-line summary shown on the selector card. */
  summary: string;
  /** How the passive works through the physics system. */
  detail: string;
  tuning: PassiveAbilityTuning;
}

/**
 * Physics program for an ACTIVE Special Shot. `SpecialShotSystem` (src/game/SpecialShots.ts)
 * reads these numbers every physics substep and turns them into real Rapier impulses and
 * torques. The identical program is replayed inside the isolated prediction world for the
 * trajectory preview, so what the player sees is exactly what the rigid body will do.
 */
export interface SpecialShotPhysicsParams {
  /** Initial kick as a multiple of the pen's normal maximum launch speed. */
  initialSpeedScale: number;
  /** Virtual mass (kg) added for the duration of the shot — momentum without teleporting. */
  addedMass: number;
  /** Continuous forward force (N) along the shot direction. */
  forwardForce: number;
  /** Continuous lateral force (N) perpendicular to the shot direction — curves the path. */
  lateralForce: number;
  /** Yaw torque (N·m) applied across the shot window. */
  torque: number;
  /** Target yaw spin (rad/s) applied at the start of a vortex-style shot. */
  spinAngularSpeed: number;
  /** Extra angular damping applied while the shot is live. */
  angularDamping: number;
  /** Extra linear damping applied while the shot is live. */
  linearDamping: number;
  /** Seconds spent ramping the forward force in (0 = instant kick). */
  rampSeconds: number;
  /** Seconds spent bleeding the shot back to normal control at the end. */
  stabilizeSeconds: number;
  /** Hard speed ceiling (m/s) for the shot — guarantees no velocity spikes. */
  speedCeiling: number;
  /** 0..1 fraction of gravity counteracted so the shot flies flat instead of arcing. */
  liftRatio: number;
  /** Radial impulse released on the first impact (N·s). 0 = no shockwave. */
  radialImpulse: number;
  /** Radius of the radial shockwave (m). */
  radialRadius: number;
  /** Radial falloff exponent — larger falls off faster with distance. */
  radialFalloff: number;
}

export interface PenSpecialShotSpec {
  id: PenSpecialShotId;
  name: string;
  icon: SpecialShotIconKey;
  /** One-line summary for the selector card & HUD. */
  summary: string;
  /** Beginner-friendly explanation of how the shot moves. */
  description: string;
  durationSeconds: number;
  cooldownSeconds: number;
  /** -1 = unlimited uses per match. */
  maxUsesPerMatch: number;
  /** Distinct trail / UI colour for this shot. */
  colorHex: number;
  physics: SpecialShotPhysicsParams;
}

/** Shared baseline so every Special Shot starts from the same balance envelope. */
export const SPECIAL_SHOT_BASELINE = {
  cooldownSeconds: 20,
} as const;

export interface PenPhysicsSpec {
  id: PenTypeId;
  label: string;
  className: string;
  tagline: string;
  description: string;
  rarity: PenRarity;
  unlock: PenUnlock;
  /** Always-on passive ability (applied to the real rigid body while equipped). */
  passive: PenPassiveSpec;
  /** Player-triggered physics-driven Special Shot. */
  specialShot: PenSpecialShotSpec;

  // --- Real physics configuration (drives the Rapier rigid body & colliders) ---
  /** Total pen length along local Z (+Z = front writing tip). */
  length: number;
  /** Barrel radius in metres. */
  radius: number;
  /** Total mass in kg. */
  mass: number;
  /**
   * Mass distributed across [cap, tail, mainBarrel, tip] — must total `mass`.
   * This genuinely shifts the Rapier center of mass and rotational inertia.
   */
  massSplit: { cap: number; tail: number; body: number; tip: number };
  /** Multiplies the derived yaw inertia — gives each pen a distinct rotational inertia. */
  yawInertiaScale: number;
  linearDamping: number;
  angularDamping: number;
  friction: number;
  restitution: number;
  /** Rear cap geometry, retention & surface response. */
  cap: PenCapSpec;

  // --- Visuals ---
  visualStyle: PenVisualStyle;
  roughness: number;
  metalness: number;
  primaryColorHex: number;
  accentColorHex: number;
  gripColorHex: number;
  nibColorHex: number;
}

// ---------------------------------------------------------------------------------------
// PASSIVE ABILITY CONFIGURATION — always active while the pen is equipped. Tune a pen's
// feel by editing only its numbers here; no other gameplay code needs to change.
// ---------------------------------------------------------------------------------------

const CAP_LOCK: PenPassiveSpec = {
  id: 'CAP_LOCK',
  name: 'Cap Lock',
  summary: 'Seated cap holds firm — the pen tracks true.',
  detail:
    'The rear cap is locked tight: its collider gains far more grip, angular damping rises so the pen resists wobble and tumble, and the cap is much less likely to pop loose on a hard hit. The extra stability costs a little acceleration.',
  tuning: {
    angularDampingScale: 1.35,
    linearDampingScale: 1.0,
    capFrictionBonus: 0.85,
    accelerationScale: 0.93,
    impactMomentumScale: 1.0,
    knockbackResistance: 0.08,
    angularSpeedCeiling: -1,
    inputSteadying: 0.12,
    rotationalResponseScale: 0.95,
  },
};

const HEAVY_IMPACT: PenPassiveSpec = {
  id: 'HEAVY_IMPACT',
  name: 'Heavy Impact',
  summary: 'Real mass, real momentum — slower to turn.',
  detail:
    'The dense barrel carries genuinely more effective mass, so every collision transfers a stronger, heavier impulse to the opponent pen. That same mass makes the pen slow to spin up, so its rotational response is noticeably lazier.',
  tuning: {
    angularDampingScale: 1.0,
    linearDampingScale: 1.0,
    capFrictionBonus: 0.0,
    accelerationScale: 0.95,
    impactMomentumScale: 1.28,
    knockbackResistance: 0.12,
    angularSpeedCeiling: -1,
    inputSteadying: 0,
    rotationalResponseScale: 0.62,
  },
};

const QUICK_RECOVERY: PenPassiveSpec = {
  id: 'QUICK_RECOVERY',
  name: 'Quick Recovery',
  summary: 'Shrugs off hits and accelerates away instantly.',
  detail:
    'The featherweight shell loses almost no speed to the tabletop and answers the very first frame of your pull, so it recovers and re-accelerates faster than anything else. The trade-off is a light body that gets shoved further when it takes a big hit.',
  tuning: {
    angularDampingScale: 1.05,
    linearDampingScale: 0.82,
    capFrictionBonus: 0.0,
    accelerationScale: 1.16,
    impactMomentumScale: 0.95,
    knockbackResistance: -0.14,
    angularSpeedCeiling: -1,
    inputSteadying: 0,
    rotationalResponseScale: 1.12,
  },
};

const PRECISION_PULL: PenPassiveSpec = {
  id: 'PRECISION_PULL',
  name: 'Precision Pull',
  summary: 'Filtered, repeatable drag control.',
  detail:
    'Your live pointer input is smoothed so tiny hand tremors never leak into the aim, and the pre-shot path preview refreshes faster. It never steers for you — the preview always shows the exact direction your own pull produces.',
  tuning: {
    angularDampingScale: 1.22,
    linearDampingScale: 1.0,
    capFrictionBonus: 0.1,
    accelerationScale: 1.0,
    impactMomentumScale: 1.0,
    knockbackResistance: 0.05,
    angularSpeedCeiling: -1,
    inputSteadying: 0.62,
    rotationalResponseScale: 1.0,
  },
};

const SPIN_CONTROL: PenPassiveSpec = {
  id: 'SPIN_CONTROL',
  name: 'Spin Control',
  summary: 'Holds a deliberate spin without letting it run away.',
  detail:
    'A mechanical governor keeps angular velocity inside a sane band: intentional spin is left free to build and drive curve, while runaway tumble is capped. The result is rotation you can actually predict and reuse.',
  tuning: {
    angularDampingScale: 0.9,
    linearDampingScale: 1.0,
    capFrictionBonus: 0.05,
    accelerationScale: 1.02,
    impactMomentumScale: 1.0,
    knockbackResistance: 0.04,
    angularSpeedCeiling: 11.5,
    inputSteadying: 0,
    rotationalResponseScale: 1.0,
  },
};

const IMPACT_GUARD: PenPassiveSpec = {
  id: 'IMPACT_GUARD',
  name: 'Impact Guard',
  summary: 'Heavy shell soaks up knock-back.',
  detail:
    'The armoured shell bleeds off a large share of any incoming knock-back velocity and damps post-hit slide, so the pen stays put instead of skidding toward the edge. All that armour makes it the least responsive pen to accelerate.',
  tuning: {
    angularDampingScale: 1.3,
    linearDampingScale: 1.05,
    capFrictionBonus: 0.2,
    accelerationScale: 0.88,
    impactMomentumScale: 1.05,
    knockbackResistance: 0.3,
    angularSpeedCeiling: -1,
    inputSteadying: 0,
    rotationalResponseScale: 0.9,
  },
};

// ---------------------------------------------------------------------------------------
// ACTIVE SPECIAL SHOT CONFIGURATION — each shot is a small physics program of impulses.
// ---------------------------------------------------------------------------------------

const CAP_BURST: PenSpecialShotSpec = {
  id: 'CAP_BURST',
  name: 'Cap Burst',
  icon: 'BURST',
  summary: 'Charged forward burst that stabilises on exit.',
  description:
    'A controlled charge-up shoves the pen forward in a powerful burst, then the cap lock bleeds the energy off so it settles back into a clean, controllable line. Leaves a short blue energy trail.',
  durationSeconds: 0.85,
  cooldownSeconds: SPECIAL_SHOT_BASELINE.cooldownSeconds,
  maxUsesPerMatch: -1,
  colorHex: 0x3b82f6,
  physics: {
    initialSpeedScale: 0.72,
    addedMass: 0,
    forwardForce: 62,
    lateralForce: 0,
    torque: 0,
    spinAngularSpeed: 0,
    angularDamping: 0.6,
    linearDamping: 0.15,
    rampSeconds: 0.22,
    stabilizeSeconds: 0.45,
    speedCeiling: 14,
    liftRatio: 0.25,
    radialImpulse: 0,
    radialRadius: 0,
    radialFalloff: 2,
  },
};

const TITAN_STRIKE: PenSpecialShotSpec = {
  id: 'TITAN_STRIKE',
  name: 'Titan Strike',
  icon: 'STRIKE',
  summary: 'Flat, heavy straight-line battering ram.',
  description:
    'Gains virtual mass and fires absolutely straight and flat. It carries enormous forward momentum, so whatever it hits is thrown by honest collision physics — no bonus damage, just weight.',
  durationSeconds: 0.8,
  cooldownSeconds: SPECIAL_SHOT_BASELINE.cooldownSeconds,
  maxUsesPerMatch: -1,
  colorHex: 0xf59e0b,
  physics: {
    initialSpeedScale: 1.06,
    addedMass: 0.5,
    forwardForce: 40,
    lateralForce: 0,
    torque: 0,
    spinAngularSpeed: 0,
    angularDamping: 1.8,
    linearDamping: 0.1,
    rampSeconds: 0,
    stabilizeSeconds: 0.25,
    speedCeiling: 16.5,
    liftRatio: 0.85,
    radialImpulse: 0,
    radialRadius: 0,
    radialFalloff: 2,
  },
};

const PHANTOM_DASH: PenSpecialShotSpec = {
  id: 'PHANTOM_DASH',
  name: 'Phantom Dash',
  icon: 'DASH',
  summary: 'Fast smooth arc that sweeps around a pen.',
  description:
    'A sideways force bends the dash into a wide arc, letting you swing around an opponent instead of meeting it head-on. Momentum carries through the curve, so the impact is real. Leaves a red motion trail.',
  durationSeconds: 1.0,
  cooldownSeconds: SPECIAL_SHOT_BASELINE.cooldownSeconds,
  maxUsesPerMatch: -1,
  colorHex: 0xef4444,
  physics: {
    initialSpeedScale: 0.95,
    addedMass: 0,
    forwardForce: 48,
    lateralForce: 34,
    torque: 0,
    spinAngularSpeed: 0,
    angularDamping: 0.5,
    linearDamping: 0.12,
    rampSeconds: 0.1,
    stabilizeSeconds: 0.3,
    speedCeiling: 15,
    liftRatio: 0.3,
    radialImpulse: 0,
    radialRadius: 0,
    radialFalloff: 2,
  },
};

const CURVE_SHOT: PenSpecialShotSpec = {
  id: 'CURVE_SHOT',
  name: 'Curve Shot',
  icon: 'CURVE',
  summary: 'Gradual, predictable banked curve.',
  description:
    'A gentle sideways force is applied throughout the flight to bend a smooth, repeatable curve. The dashed preview shows the exact arc before you fire, so it is pure skill — there is no target tracking of any kind.',
  durationSeconds: 1.2,
  cooldownSeconds: SPECIAL_SHOT_BASELINE.cooldownSeconds,
  maxUsesPerMatch: -1,
  colorHex: 0x14b8a6,
  physics: {
    initialSpeedScale: 0.7,
    addedMass: 0,
    forwardForce: 30,
    lateralForce: 20,
    torque: 0,
    spinAngularSpeed: 0,
    angularDamping: 1.0,
    linearDamping: 0.2,
    rampSeconds: 0.15,
    stabilizeSeconds: 0.4,
    speedCeiling: 12.5,
    liftRatio: 0.35,
    radialImpulse: 0,
    radialRadius: 0,
    radialFalloff: 2,
  },
};

const VORTEX_SPIN: PenSpecialShotSpec = {
  id: 'VORTEX_SPIN',
  name: 'Vortex Spin',
  icon: 'VORTEX',
  summary: 'High-spin shot — rotation drives the hit.',
  description:
    'A torque impulse whips the pen into a fast, stable spin while it still travels forward. The spin genuinely changes how the collision resolves, and a tail-end damping phase bleeds the rotation off so it can never spin forever.',
  durationSeconds: 1.3,
  cooldownSeconds: SPECIAL_SHOT_BASELINE.cooldownSeconds,
  maxUsesPerMatch: -1,
  colorHex: 0xa855f7,
  physics: {
    initialSpeedScale: 0.5,
    addedMass: 0,
    forwardForce: 26,
    lateralForce: 0,
    torque: 2.2,
    spinAngularSpeed: 13,
    angularDamping: 0.25,
    linearDamping: 0.2,
    rampSeconds: 0.1,
    stabilizeSeconds: 0.5,
    speedCeiling: 12,
    liftRatio: 0.2,
    radialImpulse: 0,
    radialRadius: 0,
    radialFalloff: 2,
  },
};

const SHOCKWAVE: PenSpecialShotSpec = {
  id: 'SHOCKWAVE',
  name: 'Shockwave',
  icon: 'SHOCKWAVE',
  summary: 'Impact shot that erupts into a radial pulse.',
  description:
    'A braced forward slam. On the first heavy contact it releases a limited radial impulse that shoves nearby pens outward, weakening sharply with distance. One pulse per activation, on a long cooldown.',
  durationSeconds: 0.9,
  cooldownSeconds: SPECIAL_SHOT_BASELINE.cooldownSeconds,
  maxUsesPerMatch: -1,
  colorHex: 0x38bdf8,
  physics: {
    initialSpeedScale: 0.82,
    addedMass: 0.25,
    forwardForce: 44,
    lateralForce: 0,
    torque: 0,
    spinAngularSpeed: 0,
    angularDamping: 1.4,
    linearDamping: 0.15,
    rampSeconds: 0.08,
    stabilizeSeconds: 0.3,
    speedCeiling: 14,
    liftRatio: 0.45,
    radialImpulse: 3.6,
    radialRadius: 2.6,
    radialFalloff: 1.6,
  },
};


export const PEN_SPECS: Record<PenTypeId, PenPhysicsSpec> = {
  GRIP_MASTER: {
    id: 'GRIP_MASTER',
    label: 'Grip Master',
    className: 'Grip Specialist',
    tagline: 'Rear-grip specialist with rock-solid cap retention',
    description:
      'A grippy rear-weighted pen with an oversized rubberised cap. It tracks true and resists tumbling, but its mid weight means it is neither the fastest nor the hardest hitter.',
    rarity: 'COMMON',
    unlock: { type: 'STARTER' },
    passive: CAP_LOCK,
    specialShot: CAP_BURST,
    length: 3.2,
    radius: 0.148,
    mass: 1.02,
    massSplit: { cap: 0.2, tail: 0.13, body: 0.57, tip: 0.12 },
    yawInertiaScale: 1.0,
    linearDamping: 0.9,
    angularDamping: 2.36,
    friction: 0.35,
    restitution: 0.42,
    cap: {
      lengthRatio: 0.19,
      radiusScale: 1.18,
      centerZRatio: -0.415,
      frictionScale: 1.25,
      restitutionScale: 0.85,
      retention: 1.0,
    },
    visualStyle: 'GRIP_RINGS',
    roughness: 0.28,
    metalness: 0.1,
    primaryColorHex: 0x1d5fd6,
    accentColorHex: 0xe2e8f0,
    gripColorHex: 0x0f2a5c,
    nibColorHex: 0xe5c158,
  },

  IRON_FORCE: {
    id: 'IRON_FORCE',
    label: 'Iron Force',
    className: 'Heavy Impact',
    tagline: 'Heavyweight brass barrel that shrugs off hits',
    description:
      'A dense brass-choked pen built for momentum. It hits like a truck and barely bounces, but the extra mass costs mobility and makes it slow to reposition.',
    rarity: 'EPIC',
    unlock: { type: 'ACHIEVEMENT', achievementId: 'FIVE_WINS' },
    passive: HEAVY_IMPACT,
    specialShot: TITAN_STRIKE,
    length: 3.05,
    radius: 0.176,
    mass: 1.62,
    massSplit: { cap: 0.18, tail: 0.16, body: 0.92, tip: 0.36 },
    yawInertiaScale: 1.05,
    linearDamping: 0.72,
    angularDamping: 1.85,
    friction: 0.37,
    restitution: 0.34,
    cap: {
      lengthRatio: 0.16,
      radiusScale: 1.16,
      centerZRatio: -0.42,
      frictionScale: 1.12,
      restitutionScale: 0.86,
      retention: 0.72,
    },
    visualStyle: 'HEAVY_BRASS',
    roughness: 0.22,
    metalness: 0.26,
    primaryColorHex: 0x1e3a8a,
    accentColorHex: 0xd9a441,
    gripColorHex: 0x111827,
    nibColorHex: 0xfbbf24,
  },

  SPEED_DEMON: {
    id: 'SPEED_DEMON',
    label: 'Speed Demon',
    className: 'Lightweight',
    tagline: 'Feather-light dart that darts across the desk',
    description:
      'An ultra-light gel pen with a springy bounce. It flies fast and repositions instantly, but low mass and low stability make it easy to knock off and hard to aim precisely.',
    rarity: 'COMMON',
    unlock: { type: 'ACHIEVEMENT', achievementId: 'FIRST_MATCH' },
    passive: QUICK_RECOVERY,
    specialShot: PHANTOM_DASH,
    length: 3.45,
    radius: 0.122,
    mass: 0.74,
    massSplit: { cap: 0.08, tail: 0.11, body: 0.45, tip: 0.1 },
    yawInertiaScale: 0.92,
    linearDamping: 0.98,
    angularDamping: 1.6,
    friction: 0.24,
    restitution: 0.52,
    cap: {
      lengthRatio: 0.15,
      radiusScale: 1.12,
      centerZRatio: -0.405,
      frictionScale: 1.08,
      restitutionScale: 0.92,
      retention: 0.5,
    },
    visualStyle: 'SLIM_LIGHT',
    roughness: 0.3,
    metalness: 0.08,
    primaryColorHex: 0x0284c7,
    accentColorHex: 0xf8fafc,
    gripColorHex: 0x0c4a6e,
    nibColorHex: 0x38bdf8,
  },

  PRECISION_X: {
    id: 'PRECISION_X',
    label: 'Precision X',
    className: 'Precision',
    tagline: 'Perfectly balanced for predictable, repeatable shots',
    description:
      'A centre-balanced instrument pen. Its neutral mass distribution makes every shot predictable and easy to repeat — but it has no standout power, spin or retention to lean on.',
    rarity: 'RARE',
    unlock: { type: 'ACHIEVEMENT', achievementId: 'FIRST_WIN' },
    passive: PRECISION_PULL,
    specialShot: CURVE_SHOT,
    length: 3.3,
    radius: 0.14,
    mass: 1.0,
    massSplit: { cap: 0.13, tail: 0.14, body: 0.6, tip: 0.13 },
    yawInertiaScale: 0.98,
    linearDamping: 0.88,
    angularDamping: 2.09,
    friction: 0.32,
    restitution: 0.44,
    cap: {
      lengthRatio: 0.17,
      radiusScale: 1.14,
      centerZRatio: -0.41,
      frictionScale: 1.14,
      restitutionScale: 0.9,
      retention: 0.8,
    },
    visualStyle: 'PRECISION',
    roughness: 0.24,
    metalness: 0.14,
    primaryColorHex: 0x0f766e,
    accentColorHex: 0xe2e8f0,
    gripColorHex: 0x134e4a,
    nibColorHex: 0x5eead4,
  },

  SPIN_MASTER: {
    id: 'SPIN_MASTER',
    label: 'Spin Master',
    className: 'Rotation Specialist',
    tagline: 'Balanced at the ends — huge rotational inertia',
    description:
      'Mass piled at the cap and tip gives this pen a distinct, powerful rotational inertia. It whips into devastating spin shots with low angular damping, but that same lightness makes it drift and slow to settle.',
    rarity: 'RARE',
    unlock: { type: 'ACHIEVEMENT', achievementId: 'THREE_WINS' },
    passive: SPIN_CONTROL,
    specialShot: VORTEX_SPIN,
    length: 3.35,
    radius: 0.138,
    mass: 0.96,
    massSplit: { cap: 0.22, tail: 0.24, body: 0.36, tip: 0.14 },
    yawInertiaScale: 1.35,
    linearDamping: 0.86,
    angularDamping: 1.44,
    friction: 0.28,
    restitution: 0.46,
    cap: {
      lengthRatio: 0.2,
      radiusScale: 1.2,
      centerZRatio: -0.42,
      frictionScale: 1.18,
      restitutionScale: 0.9,
      retention: 0.85,
    },
    visualStyle: 'SPIN_RIDGED',
    roughness: 0.26,
    metalness: 0.16,
    primaryColorHex: 0x7c3aed,
    accentColorHex: 0xf5f3ff,
    gripColorHex: 0x3b0764,
    nibColorHex: 0xc4b5fd,
  },

  TITAN_GUARD: {
    id: 'TITAN_GUARD',
    label: 'Titan Guard',
    className: 'Defensive',
    tagline: 'Armoured shell with maximum cap retention',
    description:
      'A thick, armoured shell wrapped around a heavy rear cap. Extreme stability and retention make it a fortress to knock off, but it is sluggish with modest offensive payoff.',
    rarity: 'LEGENDARY',
    unlock: { type: 'ACHIEVEMENT', achievementId: 'TEN_WINS' },
    passive: IMPACT_GUARD,
    specialShot: SHOCKWAVE,
    length: 3.1,
    radius: 0.168,
    mass: 1.42,
    massSplit: { cap: 0.24, tail: 0.18, body: 0.72, tip: 0.28 },
    yawInertiaScale: 1.12,
    linearDamping: 0.82,
    angularDamping: 2.67,
    friction: 0.39,
    restitution: 0.35,
    cap: {
      lengthRatio: 0.18,
      radiusScale: 1.2,
      centerZRatio: -0.415,
      frictionScale: 1.22,
      restitutionScale: 0.84,
      retention: 1.1,
    },
    visualStyle: 'ARMORED',
    roughness: 0.2,
    metalness: 0.3,
    primaryColorHex: 0x334155,
    accentColorHex: 0xcbd5e1,
    gripColorHex: 0x0b1220,
    nibColorHex: 0x94a3b8,
  },
};

/** Stable display / navigation order for the collection. */
export const PEN_ORDER: readonly PenTypeId[] = [
  'GRIP_MASTER',
  'SPEED_DEMON',
  'PRECISION_X',
  'SPIN_MASTER',
  'IRON_FORCE',
  'TITAN_GUARD',
] as const;

export const STARTER_PEN: PenTypeId = 'GRIP_MASTER';

export function isPenTypeId(value: unknown): value is PenTypeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PEN_SPECS, value);
}

/** Local-Z center of mass derived from the mass distribution (physics-accurate, for display). */
export function penComZ(spec: PenPhysicsSpec): number {
  const half = spec.length * 0.5;
  const capZ = spec.length * spec.cap.centerZRatio;
  const tailZ = -(half - 0.18);
  const tipZ = half - 0.12;
  const { cap, tail, body, tip } = spec.massSplit;
  const total = cap + tail + body + tip;
  if (total <= 0) return 0;
  return (cap * capZ + tail * tailZ + body * 0 + tip * tipZ) / total;
}

/** True rigid-body yaw inertia I_yy ≈ (1/12)mL² + m·comZ², scaled per pen. */
export function penYawInertia(spec: PenPhysicsSpec): number {
  const comZ = penComZ(spec);
  return ((spec.mass * spec.length * spec.length) / 12 + spec.mass * comZ * comZ) * spec.yawInertiaScale;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const norm = (v: number, lo: number, hi: number) => clamp01((v - lo) / (hi - lo));

export interface PenStatBars {
  speed: number;
  impact: number;
  stability: number;
  control: number;
  mass: number;
  mobility: number;
  capRetention: number;
  spin: number;
}

/**
 * Normalised 0..1 display bars for the selector, derived directly from the real physics
 * values (never authored by hand) so the bars can never drift from the actual configuration.
 * `speed` and `impact` are folded in from the pen's passive tuning, so the four headline
 * stats (Speed / Impact / Stability / Control) always describe the physics that will run.
 */
export function derivePenStats(spec: PenPhysicsSpec): PenStatBars {
  const comZ = penComZ(spec);
  const mass = norm(spec.mass, 0.7, 1.65);
  const mobility = 1 - mass;
  const stability = clamp01(
    mass * 0.5 +
      norm(Math.abs(comZ), 0, 0.42) * 0.3 +
      norm(spec.angularDamping, 1.4, 2.75) * 0.2
  );
  const control = clamp01(
    norm(spec.angularDamping, 1.4, 2.75) * 0.55 + (1 - norm(Math.abs(comZ), 0, 0.42)) * 0.45
  );
  const capRetention = norm(spec.cap.retention, 0.45, 1.12);
  const spin = norm(penYawInertia(spec), 0.6, 1.85);
  const speed = clamp01(
    mobility * 0.62 + norm(spec.passive.tuning.accelerationScale, 0.86, 1.18) * 0.38
  );
  const impact = clamp01(
    mass * 0.58 + norm(spec.passive.tuning.impactMomentumScale, 0.9, 1.3) * 0.42
  );
  return { speed, impact, stability, control, mass, mobility, capRetention, spin };
}

export const RARITY_COLORS: Record<PenRarity, { text: string; ring: string; glow: string; bg: string }> = {
  COMMON: { text: 'text-slate-200', ring: 'border-slate-400/50', glow: '#94a3b8', bg: 'bg-slate-500/15' },
  RARE: { text: 'text-sky-300', ring: 'border-sky-400/60', glow: '#38bdf8', bg: 'bg-sky-500/15' },
  EPIC: { text: 'text-fuchsia-300', ring: 'border-fuchsia-400/60', glow: '#e879f9', bg: 'bg-fuchsia-500/15' },
  LEGENDARY: { text: 'text-amber-300', ring: 'border-amber-400/70', glow: '#fbbf24', bg: 'bg-amber-500/15' },
};
