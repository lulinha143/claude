// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initI18n } from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import { CuriosityLog } from '../src/ui/CuriosityLog';
import { createInitialState } from '../src/sim/state';
import { performPrestige } from '../src/sim/prestige';
import { ROOMS } from '../src/content/rooms';
import type { GameState } from '../src/sim/types';

/**
 * The Archive's curiosity log is an investigation board: what was noticed can be
 * picked up and read (where, when, what made it possible, where it led), the
 * clues still open head the board, and nothing unnoticed is ever named.
 */

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
const oddity = en.oddity as Record<string, Record<string, string>>;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function noticed(...ids: string[]): GameState {
  const state = createInitialState(T0);
  for (const room of ROOMS) if (room.unlock.upgradeId) state.upgrades[room.unlock.upgradeId] = 1;
  state.resources.reputation = 6_000;
  for (const id of ids) state.flags[`oddity.${id}`] = T0;
  return state;
}

describe('the curiosity log', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeAll(async () => {
    await initI18n('en');
  });
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });
  const render = (state: GameState) => act(() => root.render(<CuriosityLog state={state} />));
  const click = (selector: string) => {
    const element = host.querySelector<HTMLElement>(selector);
    expect(element, selector).not.toBeNull();
    act(() => element!.click());
  };

  it('names nothing still unnoticed: a blank stays blank, an aftermath does not exist', () => {
    render(noticed('missing-stapler'));
    const text = host.textContent ?? '';
    // The poster is on the board...
    expect(text).toContain(oddity['missing-stapler'].title);
    // ...and where it points is a marked blank, not a name or a solution.
    expect(text).not.toContain(oddity['stapler-return'].title);
    expect(text).not.toContain(oddity['stapler-return'].found);
    const pointed = host.querySelectorAll('.curiosity.is-pointed');
    expect(pointed).toHaveLength(1);
    expect(pointed[0].getAttribute('aria-label')).toBe(en.collections.curiosityPointed);
    // The aftermath of a choice not taken is nowhere at all.
    expect(host.querySelector('[data-oddity="neon-pink-sign"]')).toBeNull();
    expect(text).not.toContain(oddity['neon-pink-sign'].title);
    // The clue itself heads the board.
    expect(host.querySelector('.curiosity-lead')?.textContent).toContain(
      oddity['missing-stapler'].lead,
    );
  });

  it('picks a curiosity up: the thing, where and when, and what made it possible', () => {
    const state = noticed('neon-pink-sign');
    state.flags['rebrand.neonpink'] = T0;
    render(state);
    click('.curiosity[data-oddity="neon-pink-sign"] .curiosity__card');
    const file = host.querySelector('.curiosity-file[data-oddity="neon-pink-sign"]');
    expect(file).not.toBeNull();
    const text = file!.textContent ?? '';
    expect(text).toContain(oddity['neon-pink-sign'].found);
    expect(text).toContain(en.collections.file.spot.wall);
    // The decision it came out of, in the card's own words.
    expect(text).toContain((en.incident.rebrand as Record<string, string>).title);
    expect(text).toContain((en.incident.rebrand as Record<string, string>).both);
    expect(
      host
        .querySelector('.curiosity[data-oddity="neon-pink-sign"] .curiosity__card')
        ?.getAttribute('aria-expanded'),
    ).toBe('true');
    // Put back.
    click('.curiosity-file__close');
    expect(host.querySelector('.curiosity-file')).toBeNull();
  });

  it('keeps a closed room on the board after a restructure: its cards and its leads still open', () => {
    const state = noticed('item-four');
    state.stats.totalNutsEarned = 2_000_000;
    const after = performPrestige(state, 'industrial', T0);
    render(after);
    // The meeting room closed with the restructure; what was noticed there is kept.
    const room = host.querySelector('.curiosity-room[data-room="meeting"]');
    expect(room, 'the closed room left the board').not.toBeNull();
    expect(room!.getAttribute('data-closed')).toBe('true');
    expect(room!.textContent).toContain(en.collections.curiosityRoomClosed);
    expect(room!.textContent).toContain(oddity['item-four'].title);
    expect(host.querySelector('.curiosity-log__count')?.textContent).toMatch(/^1 of \d+/);
    // The clue it holds still opens its file (it used to open nothing).
    click('.curiosity-lead[data-oddity="item-four"]');
    expect(host.querySelector('.curiosity-file[data-oddity="item-four"]')).not.toBeNull();
    click('.curiosity-file__close');
    click('.curiosity[data-oddity="item-four"] .curiosity__card');
    expect(host.querySelector('.curiosity-file[data-oddity="item-four"]')).not.toBeNull();
  });

  it('follows a lead to the incident it became, and the call that was made', () => {
    const state = noticed('soup-week');
    state.flags['soup.named'] = T0 + 10;
    state.flags['soup.done'] = T0 + 10;
    state.eventHistory.push({ eventId: 'soup-week-two', choiceId: 'name', at: T0 + 10 });
    render(state);
    // Followed: no longer an open lead.
    expect(host.querySelector('.curiosity-leads')).toBeNull();
    click('.curiosity[data-oddity="soup-week"] .curiosity__card');
    const text = host.querySelector('.curiosity-file')?.textContent ?? '';
    expect(text).toContain((en.incident.soup as Record<string, string>).title);
    expect(text).toContain((en.incident.soup as Record<string, string>).name);
    expect(text).not.toContain(oddity['soup-week'].lead);
  });
});
