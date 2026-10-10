// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnimatedNumber } from '../src/ui/AnimatedNumber';

/**
 * The HUD's counter tweens toward the balance. (Its drift below zero under real
 * browser frame timing is pinned by the office-play E2E walk, which a stubbed
 * animation frame cannot reproduce.)
 */

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.useRealTimers();
});

function mount() {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  return (value: number) =>
    act(() => {
      root!.render(<AnimatedNumber value={value} format={(v) => String(v)} />);
    });
}

describe('the animated counter', () => {
  it('lands exactly on its target once the tween has run', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let clock = 0;
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const render = mount();
    render(10);
    render(25);
    for (let i = 0; i < 40; i += 1) {
      clock += 16;
      act(() => {
        for (const cb of frames.splice(0)) cb(clock);
      });
    }
    expect(host!.textContent).toBe('25');
  });
});
