import * as THREE from 'three';
import {
  PEN_HALF_LENGTH,
  powerRatioToLaunchSpeed,
} from '../utils/Constants';
import { PhysicsManager } from '../game/PhysicsManager';
import { DifficultyConfig } from './Difficulty';

export interface PlannedAIShot {
  localAnchor: THREE.Vector3;
  launchDir: THREE.Vector3;
  powerRatio: number;
  impulseMag: number;
}

function edgeMarginScore(x: number, z: number, halfW: number, halfD: number): number {
  const dx = halfW - Math.abs(x);
  const dz = halfD - Math.abs(z);
  return Math.min(dx, dz); // Negative means off table, positive means distance to closest edge
}

function powerRatioToImpulse(ratio: number, mass: number): number {
  const speed = powerRatioToLaunchSpeed(ratio, mass);
  return speed * mass;
}

export class ShotEvaluator {
  public static chooseBestShot(
    physics: PhysicsManager,
    config: DifficultyConfig
  ): PlannedAIShot {
    const pPose = physics.getPose('player');
    const bPose = physics.getPose('bot');
    const botSpec = physics.getPenSpec('bot');

    const toPlayer = new THREE.Vector3(
      pPose.pos.x - bPose.pos.x,
      0,
      pPose.pos.z - bPose.pos.z
    );
    const dist = Math.max(0.5, toPlayer.length());
    const baseDir = toPlayer.clone().normalize();

    const { halfW, halfD } = physics.getArenaBounds();
    const pMarginNow = edgeMarginScore(pPose.pos.x, pPose.pos.z, halfW, halfD);
    const bMarginNow = edgeMarginScore(bPose.pos.x, bPose.pos.z, halfW, halfD);

    // Easy & Normal: strategic edge-margin- & distance-aware selection across Low/Medium/High tiers
    if (config.level === 'EASY' || config.level === 'NORMAL') {
      // If AI itself is dangerously near an edge, bias toward an inward recovery shot using Low/Medium power
      if (bMarginNow < 1.15 && Math.random() < (config.level === 'NORMAL' ? 0.72 : 0.35)) {
        const toCenter = new THREE.Vector3(-bPose.pos.x, 0, -bPose.pos.z).normalize();
        const recoveryDir = toCenter.lerp(baseDir, 0.3).normalize();
        const jitter = (Math.random() - 0.5) * 1.4 * config.angleJitterRad;
        recoveryDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), jitter);
        const recoveryPower = THREE.MathUtils.clamp(0.24 + Math.random() * 0.14, 0.18, 0.42);
        return {
          localAnchor: new THREE.Vector3(0, 0.02, 0),
          launchDir: recoveryDir.normalize(),
          powerRatio: recoveryPower,
          impulseMag: powerRatioToImpulse(recoveryPower, botSpec.mass),
        };
      }

