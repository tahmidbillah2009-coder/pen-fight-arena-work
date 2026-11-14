import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Edit2,
  PenTool,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import {
  GameMode,
  PlayerConfig,
  TeamId,
  TurnTimerOption,
  getDefaultRosterForMode,
} from '../game/MultiplayerTypes';
import {
  PEN_SPECS,
  PenTypeId,
  RARITY_COLORS,
} from '../utils/Constants';
import { PenPreviewViewer } from './PenPreviewViewer';
import { MultiplayerStorage } from '../utils/MultiplayerStorage';

interface PlayerSetupModalProps {
  isOpen: boolean;
  mode: GameMode;
  turnTimer: TurnTimerOption;
  startingTeam: TeamId;
  onBack: () => void;
  onStartMatch: (players: PlayerConfig[]) => void;
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
  onStartMatch,
}) => {
  const [savedData] = useState(() => MultiplayerStorage.load());
  const [players, setPlayers] = useState<PlayerConfig[]>(() =>
    getDefaultRosterForMode(mode, savedData.savedPlayerNames, savedData.savedPlayerPens)
  );
  const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(0);
  const [validationError, setValidationError] = useState('');

  if (!isOpen) return null;

  const activePlayer = players[selectedPlayerIdx] || players[0];
  const penSpec = PEN_SPECS[activePlayer.penType];
  const rarity = RARITY_COLORS[penSpec.rarity];

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

  const handleToggleTeam = (index: number) => {
    // Mode constraints: check if teams can be swapped
    setPlayers((prev) => {
      const copy = [...prev];
      const targetTeam: TeamId = copy[index].team === 'blue' ? 'red' : 'blue';
      copy[index] = { ...copy[index], team: targetTeam };
      return copy;
    });
  };

  const handleStartGame = () => {
    // Validation
    const emptyName = players.find((p) => !p.name.trim());
    if (emptyName) {
      setValidationError('All players must have a valid display name.');
      return;
    }

    const blueCount = players.filter((p) => p.team === 'blue').length;
    const redCount = players.filter((p) => p.team === 'red').length;
    if (blueCount === 0 || redCount === 0) {
      setValidationError('Both Team Blue and Team Red must have at least one player.');
      return;
    }

    // Persist selections locally
    const namesMap: Record<string, string> = {};
    const pensMap: Record<string, PenTypeId> = {};
    for (const p of players) {
      namesMap[p.id] = p.name;
      pensMap[p.id] = p.penType;
    }
    MultiplayerStorage.saveRosterSelections(namesMap, pensMap, turnTimer);

    onStartMatch(players);
  };

  return (
    <div className="safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md">
      <div className="animate-modal-in modal-scroll-area flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col rounded-2xl border border-white/15 bg-[#10141e] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-white">
                ROSTER &amp; PEN SETUP
              </h2>
              <p className="text-xs text-slate-400">
                Configure players, teams, and equip pens for {mode} match
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-300 border border-blue-500/30">
              {turnTimer === 0 ? 'Unlimited Timer' : `${turnTimer}s Turn Timer`}
            </span>
          </div>
        </div>

        {/* Setup Content Grid */}
        <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row">
          {/* Left Column: Player Roster List */}
          <div className="w-full border-b border-white/10 p-4 lg:w-72 lg:border-r lg:border-b-0 space-y-2.5 bg-slate-950/40 shrink-0">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Players ({players.length})
            </div>

            <div className="space-y-1.5">
              {players.map((p, idx) => {
                const isSelected = selectedPlayerIdx === idx;
                const spec = PEN_SPECS[p.penType];
                const isBlue = p.team === 'blue';
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
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`h-7 w-2 rounded-sm shrink-0 ${
                          isBlue ? 'bg-blue-500' : 'bg-rose-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-white">
                          {p.name}
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
                <div className="flex items-center gap-2">
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
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  TEAM ASSIGNMENT
                </label>
                <button
                  type="button"
                  onClick={() => handleToggleTeam(selectedPlayerIdx)}
                  className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold transition-all ${
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

            {/* 3D Pen Preview & Pen Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* 3D Interactive Pen Preview */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950 p-3 relative h-64 sm:h-72">
                <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 z-10 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>3D Pen Inspection</span>
                </span>
                <span className="absolute top-3 right-3 text-[10px] text-slate-500 z-10">
                  Drag to rotate
                </span>

                <div className="w-full h-full">
                  <PenPreviewViewer penType={activePlayer.penType} className="w-full h-full" />
                </div>
              </div>

              {/* Equipped Pen Details & Abilities */}
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3.5 space-y-2">
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
                      Cooldown: {penSpec.specialShot.cooldownSeconds}s
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    {penSpec.specialShot.summary}
                  </p>
                </div>
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
        <div className="flex shrink-0 items-center justify-between border-t border-white/10 bg-slate-900/90 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Back to Modes
            </button>
          </div>

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
