import { describe, it, expect } from 'vitest';
import {
  effectiveMasterGain,
  channelGain,
  AudioManager,
  type AudioChannel,
} from '../src/audio/audio';

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

describe('AudioManager centralized-bus diagnostics (headless, no Web Audio)', () => {
  const setup = () => {
    const am = new AudioManager();
    am.setVolumes(VOL);
    return am;
  };

  it('reports every bus and the master, and works before any context exists', () => {
    const am = setup();
    const d = am.getDiagnostics();
    expect(d.contextState).toBe('none');
    expect(d.started).toBe(false);
    expect(d.activeSources).toBe(0);
    expect(d.masterGain).toBeGreaterThan(0);
    for (const ch of CHANNELS) expect(d.buses[ch]).toBeGreaterThan(0);
  });

  it('Master Mute zeroes the master AND every bus in the diagnostics', () => {
    const am = setup();
    am.setFlags({ muted: true });
    const d = am.getDiagnostics();
    expect(d.flags.muted).toBe(true);
    expect(d.masterGain).toBe(0);
    for (const ch of CHANNELS) expect(d.buses[ch]).toBe(0);
  });

  it('unmuting restores the buses (per-channel volumes were never erased)', () => {
    const am = setup();
    am.setFlags({ muted: true });
    am.setFlags({ muted: false });
    const d = am.getDiagnostics();
    expect(d.masterGain).toBeGreaterThan(0);
    for (const ch of CHANNELS) expect(d.buses[ch]).toBeGreaterThan(0);
  });

  it('per-channel mute only zeroes that one bus', () => {
    const am = setup();
    am.setChannelMutes({ music: true });
    const d = am.getDiagnostics();
    expect(d.buses.music).toBe(0);
    expect(d.buses.ambience).toBeGreaterThan(0);
    expect(d.buses.sfx).toBeGreaterThan(0);
    expect(d.buses.ui).toBeGreaterThan(0);
  });

  it('play() and the beds are safe no-ops without a Web Audio context', () => {
    const am = setup();
    expect(() => am.play('click')).not.toThrow();
    expect(() => am.play('prestige')).not.toThrow();
    expect(() => am.startAmbience()).not.toThrow();
    expect(() => am.setActive(false)).not.toThrow();
    expect(am.getDiagnostics().activeSources).toBe(0);
  });
});
