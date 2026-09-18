import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnsembleNotes } from '../EnsembleNotes';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { DECORATION_ENSEMBLES } from '../../content/decorationEnsembles';
import { DECORATIONS } from '../../content/decorations';
import { ROOMS_BY_ID } from '../../content/rooms';
import { unlockedRooms } from '../../sim/rooms';
import {
  isDecorationOwned,
  isDecorationPlaced,
  decorationRoom,
  roomComfort,
  ownedDecorationsInRoom,
  placedDecorationsInRoom,
} from '../../sim/decorations';
import { decorKind, DecorationProp, type DecorKind } from '../../art/DecorationProp';
import { Icon } from '../../art/UiIcon';
import { Acorn, GoldenNut } from '../../art/Icons';
import { sparkleAt } from '../sparkle';
import { notify } from '../notificationsStore';
import { MoveDecorationModal } from '../modals/MoveDecorationModal';
import { decorationSurface } from '../../sim/surfaces';
import { Tip, TipContent } from '../Tooltip';

const ROOM_ACCENT: Record<string, string> = {
  'founder-desk': 'var(--dept-founder)',
  sorting: 'var(--dept-sorting)',
  morale: 'var(--dept-morale)',
  procurement: 'var(--dept-procurement)',
  construction: 'var(--dept-construction)',
  lab: 'var(--dept-lab)',
  marketing: 'var(--dept-marketing)',
  vault: 'var(--dept-vault)',
  research: 'var(--dept-research)',
  meeting: 'var(--dept-meeting)',
  nap: 'var(--dept-nap)',
  basement: 'var(--dept-basement)',
  rooftop: 'var(--dept-rooftop)',
};

type RoomFilter = 'all' | string;
type TypeFilter = 'all' | DecorKind;
type ResourceFilter = 'all' | 'nuts' | 'goldenNuts';

