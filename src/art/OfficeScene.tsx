import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { unlockedRooms } from '../sim/rooms';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { Critter } from './Critter';
import { CritterStateMachine, type CritterState } from './animation';
import { shapeFor } from './critterShapes';
import { Acorn, Crate } from './Icons';
import { pickDialogueIndex, dialogueKey } from '../sim/dialogue';
import { createRng } from '../sim/rng';

interface Bubble {
  employeeId: string;
  text: string;
  until: number;
}

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
  const rngRef = useRef(createRng(Date.now() & 0xffff));
  const now = Date.now();

  // cheap to recompute each render (a handful of rooms); reflects live state.
  const rooms = unlockedRooms(state).slice().reverse();
  const producing = engine.productionPerSecond() > 0;
  const focusMode = engine.isFocusActive();
  const lowMorale = state.resources.morale < 35;

  // clear bubble after timeout
  useEffect(() => {
    if (!bubble) return;
    const h = setTimeout(() => setBubble(null), Math.max(0, bubble.until - Date.now()));
    return () => clearTimeout(h);
  }, [bubble]);

  // periodic idle chatter
  useEffect(() => {
    const h = setInterval(() => {
      const hired = Object.entries(state.employees).filter(([, e]) => e.hired);
      if (hired.length === 0) return;
      const [id] = hired[Math.floor(Math.random() * hired.length)];
      const def = EMPLOYEES_BY_ID[id];
      const cat = def?.dialogueCategory ?? 'idle';
      speak(id, cat);
    }, 12000);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function speak(employeeId: string, category: string) {
    const idx = pickDialogueIndex(category, rngRef.current);
    if (idx < 0) return;
    const key = dialogueKey(category, idx);
    setBubble({ employeeId, text: t(key), until: Date.now() + 4000 });
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
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const parent = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
    const px = parent ? rect.left - parent.getBoundingClientRect().left + rect.width / 2 : rect.left;
    const py = parent ? rect.top - parent.getBoundingClientRect().top : rect.top;
    setPop({ x: px, y: py, text: `+${Math.round(res.gained)}`, id: Date.now() });
    setCrateReady(false);
    setTimeout(() => setCrateReady(true), 900);
    setTimeout(() => setPop(null), 900);
  }

  return (
    <div className="office" aria-label="office diorama">
      <div className="office__trunk">
        {rooms.map((room) => {
          const occupants = Object.entries(state.employees).filter(
            ([id, rt]) => rt.hired && EMPLOYEES_BY_ID[id]?.room === room.id,
          );
          return (
            <div className="floor" key={room.id} data-room={room.id}>
              <div className="floor__label">{t(room.nameKey)}</div>
              <div className="floor__stage">
                {room.id === 'founder-desk' ? (
                  <div className="desk">
                    <div className="desk__lamp" />
                    <div className="desk__monitor" />
                  </div>
                ) : null}
                {occupants.map(([id, rt]) => {
                  const def = EMPLOYEES_BY_ID[id];
                  const shape = shapeFor(id);
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
                  const accent = def?.outfits.find((o) => o.id === rt.outfitId)?.accent ?? def?.accent ?? '#3f7d4f';
                  const label = rt.nickname ?? t(def?.nameKey ?? id);
                  return (
                    <button
                      key={id}
                      className="critter-btn"
                      style={{ left: `${rt.x * 100}%` }}
                      onClick={() => onCritterClick(id)}
                      title={label}
                    >
                      {focusMode ? <span className="focus-hat" aria-hidden /> : null}
                      <Critter
                        color={def?.color ?? '#c65b3c'}
                        accent={accent}
                        state={anim}
                        earType={shape.earType}
                        hasTail={shape.hasTail}
                        hasGlasses={shape.hasGlasses}
                        hasBeak={shape.hasBeak}
                        reducedMotion={reducedMotion}
                        size={58}
                        title={label}
                      />
                      {bubble?.employeeId === id ? (
                        <span className="bubble" role="status">
                          {bubble.text}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {room.id === 'founder-desk' && crateReady ? (
                  <button className="crate-btn" onClick={onCollect} aria-label={t('office.collect')}>
                    <Crate size={52} />
                    <span className="crate-btn__hint">{t('office.collect')}</span>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="office__floating">
        <Acorn size={26} />
      </div>

      {pop ? (
        <span className="floating-pop" style={{ left: pop.x, top: pop.y }} key={pop.id}>
          {pop.text}
        </span>
      ) : null}
    </div>
  );
}
