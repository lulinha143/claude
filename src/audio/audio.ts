// Original, fully synthesized audio via the Web Audio API. No sample files, no
// copyrighted music — every sound is generated from oscillators and noise at
// runtime, so the repository ships nothing that needs licensing. Respects
// per-channel volume, master mute, Quiet Mode and Focus Mode.

export type SfxName =
  | 'click'
  | 'collect'
  | 'upgrade'
  | 'event'
  | 'footstep'
  | 'coffee'
  | 'celebrate'
  | 'prestige'
  | 'error';

export interface AudioVolumes {
  master: number;
  music: number;
  ambience: number;
  ui: number;
  sfx: number;
}

interface AudioFlags {
  muted: boolean;
  quiet: boolean;
  focus: boolean;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceOsc: OscillatorNode | null = null;
  private volumes: AudioVolumes = { master: 0.8, music: 0.5, ambience: 0.5, ui: 0.8, sfx: 0.8 };
  private flags: AudioFlags = { muted: false, quiet: false, focus: false };

  /** Must be called from a user gesture (browser autoplay policy). */
  resume(): void {
    if (!this.ctx) {
      const Ctor =
        (typeof window !== 'undefined' &&
          (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) ||
        null;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyMasterGain();
    }
    void this.ctx?.resume();
  }

  setVolumes(v: AudioVolumes): void {
    this.volumes = v;
    this.applyMasterGain();
    this.applyAmbienceGain();
  }

  setFlags(f: Partial<AudioFlags>): void {
    this.flags = { ...this.flags, ...f };
    this.applyMasterGain();
    this.applyAmbienceGain();
  }

  private effectiveMaster(): number {
    if (this.flags.muted) return 0;
    let m = this.volumes.master;
    if (this.flags.quiet) m *= 0.25;
    return m;
  }

  private applyMasterGain(): void {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.effectiveMaster(), this.ctx.currentTime, 0.05);
    }
  }

  private applyAmbienceGain(): void {
    if (this.ambienceGain && this.ctx) {
      const base = this.flags.focus ? 0.2 : 1;
      this.ambienceGain.gain.setTargetAtTime(
        this.volumes.ambience * 0.05 * base,
        this.ctx.currentTime,
        0.3,
      );
    }
  }

  startAmbience(): void {
    if (!this.ctx || !this.master || this.ambienceOsc) return;
    // a very soft low drone = "cozy office hum"
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 70;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(this.master);
    osc.start();
    this.ambienceOsc = osc;
    this.ambienceGain = gain;
    this.applyAmbienceGain();
  }

  stopAmbience(): void {
    this.ambienceOsc?.stop();
    this.ambienceOsc?.disconnect();
    this.ambienceGain?.disconnect();
    this.ambienceOsc = null;
    this.ambienceGain = null;
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.master || this.flags.muted) return;
    const ch = name === 'click' || name === 'error' ? this.volumes.ui : this.volumes.sfx;
    const now = this.ctx.currentTime;

    const beep = (
      freq: number,
      dur: number,
      type: OscillatorType,
      startAt: number,
      vol = 0.3,
      slideTo?: number,
    ) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startAt);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + startAt + dur);
      g.gain.setValueAtTime(0.0001, now + startAt);
      g.gain.exponentialRampToValueAtTime(vol * ch, now + startAt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + startAt + dur);
      osc.connect(g).connect(this.master);
      osc.start(now + startAt);
      osc.stop(now + startAt + dur + 0.02);
    };

    switch (name) {
      case 'click':
        beep(660, 0.06, 'triangle', 0, 0.25);
        break;
      case 'collect':
        beep(520, 0.08, 'sine', 0, 0.3, 780);
        break;
      case 'upgrade':
        beep(440, 0.1, 'square', 0, 0.2, 660);
        beep(660, 0.12, 'square', 0.06, 0.2, 880);
        break;
      case 'event':
        beep(330, 0.18, 'sawtooth', 0, 0.2, 494);
        break;
      case 'footstep':
        beep(180, 0.04, 'triangle', 0, 0.12);
        break;
      case 'coffee':
        beep(300, 0.25, 'sine', 0, 0.15, 220);
        break;
      case 'celebrate':
        [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.14, 'triangle', i * 0.09, 0.25));
        break;
      case 'prestige':
        [392, 523, 659, 784, 1046, 1318].forEach((f, i) => beep(f, 0.18, 'sine', i * 0.11, 0.28));
        break;
      case 'error':
        beep(220, 0.12, 'sawtooth', 0, 0.2, 150);
        break;
    }
  }
}

export const audio = new AudioManager();
