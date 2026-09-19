import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
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
import { decorKind, DecorationProp, type DecorKind } from '../art/DecorationProp';
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
}: {
  state: GameState;
  reducedMotion: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  onBeginDrag: (e: ReactPointerEvent, id: string) => void;
  onRequestMove: (id: string) => void;
  /** true while a drag is in progress, so the tray can shrink out of the way */
  dragging: boolean;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'all' | DecorKind>('all');
  const [query, setQuery] = useState('');

  // Owned decorations, split into placed (count) vs available-to-place.
  const owned = useMemo(
    () => DECORATIONS.filter((decoration) => isDecorationOwned(state, decoration.id)),
    [state],
  );
  const placedCount = useMemo(
    () => unlockedRooms(state).reduce((n, r) => n + placedDecorationsInRoom(state, r.id).length, 0),
    [state],
  );
  const kinds = useMemo(() => {
    const set = new Set<DecorKind>();
    owned.forEach((d) => set.add(decorKind(d.id)));
    return [...set];
  }, [owned]);

  const q = query.trim().toLowerCase();
  const shown = owned.filter((d) => {
    if (kind !== 'all' && decorKind(d.id) !== kind) return false;
    if (q && !t(`deco.${d.id}.name`).toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div
      className={`deco-tray ${dragging ? 'is-dragging' : ''}`}
      role="region"
      aria-label={t('decorate.inventory')}
    >
      <div className="deco-tray__head">
        <span className="deco-tray__title">
          <Icon name="decorate" size={13} /> {t('decorate.inventory')}
        </span>
        <span className="deco-tray__summary">
          {t('decorate.summary', { owned: owned.length, placed: placedCount, comfort: 0 })
            .split('·')
            .slice(0, 2)
            .join('·')}
        </span>
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

      <div className="deco-tray__chips">
        <button
          className={`tag-btn ${kind === 'all' ? 'is-on' : ''}`}
          onClick={() => setKind('all')}
        >
          {t('decorate.allTypes')}
        </button>
        {kinds.map((k) => (
          <button
            key={k}
            className={`tag-btn ${kind === k ? 'is-on' : ''}`}
            onClick={() => setKind(k)}
          >
            {t(`decorate.type.${k}`)}
          </button>
        ))}
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
