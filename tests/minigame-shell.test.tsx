// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../src/i18n';
import { MicroGame } from '../src/ui/minigames/MicroGame';
import type { MicroReward } from '../src/sim/minigames';

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

  it('pays each round on its own ticket and hands a left round’s ticket back', async () => {
    let serial = 0;
    const onBegin = vi.fn(() => `ticket-${(serial += 1)}`);
    const onReward = vi.fn();
    const onAbandon = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <MicroGame
          mode="bugSquash"
          seed={5}
          reducedMotion
          onBegin={onBegin}
          onReward={onReward}
          onAbandon={onAbandon}
          onClose={onClose}
        />,
      );
    });
    await startRound(host);
    expect(onBegin).toHaveBeenCalledTimes(1);
    await advance(30_100);
    expect(onReward).toHaveBeenCalledWith(expect.any(Number), 'ticket-1');

    click(host, '.microgame__result .buy-btn');
    await startRound(host);
    expect(onBegin).toHaveBeenCalledTimes(2);
    click(host, '.microgame__exit');
    expect(onAbandon).toHaveBeenCalledWith('ticket-2');
    expect(onReward).toHaveBeenCalledTimes(1);
  });

  it('hands the ticket back when the sheet closes mid-round', async () => {
    const onAbandon = vi.fn();
    await act(async () => {
      root.render(
        <MicroGame
          mode="cableUntangle"
          seed={9}
          reducedMotion
          onBegin={() => 'live'}
          onReward={vi.fn()}
          onAbandon={onAbandon}
          onClose={() => {}}
        />,
      );
    });
    await startRound(host);
    act(() => root.render(<div />));
    expect(onAbandon).toHaveBeenCalledWith('live');
  });

  it('pauses a live round on Escape instead of leaving it, and resumes on the next', async () => {
    const onClose = vi.fn();
    const seen: boolean[] = [];
    const listener = (event: KeyboardEvent) => seen.push(event.defaultPrevented);
    window.addEventListener('keydown', listener);
    await act(async () => {
      root.render(
        <MicroGame
          mode="coffeeRescue"
          seed={3}
          reducedMotion
          onReward={vi.fn()}
          onClose={onClose}
        />,
      );
    });
    await startRound(host);
    const pause = () => host.querySelector('.microgame__pause')?.getAttribute('aria-pressed');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    });
    expect(pause()).toBe('true');
    expect(host.querySelector('.microgame__paused')).not.toBeNull();
    // The sheet's own Escape (a later listener) sees it already handled.
    expect(seen).toEqual([true]);
    const timer = host.querySelector('.microgame__timer')?.textContent;
    await advance(3_000);
    expect(host.querySelector('.microgame__timer')?.textContent).toBe(timer);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    });
    expect(pause()).toBe('false');
    expect(onClose).not.toHaveBeenCalled();
    window.removeEventListener('keydown', listener);
  });

  it('offers a way back into a countdown that a lost focus froze', async () => {
    await act(async () => {
      root.render(
        <MicroGame
          mode="coffeeRescue"
          seed={2}
          reducedMotion
          onReward={vi.fn()}
          onClose={() => {}}
        />,
      );
    });
    click(host, '.microgame__start');
    await advance(1_000);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    const count = host.querySelector('.microgame__countdown strong')?.textContent;
    await advance(3_000);
    expect(host.querySelector('.microgame__countdown strong')?.textContent).toBe(count);
    click(host, '.microgame__countdown .buy-btn');
    for (let second = 0; second < 3; second += 1) await advance(1_000);
    await advance(1);
    expect(host.querySelector('.microgame')?.getAttribute('data-phase')).toBe('play');
  });

  it('pauses when the window loses focus, and waits for the player', async () => {
    await act(async () => {
      root.render(
        <MicroGame mode="bugSquash" seed={4} reducedMotion onReward={vi.fn()} onClose={() => {}} />,
      );
    });
    await startRound(host);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(host.querySelector('.microgame__pause')?.getAttribute('aria-pressed')).toBe('true');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(host.querySelector('.microgame__pause')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('says so when a round was not paid, instead of promising a reward', async () => {
    await act(async () => {
      root.render(
        <MicroGame
          mode="coffeeRescue"
          seed={6}
          reducedMotion
          onReward={() => undefined}
          onClose={() => {}}
        />,
      );
    });
    await startRound(host);
    await advance(30_100);
    expect(host.querySelector('.microgame__reward-slip')?.textContent).toContain(
      'Shift already on file',
    );
  });

  it('stamps a new record beside the score and pins the souvenir with the other buttons', async () => {
    const reward: MicroReward = {
      nuts: 1200,
      boost: 1.35,
      boostSeconds: 90,
      ownBoost: 1.35,
      best: 0,
      previousBest: 0,
      newBest: true,
      mastered: true,
      masteredBefore: false,
      grade: 'perfect',
      goldenNuts: 1,
      employeeIds: [],
      decorationId: 'menu-chalkboard',
    };
    await act(async () => {
      root.render(
        <MicroGame
          mode="coffeeRescue"
          seed={8}
          reducedMotion
          onReward={() => reward}
          onClose={() => {}}
        />,
      );
    });
    await startRound(host);
    // Catch the first cup on the counter (reduced-motion tap mode).
    await advance(700);
    click(host, '.coffee__drop--tap');
    expect(host.querySelector('.microgame__score b')?.textContent).toBe('2');
    await advance(30_100);
    const result = host.querySelector('.microgame__result')!;
    const score = result.querySelector('.microgame__final-score')!;
    expect(score.querySelector('.microgame__best-stamp')?.textContent).toBe('New record');
    expect(result.querySelector('.microgame__prize')?.textContent).toContain('First mastery!');
    expect(result.querySelector('.microgame__prize')?.textContent).toContain('+1 golden nut');
    expect(result.querySelector('.microgame__reward-slip')?.textContent).toContain(
      '+35% production for 90 s',
    );
    const actions = result.querySelector('.microgame__result-actions')!;
    expect(actions.querySelector('.microgame__souvenir-btn')?.textContent).toContain('Menu Board');
    // Play again stays the first action (and the one that gets focus).
    expect(actions.querySelector('button')?.textContent).toContain('Play again');
    expect(result.querySelector('.microgame__result-scroll .microgame__souvenir-btn')).toBeNull();
  });
});
