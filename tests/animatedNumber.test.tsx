// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnimatedNumber } from '../src/ui/AnimatedNumber';

/**
 * The HUD's counter. It follows production exactly, however rarely the browser
 * draws (it used to fall seconds of production behind on a busy machine), and
 * glides only across a jump, landing exactly on it. (Its old drift below zero under
 * real browser frame timing is also pinned by the office-play E2E walk.)
 */

let root: Root | null = null;
let host: HTMLElement | null = null;
let clock = 0;
let frames: FrameRequestCallback[] = [];

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A page whose frames run only when the test says so, on a clock it moves. */
function mount(reducedMotion = false) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clock = 0;
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  return (value: number) =>
    act(() => {
      root!.render(
        <AnimatedNumber value={value} format={(v) => String(v)} reducedMotion={reducedMotion} />,
      );
    });
}

/** Let the browser draw one frame now. */
function drawFrame() {
  act(() => {
    for (const cb of frames.splice(0)) cb(clock);
  });
}

const shown = () => host!.textContent ?? '';

describe('the animated counter', () => {
  it('lands exactly on its target once the tween has run', () => {
    const render = mount();
    render(10);
    render(25);
    for (let i = 0; i < 40; i += 1) {
      clock += 16;
      drawFrame();
    }
    expect(shown()).toBe('25');
  });

  it('moves with production at once, however rarely the frames come', () => {
    const render = mount();
    let value = 10_000;
    render(value);
    // Ten steps a second, a frame only every 300 ms (a busy computer).
    for (let step = 1; step <= 50; step += 1) {
      clock += 100;
      value += 50;
      render(value);
      if (step % 3 === 0) drawFrame();
      expect(shown()).toBe(String(value));
    }
  });

  it('glides across a jump from where it was, and lands on it even with frames far apart', () => {
    const render = mount();
    render(1_000);
    render(50_000);
    // Before any frame it still says what it said: the jump is to be seen arriving.
    expect(shown()).toBe('1000');
    clock += 250;
    drawFrame();
    const midway = Number(shown());
    expect(midway).toBeGreaterThan(1_000);
    expect(midway).toBeLessThan(50_000);
    clock += 250;
    drawFrame();
    expect(shown()).toBe('50000');
    // Production arriving mid-glide is carried along, and the glide still lands.
    render(50_400);
    clock += 16;
    drawFrame();
    expect(shown()).toBe('50400');
  });

  it('never shows a balance below zero', () => {
    const render = mount();
    render(0);
    render(1_000);
    // A small spend while it is still gliding up from nothing.
    render(995);
    expect(Number(shown())).toBeGreaterThanOrEqual(0);
    clock += 500;
    drawFrame();
    expect(shown()).toBe('995');
  });

  it('shows a jump at once with reduced motion', () => {
    const render = mount(true);
    render(1_000);
    render(50_000);
    expect(shown()).toBe('50000');
  });
});
