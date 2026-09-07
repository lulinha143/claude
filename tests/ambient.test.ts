import { describe, it, expect } from 'vitest';
import { ambientState } from '../src/art/ambient';

describe('ambient throttle', () => {
  it('runs when the window is visible, at full power, with motion allowed', () => {
    expect(ambientState({ hidden: false, batterySaver: false, reducedMotion: false })).toBe('on');
  });

  it('pauses when the window is hidden or minimized', () => {
    expect(ambientState({ hidden: true, batterySaver: false, reducedMotion: false })).toBe('paused');
  });

  it('pauses in battery-saver mode', () => {
    expect(ambientState({ hidden: false, batterySaver: true, reducedMotion: false })).toBe('paused');
  });

  it('pauses under reduced motion', () => {
    expect(ambientState({ hidden: false, batterySaver: false, reducedMotion: true })).toBe('paused');
  });
});
