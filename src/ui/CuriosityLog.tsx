import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '../sim/types';
import { ROOMS_BY_ID } from '../content/rooms';
import { NUTS_BY_ID } from '../content/nuts';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { DECORATIONS_BY_ID } from '../content/decorations';
import { ANOMALY_THREAD_FLAG } from '../content/happenings';
import { ODDITIES_BY_ID, odditiesInRoom, oddityFlag, type OddityDef } from '../content/roomPlay';
import {
  curiositiesBehindDoors,
  curiosityBoardRooms,
  curiosityProgress,
  oddityNoticed,
} from '../sim/roomPlay';
import {
  curiosityLeads,
  curiosityOrigins,
  openLeads,
  pointedAt,
  type CuriosityLead,
  type CuriosityOrigin,
} from '../sim/happenings';
import { Glyph, type GlyphName } from '../art/Glyph';
import { Icon } from '../art/UiIcon';
import { useFmt } from './useFmt';

// The office's curiosities, room by room: an investigation board, not a
// checklist. What the player has noticed is a card they can pick up and read:
// the thing itself in the words it was found in, where and when it turned up,
// what made it possible (another find, a decision, a story, something placed in
// the room) and where it led (the next find, an incident, a decision taken).
// Open leads head the board, so a clue is something to follow.
//
// Nothing unnoticed is spelled out: a blank stays blank (a lead only says that
// it points there), and the aftermath of a choice does not exist until it has
// turned up. All of it is read from the save (sim/happenings.ts); nothing new is
// stored.

/** The id of a curiosity's file on the board (what its card and its lead control). */
const curiosityFileId = (id: string) => `curiosity-file-${id}`;

const KIND_GLYPH: Record<OddityDef['kind'], GlyphName> = {
  note: 'note',
  glimpse: 'eye',
  object: 'sparkle',
  nut: 'star',
};

function useNames(state: GameState) {
  const { t } = useTranslation();
  const room = (roomId: string) => t(ROOMS_BY_ID[roomId]?.nameKey ?? roomId);
  const person = (id: string) =>
    state.employees[id]?.nickname ?? t(EMPLOYEES_BY_ID[id]?.nameKey ?? id);
  const title = (def: OddityDef) => {
    const nut = def.nutId ? NUTS_BY_ID[def.nutId] : undefined;
    return nut ? t(nut.nameKey) : t(`oddity.${def.id}.title`);
  };
  return { room, person, title };
}

