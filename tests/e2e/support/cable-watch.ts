import type { Page } from '@playwright/test';

/**
 * Records every Cable Untangle desk that reaches the cleared state, from inside the page.
 *
 * Why this exists rather than polling `data-stage` from the test:
 *
 * A cleared desk auto-advances after TRANSITION_MS (1450ms, see CableUntangle) so the
 * celebration can play. Anything the test wants to know about the cleared board — that
 * the stage flipped, that the tangle count reached zero, that the panel announced itself
 * — is only true inside that window. Reading it from the test costs a round-trip per
 * question, and under parallel CPU load those round-trips routinely add up to more than
 * 1450ms. The board has then already moved on, so the assertions describe the NEXT desk:
 * "expected cleared, received solving", a tangle count belonging to a different puzzle,
 * or a missing `.cable__cleared` panel. Every one of those looks like a game bug and is
 * not one.
 *
 * A MutationObserver runs in the page instead. It sees `data-stage` flip in the same task
 * the DOM changed in, and captures the board's state at that instant. The test then
 * asserts against the RECORD, which cannot expire. That is also a stronger claim than
 * re-reading the DOM later: it proves the desk did reach a cleared state with zero
 * crossings, rather than proving a panel happens to still be on screen when the test
 * gets around to looking.
 *
 * Observes `document.body` rather than the board element, because the board is replaced
 * between rounds and an observer bound to one element would stop reporting after the
 * first advance.
 */
export interface CableClear {
  round: number;
  level: string | null;
  nodes: number;
  topology: string | null;
  crossings: string;
  panel: string;
}

export interface CableWatchOptions {
  /**
   * Pause the round the moment a desk clears, freezing the celebration so the test can
   * assert on it at leisure. Use for tests that examine the cleared board. Leave off for
   * tests that need the next desk to actually arrive.
   */
  pauseOnClear?: boolean;
}

export async function watchCableClears(page: Page, options: CableWatchOptions = {}) {
  await page.evaluate((pauseOnClear) => {
    interface Bag {
      __cableClears?: unknown[];
      __cableObserver?: MutationObserver;
    }
    const bag = window as unknown as Bag;
    bag.__cableObserver?.disconnect();
    bag.__cableClears = [];
    let lastStage: string | null = null;
    const observer = new MutationObserver(() => {
      const board = document.querySelector('.cable__board');
      if (!board) return;
      const stage = board.getAttribute('data-stage');
      // Only the transition INTO cleared counts, so one desk is recorded once.
      if (stage === lastStage) return;
      lastStage = stage;
      if (stage !== 'cleared') return;
      bag.__cableClears!.push({
        round: Number(board.getAttribute('data-round')),
        level: board.getAttribute('data-level'),
        nodes: Number(board.getAttribute('data-nodes')),
        topology: board.getAttribute('data-topology'),
        crossings: document.querySelector('.cable__crossings')?.textContent ?? '',
        panel: document.querySelector('.cable__cleared')?.textContent ?? '',
      });
      if (pauseOnClear) {
        (document.querySelector('.microgame__pause') as HTMLElement | null)?.click();
      }
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-stage'],
    });
    bag.__cableObserver = observer;
  }, options.pauseOnClear ?? false);
}

/** Every desk cleared so far, oldest first. */
export function cableClears(page: Page): Promise<CableClear[]> {
  return page.evaluate(
    () => ((window as { __cableClears?: CableClear[] }).__cableClears ?? []) as CableClear[],
  );
}

/**
 * The tangle count as a NUMBER.
 *
 * Reading it as text and asserting `not.toContainText('0')` is wrong, and it was: a
 * nine-plug desk showing "Tangles: 10" contains the substring "0", so a perfectly
 * ordinary tangled board failed the "this desk is not solved yet" check. Any count with
 * a zero digit — 10, 20, 30 — tripped it.
 */
export async function cableTangleCount(page: Page): Promise<number> {
  const text = (await page.locator('.cable__crossings').textContent()) ?? '';
  const digits = text.replace(/[^\d]/g, '');
  return digits === '' ? Number.NaN : Number(digits);
}
