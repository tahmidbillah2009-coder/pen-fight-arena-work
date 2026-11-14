import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ListOrdered,
  Palette,
  PenTool,
  Play,
  Settings as SettingsIcon,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  GameMode,
  generateTurnQueue,
  getDefaultRosterForMode,
  PEN_SKINS,
  PenSkinId,
  PlayerConfig,
  rotateTurnQueue,
  TeamId,
  TurnTimerOption,
} from '../game/MultiplayerTypes';
import {
  PEN_SPECS,
  PenTypeId,
  RARITY_COLORS,
} from '../utils/Constants';
import { MultiplayerStorage } from '../utils/MultiplayerStorage';
import { PenPreviewViewer } from './PenPreviewViewer';

interface PlayerSetupModalProps {
  isOpen: boolean;
  mode: GameMode;
  turnTimer: TurnTimerOption;
  startingTeam: TeamId;
  onBack: () => void;
  onOpenSettings?: () => void;
  onStartMatch: (
    players: PlayerConfig[],
    startingPlayerId: string,
    turnOrder: string[]
  ) => void;
}

const ALL_PENS: PenTypeId[] = [
  'GRIP_MASTER',
  'IRON_FORCE',
  'SPEED_DEMON',
  'PRECISION_X',
  'SPIN_MASTER',
  'TITAN_GUARD',
];

