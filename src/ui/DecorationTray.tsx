import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '../sim/types';
import { DECORATIONS } from '../content/decorations';
import {
  decorationRoom,
  isDecorationOwned,
  isDecorationPlaced,
  placedDecorationsInRoom,
} from '../sim/decorations';
import { ROOMS_BY_ID } from '../content/rooms';
import { unlockedRooms } from '../sim/rooms';
import { DecorationProp } from '../art/DecorationProp';
import { Icon } from '../art/UiIcon';

// The professional bottom arrangement panel spans the office without covering
// the scene. It lists every owned decoration—placed and stored—so even a piece
// hidden beneath a dense stack remains directly selectable and draggable.
export function DecorationTray({
  state,
  reducedMotion,
  selected,
  onSelect,
  onBeginDrag,
  onRequestMove,
  dragging,
  dropToStow,
  dropOver = false,
  hint = null,
}: {
  state: GameState;
  reducedMotion: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  onBeginDrag: (e: ReactPointerEvent, id: string) => void;
  onRequestMove: (id: string) => void;
  /** true while a drag is in progress, so the tray can shrink out of the way */
  dragging: boolean;
  /**
   * While a piece is in the paw, what letting it go over the strip does: put a
   * placed piece away, or (for one taken from storage) keep it there.
   */
  dropToStow?: 'stow' | 'cancel';
  /** the piece in the paw is over the strip right now. */
  dropOver?: boolean;
  /** What to do next, said where the player is looking while arranging. */
  hint?: string | null;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  // Owned decorations, split into placed (count) vs available-to-place. Worked
  // out on every render: the engine changes its state in place, so a memo keyed
  // on it would keep counting what was there when the strip opened.
  const owned = DECORATIONS.filter((decoration) => isDecorationOwned(state, decoration.id));
  const placedCount = unlockedRooms(state).reduce(
    (n, r) => n + placedDecorationsInRoom(state, r.id).length,
    0,
  );
  // A name finds a piece; the catalogue has the fuller filters. (The row of kind
  // chips that used to sit here took the height the cards' names needed.)
  const q = query.trim().toLowerCase();
  const shown = owned.filter((d) => !q || t(`deco.${d.id}.name`).toLowerCase().includes(q));

  return (
    <div
      className={`deco-tray ${dragging ? 'is-dragging' : ''} ${dropOver ? 'is-drop-over' : ''}`}
      role="region"
      aria-label={t('decorate.inventory')}
    >
      {/* While a piece is in the paw the strip says, once and in place, what
          letting go over it does. The cards stay under it (the drag may have
          started on one of them). */}
      {dragging && dropToStow ? (
        <div className="deco-tray__drop" data-drop={dropToStow} aria-hidden>
          <Icon name={dropToStow === 'stow' ? 'hidden' : 'close'} size={14} />
          <span>{t(dropToStow === 'stow' ? 'decorate.dropToStow' : 'decorate.dropToKeep')}</span>
        </div>
      ) : null}
      <div className="deco-tray__head">
        <span className="deco-tray__title">
          <Icon name="decorate" size={13} /> {t('decorate.inventory')}
        </span>
        <span className="deco-tray__summary">
          {t('decorate.ownedCount', { count: owned.length })} ·{' '}
          {t('decorate.placedCount', { count: placedCount })}
        </span>
        {hint ? <span className="deco-tray__hint">{hint}</span> : null}
        {selected ? (
          <button
            className="mini-btn mini-btn--primary deco-tray__move"
            onClick={() => onRequestMove(selected)}
          >
            <Icon name="rooms" size={12} /> {t('decorate.moveTo')}
          </button>
        ) : null}
        <label className="deco-tray__search">
          <Icon name="shop" size={13} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('decorate.searchPlaceholder')}
            aria-label={t('decorate.searchPlaceholder')}
          />
        </label>
      </div>

      <div className="deco-tray__items">
        {shown.length === 0 ? (
          <span className="deco-tray__empty">
            {owned.length === 0 ? t('decorate.inventoryEmpty') : t('decorate.noResults')}
          </span>
        ) : (
          shown.map((d) => {
            const placed = isDecorationPlaced(state, d.id);
            const roomId = decorationRoom(state, d.id);
            const roomNameKey = roomId ? ROOMS_BY_ID[roomId]?.nameKey : undefined;
            return (
              <div
                key={d.id}
                className={`deco-tray__card ${placed ? 'is-placed' : 'is-stored'} ${
                  selected === d.id ? 'is-selected' : ''
                }`}
                data-decoration={d.id}
                data-placement={placed ? 'placed' : 'stored'}
                onPointerDown={(e) => onBeginDrag(e, d.id)}
                onClick={() => onSelect(d.id)}
              >
                <DecorationProp
                  id={d.id}
                  reducedMotion={reducedMotion}
                  mode="toggle"
                  selected={selected === d.id}
                  title={t(`deco.${d.id}.name`)}
                />
                <span className="deco-tray__card-name">{t(`deco.${d.id}.name`)}</span>
                <span className="deco-tray__card-room">
                  {roomNameKey ? t(roomNameKey) : t('decorate.inventory')}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
