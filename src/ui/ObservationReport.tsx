import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { PopupShell, usePopupExit } from './modals/PopupShell';
import { Icon } from '../art/UiIcon';
import { useFmt } from './useFmt';
import { focusFloor } from './officeEvents';
import { GAME_EVENTS_BY_ID } from '../content/events';
import { WORLD_MOMENTS_BY_ID } from '../content/happenings';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { ROOMS_BY_ID } from '../content/rooms';
import { historyLabelKeys } from '../content/historyLabels';
import {
  groupByDay,
  observationReport,
  type ObservationDay,
  type ObservationRow,
  type WaitingRow,
} from '../sim/observation';
import type { GameState } from '../sim/types';

// The observation report: Nutshell's researchers' field notes on the office, read
// from what the game records (sim/observation.ts). What the team decided on its
// own, and what the player decided; a rare thing that passed with nobody looking
// (never named: its name is a black bar); the team's small moments, in their own
// words; and what is waiting in a room right now. Each row can go to its room.

type Stamp = 'team' | 'player' | 'unknown' | 'passed' | 'moment' | 'waiting';

function stampOf(row: ObservationRow | WaitingRow): Stamp {
  if (row.kind === 'decision') return row.by ?? 'unknown';
  return row.kind;
}

/** The report's pages: what is waiting now, then each day, the newest first. */
export function ObservationReportBody({
  state,
  now,
  titleId,
  onGo,
}: {
  state: GameState;
  now: number;
  titleId: string;
  /** Go to a room (`incident`: something is waiting there to be looked into). */
  onGo: (roomId: string, incident: boolean) => void;
}) {
  const { t } = useTranslation();
  const fmt = useFmt();
  const report = observationReport(state);
  const days = groupByDay(report.rows, now);
  const nameOf = (id: string) =>
    state.employees[id]?.nickname ?? t(EMPLOYEES_BY_ID[id]?.nameKey ?? id);
  const roomName = (id: string) => t(ROOMS_BY_ID[id]?.nameKey ?? id);
  const stampText: Record<Stamp, string> = {
    team: t('observation.by.team'),
    player: t('observation.by.player'),
    unknown: t('observation.by.unknown'),
    passed: t('observation.stampPassed'),
    moment: t('observation.stampMoment'),
    waiting: t('observation.stampWaiting'),
  };
  const dayTitle = (day: ObservationDay) =>
    day.when === 'today'
      ? t('observation.today')
      : day.when === 'yesterday'
        ? t('observation.yesterday')
        : fmt.date(day.at);

  // A render function, not a component: the game re-renders ten times a second,
  // and a component declared here would be a new type each time (its rows rebuilt,
  // the keyboard's place lost).
  function renderRow(row: ObservationRow | WaitingRow) {
    const stamp = stampOf(row);
    let title: ReactNode;
    let text: ReactNode = null;
    if (row.kind === 'decision') {
      // A card with steps: what was decided first, then each step on a line of its own.
      const [first, ...then] = row.choiceIds.map((id) =>
        t(historyLabelKeys(row.eventId, id).choiceKey),
      );
      title = t(GAME_EVENTS_BY_ID[row.eventId]?.titleKey ?? 'moment.unknownTitle');
      text = (
        <>
          <span>{t(`observation.decision.${row.by ?? 'unknown'}`, { choice: first })}</span>
          {then.map((label, index) => (
            <span key={index} className="observation__then">
              {t('observation.then', { choice: label })}
            </span>
          ))}
        </>
      );
    } else if (row.kind === 'passed') {
      // The name is the secret: a redaction bar, and words for a screen reader.
      title = (
        <>
          <span className="observation__redacted" aria-hidden />
          <span className="sr-only">{t('observation.unnamed')}</span>
        </>
      );
      text = t('observation.passed');
    } else if (row.kind === 'moment') {
      const def = WORLD_MOMENTS_BY_ID[row.momentId];
      title = t(`scene.${row.momentId}.title`);
      text = def
        ? Array.from({ length: def.lines }, (_, index) => (
            <span key={index} className="observation__line">
              {t('observation.momentLine', {
                name: nameOf(def.cast[index % def.cast.length]),
                line: t(`scene.${row.momentId}.line${index + 1}`),
              })}
            </span>
          ))
        : null;
    } else {
      title = t(GAME_EVENTS_BY_ID[row.eventId]?.titleKey ?? 'moment.unknownTitle');
      text = row.employeeId
        ? t('observation.waitingWith', { name: nameOf(row.employeeId) })
        : t('observation.waitingAnon');
    }
    return (
      <li key={row.key} className="observation__row" data-kind={row.kind} data-stamp={stamp}>
        <span className="observation__meta">
          <span className="observation__mark" data-stamp={stamp}>
            {stampText[stamp]}
          </span>
          <time className="observation__time" dateTime={new Date(row.at).toISOString()}>
            {fmt.time(row.at)}
          </time>
        </span>
        <span className="observation__body">
          <strong className="observation__what">{title}</strong>
          {text ? <span className="observation__text">{text}</span> : null}
          {row.roomId ? (
            <span className="observation__where">
              <Icon name="rooms" size={11} />
              {roomName(row.roomId)}
            </span>
          ) : null}
        </span>
        {row.target ? (
          <button
            type="button"
            className="observation__go"
            aria-label={t('observation.goLabel', { room: roomName(row.target) })}
            onClick={() => onGo(row.target as string, row.kind === 'waiting')}
          >
            <span>{t('observation.go')}</span>
            <span className="observation__go-arrow" aria-hidden>
              <Icon name="back" size={11} />
            </span>
          </button>
        ) : null}
      </li>
    );
  }

  const empty = report.waiting.length === 0 && days.length === 0;
  return (
    <article className="observation" aria-labelledby={titleId}>
      <header className="observation__head">
        <span className="observation__kind">{t('observation.kind')}</span>
        <span className="observation__stamp">{t('observation.stamp')}</span>
        <h3 id={titleId} className="popup__title observation__title">
          {t('observation.title')}
        </h3>
        <p className="observation__company">
          {state.company.name} · {t('header.departmentFull')}
        </p>
        <p className="observation__lede">{t('observation.lede')}</p>
      </header>

      {report.waiting.length ? (
        <section className="observation__day" data-day="now">
          <h4 className="observation__day-title">{t('observation.now')}</h4>
          <ol className="observation__rows">{report.waiting.map(renderRow)}</ol>
        </section>
      ) : null}

      {days.map((day) => (
        <section key={day.key} className="observation__day" data-day={day.key}>
          <h4 className="observation__day-title">{dayTitle(day)}</h4>
          <ol className="observation__rows">{day.rows.map(renderRow)}</ol>
        </section>
      ))}

      {empty ? (
        <p className="empty-state observation__empty">
          <span className="empty-state__mark" aria-hidden>
            <Icon name="company" size={14} />
          </span>
          <strong className="empty-state__title">{t('observation.emptyTitle')}</strong>
          <span className="empty-state__hint">{t('observation.emptyHint')}</span>
        </p>
      ) : null}

      <p className="observation__foot">{t('observation.foot')}</p>
    </article>
  );
}