/** A curiosity picked up from the board: the thing, its place, and its threads. */
function CuriosityFile({
  def,
  state,
  onClose,
  id,
}: {
  def: OddityDef;
  state: GameState;
  onClose: () => void;
  id: string;
}) {
  const { t, i18n } = useTranslation();
  const fmt = useFmt();
  const names = useNames(state);
  const at = state.flags[oddityFlag(def.id)];
  const hint = i18n.exists(`oddity.${def.id}.hint`) ? t(`oddity.${def.id}.hint`) : null;
  const where = def.anchor
    ? t(`collections.file.spot.${def.anchor}`)
    : t('collections.file.fromRoutine', { routine: t(`play.${def.roomId}.name`) });

  const origin = (item: CuriosityOrigin): string => {
    switch (item.kind) {
      case 'oddity':
        return t('collections.file.originOddity', {
          title: names.title(item.def),
          room: names.room(item.def.roomId),
        });
      case 'decision':
        return t('collections.file.originDecision', {
          event: t(item.event.titleKey),
          choice: t(item.choice.labelKey),
        });
      case 'story':
        return t('collections.file.originStory', { name: names.person(item.employeeId) });
      case 'decoration':
        return t('collections.file.originDecoration', {
          decoration: t(DECORATIONS_BY_ID[item.decorationId]?.nameKey ?? item.decorationId),
        });
      case 'hired':
        return t('collections.file.originHired', { name: names.person(item.employeeId) });
      case 'night':
        return t('collections.file.originNight');
    }
  };
  const lead = (item: CuriosityLead): string | null => {
    if (item.kind === 'oddity') {
      if (item.status === 'found') {
        return t('collections.file.leadFound', {
          title: names.title(item.def),
          room: names.room(item.def.roomId),
        });
      }
      if (item.status === 'waiting') {
        return t('collections.file.leadWaiting', { room: names.room(item.def.roomId) });
      }
      return null;
    }
    if (item.status === 'decided') {
      return item.choice
        ? t('collections.file.leadDecided', {
            event: t(item.def.titleKey),
            choice: t(item.choice.labelKey),
          })
        : t('collections.file.leadHappened', { event: t(item.def.titleKey) });
    }
    if (item.status === 'happening') {
      const waiting = state.happenings?.incidents.find((entry) => entry.eventId === item.def.id);
      return t('collections.file.leadHappening', {
        event: t(item.def.titleKey),
        room: names.room(waiting?.roomId ?? item.def.room ?? def.roomId),
      });
    }
    return null;
  };

  const origins = curiosityOrigins(def).map(origin);
  const leads = curiosityLeads(state, def.id);
  const followed = leads.map(lead).filter((line): line is string => Boolean(line));
  // Still pointing somewhere nobody has been: the clue, in its own words.
  const stillOpen =
    def.lead && leads.some((item) => item.status === 'open' || item.status === 'waiting');

  return (
    <article className={`curiosity-file curiosity-file--${def.kind}`} id={id} data-oddity={def.id}>
      <header className="curiosity-file__head">
        <span className="curiosity-file__glyph" aria-hidden>
          <Glyph name={KIND_GLYPH[def.kind]} size={14} />
        </span>
        <h5>{names.title(def)}</h5>
        <button
          type="button"
          className="curiosity-file__close"
          onClick={onClose}
          aria-label={t('collections.closeFile')}
          title={t('collections.closeFile')}
        >
          <Icon name="close" size={13} />
        </button>
      </header>
      {hint ? <p className="curiosity-file__hint">{hint}</p> : null}
      <blockquote className="curiosity-file__found">{t(`oddity.${def.id}.found`)}</blockquote>
      <dl className="curiosity-file__facts">
        <div>
          <dt>{t('collections.file.where')}</dt>
          <dd>
            {names.room(def.roomId)} · {where}
          </dd>
        </div>
        {at ? (
          <div>
            <dt>{t('collections.file.when')}</dt>
            <dd>{fmt.date(at)}</dd>
          </div>
        ) : null}
        {origins.length ? (
          <div>
            <dt>{t('collections.file.origin')}</dt>
            {origins.map((line) => (
              <dd key={line}>{line}</dd>
            ))}
          </div>
        ) : null}
        {followed.length || stillOpen ? (
          <div className="curiosity-file__leads">
            <dt>{t('collections.file.leads')}</dt>
            {followed.map((line) => (
              <dd key={line}>{line}</dd>
            ))}
            {stillOpen ? (
              <dd className="curiosity-file__open">
                <Glyph name="arrow" size={10} /> {t(`oddity.${def.id}.lead`)}
              </dd>
            ) : null}
          </div>
        ) : null}
      </dl>
      {def.extra ? <p className="curiosity-file__note">{t('play.oddity.bonus')}</p> : null}
      {def.nutId ? <p className="curiosity-file__note">{t('collections.file.nut')}</p> : null}
      {def.tone === 'paranormal' && ANOMALY_THREAD_FLAG in state.flags ? (
        <p className="curiosity-file__note curiosity-file__note--thread">
          {t('play.oddity.thread')}
        </p>
      ) : null}
    </article>
  );
}

