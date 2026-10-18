import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { EnsembleNotes } from '../EnsembleNotes';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { DECORATION_ENSEMBLES } from '../../content/decorationEnsembles';
import { DECORATIONS } from '../../content/decorations';
import type { DecorationDef } from '../../content/types';
import { ROOMS_BY_ID } from '../../content/rooms';
import { unlockedRooms } from '../../sim/rooms';
import {
  isDecorationOwned,
  isDecorationPlaced,
  decorationRoom,
  ownedDecorationsInRoom,
  placedDecorationsInRoom,
} from '../../sim/decorations';
import { decorKind, DecorationProp, type DecorKind } from '../../art/DecorationProp';
import { Icon, type IconName } from '../../art/UiIcon';
import { Acorn, GoldenNut } from '../../art/Icons';
import { sparkleAt } from '../sparkle';
import { notify } from '../notificationsStore';
import { MoveDecorationModal } from '../modals/MoveDecorationModal';
import { decorationSurface, isRug } from '../../sim/surfaces';
import { Tip, TipContent } from '../Tooltip';

// The decoration catalogue: the objects first. Each card says what the piece is,
// where it goes (its surface, and the room it belongs to or stands in now),
// whether it is yours, and what it costs or what is still missing — before
// anything is pressed. Buying is one step in the engine (checked, charged once,
// filed, saved); the card then says where the piece went. Arranging happens in
// the office itself ("Arrumar"), or room to room with "Mover…".

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

const SURFACE_ICON: Record<'floor' | 'rug' | 'wall' | 'ceiling', IconName> = {
  floor: 'rooms',
  rug: 'rooms',
  wall: 'photo',
  ceiling: 'up',
};

/** The set (room recipe) each piece belongs to, if any. */
const SET_OF: Record<string, string> = Object.fromEntries(
  DECORATION_ENSEMBLES.flatMap((set) => set.items.map((id) => [id, set.id])),
);

type Section = 'available' | 'owned' | 'locked';
type RoomFilter = 'all' | string;
type TypeFilter = 'all' | DecorKind;

interface CardNote {
  id: string;
  tone: 'ok' | 'short';
  text: string;
  key: number;
}

