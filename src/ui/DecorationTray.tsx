import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '../sim/types';
import { DECORATIONS } from '../content/decorations';
import { ROOMS_BY_ID } from '../content/rooms';
import { isDecorationOwned, isDecorationPlaced, placedDecorationsInRoom } from '../sim/decorations';
import { unlockedRooms } from '../sim/rooms';
import { decorKind, DecorationProp, type DecorKind } from '../art/DecorationProp';
import { Icon } from '../art/UiIcon';

// The professional bottom inventory panel of Decoration Mode. It spans the
// bottom of the office (never covering the whole scene), lists every decoration
// the player owns but hasn't placed, and lets them drag a piece straight into a
// room. Placed pieces are dragged/rearranged directly in the scene, and a piece
// dragged back onto this tray is stowed. Category filter + search keep a large
// library manageable, and it collapses gracefully on small windows.
export function DecorationTray({
  state,
  reducedMotion,
  selected,
  onSelect,
  onBeginDrag,
  dragging,
}: {
  state: GameState;
  reducedMotion: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  onBeginDrag: (e: ReactPointerEvent, id: string) => void;
  /** true while a drag is in progress, so the tray can shrink out of the way */
  dragging: boolean;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'all' | DecorKind>('all');
  const [query, setQuery] = useState('');

  const roomIds = useMemo(() => new Set(unlockedRooms(state).map((r) => r.id)), [state]);

  // Owned decorations, split into placed (count) vs available-to-place.
  const owned = useMemo(
    () => DECORATIONS.filter((d) => roomIds.has(d.room) && isDecorationOwned(state, d.id)),
    [state, roomIds],
  );
  const placedCount = useMemo(
    () => unlockedRooms(state).reduce((n, r) => n + placedDecorationsInRoom(state, r.id).length, 0),
    [state],
  );
  const available = owned.filter((d) => !isDecorationPlaced(state, d.id));

  const kinds = useMemo(() => {
    const set = new Set<DecorKind>();
    available.forEach((d) => set.add(decorKind(d.id)));
    return [...set];
  }, [available]);

  const q = query.trim().toLowerCase();
  const shown = available.filter((d) => {
    if (kind !== 'all' && decorKind(d.id) !== kind) return false;
    if (q && !t(`deco.${d.id}.name`).toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className={`deco-tray ${dragging ? 'is-dragging' : ''}`} role="region" aria-label={t('decorate.inventory')}>
      <div className="deco-tray__head">
        <span className="deco-tray__title">
          <Icon name="decorate" size={13} /> {t('decorate.inventory')}
        </span>
        <span className="deco-tray__summary">
          {t('decorate.summary', { owned: owned.length, placed: placedCount, comfort: 0 }).split('·').slice(0, 2).join('·')}
        </span>
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
        <button className={`tag-btn ${kind === 'all' ? 'is-on' : ''}`} onClick={() => setKind('all')}>
          {t('decorate.allTypes')}
        </button>
        {kinds.map((k) => (
          <button key={k} className={`tag-btn ${kind === k ? 'is-on' : ''}`} onClick={() => setKind(k)}>
            {t(`decorate.type.${k}`)}
          </button>
        ))}
      </div>

      <div className="deco-tray__items">
        {shown.length === 0 ? (
          <span className="deco-tray__empty">
            {available.length === 0 ? t('decorate.inventoryEmpty') : t('decorate.noResults')}
          </span>
        ) : (
          shown.map((d) => (
            <div key={d.id} className={`deco-tray__card ${selected === d.id ? 'is-selected' : ''}`}>
              <DecorationProp
                id={d.id}
                reducedMotion={reducedMotion}
                mode="toggle"
                selected={selected === d.id}
                title={t(`deco.${d.id}.name`)}
                onToggle={() => onSelect(d.id)}
                onPointerDown={(e) => onBeginDrag(e, d.id)}
              />
              <span className="deco-tray__card-name">{t(`deco.${d.id}.name`)}</span>
              <span className="deco-tray__card-room">{t(ROOMS_BY_ID[d.room].nameKey)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
