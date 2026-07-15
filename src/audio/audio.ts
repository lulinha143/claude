// Original, fully synthesized audio via the Web Audio API. No sample files, no
// copyrighted music — every sound (SFX, cozy background music, and office
// ambience) is generated from oscillators and noise at runtime, so the
// repository ships nothing that needs licensing. Respects per-channel volume,
// master mute, Quiet Mode and Focus Mode, and pauses when the tab is hidden.

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

export type AudioChannel = 'music' | 'ambience' | 'ui' | 'sfx';
export type ChannelMutes = Record<AudioChannel, boolean>;

// --- pure gain math (unit-tested; no Web Audio needed) --------------------
// Master mute is authoritative: when muted, EVERY channel returns 0. Quiet mode
// attenuates the master. Per-channel mute or a zero slider silences just that
// channel. Focus mode ducks music/ambience.
export function effectiveMasterGain(volumes: AudioVolumes, flags: AudioFlags): number {
  if (flags.muted) return 0;
  let m = volumes.master;
  if (flags.quiet) m *= 0.25;
  return m;
}

export function channelGain(
  channel: AudioChannel,
  volumes: AudioVolumes,
  flags: AudioFlags,
  channelMuted: ChannelMutes,
): number {
  if (flags.muted) return 0; // master mute silences everything
  if (channelMuted[channel]) return 0;
  switch (channel) {
    case 'music':
      return volumes.music * 0.5 * (flags.focus ? 0.6 : 1);
    case 'ambience':
      return volumes.ambience * 0.62 * (flags.focus ? 0.35 : 1);
    case 'ui':
      return volumes.ui * 1.15;
    case 'sfx':
      return volumes.sfx * 1.15;
  }
}

