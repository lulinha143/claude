import { describe, it, expect } from 'vitest';
import { effectiveMasterGain, channelGain, type AudioChannel } from '../src/audio/audio';

const VOL = { master: 0.8, music: 0.7, ambience: 0.75, ui: 0.8, sfx: 0.85 };
const NO_MUTES = { music: false, ambience: false, ui: false, sfx: false };
const CHANNELS: AudioChannel[] = ['music', 'ambience', 'ui', 'sfx'];

describe('audio gain math', () => {
  it('master mute silences the master and EVERY channel', () => {
    const flags = { muted: true, quiet: false, focus: false };
    expect(effectiveMasterGain(VOL, flags)).toBe(0);
    for (const ch of CHANNELS) {
      expect(channelGain(ch, VOL, flags, NO_MUTES)).toBe(0);
    }
  });

  it('unmuted channels are audible', () => {
    const flags = { muted: false, quiet: false, focus: false };
    expect(effectiveMasterGain(VOL, flags)).toBeGreaterThan(0);
    for (const ch of CHANNELS) {
      expect(channelGain(ch, VOL, flags, NO_MUTES)).toBeGreaterThan(0);
    }
  });

  it('quiet mode attenuates the master but does not fully mute', () => {
    const quiet = effectiveMasterGain(VOL, { muted: false, quiet: true, focus: false });
    const normal = effectiveMasterGain(VOL, { muted: false, quiet: false, focus: false });
    expect(quiet).toBeCloseTo(normal * 0.25, 5);
    expect(quiet).toBeGreaterThan(0);
  });

  it('per-channel mute silences only that channel', () => {
    const flags = { muted: false, quiet: false, focus: false };
    const mutes = { ...NO_MUTES, music: true };
    expect(channelGain('music', VOL, flags, mutes)).toBe(0);
    expect(channelGain('ambience', VOL, flags, mutes)).toBeGreaterThan(0);
    expect(channelGain('sfx', VOL, flags, mutes)).toBeGreaterThan(0);
  });

  it('a zero slider silences its channel', () => {
    const flags = { muted: false, quiet: false, focus: false };
    expect(channelGain('sfx', { ...VOL, sfx: 0 }, flags, NO_MUTES)).toBe(0);
  });

  it('focus mode ducks music and ambience', () => {
    const focus = { muted: false, quiet: false, focus: true };
    const normal = { muted: false, quiet: false, focus: false };
    expect(channelGain('music', VOL, focus, NO_MUTES)).toBeLessThan(
      channelGain('music', VOL, normal, NO_MUTES),
    );
    expect(channelGain('ambience', VOL, focus, NO_MUTES)).toBeLessThan(
      channelGain('ambience', VOL, normal, NO_MUTES),
    );
  });
});
