import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import {
  ROOM_CAP,
  unlockedRooms,
  isRoomUnlocked,
  resolveEmployeeRoom,
  employeesInRoom,
} from '../sim/rooms';
import { ROOMS, ROOMS_BY_ID } from '../content/rooms';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { DECORATIONS_BY_ID } from '../content/decorations';
import { Critter } from './Critter';
import { CritterStateMachine, type CritterState } from './animation';
import { shapeFor } from './critterShapes';
import { employeeSprite, VECTOR_CRITTER_OFFICE_SIZE } from './employeeSprites';
import { useSceneScale } from './useSceneScale';
import { useSpriteAvailabilityRevision } from './spriteAvailability';
import { EmployeeSprite } from './EmployeeSprite';
import { EmployeeBubble } from './EmployeeMoodBadge';
import { Acorn } from './Icons';
import { ClickStation } from './ClickStation';
import {
  CLICK_STATIONS_BY_ID,
  stationsInRoom,
  type ClickStationDef,
} from '../content/clickStations';
import { previewClickValue, synergyEmployees } from '../sim/clickStations';
import { chooseVoice } from '../sim/employeeVoice';
import { clearTapFeedback } from '../ui/tapFeedback';
import { useFmt } from '../ui/useFmt';
import { Icon } from './UiIcon';
import { DecorationProp, decorKind, interactSound } from './DecorationProp';
import { RoomDressing } from './RoomDressing';
import {
  placedDecorationsInRoom,
  isDecorationPlaced,
  decorationRoom,
  decorationInstance,
  roomComfort,
} from '../sim/decorations';
import { surfaceZ, decorationSurface, isRug } from '../sim/surfaces';
import { DECORATION_DEPTH_CEILING, SCENE_DEPTH, characterDepth } from '../sim/depth';
import { pointerRegionPlacement } from '../sim/placement';
import { placementRegionById } from '../content/roomSurfaces';
import { type PlacementAnchorMode, type PlacementRegionKind } from '../sim/placementRegions';
import { characterSlots, depthScale } from '../content/roomLayout';
import { placementSpec } from '../content/placementSpecs';
import { pickOfficeInteraction } from '../sim/officeLife';
import { DecorationTray } from '../ui/DecorationTray';
import { MoveDecorationModal } from '../ui/modals/MoveDecorationModal';
import { Tip, TipContent } from '../ui/Tooltip';
import { pickDialogueIndex, dialogueKey } from '../sim/dialogue';
import { employeeMood, MOOD_TONE } from '../sim/mood';
import { createRng } from '../sim/rng';
import { notify } from '../ui/notificationsStore';
import { dustPuff } from '../ui/sparkle';
import { INTERACTION_CANCEL_EVENT, INTERACTION_FOCUS_EVENT } from '../ui/interactionLifecycle';

const DRAG_THRESHOLD = 7; // px before a press becomes a drag (vs a tap)

interface DecorationDragPreview {
  roomId: string;
  regionId: string;
  regionKind: PlacementRegionKind;
  anchorMode: PlacementAnchorMode;
  point: { x: number; y: number };
  clientX: number;
  clientY: number;
  depth: number;
  planeFootprint: { width: number; depth: number };
  valid: boolean;
  reasonKey?: string;
}

interface DragState {
  kind: 'employee' | 'decoration';
  id: string;
  x: number;
  y: number;
  room: string | null; // for decorations: the source room; employees: null
  overRoom: string | null;
  valid: boolean;
  preview?: DecorationDragPreview;
}

interface CancelDragOptions {
  restoreOnFocus?: boolean;
  awaitRelease?: boolean;
}

interface Bubble {
  employeeId: string;
  text: string;
  until: number;
}