      const jitter = (Math.random() - 0.5) * 2 * config.angleJitterRad;
      const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), jitter);

      // Use Medium/High to drive inland opponents toward edges; controlled Medium when player is near an edge
      let targetPower: number;
      if (pMarginNow < 1.35 && dist < 5.0) {
        targetPower = 0.50; // Controlled Medium finish tap near edge
      } else if (pMarginNow > 2.2 && dist < 6.5) {
        targetPower = config.level === 'NORMAL' ? 0.78 : 0.62; // Strong push when opponent is safe inland
      } else {
        const distNorm = THREE.MathUtils.clamp(dist / 10.0, 0.35, 0.95);
        targetPower = THREE.MathUtils.lerp(Math.max(0.45, config.minPowerRatio), config.maxPowerRatio, distNorm);
      }

      const powerRatio = THREE.MathUtils.clamp(
        targetPower + (Math.random() - 0.5) * 0.12,
        config.minPowerRatio,
        config.maxPowerRatio
      );

      const anchorZ = config.level === 'EASY' ? 0 : (Math.random() - 0.5) * 0.85;
      return {
        localAnchor: new THREE.Vector3(0, 0.02, anchorZ),
        launchDir: dir.normalize(),
        powerRatio,
        impulseMag: powerRatioToImpulse(powerRatio, botSpec.mass),
      };
    }

    // Hard & Expert: build strategic candidates across Low, Medium, High, and Maximum zones
    const pQuat = new THREE.Quaternion(pPose.rot.x, pPose.rot.y, pPose.rot.z, pPose.rot.w);
    const pAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(pQuat).setY(0).normalize();

    const edgePush = new THREE.Vector3();
    const dxEdge = halfW - Math.abs(pPose.pos.x);
    const dzEdge = halfD - Math.abs(pPose.pos.z);
    if (dxEdge < dzEdge) {
      edgePush.set(pPose.pos.x >= 0 ? 1 : -1, 0, 0);
    } else {
      edgePush.set(0, 0, pPose.pos.z >= 0 ? 1 : -1);
    }

    const targetPoints: THREE.Vector3[] = [
      new THREE.Vector3(pPose.pos.x, 0, pPose.pos.z),
      new THREE.Vector3(pPose.pos.x, 0, pPose.pos.z).addScaledVector(pAxis, PEN_HALF_LENGTH * 0.42),
      new THREE.Vector3(pPose.pos.x, 0, pPose.pos.z).addScaledVector(pAxis, -PEN_HALF_LENGTH * 0.42),
      new THREE.Vector3(pPose.pos.x, 0, pPose.pos.z).addScaledVector(edgePush, -0.35),
    ];

    // If AI is close to an edge, also evaluate defensive repositioning toward safe center/flank
    const centerPos = new THREE.Vector3(0, 0, 0);
    const safeFlank = new THREE.Vector3(-bPose.pos.x * 0.35, 0, -bPose.pos.z * 0.35);

    const anchorOffsets = [0, -0.75, 0.75];
    const strategicTiers = [
      0.24, // Low: positioning & gentle edge taps
      0.50, // Medium: controlled attacks & safe nudges
      0.76, // High: strong cross-table pressure
      Math.min(config.maxPowerRatio, 0.94), // Maximum: only when justified & safe
    ];

    let bestScore = -Infinity;
    let bestShot: PlannedAIShot = {
      localAnchor: new THREE.Vector3(0, 0.02, 0),
      launchDir: baseDir,
      powerRatio: 0.62,
      impulseMag: powerRatioToImpulse(0.62, botSpec.mass),
    };

    const candidates: PlannedAIShot[] = [];
    for (const target of targetPoints) {
      const dir = new THREE.Vector3(target.x - bPose.pos.x, 0, target.z - bPose.pos.z);
      if (dir.lengthSq() < 0.05) continue;
      dir.normalize();

      for (const pRatio of strategicTiers) {
        const clampedPower = THREE.MathUtils.clamp(pRatio, 0.16, config.maxPowerRatio);
        for (const az of anchorOffsets) {
          candidates.push({
            localAnchor: new THREE.Vector3(0, 0.02, az),
            launchDir: dir.clone(),
            powerRatio: clampedPower,
            impulseMag: powerRatioToImpulse(clampedPower, botSpec.mass),
          });
        }
      }
    }

    // Add defensive recovery candidates when AI is near an edge
    if (bMarginNow < 1.6) {
      for (const recTarget of [centerPos, safeFlank]) {
        const recDir = new THREE.Vector3(recTarget.x - bPose.pos.x, 0, recTarget.z - bPose.pos.z);
        if (recDir.lengthSq() > 0.2) {
          recDir.normalize();
          for (const recPow of [0.22, 0.38]) {
            candidates.push({
              localAnchor: new THREE.Vector3(0, 0.02, 0),
              launchDir: recDir.clone(),
              powerRatio: recPow,
              impulseMag: powerRatioToImpulse(recPow, botSpec.mass),
            });
          }
        }
      }
    }

    if (config.usePhysicsSim) {
      // EXPERT: Evaluate diverse Low/Med/High/Max & recovery candidates in isolated Rapier sim
      const stepStride = Math.max(1, Math.floor(candidates.length / 24));
      for (let i = 0; i < candidates.length; i += stepStride) {
        const cand = candidates[i];
        const res = physics.simulateCandidateShot(
          'bot',
          { x: cand.localAnchor.x, y: cand.localAnchor.y, z: cand.localAnchor.z },
          {
            x: cand.launchDir.x * cand.impulseMag,
            y: 0.08,
            z: cand.launchDir.z * cand.impulseMag,
          },
          84
        );

        let score = 0;
        if (res.playerFell && !res.botFell) {
          score += 10000;
          score -= cand.powerRatio * 55;
        } else if (res.botFell && !res.playerFell) {
          score -= 10000;
        } else if (res.botFell && res.playerFell) {
          score -= 4000;
        }

        const pMargin = edgeMarginScore(res.playerPos.x, res.playerPos.z, halfW, halfD);
        const bMargin = edgeMarginScore(res.botPos.x, res.botPos.z, halfW, halfD);

        score += (5.0 - pMargin) * 145;
        score += Math.min(bMargin, 3.0) * 105;
        if (bMargin < 1.0) score -= (1.0 - bMargin) * 750;

        if (cand.powerRatio > 0.85 && !res.playerFell) {
          score -= 60;
        }

        if (score > bestScore) {
          bestScore = score;
          bestShot = cand;
        }
      }
    } else {
      // HARD: Geometric & risk-aware evaluation across all 4 power tiers
      for (const cand of candidates) {
        const alignmentWithEdge = cand.launchDir.dot(edgePush);
        const estSpeed = powerRatioToLaunchSpeed(cand.powerRatio, botSpec.mass);
        const estTravel = estSpeed * 0.56;
        const estBotEnd = new THREE.Vector3(bPose.pos.x, 0, bPose.pos.z).addScaledVector(
          cand.launchDir,
          Math.min(estTravel, dist + 2.2)
        );
        const bMargin = edgeMarginScore(estBotEnd.x, estBotEnd.z, halfW, halfD);

        // Drive inland opponents with High/Max power; use controlled Medium near edges to finish safely
        let idealPower: number;
        if (pMarginNow < 1.35) {
          idealPower = 0.52;
        } else if (pMarginNow > 2.1) {
          idealPower = alignmentWithEdge > 0.35 ? 0.88 : 0.75;
        } else {
          idealPower = alignmentWithEdge > 0.4 ? 0.76 : 0.60;
        }
        const powerFit = 1 - Math.abs(cand.powerRatio - idealPower);

        let score = alignmentWithEdge * 125 + powerFit * 150;
        if (bMargin < 1.0) {
          score -= (1.0 - bMargin) * 520;
        }
        if (bMarginNow < 1.2 && cand.launchDir.dot(new THREE.Vector3(-bPose.pos.x, 0, -bPose.pos.z).normalize()) > 0.5) {
          score += 210; // Recovery bonus
        }
        score -= Math.abs(cand.localAnchor.z) * 8;

        if (score > bestScore) {
          bestScore = score;
          bestShot = cand;
        }
      }
    }

    if (config.angleJitterRad > 0) {
      const jitter = (Math.random() - 0.5) * 2 * config.angleJitterRad;
      bestShot.launchDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), jitter).normalize();
    }

    return bestShot;
  }
}