/** The report as a document over the game (opened by the store). */
export function ObservationReport() {
  const open = useStore((s) => s.observationOpen);
  return open ? <ObservationDialog /> : null;
}

function ObservationDialog() {
  const { t } = useTranslation();
  const { state, engine } = useGame();
  const close = useStore((s) => s.closeObservation);
  const setView = useStore((s) => s.setView);
  const dismissReturn = useStore((s) => s.dismissReturn);
  const { closing, exitThen } = usePopupExit();
  const titleId = useId();

  // Going to a room is the welcome back's way there: the report and the note are
  // put away, a sheet over the office closes, and the tower brings the floor up.
  function go(roomId: string, incident: boolean) {
    exitThen(() => {
      close();
      dismissReturn();
      if (useStore.getState().view !== 'office' || engine.activeTalk) {
        engine.closeTalk();
        setView('office');
      }
      focusFloor(roomId);
      // Something waiting there: the keyboard lands on its ticket, ready to open it.
      if (incident) {
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() =>
            document
              .querySelector<HTMLElement>(`.floor[data-room="${roomId}"] .office-incident`)
              ?.focus({ preventScroll: true }),
          ),
        );
      }
    });
  }

  return (
    <PopupShell
      className="observation-popup"
      titleId={titleId}
      closing={closing}
      onDismiss={() => exitThen(close)}
      closeOnBackdrop
      // A document: it opens at its letterhead, not scrolled to its first line's button.
      initialFocus="dialog"
      actions={
        <button type="button" className="ghost-btn" onClick={() => exitThen(close)}>
          {t('common.close')}
        </button>
      }
    >
      <ObservationReportBody state={state} now={Date.now()} titleId={titleId} onGo={go} />
    </PopupShell>
  );
}
