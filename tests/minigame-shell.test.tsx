// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../src/i18n';
import { MicroGame } from '../src/ui/minigames/MicroGame';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

async function startRound(container: HTMLElement) {
  click(container, '.microgame__start');
  for (let second = 0; second < 3; second += 1) await advance(1_000);
  await advance(1);
}

function click(container: HTMLElement, selector: string) {
  const element = container.querySelector<HTMLButtonElement>(selector);
  if (!element) throw new Error(`Missing button: ${selector}`);
  act(() => element.click());
}

describe('shared minigame round lifecycle', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeAll(async () => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    await initI18n('en');
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('abandons an active Coffee round without granting a reward', async () => {
    const onReward = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <MicroGame
          mode="coffeeRescue"
          seed={31}
          reducedMotion
          onReward={onReward}
          onClose={onClose}
        />,
      );
    });

    await startRound(host);
    expect(host.querySelector('.microgame')?.getAttribute('data-phase')).toBe('play');
    click(host, '.microgame__exit');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onReward).not.toHaveBeenCalled();
  });

  it('completes each elapsed round once and fully resets before replay', async () => {
    const onReward = vi.fn();
    await act(async () => {
      root.render(
        <MicroGame
          mode="coffeeRescue"
          seed={47}
          reducedMotion
          onReward={onReward}
          onClose={() => {}}
        />,
      );
    });

    await startRound(host);
    await advance(30_100);
    expect(host.querySelector('.microgame')?.getAttribute('data-phase')).toBe('result');
    expect(onReward).toHaveBeenCalledTimes(1);

    click(host, '.microgame__result .buy-btn');
    expect(host.querySelector('.microgame')?.getAttribute('data-phase')).toBe('intro');
    await startRound(host);
    expect(host.querySelector('.microgame__score b')?.textContent).toBe('0');
    await advance(30_100);
    expect(host.querySelector('.microgame')?.getAttribute('data-phase')).toBe('result');
    expect(onReward).toHaveBeenCalledTimes(2);
  });
});
