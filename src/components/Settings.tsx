import React from 'react';
import { ChevronRight, Gauge, HelpCircle, PenTool, RotateCcw, Settings as SettingsIcon } from 'lucide-react';
import { DIFFICULTY_CONFIGS } from '../ai/Difficulty';
import {
  DifficultyLevel,
  EffectQuality,
  GameSettings,
  QualityPreference,
  ResolutionPreference,
  ShadowQuality,
} from '../game/GameState';
import { PEN_SPECS } from '../utils/Constants';
import {
  getPaperRarityTheme,
  PaperDivider,
  PaperModalShell,
  PaperSectionLabel,
  PaperSegmented,
  PaperToggle,
} from './PaperUI';

interface SettingsModalProps {
  isOpen: boolean;
  isInMatch: boolean;
  isMultiplayer?: boolean;
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onOpenPenSelector: () => void;
  onRestartMatch: () => void;
  onOpenHowToPlay: () => void;
  onOpenBenchmark?: () => void;
  onClose: () => void;
}

const DIFFICULTIES: DifficultyLevel[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];

const QUALITIES: Array<{ id: QualityPreference; label: string }> = [
  { id: 'AUTO', label: 'Auto' },
  { id: 'LOW', label: 'Low' },
  { id: 'MEDIUM', label: 'Med' },
  { id: 'HIGH', label: 'High' },
  { id: 'ULTRA', label: 'Ultra' },
];

const SHADOWS: Array<{ id: ShadowQuality; label: string }> = [
  { id: 'OFF', label: 'Off' },
  { id: 'LOW', label: 'Low' },
  { id: 'HIGH', label: 'High' },
];

const PARTICLES: Array<{ id: EffectQuality; label: string }> = [
  { id: 'OFF', label: 'Off' },
  { id: 'LOW', label: 'Low' },
  { id: 'HIGH', label: 'High' },
];

const RESOLUTIONS: Array<{ id: ResolutionPreference; label: string }> = [
  { id: 'AUTO', label: 'Auto' },
  { id: '100', label: '100%' },
  { id: '90', label: '90%' },
  { id: '80', label: '80%' },
  { id: '75', label: '75%' },
  { id: '67', label: '67%' },
];