export function DecorateView() {
  const { t } = useTranslation();
  const { state, engine } = useGame();
  const fmt = useFmt();
  const buy = useStore((s) => s.buyDecoration);
  const audio = useStore((s) => s.audio);

  const [room, setRoom] = useState<RoomFilter>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [resource, setResource] = useState<ResourceFilter>('all');
  const [query, setQuery] = useState('');
  const [ensembleId, setEnsembleId] = useState<string | null>(null);
  const ensemble = DECORATION_ENSEMBLES.find((set) => set.id === ensembleId);
  const selectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ensembleId) selectionRef.current?.focus();
  }, [ensembleId]);
  const [movingId, setMovingId] = useState<string | null>(null);

  // Decoration rooms that are actually unlocked (so the selector only offers
  // places the player can decorate).
  const rooms = useMemo(
    () => unlockedRooms(state).filter((r) => DECORATIONS.some((d) => d.room === r.id)),
    [state],
  );
  const roomIds = useMemo(() => new Set(rooms.map((r) => r.id)), [rooms]);

  const available = useMemo(() => DECORATIONS.filter((d) => roomIds.has(d.room)), [roomIds]);

  // The decoration kinds present among available items (for the type filter).
  const kinds = useMemo(() => {
    const set = new Set<DecorKind>();
    available.forEach((d) => set.add(decorKind(d.id)));
    return [...set];
  }, [available]);

  const q = query.trim().toLowerCase();
  const filtered = available.filter((d) => {
    if (ensemble && !ensemble.items.includes(d.id)) return false;
    const owned = isDecorationOwned(state, d.id);
    const assignedRoom = owned ? decorationRoom(state, d.id) : null;
    if (room !== 'all' && (assignedRoom ?? d.room) !== room) return false;
    if (type !== 'all' && decorKind(d.id) !== type) return false;
    if (resource !== 'all' && d.cost.resource !== resource) return false;
    if (q && !t(`deco.${d.id}.name`).toLowerCase().includes(q)) return false;
    return true;
  });

  // Owned pieces in the selected room. `resetRoomDecorations` refuses when a room
  // has nothing of its own to arrange, so the button is disabled rather than
  // offered-and-then-rejected.
  const ownedHere = room === 'all' ? 0 : ownedDecorationsInRoom(state, room).length;

  // Scope summary (whole catalogue, or the selected room).
  const scopeRooms = room === 'all' ? rooms.map((r) => r.id) : [room];
  const ownedCount = scopeRooms.reduce((s, r) => s + ownedDecorationsInRoom(state, r).length, 0);
  const placedCount = scopeRooms.reduce((s, r) => s + placedDecorationsInRoom(state, r).length, 0);
  const comfort = scopeRooms.reduce((s, r) => s + roomComfort(state, r), 0);

  return (
    <section className="view view--decorate">
      <div className="decorate__head">
        <h2>{t('nav.decorate')}</h2>
        <p className="decorate__summary">
          {t('decorate.summary', { owned: ownedCount, placed: placedCount, comfort })}
        </p>
      </div>

      <EnsembleNotes
        onBrowse={(id) => {
          setRoom('all');
          setType('all');
          setResource('all');
          setQuery('');
          setEnsembleId(id);
          audio.play('paper');
        }}
      />
      {ensemble ? (
        <div className="ensemble-selection" ref={selectionRef} tabIndex={-1}>
          <div>
            <strong>{t(`ensemble.${ensemble.id}.name`)}</strong>
            <p>{t('ensemble.selection', { room: t(ROOMS_BY_ID[ensemble.roomId].nameKey) })}</p>
          </div>
          <button className="ghost-btn" onClick={() => setEnsembleId(null)}>
            {t('ensemble.allPieces')}
          </button>
        </div>
      ) : null}
      {/* room selector */}
      <div className="decorate__rooms" role="tablist" aria-label={t('decorate.allRooms')}>
        <button
          className={`chip-btn ${room === 'all' ? 'is-on' : ''}`}
          onClick={() => {
            setRoom('all');
            setEnsembleId(null);
          }}
          role="tab"
          aria-selected={room === 'all'}
        >
          {t('decorate.allRooms')}
        </button>
        {rooms.map((r) => (
          <button
            key={r.id}
            className={`chip-btn ${room === r.id ? 'is-on' : ''}`}
            onClick={() => {
              setRoom(r.id);
              setEnsembleId(null);
            }}
            role="tab"
            aria-selected={room === r.id}
          >
            {t(r.nameKey)}
          </button>
        ))}
      </div>

      {/* Room actions.
          "Tidy up" used to sit as the last chip INSIDE the filter toolbar, which
          made a mutating, room-wide action look like one more filter — and it was
          the only control there that changed the game rather than the view. Worse,
          it is fully undoable (engine.resetRoomDecorations pushes decoration
          history) but Undo lived only in the office toolbar, on a different screen,
          so from here the player could rearrange every piece in a room with no
          visible way back.

          Actions now have their own bar, scoped to the selected room, with the
          undo that belongs to them sitting right next to it. */}
      {room !== 'all' ? (
        <div className="decorate__roombar">
          <span className="decorate__roombar-room">
            <Icon name="rooms" size={13} />
            {t(ROOMS_BY_ID[room].nameKey)}
          </span>
          <div className="decorate__roombar-actions">
            <Tip
              content={
                <TipContent title={t('decorate.resetRoom')} lines={[t('decorate.resetRoomTip')]} />
              }
            >
              <button
                className="mini-btn mini-btn--primary"
                disabled={ownedHere === 0}
                onClick={() => {
                  if (engine.resetRoomDecorations(room)) {
                    audio.play('upgrade');
                    notify('rooms', t('decorate.resetDone'), 'positive');
                  } else {
                    notify('rooms', t('decorate.resetFull'), 'neutral');
                    audio.play('error');
                  }
                }}
              >
                <Icon name="refresh" size={13} /> {t('decorate.resetRoom')}
              </button>
            </Tip>
            <button
              className="mini-btn"
              disabled={!engine.canUndoDecoration()}
              onClick={() => {
                if (engine.undoDecoration()) audio.play('click');
              }}
            >
              <Icon name="undo" size={13} /> {t('decorate.undo')}
            </button>
          </div>
        </div>
      ) : null}

      {/* filters */}
      <div className="decorate__filters">
        <label className="decorate__search">
          <Icon name="shop" size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('decorate.searchPlaceholder')}
            aria-label={t('decorate.searchPlaceholder')}
          />
        </label>
        <div className="decorate__chiprow">
          <button
            className={`tag-btn ${type === 'all' ? 'is-on' : ''}`}
            onClick={() => setType('all')}
          >
            {t('decorate.allTypes')}
          </button>
          {kinds.map((k) => (
            <button
              key={k}
              className={`tag-btn ${type === k ? 'is-on' : ''}`}
              onClick={() => setType(k)}
            >
              {t(`decorate.type.${k}`)}
            </button>
          ))}
        </div>
        <div className="decorate__chiprow">
          <button
            className={`tag-btn ${resource === 'all' ? 'is-on' : ''}`}
            onClick={() => setResource('all')}
          >
            {t('decorate.anyResource')}
          </button>
          <button
            className={`tag-btn ${resource === 'nuts' ? 'is-on' : ''}`}
            onClick={() => setResource('nuts')}
          >
            <Acorn size={13} />
          </button>
          <button
            className={`tag-btn ${resource === 'goldenNuts' ? 'is-on' : ''}`}
            onClick={() => setResource('goldenNuts')}
          >
            <GoldenNut size={13} />
          </button>
        </div>
      </div>

      {/* grid */}
      {filtered.length === 0 ? (
        <p className="decorate__empty">{t('decorate.noResults')}</p>
      ) : (
        <ul className="decorate__grid">
          {filtered.map((d) => {
            const owned = isDecorationOwned(state, d.id);
            const placed = owned && isDecorationPlaced(state, d.id);
            const currentRoom = owned ? decorationRoom(state, d.id) : null;
            const afford = state.resources[d.cost.resource] >= d.cost.amount;
            const kind = decorKind(d.id);
            const surface = decorationSurface(d.id);
            return (
              <li
                key={d.id}
                className={`decocard ${owned ? 'is-owned' : ''} ${placed ? 'is-placed' : ''}`}
                data-kind={kind}
                data-decoration={d.id}
              >
                <div className={`decocard__preview decocard__preview--${surface}`}>
                  <DecorationProp
                    id={d.id}
                    accent={ROOM_ACCENT[d.room]}
                    mode="interact"
                    onInteract={() => audio.play('click')}
                    title={t(`deco.${d.id}.name`)}
                  />
                  <span className="decocard__surface" aria-hidden>
                    {t(`decorate.surface.${surface}`)}
                  </span>
                </div>
                <div className="decocard__body">
                  <div className="decocard__title">{t(`deco.${d.id}.name`)}</div>
                  <div className="decocard__meta">
                    <span className="pill">
                      {currentRoom
                        ? t(ROOMS_BY_ID[currentRoom].nameKey)
                        : owned
                          ? t('decorate.inStorage')
                          : t(ROOMS_BY_ID[d.room].nameKey)}
                    </span>
                    <span className="pill pill--soft">{t(`decorate.type.${kind}`)}</span>
                  </div>
                  <div className="decocard__comfort">
                    <Icon name="morale" size={12} /> +{d.moraleBonus}{' '}
                    {t('resource.morale').toLowerCase()}
                  </div>
                </div>
                <div className="decocard__actions">
                  {!owned ? (
                    <button
                      className="buy-btn"
                      disabled={!afford}
                      onClick={(e) => {
                        if (buy(d.id)) {
                          audio.play('upgrade');
                          sparkleAt(e);
                        }
                      }}
                    >
                      {d.cost.resource === 'goldenNuts' ? (
                        <GoldenNut size={15} />
                      ) : (
                        <Acorn size={15} />
                      )}
                      <span>{fmt.num(d.cost.amount)}</span>
                    </button>
                  ) : placed ? (
                    <>
                      <span className="decocard__badge">
                        <Icon name="success" size={12} /> {t('decorate.placed')}
                      </span>
                      <button
                        className="mini-btn mini-btn--primary"
                        onClick={() => setMovingId(d.id)}
                      >
                        <Icon name="rooms" size={12} /> {t('decorate.moveTo')}
                      </button>
                      <button
                        className="mini-btn"
                        onClick={() => {
                          if (engine.removeDecoration(d.id)) audio.play('click');
                        }}
                      >
                        {t('decorate.remove')}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="decocard__badge decocard__badge--muted">
                        <Icon name="hidden" size={12} /> {t('decorate.inStorage')}
                      </span>
                      <button
                        className="mini-btn mini-btn--primary"
                        title={t('decorate.moveTo')}
                        onClick={() => setMovingId(d.id)}
                      >
                        <Icon name="rooms" size={12} /> {t('decorate.moveTo')}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {movingId ? (
        <MoveDecorationModal
          state={state}
          decorationId={movingId}
          onMove={(roomId) => {
            const moved =
              roomId === null
                ? engine.removeDecoration(movingId)
                : engine.placeDecorationInRoom(movingId, roomId);
            if (moved) audio.play(roomId === null ? 'click' : 'place');
            return moved;
          }}
          onDismiss={() => setMovingId(null)}
        />
      ) : null}
    </section>
  );
}
