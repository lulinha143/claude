// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n, { initI18n } from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import pt from '../src/i18n/locales/pt-BR.json';
import { ObservationReportBody } from '../src/ui/ObservationReport';
import { createInitialState } from '../src/sim/state';
import { ROOMS, ROOMS_BY_ID } from '../src/content/rooms';
import { GAME_EVENTS_BY_ID } from '../src/content/events';
import { EMPLOYEES_BY_ID } from '../src/content/employees';
import { historyLabelKeys } from '../src/content/historyLabels';
import type { GameState } from '../src/sim/types';

/**
 * The observation report as the player reads it: who decided (in words, never by
 * colour alone), what, where, and a way there; what passed unseen is a black bar;
 * what is waiting comes first; the team's moments are in their own words.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const local = (day: number, hour: number) => new Date(2026, 9, day, hour, 0).getTime();
const NOW = local(21, 12);

function office(): GameState {
  const state = createInitialState(local(1, 9));
  for (const room of ROOMS) if (room.unlock.upgradeId) state.upgrades[room.unlock.upgradeId] = 1;
  state.resources.reputation = 6_000;
  const hire = (id: string, room: string) => {
    state.employees[id] = { ...state.employees[id], hired: true, level: 2, room };
  };
  hire('hazel', 'meeting');
  hire('nino', 'meeting');
  hire('axel', 'lab');
  hire('moss', 'research');
  hire('corvus', 'marketing');
  return state;
}

/** Something of everything the report tells. */
function busyOffice(): GameState {
  const state = office();
  state.eventHistory = [
    // From before attribution was recorded.
    { eventId: 'the-minutes', choiceId: 'sign', at: local(20, 18) },
    { eventId: 'the-minutes', choiceId: 'wake', at: local(21, 10), by: 'team', roomId: 'meeting' },
    {
      eventId: 'centrifuge-wont-stop',
      choiceId: 'unplug',
      at: local(21, 11),
      by: 'player',
      roomId: 'lab',
    },
  ];
  state.happenings.diary = [
    { at: local(21, 8), kind: 'moment', momentId: 'nap-on-the-agenda', roomId: 'meeting' },
    { at: local(21, 9), kind: 'incident', eventId: 'night-shift-report', roomId: 'research' },
    { at: local(21, 9) + 1, kind: 'faded', eventId: 'night-shift-report', roomId: 'research' },
    { at: local(21, 10), kind: 'handled', eventId: 'the-minutes', roomId: 'meeting' },
  ];
  state.happenings.incidents = [
    {
      id: 'incident-rebrand',
      eventId: 'the-rebrand',
      roomId: 'marketing',
      employeeId: 'corvus',
      at: local(21, 11) + 30_000,
      until: NOW + 600_000,
    },
  ];
  return state;
}

