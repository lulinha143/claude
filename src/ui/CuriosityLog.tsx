import { useTranslation } from 'react-i18next';
import type { GameState } from '../sim/types';
import { ROOMS } from '../content/rooms';
import { NUTS_BY_ID } from '../content/nuts';
import { odditiesInRoom } from '../content/roomPlay';
import { curiosityProgress, curiosityTotals, oddityNoticed } from '../sim/roomPlay';
import { isRoomIdUnlocked } from '../sim/rooms';
import { Glyph } from '../art/Glyph';

// The office's curiosities, room by room: what the player has noticed, in the
// words it was found in, and how many are still out there. Nothing unnoticed is
// spelled out, so the list is a reason to keep looking rather than a checklist.
export function CuriosityLog({ state }: { state: GameState }) {
  const { t } = useTranslation();
  const totals = curiosityTotals(state);
  const rooms = ROOMS.filter(
    (room) => isRoomIdUnlocked(state, room.id) && odditiesInRoom(room.id).length > 0,
  );
  return (
    <section className="curiosity-log" aria-labelledby="curiosity-log-title">
      <header className="curiosity-log__head">
        <h3 id="curiosity-log-title">{t('collections.curiosities')}</h3>
        <span className="curiosity-log__count">
          {t('collections.curiositiesCount', { count: totals.noticed, total: totals.total })}
        </span>
      </header>
      <p className="curiosity-log__intro">{t('collections.curiositiesIntro')}</p>
      <ul className="curiosity-log__rooms">
        {rooms.map((room) => {
          const progress = curiosityProgress(state, room.id);
          const complete = progress.noticed === progress.total;
          return (
            <li
              key={room.id}
              className={`curiosity-room ${complete ? 'is-complete' : ''}`}
              data-room={room.id}
            >
              <div className="curiosity-room__head">
                <strong>{t(room.nameKey)}</strong>
                <span>
                  {progress.noticed}/{progress.total}
                </span>
                {complete ? <em>{t('collections.roomFile')}</em> : null}
              </div>
              <ul className="curiosity-room__items">
                {odditiesInRoom(room.id).map((def) => {
                  if (!oddityNoticed(state, def.id)) {
                    return (
                      <li
                        key={def.id}
                        className="curiosity is-locked"
                        aria-label={t('collections.curiosityLocked')}
                      >
                        <Glyph name="question" size={11} />
                      </li>
                    );
                  }
                  const nut = def.nutId ? NUTS_BY_ID[def.nutId] : undefined;
                  return (
                    <li
                      key={def.id}
                      className={`curiosity curiosity--${def.kind}`}
                      data-oddity={def.id}
                    >
                      <span className="curiosity__title">
                        {nut ? t(nut.nameKey) : t(`oddity.${def.id}.title`)}
                      </span>
                      <span className="curiosity__found">{t(`oddity.${def.id}.found`)}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