export function DecorateView() {
  const { t } = useTranslation();
  const { state, engine } = useGame();
  const fmt = useFmt();
  const buy = useStore((s) => s.buyDecoration);
  const audio = useStore((s) => s.audio);
  const arrangeDecoration = useStore((s) => s.arrangeDecoration);

  const [section, setSection] = useState<Section>('available');
  const [room, setRoom] = useState<RoomFilter>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');
  const [ensembleId, setEnsembleId] = useState<string | null>(null);
  const ensemble = DECORATION_ENSEMBLES.find((set) => set.id === ensembleId);
  const selectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ensembleId) selectionRef.current?.focus();
  }, [ensembleId]);
  const [movingId, setMovingId] = useState<string | null>(null);
  // What the last press on a card answered (a purchase, or what is missing).
  const [note, setNote] = useState<CardNote | null>(null);
  const noteKey = useRef(0);

  // Decoration rooms that are open (the room filter offers only places the
  // player can decorate). Worked out each render: the engine changes its state
  // in place, so a memo keyed on it would miss a room opening while this is open.
  const rooms = unlockedRooms(state).filter((r) => DECORATIONS.some((d) => d.room === r.id));
  const roomIds = new Set(rooms.map((r) => r.id));

  const inSection = (d: DecorationDef, which: Section) =>
    which === 'owned'
      ? isDecorationOwned(state, d.id)
      : which === 'locked'
        ? !roomIds.has(d.room) && !isDecorationOwned(state, d.id)
        : roomIds.has(d.room);
  const sections: readonly Section[] = ['available', 'owned', 'locked'];
  const counts = Object.fromEntries(
    sections.map((which) => [which, DECORATIONS.filter((d) => inSection(d, which)).length]),
  ) as Record<Section, number>;
  const listed = DECORATIONS.filter((d) => inSection(d, section));

  // The kinds present in this section (for the type filter).
  const kinds = [...new Set<DecorKind>(listed.map((d) => decorKind(d.id)))];

  const q = query.trim().toLowerCase();
  const filtered = listed.filter((d) => {
    if (ensemble && !ensemble.items.includes(d.id)) return false;
    const owned = isDecorationOwned(state, d.id);
    const assignedRoom = owned ? decorationRoom(state, d.id) : null;
    if (room !== 'all' && (assignedRoom ?? d.room) !== room) return false;
    if (type !== 'all' && decorKind(d.id) !== type) return false;
    if (q && !t(`deco.${d.id}.name`).toLowerCase().includes(q)) return false;
    return true;
  });

  // Owned pieces in the selected room. `resetRoomDecorations` refuses when a room
  // has nothing of its own to arrange, so the button is disabled rather than
  // offered-and-then-rejected.
  const ownedHere = room === 'all' ? 0 : ownedDecorationsInRoom(state, room).length;

  // Scope summary (the whole catalogue, or the selected room).
  const scopeRooms = room === 'all' ? rooms.map((r) => r.id) : [room];
  const ownedCount =
    room === 'all' ? DECORATIONS.filter((d) => isDecorationOwned(state, d.id)).length : ownedHere;
  const placedCount = scopeRooms.reduce((s, r) => s + placedDecorationsInRoom(state, r).length, 0);

  const roomName = (id: string) => t(ROOMS_BY_ID[id]?.nameKey ?? id);
  const priceText = (d: DecorationDef, amount: number) =>
    d.cost.resource === 'goldenNuts'
      ? t('station.tip.goldenAmount', { amount: fmt.int(Math.ceil(amount)) })
      : t('station.tip.nutAmount', { amount: fmt.int(Math.ceil(amount)) });

  function purchase(d: DecorationDef, event: MouseEvent) {
    const result = buy(d.id);
    if (!result.ok) {
      // What is missing is said live on the card (worked out as it renders), so
      // it keeps agreeing with the button while production ticks in.
      if (result.reason === 'short') {
        setNote({ id: d.id, tone: 'short', text: '', key: ++noteKey.current });
      }
      return;
    }
    sparkleAt(event);
    const where = result.roomId
      ? t('decorate.boughtPlaced', { room: roomName(result.roomId) })
      : t('decorate.boughtStored');
    setNote({ id: d.id, tone: 'ok', text: where, key: ++noteKey.current });
  }

  return (
    <section className="view view--decorate">
      <header className="decorate__head">
        <h2>{t('nav.decorate')}</h2>
        <p className="decorate__summary">
          {t('decorate.ownedCount', { count: ownedCount })} ·{' '}
          {t('decorate.placedCount', { count: placedCount })}
        </p>
      </header>

      <EnsembleNotes
        onBrowse={(id) => {
          setRoom('all');
          setType('all');
          setQuery('');
          setSection('available');
          setEnsembleId(id);
          audio.play('paper');
        }}
      />
      {ensemble ? (
        <div className="ensemble-selection" ref={selectionRef} tabIndex={-1}>
          <div>
            <strong>{t(`ensemble.${ensemble.id}.name`)}</strong>
            <p>{t('ensemble.selection', { room: roomName(ensemble.roomId) })}</p>
          </div>
          <button className="ghost-btn" onClick={() => setEnsembleId(null)}>
            {t('ensemble.allPieces')}
          </button>
        </div>
      ) : null}

      {/* One row of controls: which part of the catalogue, then narrowing it down. */}
      <div className="decorate__bar">
        <div
          className="catalogue-sections"
          role="group"
          aria-label={t('decorate.catalogueSections')}
        >
          {sections.map((value) => (
            <button
              key={value}
              type="button"
              data-section={value}
              aria-pressed={section === value}
              onClick={() => {
                setSection(value);
                setRoom('all');
                setType('all');
                setEnsembleId(null);
              }}
            >
              <span>{t(`decorate.section.${value}`)}</span>
              <span className="catalogue-sections__count">{counts[value]}</span>
            </button>
          ))}
        </div>
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
          {/* One filter: a room, or a kind of piece (a search covers names). */}
          <select
            className="select decorate__select"
            value={room !== 'all' ? `room:${room}` : type !== 'all' ? `kind:${type}` : 'all'}
            aria-label={t('decorate.filter')}
            onChange={(e) => {
              const [scope, value] = e.target.value.split(':');
              setRoom(scope === 'room' ? value : 'all');
              setType(scope === 'kind' ? (value as DecorKind) : 'all');
              setEnsembleId(null);
            }}
          >
            <option value="all">{t('decorate.allPieces')}</option>
            {section !== 'locked' ? (
              <optgroup label={t('decorate.roomFilter')}>
                {rooms.map((r) => (
                  <option key={r.id} value={`room:${r.id}`}>
                    {t(r.nameKey)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label={t('decorate.typeFilter')}>
              {kinds.map((k) => (
                <option key={k} value={`kind:${k}`}>
                  {t(`decorate.type.${k}`)}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Room actions, for the room chosen above, with the undo that belongs to
          them right beside them. */}
      {room !== 'all' ? (
        <div className="decorate__roombar">
          <span className="decorate__roombar-room">
            <Icon name="rooms" size={13} />
            {roomName(room)}
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

      {filtered.length === 0 ? (
        <p className="decorate__empty">
          {section === 'owned' && counts.owned === 0
            ? t('decorate.ownedEmpty')
            : t('decorate.noResults')}
        </p>
      ) : (
        <ul className="decorate__grid">
          {filtered.map((d) => {
            const name = t(`deco.${d.id}.name`);
            const description = t(`deco.${d.id}.desc`, { defaultValue: '' });
            const owned = isDecorationOwned(state, d.id);
            const placed = owned && isDecorationPlaced(state, d.id);
            const currentRoom = owned ? decorationRoom(state, d.id) : null;
            const open = roomIds.has(d.room);
            const have = state.resources[d.cost.resource];
            const afford = have >= d.cost.amount;
            const golden = d.cost.resource === 'goldenNuts';
            const surface = isRug(d.id) ? 'rug' : decorationSurface(d.id);
            const setId = SET_OF[d.id];
            const pressed = note?.id === d.id ? note : null;
            // A "short" answer lasts only while it is true, and counts down live.
            const cardNote =
              pressed?.tone === 'short'
                ? afford || owned
                  ? null
                  : {
                      ...pressed,
                      text: t('shop.shortNote', {
                        amount: priceText(d, Math.max(1, d.cost.amount - have)),
                      }),
                    }
                : pressed;
            // Where it is: the room it stands in (yours), storage (yours, put
            // away), or the room it belongs to (not yet yours).
            const where = owned
              ? currentRoom
                ? { icon: 'success' as const, text: roomName(currentRoom), state: 'placed' }
                : { icon: 'hidden' as const, text: t('decorate.inStorage'), state: 'stored' }
              : { icon: 'home' as const, text: roomName(d.room), state: 'home' };
            return (
              <li
                key={d.id}
                className={`decocard ${owned ? 'is-owned' : ''} ${placed ? 'is-placed' : ''} ${
                  !owned && !open ? 'is-coming' : ''
                } ${cardNote ? `is-${cardNote.tone}` : ''}`}
                data-kind={decorKind(d.id)}
                data-decoration={d.id}
                data-surface={surface}
              >
                <div className="decocard__inner">
                  <div className={`decocard__art decocard__art--${surface}`}>
                    <DecorationProp
                      id={d.id}
                      accent={ROOM_ACCENT[d.room]}
                      mode="interact"
                      onInteract={() => audio.play('click')}
                      title={name}
                    />
                  </div>
                  <div className="decocard__body">
                    <h3 className="decocard__title">{name}</h3>
                    {description ? <p className="decocard__description">{description}</p> : null}
                    <p className="decocard__where">
                      <span className="decocard__surface">
                        <Icon name={SURFACE_ICON[surface]} size={12} />
                        {/* A rug lies on the floor: that is its surface. */}
                        {t(`decorate.surface.${surface === 'rug' ? 'floor' : surface}`)}
                      </span>
                      <span className="decocard__room" data-state={where.state}>
                        <Icon name={where.icon} size={12} />
                        {where.state === 'placed' ? (
                          <span className="sr-only">{t('decorate.placed')}: </span>
                        ) : null}
                        {where.text}
                      </span>
                    </p>
                    {!owned && open ? (
                      <p className="decocard__gain">
                        <Icon name="morale" size={12} />
                        {t('decorate.moraleOnBuy', { value: d.moraleBonus })}
                      </p>
                    ) : null}
                    {setId ? (
                      <p className="decocard__set">
                        {t('decorate.inSet', { name: t(`ensemble.${setId}.name`) })}
                      </p>
                    ) : null}
                  </div>
                  <div className="decocard__actions">
                    {owned ? (
                      <>
                        <button
                          type="button"
                          className="mini-btn mini-btn--primary decocard__arrange"
                          onClick={() => arrangeDecoration(d.id)}
                        >
                          <Icon name="decorate" size={12} /> {t('decorate.arrangeHere')}
                        </button>
                        <button
                          type="button"
                          className="mini-btn decocard__move"
                          onClick={() => setMovingId(d.id)}
                        >
                          <Icon name="rooms" size={12} /> {t('decorate.moveTo')}
                        </button>
                      </>
                    ) : open ? (
                      <button
                        type="button"
                        className={`buy-btn decocard__buy ${golden ? 'is-golden' : ''}`}
                        aria-disabled={afford ? undefined : true}
                        aria-label={`${t('shop.buy')} ${name}: ${priceText(d, d.cost.amount)}${
                          afford
                            ? ''
                            : `. ${t('shop.short', { amount: priceText(d, d.cost.amount - have) })}`
                        }`}
                        onClick={(e) => purchase(d, e)}
                      >
                        {golden ? <GoldenNut size={15} /> : <Acorn size={15} />}
                        <span className="decocard__price">{fmt.num(d.cost.amount)}</span>
                        {afford ? null : (
                          <span className="decocard__short">
                            {t('shop.short', {
                              amount: fmt.num(Math.max(1, Math.ceil(d.cost.amount - have))),
                            })}
                          </span>
                        )}
                      </button>
                    ) : (
                      <p className="decocard__coming">
                        <Icon name="lock" size={12} />
                        <span>{t('decorate.comesWith', { room: roomName(d.room) })}</span>
                        <span className="decocard__coming-price">
                          {golden ? <GoldenNut size={12} /> : <Acorn size={12} />}
                          {fmt.num(d.cost.amount)}
                        </span>
                      </p>
                    )}
                  </div>
                  {cardNote ? (
                    <p
                      key={cardNote.key}
                      className={`decocard__note is-${cardNote.tone}`}
                      role="status"
                    >
                      {cardNote.tone === 'ok' ? <Icon name="success" size={12} /> : null}
                      {cardNote.text}
                    </p>
                  ) : null}
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
