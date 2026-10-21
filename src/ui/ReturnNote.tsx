import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { useFmt } from './useFmt';
import { Crate } from '../art/Icons';
import { Icon, type IconName } from '../art/UiIcon';
import { BALANCE } from '../sim/config';
import { offlineCapHours } from '../sim/economy';
import { waitingInOffice, type WaitingThing } from '../sim/waiting';
import { hasObservations } from '../sim/observation';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { ROOMS_BY_ID } from '../content/rooms';
import { focusFloor } from './officeEvents';

// The welcome back: a paper note dropped under the HUD when the player returns
// after the office was out of their sight (the game closed, the computer asleep,
// the window minimized). It says what that time brought — the vault, the crate —
// and by which rule, then points at what is waiting in its own room; each line
// goes there. Nothing dims or blocks the office behind it: tap the crate right
// away, or put the note away with its × (or Escape).

const HOME = 'founder-desk';

const ICON: Record<WaitingThing['kind'], IconName> = {
  incident: 'notification',
  story: 'employees',
  find: 'moment',
  discovery: 'encyclopedia',
  ready: 'success',
  parcel: 'notification',
  oddity: 'moment',
};

const BLOCKING = '.popup-backdrop, .modal-backdrop, .opening-seq, .photo-mode';

/** A short window shows the payoff and two lines; a taller one, three. */
function rowsFor(height: number): number {
  return height <= 480 ? 2 : 3;
}