export function CuriosityLog({ state }: { state: GameState }) {
  const { t } = useTranslation();
  const names = useNames(state);
  const [open, setOpen] = useState<string | null>(null);
  // The rooms open now and the ones where something was noticed: a room a
  // restructure closed keeps its curiosities here (and their files and leads).
  const board = curiosityBoardRooms(state);
  // The count is the board's, as the Collections cabinet's is.
  const totals = board.reduce(
    (sum, { room }) => {
      const progress = curiosityProgress(state, room.id);
      return { noticed: sum.noticed + progress.noticed, total: sum.total + progress.total };
    },
    { noticed: 0, total: 0 },
  );
  const moreBehindDoors = curiositiesBehindDoors(state);
  const leads = openLeads(state);
  const pointed = pointedAt(state);
  const inspected = open && oddityNoticed(state, open) ? ODDITIES_BY_ID[open] : undefined;
  const fileId = curiosityFileId;
  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));

  // A file opened from a lead at the head of the board sits in its room, often far
  // below: in a corner window the press seemed to do nothing. Bring it into view,
  // moving only the sheet's own scroller (never the stage behind it).
  useEffect(() => {
    if (!open) return;
    const file = document.getElementById(curiosityFileId(open));
    const scroller = file?.closest<HTMLElement>('.sheet__body');
    if (!file || !scroller) return;
    const box = file.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    const gap = 8;
    if (box.bottom > view.bottom - gap) {
      scroller.scrollTop += Math.min(box.bottom - view.bottom + gap, box.top - view.top - gap);
    } else if (box.top < view.top + gap) {
      scroller.scrollTop += box.top - view.top - gap;
    }
  }, [open]);

  return (
    <section className="curiosity-log" aria-labelledby="curiosity-log-title">
      <header className="curiosity-log__head">
        <h3 id="curiosity-log-title">{t('collections.curiosities')}</h3>
        <span className="curiosity-log__count">
          {t('collections.curiositiesCount', { count: totals.noticed, total: totals.total })}
        </span>
      </header>
      <p className="curiosity-log__intro">
        {t('collections.curiositiesIntro')}
        {moreBehindDoors ? ` ${t('collections.curiositiesMore')}` : ''}
      </p>

      {/* The clues the player is holding, where they were found. */}
      {leads.length > 0 ? (
        <section className="curiosity-leads" aria-labelledby="curiosity-leads-title">
          <h4 id="curiosity-leads-title">{t('collections.leads')}</h4>
          <ul>
            {leads.map((def) => (
              <li key={def.id}>
                <button
                  type="button"
                  className="curiosity-lead"
                  data-oddity={def.id}
                  aria-expanded={inspected?.id === def.id}
                  aria-controls={fileId(def.id)}
                  onClick={() => toggle(def.id)}
                >
                  <Glyph name="arrow" size={11} />
                  <span className="curiosity-lead__text">{t(`oddity.${def.id}.lead`)}</span>
                  <span className="curiosity-lead__from">
                    {names.title(def)} · {names.room(def.roomId)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="curiosity-log__rooms">
        {board.map(({ room, open: roomOpen }) => {
          const progress = curiosityProgress(state, room.id);
          const complete = progress.noticed === progress.total;
          return (
            <li
              key={room.id}
              className={`curiosity-room ${complete ? 'is-complete' : ''} ${roomOpen ? '' : 'is-closed'}`}
              data-room={room.id}
              data-closed={roomOpen ? undefined : 'true'}
            >
              <div className="curiosity-room__head">
                <strong>{t(room.nameKey)}</strong>
                <span>
                  {progress.noticed}/{progress.total}
                </span>
                {roomOpen ? null : (
                  <span className="curiosity-room__closed">
                    <Icon name="lock" size={11} />
                    {t('collections.curiosityRoomClosed')}
                  </span>
                )}
                {complete ? <em>{t('collections.roomFile')}</em> : null}
              </div>
              <ul className="curiosity-room__items">
                {odditiesInRoom(room.id).map((def) => {
                  const noticed = oddityNoticed(state, def.id);
                  // The aftermath of a choice is not part of the room's file: it
                  // only exists once it has turned up, and then as a bonus.
                  if (def.extra && !noticed) return null;
                  if (!noticed) {
                    const lead = pointed.has(def.id);
                    return (
                      <li
                        key={def.id}
                        className={`curiosity is-locked ${lead ? 'is-pointed' : ''}`}
                        data-pointed={lead ? 'true' : undefined}
                        aria-label={t(
                          lead ? 'collections.curiosityPointed' : 'collections.curiosityLocked',
                        )}
                        title={t(
                          lead ? 'collections.curiosityPointed' : 'collections.curiosityLocked',
                        )}
                      >
                        <Glyph name={lead ? 'lens' : 'question'} size={11} />
                      </li>
                    );
                  }
                  const holdsLead = leads.some((item) => item.id === def.id);
                  return (
                    <li
                      key={def.id}
                      className={`curiosity curiosity--${def.kind} ${def.extra ? 'is-bonus' : ''}`}
                      data-oddity={def.id}
                    >
                      <button
                        type="button"
                        className="curiosity__card"
                        aria-expanded={inspected?.id === def.id}
                        aria-controls={fileId(def.id)}
                        onClick={() => toggle(def.id)}
                      >
                        <span className="curiosity__glyph" aria-hidden>
                          <Glyph name={KIND_GLYPH[def.kind]} size={12} />
                        </span>
                        <span className="curiosity__title">{names.title(def)}</span>
                        {def.extra ? (
                          <em className="curiosity__bonus">{t('collections.curiosityBonus')}</em>
                        ) : null}
                        {holdsLead ? (
                          <span className="curiosity__lead-mark" title={t('collections.leads')}>
                            <Glyph name="arrow" size={10} />
                            <span className="sr-only">{t('collections.leads')}</span>
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {inspected && inspected.roomId === room.id ? (
                <CuriosityFile
                  def={inspected}
                  state={state}
                  id={fileId(inspected.id)}
                  onClose={() => setOpen(null)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
