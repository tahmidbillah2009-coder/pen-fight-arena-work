import { DifficultyLevel } from '../game/GameState';

export interface DifficultyConfig {
  level: DifficultyLevel;
  label: string;
  description: string;
  angleJitterRad: number;
  minPowerRatio: number;
  maxPowerRatio: number;
  usePhysicsSim: boolean;
  windupSeconds: number;
  /**
   * Base probability that the AI elects to spend its Special Shot on a given turn (before the
   * contextual modifiers in AIController). Easy AI rarely commits and misses more often.
   */
  specialShotChance: number;
  /** Extra aim error applied on top of `angleJitterRad` when firing a Special Shot. */
  specialShotJitterRad: number;
}

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  EASY: {
    level: 'EASY',
    label: 'Easy',
    description: 'Relaxed aim, conservative power, occasional off-target shots.',
    angleJitterRad: 0.28,
    minPowerRatio: 0.24,
    maxPowerRatio: 0.68,
    usePhysicsSim: false,
    windupSeconds: 0.55,
    specialShotChance: 0.22,
    specialShotJitterRad: 0.26,
  },
  NORMAL: {
    level: 'NORMAL',
    label: 'Normal',
    description: 'Balanced targeting with distance-adjusted strike power.',
    angleJitterRad: 0.095,
    minPowerRatio: 0.28,
    maxPowerRatio: 0.85,
    usePhysicsSim: false,
    windupSeconds: 0.65,
    specialShotChance: 0.42,
    specialShotJitterRad: 0.13,
  },
  HARD: {
    level: 'HARD',
    label: 'Hard',
    description: 'Evaluates multiple angles to drive your pen toward the nearest edge.',
    angleJitterRad: 0.03,
    minPowerRatio: 0.24,
    maxPowerRatio: 0.95,
    usePhysicsSim: false,
    windupSeconds: 0.72,
    specialShotChance: 0.62,
    specialShotJitterRad: 0.055,
  },
  EXPERT: {
    level: 'EXPERT',
    label: 'Expert',
    description: 'Simulates real physics trajectories to hunt for clean knockouts.',
    angleJitterRad: 0.008,
    minPowerRatio: 0.22,
    maxPowerRatio: 1.0,
    usePhysicsSim: true,
    windupSeconds: 0.78,
    specialShotChance: 0.82,
    specialShotJitterRad: 0.022,
  },
};