function useRowLimit(): number {
  const [rows, setRows] = useState(() => rowsFor(window.innerHeight));
  useEffect(() => {
    const update = () => setRows(rowsFor(window.innerHeight));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return rows;
}

interface Row {
  key: string;
  kind: WaitingThing['kind'] | 'crate';
  icon: ReactNode;
  what: string;
  detail: string;
  roomId: string;
}

export function ReturnNote() {
  const { t } = useTranslation();
  const fmt = useFmt();
  const { state, engine } = useGame();
  const summary = useStore((s) => s.returnSummary);
  const dismiss = useStore((s) => s.dismissReturn);
  const setView = useStore((s) => s.setView);
  const openObservation = useStore((s) => s.openObservation);
  const maxRows = useRowLimit();

  // Escape puts the note away, unless something else is open to take it first.
  useEffect(() => {
    if (!summary) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector(BLOCKING)) return;
      if (useStore.getState().view !== 'office' || engine.activeTalk) return;
      event.preventDefault();
      dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [summary, dismiss, engine]);

  if (!summary) return null;

  const nameOf = (id?: string) =>
    id ? (state.employees[id]?.nickname ?? t(EMPLOYEES_BY_ID[id]?.nameKey ?? id)) : '';
  const roomName = (id: string) => t(ROOMS_BY_ID[id]?.nameKey ?? id);
  /** How long, said the way a person would: "4 min", "2h", "2h 30min", "3 dias". */
  const span = (seconds: number) => {
    if (seconds >= 2 * 86_400) {
      return t('returnNote.span.days', { count: Math.floor(seconds / 86_400) });
    }
    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) return t('returnNote.span.minutes', { m: minutes });
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? t('returnNote.span.hoursMinutes', { h, m }) : t('returnNote.span.hours', { h });
  };
  const pct = Math.round(BALANCE.offline.efficiency * 100);
  const hours = offlineCapHours(state);
  const rule = summary.capped
    ? t('returnNote.rule.capped', { away: span(summary.offlineSeconds), hours })
    : summary.mode === 'closed'
      ? t('returnNote.rule.closed', { pct, hours })
      : summary.mode === 'asleep'
        ? t('returnNote.rule.asleep', { slept: span(summary.offlineSeconds), pct })
        : t('returnNote.rule.open');

  function whatOf(thing: WaitingThing): string {
    switch (thing.kind) {
      case 'incident':
        return thing.employeeId
          ? t('returnNote.go.incident', { name: nameOf(thing.employeeId) })
          : t('returnNote.go.incidentAnon');
      case 'story':
        return t('returnNote.go.story', { name: nameOf(thing.employeeId) });
      case 'find':
        return t('returnNote.go.find', { count: thing.count ?? 1, name: nameOf(thing.employeeId) });
      case 'discovery':
        return t('returnNote.go.discovery');
      case 'ready':
        return t(`play.${thing.roomId}.ready`);
      case 'parcel':
        return t(`play.${thing.roomId}.order`, { defaultValue: t('play.news.play') });
      case 'oddity':
        return t('returnNote.go.oddity');
    }
  }

  // The payoff waiting in the world comes first: the crate the team packed.
  const rows: Row[] = [];
  const crateFull = engine.crateFill() >= 0.999;
  if (state.crate.nuts >= 1 && (crateFull || summary.packed >= 1)) {
    rows.push({
      key: 'crate',
      kind: 'crate',
      icon: <Crate size={18} />,
      what: crateFull ? t('returnNote.go.crateFull') : t('returnNote.go.crate'),
      detail: t('returnNote.go.crateDetail', { value: fmt.num(state.crate.nuts) }),
      roomId: HOME,
    });
  }
  for (const thing of waitingInOffice(state, Date.now())) {
    if (rows.length >= maxRows) break;
    const key = `${thing.kind}:${thing.roomId}:${thing.employeeId ?? ''}`;
    if (rows.some((row) => row.key === key)) continue;
    rows.push({
      key,
      kind: thing.kind,
      icon: <Icon name={ICON[thing.kind]} size={15} />,
      what: whatOf(thing),
      detail: roomName(thing.roomId),
      roomId: thing.roomId,
    });
  }

  function go(roomId: string) {
    dismiss();
    if (useStore.getState().view !== 'office' || engine.activeTalk) {
      engine.closeTalk();
      setView('office');
    }
    focusFloor(roomId);
  }

  return (
    <section
      key={summary.id}
      className={`return-note return-note--${summary.mode}`}
      data-mode={summary.mode}
      aria-label={t('returnNote.label')}
    >
      <div className="return-note__head">
        <span className="return-note__mark" aria-hidden>
          <Crate size={26} />
        </span>
        <p className="return-note__heading">
          <strong className="return-note__title">{t('returnNote.title')}</strong>
          <span className="return-note__away">
            {t('returnNote.away', { duration: span(summary.awaySeconds) })}
          </span>
        </p>
        <button
          type="button"
          className="return-note__close"
          aria-label={t('common.dismiss')}
          onClick={dismiss}
        >
          <Icon name="close" size={12} />
        </button>
      </div>
      <p className="return-note__payoff">
        {t('returnNote.banked', { value: fmt.num(summary.banked) })}
      </p>
      <p className="return-note__rule">{rule}</p>
      {rows.length ? (
        <ul className="return-note__waiting">
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                className="return-note__go"
                data-go={row.kind}
                aria-label={t('returnNote.goLabel', { what: row.what, room: roomName(row.roomId) })}
                onClick={() => go(row.roomId)}
              >
                <span className="return-note__go-icon" aria-hidden>
                  {row.icon}
                </span>
                <span className="return-note__go-what">{row.what}</span>
                <span className="return-note__go-where">{row.detail}</span>
                <span className="return-note__go-arrow" aria-hidden>
                  <Icon name="back" size={11} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {/* The whole record of the office, for whoever wants more than the waiting:
          what the team decided on its own, what passed unseen, its moments. */}
      {hasObservations(state) ? (
        <button type="button" className="return-note__report" onClick={openObservation}>
          <Icon name="company" size={13} />
          <span>{t('observation.fromReturn')}</span>
          <span className="return-note__go-arrow" aria-hidden>
            <Icon name="back" size={11} />
          </span>
        </button>
      ) : null}
    </section>
  );
}
