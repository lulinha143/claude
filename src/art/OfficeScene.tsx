import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { unlockedRooms, isRoomUnlocked, resolveEmployeeRoom } from '../sim/rooms';
import { ROOMS } from '../content/rooms';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { DECORATIONS_BY_ID } from '../content/decorations';
import { Critter } from './Critter';
import { CritterStateMachine, type CritterState } from './animation';
import { shapeFor } from './critterShapes';
import { Acorn, Crate } from './Icons';
import { Icon } from './UiIcon';
import { DecorationProp } from './DecorationProp';
import {
  placedDecorationsInRoom,
  inventoryDecorationsInRoom,
  freeAnchorsInRoom,
  isDecorationPlaced,
  roomComfort,
} from '../sim/decorations';
import { characterSlots } from '../content/roomLayout';
import { pickDialogueIndex, dialogueKey } from '../sim/dialogue';
import { employeeMood, MOOD_TONE } from '../sim/mood';
import { createRng } from '../sim/rng';

interface Bubble {
  employeeId: string;
  text: string;
  until: number;
}

// department accent per room (references design tokens)
const DEPT: Record<string, string> = {
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

// which ambient decoration each room shows (styled in styles.css)
const AMBIENT: Record<string, string> = {
  'founder-desk': 'desk',
  sorting: 'conveyor',
  morale: 'coffee',
  procurement: 'crate',
  construction: 'wood',
  lab: 'beaker',
  marketing: 'sign',
  vault: 'vault',
  research: 'scope',
  meeting: 'clock',
  nap: 'moon',
  basement: 'pipe',
  rooftop: 'plant',
};

// Persistent per-employee state machines (kept across renders).
const machines: Record<string, CritterStateMachine> = {};
function machineFor(id: string): CritterStateMachine {
  if (!machines[id]) machines[id] = new CritterStateMachine();
  return machines[id];
}

export function OfficeScene() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const reducedMotion = state.settings.reducedMotion;
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [crateReady, setCrateReady] = useState(true);
  const [pop, setPop] = useState<{ x: number; y: number; text: string; id: number } | null>(null);
  const [decorMode, setDecorMode] = useState(false);
  // The decoration currently picked up for arranging (its id), or null.
  const [selected, setSelected] = useState<string | null>(null);
  const rngRef = useRef(createRng(Date.now() & 0xffff));
  const now = Date.now();

  const rooms = unlockedRooms(state).slice().reverse();
  // the next room the player can work toward (for an "under construction" hint)
  const nextLocked = ROOMS.filter((r) => !isRoomUnlocked(state, r)).sort((a, b) => a.floor - b.floor)[0];
  const producing = engine.productionPerSecond() > 0;
  const focusMode = engine.isFocusActive();
  const lowMorale = state.resources.morale < 35;

  useEffect(() => {
    if (!bubble) return;
    const h = setTimeout(() => setBubble(null), Math.max(0, bubble.until - Date.now()));
    return () => clearTimeout(h);
  }, [bubble]);

  useEffect(() => {
    const h = setInterval(() => {
      const hired = Object.entries(state.employees).filter(([, e]) => e.hired);
      if (hired.length === 0) return;
      const [id] = hired[Math.floor(Math.random() * hired.length)];
      const def = EMPLOYEES_BY_ID[id];
      speak(id, def?.dialogueCategory ?? 'idle');
    }, 12000);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function speak(employeeId: string, category: string) {
    const idx = pickDialogueIndex(category, rngRef.current);
    if (idx < 0) return;
    setBubble({ employeeId, text: t(dialogueKey(category, idx)), until: Date.now() + 4000 });
  }

  function onCritterClick(employeeId: string) {
    const def = EMPLOYEES_BY_ID[employeeId];
    if (employeeId === 'pip') {
      engine.petPip();
      audio.play('click');
      speak('pip', 'interaction');
    } else {
      speak(employeeId, def?.dialogueCategory ?? 'idle');
      audio.play('footstep');
    }
  }

  function onCollect(e: React.MouseEvent) {
    const res = engine.collectCrate();
    audio.play('collect');
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const parent = el.offsetParent as HTMLElement | null;
    const px = parent ? rect.left - parent.getBoundingClientRect().left + rect.width / 2 : rect.left;
    const py = parent ? rect.top - parent.getBoundingClientRect().top : rect.top;
    setPop({ x: px, y: py, text: `+${Math.round(res.gained)}`, id: Date.now() });
    setCrateReady(false);
    setTimeout(() => setCrateReady(true), 850);
    setTimeout(() => setPop(null), 950);
  }

  // -- decoration arranging ---------------------------------------------------
  function toggleDecorMode() {
    setDecorMode((v) => {
      if (v) setSelected(null); // leaving arrange mode clears the picked item
      return !v;
    });
  }

  function selectDeco(id: string) {
    setSelected((prev) => (prev === id ? null : id));
    audio.play('click');
  }

  function selectedRoom(): string | null {
    return selected ? (DECORATIONS_BY_ID[selected]?.room ?? null) : null;
  }

  function onAnchorClick(roomId: string, anchorId: string) {
    if (!selected || selectedRoom() !== roomId) return;
    if (engine.moveDecoration(selected, anchorId)) audio.play('upgrade');
    setSelected(null);
  }

  function sendSelectedToInventory() {
    if (selected && engine.removeDecoration(selected)) audio.play('click');
    setSelected(null);
  }

  const overGif = state.settings.background.enabled;
  return (
    <div
      className={`office ${decorMode ? 'office--decorating' : ''} ${overGif ? 'office--overgif' : ''}`}
      aria-label="office diorama"
    >
      <div className="office__toolbar">
        <button
          className={`chip-btn ${decorMode ? 'is-on' : ''}`}
          onClick={toggleDecorMode}
          aria-pressed={decorMode}
        >
          <Icon name="decorate" size={14} /> {t('office.decorate')}
        </button>
        {decorMode ? (
          <>
            <button
              className="chip-btn chip-btn--ghost"
              onClick={() => engine.undoDecoration()}
              disabled={!engine.canUndoDecoration()}
              title={t('decorate.undo')}
            >
              <Icon name="undo" size={13} /> {t('decorate.undo')}
            </button>
            <button
              className="chip-btn chip-btn--ghost"
              onClick={() => engine.redoDecoration()}
              disabled={!engine.canRedoDecoration()}
              title={t('decorate.redo')}
            >
              <Icon name="redo" size={13} /> {t('decorate.redo')}
            </button>
            <span className="office__toolbar-hint">
              {selected ? t('decorate.pickedHint') : t('office.decorateHint')}
            </span>
          </>
        ) : null}
      </div>

      {/* organic tree-trunk frame behind the floors */}
      <svg className="office__frame" viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="bark" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3a2c1f" />
            <stop offset="0.5" stopColor="#4a3826" />
            <stop offset="1" stopColor="#33261a" />
          </linearGradient>
        </defs>
        {/* trunk body with slightly irregular sides */}
        <path
          d="M8 12 C 2 40, 6 90, 4 140 C 3 168, 10 184, 14 196 L86 196 C 90 184, 97 168, 96 140 C 94 90, 98 40, 92 12 C 80 4, 20 4, 8 12 Z"
          fill="url(#bark)"
          stroke="#241a12"
          strokeWidth="1.5"
        />
        {/* bark grooves */}
        <path d="M16 20 C 12 70, 14 120, 12 180" stroke="#33261a" strokeWidth="1.4" fill="none" opacity="0.6" />
        <path d="M84 20 C 88 70, 86 120, 88 180" stroke="#33261a" strokeWidth="1.4" fill="none" opacity="0.6" />
        {/* knots */}
        <ellipse cx="14" cy="60" rx="3" ry="5" fill="#2a2016" opacity="0.7" />
        <ellipse cx="87" cy="110" rx="3" ry="5" fill="#2a2016" opacity="0.7" />
        {/* roots at the base */}
        <path d="M14 196 c -6 -2 -8 -8 -12 -6 M86 196 c 6 -2 8 -8 12 -6" stroke="#241a12" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* moss */}
        <path d="M6 150 q4 6 10 4 M94 40 q-5 6 -10 3" stroke="#3f7d4f" strokeWidth="3" fill="none" opacity="0.5" strokeLinecap="round" />
      </svg>

      <div className="office__trunk">
        {nextLocked ? (
          <div className="floor floor--locked" aria-label={t('common.locked')}>
            <div className="floor__label">
              <Icon name="lock" size={12} /> {t(nextLocked.nameKey)}
            </div>
            <div className="floor__construction">
              {nextLocked.unlock.reputation
                ? t('employee.unlockAt', { value: nextLocked.unlock.reputation })
                : t('common.locked')}
            </div>
          </div>
        ) : null}

        {rooms.map((room) => {
          const occupants = Object.entries(state.employees).filter(
            ([id, rt]) => rt.hired && resolveEmployeeRoom(state, id) === room.id,
          );
          const slots = characterSlots(occupants.length);
          const comfort = roomComfort(state, room.id);
          const placed = placedDecorationsInRoom(state, room.id);
          const inventory = inventoryDecorationsInRoom(state, room.id);
          const emptyAnchors = decorMode ? freeAnchorsInRoom(state, room.id) : [];
          const canDropHere = decorMode && selected !== null && selectedRoom() === room.id;
          const selectedPlacedHere =
            selected !== null && selectedRoom() === room.id && isDecorationPlaced(state, selected);
          return (
            <div
              className="floor"
              key={room.id}
              data-room={room.id}
              style={{ ['--dept' as string]: DEPT[room.id] ?? 'var(--dept-founder)' }}
            >
              <div className="floor__header">
                <span className="floor__label">{t(room.nameKey)}</span>
                <span className="floor__status">
                  {occupants.length > 0 ? (
                    <span className="floor__stat" title={t('overview.workers', { count: occupants.length })}>
                      <Icon name="employees" size={11} /> {occupants.length}
                    </span>
                  ) : null}
                  {comfort > 0 ? (
                    <span className="floor__stat floor__stat--comfort" title={t('overview.comfort', { value: comfort })}>
                      <Icon name="morale" size={11} /> +{comfort}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className={`floor__ambient floor__ambient--${AMBIENT[room.id] ?? 'dust'}`} aria-hidden>
                {reducedMotion ? null : <span className="floor__dust" />}
              </div>

              <div className={`floor__stage ${canDropHere ? 'floor__stage--dropping' : ''}`}>
                {/* placed decorations sit at their anchors */}
                {placed.map(({ def, anchor }) => (
                  <div
                    key={def.id}
                    className={`floor__anchor ${selected === def.id ? 'is-selected' : ''}`}
                    style={{
                      left: `${anchor.x * 100}%`,
                      bottom: `${anchor.y}px`,
                      ['--dscale' as string]: anchor.scale,
                    }}
                  >
                    <DecorationProp
                      id={def.id}
                      reducedMotion={reducedMotion}
                      mode={decorMode ? 'toggle' : 'interact'}
                      selected={decorMode && selected === def.id}
                      title={t(`deco.${def.id}.name`)}
                      onToggle={() => selectDeco(def.id)}
                      onInteract={() => audio.play('click')}
                    />
                  </div>
                ))}

                {/* empty anchor drop-targets (arrange mode only) */}
                {emptyAnchors.map((anchor) => (
                  <button
                    key={`empty-${anchor.id}`}
                    className={`floor__anchor floor__anchor--empty ${canDropHere ? 'is-active' : ''}`}
                    style={{ left: `${anchor.x * 100}%`, bottom: `${anchor.y}px` }}
                    onClick={() => onAnchorClick(room.id, anchor.id)}
                    disabled={!canDropHere}
                    aria-label={t('decorate.placeHere')}
                    title={t('decorate.placeHere')}
                  >
                    <span className="floor__anchor-dot" aria-hidden />
                  </button>
                ))}

                {occupants.map(([id, rt], idx) => {
                  const def = EMPLOYEES_BY_ID[id];
                  const shape = shapeFor(id);
                  const slot = slots[idx] ?? { x: 0.5, bottom: 0 };
                  const inputs = {
                    hired: rt.hired,
                    producing,
                    moving: false,
                    lowMorale,
                    celebrating: false,
                    focusMode,
                    interactedRecently: false,
                    hovered: false,
                  };
                  const anim: CritterState = machineFor(id).update(inputs, now);
                  const accent =
                    def?.outfits.find((o) => o.id === rt.outfitId)?.accent ?? def?.accent ?? '#3f7d4f';
                  const label = rt.nickname ?? t(def?.nameKey ?? id);
                  return (
                    <button
                      key={id}
                      className="critter-btn"
                      style={{ left: `${slot.x * 100}%`, bottom: `${slot.bottom}px`, zIndex: 3 + (idx % 2) }}
                      onClick={() => onCritterClick(id)}
                      title={label}
                      aria-label={label}
                    >
                      {focusMode ? <span className="focus-hat" aria-hidden /> : null}
                      <span
                        className="mood-dot"
                        style={{ background: MOOD_TONE[employeeMood(state, id)] }}
                        title={t(`mood.${employeeMood(state, id)}`)}
                        aria-hidden
                      />
                      <Critter
                        species={shape.species}
                        color={def?.color ?? '#c65b3c'}
                        accent={accent}
                        state={anim}
                        hasGlasses={shape.hasGlasses}
                        reducedMotion={reducedMotion}
                        size={62}
                        title={label}
                        seed={idx + room.floor}
                      />
                      {bubble?.employeeId === id ? (
                        <span className="bubble" role="status">
                          {bubble.text}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {room.id === 'founder-desk' && crateReady && !decorMode ? (
                  <button className="crate-btn" onClick={onCollect} aria-label={t('office.collect')}>
                    <span className="crate-btn__glow" aria-hidden />
                    <Crate size={52} />
                    <span className="crate-btn__hint">{t('office.collect')}</span>
                  </button>
                ) : null}
              </div>

              {/* arrange-mode tray: inventory + per-room controls */}
              {decorMode ? (
                <div className="floor__tray" role="group" aria-label={t('decorate.inventory')}>
                  <div className="floor__tray-items">
                    {inventory.length === 0 ? (
                      <span className="floor__tray-empty">{t('decorate.inventoryEmpty')}</span>
                    ) : (
                      inventory.map((d) => (
                        <DecorationProp
                          key={d.id}
                          id={d.id}
                          reducedMotion={reducedMotion}
                          mode="toggle"
                          selected={selected === d.id}
                          title={t(`deco.${d.id}.name`)}
                          onToggle={() => selectDeco(d.id)}
                        />
                      ))
                    )}
                  </div>
                  <div className="floor__tray-actions">
                    {selectedPlacedHere ? (
                      <button className="mini-btn" onClick={sendSelectedToInventory}>
                        <Icon name="close" size={12} /> {t('decorate.stow')}
                      </button>
                    ) : null}
                    <button
                      className="mini-btn"
                      onClick={() => {
                        if (engine.resetRoomDecorations(room.id)) audio.play('upgrade');
                        setSelected(null);
                      }}
                    >
                      <Icon name="refresh" size={12} /> {t('decorate.resetRoom')}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="office__floating" aria-hidden>
        <Acorn size={24} />
      </div>

      {pop ? (
        <span className="floating-pop" style={{ left: pop.x, top: pop.y }} key={pop.id}>
          {pop.text}
        </span>
      ) : null}
    </div>
  );
}
