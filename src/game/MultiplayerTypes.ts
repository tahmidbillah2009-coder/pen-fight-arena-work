import {
  ArenaOrientation,
  PenTypeId,
  STARTER_PEN,
  TABLE_HALF_D,
  TABLE_HALF_W,
  transformSpawnForOrientation,
} from '../utils/Constants';
import { AbilityHudState } from './GameState';

export type GameMode =
  | 'VS_AI'
  | 'PRACTICE'
  | '1v1'
  | '2v2'
  | '3v3'
  | '1v2'
  | '2v3';

export type TeamId = 'blue' | 'red';

export type TurnTimerOption = 0 | 10 | 15 | 20 | 30; // 0 = unlimited

export type PenSkinId =
  | 'team_default'
  | 'cobalt_steel'
  | 'crimson_blaze'
  | 'emerald_mint'
  | 'royal_gold'
  | 'obsidian_violet';

export interface PenSkinSpec {
  id: PenSkinId;
  label: string;
  swatchHex: string;
  primaryColorHex?: number;
  accentColorHex?: number;
  gripColorHex?: number;
}

export const PEN_SKINS: readonly PenSkinSpec[] = [
  {
    id: 'team_default',
    label: 'Team Classic',
    swatchHex: '#3b82f6',
  },
  {
    id: 'cobalt_steel',
    label: 'Cobalt Steel',
    swatchHex: '#0284c7',
    primaryColorHex: 0x0369a1,
    accentColorHex: 0xe2e8f0,
    gripColorHex: 0x0c4a6e,
  },
  {
    id: 'crimson_blaze',
    label: 'Crimson Blaze',
    swatchHex: '#e11d48',
    primaryColorHex: 0xbe123c,
    accentColorHex: 0xfef08a,
    gripColorHex: 0x4c0519,
  },
  {
    id: 'emerald_mint',
    label: 'Emerald Mint',
    swatchHex: '#10b981',
    primaryColorHex: 0x047857,
    accentColorHex: 0xd1fae5,
    gripColorHex: 0x064e3b,
  },
  {
    id: 'royal_gold',
    label: 'Royal Gold',
    swatchHex: '#f59e0b',
    primaryColorHex: 0xb45309,
    accentColorHex: 0xfef3c7,
    gripColorHex: 0x451a03,
  },
  {
    id: 'obsidian_violet',
    label: 'Obsidian Violet',
    swatchHex: '#8b5cf6',
    primaryColorHex: 0x5b21b6,
    accentColorHex: 0xe9d5ff,
    gripColorHex: 0x1e1b4b,
  },
] as const;

export function getPenSkinSpec(skinId?: PenSkinId): PenSkinSpec {
  return PEN_SKINS.find((s) => s.id === skinId) ?? PEN_SKINS[0];
}

export interface PlayerConfig {
  id: string; // e.g. 'blue_1', 'red_1', ...
  name: string; // e.g. 'Player 1'
  team: TeamId;
  penType: PenTypeId;
  skinId?: PenSkinId;
  isAi?: boolean;
}

export interface MultiplayerPlayerState {
  id: string;
  name: string;
  team: TeamId;
  penType: PenTypeId;
  skinId: PenSkinId;
  isEliminated: boolean;
  shotsCount: number;
  knockoutsCount: number;
  skipsCount: number;
  ability: AbilityHudState;
}

export interface MultiplayerMatchConfig {
  mode: GameMode;
  players: PlayerConfig[];
  turnTimerSeconds: TurnTimerOption;
  startingTeam?: TeamId;
  startingPlayerId?: string;
  customTurnOrder?: string[];
}

export interface MultiplayerMatchSnapshot {
  mode: GameMode;
  players: MultiplayerPlayerState[];
  activePlayerId: string;
  turnQueue: string[];
  currentTurnIndex: number;
  roundNumber: number;
  turnTimeRemaining: number;
  turnTimeTotal: number;
  isTurnTimerRunning: boolean;
  isTurnTimeoutNotice: boolean;
  winningTeam: TeamId | null;
  transitionPlayer: MultiplayerPlayerState | null;
  blueScore: number;
  redScore: number;
  blueKnockouts: number;
  redKnockouts: number;
}

export const MULTIPLAYER_MODES: Array<{
  id: GameMode;
  label: string;
  sublabel: string;
  playerCount: number;
  blueCount: number;
  redCount: number;
}> = [
  { id: '1v1', label: '1v1 Duel', sublabel: '2 Players (1 vs 1)', playerCount: 2, blueCount: 1, redCount: 1 },
  { id: '2v2', label: '2v2 Tag Team', sublabel: '4 Players (2 vs 2)', playerCount: 4, blueCount: 2, redCount: 2 },
  { id: '3v3', label: '3v3 Arena Brawl', sublabel: '6 Players (3 vs 3)', playerCount: 6, blueCount: 3, redCount: 3 },
  { id: '1v2', label: '1v2 Handicap', sublabel: '3 Players (1 vs 2)', playerCount: 3, blueCount: 1, redCount: 2 },
  { id: '2v3', label: '2v3 Challenge', sublabel: '5 Players (2 vs 3)', playerCount: 5, blueCount: 2, redCount: 3 },
];