describe('the observation report', () => {
  let host: HTMLDivElement;
  let root: Root;
  const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;
  const title = (eventId: string) => t(GAME_EVENTS_BY_ID[eventId].titleKey);
  const choice = (eventId: string, choiceId: string) =>
    t(historyLabelKeys(eventId, choiceId).choiceKey);
  const room = (id: string) => t(ROOMS_BY_ID[id].nameKey);

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

  function render(state: GameState, onGo = vi.fn()) {
    act(() =>
      root.render(<ObservationReportBody state={state} now={NOW} titleId="obs" onGo={onGo} />),
    );
    return onGo;
  }
  const rows = (stamp: string) => [
    ...host.querySelectorAll<HTMLElement>(`.observation__row[data-stamp="${stamp}"]`),
  ];

  it('opens on an empty file before anything is on record', () => {
    render(office());
    expect(host.querySelector('#obs')?.textContent).toBe(en.observation.title);
    expect(host.querySelectorAll('.observation__row')).toHaveLength(0);
    expect(host.querySelector('.observation__empty')?.textContent).toContain(
      en.observation.emptyTitle,
    );
    expect(host.textContent).toContain(en.observation.foot);
  });

  it('says who decided, what, where, and offers the way there', () => {
    const onGo = render(busyOffice());
    const [team] = rows('team');
    expect(team.textContent).toContain(title('the-minutes'));
    expect(team.textContent).toContain(
      t('observation.decision.team', { choice: choice('the-minutes', 'wake') }),
    );
    expect(team.querySelector('.observation__mark')?.textContent).toBe(en.observation.by.team);
    expect(team.querySelector('.observation__where')?.textContent).toBe(room('meeting'));
    const go = team.querySelector<HTMLButtonElement>('.observation__go')!;
    expect(go.getAttribute('aria-label')).toBe(t('observation.goLabel', { room: room('meeting') }));
    act(() => go.click());
    expect(onGo).toHaveBeenCalledWith('meeting', false);

    const [player] = rows('player');
    expect(player.textContent).toContain(
      t('observation.decision.player', { choice: choice('centrifuge-wont-stop', 'unplug') }),
    );
    expect(player.querySelector('.observation__mark')?.textContent).toBe(en.observation.by.player);

    // An older save's record: told, without saying who, and with nowhere to go.
    const [filed] = rows('unknown');
    expect(filed.textContent).toContain(
      t('observation.decision.unknown', { choice: choice('the-minutes', 'sign') }),
    );
    expect(filed.querySelector('.observation__go')).toBeNull();
    expect(filed.querySelector('.observation__where')).toBeNull();
    // The diary's own lines about the same incidents are not told again.
    expect(host.querySelectorAll('.observation__row[data-kind="decision"]')).toHaveLength(3);
  });

  it('never names what passed unseen, in either language', async () => {
    const state = busyOffice();
    render(state);
    const check = (copy: typeof en) => {
      const [passed] = rows('passed');
      expect(passed.textContent).toContain(copy.observation.passed);
      expect(passed.querySelector('.observation__redacted')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
      expect(passed.querySelector('.sr-only')?.textContent).toBe(copy.observation.unnamed);
      expect(passed.querySelector('.observation__mark')?.textContent).toBe(
        copy.observation.stampPassed,
      );
      expect(host.textContent).not.toContain(title('night-shift-report'));
    };
    check(en);
    await act(() => i18n.changeLanguage('pt-BR'));
    render(state);
    check(pt as typeof en);
  });

  it('puts what is waiting first, and its way there lands on the incident', () => {
    const onGo = render(busyOffice());
    const days = [...host.querySelectorAll<HTMLElement>('.observation__day')];
    expect(days.map((day) => day.querySelector('h4')?.textContent)).toEqual([
      en.observation.now,
      en.observation.today,
      en.observation.yesterday,
    ]);
    const [waiting] = rows('waiting');
    expect(days[0].contains(waiting)).toBe(true);
    expect(waiting.textContent).toContain(title('the-rebrand'));
    expect(waiting.textContent).toContain(
      t('observation.waitingWith', { name: t(EMPLOYEES_BY_ID.corvus.nameKey) }),
    );
    act(() => waiting.querySelector<HTMLButtonElement>('.observation__go')!.click());
    expect(onGo).toHaveBeenCalledWith('marketing', true);
    // Newest first within the day.
    expect(
      [...days[1].querySelectorAll('.observation__row')].map((row) =>
        row.getAttribute('data-stamp'),
      ),
    ).toEqual(['player', 'team', 'passed', 'moment']);
  });

  it('tells a card with steps as one line: the first decision, then each step', () => {
    const state = office();
    state.eventHistory = [
      {
        eventId: 'night-shift-report',
        choiceId: 'ask',
        at: local(21, 9),
        by: 'player',
        roomId: 'research',
      },
      {
        eventId: 'night-shift-report',
        choiceId: 'leave',
        at: local(21, 9) + 60_000,
        by: 'player',
        roomId: 'research',
      },
    ];
    render(state);
    const [row] = rows('player');
    expect(host.querySelectorAll('.observation__row')).toHaveLength(1);
    expect(row.querySelector('.observation__text')?.textContent).toBe(
      t('observation.decision.player', { choice: choice('night-shift-report', 'ask') }) +
        t('observation.then', { choice: choice('night-shift-report', 'leave') }),
    );
    expect(row.querySelectorAll('.observation__then')).toHaveLength(1);
  });

  it('reads a small moment in the team’s own words', () => {
    const state = busyOffice();
    state.employees.nino.nickname = 'Nininho';
    render(state);
    const [moment] = rows('moment');
    expect(moment.textContent).toContain(t('scene.nap-on-the-agenda.title'));
    expect(moment.querySelector('.observation__line')?.textContent).toBe(
      t('observation.momentLine', {
        name: 'Nininho',
        line: t('scene.nap-on-the-agenda.line1'),
      }),
    );
  });

  it('speaks Brazilian Portuguese', async () => {
    await act(() => i18n.changeLanguage('pt-BR'));
    render(busyOffice());
    const text = host.textContent ?? '';
    expect(host.querySelector('#obs')?.textContent).toBe('Relatório de observação');
    for (const phrase of [
      'Acontecendo agora',
      'Hoje',
      'Ontem',
      'A equipe decidiu sem você: ',
      'Você decidiu: ',
      'Decisão arquivada: ',
      'Ir até lá',
    ]) {
      expect(text, phrase).toContain(phrase);
    }
    expect(rows('team')[0].querySelector('.observation__go')?.getAttribute('aria-label')).toBe(
      `Ir até: ${room('meeting')}`,
    );
  });
});
