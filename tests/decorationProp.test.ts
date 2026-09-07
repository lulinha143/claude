import { describe, it, expect } from 'vitest';
import { decorKind, interactSound } from '../src/art/DecorationProp';

describe('decoration interaction sounds', () => {
  it('maps lights/screens/tanks to the on-off toggle sound', () => {
    expect(interactSound('lamp')).toBe('toggle');
    expect(interactSound('screen')).toBe('toggle');
    expect(interactSound('aquarium')).toBe('toggle');
  });

  it('gives trophies a bright chime and plants/cushions a soft touch', () => {
    expect(interactSound('trophy')).toBe('chime');
    expect(interactSound('plant')).toBe('footstep');
    expect(interactSound('cushion')).toBe('footstep');
  });

  it('thunks boxes and clicks everything else', () => {
    expect(interactSound('box')).toBe('place');
    expect(interactSound('poster')).toBe('click');
    expect(interactSound('rug')).toBe('click');
  });

  it('routes real decorations to a sensible kind', () => {
    expect(decorKind('desk-lamp')).toBe('lamp');
    expect(decorKind('motivational-poster')).toBe('poster');
    expect(decorKind('aquarium')).toBe('aquarium');
    expect(decorKind('nut-statue')).toBe('trophy');
    expect(decorKind('filing-cabinet')).toBe('box');
  });
});
