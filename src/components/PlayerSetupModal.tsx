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
import { PEN_SPECS, PenTypeId } from '../utils/Constants';
import { MultiplayerStorage } from '../utils/MultiplayerStorage';
import { getPaperRarityTheme, PaperDivider, PaperSectionLabel } from './PaperUI';
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
  const rarity = getPaperRarityTheme(penSpec.rarity);
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
    <div
      className="safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 z-30 flex items-center justify-center bg-[#292725]/45 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-modal-in paper-shadow-lg flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#D9C5A8] bg-[#F7F3EA] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Modes"
              className="paper-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725] hover:bg-[#EFEAE0]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h2 className="font-display truncate text-base font-extrabold uppercase tracking-[0.04em] text-[#292725] sm:text-lg">
                Local Multiplayer Lobby
              </h2>
              <p className="truncate text-[11px] font-medium text-[#6E6A64] sm:text-xs">
                {mode} · {players.length} Players · Pass &amp; Play on this device
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-lg border border-[#365B82]/50 bg-[#E8EFF6] px-2.5 py-1 font-mono-num text-[11px] font-bold text-[#365B82]">
              {turnTimer === 0 ? 'Unlimited' : `${turnTimer}s Turn`}
            </span>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Audio & Graphics Settings"
                title="Settings"
                className="paper-btn flex h-9 w-9 items-center justify-center rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] text-[#292725] hover:bg-[#EFEAE0]"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="modal-scroll-area flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
          {/* Left Column: Roster & Turn Order */}
          <div className="w-full shrink-0 space-y-4 border-b border-[#D9C5A8] bg-[#F7F3EA] p-4 lg:w-72 lg:border-b-0 lg:border-r">
            <div>
              <PaperSectionLabel className="mb-2" right="Tap to edit">
                Players ({players.length})
              </PaperSectionLabel>

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
                      className={`paper-btn flex w-full items-center justify-between rounded-lg border-[1.5px] p-2.5 text-left transition-colors ${
                        isSelected
                          ? isBlue
                            ? 'border-[#365B82] bg-[#E8EFF6]'
                            : 'border-[#9E3B36] bg-[#F9EAE9]'
                          : 'border-[#45413C]/65 bg-[#FFFDF8] hover:bg-[#EFEAE0]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-7 w-2 shrink-0 rounded-sm ${
                            isBlue ? 'bg-[#4F6D8A]' : 'bg-[#B55450]'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="truncate text-xs font-bold text-[#292725]">
                              {p.name || 'Unnamed'}
                            </span>
                            {isStarter && (
                              <span className="shrink-0 rounded border border-[#9C6C2B]/60 bg-[#FBF3E2] px-1 py-0.2 text-[8px] font-bold text-[#85581A]">
                                1ST
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[10px] font-medium text-[#6E6A64]">
                            {spec.label} · {isBlue ? 'Blue' : 'Red'}
                          </div>
                        </div>
                      </div>

                      <ChevronRight
                        className={`h-4 w-4 shrink-0 ${
                          isSelected ? 'text-[#292725]' : 'text-[#8D8579]'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <PaperDivider />

            {/* Turn Order Selector */}
            <div className="space-y-2 rounded-lg border border-[#45413C]/70 bg-[#FFFDF8] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#292725]">
                <ListOrdered className="h-3.5 w-3.5 text-[#85581A]" />
                <span>Turn Order &amp; Starter</span>
              </div>
              <p className="text-[10px] text-[#6E6A64]">
                Tap any player to make them shoot first:
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
                      className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold transition-colors ${
                        isFirst
                          ? 'border-[#9C6C2B] bg-[#FBF3E2] text-[#85581A]'
                          : isBlue
                            ? 'border-[#365B82]/40 bg-[#E8EFF6] text-[#365B82] hover:border-[#365B82]'
                            : 'border-[#9E3B36]/40 bg-[#F9EAE9] text-[#9E3B36] hover:border-[#9E3B36]'
                      }`}
                    >
                      <span className="font-mono-num text-[9px] opacity-75">{orderIdx + 1}.</span>
                      <span className="max-w-[76px] truncate">{pl.name || pid}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {validationError && (
              <div className="rounded-lg border border-[#9E3B36] bg-[#F9EAE9] p-2.5 text-xs font-semibold text-[#9E3B36]">
                {validationError}
              </div>
            )}
          </div>

          {/* Right Column: Selected Player Editor */}
          <div className="modal-scroll-area flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            {/* Name + Team Assignment */}
            <div className="flex flex-col justify-between gap-3 rounded-xl border-[1.5px] border-[#45413C] bg-[#F7F3EA] p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <label
                  htmlFor="player-name-input"
                  className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#6E6A64]"
                >
                  Player Display Name
                </label>
                <input
                  id="player-name-input"
                  type="text"
                  maxLength={16}
                  value={activePlayer.name}
                  onChange={(e) => handleUpdateName(selectedPlayerIdx, e.target.value)}
                  placeholder="Enter player name"
                  className="w-full rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3 py-2 text-sm font-bold text-[#292725] placeholder-[#8D8579] focus:border-[#4F6D8A] focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6E6A64]">
                  Team Assignment
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleTeam(selectedPlayerIdx)}
                  className={`paper-btn flex min-h-[38px] items-center gap-2 rounded-lg border-[1.5px] px-3.5 py-2 text-xs font-bold ${
                    activePlayer.team === 'blue'
                      ? 'border-[#365B82] bg-[#E8EFF6] text-[#365B82]'
                      : 'border-[#9E3B36] bg-[#F9EAE9] text-[#9E3B36]'
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      activePlayer.team === 'blue' ? 'bg-[#4F6D8A]' : 'bg-[#B55450]'
                    }`}
                  />
                  <span>
                    {activePlayer.team === 'blue' ? 'Team Blue' : 'Team Red'} (Switch)
                  </span>
                </button>
              </div>
            </div>

            {/* 3D Preview + Pen Info */}
            <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
              <div className="paper-dots-inset relative flex h-56 flex-col items-center justify-center rounded-xl border-[1.5px] border-[#45413C] p-3 sm:h-64">
                <span className="absolute left-3 top-3 z-10 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6E6A64]">
                  <Sparkles className="h-3.5 w-3.5 text-[#85581A]" />
                  <span>3D Preview</span>
                </span>
                <span className="absolute right-3 top-3 z-10 text-[10px] font-medium text-[#6E6A64]">
                  Drag to rotate
                </span>

                <div className="h-full w-full">
                  <PenPreviewViewer
                    penType={activePlayer.penType}
                    team={activePlayer.team}
                    skinId={activeSkinId}
                    className="h-full w-full"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="space-y-1.5 rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-base font-extrabold text-[#292725]">
                      {penSpec.label}
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${rarity.badgeBg} ${rarity.badgeText} ${rarity.badgeBorder}`}
                    >
                      {penSpec.rarity}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#57534E]">{penSpec.tagline}</p>
                </div>

                <div className="space-y-1.5 rounded-xl border-[1.5px] border-[#2E664B] bg-[#E6F2EC]/75 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#2E664B]">
                      <PenTool className="h-3.5 w-3.5 shrink-0" />
                      <span>Passive: {penSpec.passive.name}</span>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#2E664B]">
                      Always On
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold leading-normal text-[#292725]">
                    {penSpec.passive.summary}
                  </p>
                  <p className="text-[11px] leading-relaxed text-[#57534E]">
                    {penSpec.passive.detail}
                  </p>
                </div>
              </div>
            </div>

            {/* Pen Skin Finish Picker */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6E6A64]">
                <Palette className="h-3.5 w-3.5 text-[#4F6D8A]" />
                <span>Pen Skin Finish</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PEN_SKINS.map((skin) => {
                  const selected = activeSkinId === skin.id;
                  const swatchColor =
                    skin.id === 'team_default'
                      ? activePlayer.team === 'blue'
                        ? '#365B82'
                        : '#B55450'
                      : skin.swatchHex;
                  return (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => handleUpdateSkin(selectedPlayerIdx, skin.id)}
                      className={`paper-btn flex items-center gap-2 rounded-lg border-[1.5px] px-2.5 py-2 text-left ${
                        selected
                          ? 'border-[#365B82] bg-[#E8EFF6]'
                          : 'border-[#45413C]/65 bg-[#FFFDF8] hover:bg-[#EFEAE0]'
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#45413C]"
                        style={{ backgroundColor: swatchColor }}
                      />
                      <span className="truncate text-[10px] font-bold text-[#292725]">
                        {skin.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Choose Pen Model */}
            <div>
              <PaperSectionLabel className="mb-2">
                Choose Pen Model ({ALL_PENS.length} Available)
              </PaperSectionLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALL_PENS.map((penKey) => {
                  const isEquipped = activePlayer.penType === penKey;
                  const spec = PEN_SPECS[penKey];
                  const pRarity = getPaperRarityTheme(spec.rarity);
                  return (
                    <button
                      key={penKey}
                      type="button"
                      onClick={() => handleUpdatePen(selectedPlayerIdx, penKey)}
                      className={`paper-btn flex flex-col items-start rounded-lg border-[1.5px] p-2.5 text-left ${
                        isEquipped
                          ? 'border-[#365B82] bg-[#E8EFF6]'
                          : 'border-[#45413C]/65 bg-[#FFFDF8] hover:bg-[#EFEAE0]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-1">
                        <span className="truncate text-xs font-bold text-[#292725]">
                          {spec.label}
                        </span>
                        {isEquipped && <Check className="h-3.5 w-3.5 shrink-0 text-[#365B82]" />}
                      </div>
                      <span className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${pRarity.badgeText}`}>
                        {spec.rarity}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#D9C5A8] bg-[#F7F3EA] px-4 py-3.5 sm:px-5">
          <button
            type="button"
            onClick={onBack}
            className="paper-btn min-h-[42px] rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-4 text-xs font-bold text-[#292725] hover:bg-[#EFEAE0]"
          >
            Back to Modes
          </button>

          <button
            type="button"
            onClick={handleStartGame}
            className="paper-btn flex min-h-[42px] items-center gap-2 rounded-lg border-[1.5px] border-[#45413C] bg-[#4F6D8A] px-6 text-xs font-bold uppercase tracking-[0.06em] text-[#FFFDF8] hover:bg-[#435E79]"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Start Match ({mode})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