// Cozy, evolving background score — still 100% synthesized (no samples, nothing
// to license). Several 4-bar chord progressions rotate so the music never
// settles into an obvious loop; a soft pad + gentle bass hold the harmony while
// a melody wanders a pentatonic scale (a smooth random walk with occasional
// rests), so it stays warm and never intrusive. The lookahead scheduler makes
// every transition seamless.
const PROGRESSIONS: number[][][] = [
  // C  – Am – F  – G
  [
    [130.81, 164.81, 196.0],
    [110.0, 164.81, 196.0],
    [174.61, 220.0, 261.63],
    [146.83, 196.0, 246.94],
  ],
  // Dm – G  – C  – F   (a brighter turn)
  [
    [146.83, 174.61, 220.0],
    [196.0, 246.94, 293.66],
    [130.81, 164.81, 196.0],
    [174.61, 220.0, 261.63],
  ],
  // Am – Dm – Em – G   (a wistful turn)
  [
    [110.0, 130.81, 164.81],
    [146.83, 174.61, 220.0],
    [164.81, 196.0, 246.94],
    [196.0, 246.94, 293.66],
  ],
];
// C major pentatonic across two octaves — always pleasant, never dissonant.
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
const BEAT = 0.82; // seconds per beat (~73 bpm)

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private humSource: AudioBufferSourceNode | null = null;
  private volumes: AudioVolumes = { master: 0.8, music: 0.4, ambience: 0.5, ui: 0.8, sfx: 0.8 };
  private flags: AudioFlags = { muted: false, quiet: false, focus: false };

  private limiter: DynamicsCompressorNode | null = null;
  private channelMuted = { music: false, ambience: false, ui: false, sfx: false };
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private ambienceTimer: ReturnType<typeof setTimeout> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private melodyIdx = 3; // current position in the pentatonic scale (random walk)
  private started = false;

  /** Must be called from a user gesture (browser autoplay policy). */
  resume(): void {
    if (!this.ctx) {
      const Ctor =
        (typeof window !== 'undefined' &&
          (window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) ||
        null;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      // A gentle master limiter catches peaks so the louder mix never clips.
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -6;
      this.limiter.knee.value = 6;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.25;
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.connect(this.master);
      this.applyGains();
    }
    void this.ctx?.resume();
  }

  setVolumes(v: AudioVolumes): void {
    this.volumes = v;
    this.applyGains();
  }

  setFlags(f: Partial<AudioFlags>): void {
    this.flags = { ...this.flags, ...f };
    this.applyGains();
  }

  setChannelMutes(m: Partial<{ music: boolean; ambience: boolean; ui: boolean; sfx: boolean }>): void {
    this.channelMuted = { ...this.channelMuted, ...m };
    this.applyGains();
  }

  private effectiveMaster(): number {
    return effectiveMasterGain(this.volumes, this.flags);
  }

  private applyGains(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Master mute drives the master node to 0, which alone silences music,
    // ambience and every SFX (all route through it). We also zero the per-
    // channel beds so nothing lingers.
    this.master?.gain.setTargetAtTime(this.effectiveMaster(), t, 0.05);
    const music = channelGain('music', this.volumes, this.flags, this.channelMuted);
    const ambience = channelGain('ambience', this.volumes, this.flags, this.channelMuted);
    this.musicGain?.gain.setTargetAtTime(music, t, 0.4);
    this.ambienceGain?.gain.setTargetAtTime(ambience, t, 0.4);
  }

  /** Starts the music + ambience beds (idempotent). Named startAmbience for
   *  backwards compatibility with existing callers. */
  startAmbience(): void {
    if (!this.ctx || this.started) return;
    this.started = true;
    this.startHum();
    this.startMusic();
    this.scheduleAmbienceOneShot();
  }

  /** Suspend/resume the whole audio context when the window is hidden
   *  (battery-friendly). No-op before the context exists (before first gesture). */
  setActive(active: boolean): void {
    if (!this.ctx) return;
    if (active) void this.ctx.resume();
    else void this.ctx.suspend();
  }

  stopAmbience(): void {
    this.started = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    if (this.ambienceTimer) clearTimeout(this.ambienceTimer);
    this.musicTimer = null;
    this.ambienceTimer = null;
    try {
      this.humSource?.stop();
    } catch {
      /* already stopped */
    }
    this.humSource?.disconnect();
    this.humSource = null;
  }

  // -- ambience bed: a soft looping filtered-noise "room tone" --------------
  private startHum(): void {
    if (!this.ctx || !this.ambienceGain) return;
    const len = Math.floor(this.ctx.sampleRate * 2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      // brown-ish noise for a soft, warm bed
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.value = 0.12;
    src.connect(lp).connect(g).connect(this.ambienceGain);
    src.start();
    this.humSource = src;
  }

  // -- background music: lookahead scheduler --------------------------------
  private startMusic(): void {
    if (!this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.15;
    this.step = 0;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 60);
  }

  private scheduleMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    // skip work when music is effectively silent (mute/quiet) to save CPU
    if (this.effectiveMaster() <= 0 || this.volumes.music <= 0) {
      this.nextNoteTime = this.ctx.currentTime + 0.15;
      return;
    }
    const lookahead = 0.3;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      const beat = this.step % 4;
      const bar = Math.floor(this.step / 4);
      const prog = PROGRESSIONS[Math.floor(bar / 4) % PROGRESSIONS.length];
      const chord = prog[bar % 4];
      const t = this.nextNoteTime;

      if (beat === 0) {
        this.playPad(chord, t);
        this.playBass(chord[0] / 2, t, 0.9);
      } else if (beat === 2) {
        this.playBass(chord[0] / 2, t, 0.6);
      }

      // melody: a gentle random walk over the pentatonic scale, with rests for
      // breathing room and the occasional soft off-beat note.
      if (Math.random() < 0.72) {
        const stepMove = Math.floor(Math.random() * 5) - 2; // -2..+2
        this.melodyIdx = Math.max(0, Math.min(PENTATONIC.length - 1, this.melodyIdx + stepMove));
        const offbeat = Math.random() < 0.28 ? BEAT / 2 : 0;
        this.playPluck(PENTATONIC[this.melodyIdx], t + offbeat, 0.16);
      }
      // occasional airy bell to sparkle the downbeat
      if (beat === 0 && Math.random() < 0.22) {
        this.playPluck(PENTATONIC[PENTATONIC.length - 1] * 2, t, 0.06);
      }

      this.nextNoteTime += BEAT;
      this.step += 1;
    }
  }

  private playPad(freqs: number[], time: number): void {
    if (!this.ctx || !this.musicGain) return;
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(0.12, time + 0.4);
      g.gain.linearRampToValueAtTime(0.0001, time + BEAT * 4);
      osc.connect(g).connect(this.musicGain);
      osc.start(time);
      osc.stop(time + BEAT * 4 + 0.05);
    }
  }

  private playPluck(freq: number, time: number, vol = 0.18): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.6);
    osc.connect(g).connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.65);
  }

  // A soft, round bass note that underpins the harmony without muddiness.
  private playBass(freq: number, time: number, vol = 0.9): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.11 * vol, time + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, time + BEAT * 1.8);
    osc.connect(g).connect(lp).connect(this.musicGain);
    osc.start(time);
    osc.stop(time + BEAT * 1.8 + 0.05);
  }

  // -- office ambience one-shots: randomized, cooldowned --------------------
  private scheduleAmbienceOneShot(): void {
    const delay = 2600 + Math.random() * 5200;
    this.ambienceTimer = setTimeout(() => {
      if (this.started) {
        this.playAmbientSound();
        this.scheduleAmbienceOneShot();
      }
    }, delay);
  }

  private playAmbientSound(): void {
    if (!this.ctx || !this.ambienceGain) return;
    if (this.effectiveMaster() <= 0 || this.volumes.ambience <= 0) return;
    const kinds = ['type', 'type', 'paper', 'coffee', 'creak', 'drip'] as const;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const now = this.ctx.currentTime;
    switch (kind) {
      case 'type': {
        const count = 3 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i += 1) this.keyClick(now + i * (0.07 + Math.random() * 0.06));
        break;
      }
      case 'paper':
        this.noiseBurst(now, 0.35, 1800, 0.05);
        break;
      case 'coffee':
        this.ambientTone(now, 320, 200, 0.28, 0.05);
        break;
      case 'creak':
        this.ambientTone(now, 150, 110, 0.5, 0.045);
        break;
      case 'drip':
        this.ambientTone(now, 900, 500, 0.12, 0.05);
        break;
    }
  }

  private keyClick(time: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1600 + Math.random() * 700;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.06, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    osc.connect(g).connect(this.ambienceGain);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  private ambientTone(time: number, from: number, to: number, dur: number, vol: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(to, time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(this.ambienceGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private noiseBurst(time: number, dur: number, cutoff: number, vol: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(bp).connect(g).connect(this.ambienceGain);
    src.start(time);
  }

  // -- SFX ------------------------------------------------------------------
  play(name: SfxName): void {
    if (!this.ctx || !this.master || this.flags.muted) return;
    const isUi = name === 'click' || name === 'error';
    // Uses the shared pure gain math so master mute / channel mute / sliders
    // behave identically to the beds (limiter guards the peaks).
    const ch = channelGain(isUi ? 'ui' : 'sfx', this.volumes, this.flags, this.channelMuted);
    if (ch <= 0) return;
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