interface EmployeeInteraction {
  employeeId: string;
  targetX: number;
  phase: 'walking' | 'interacting';
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

// NOTE: Free-standing "workbench" desk objects were removed — desks will become
// part of the character sprites in a future skin update. Employees now simply
// stand on the room floor. The room-local layout (`characterSlots`) and the
// built-in room dressing provide the furnished feel in the meantime.

// Small critter (or final sprite) rendered inside the drag ghost.
function GhostCritter({ id, reducedMotion }: { id: string; reducedMotion: boolean }) {
  const sprite = employeeSprite(id);
  const d = EMPLOYEES_BY_ID[id];
  if (sprite) {
    return (
      <EmployeeSprite config={sprite} reducedMotion={reducedMotion} height={sprite.officeHeight} />
    );
  }
  const sh = shapeFor(id);
  return (
    <Critter
      species={sh.species}
      color={d?.color ?? '#c65b3c'}
      accent={d?.accent ?? '#3f7d4f'}
      state="idle"
      hasGlasses={sh.hasGlasses}
      reducedMotion={reducedMotion}
      size={VECTOR_CRITTER_OFFICE_SIZE}
    />
  );
}

const EMPLOYEE_DRAG_BASELINE_RATIO = 54 / 56;

function decorationAnchorStyle(id: string): CSSProperties {
  const { baseline } = placementSpec(id);
  return {
    ['--deco-anchor-offset' as string]: `${(1 - baseline) * 100}%`,
    ['--deco-ghost-offset' as string]: `${-baseline * 100}%`,
  };
}

function decorationAnchorClass(id: string): string {
  return `deco-anchor--${placementSpec(id).anchor}`;
}

function RegionGuide({ preview }: { preview: DecorationDragPreview }) {
  const region = placementRegionById(preview.regionId);
  if (!region) return null;
  const polygon = [
    region.plane.bottomLeft,
    region.plane.bottomRight,
    region.plane.topRight,
    region.plane.topLeft,
  ]
    .map((point) => `${point.x * 100},${(1 - point.y) * 100}`)
    .join(' ');
  return (
    <svg
      className={`floor__surface-guide floor__surface-guide--${region.surfaceType} floor__region-guide ${
        preview.valid ? 'is-valid' : 'is-invalid'
      }`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-region={region.id}
      data-region-kind={region.kind}
      aria-hidden
    >
      <polygon className="floor__region-plane" points={polygon} />
      <ellipse
        className="floor__region-footprint"
        cx={preview.point.x * 100}
        cy={(1 - preview.point.y) * 100}
        rx={(preview.planeFootprint.width * 100) / 2}
        ry={(preview.planeFootprint.depth * 100) / 2}
      />
    </svg>
  );
}

// The ghost and committed item consume the same authored baseline. Surface
// selection decides where the support point is; item metadata decides which
// visual contact point (base, mount, or suspension) sits on it.
function ghostAnchorClass(drag: DragState): string {
  if (drag.kind !== 'decoration' || !drag.preview) return 'drag-ghost--pointer-anchor';
  return `drag-ghost--anchored ${decorationAnchorClass(drag.id)}`;
}

// i18n suffix naming the surface being targeted (Floor / Wall / Ceiling).
const REGION_LABEL: Record<PlacementRegionKind, string> = {
  floor: 'floor',
  wall: 'wall',
  ceiling: 'ceiling',
};
function ghostSurfaceLabel(drag: DragState): string {
  if (drag.kind === 'decoration' && drag.preview) return REGION_LABEL[drag.preview.regionKind];
  return decorationSurface(drag.id);
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
  const fmt = useFmt();
  // Re-render if a character's artwork turns out to be missing, so they switch to
  // the hand-drawn fallback silhouette rather than showing a broken image.
  useSpriteAvailabilityRevision();
  // World scale. Measured off the room and published as --asset-scale on the scene
  // root, so the cast, the furniture and the set all change size together when the
  // window does. `sceneScale` is the same number for the JS-side scene geometry
  // below (slot depth), which CSS cannot reach.
  const {
    measureRef: sceneMeasureRef,
    scopeRef: sceneScopeRef,
    sceneScale,
  } = useSceneScale<HTMLDivElement, HTMLDivElement>();
  const [decorMode, setDecorMode] = useState(false);
  // The decoration currently picked up for arranging (its id), or null.
  const [selected, setSelected] = useState<string | null>(null);
  const [moveDialog, setMoveDialog] = useState<string | null>(null);
  // A decoration that was just placed, for a brief settle animation.
  const [justPlaced, setJustPlaced] = useState<string | null>(null);
  // A decoration a nearby employee is currently reacting to (for a little wiggle).
  const [reactingDeco, setReactingDeco] = useState<string | null>(null);
  // The employee currently visiting an object (walks over, then interacts) + the object x.
  const [interaction, setInteraction] = useState<EmployeeInteraction | null>(null);
  const [hoveredEmployee, setHoveredEmployee] = useState<string | null>(null);
  const [focusedEmployee, setFocusedEmployee] = useState<string | null>(null);
  const [recentEmployee, setRecentEmployee] = useState<string | null>(null);
  const [celebratingEmployee, setCelebratingEmployee] = useState<string | null>(null);
  const lifeTimersRef = useRef<Set<number>>(new Set());
  const recentReactionGenerationRef = useRef(0);
  const celebrationGenerationRef = useRef(0);
  // Decoration ids currently reserved by an in-progress interaction.
  const reservedRef = useRef<Set<string>>(new Set());
  // Live drag (employee or decoration) for the ghost + drop highlighting.
  const [drag, setDrag] = useState<DragState | null>(null);
  // Exactly one pointer session may own capture/listeners at a time. Keeping its
  // cancel function in a ref lets blur, visibility, IPC focus and unmount all
  // tear it down even when the OS swallowed pointerup/pointercancel.
  const cancelActiveDragRef = useRef<((options?: CancelDragOptions) => void) | null>(null);
  // A cancelled pointer stream may deliver its swallowed pointerup/click only
  // after the window returns. Keep click suppression armed until that release
  // arrives (or a fresh pointerdown proves the stale stream is over).
  const pendingReleaseCleanupsRef = useRef<Map<number, () => void>>(new Map());
  const pendingFocusRestoreRef = useRef<HTMLElement | null>(null);
  // True immediately after a real drag so the trailing click doesn't also fire.
  const draggedRef = useRef(false);
  const rngRef = useRef(createRng(Date.now() & 0xffff));
  // Latest state, so the ambient-chatter interval always reads current data.
  const stateRef = useRef(state);
  stateRef.current = state;
  const now = Date.now();

  const rooms = unlockedRooms(state).slice().reverse();
  // the next room the player can work toward (for an "under construction" hint)
  const nextLocked = ROOMS.filter((r) => !isRoomUnlocked(state, r)).sort(
    (a, b) => a.floor - b.floor,
  )[0];
  const producing = engine.productionPerSecond() > 0;
  const focusMode = engine.isFocusActive();
  const lowMorale = state.resources.morale < 35;

  // Stable identity so callbacks that schedule office life (station taps, employee
  // reactions) are not rebuilt on every render.
  const scheduleLife = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      lifeTimersRef.current.delete(timer);
      callback();
    }, delay);
    lifeTimersRef.current.add(timer);
  }, []);

  useEffect(
    () => () => {
      lifeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      lifeTimersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!bubble) return;
    const h = setTimeout(() => setBubble(null), Math.max(0, bubble.until - Date.now()));
    return () => clearTimeout(h);
  }, [bubble]);

  useEffect(() => {
    const pendingReleaseCleanups = pendingReleaseCleanupsRef.current;
    const restorePendingFocus = () => {
      const preferred = pendingFocusRestoreRef.current;
      if (!preferred) return;
      pendingFocusRestoreRef.current = null;
      const fallback = document.querySelector<HTMLElement>('.office__toolbar button, .nav__item');
      const target =
        preferred.isConnected && !preferred.hasAttribute('disabled') ? preferred : fallback;
      target?.focus({ preventScroll: true });
    };
    const cancelForBlur = () =>
      cancelActiveDragRef.current?.({ restoreOnFocus: true, awaitRelease: true });
    const cancelForFocus = () => {
      // Focus can return without a renderer blur event on some window managers.
      // A second idempotent cancellation guarantees no capture/portal survives.
      cancelActiveDragRef.current?.({ restoreOnFocus: true, awaitRelease: true });
      restorePendingFocus();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancelForBlur();
      else cancelForFocus();
    };

    window.addEventListener('blur', cancelForBlur);
    window.addEventListener('focus', cancelForFocus);
    window.addEventListener(INTERACTION_CANCEL_EVENT, cancelForBlur);
    window.addEventListener(INTERACTION_FOCUS_EVENT, cancelForFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', cancelForBlur);
      window.removeEventListener('focus', cancelForFocus);
      window.removeEventListener(INTERACTION_CANCEL_EVENT, cancelForBlur);
      window.removeEventListener(INTERACTION_FOCUS_EVENT, cancelForFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      cancelActiveDragRef.current?.({ awaitRelease: false });
      cancelActiveDragRef.current = null;
      pendingReleaseCleanups.forEach((clear) => clear());
      pendingReleaseCleanups.clear();
      pendingFocusRestoreRef.current = null;
    };
  }, []);

  useEffect(() => {
    const h = setInterval(ambientChatter, 11000);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every so often a hired critter comes alive: often it wanders over to a
  // nearby decoration and interacts with it (lean toward it + react bubble +
  // the object wiggles), reserving that object so no one else grabs it;
  // otherwise it just says a line for its department.
  function ambientChatter() {
    const st = stateRef.current;
    const hired = Object.entries(st.employees).filter(([, e]) => e.hired);
    if (hired.length === 0) return;

    if (Math.random() < 0.6) {
      const it = pickOfficeInteraction(st, reservedRef.current, rngRef.current);
      if (it) {
        reservedRef.current.add(it.decorationId);
        setBubble({
          employeeId: it.employeeId,
          text: t(`decoReact.${decorKind(it.decorationId)}`),
          until: Date.now() + 4200,
        });
        setReactingDeco(it.decorationId);
        setInteraction({ employeeId: it.employeeId, targetX: it.targetX, phase: 'walking' });
        scheduleLife(() => {
          setInteraction((current) =>
            current?.employeeId === it.employeeId ? { ...current, phase: 'interacting' } : current,
          );
        }, 650);
        scheduleLife(() => {
          setReactingDeco((cur) => (cur === it.decorationId ? null : cur));
          setInteraction((cur) => (cur?.employeeId === it.employeeId ? null : cur));
          reservedRef.current.delete(it.decorationId);
        }, 2800);
        return;
      }
    }

    const [id] = hired[Math.floor(Math.random() * hired.length)];
    // Ambient chatter reads the room too, so overhearing the office tells the
    // player something about it.
    speak(id, chooseVoice(state, id).category);
  }

  function speak(employeeId: string, category: string) {
    const idx = pickDialogueIndex(category, rngRef.current);
    if (idx < 0) return;
    setBubble({ employeeId, text: t(dialogueKey(category, idx)), until: Date.now() + 4000 });
  }

  function onCritterClick(employeeId: string) {
    if (draggedRef.current) return; // suppress the click that follows a drag
    setRecentEmployee(employeeId);
    const reactionGeneration = ++recentReactionGenerationRef.current;
    scheduleLife(() => {
      if (recentReactionGenerationRef.current !== reactionGeneration) return;
      setRecentEmployee((current) => (current === employeeId ? null : current));
    }, 1400);
    // LEANING IN: the first click keeps its original behaviour and the teammate says
    // something. Clicking a teammate who is ALREADY mid-sentence opens the full
    // interaction mode, if they have something worth a conversation.
    //
    // Having the first click open the mode was tried and reverted. It reads fine in
    // isolation, but it costs the ambient life of the office — every idle poke became a
    // full-screen interruption, and the one-liners are most of what makes the room feel
    // inhabited. Gating on "they are already talking" keeps the poke cheap, makes the
    // escalation discoverable by doing the obvious thing twice, and keeps the roster's
    // explicit Talk button as the direct route for anyone who wants it.
    const alreadySpeaking = bubble?.employeeId === employeeId && bubble.until > Date.now();
    if (alreadySpeaking && engine.openTalk(employeeId)) {
      setBubble(null);
      audio.play('click');
      return;
    }
    if (employeeId === 'pip') {
      engine.petPip();
      audio.play('click');
      // Petting the founder is its own interaction, but she still notices a
      // company-wide mood or a bad assignment before falling back to it.
      const voice = chooseVoice(state, 'pip');
      speak('pip', voice.reason === 'personal' ? 'interaction' : voice.category);
    } else {
      // Everyone else comments on what is actually happening to them: the company
      // mood, or the department they have been put in.
      speak(employeeId, chooseVoice(state, employeeId).category);
      audio.play('footstep');
    }
  }

  // -- click stations ---------------------------------------------------------
  // The tap itself is deliberately cheap: the engine pays out and the imperative
  // feedback layer draws the number, so nothing here throttles or debounces the
  // player. The only extra work is an occasional teammate celebration, and that
  // is rate-limited on its own so a fast streak cannot spam animations.
  const lastCelebrationRef = useRef(0);

  const onTapStation = useCallback(
    (stationId: string) => {
      const result = engine.tapStation(stationId);
      if (!result) return null;

      // Let a teammate react to the tap, but at most once per celebration so a
      // fast streak does not turn the room into a strobe. The rate limit is the
      // whole guard, which is why a plain tap still earns a reaction.
      const now = Date.now();
      if (now - lastCelebrationRef.current > 900) {
        lastCelebrationRef.current = now;
        const station = CLICK_STATIONS_BY_ID[stationId];
        const occupants = station ? employeesInRoom(stateRef.current, station.roomId) : [];
        const celebrator =
          occupants.find((id) => station?.synergy.includes(id)) ??
          occupants[0] ??
          (stateRef.current.employees.pip?.hired ? 'pip' : undefined);
        if (celebrator) {
          setCelebratingEmployee(celebrator);
          const celebrationGeneration = ++celebrationGenerationRef.current;
          scheduleLife(() => {
            if (celebrationGenerationRef.current !== celebrationGeneration) return;
            setCelebratingEmployee((current) => (current === celebrator ? null : current));
          }, 950);
        }
      }
      return result;
    },
    [engine, scheduleLife],
  );

  const playSfx = useCallback(
    (name: Parameters<typeof audio.play>[0], opts?: { pitch?: number }) => audio.play(name, opts),
    [audio],
  );

  const stationPreview = useCallback(
    (def: ClickStationDef) => {
      const value = previewClickValue(state, def.id, engine.combo, Date.now());
      const amount = def.resource === 'goldenNuts' ? fmt.num(value) : fmt.int(value);
      return def.resource === 'goldenNuts'
        ? t('station.tip.goldenAmount', { amount })
        : t('station.tip.nutAmount', { amount });
    },
    [engine, fmt, state, t],
  );

  const stationSynergyNames = useCallback(
    (def: ClickStationDef) =>
      synergyEmployees(state, def).map((id) => {
        const rt = state.employees[id];
        return rt?.nickname ?? t(EMPLOYEES_BY_ID[id]?.nameKey ?? id);
      }),
    [state, t],
  );

  // Never leave payout popups floating over the game after the scene goes away.
  useEffect(() => clearTapFeedback, []);

  // -- decoration arranging ---------------------------------------------------
  function toggleDecorMode() {
    setDecorMode((v) => {
      if (v) setSelected(null); // leaving arrange mode clears the picked item
      return !v;
    });
  }

  function selectDeco(id: string) {
    if (draggedRef.current) return; // suppress the click that follows a drag
    setSelected((prev) => (prev === id ? null : id));
    audio.play('click');
  }

  // -- drag & drop ------------------------------------------------------------
  // A unified pointer-drag for critters (assign to a room) and decorations
  // (place at the nearest anchor / stow). Distinguishes a tap (< threshold) from
  // a drag; a real drag suppresses the trailing click via draggedRef; Escape
  // cancels; the ghost follows the pointer.
  function roomUnderPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y);
    const floor = el?.closest('.floor[data-room]') as HTMLElement | null;
    return floor?.dataset.room ?? null;
  }

  function employeeTarget(
    x: number,
    y: number,
    id: string,
  ): { room: string | null; valid: boolean } {
    const room = roomUnderPoint(x, y);
    if (!room || !ROOMS_BY_ID[room]) return { room: null, valid: false };
    const already = resolveEmployeeRoom(stateRef.current, id) === room;
    const full = employeesInRoom(stateRef.current, room).length >= ROOM_CAP;
    return { room, valid: already || !full };
  }

  // The authored visual contact point maps the source grab offset to the exact
  // support point. The same value drives committed and ghost transforms.
  function grabAnchorRatio(id: string): number {
    return placementSpec(id).baseline;
  }

  // A single authoritative hit-test for EVERY category. The pointer resolves to
  // the compatible support region it is over (floor, wall, ceiling, tabletop,
  // shelf, or a room-specific special surface); the returned preview point is
  // exactly what a drop will commit, so nothing floats or teleports.
  function decorationTarget(
    x: number,
    y: number,
    id: string,
    grabOffset = { x: 0, y: 0 },
    preferKind?: PlacementRegionKind,
  ): { room: string | null; valid: boolean; preview?: DecorationDragPreview } {
    const room = roomUnderPoint(x, y);
    const def = DECORATIONS_BY_ID[id];
    if (!room || !def) return { room, valid: false };
    const roomValid =
      def.compatibleRooms.includes(room) && isRoomUnlocked(stateRef.current, ROOMS_BY_ID[room]);
    if (!roomValid) return { room, valid: false };

    const floorElement = document.querySelector<HTMLElement>(`.floor[data-room="${room}"]`);
    const stage = floorElement?.querySelector<HTMLElement>('.floor__stage');
    if (!stage) return { room, valid: false };

    const rect = stage.getBoundingClientRect();
    const anchorClientX = x - grabOffset.x;
    const anchorClientY = y - grabOffset.y;
    const rawPoint = {
      x: (anchorClientX - rect.left) / Math.max(1, rect.width),
      y: (rect.bottom - anchorClientY) / Math.max(1, rect.height),
    };
    const check = pointerRegionPlacement(stateRef.current, id, room, rawPoint, preferKind);
    if (!check) return { room, valid: false };
    const preview: DecorationDragPreview = {
      roomId: room,
      regionId: check.region.id,
      regionKind: check.region.kind,
      anchorMode: check.region.anchorMode,
      point: check.point,
      clientX: rect.left + check.point.x * rect.width,
      clientY: rect.bottom - check.point.y * rect.height,
      depth: check.depth,
      planeFootprint: check.planeFootprint,
      valid: check.ok,
      reasonKey: check.reasonKey,
    };
    return { room, valid: preview.valid, preview };
  }

  function armCancelledPointerRelease(pointerId: number) {
    pendingReleaseCleanupsRef.current.get(pointerId)?.();
    let finished = false;
    let releaseFinished = false;

    const clear = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('click', suppressClick, true);
      if (pendingReleaseCleanupsRef.current.get(pointerId) === clear) {
        pendingReleaseCleanupsRef.current.delete(pointerId);
      }
    };
    const suppressClick = (event: MouseEvent) => {
      // Chromium emits pointer-originated clicks as PointerEvents. Match the
      // cancelled pointer only, so a different touch/pen/mouse can keep using
      // the office even if the OS swallowed this stream's release forever.
      if (!(event instanceof PointerEvent) || event.pointerId !== pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clear();
    };
    const release = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      if (event.type === 'pointercancel') {
        clear();
        return;
      }
      if (releaseFinished) return;
      releaseFinished = true;
      // A native click follows pointerup before the next timer task. Keep the
      // pointer-specific capture guard for that click, then retire it if the
      // browser correctly suppresses the click itself.
      window.setTimeout(clear, 0);
    };

    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('click', suppressClick, true);
    pendingReleaseCleanupsRef.current.set(pointerId, clear);
  }

  function beginDrag(e: React.PointerEvent, kind: 'employee' | 'decoration', id: string) {
    if (e.button != null && e.button !== 0) return;
    if (kind === 'decoration' && !decorMode) return;
    if (kind === 'employee' && decorMode) return;

    // A second press must never strand the first pointer session.
    cancelActiveDragRef.current?.();
    pendingFocusRestoreRef.current = null;

    const source = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    // Pointer ids may be reused after an OS-swallowed release. A fresh press
    // with the same id proves that stale stream is over without disturbing
    // guards for other simultaneously active touch/pen pointers.
    pendingReleaseCleanupsRef.current.get(pointerId)?.();
    const start = { x: e.clientX, y: e.clientY };
    const room = kind === 'decoration' ? decorationRoom(stateRef.current, id) : null;
    const sourceRect = source.getBoundingClientRect();
    const anchorRatio = kind === 'decoration' ? grabAnchorRatio(id) : EMPLOYEE_DRAG_BASELINE_RATIO;
    // Tray thumbnails are drawn at a different scale than the in-scene prop, so
    // a baseline offset derived from the thumbnail would push the drop far off
    // the (often short) room stage. Dragging a stored item instead drops it
    // right under the cursor, which is both predictable and always on-surface.
    const fromTray = Boolean(source.closest('.deco-tray') || source.closest('.floor__tray'));
    const grabOffset =
      kind === 'decoration'
        ? {
            x: start.x - (sourceRect.left + sourceRect.width / 2),
            y: fromTray ? 0 : start.y - (sourceRect.top + sourceRect.height * anchorRatio),
          }
        : { x: 0, y: 0 };
    let lastPreview: DecorationDragPreview | undefined;
    let started = false;
    let cleaned = false;
    // Coalesce pointer moves to one recompute per animation frame so dragging
    // stays smooth (no redundant re-renders) and always renders the newest
    // pointer position — never a stale/delayed one.
    let rafId = 0;
    let latest: { x: number; y: number } | null = null;

    function applyMove(clientX: number, clientY: number) {
      if (kind === 'employee') {
        const target = employeeTarget(clientX, clientY, id);
        setDrag({
          kind,
          id,
          x: clientX,
          y: clientY,
          room,
          overRoom: target.room,
          valid: target.valid,
        });
        return;
      }
      // Bias toward the support already being targeted (hysteresis) so the
      // live preview does not flicker between overlapping compatible planes.
      const target = decorationTarget(clientX, clientY, id, grabOffset, lastPreview?.regionKind);
      if (target.preview) lastPreview = target.preview;
      const preview = target.preview
        ? target.preview
        : lastPreview
          ? { ...lastPreview, valid: false, reasonKey: 'decorate.reject.moveInside' }
          : undefined;
      setDrag({
        kind,
        id,
        x: preview?.clientX ?? clientX,
        y: preview?.clientY ?? clientY,
        room,
        overRoom: target.room,
        valid: Boolean(preview ? preview.valid && target.room === preview.roomId : target.valid),
        preview,
      });
    }

    function flush() {
      rafId = 0;
      if (!latest) return;
      applyMove(latest.x, latest.y);
    }

    function move(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      if (!started && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD)
        return;
      started = true;
      latest = { x: ev.clientX, y: ev.clientY };
      if (!rafId) rafId = requestAnimationFrame(flush);
    }

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancelPointer);
      window.removeEventListener('keydown', onKey);
      source.removeEventListener('lostpointercapture', lostCapture);
      if (cancelActiveDragRef.current === cancelSession) cancelActiveDragRef.current = null;
      try {
        if (source.hasPointerCapture(pointerId)) source.releasePointerCapture(pointerId);
      } catch {
        // Source may have unmounted during a room, popup, or focus transition.
      }
    }

    function cancelSession({
      restoreOnFocus = false,
      awaitRelease = true,
    }: CancelDragOptions = {}) {
      if (cleaned) return;
      // Cancellation never calls an engine mutation: the last committed room,
      // surface, interaction state and position remain authoritative.
      pendingFocusRestoreRef.current = restoreOnFocus ? source : null;
      cleanup();
      if (awaitRelease) armCancelledPointerRelease(pointerId);
      draggedRef.current = false;
      setDrag(null);
    }

    function cancelPointer(ev: PointerEvent) {
      if (ev.pointerId === pointerId) cancelSession({ awaitRelease: false });
    }

    function lostCapture(ev: PointerEvent) {
      if (ev.pointerId === pointerId) cancelSession();
    }

    function up(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      const decorationDrop =
        kind === 'decoration'
          ? decorationTarget(ev.clientX, ev.clientY, id, grabOffset, lastPreview?.regionKind)
          : undefined;
      cleanup();
      if (started) {
        if (kind === 'employee') finishEmployeeDrop(ev.clientX, ev.clientY, id);
        else finishDecorationDrop(ev.clientX, ev.clientY, id, decorationDrop);
        draggedRef.current = true;
        setTimeout(() => {
          draggedRef.current = false;
        }, 0);
      }
      setDrag(null);
    }

    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') cancelSession();
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancelPointer);
    window.addEventListener('keydown', onKey);
    source.addEventListener('lostpointercapture', lostCapture);
    cancelActiveDragRef.current = cancelSession;

    // Explicit capture keeps the stream alive while crossing stacked room
    // containers. If capture is lost for any reason, lostCapture rolls back the
    // provisional renderer state and removes the portal ghost.
    try {
      source.setPointerCapture(pointerId);
    } catch {
      // Synthetic/legacy implementations may not support capture; the window
      // listeners remain the fallback and blur/visibility still cancel safely.
    }
  }

  function finishEmployeeDrop(x: number, y: number, id: string) {
    const { room, valid } = employeeTarget(x, y, id);
    if (!room) return; // dropped outside any room — cancel
    if (resolveEmployeeRoom(stateRef.current, id) === room) return; // no change
    if (!valid) {
      // Room full: explain + suggest another unlocked room with space.
      const suggestion = unlockedRooms(stateRef.current).find(
        (r) => r.id !== room && employeesInRoom(stateRef.current, r.id).length < ROOM_CAP,
      );
      const roomName = t(ROOMS_BY_ID[room].nameKey);
      notify(
        'rooms',
        suggestion
          ? t('office.roomFullSuggest', { room: roomName, other: t(suggestion.nameKey) })
          : t('office.roomFull', { room: roomName }),
        'neutral',
      );
      audio.play('error');
      return;
    }
    if (engine.assignEmployee(id, room)) {
      // Moving the focused/hovered button unmounts it without a reliable blur or
      // pointerleave. Clear those DOM-owned signals so the remounted employee
      // cannot inherit a stale tap reaction in its destination room.
      setFocusedEmployee((current) => (current === id ? null : current));
      setHoveredEmployee((current) => (current === id ? null : current));
      audio.play('upgrade');
    }
  }

  function finishDecorationDrop(
    x: number,
    y: number,
    id: string,
    target?: ReturnType<typeof decorationTarget>,
  ) {
    const def = DECORATIONS_BY_ID[id];
    if (!def) return;
    const el = document.elementFromPoint(x, y);
    // Dropped on the inventory tray (bottom panel or a per-room actions bar) → stow it.
    if (el?.closest('.deco-tray') || el?.closest('.floor__tray')) {
      if (engine.removeDecoration(id)) audio.play('click');
      return;
    }

    // Every category commits the exact normalized region candidate shown during
    // the live preview — floor, wall, ceiling, tabletop, shelf, or a
    // room-specific special surface. No state mutates until a valid drop, and an
    // invalid release simply rolls back to the last committed placement.
    const preview = target?.preview;
    if (!preview || !target?.valid || preview.roomId !== target.room) {
      if (target?.room) {
        notify('rooms', t(preview?.reasonKey ?? 'decorate.reject.invalid'), 'neutral');
        audio.play('error');
      }
      return;
    }
    if (
      engine.moveDecorationToRoom(
        id,
        preview.roomId,
        preview.point.x,
        preview.point.y,
        preview.depth,
        preview.regionKind,
      )
    ) {
      audio.play('place');
      dustPuff(preview.clientX, preview.clientY);
      setJustPlaced(id);
      window.setTimeout(() => setJustPlaced((current) => (current === id ? null : current)), 320);
    }
  }

  function selectedRoom(): string | null {
    return selected ? decorationRoom(state, selected) : null;
  }

  function moveDecorationFromDialog(roomId: string | null): boolean {
    if (!moveDialog) return false;
    const moved =
      roomId === null
        ? engine.removeDecoration(moveDialog)
        : engine.placeDecorationInRoom(moveDialog, roomId);
    if (moved) {
      audio.play(roomId === null ? 'click' : 'place');
      setSelected(null);
    }
    return moved;
  }

  function sendSelectedToInventory() {
    if (selected && engine.removeDecoration(selected)) audio.play('click');
    setSelected(null);
  }

  const overGif = state.settings.background.enabled;
  return (
    <div
      className={`office ${decorMode ? 'office--decorating' : ''} ${overGif ? 'office--overgif' : ''} ${
        drag ? 'office--dragging' : ''
      }`}
      aria-label="office diorama"
      // The scene scale is published here so it cascades to every room, sprite,
      // fixture and decoration inside the diorama — and to nothing in the HUD.
      ref={sceneScopeRef}
    >
      <div className="office__toolbar">
        <button
          className={`chip-btn ${decorMode ? 'is-on' : ''}`}
          onClick={toggleDecorMode}
          aria-pressed={decorMode}
        >
          <Icon name="decorate" size={14} /> {t('office.decorate')}
        </button>
        {!decorMode ? <span className="office__toolbar-hint">{t('office.dragHint')}</span> : null}
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
        <path
          d="M16 20 C 12 70, 14 120, 12 180"
          stroke="#33261a"
          strokeWidth="1.4"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M84 20 C 88 70, 86 120, 88 180"
          stroke="#33261a"
          strokeWidth="1.4"
          fill="none"
          opacity="0.6"
        />
        {/* knots */}
        <ellipse cx="14" cy="60" rx="3" ry="5" fill="#2a2016" opacity="0.7" />
        <ellipse cx="87" cy="110" rx="3" ry="5" fill="#2a2016" opacity="0.7" />
        {/* roots at the base */}
        <path
          d="M14 196 c -6 -2 -8 -8 -12 -6 M86 196 c 6 -2 8 -8 12 -6"
          stroke="#241a12"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* moss */}
        <path
          d="M6 150 q4 6 10 4 M94 40 q-5 6 -10 3"
          stroke="#3f7d4f"
          strokeWidth="3"
          fill="none"
          opacity="0.5"
          strokeLinecap="round"
        />
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

        {rooms.map((room, roomIndex) => {
          const occupants = Object.entries(state.employees).filter(
            ([id, rt]) => rt.hired && resolveEmployeeRoom(state, id) === room.id,
          );
          const slots = characterSlots(occupants.length, room.id);
          const comfort = roomComfort(state, room.id);
          const placed = placedDecorationsInRoom(state, room.id);
          const canDropHere = decorMode && drag?.kind === 'decoration' && drag.overRoom === room.id;
          const selectedPlacedHere =
            selected !== null && selectedRoom() === room.id && isDecorationPlaced(state, selected);
          let dropClass = '';
          if (drag) {
            if (drag.kind === 'employee') {
              dropClass =
                drag.overRoom === room.id
                  ? drag.valid
                    ? 'is-drop-hover'
                    : 'is-drop-invalid'
                  : 'is-drop-target';
            } else if (drag.kind === 'decoration') {
              const compatible =
                DECORATIONS_BY_ID[drag.id]?.compatibleRooms.includes(room.id) ?? false;
              if (drag.overRoom === room.id) {
                dropClass = drag.valid ? 'is-deco-hover' : 'is-deco-invalid';
              } else if (compatible) {
                dropClass = 'is-deco-target';
              }
            }
          }
          return (
            <div
              className={`floor ${dropClass}`}
              key={room.id}
              data-room={room.id}
              // Every room is the same width, so the first one is measured and its
              // width drives the scale for the whole diorama.
              ref={roomIndex === 0 ? sceneMeasureRef : undefined}
              style={{ ['--dept' as string]: DEPT[room.id] ?? 'var(--dept-founder)' }}
            >
              <div className="floor__header">
                <span className="floor__label">{t(room.nameKey)}</span>
                <span className="floor__status">
                  {occupants.length > 0 ? (
                    <Tip
                      content={
                        <TipContent
                          title={t('overview.capacityTitle')}
                          lines={[t('overview.capacityTip'), `${occupants.length} / ${ROOM_CAP}`]}
                        />
                      }
                    >
                      <span className="floor__stat" tabIndex={0}>
                        <Icon name="employees" size={11} /> {occupants.length}
                      </span>
                    </Tip>
                  ) : null}
                  {comfort > 0 ? (
                    <Tip
                      content={
                        <TipContent
                          title={t('overview.comfortTitle')}
                          lines={[t('overview.comfortTip'), `+${comfort}`]}
                        />
                      }
                    >
                      <span className="floor__stat floor__stat--comfort" tabIndex={0}>
                        <Icon name="morale" size={11} /> +{comfort}
                      </span>
                    </Tip>
                  ) : null}
                </span>
              </div>
              <div
                className={`floor__ambient floor__ambient--${AMBIENT[room.id] ?? 'dust'}`}
                aria-hidden
              >
                {reducedMotion ? null : (
                  <>
                    <span className="floor__dust" />
                    <span className="floor__dust floor__dust--2" />
                    <span className="floor__dust floor__dust--3" />
                  </>
                )}
              </div>

              <div className={`floor__stage ${canDropHere ? 'floor__stage--dropping' : ''}`}>
                {/* built-in room identity (window, rug, department fixture) */}
                <RoomDressing roomId={room.id} />

                {/* placed decorations sit at their chosen normalized position,
                    layered by surface (wall behind, floor grounded, ceiling above) */}
                {placed.map(({ def, placement }) => (
                  <div
                    key={def.id}
                    data-deco={def.id}
                    data-region-kind={decorationInstance(state, def.id)?.regionKind ?? undefined}
                    data-anchor={placementSpec(def.id).anchor}
                    data-depth={decorationInstance(state, def.id)?.depth}
                    className={`floor__deco floor__deco--${placement.surface} ${decorationAnchorClass(def.id)} ${
                      isRug(def.id) ? 'floor__deco--rug' : ''
                    } ${selected === def.id ? 'is-selected' : ''} ${
                      drag?.kind === 'decoration' && drag.id === def.id ? 'is-dragging' : ''
                    } ${justPlaced === def.id ? 'is-placing' : ''}`}
                    style={{
                      ...decorationAnchorStyle(def.id),
                      left: `${placement.x * 100}%`,
                      bottom: `${placement.y * 100}%`,
                      // Depth comes from the shared scene bands, so a prop can
                      // never paint over a teammate (see sim/depth.ts). The
                      // arrange-mode lift is the one deliberate exception: the
                      // piece being placed must stay visible while dragging.
                      zIndex:
                        decorMode && selected === def.id
                          ? SCENE_DEPTH.arranging
                          : Math.min(
                              DECORATION_DEPTH_CEILING,
                              decorationInstance(state, def.id)?.depth ??
                                surfaceZ(def.id, placement.surface),
                            ),
                    }}
                  >
                    <DecorationProp
                      id={def.id}
                      reducedMotion={reducedMotion}
                      mode={decorMode ? 'toggle' : 'interact'}
                      selected={decorMode && selected === def.id}
                      reacting={!decorMode && reactingDeco === def.id}
                      title={t(`deco.${def.id}.name`)}
                      onToggle={() => selectDeco(def.id)}
                      onInteract={() => audio.play(interactSound(decorKind(def.id)))}
                      onPointerDown={
                        decorMode ? (e) => beginDrag(e, 'decoration', def.id) : undefined
                      }
                    />
                  </div>
                ))}

                {/* semantic region + live footprint/collision preview */}
                {drag?.kind === 'decoration' && drag.preview?.roomId === room.id ? (
                  <RegionGuide preview={drag.preview} />
                ) : canDropHere ? (
                  <div
                    className={`floor__surface-guide floor__surface-guide--${decorationSurface(drag.id)}`}
                    aria-hidden
                  />
                ) : null}

                {occupants.map(([id, rt], idx) => {
                  const def = EMPLOYEES_BY_ID[id];
                  const shape = shapeFor(id);
                  const sprite = employeeSprite(id);
                  const slot = slots[idx] ?? { x: 0.5, bottom: 0 };
                  // How far back this teammate stands, as a size cue. Without it a
                  // raised character reads as hovering rather than as distant.
                  const perspective = depthScale(slot.bottom);
                  const visiting = interaction?.employeeId === id;
                  const ex = visiting
                    ? slot.x * 0.55 + (interaction?.targetX ?? slot.x) * 0.45
                    : slot.x;
                  const interactedRecently =
                    recentEmployee === id || (visiting && interaction?.phase === 'interacting');
                  const inputs = {
                    hired: rt.hired,
                    producing,
                    moving:
                      (drag?.kind === 'employee' && drag.id === id) ||
                      (visiting && interaction?.phase === 'walking'),
                    lowMorale,
                    celebrating: celebratingEmployee === id,
                    focusMode,
                    interactedRecently,
                    // A click/keyboard activation or ambient interaction should be
                    // visible even while the control remains hovered or focused.
                    hovered:
                      !interactedRecently && (hoveredEmployee === id || focusedEmployee === id),
                  };
                  const anim: CritterState = machineFor(id).update(inputs, now);
                  const accent =
                    def?.outfits.find((o) => o.id === rt.outfitId)?.accent ??
                    def?.accent ??
                    '#3f7d4f';
                  const label = rt.nickname ?? t(def?.nameKey ?? id);
                  const mood = employeeMood(state, id);
                  const moodLabel = t(`mood.${mood}`);
                  return (
                    <button
                      key={id}
                      className={`critter-btn ${sprite ? 'critter-btn--sprite' : ''} ${
                        drag?.kind === 'employee' && drag.id === id ? 'is-dragging' : ''
                      } ${!decorMode ? 'is-draggable' : ''} ${visiting ? 'is-visiting' : ''}`}
                      style={{
                        left: `${ex * 100}%`,
                        // Slot depth is authored in scene pixels, so it scales with
                        // the scene. Without this the cast kept its spacing up the
                        // floor while the floor itself shrank, and characters at the
                        // back drifted off the top of a small room.
                        bottom: `calc(${slot.bottom}px * var(--asset-scale))`,
                        // Hang the mood bubble off the top of the HEAD. Sprite
                        // canvases carry between 0% and 11% dead headroom, so a
                        // single shared percentage sat a different distance above
                        // every animal.
                        ...(sprite
                          ? {
                              ['--bubble-anchor' as string]: `${((1 - sprite.figureTop) * 100).toFixed(1)}%`,
                            }
                          : null),
                        // Characters occupy the band above every decoration, and
                        // sort among themselves by how near the camera they
                        // stand, so the whole team stays readable.
                        zIndex: visiting ? SCENE_DEPTH.characterFocus : characterDepth(slot.bottom),
                      }}
                      onPointerDown={(e) => beginDrag(e, 'employee', id)}
                      onPointerEnter={() => setHoveredEmployee(id)}
                      onPointerLeave={() =>
                        setHoveredEmployee((current) => (current === id ? null : current))
                      }
                      onFocus={() => setFocusedEmployee(id)}
                      onBlur={() =>
                        setFocusedEmployee((current) => (current === id ? null : current))
                      }
                      onClick={() => onCritterClick(id)}
                      title={`${label} · ${moodLabel}`}
                      aria-label={`${label}, ${moodLabel}`}
                      // The reaction state lives on the BUTTON, not only on the
                      // vector critter's <svg>. The nine animals with photographic
                      // artwork have no <svg> to carry a class, so every hover,
                      // focus, celebration and panic reaction was silently doing
                      // nothing for them.
                      data-anim={anim}
                    >
                      {focusMode ? <span className="focus-hat" aria-hidden /> : null}
                      {sprite ? (
                        <EmployeeSprite
                          config={sprite}
                          reducedMotion={reducedMotion}
                          // Scaled by distance, not by character: a teammate at the
                          // front of the room is always exactly cast scale, and one
                          // standing further back is smaller because it is further
                          // back. Height only — EmployeeSprite derives width, so the
                          // aspect ratio is untouched.
                          height={Math.round(sprite.officeHeight * perspective)}
                        />
                      ) : (
                        <Critter
                          species={shape.species}
                          color={def?.color ?? '#c65b3c'}
                          accent={accent}
                          state={anim}
                          hasGlasses={shape.hasGlasses}
                          reducedMotion={reducedMotion}
                          // The vector fallback renders an <svg> at a raw pixel
                          // size, so unlike EmployeeSprite it cannot pick the scene
                          // scale up from CSS and has to be told. Without this the
                          // animals still awaiting artwork — the bear — would be the
                          // only ones that did not shrink with the room.
                          size={Math.round(VECTOR_CRITTER_OFFICE_SIZE * perspective * sceneScale)}
                          title={label}
                          seed={idx + room.floor}
                        />
                      )}
                      <EmployeeBubble
                        mood={mood}
                        color={MOOD_TONE[mood]}
                        label={moodLabel}
                        name={label}
                        speech={bubble?.employeeId === id ? bubble.text : null}
                      />
                    </button>
                  );
                })}
                {/* Every room has its own equipment to work. Stations are hidden
                    while arranging so a drag can never be eaten by a tap. */}
                {!decorMode
                  ? stationsInRoom(room.id).map((stationDef) => (
                      <ClickStation
                        key={stationDef.id}
                        def={stationDef}
                        onTap={onTapStation}
                        previewText={stationPreview(stationDef)}
                        synergyNames={stationSynergyNames(stationDef)}
                        play={playSfx}
                        formatAmount={fmt.int}
                      />
                    ))
                  : null}
              </div>

              {/* arrange-mode per-room actions (inventory lives in the bottom tray) */}
              {decorMode ? (
                <div className="floor__tray floor__tray--actions">
                  {selectedPlacedHere ? (
                    <>
                      <button
                        className="mini-btn mini-btn--primary"
                        onClick={() => setMoveDialog(selected)}
                      >
                        <Icon name="rooms" size={12} /> {t('decorate.moveTo')}
                      </button>
                      <button className="mini-btn" onClick={sendSelectedToInventory}>
                        <Icon name="close" size={12} /> {t('decorate.stow')}
                      </button>
                    </>
                  ) : null}
                  <button
                    className="mini-btn"
                    onClick={() => {
                      if (engine.resetRoomDecorations(room.id)) audio.play('upgrade');
                      else {
                        notify('rooms', t('decorate.resetFull'), 'neutral');
                        audio.play('error');
                      }
                      setSelected(null);
                    }}
                  >
                    <Icon name="refresh" size={12} /> {t('decorate.resetRoom')}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {decorMode ? (
        <DecorationTray
          state={state}
          reducedMotion={reducedMotion}
          selected={selected}
          onSelect={selectDeco}
          onBeginDrag={(e, id) => beginDrag(e, 'decoration', id)}
          onRequestMove={(id) => {
            setSelected(id);
            setMoveDialog(id);
          }}
          dragging={drag?.kind === 'decoration'}
        />
      ) : null}

      {moveDialog ? (
        <MoveDecorationModal
          state={state}
          decorationId={moveDialog}
          onMove={moveDecorationFromDialog}
          onDismiss={() => setMoveDialog(null)}
        />
      ) : null}

      <div className="office__floating" aria-hidden>
        <Acorn size={24} />
      </div>

      {drag && typeof document !== 'undefined'
        ? createPortal(
            <div
              className={`drag-ghost ${drag.kind === 'decoration' ? 'drag-ghost--decoration' : ''} ${
                drag.valid ? 'is-ok' : 'is-no'
              } ${ghostAnchorClass(drag)}`}
              style={{
                left: `${drag.x}px`,
                top: `${drag.y}px`,
                ...(drag.kind === 'decoration' ? decorationAnchorStyle(drag.id) : {}),
              }}
              data-region={drag.preview?.regionId}
              data-region-kind={drag.preview?.regionKind}
              data-anchor={drag.kind === 'decoration' ? placementSpec(drag.id).anchor : undefined}
              data-valid={drag.valid}
              aria-hidden
            >
              {drag.kind === 'employee' ? (
                <GhostCritter id={drag.id} reducedMotion={reducedMotion} />
              ) : (
                <>
                  <DecorationProp
                    id={drag.id}
                    reducedMotion
                    mode="interact"
                    title={t(`deco.${drag.id}.name`)}
                  />
                  <span className="drag-ghost__surface">
                    <Icon name={drag.valid ? 'success' : 'close'} size={10} />
                    {t(`decorate.surface.${ghostSurfaceLabel(drag)}`)}
                  </span>
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
