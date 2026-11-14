export type ImpactSurface = 'table' | 'floor';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private sfxEnabled = true;
  private musicEnabled = false;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  // Gentle pentatonic classroom marimba motif (C4 major pentatonic)
  private readonly melodyNotes = [261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 392.0];

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.002;
      this.compressor.release.value = 0.12;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.9;

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (this.musicEnabled && this.musicTimer === null) {
      this.startMusicLoop();
    }
  }

  public setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (enabled) {
      this.unlock();
      this.startMusicLoop();
    } else {
      this.stopMusicLoop();
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private ensureReady(): { ctx: AudioContext; out: AudioNode } | null {
    if (!this.sfxEnabled) return null;
    if (!this.ctx) {
      this.unlock();
    }
    if (!this.ctx || this.ctx.state !== 'running') return null;
    return { ctx: this.ctx, out: this.compressor ?? this.ctx.destination };
  }

  public playGrab(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.045);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain).connect(out);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playRelease(powerRatio: number): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    const clamped = Math.max(0.15, Math.min(1, powerRatio));

    // Snappy elastic twang scaled by launch power
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 + clamped * 140, now);
    osc.frequency.exponentialRampToValueAtTime(640 + clamped * 360, now + 0.09);

    gain.gain.setValueAtTime(0.16 * clamped + 0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain).connect(out);
    osc.start(now);
    osc.stop(now + 0.15);

    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900 + clamped * 1400, now);
      filter.Q.value = 1.6;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.09 * clamped, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      src.connect(filter).connect(nGain).connect(out);
      src.start(now);
      src.stop(now + 0.12);
    }
  }

  /**
   * Velocity-pitched acrylic/metallic pen-to-pen clack.
   */
  public playPenCollision(impactSpeed: number): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    const norm = Math.max(0.08, Math.min(1, (impactSpeed - 0.5) / 15.5));
    const jitter = 0.96 + Math.random() * 0.08;

    // Primary acrylic body clack (pitch scales upward with velocity)
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime((1180 + norm * 1150) * jitter, now);
    bodyOsc.frequency.exponentialRampToValueAtTime((420 + norm * 240) * jitter, now + 0.065);

    bodyGain.gain.setValueAtTime(0.08 + norm * 0.22, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    bodyOsc.connect(bodyGain).connect(out);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.09);

    // Metallic collar/tip ping overtone (brighter on high-speed hits)
    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chimeOsc.type = 'sine';
    chimeOsc.frequency.setValueAtTime((2200 + norm * 1850) * jitter, now);
    chimeOsc.frequency.exponentialRampToValueAtTime((980 + norm * 520) * jitter, now + 0.055);

    chimeGain.gain.setValueAtTime(0.03 + norm * 0.15, now);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    chimeOsc.connect(chimeGain).connect(out);
    chimeOsc.start(now);
    chimeOsc.stop(now + 0.07);

    // Crisp transient click burst
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400 + norm * 2600, now);
      filter.Q.value = 2.4;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.05 + norm * 0.16, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

      src.connect(filter).connect(nGain).connect(out);
      src.start(now);
      src.stop(now + 0.028);
    }
  }

  /**
   * Velocity-pitched wooden desk or classroom floor impact sound.
   */
  public playTableImpact(impactSpeed: number, surface: ImpactSurface = 'table'): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    const norm = Math.max(0.06, Math.min(1, (impactSpeed - 0.45) / 10.5));
    const jitter = 0.95 + Math.random() * 0.1;

    const isWoodDesk = surface === 'table';

    // Hollow wooden desk resonance vs deeper floor thud
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = isWoodDesk ? 'triangle' : 'sine';

    const startHz = isWoodDesk
      ? (155 + norm * 145) * jitter
      : (105 + norm * 75) * jitter;
    const endHz = isWoodDesk ? 64 : 44;

    thudOsc.frequency.setValueAtTime(startHz, now);
    thudOsc.frequency.exponentialRampToValueAtTime(endHz, now + 0.075);

    thudGain.gain.setValueAtTime(0.04 + norm * (isWoodDesk ? 0.18 : 0.22), now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    thudOsc.connect(thudGain).connect(out);
    thudOsc.start(now);
    thudOsc.stop(now + 0.095);

    // Tactile wood tap transient scaled in pitch by velocity
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(
        (isWoodDesk ? 720 + norm * 1050 : 420 + norm * 520) * jitter,
        now
      );
      filter.Q.value = isWoodDesk ? 2.2 : 1.4;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.03 + norm * 0.12, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

      src.connect(filter).connect(nGain).connect(out);
      src.start(now);
      src.stop(now + 0.036);
    }
  }

  /**
   * Distinct falling-off-the-desk event sound combining edge slip noise and velocity-pitched drop whistle.
   */
  public playFall(fallSpeed = 3.0): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    const norm = Math.max(0.15, Math.min(1, fallSpeed / 12));

    // 1. Subtle wooden edge slip scrape
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100 + norm * 900, now);
      filter.frequency.exponentialRampToValueAtTime(380, now + 0.14);
      filter.Q.value = 2.0;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.08 + norm * 0.07, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      src.connect(filter).connect(nGain).connect(out);
      src.start(now);
      src.stop(now + 0.16);
    }

    // 2. Descending pitch drop scaled by exit velocity
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480 + norm * 240, now + 0.02);
    osc.frequency.exponentialRampToValueAtTime(125 + norm * 40, now + 0.44);

    gain.gain.setValueAtTime(0.14 + norm * 0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

    osc.connect(gain).connect(out);
    osc.start(now + 0.02);
    osc.stop(now + 0.48);
  }

  /**
   * Special Shot activation — a short rising energy sweep plus an airy noise whoosh so an
   * ability never feels silent. Deliberately compact (under 0.4s) and low-cost.
   */
  public playAbilityActivate(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.26);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.26);
    filter.Q.value = 3.2;

    osc.connect(filter).connect(gain).connect(out);
    osc.start(now);
    osc.stop(now + 0.36);

    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const nFilter = ctx.createBiquadFilter();
      nFilter.type = 'highpass';
      nFilter.frequency.setValueAtTime(700, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.exponentialRampToValueAtTime(0.1, now + 0.04);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      src.connect(nFilter).connect(nGain).connect(out);
      src.start(now);
      src.stop(now + 0.32);
    }
  }

  /** Short two-note chime telling the player their Special Shot is available again. */
  public playAbilityReady(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    [880, 1318.51].forEach((freq, idx) => {
      const start = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain).connect(out);
      osc.start(start);
      osc.stop(start + 0.21);
    });
  }

  public playCountdownTick(isFinalGo: boolean): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isFinalGo) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.06);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain).connect(out);
      osc.start(now);
      osc.stop(now + 0.29);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.13, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain).connect(out);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  }

  public playVictory(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.34);
      osc.connect(gain).connect(out);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  }

  public playDefeat(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;

    const notes = [392.0, 349.23, 311.13, 261.63];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
      osc.connect(gain).connect(out);
      osc.start(start);
      osc.stop(start + 0.33);
    });
  }

  private startMusicLoop(): void {
    if (this.musicTimer !== null || !this.musicEnabled) return;
    this.musicTimer = window.setInterval(() => {
      if (!this.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const freq = this.melodyNotes[this.musicStep % this.melodyNotes.length];
      this.musicStep++;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.42);
      osc.connect(gain).connect(this.compressor ?? this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.44);
    }, 520);
  }

  /** Short procedural warning tick when 5s or 3s remain on a player's turn. */
  public playTimerWarning(isUrgent = false): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isUrgent ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isUrgent ? 880 : 660, now);
    osc.frequency.exponentialRampToValueAtTime(isUrgent ? 980 : 720, now + 0.04);
    gain.gain.setValueAtTime(isUrgent ? 0.14 : 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain).connect(out);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /** Notification sound played when player's countdown reaches zero (turn skipped). */
  public playTimeExpired(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    // Two-tone descending buzzer
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(320, now);
    osc1.frequency.exponentialRampToValueAtTime(160, now + 0.18);
    osc2.frequency.setValueAtTime(316, now);
    osc2.frequency.exponentialRampToValueAtTime(158, now + 0.18);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(out);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.23);
    osc2.stop(now + 0.23);
  }

  /** Crisp, subtle chime when turn transfers to a new player. */
  public playTurnSwitch(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.05); // E5
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain).connect(out);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public dispose(): void {
    this.stopMusicLoop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.compressor = null;
      this.masterGain = null;
    }
  }
}