export const TURN_TIMER_OPTIONS: Array<{ value: TurnTimerOption; label: string }> = [
  { value: 10, label: '10s' },
  { value: 15, label: '15s (Default)' },
  { value: 20, label: '20s' },
  { value: 30, label: '30s' },
  { value: 0, label: 'Unlimited' },
];

/**
 * Builds the default roster configuration for a given multiplayer mode.
 */
export function getDefaultRosterForMode(
  mode: GameMode,
  savedNames: Record<string, string> = {},
  savedPens: Record<string, PenTypeId> = {},
  savedSkins: Record<string, PenSkinId> = {}
): PlayerConfig[] {
  const modeSpec = MULTIPLAYER_MODES.find((m) => m.id === mode);
  const blueCount = modeSpec?.blueCount ?? 1;
  const redCount = modeSpec?.redCount ?? 1;

  const catalogPens: PenTypeId[] = [
    'GRIP_MASTER',
    'IRON_FORCE',
    'SPEED_DEMON',
    'PRECISION_X',
    'SPIN_MASTER',
    'TITAN_GUARD',
  ];

  const players: PlayerConfig[] = [];

  // Team Blue players
  for (let i = 0; i < blueCount; i++) {
    const id = `blue_${i + 1}`;
    const defaultName = `Player ${i + 1}`;
    const defaultPen = catalogPens[i % catalogPens.length] ?? STARTER_PEN;
    players.push({
      id,
      name: savedNames[id] || defaultName,
      team: 'blue',
      penType: savedPens[id] || defaultPen,
      skinId: savedSkins[id] || 'team_default',
    });
  }

  // Team Red players
  for (let i = 0; i < redCount; i++) {
    const id = `red_${i + 1}`;
    const defaultName = `Player ${blueCount + i + 1}`;
    const defaultPen = catalogPens[(i + blueCount) % catalogPens.length] ?? 'IRON_FORCE';
    players.push({
      id,
      name: savedNames[id] || defaultName,
      team: 'red',
      penType: savedPens[id] || defaultPen,
      skinId: savedSkins[id] || 'team_default',
    });
  }

  return players;
}

/**
 * Generates an alternating team turn queue:
 * Example 2v2: Blue 1 -> Red 1 -> Blue 2 -> Red 2.
 * Example 1v2: Blue 1 -> Red 1 -> Red 2.
 * Example 2v3: Blue 1 -> Red 1 -> Blue 2 -> Red 2 -> Red 3.
 */
export function generateTurnQueue(players: PlayerConfig[]): string[] {
  const bluePlayers = players.filter((p) => p.team === 'blue');
  const redPlayers = players.filter((p) => p.team === 'red');

  const queue: string[] = [];
  const maxLen = Math.max(bluePlayers.length, redPlayers.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < bluePlayers.length) {
      queue.push(bluePlayers[i].id);
    }
    if (i < redPlayers.length) {
      queue.push(redPlayers[i].id);
    }
  }

  return queue;
}

/**
 * Rotates a turn queue so `startingPlayerId` (or the first member of `startingTeam`) goes first.
 */
export function rotateTurnQueue(
  queue: string[],
  players: PlayerConfig[],
  startingPlayerId?: string,
  startingTeam?: TeamId
): string[] {
  if (queue.length <= 1) return [...queue];
  let startIdx = -1;
  if (startingPlayerId) {
    startIdx = queue.indexOf(startingPlayerId);
  }
  if (startIdx < 0 && startingTeam) {
    startIdx = queue.findIndex((id) => players.find((p) => p.id === id)?.team === startingTeam);
  }
  if (startIdx <= 0) return [...queue];
  return [...queue.slice(startIdx), ...queue.slice(0, startIdx)];
}

/**
 * Computes strategic spawn coordinates on the desk arena for a pen.
 * In horizontal mode: Team Blue spawns on -X (left), Team Red on +X (right).
 * In vertical mode: Team Blue spawns on +Z (bottom), Team Red on -Z (top).
 */
export function computeMultiplayerSpawn(
  team: TeamId,
  indexInTeam: number,
  totalInTeam: number,
  penRadius = 0.16,
  orientation: ArenaOrientation = 'horizontal'
): { x: number; y: number; z: number; yaw: number } {
  const x = team === 'blue' ? -TABLE_HALF_W * 0.54 : TABLE_HALF_W * 0.54;
  const yaw = team === 'blue' ? 0.08 : Math.PI - 0.08;
  const y = penRadius + 0.005;

  let z = 0;
  if (totalInTeam === 1) {
    z = 0;
  } else if (totalInTeam === 2) {
    z = indexInTeam === 0 ? -TABLE_HALF_D * 0.37 : TABLE_HALF_D * 0.37;
  } else if (totalInTeam >= 3) {
    // 3 pens: spread symmetrically across desk depth
    const zOffsets = [-TABLE_HALF_D * 0.54, 0, TABLE_HALF_D * 0.54];
    z = zOffsets[indexInTeam] ?? (indexInTeam - 1) * (TABLE_HALF_D * 0.5);
  }

  return transformSpawnForOrientation({ x, y, z, yaw }, orientation);
}
