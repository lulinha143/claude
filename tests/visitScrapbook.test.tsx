// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initI18n } from '../src/i18n';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import pt from '../src/i18n/locales/pt-BR.json';
import { VisitScrapbook } from '../src/ui/modals/VisitScrapbook';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/types';

/**
 * The visit's Album, as the player reads it: the story is not named before it
 * begins, the keepsake is not there before it is known and then says where it is
 * and how it got there, and every answer is filed with your words and theirs.
 */

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const arc = en.arc as unknown as Record<string, Record<string, unknown>>;
const item = en.item as unknown as Record<string, string>;
const keepsake = en.keepsake as unknown as Record<
  string,
  Record<string, Record<string, string> | string>
>;

function teammate(id: string, friendship: number, mutate?: (s: GameState) => void): GameState {
  const state = createInitialState(T0);
  state.employees[id] = { ...state.employees[id], hired: true, level: 2, friendship };
  mutate?.(state);
  return state;
}

describe('the visit’s scrapbook', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeAll(async () => {
    await initI18n('en');
  });
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });
  const render = (state: GameState, id: string) =>
    act(() => root.render(<VisitScrapbook state={state} employeeId={id} now={T0 + 1000} />));

  it('names no story and shows no keepsake before either is known', () => {
    render(teammate('nino', 4), 'nino');
    const text = host.textContent ?? '';
    expect(text).not.toContain(arc.nino.title as string);
    expect(text).toContain("Nino's story");
    expect(host.querySelector('.visit-keepsake')).toBeNull();
    expect(text).not.toContain(item.cushion);
    // Once it is ready to be told, it has its name.
    render(teammate('nino', 15), 'nino');
    expect(host.querySelector('.visit__story-line')?.textContent).toContain(
      arc.nino.title as string,
    );
  });

  it('files your words beside theirs, and the keepsake with how it got to the desk', () => {
    const state = teammate('otto', 30, (s) => {
      s.flags['otto.arc.1'] = T0;
      s.flags['otto.arc.1.b'] = T0;
      s.flags['favorite.otto.cared'] = T0 + 500;
      s.employees.otto.talks = { count: 2, lastAt: T0 + 500, seen: { 'keepsake-otto': T0 + 500 } };
    });
    render(state, 'otto');
    const part1 = (arc.otto['1'] as Record<string, Record<string, string>>).b;
    const story = host.querySelector('.scrap--story')!;
    expect(story.querySelector('.scrap__said')?.textContent).toBe(`You: ${part1.label}`);
    expect(story.querySelector('.scrap__quote')?.textContent).toBe(part1.reply);
    const card = host.querySelector('.visit-keepsake')!;
    expect(card.getAttribute('data-placed')).toBe('desk');
    expect(card.querySelector('h4')?.textContent).toBe(item.ledger);
    const care = keepsake.otto.care as Record<string, string>;
    expect(card.textContent).toContain(`It went on the desk when you chose: ${care.label}`);
    expect(card.textContent).toContain(keepsake.otto.scene as string);
    const entry = host.querySelector('.scrap--keepsake')!;
    expect(entry.querySelector('.scrap__said')?.textContent).toBe(`You: ${care.label}`);
    expect(entry.querySelector('.scrap__quote')?.textContent).toBe(care.reply);
  });

  it('agrees in Portuguese: in the drawer for him, on her desk for her', async () => {
    await i18n.changeLanguage('pt-BR');
    render(
      teammate('otto', 30, (s) => {
        s.flags['favorite.otto.discussed'] = T0;
      }),
      'otto',
    );
    const kept = host.querySelector('.visit-keepsake')!;
    expect(kept.getAttribute('data-placed')).toBe('drawer');
    expect(kept.textContent).toContain(
      (pt.visit.keepsake.kept as string).replace('{{name}}', 'Otto'),
    );
    render(
      teammate('bea', 30, (s) => {
        s.flags['favorite.bea.cared'] = T0;
      }),
      'bea',
    );
    expect(host.querySelector('.visit-keepsake__where')?.textContent).toMatch(
      /^Na mesa dela desde /,
    );
  });
});
