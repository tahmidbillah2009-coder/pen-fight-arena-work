import { PenTypeId, STARTER_PEN } from '../utils/Constants';
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

export interface PlayerConfig {
  id: string; // e.g. 'p1', 'p2', ...
  name: string; // e.g. 'Player 1'
  team: TeamId;
  penType: PenTypeId;
  isAi?: boolean;
}

export interface MultiplayerPlayerState {
  id: string;
  name: string;
  team: TeamId;
  penType: PenTypeId;
  isEliminated: boolean;
  shotsCount: number;
  knockoutsCount: number;
  ability: AbilityHudState;
}

export interface MultiplayerMatchConfig {
  mode: GameMode;
  players: PlayerConfig[];
  turnTimerSeconds: TurnTimerOption;
  startingTeam?: TeamId;
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
  savedPens: Record<string, PenTypeId> = {}
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
    const defaultName = `Blue ${i + 1}`;
    const defaultPen = catalogPens[i % catalogPens.length] ?? STARTER_PEN;
    players.push({
      id,
      name: savedNames[id] || defaultName,
      team: 'blue',
      penType: savedPens[id] || defaultPen,
    });
  }

  // Team Red players
  for (let i = 0; i < redCount; i++) {
    const id = `red_${i + 1}`;
    const defaultName = `Red ${i + 1}`;
    const defaultPen = catalogPens[(i + blueCount) % catalogPens.length] ?? 'IRON_FORCE';
    players.push({
      id,
      name: savedNames[id] || defaultName,
      team: 'red',
      penType: savedPens[id] || defaultPen,
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
 * Computes strategic spawn coordinates on the desk arena for a pen.
 * Team Blue spawns on negative X (left half), Team Red on positive X (right half).
 */
export function computeMultiplayerSpawn(
  team: TeamId,
  indexInTeam: number,
  totalInTeam: number,
  penRadius = 0.16
): { x: number; y: number; z: number; yaw: number } {
  const x = team === 'blue' ? -4.2 : 4.2;
  const yaw = team === 'blue' ? 0.08 : Math.PI - 0.08;
  const y = penRadius + 0.005;

  let z = 0;
  if (totalInTeam === 1) {
    z = 0;
  } else if (totalInTeam === 2) {
    z = indexInTeam === 0 ? -1.85 : 1.85;
  } else if (totalInTeam >= 3) {
    // 3 pens: spread symmetrically
    const zOffsets = [-2.7, 0, 2.7];
    z = zOffsets[indexInTeam] ?? (indexInTeam - 1) * 2.5;
  }

  return { x, y, z, yaw };
}