export const PlayerSetupModal: React.FC<PlayerSetupModalProps> = ({
  isOpen,
  mode,
  turnTimer,
  startingTeam,
  onBack,
  onOpenSettings,
  onStartMatch,
}) => {
  const [players, setPlayers] = useState<PlayerConfig[]>(() => {
    const saved = MultiplayerStorage.load();
    return getDefaultRosterForMode(
      mode,
      saved.savedPlayerNames,
      saved.savedPlayerPens,
      saved.savedPlayerSkins
    );
  });
  const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(0);
  const [startingPlayerId, setStartingPlayerId] = useState<string>('');
  const [validationError, setValidationError] = useState('');

  // Re-initialize roster whenever the modal opens or mode changes
  useEffect(() => {
    if (!isOpen) return;
    const saved = MultiplayerStorage.load();
    const roster = getDefaultRosterForMode(
      mode,
      saved.savedPlayerNames,
      saved.savedPlayerPens,
      saved.savedPlayerSkins
    );
    setPlayers(roster);
    setSelectedPlayerIdx(0);
    setValidationError('');
    const baseQueue = generateTurnQueue(roster);
    const rotated = rotateTurnQueue(baseQueue, roster, undefined, startingTeam);
    setStartingPlayerId(rotated[0] ?? roster[0]?.id ?? '');
  }, [isOpen, mode, startingTeam]);

  const turnOrderPreview = useMemo(() => {
    const base = generateTurnQueue(players);
    return rotateTurnQueue(base, players, startingPlayerId || undefined, startingTeam);
  }, [players, startingPlayerId, startingTeam]);

  if (!isOpen) return null;

  const activePlayer = players[selectedPlayerIdx] || players[0];
  if (!activePlayer) return null;

  const penSpec = PEN_SPECS[activePlayer.penType];
  const rarity = RARITY_COLORS[penSpec.rarity];
  const activeSkinId: PenSkinId = activePlayer.skinId ?? 'team_default';

  const handleUpdateName = (index: number, newName: string) => {
    setPlayers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], name: newName };
      return copy;
    });
    setValidationError('');
  };

  const handleUpdatePen = (index: number, pen: PenTypeId) => {
    setPlayers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], penType: pen };
      return copy;
    });
  };

  const handleUpdateSkin = (index: number, skinId: PenSkinId) => {
    setPlayers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], skinId };
      return copy;
    });
  };

  const handleToggleTeam = (index: number) => {
    setPlayers((prev) => {
      const copy = [...prev];
      const targetTeam: TeamId = copy[index].team === 'blue' ? 'red' : 'blue';
      copy[index] = { ...copy[index], team: targetTeam };
      return copy;
    });
    setValidationError('');
  };

  const handleStartGame = () => {
    const normalized = players.map((p) => ({
      ...p,
      name: p.name.trim(),
    }));

    const emptyName = normalized.find((p) => !p.name);
    if (emptyName) {
      setValidationError('All players must have a valid display name.');
      return;
    }

    const blueCount = normalized.filter((p) => p.team === 'blue').length;
    const redCount = normalized.filter((p) => p.team === 'red').length;
    if (blueCount === 0 || redCount === 0) {
      setValidationError('Both Team Blue and Team Red must have at least one player.');
      return;
    }

    const namesMap: Record<string, string> = {};
    const pensMap: Record<string, PenTypeId> = {};
    const skinsMap: Record<string, PenSkinId> = {};
    for (const p of normalized) {
      namesMap[p.id] = p.name;
      pensMap[p.id] = p.penType;
      skinsMap[p.id] = p.skinId ?? 'team_default';
    }
    MultiplayerStorage.saveRosterSelections(namesMap, pensMap, turnTimer, skinsMap);

    const queue = rotateTurnQueue(
      generateTurnQueue(normalized),
      normalized,
      startingPlayerId || undefined,
      startingTeam
    );

    onStartMatch(normalized, queue[0] ?? normalized[0].id, queue);
  };

  return (
    <div className="safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md">
      <div className="animate-modal-in modal-scroll-area flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col rounded-2xl border border-white/15 bg-[#10141e] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3.5 sm:px-5 bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Modes"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-white truncate">
                ROSTER &amp; PEN SETUP
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {mode} · {players.length} Players · Pass &amp; Play on this device
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-lg bg-blue-500/20 px-2.5 py-1 text-[11px] font-semibold text-blue-300 border border-blue-500/30">
              {turnTimer === 0 ? 'Unlimited Timer' : `${turnTimer}s Turn`}
            </span>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Audio & Graphics Settings"
                title="Audio & Graphics Settings"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Setup Content Grid */}
        <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row">
          {/* Left Column: Player Roster List + Turn Order */}
          <div className="w-full border-b border-white/10 p-4 lg:w-72 lg:border-r lg:border-b-0 space-y-4 bg-slate-950/40 shrink-0">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Players ({players.length})</span>
                <span className="text-[10px] font-normal text-slate-500">Tap to edit</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
                {players.map((p, idx) => {
                  const isSelected = selectedPlayerIdx === idx;
                  const spec = PEN_SPECS[p.penType];
                  const isBlue = p.team === 'blue';
                  const isStarter = (startingPlayerId || turnOrderPreview[0]) === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlayerIdx(idx)}
                      className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all ${
                        isSelected
                          ? isBlue
                            ? 'border-blue-400 bg-blue-950/50 shadow-md ring-1 ring-blue-400'
                            : 'border-rose-400 bg-rose-950/50 shadow-md ring-1 ring-rose-400'
                          : 'border-white/10 bg-slate-900/50 hover:bg-slate-900 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`h-7 w-2 rounded-sm shrink-0 ${
                            isBlue ? 'bg-blue-500' : 'bg-rose-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="truncate text-xs font-bold text-white">
                              {p.name || 'Unnamed'}
                            </span>
                            {isStarter && (
                              <span className="rounded bg-amber-500/25 px-1 py-0.2 text-[8px] font-bold text-amber-300 border border-amber-400/30 shrink-0">
                                1ST
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[10px] text-slate-400">
                            {spec.label} · {isBlue ? 'Blue' : 'Red'}
                          </div>
                        </div>
                      </div>

                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          isSelected ? 'translate-x-0.5 text-white' : 'text-slate-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configurable Starting Player / Turn Queue Preview */}
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                <ListOrdered className="h-3.5 w-3.5 text-amber-400" />
                <span>Turn Order &amp; Starter</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Tap a player below to choose who goes first:
              </p>
              <div className="flex flex-wrap gap-1">
                {turnOrderPreview.map((pid, orderIdx) => {
                  const pl = players.find((item) => item.id === pid);
                  if (!pl) return null;
                  const isBlue = pl.team === 'blue';
                  const isFirst = orderIdx === 0;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setStartingPlayerId(pid)}
                      title={`Set ${pl.name} as starting player`}
                      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-all ${
                        isFirst
                          ? 'border-amber-400 bg-amber-950/60 text-amber-200 ring-1 ring-amber-400/50'
                          : isBlue
                            ? 'border-blue-500/30 bg-blue-950/40 text-blue-300 hover:border-blue-400'
                            : 'border-rose-500/30 bg-rose-950/40 text-rose-300 hover:border-rose-400'
                      }`}
                    >
                      <span className="font-mono-num text-[9px] opacity-75">{orderIdx + 1}.</span>
                      <span className="truncate max-w-[76px]">{pl.name || pid}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {validationError && (
              <div className="rounded-lg bg-rose-950/60 border border-rose-500/40 p-2.5 text-xs text-rose-300">
                {validationError}
              </div>
            )}
          </div>

          {/* Right Column: Selected Player Customization & 3D Viewer */}
          <div className="flex-1 p-4 sm:p-6 space-y-5 overflow-y-auto">
            {/* Player Info Row (Name + Team Toggle) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex-1">
                <label
                  htmlFor="player-name-input"
                  className="block text-[11px] font-semibold text-slate-400 mb-1"
                >
                  PLAYER DISPLAY NAME
                </label>
                <input
                  id="player-name-input"
                  type="text"
                  maxLength={16}
                  value={activePlayer.name}
                  onChange={(e) => handleUpdateName(selectedPlayerIdx, e.target.value)}
                  placeholder="Enter player name"
                  className="w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm font-semibold text-white placeholder-slate-500 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-1">
                  TEAM ASSIGNMENT
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleTeam(selectedPlayerIdx)}
                  className={`flex min-h-[38px] items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold transition-all ${
                    activePlayer.team === 'blue'
                      ? 'border-blue-400 bg-blue-900/50 text-blue-200'
                      : 'border-rose-400 bg-rose-900/50 text-rose-200'
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      activePlayer.team === 'blue' ? 'bg-blue-400' : 'bg-rose-400'
                    }`}
                  />
                  <span>
                    {activePlayer.team === 'blue' ? 'Team Blue' : 'Team Red'} (Switch)
                  </span>
                </button>
              </div>
            </div>

            {/* 3D Pen Preview & Pen Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* 3D Interactive Pen Preview */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950 p-3 relative h-56 sm:h-64">
                <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 z-10 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>3D Pen Preview</span>
                </span>
                <span className="absolute top-3 right-3 text-[10px] text-slate-500 z-10">
                  Drag to rotate
                </span>

                <div className="w-full h-full">
                  <PenPreviewViewer
                    penType={activePlayer.penType}
                    team={activePlayer.team}
                    skinId={activeSkinId}
                    className="w-full h-full"
                  />
                </div>
              </div>

              {/* Equipped Pen Details & Abilities */}
              <div className="space-y-2.5">
                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-extrabold text-white">
                      {penSpec.label}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${rarity.bg} ${rarity.text}`}
                    >
                      {penSpec.rarity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {penSpec.tagline}
                  </p>
                </div>

                {/* Passive Ability View */}
                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                    <PenTool className="h-3.5 w-3.5" />
                    <span>Passive: {penSpec.passive.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    {penSpec.passive.summary}
                  </p>
                </div>

                {/* Active Special Shot View */}
                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <Zap className="h-3.5 w-3.5" />
                      <span>Special: {penSpec.specialShot.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {penSpec.specialShot.cooldownSeconds}s CD
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    {penSpec.specialShot.summary}
                  </p>
                </div>
              </div>
            </div>

            {/* Pen Skin Finish Picker */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Palette className="h-3.5 w-3.5 text-sky-400" />
                <span>Pen Skin Finish</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PEN_SKINS.map((skin) => {
                  const selected = activeSkinId === skin.id;
                  const swatchColor =
                    skin.id === 'team_default'
                      ? activePlayer.team === 'blue'
                        ? '#2563eb'
                        : '#e11d48'
                      : skin.swatchHex;
                  return (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => handleUpdateSkin(selectedPlayerIdx, skin.id)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${
                        selected
                          ? 'border-sky-400 bg-sky-950/50 ring-1 ring-sky-400'
                          : 'border-white/10 bg-slate-900/60 hover:border-white/25'
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full shrink-0 border border-white/25"
                        style={{ backgroundColor: swatchColor }}
                      />
                      <span className="truncate text-[10px] font-semibold text-slate-200">
                        {skin.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Equip Pen Catalog Selector */}
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                Choose Pen Model ({ALL_PENS.length} Available)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_PENS.map((penKey) => {
                  const isEquipped = activePlayer.penType === penKey;
                  const spec = PEN_SPECS[penKey];
                  const pRarity = RARITY_COLORS[spec.rarity];
                  return (
                    <button
                      key={penKey}
                      type="button"
                      onClick={() => handleUpdatePen(selectedPlayerIdx, penKey)}
                      className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all ${
                        isEquipped
                          ? 'border-sky-400 bg-sky-950/40 ring-1 ring-sky-400 shadow-md'
                          : 'border-white/10 bg-slate-900/50 hover:border-white/20 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">
                          {spec.label}
                        </span>
                        {isEquipped && (
                          <Check className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                        )}
                      </div>
                      <span
                        className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${pRarity.text}`}
                      >
                        {spec.rarity}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-slate-900/90 px-4 py-3.5 sm:px-5">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Back to Modes
          </button>

          <button
            type="button"
            onClick={handleStartGame}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Start Match ({mode})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