const SettingsRow: React.FC<{ title: string; hint: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-[#45413C]/70 bg-[#FFFDF8] px-3.5 py-2.5 sm:px-4">
    <div className="min-w-0">
      <div className="text-xs font-bold text-[#292725] sm:text-sm">{title}</div>
      <div className="text-[11px] text-[#6E6A64]">{hint}</div>
    </div>
    {children}
  </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  isInMatch,
  isMultiplayer = false,
  settings,
  onUpdateSettings,
  onOpenPenSelector,
  onRestartMatch,
  onOpenHowToPlay,
  onOpenBenchmark,
  onClose,
}) => {
  if (!isOpen) return null;

  const penSpec = PEN_SPECS[settings.playerPenType];
  const rarity = getPaperRarityTheme(penSpec.rarity);

  return (
    <PaperModalShell
      title="Settings"
      subtitle="Audio, gameplay & graphics preferences"
      icon={<SettingsIcon className="h-4 w-4" />}
      onClose={onClose}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-5 p-4 sm:p-6">
        {/* Audio Section */}
        <div className="space-y-2">
          <PaperSectionLabel>Audio</PaperSectionLabel>
          <SettingsRow title="Sound Effects" hint="Pen impacts, grab clicks & alerts">
            <PaperToggle
              label="Toggle sound effects"
              checked={settings.sfxEnabled}
              onChange={() => onUpdateSettings({ ...settings, sfxEnabled: !settings.sfxEnabled })}
            />
          </SettingsRow>
          <SettingsRow title="Background Music" hint="Calm classroom marimba loop">
            <PaperToggle
              label="Toggle background music"
              checked={settings.musicEnabled}
              onChange={() => onUpdateSettings({ ...settings, musicEnabled: !settings.musicEnabled })}
            />
          </SettingsRow>
        </div>

        <PaperDivider />

        {/* Gameplay & Controls Section */}
        <div className="space-y-2.5">
          <PaperSectionLabel>Gameplay &amp; Controls</PaperSectionLabel>
          <SettingsRow
            title="Trajectory Prediction"
            hint="Physics-simulated path & landing reticle"
          >
            <PaperToggle
              label="Toggle trajectory prediction"
              checked={settings.showTrajectory}
              onChange={() =>
                onUpdateSettings({ ...settings, showTrajectory: !settings.showTrajectory })
              }
            />
          </SettingsRow>

          <SettingsRow title="Motion Effects" hint="Camera shake, hitstop & shot-follow camera">
            <PaperToggle
              label="Toggle motion effects"
              checked={settings.motionEffects}
              onChange={() =>
                onUpdateSettings({ ...settings, motionEffects: !settings.motionEffects })
              }
            />
          </SettingsRow>

          {!isMultiplayer && (
            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-bold text-[#292725]">AI Difficulty</div>
              <div className="grid grid-cols-4 gap-1 rounded-lg border border-[#45413C] bg-[#EFEAE0] p-1">
                {DIFFICULTIES.map((lvl) => {
                  const active = settings.difficulty === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, difficulty: lvl })}
                      aria-pressed={active}
                      className={`min-h-[36px] rounded-md py-1.5 text-xs font-bold transition-colors ${
                        active
                          ? 'border border-[#45413C] bg-[#4F6D8A] text-[#FFFDF8] shadow-[1.5px_1.5px_0px_#45413C]'
                          : 'border border-transparent text-[#57534E] hover:text-[#292725]'
                      }`}
                    >
                      {DIFFICULTY_CONFIGS[lvl].label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#6E6A64]">
                {DIFFICULTY_CONFIGS[settings.difficulty].description}
              </p>
            </div>
          )}

          {!isMultiplayer && (
            <button
              type="button"
              onClick={onOpenPenSelector}
              className="paper-btn flex w-full items-center gap-3 rounded-lg border-[1.5px] border-[#45413C] bg-[#FFFDF8] px-3.5 py-2.5 text-left hover:bg-[#F7F3EA]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#45413C] bg-[#EFEAE0] text-[#292725]">
                <PenTool className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-[#292725]">
                    {penSpec.label}
                  </span>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${rarity.badgeBg} ${rarity.badgeText} ${rarity.badgeBorder}`}
                  >
                    {penSpec.rarity}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-[#6E6A64]">
                  {penSpec.tagline}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#6E6A64]" />
            </button>
          )}
        </div>

        <PaperDivider />

        {/* Graphics & Performance */}
        <div className="space-y-2.5">
          <PaperSectionLabel
            right={<Gauge className="inline h-3.5 w-3.5 text-[#4F6D8A]" />}
          >
            Graphics &amp; Performance
          </PaperSectionLabel>

          <div className="space-y-1.5">
            <div className="text-xs font-bold text-[#292725]">Graphics Quality</div>
            <PaperSegmented
              options={QUALITIES}
              value={settings.graphicsQuality}
              onChange={(graphicsQuality) => onUpdateSettings({ ...settings, graphicsQuality })}
            />
            <p className="text-[11px] text-[#6E6A64]">
              {settings.graphicsQuality === 'AUTO'
                ? 'Quality adapts automatically to keep framerate smooth.'
                : 'Fixed quality tier — resolution & shading remain pinned.'}
            </p>
          </div>

          <SettingsRow title="FPS Counter" hint="Live FPS, frame time & quality readout">
            <PaperToggle
              label="Toggle FPS counter"
              checked={settings.showFps}
              onChange={() => onUpdateSettings({ ...settings, showFps: !settings.showFps })}
            />
          </SettingsRow>

          <SettingsRow
            title="Performance Mode"
            hint="Pins lowest quality for weak or low-end devices"
          >
            <PaperToggle
              label="Toggle performance mode"
              checked={settings.performanceMode}
              onChange={() =>
                onUpdateSettings({ ...settings, performanceMode: !settings.performanceMode })
              }
            />
          </SettingsRow>

          <SettingsRow title="Shadow Quality" hint="Lightweight on mobile, crisper on desktop">
            <div className="w-[156px] shrink-0">
              <PaperSegmented
                options={SHADOWS}
                value={settings.shadowQuality}
                onChange={(shadowQuality) => onUpdateSettings({ ...settings, shadowQuality })}
              />
            </div>
          </SettingsRow>

          <SettingsRow title="Particle Effects" hint="Impact sparks & dust puffs">
            <div className="w-[156px] shrink-0">
              <PaperSegmented
                options={PARTICLES}
                value={settings.particleEffects}
                onChange={(particleEffects) =>
                  onUpdateSettings({ ...settings, particleEffects })
                }
              />
            </div>
          </SettingsRow>

          <SettingsRow title="Render Resolution" hint="Scales 3D canvas while UI stays crisp">
            <div className="w-[180px] shrink-0">
              <PaperSegmented
                options={RESOLUTIONS}
                value={settings.renderResolution}
                columns={3}
                onChange={(renderResolution) =>
                  onUpdateSettings({ ...settings, renderResolution })
                }
              />
            </div>
          </SettingsRow>

          {onOpenBenchmark && (
            <div className="flex items-center justify-between gap-3 rounded-lg border-[1.5px] border-[#365B82] bg-[#E8EFF6] px-3.5 py-2.5 sm:px-4">
              <div>
                <div className="text-xs font-bold text-[#292725] sm:text-sm">
                  Hardware Benchmark
                </div>
                <div className="text-[11px] text-[#365B82]">
                  Measure 1080p FPS, physics cost &amp; draw calls
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBenchmark();
                }}
                className="paper-btn min-h-[38px] shrink-0 rounded-lg border-[1.5px] border-[#45413C] bg-[#4F6D8A] px-3.5 text-xs font-bold text-[#FFFDF8] hover:bg-[#435E79]"
              >
                Run Test
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:gap-2.5">
          {isInMatch && (
            <button
              type="button"
              onClick={() => {
                onRestartMatch();
                onClose();
              }}
              className="paper-btn flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-lg border-[1.5px] border-[#9C6C2B] bg-[#FBF3E2] px-4 text-xs font-bold text-[#85581A] hover:bg-[#F5E8CC]"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Restart Match</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenHowToPlay();
            }}
            className="paper-btn flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-lg border-[1.5px] border-[#45413C] bg-[#EFEAE0] px-4 text-xs font-bold text-[#292725] hover:bg-[#E4DCCB]"
          >
            <HelpCircle className="h-4 w-4 text-[#4F6D8A]" />
            <span>How to Play</span>
          </button>
        </div>
      </div>
    </PaperModalShell>
  );
};
