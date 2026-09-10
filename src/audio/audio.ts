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
  | 'place'
  | 'toggle'
  | 'chime'
  | 'error'
  | 'cableMove'
  | 'cableSnap'
  | 'cableReject'
  | 'coffeeCatch'
  | 'bugHit'
  | 'reward'
  /** a tap on a click station — short, woody, pitched up by the combo. */
  | 'stationTap'
  /** a critical tap: the same gesture, but it lands. */
  | 'stationCrit'
  /** a tap that dropped a golden nut. */
  | 'stationGolden';

/** Per-call shaping for an SFX. */
export interface SfxOptions {
  /**
   * Frequency multiplier, so the same sound can rise with a combo without
   * needing a separate sample per step. Clamped to a musical range.
   */
  pitch?: number;
}

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

export interface AudioDiagnostics {
  /** 'none' before the context exists, else the AudioContext.state. */
  contextState: string;
  started: boolean;
  flags: AudioFlags;
  /** effective master gain (0 while muted). */
  masterGain: number;
  /** effective per-bus gain (0 while master- or channel-muted). */
  buses: Record<AudioChannel, number>;
  /** number of currently-live oscillators/sources routed through the graph. */
  activeSources: number;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  // Dedicated buses for interface + sound-effects so EVERY sound flows through a
  // named bus node (not just per-note math): channel volume and per-channel mute
  // are enforced at the node, and master mute at the master node silences them
  // all at once.
  private uiGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private humSource: AudioBufferSourceNode | null = null;
  private volumes: AudioVolumes = { master: 0.8, music: 0.4, ambience: 0.5, ui: 0.8, sfx: 0.8 };
  private flags: AudioFlags = { muted: false, quiet: false, focus: false };
  /** live count of scheduled oscillators/sources, for dev diagnostics. */
  private activeSources = 0;

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
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext)) ||
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
      this.uiGain = this.ctx.createGain();
      this.uiGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.applyGains();
    }
    void this.ctx?.resume();
  }

  /** Register a scheduled source so diagnostics can report live source count. */
  private track(node: AudioScheduledSourceNode): void {
    this.activeSources += 1;
    node.addEventListener('ended', () => {
      this.activeSources = Math.max(0, this.activeSources - 1);
    });
  }

  /** Live audio-bus diagnostics for the developer panel. Works headless (no
   *  Web Audio context) by reporting the effective gains from the pure math. */
  getDiagnostics(): AudioDiagnostics {
    return {
      contextState: this.ctx?.state ?? 'none',
      started: this.started,
      flags: { ...this.flags },
      masterGain: this.effectiveMaster(),
      buses: {
        music: channelGain('music', this.volumes, this.flags, this.channelMuted),
        ambience: channelGain('ambience', this.volumes, this.flags, this.channelMuted),
        ui: channelGain('ui', this.volumes, this.flags, this.channelMuted),
        sfx: channelGain('sfx', this.volumes, this.flags, this.channelMuted),
      },
      activeSources: this.activeSources,
    };
  }

  setVolumes(v: AudioVolumes): void {
    this.volumes = v;
    this.applyGains();
  }

  setFlags(f: Partial<AudioFlags>): void {
    this.flags = { ...this.flags, ...f };
    this.applyGains();
  }

  setChannelMutes(
    m: Partial<{ music: boolean; ambience: boolean; ui: boolean; sfx: boolean }>,
  ): void {
    this.channelMuted = { ...this.channelMuted, ...m };
    this.applyGains();
  }

  private effectiveMaster(): number {
    return effectiveMasterGain(this.volumes, this.flags);
  }

  private applyGains(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const master = this.effectiveMaster();
    const music = channelGain('music', this.volumes, this.flags, this.channelMuted);
    const ambience = channelGain('ambience', this.volumes, this.flags, this.channelMuted);
    const ui = channelGain('ui', this.volumes, this.flags, this.channelMuted);
    const sfx = channelGain('sfx', this.volumes, this.flags, this.channelMuted);

    // Master mute must be INSTANT: hard-cut the master node to 0 immediately so
    // any sound already ringing out is silenced the moment the button is hit.
    // (Every bus — music, ambience, ui, sfx — routes through master, so this one
    // node silences the entire game.) Unmuting ramps smoothly back up.
    const setBus = (node: GainNode | null, value: number, tau: number) => {
      if (!node) return;
      if (this.flags.muted) {
        // Master mute is INSTANT: hard-cut so anything ringing out is silenced
        // the moment the button is hit.
        node.gain.cancelScheduledValues(t);
        node.gain.setValueAtTime(0, t);
      } else {
        // Everything else — including a channel mute (value 0), e.g. the Music
        // toggle — ramps smoothly, giving music a short fade instead of a cut.
        node.gain.setTargetAtTime(Math.max(0, value), t, tau);
      }
    };
    setBus(this.master, master, 0.05);
    setBus(this.musicGain, music, 0.3);
    setBus(this.ambienceGain, ambience, 0.3);
    setBus(this.uiGain, ui, 0.02);
    setBus(this.sfxGain, sfx, 0.02);
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
    this.track(src);
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
      this.track(osc);
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
    this.track(osc);
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
    this.track(osc);
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
    this.track(osc);
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
    this.track(osc);
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
    this.track(src);
    src.start(time);
  }

  // -- SFX ------------------------------------------------------------------
  play(name: SfxName, opts: SfxOptions = {}): void {
    const isUi = name === 'click' || name === 'error';
    // A combo can run long, so clamp the pitch into a range that stays musical
    // instead of climbing into a whistle.
    const pitch = Math.max(0.5, Math.min(2.4, opts.pitch ?? 1));
    const bus = isUi ? this.uiGain : this.sfxGain;
    // Master mute is checked here AND enforced at the master node; the per-note
    // sound routes through its bus (uiGain/sfxGain), so channel volume + channel
    // mute are applied at the bus and master mute silences it at the master.
    if (!this.ctx || !bus || this.flags.muted) return;
    // Skip creating nodes entirely when the channel is silent (CPU saving).
    if (channelGain(isUi ? 'ui' : 'sfx', this.volumes, this.flags, this.channelMuted) <= 0) return;
    const now = this.ctx.currentTime;

    const beep = (
      freq: number,
      dur: number,
      type: OscillatorType,
      startAt: number,
      vol = 0.3,
      slideTo?: number,
    ) => {
      if (!this.ctx || !bus) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * pitch, now + startAt);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo * pitch, now + startAt + dur);
      g.gain.setValueAtTime(0.0001, now + startAt);
      g.gain.exponentialRampToValueAtTime(vol, now + startAt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + startAt + dur);
      osc.connect(g).connect(bus);
      this.track(osc);
      osc.start(now + startAt);
      osc.stop(now + startAt + dur + 0.02);
    };

    const texture = (dur: number, cutoff: number, vol: number, startAt = 0) => {
      if (!this.ctx || !bus) return;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        const envelope = Math.pow(1 - index / length, 1.8);
        data[index] = (Math.random() * 2 - 1) * envelope;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = cutoff;
      filter.Q.value = 1.4;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0.0001, vol), now + startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startAt + dur);
      source.connect(filter).connect(gain).connect(bus);
      this.track(source);
      source.start(now + startAt);
    };

    switch (name) {
      case 'click':
        beep(660, 0.06, 'triangle', 0, 0.25);
        break;
      case 'collect':
        beep(520, 0.08, 'sine', 0, 0.3, 780);
        break;
      // A station tap is deliberately SHORT (~45ms) so it can retrigger dozens
      // of times a second without the notes smearing into a drone. The caller
      // raises `pitch` with the combo, which is what makes a streak feel like it
      // is building.
      case 'stationTap':
        beep(430, 0.045, 'triangle', 0, 0.22, 520);
        texture(0.035, 1500, 0.05);
        break;
      case 'stationCrit':
        beep(660, 0.09, 'square', 0, 0.22, 990);
        beep(990, 0.11, 'triangle', 0.05, 0.2, 1320);
        break;
      case 'stationGolden':
        [784, 1046, 1318].forEach((f, i) => beep(f, 0.12, 'sine', i * 0.06, 0.24));
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
      case 'place':
        // A soft "set it down" — a gentle low settle plus a tiny wooden tick.
        beep(300, 0.09, 'sine', 0, 0.16, 200);
        beep(720, 0.05, 'triangle', 0.03, 0.1);
        break;
      case 'toggle':
        // A small two-tone switch flick (lamp / screen / tank on-off).
        beep(880, 0.04, 'triangle', 0, 0.16);
        beep(560, 0.05, 'triangle', 0.03, 0.12);
        break;
      case 'chime':
        // A short bright shimmer for a trophy / statue tap.
        beep(784, 0.09, 'sine', 0, 0.18, 1046);
        beep(1175, 0.1, 'sine', 0.05, 0.12);
        break;
      case 'error':
        beep(220, 0.12, 'sawtooth', 0, 0.2, 150);
        break;
      case 'cableMove':
        // Soft rubber/plastic movement: low flex plus a tiny braided scrape.
        beep(145, 0.08, 'sine', 0, 0.1, 115);
        texture(0.07, 1150, 0.045, 0.01);
        break;
      case 'cableSnap':
        // Connector shell click, metal contact, then a warm powered-on ping.
        texture(0.045, 2100, 0.11);
        beep(420, 0.07, 'triangle', 0, 0.18, 560);
        beep(840, 0.13, 'sine', 0.055, 0.13, 1120);
        break;
      case 'cableReject':
        texture(0.08, 760, 0.07);
        beep(210, 0.09, 'triangle', 0, 0.16, 165);
        beep(175, 0.08, 'triangle', 0.07, 0.12, 145);
        break;
      case 'coffeeCatch':
        // Ceramic tick, liquid plop and a tiny success sparkle.
        texture(0.08, 540, 0.07);
        beep(330, 0.11, 'sine', 0, 0.13, 245);
        beep(760, 0.08, 'triangle', 0.045, 0.12, 940);
        break;
      case 'bugHit':
        // Paper desk slap with a deliberately cartoony low pop.
        texture(0.1, 980, 0.1);
        beep(160, 0.08, 'triangle', 0, 0.17, 105);
        break;
      case 'reward':
        texture(0.08, 2600, 0.04);
        [659, 784, 988, 1318].forEach((frequency, index) =>
          beep(frequency, 0.16, 'sine', index * 0.065, 0.16),
        );
        break;
    }
  }
}

export const audio = new AudioManager();
