import {
  ACHIEVEMENTS,
  AchievementDef,
  AchievementId,
  isPenTypeId,
  PenTypeId,
  STARTER_PEN,
} from '../utils/Constants';
import { PlayerId } from './GameState';

/**
 * COLLECTION & PROGRESSION
 * ------------------------
 * Owns the player's collection (which pens are unlocked), the equipped pen and the record
 * used for achievement-based rewards.
 *
 * Persistence is behind the `ProgressionRepository` interface. Today `LocalStorage` backs it
 * for the single-player build; a future server-side player profile only needs to provide a
 * different repository implementation — nothing above this interface has to change.
 */
export interface PlayerProfile {
  version: number;
  unlockedPens: PenTypeId[];
  equippedPen: PenTypeId;
  matchesPlayed: number;
  wins: number;
  losses: number;
  claimedAchievements: AchievementId[];
}

export interface ProgressionRepository {
  load(): PlayerProfile | null;
  save(profile: PlayerProfile): void;
  clear(): void;
}

export const PROGRESSION_VERSION = 1;

export function createDefaultProfile(): PlayerProfile {
  return {
    version: PROGRESSION_VERSION,
    unlockedPens: [STARTER_PEN],
    equippedPen: STARTER_PEN,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    claimedAchievements: [],
  };
}

export class LocalStorageProgressionRepository implements ProgressionRepository {
  constructor(private readonly storageKey = 'pen_fight_arena_profile_v1') {}

  load(): PlayerProfile | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      return normalizeProfile(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  save(profile: PlayerProfile): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(profile));
    } catch {
      // Ignore storage quota / privacy-mode errors — the session keeps working in memory.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Ignore
    }
  }
}

/** Defensive normalisation so a corrupt or outdated payload can never break the game. */
function normalizeProfile(raw: unknown): PlayerProfile {
  const base = createDefaultProfile();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<PlayerProfile>;

  const unlocked = Array.isArray(obj.unlockedPens)
    ? obj.unlockedPens.filter((p): p is PenTypeId => isPenTypeId(p))
    : [];
  if (!unlocked.includes(STARTER_PEN)) unlocked.unshift(STARTER_PEN);

  const claimed = Array.isArray(obj.claimedAchievements)
    ? obj.claimedAchievements.filter(
        (a): a is AchievementId => ACHIEVEMENTS.some((def) => def.id === a)
      )
    : [];

  const equipped =
    isPenTypeId(obj.equippedPen) && unlocked.includes(obj.equippedPen)
      ? obj.equippedPen
      : STARTER_PEN;

  return {
    version: PROGRESSION_VERSION,
    unlockedPens: unlocked,
    equippedPen: equipped,
    matchesPlayed: Math.max(0, Number(obj.matchesPlayed) || 0),
    wins: Math.max(0, Number(obj.wins) || 0),
    losses: Math.max(0, Number(obj.losses) || 0),
    claimedAchievements: claimed,
  };
}

export interface AchievementProgress extends AchievementDef {
  progress: number;
  complete: boolean;
}

export interface ProgressionEvent {
  unlockedPens: PenTypeId[];
  completedAchievements: AchievementDef[];
}

export interface ProgressionListener {
  (profile: PlayerProfile): void;
}

export class ProgressionManager {
  private profile: PlayerProfile;
  private readonly listeners = new Set<ProgressionListener>();

  constructor(
    private readonly repo: ProgressionRepository = new LocalStorageProgressionRepository(),
    initial?: PlayerProfile
  ) {
    this.profile = normalizeProfile(initial ?? repo.load() ?? createDefaultProfile());
    // Evaluate achievements on load so a restored / seeded record immediately grants its pens.
    this.commit(this.applyAchievements(this.profile).profile);
  }

  public getProfile(): PlayerProfile {
    return this.profile;
  }

  public subscribe(listener: ProgressionListener): () => void {
    this.listeners.add(listener);
    listener(this.profile);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public isUnlocked(pen: PenTypeId): boolean {
    return this.profile.unlockedPens.includes(pen);
  }

  public getEquippedPen(): PenTypeId {
    return this.profile.equippedPen;
  }

  /** Equips a pen. Locked pens can never be equipped. Returns true when the equip succeeded. */
  public equip(pen: PenTypeId): boolean {
    if (!this.isUnlocked(pen)) return false;
    if (this.profile.equippedPen === pen) return true;
    this.commit({ ...this.profile, equippedPen: pen });
    return true;
  }

  public getAchievementProgress(): AchievementProgress[] {
    return ACHIEVEMENTS.map((def) => {
      const value = def.metric === 'wins' ? this.profile.wins : this.profile.matchesPlayed;
      const progress = Math.min(1, value / Math.max(1, def.target));
      return {
        ...def,
        progress,
        complete: value >= def.target,
      };
    });
  }

  /**
   * Records a finished match, evaluates achievements and unlocks any pens whose reward
   * condition is now met. Returns what changed so the UI can celebrate the unlocks.
   */
  public recordMatch(winner: PlayerId): ProgressionEvent {
    const incremented: PlayerProfile = {
      ...this.profile,
      matchesPlayed: this.profile.matchesPlayed + 1,
      wins: this.profile.wins + (winner === 'player' ? 1 : 0),
      losses: this.profile.losses + (winner === 'bot' ? 1 : 0),
    };
    const { profile, event } = this.applyAchievements(incremented);
    this.commit(profile);
    return event;
  }

  /**
   * Marks every achievement whose target the record now meets and unlocks its reward pen.
   * Shared by the constructor (restored profile) and `recordMatch` (live match result).
   */
  private applyAchievements(base: PlayerProfile): { profile: PlayerProfile; event: ProgressionEvent } {
    const next: PlayerProfile = {
      ...base,
      unlockedPens: [...base.unlockedPens],
      claimedAchievements: [...base.claimedAchievements],
    };

    const completedAchievements: AchievementDef[] = [];
    for (const def of ACHIEVEMENTS) {
      if (next.claimedAchievements.includes(def.id)) continue;
      const value = def.metric === 'wins' ? next.wins : next.matchesPlayed;
      if (value >= def.target) {
        next.claimedAchievements.push(def.id);
        completedAchievements.push(def);
      }
    }

    const unlockedPens: PenTypeId[] = [];
    for (const def of completedAchievements) {
      if (!next.unlockedPens.includes(def.rewardPen)) {
        next.unlockedPens.push(def.rewardPen);
        unlockedPens.push(def.rewardPen);
      }
    }

    return { profile: next, event: { unlockedPens, completedAchievements } };
  }

  /** Human-readable unlock requirement for a pen (used by the locked-state panel). */
  public getUnlockHint(pen: PenTypeId, spec: { unlock: { type: string; achievementId?: AchievementId } }): string {
    if (spec.unlock.type === 'STARTER') return 'Available from the start';
    const def = ACHIEVEMENTS.find((a) => a.id === spec.unlock.achievementId);
    if (!def) return 'Unknown unlock condition';
    const value = def.metric === 'wins' ? this.profile.wins : this.profile.matchesPlayed;
    return `${def.label} — ${def.description} (${Math.min(value, def.target)}/${def.target})`;
  }

  private commit(next: PlayerProfile): void {
    this.profile = normalizeProfile(next);
    this.repo.save(this.profile);
    for (const listener of this.listeners) {
      listener(this.profile);
    }
  }
}
