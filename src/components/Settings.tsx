import React from 'react';
import { ChevronRight, Gauge, HelpCircle, PenTool, RotateCcw, X } from 'lucide-react';
import { DIFFICULTY_CONFIGS } from '../ai/Difficulty';
import { PEN_SPECS, RARITY_COLORS } from '../utils/Constants';
import {
  DifficultyLevel,
  EffectQuality,
  GameSettings,
  QualityPreference,
  ResolutionPreference,
  ShadowQuality,
} from '../game/GameState';

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

/** Shared shell for a labelled settings row. */
const Row: React.FC<{ title: string; hint: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 sm:px-4 sm:py-3">
    <div className="min-w-0">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
    {children}
  </div>
);

/** ON / OFF pill used by every boolean setting. */
const ToggleButton: React.FC<{ on: boolean; onClick: () => void; accent?: string }> = ({
  on,
  onClick,
  accent = 'bg-blue-600',
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={`min-h-[40px] min-w-[64px] shrink-0 rounded-lg px-3 text-xs font-bold transition-colors ${
      on ? `${accent} text-white` : 'bg-slate-800 text-slate-400'
    }`}
  >
    {on ? 'ON' : 'OFF'}
  </button>
);

/** Multi-option segmented control used by every enumerated setting. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-1 rounded-xl bg-slate-900 p-1"
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`min-h-[40px] rounded-lg py-2 text-xs font-semibold transition-colors ${
            value === option.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

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
  const rarity = RARITY_COLORS[penSpec.rarity];

  return (
    <div className="safe-pad-x safe-pad-top safe-pad-bottom fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="animate-modal-in modal-scroll-area max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-[#12161f] p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between sm:mb-5">
          <h2 className="font-display text-lg font-bold text-white sm:text-xl">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {/* Audio Toggles */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 sm:px-4 sm:py-3">
              <div>
                <div className="text-sm font-semibold text-white">Sound Effects</div>
                <div className="text-xs text-slate-400">Pen impacts, grab clicks & alerts</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, sfxEnabled: !settings.sfxEnabled })
                }
                className={`min-h-[40px] min-w-[64px] shrink-0 rounded-lg px-3 text-xs font-bold transition-colors ${
                  settings.sfxEnabled
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.sfxEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 sm:px-4 sm:py-3">
              <div>
                <div className="text-sm font-semibold text-white">Background Music</div>
                <div className="text-xs text-slate-400">Calm classroom marimba loop</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, musicEnabled: !settings.musicEnabled })
                }
                className={`min-h-[40px] min-w-[64px] shrink-0 rounded-lg px-3 text-xs font-bold transition-colors ${
                  settings.musicEnabled
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.musicEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 sm:px-4 sm:py-3">
              <div>
                <div className="text-sm font-semibold text-white">Trajectory Prediction</div>
                <div className="text-xs text-slate-400">Physics-simulated path & landing reticle</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, showTrajectory: !settings.showTrajectory })
                }
                className={`min-h-[40px] min-w-[64px] shrink-0 rounded-lg px-3 text-xs font-bold transition-colors ${
                  settings.showTrajectory
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.showTrajectory ? 'ON' : 'OFF'}
              </button>
            </div>

            <Row title="FPS Counter" hint="Live FPS, frame time &amp; quality readout">
              <ToggleButton
                on={settings.showFps}
                accent="bg-emerald-600"
                onClick={() => onUpdateSettings({ ...settings, showFps: !settings.showFps })}
              />
            </Row>

            <Row
              title="Performance Mode"
              hint="Pins lowest quality for weak or very low-end devices"
            >
              <ToggleButton
                on={settings.performanceMode}
                accent="bg-amber-600"
                onClick={() =>
                  onUpdateSettings({ ...settings, performanceMode: !settings.performanceMode })
                }
              />
            </Row>
          </div>

          {/* Performance — quality ceilings applied on top of the graphics tier */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Gauge className="h-3.5 w-3.5 text-sky-400" />
              <span>Performance</span>
            </div>
            <div className="space-y-2.5">
              <Row title="Shadow Quality" hint="Lightweight on mobile, crisper on desktop">
                <div className="w-[168px] shrink-0">
                  <Segmented
                    options={SHADOWS}
                    value={settings.shadowQuality}
                    onChange={(shadowQuality) => onUpdateSettings({ ...settings, shadowQuality })}
                  />
                </div>
              </Row>

              <Row title="Particle Effects" hint="Impact sparks, shockwaves & trails">
                <div className="w-[168px] shrink-0">
                  <Segmented
                    options={PARTICLES}
                    value={settings.particleEffects}
                    onChange={(particleEffects) =>
                      onUpdateSettings({ ...settings, particleEffects })
                    }
                  />
                </div>
              </Row>

              <Row title="Motion Effects" hint="Camera shake, hitstop & shot-follow camera">
                <ToggleButton
                  on={settings.motionEffects}
                  onClick={() =>
                    onUpdateSettings({ ...settings, motionEffects: !settings.motionEffects })
                  }
                />
              </Row>

              <Row title="Render Resolution" hint="Scales 3D buffer while UI stays native">
                <div className="w-[190px] shrink-0">
                  <Segmented
                    options={RESOLUTIONS}
                    value={settings.renderResolution}
                    columns={3}
                    onChange={(renderResolution) =>
                      onUpdateSettings({ ...settings, renderResolution })
                    }
                  />
                </div>
              </Row>

              {onOpenBenchmark && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-500/25 bg-sky-950/20 px-3.5 py-2.5 sm:px-4 sm:py-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Hardware Benchmark</div>
                    <div className="text-xs text-slate-400">Measure Intel HD 4600 1080p FPS &amp; draw calls</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBenchmark();
                    }}
                    className="min-h-[38px] shrink-0 rounded-lg bg-sky-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-sky-500"
                  >
                    Run Test
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Equipped Pen — solo / practice only (multiplayer players equip pens in Player Setup) */}
          {!isMultiplayer && (
            <div>
              <div className="mb-2 text-xs font-semibold text-slate-400">Your Pen</div>
              <button
                type="button"
                onClick={onOpenPenSelector}
                className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2.5 text-left transition-colors hover:border-sky-400/50 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-400"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${rarity.ring} ${rarity.bg}`}
                >
                  <PenTool className={`h-4 w-4 ${rarity.text}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">{penSpec.label}</span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${rarity.bg} ${rarity.text}`}
                    >
                      {penSpec.rarity}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                    {penSpec.tagline}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-300" />
              </button>
            </div>
          )}

          {/* Graphics Quality */}
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-400">Graphics Quality</div>
            <Segmented
              options={QUALITIES}
              value={settings.graphicsQuality}
              onChange={(graphicsQuality) => onUpdateSettings({ ...settings, graphicsQuality })}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              {settings.graphicsQuality === 'AUTO'
                ? 'Quality adapts automatically to keep the framerate steady.'
                : 'Fixed quality tier — the framerate is not throttled to protect it.'}
            </p>
          </div>

          {/* AI Difficulty — solo vs AI only */}
          {!isMultiplayer && (
            <div>
              <div className="mb-2 text-xs font-semibold text-slate-400">AI Difficulty</div>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-900 p-1">
                {DIFFICULTIES.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, difficulty: lvl })}
                    className={`min-h-[40px] rounded-lg py-2 text-xs font-semibold transition-colors ${
                      settings.difficulty === lvl
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {DIFFICULTY_CONFIGS[lvl].label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {DIFFICULTY_CONFIGS[settings.difficulty].description}
              </p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:gap-2.5">
            {isInMatch && (
              <button
                type="button"
                onClick={() => {
                  onRestartMatch();
                  onClose();
                }}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-xs font-bold text-white transition-colors hover:bg-amber-500"
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
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-800 px-4 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
            >
              <HelpCircle className="h-4 w-4 text-sky-400" />
              <span>How to Play</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
