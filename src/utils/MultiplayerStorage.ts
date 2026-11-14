import { GameMode, PenSkinId, TeamId, TurnTimerOption } from '../game/MultiplayerTypes';
import { isPenTypeId, PenTypeId } from './Constants';

const MULTIPLAYER_STORAGE_KEY = 'pen_fight_arena_local_multiplayer_v1';

export interface LocalMultiplayerRecord {
  blueWins: number;
  redWins: number;
  draws: number;
  matchesPlayed: number;
  lastMode: GameMode;
  timerPreference: TurnTimerOption;
  startingTeamPreference: TeamId;
  savedPlayerNames: Record<string, string>;
  savedPlayerPens: Record<string, PenTypeId>;
  savedPlayerSkins: Record<string, PenSkinId>;
}

const DEFAULT_RECORD: LocalMultiplayerRecord = {
  blueWins: 0,
  redWins: 0,
  draws: 0,
  matchesPlayed: 0,
  lastMode: '1v1',
  timerPreference: 15,
  startingTeamPreference: 'blue',
  savedPlayerNames: {},
  savedPlayerPens: {},
  savedPlayerSkins: {},
};

export class MultiplayerStorage {
  public static load(): LocalMultiplayerRecord {
    try {
      const raw = localStorage.getItem(MULTIPLAYER_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_RECORD };
      const parsed = JSON.parse(raw) as Partial<LocalMultiplayerRecord>;
      const validPens: Record<string, PenTypeId> = {};
      if (parsed.savedPlayerPens) {
        for (const [k, v] of Object.entries(parsed.savedPlayerPens)) {
          if (isPenTypeId(v)) validPens[k] = v;
        }
      }
      return {
        ...DEFAULT_RECORD,
        ...parsed,
        savedPlayerNames: { ...DEFAULT_RECORD.savedPlayerNames, ...(parsed.savedPlayerNames || {}) },
        savedPlayerPens: validPens,
        savedPlayerSkins: { ...DEFAULT_RECORD.savedPlayerSkins, ...(parsed.savedPlayerSkins || {}) },
      };
    } catch {
      return { ...DEFAULT_RECORD };
    }
  }

  public static save(record: LocalMultiplayerRecord): void {
    try {
      localStorage.setItem(MULTIPLAYER_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Storage quota or sandboxed environment
    }
  }

  public static recordMatch(winner: 'blue' | 'red' | null, mode: GameMode): void {
    const data = this.load();
    data.matchesPlayed += 1;
    data.lastMode = mode;
    if (winner === 'blue') data.blueWins += 1;
    else if (winner === 'red') data.redWins += 1;
    else data.draws += 1;
    this.save(data);
  }

  public static saveModePreference(mode: GameMode, timer: TurnTimerOption, startingTeam: TeamId): void {
    const data = this.load();
    data.lastMode = mode;
    data.timerPreference = timer;
    data.startingTeamPreference = startingTeam;
    this.save(data);
  }

  public static saveRosterSelections(
    names: Record<string, string>,
    pens: Record<string, PenTypeId>,
    timer: TurnTimerOption,
    skins: Record<string, PenSkinId> = {}
  ): void {
    const data = this.load();
    data.savedPlayerNames = { ...data.savedPlayerNames, ...names };
    data.savedPlayerPens = { ...data.savedPlayerPens, ...pens };
    data.savedPlayerSkins = { ...data.savedPlayerSkins, ...skins };
    data.timerPreference = timer;
    this.save(data);
  }
}
