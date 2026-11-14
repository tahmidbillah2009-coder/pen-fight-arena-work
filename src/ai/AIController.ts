import * as THREE from 'three';
import { localToWorldPoint } from '../utils/Coordinates';
import { TABLE_HALF_D, TABLE_HALF_W } from '../utils/Constants';
import { DifficultyLevel } from '../game/GameState';
import { PhysicsManager } from '../game/PhysicsManager';
import { DIFFICULTY_CONFIGS, DifficultyConfig } from './Difficulty';
import { PlannedAIShot, ShotEvaluator } from './ShotEvaluator';

export interface AITurnOptions {
  /** Called for every release (normal or Special Shot) so the turn manager can resolve the round. */
  onLaunch: (powerRatio: number) => void;
  /**
   * Fired at release time when the AI elected to spend its Special Shot. Returns true when the
   * ability actually activated, in which case the normal impulse is skipped.
   */
  onSpecialShot: (dirX: number, dirZ: number, powerRatio: number) => boolean;
  /** Whether the AI pen's Special Shot is off cooldown and still has uses left. */
  canUseSpecialShot: () => boolean;
}

const _yAxis = new THREE.Vector3(0, 1, 0);

export class AIController {
  private readonly physics: PhysicsManager;

  private active = false;
  private elapsed = 0;
  private windupDuration = 0.65;
  private plannedShot: PlannedAIShot | null = null;
  private readonly currentWorldAnchor = new THREE.Vector3();

  private options?: AITurnOptions;
  private config: DifficultyConfig = DIFFICULTY_CONFIGS.NORMAL;
  /** Set during `startTurn` when the AI decides the ability is worth spending now. */
  private useSpecialShot = false;

  constructor(physics: PhysicsManager) {
    this.physics = physics;
  }

  public startTurn(difficulty: DifficultyLevel, options: AITurnOptions): void {
    const config = DIFFICULTY_CONFIGS[difficulty];
    this.config = config;
    this.options = options;
    this.plannedShot = ShotEvaluator.chooseBestShot(this.physics, config);
    this.windupDuration = config.windupSeconds;
    this.elapsed = 0;
    this.active = true;
    // Decide *before* the wind-up whether this turn is an ability turn — it never fires blindly.
    this.useSpecialShot = options.canUseSpecialShot() && this.shouldUseAbility(config);

    const body = this.physics.getBody('bot');
    body.wakeUp();
  }

  /**
   * Context-aware willingness to commit the Special Shot. The decision weighs the AI's own safety,
   * the striking distance and — for radial shots — whether the opponent is actually inside the
   * blast radius, so abilities are spent when they can matter rather than on a fixed timer.
   */
  private shouldUseAbility(config: DifficultyConfig): boolean {
    const pPose = this.physics.getPose('player');
    const bPose = this.physics.getPose('bot');
    const dist = Math.hypot(pPose.pos.x - bPose.pos.x, pPose.pos.z - bPose.pos.z);

    const pMargin = Math.min(
      TABLE_HALF_W - Math.abs(pPose.pos.x),
      TABLE_HALF_D - Math.abs(pPose.pos.z)
    );
    const bMargin = Math.min(
      TABLE_HALF_W - Math.abs(bPose.pos.x),
      TABLE_HALF_D - Math.abs(bPose.pos.z)
    );

    // Never gamble the ability away while standing on the brink — recover normally instead.
    if (bMargin < 0.85) return false;

    let chance = config.specialShotChance;

    const shot = this.physics.getPenSpec('bot').specialShot;
    if (shot.physics.radialRadius > 0) {
      // Area shot: only worth it with the opponent actually inside the radius.
      chance *= dist <= shot.physics.radialRadius * 0.9 ? 1.35 : 0.3;
    } else if (dist < 2.2) {
      chance *= 0.55;
    } else if (dist > 9.5) {
      chance *= 0.6;
    } else {
      chance *= 1.2;
    }

    // A pinned opponent near the edge is the ideal moment to commit.
    if (pMargin < 1.5) chance *= 1.3;

    return Math.random() < THREE.MathUtils.clamp(chance, 0, 0.95);
  }

  public cancel(): void {
    if (!this.active) return;
    this.active = false;
    this.plannedShot = null;
    this.useSpecialShot = false;
    const body = this.physics.getBody('bot');
    body.resetForces(true);
    body.resetTorques(true);
  }

  public applySubstepForce(): void {
    if (!this.active || !this.plannedShot) return;

    const body = this.physics.getBody('bot');
    body.resetForces(true);
    body.resetTorques(true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
  }

  public update(delta: number): void {
    if (!this.active || !this.plannedShot) return;
    this.elapsed += Math.min(delta, 0.05);

    if (this.elapsed < this.windupDuration) return;

    const shot = this.plannedShot;
    const body = this.physics.getBody('bot');
    body.resetForces(true);
    body.resetTorques(true);

    const pos = body.translation();
    const rot = body.rotation();
    localToWorldPoint(shot.localAnchor, pos, rot, this.currentWorldAnchor);

    let firedAbility = false;
    if (this.useSpecialShot && this.options) {
      // A special shot is aimed like a normal shot, but with the difficulty's ability aim error
      // layered on top — the AI is good, never perfect.
      const jitter = (Math.random() - 0.5) * 2 * this.config.specialShotJitterRad;
      const dir = shot.launchDir.clone().applyAxisAngle(_yAxis, jitter).normalize();
      firedAbility = this.options.onSpecialShot(dir.x, dir.z, shot.powerRatio);
    }

    if (!firedAbility) {
      body.wakeUp();
      body.applyImpulseAtPoint(
        {
          x: shot.launchDir.x * shot.impulseMag,
          y: 0.08,
          z: shot.launchDir.z * shot.impulseMag,
        },
        { x: this.currentWorldAnchor.x, y: pos.y, z: this.currentWorldAnchor.z },
        true
      );
    }

    this.active = false;
    this.plannedShot = null;
    this.useSpecialShot = false;
    this.options?.onLaunch(shot.powerRatio);
  }
}
