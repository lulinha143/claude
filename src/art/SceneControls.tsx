// The office's own controls, floating beside the tree instead of scrolling away.
//
// The old toolbar ("Arrange", undo/redo, a hint) and the "Directory" dropdown sat
// at the TOP of a 3,000px scrolling trunk, so while you looked at the Founder's
// Desk the Arrange button was ~2,200px above you. These controls are pinned to the
// scene: an elevator (up, floor list, down) and the Arrange toggle, with undo/redo
// while arranging. On a companion-sized window they are a slim pill at the right
// edge of the trunk; on a big window they stand just outside the tree.

import { useTranslation } from 'react-i18next';
import type { RoomDef } from '../content/types';
import { Icon } from './UiIcon';
import { Tip, TipContent } from '../ui/Tooltip';

interface SceneControlsProps {
  rooms: readonly RoomDef[];
  currentFloor: string | null;
  floorsOpen: boolean;
  setFloorsOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  onGo: (roomId: string) => void;
  decorMode: boolean;
  onToggleDecor: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hint: string | null;
  occupancy: (roomId: string) => number;
  /** something waiting on that floor: a full crate, a teammate's find. */
  news?: (roomId: string) => 'crate' | 'find' | null;
}

export function SceneControls({
  rooms,
  currentFloor,
  floorsOpen,
  setFloorsOpen,
  onGo,
  decorMode,
  onToggleDecor,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hint,
  occupancy,
  news = () => null,
}: SceneControlsProps) {
  // Something is waiting on a floor that is not the one in view.
  const elsewhere = rooms.some((room) => room.id !== currentFloor && news(room.id) !== null);
  const { t } = useTranslation();
  // `rooms` is in display order: the top floor first, the ground floor last.
  const index = Math.max(
    0,
    rooms.findIndex((room) => room.id === currentFloor),
  );
  const current = rooms[index];
  const up = index > 0 ? rooms[index - 1] : null;
  const down = index < rooms.length - 1 ? rooms[index + 1] : null;

  return (
    <div className={`scene-controls ${decorMode ? 'is-arranging' : ''}`}>
      {rooms.length > 1 ? (
        <div className="elevator" role="group" aria-label={t('elevator.label')}>
          <Tip
            content={up ? <TipContent title={t('elevator.up')} lines={[t(up.nameKey)]} /> : null}
          >
            <button
              type="button"
              className="scene-btn"
              onClick={() => up && onGo(up.id)}
              disabled={!up}
              aria-label={t('elevator.up')}
            >
              <Icon name="up" size={16} />
            </button>
          </Tip>
          <Tip
            content={
              <TipContent
                title={t('elevator.floors')}
                lines={[current ? t('elevator.here', { room: t(current.nameKey) }) : null]}
              />
            }
          >
            <button
              type="button"
              className={`scene-btn elevator__list-btn ${floorsOpen ? 'is-on' : ''}`}
              data-news={elsewhere ? 'true' : undefined}
              onClick={() => setFloorsOpen((open) => !open)}
              aria-expanded={floorsOpen}
              aria-haspopup="listbox"
              aria-label={t('elevator.floors')}
            >
              <Icon name="rooms" size={16} />
            </button>
          </Tip>
          <Tip
            content={
              down ? <TipContent title={t('elevator.down')} lines={[t(down.nameKey)]} /> : null
            }
          >
            <button
              type="button"
              className="scene-btn"
              onClick={() => down && onGo(down.id)}
              disabled={!down}
              aria-label={t('elevator.down')}
            >
              <Icon name="down" size={16} />
            </button>
          </Tip>
          {floorsOpen ? (
            <ul className="elevator__floors" role="listbox" aria-label={t('elevator.floors')}>
              {rooms.map((room) => {
                const people = occupancy(room.id);
                return (
                  <li key={room.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={room.id === currentFloor}
                      className={room.id === currentFloor ? 'is-here' : ''}
                      onClick={() => {
                        setFloorsOpen(false);
                        onGo(room.id);
                      }}
                    >
                      <span className="elevator__floor-name">{t(room.nameKey)}</span>
                      {news(room.id) ? (
                        <span
                          className={`elevator__floor-news elevator__floor-news--${news(room.id)}`}
                          aria-label={news(room.id) === 'crate' ? t('crate.full') : t('find.take')}
                        >
                          <Icon name={news(room.id) === 'crate' ? 'nut' : 'moment'} size={11} />
                        </span>
                      ) : null}
                      {people > 0 ? (
                        <span
                          className="elevator__floor-people"
                          aria-label={t('elevator.people', { count: people })}
                        >
                          <Icon name="employees" size={11} />
                          {people}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="scene-controls__arrange" role="group" aria-label={t('office.decorate')}>
        <Tip content={<TipContent title={t('office.decorate')} lines={[t('office.arrangeTip')]} />}>
          <button
            type="button"
            className={`scene-btn scene-btn--arrange ${decorMode ? 'is-on' : ''}`}
            onClick={onToggleDecor}
            aria-pressed={decorMode}
            aria-label={t('office.decorate')}
          >
            <Icon name="decorate" size={16} />
            <span className="scene-btn__label">{t('office.decorate')}</span>
          </button>
        </Tip>
        {decorMode ? (
          <>
            <button
              type="button"
              className="scene-btn"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label={t('decorate.undo')}
              title={t('decorate.undo')}
            >
              <Icon name="undo" size={15} />
            </button>
            <button
              type="button"
              className="scene-btn"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label={t('decorate.redo')}
              title={t('decorate.redo')}
            >
              <Icon name="redo" size={15} />
            </button>
          </>
        ) : null}
      </div>
      {hint ? <p className="scene-note">{hint}</p> : null}
    </div>
  );
}
