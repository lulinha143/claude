import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { availableFacilityDiscoveries } from '../sim/facilityDiscoveries';
import { useGameUnlessCovered } from '../state/hooks';
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
import { steadyMood, stickerTilt } from './EmotionSticker';
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
import { SceneControls } from './SceneControls';
import { TreeBranches, TreeCanopy, TreeRoots } from './TreeWorld';
import {
  placedDecorationsInRoom,
  isDecorationPlaced,
  decorationRoom,
  decorationInstance,
  roomComfort,
} from '../sim/decorations';
import { decorationSurface, decorationZ, decorationDepthKind, isRug } from '../sim/surfaces';
import {
  SCENE_DEPTH,
  characterDepth,
  decorationLayerAdjustable,
  decorationSide,
} from '../sim/depth';
import { pointerRegionPlacement } from '../sim/placement';
import { placementRegionById } from '../content/roomSurfaces';
import { type PlacementAnchorMode, type PlacementRegionKind } from '../sim/placementRegions';
import { characterSlots, depthScale } from '../content/roomLayout';
import type { DecorationLayer } from '../sim/types';
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
import { FOCUS_FLOOR_EVENT } from '../ui/officeEvents';
import { ROOM_PROFILES_BY_ID, type RoomTemper } from '../content/roomProfiles';
import type { SfxName } from '../audio/audio';

/** The ground floor of the tower, where a new company opens. */
const FOUNDER_FLOOR = 'founder-desk';

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

// What a drag looks like to the WHOLE office: which piece, over which room, and
// whether a drop would be accepted. Only this coarse state is React state, and it
// is only replaced when one of these values changes, so the tower re-renders a
// handful of times per drag rather than once per pointer move.
interface DragState {
  kind: 'employee' | 'decoration';
  id: string;
  room: string | null; // for decorations: the source room; employees: null
  overRoom: string | null;
  valid: boolean;
  previewRoomId?: string;
  regionId?: string;
  regionKind?: PlacementRegionKind;
}

function sameDrag(a: DragState | null, b: DragState): boolean {
  return Boolean(
    a &&
    a.kind === b.kind &&
    a.id === b.id &&
    a.room === b.room &&
    a.overRoom === b.overRoom &&
    a.valid === b.valid &&
    a.previewRoomId === b.previewRoomId &&
    a.regionId === b.regionId &&
    a.regionKind === b.regionKind,
  );
}

// The per-frame part of a drag (the pointer, and the exact landing preview) lives
// in this tiny external store. Only the ghost and the landing guide subscribe, so
// following the pointer re-renders two small components and nothing else.
interface DragLive {
  x: number;
  y: number;
  preview?: DecorationDragPreview;
}
let dragLive: DragLive | null = null;
const dragLiveListeners = new Set<() => void>();
function setDragLive(next: DragLive | null): void {
  dragLive = next;
  dragLiveListeners.forEach((listener) => listener());
}
function subscribeDragLive(listener: () => void): () => void {
  dragLiveListeners.add(listener);
  return () => dragLiveListeners.delete(listener);
}
function useDragLive(): DragLive | null {
  return useSyncExternalStore(
    subscribeDragLive,
    () => dragLive,
    () => null,
  );
}

/**
 * The pieces under a point, topmost first (the real paint order), so a click
 * can hand the selection down through a stack of overlapping decorations.
 */
function decorationStackAt(x: number, y: number): string[] {
  const ids: string[] = [];
  for (const element of document.elementsFromPoint(x, y)) {
    const id = (element.closest('.floor__deco') as HTMLElement | null)?.dataset.deco;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
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
// Each kind of room answers in its own small sound when the elevator arrives
// (a page turn at the desks, a cup in the social rooms, glassware in the labs, a
// heavy thunk on the industrial floors, a coin in the secure ones, a click from
// the rooms nobody puts in the brochure).
const ROOM_TONE: Record<RoomTemper, { sfx: SfxName; pitch: number }> = {
  operational: { sfx: 'paper', pitch: 1 },
  social: { sfx: 'coffee', pitch: 1.06 },
  analytical: { sfx: 'chime', pitch: 1.26 },
  industrial: { sfx: 'place', pitch: 0.78 },
  secure: { sfx: 'collect', pitch: 0.88 },
  irregular: { sfx: 'toggle', pitch: 0.74 },
};

/** A teammate's own pitch, so a poke sounds like that particular animal. */
function voicePitch(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i += 1) h = (h * 33 + id.charCodeAt(i)) | 0;
  return [0.82, 0.9, 1, 1.1, 1.2][Math.abs(h) % 5];
}

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

/**
 * Front/back for the picked piece, offered only where it means something: wall
 * and floor pieces (a rug is always underfoot, a ceiling lamp always overhead).
 * The label says what pressing it will do, in plain words.
 */
function LayerToggle({
  id,
  surface,
  layer,
  onChange,
}: {
  id: string;
  surface: 'floor' | 'wall' | 'ceiling';
  layer?: DecorationLayer;
  onChange: (layer: DecorationLayer) => void;
}) {
  const { t } = useTranslation();
  const kind = decorationDepthKind(id, surface);
  if (!decorationLayerAdjustable(kind)) return null;
  const side = decorationSide(kind, layer);
  const target: DecorationLayer = side === 'front' ? 'back' : 'front';
  const tip = t(target === 'back' ? 'decorate.layerBackTip' : 'decorate.layerFrontTip');
  return (
    <button
      className="mini-btn deco-layer-btn"
      data-layer={side}
      data-layer-target={target}
      title={tip}
      aria-label={tip}
      onClick={() => onChange(target)}
    >
      <Icon name={target === 'back' ? 'layerBack' : 'layerFront'} size={12} />{' '}
      {t(target === 'back' ? 'decorate.layerBack' : 'decorate.layerFront')}
    </button>
  );
}

/** The landing guide for the room under the pointer, fed by the live drag store. */
function LiveRegionGuide({ roomId }: { roomId: string }) {
  const live = useDragLive();
  if (!live?.preview || live.preview.roomId !== roomId) return null;
  return <RegionGuide preview={live.preview} />;
}

/**
 * The piece in the player's hand. Drawn at exactly the size it has in the room
 * (the scene scale is handed over explicitly: the ghost is portalled to the body,
 * outside the office that publishes it) and moved 1:1 with the pointer.
 */
function DragGhost({
  drag,
  sceneScale,
  reducedMotion,
  title,
}: {
  drag: DragState;
  sceneScale: number;
  reducedMotion: boolean;
  title: string;
}) {
  const live = useDragLive();
  if (!live || typeof document === 'undefined') return null;
  const x = live.preview?.clientX ?? live.x;
  const y = live.preview?.clientY ?? live.y;
  return createPortal(
    <div
      className={`drag-ghost ${drag.kind === 'decoration' ? 'drag-ghost--decoration' : ''} ${
        drag.valid ? 'is-ok' : 'is-no'
      } ${ghostAnchorClass(drag)}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        ['--asset-scale' as string]: String(sceneScale),
        ...(drag.kind === 'decoration' ? decorationAnchorStyle(drag.id) : {}),
      }}
      data-region={live.preview?.regionId}
      data-region-kind={live.preview?.regionKind}
      data-anchor={drag.kind === 'decoration' ? placementSpec(drag.id).anchor : undefined}
      data-valid={drag.valid}
      aria-hidden
    >
      {drag.kind === 'employee' ? (
        <GhostCritter id={drag.id} reducedMotion={reducedMotion} />
      ) : (
        <DecorationProp id={drag.id} reducedMotion mode="interact" title={title} />
      )}
    </div>,
    document.body,
  );
}

// The ghost and committed item consume the same authored baseline. Surface
// selection decides where the support point is; item metadata decides which
// visual contact point (base, mount, or suspension) sits on it.
function ghostAnchorClass(drag: DragState): string {
  if (drag.kind !== 'decoration' || !drag.previewRoomId) return 'drag-ghost--pointer-anchor';
  return `drag-ghost--anchored ${decorationAnchorClass(drag.id)}`;
}

// i18n suffix naming the surface being targeted (Floor / Wall / Ceiling).

// Persistent per-employee state machines (kept across renders).
const machines: Record<string, CritterStateMachine> = {};
function machineFor(id: string): CritterStateMachine {
  if (!machines[id]) machines[id] = new CritterStateMachine();
  return machines[id];
}

/**
 * The office. It never unmounts (every other screen opens over it), so while it
 * is fully covered — a minigame in play, a visit, or a full-window sheet — it
 * stops following sim ticks and catches up the moment it is uncovered. Memoised
 * so the shell re-rendering around it does not drag the whole tower along.
 */
export const OfficeScene = memo(function OfficeScene({ covered = false }: { covered?: boolean }) {
  const { t } = useTranslation();
  const { engine, state } = useGameUnlessCovered(covered);
  const audio = useStore((s) => s.audio);
  const requestActivity = useStore((s) => s.requestActivity);
  const reducedMotion = state.settings.reducedMotion;
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const fmt = useFmt();
  const discoveries = availableFacilityDiscoveries(state);
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
  // -- the tower's scroll position ---------------------------------------------
  // The office is a vertical tree trunk of floors inside one scroller. It opens on
  // the player's home floor (the Founder's Desk, or the floor they last looked at)
  // instead of the rooftop, keeps that floor centred while the window is resized
  // or the scene scale settles, and remembers it for the next session.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentFloorRef = useRef<string | null>(null);
  const [currentFloor, setCurrentFloor] = useState<string | null>(null);
  const scrollToFloor = useCallback(
    (roomId: string, behavior: ScrollBehavior = 'auto') => {
      const scroller = scrollerRef.current;
      const floor = scroller?.querySelector<HTMLElement>(`.floor[data-room="${roomId}"]`);
      if (!scroller || !floor) return;
      const top =
        floor.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      const centred = top - Math.max(8, (scroller.clientHeight - floor.offsetHeight) / 2);
      currentFloorRef.current = roomId;
      setCurrentFloor(roomId);
      engine.rememberOfficeFloor(roomId);
      scroller.scrollTo({ top: Math.max(0, centred), behavior });
    },
    [engine],
  );
  const decorationRequest = useStore((s) => s.decorationRequest);
  const arrangeDecoration = useStore((s) => s.arrangeDecoration);
  const [decorMode, setDecorMode] = useState(Boolean(decorationRequest));
  // The decoration currently picked up for arranging (its id), or null.
  const [selected, setSelected] = useState<string | null>(decorationRequest);
  // The office never unmounts any more (sheets open over it), so an "Arrange in
  // office" request can arrive at any time — not only at mount. Consume each one:
  // enter arrange mode, pick the item, bring its floor into view, then clear it.
  useEffect(() => {
    if (!decorationRequest) return undefined;
    setDecorMode(true);
    setSelected(decorationRequest);
    const room =
      decorationRoom(state, decorationRequest) ?? DECORATIONS_BY_ID[decorationRequest]?.room;
    const timer = window.setTimeout(() => {
      if (room) scrollToFloor(room, reducedMotion ? 'auto' : 'smooth');
      arrangeDecoration(null);
    }, 60);
    return () => window.clearTimeout(timer);
    // Game ticks must not re-run this; only a new request does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decorationRequest]);
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
  // Floors scrolled out of sight stop their ambient motion (the stylesheet keys
  // off data-onscreen), so a tall company costs no more than the floors in view.
  const floorKey = rooms.map((room) => room.id).join(',');
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          (entry.target as HTMLElement).dataset.onscreen = String(entry.isIntersecting);
        }
      },
      { root: scroller, rootMargin: '60px 0px' },
    );
    scroller.querySelectorAll('.floor[data-room]').forEach((floor) => observer.observe(floor));
    return () => observer.disconnect();
  }, [floorKey]);
  const producing = engine.productionPerSecond() > 0;
  const focusMode = engine.isFocusActive();
  const lowMorale = state.resources.morale < 35;

  // Open on the home floor, and keep the current floor centred whenever the
  // scene scale settles, the window is resized or a new floor is built on top.
  const roomIds = rooms.map((room) => room.id).join('|');
  useLayoutEffect(() => {
    const ids = roomIds.split('|');
    const saved = engine.state.settings.officeFloor;
    const current = currentFloorRef.current;
    const home =
      current && ids.includes(current)
        ? current
        : saved && ids.includes(saved)
          ? saved
          : ids.includes(FOUNDER_FLOOR)
            ? FOUNDER_FLOOR
            : ids[ids.length - 1];
    if (home) scrollToFloor(home);
  }, [sceneScale, roomIds, scrollToFloor, engine]);

  // Track the floor nearest the middle of the view (for the elevator and for the
  // next session), and re-centre it when the scroller changes size.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const box = scroller.getBoundingClientRect();
      const middle = box.top + scroller.clientHeight / 2;
      let best: string | null = null;
      let bestDistance = Infinity;
      const floors = [...scroller.querySelectorAll<HTMLElement>('.floor[data-room]')];
      floors.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = element.dataset.room ?? null;
        }
      });
      // The floors at either end of the tower can never reach the middle of the
      // view (the ground floor sits on the roots), so at either end of the scroll
      // the floor the player is looking at is the end-most one fully in view.
      const max = scroller.scrollHeight - scroller.clientHeight;
      const atBottom = max > 0 && scroller.scrollTop >= max - 2;
      const atTop = scroller.scrollTop <= 2;
      if (atBottom || atTop) {
        const inView = floors.filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.top >= box.top - 1 && rect.bottom <= box.top + scroller.clientHeight + 1;
        });
        const end = atBottom ? inView[inView.length - 1] : inView[0];
        if (end?.dataset.room) best = end.dataset.room;
      }
      if (best && best !== currentFloorRef.current) {
        currentFloorRef.current = best;
        setCurrentFloor(best);
        engine.rememberOfficeFloor(best);
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    // Only a change of HEIGHT moves the floors relative to the view. A side sheet
    // opening narrows the scroller without changing any floor's offset, and
    // re-centring then would nudge the player's own scroll position. (A change of
    // scene scale re-centres through the layout effect above.)
    let lastHeight = scroller.clientHeight;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            const height = scroller.clientHeight;
            if (Math.abs(height - lastHeight) < 2) return;
            lastHeight = height;
            if (currentFloorRef.current) scrollToFloor(currentFloorRef.current);
          });
    observer?.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [engine, scrollToFloor]);

  // Other parts of the game (the next-step note, discoveries) can ask for a floor.
  useEffect(() => {
    const onFocusFloor = (event: Event) => {
      const roomId = (event as CustomEvent<{ roomId?: string }>).detail?.roomId;
      if (roomId) scrollToFloor(roomId, reducedMotion ? 'auto' : 'smooth');
    };
    window.addEventListener(FOCUS_FLOOR_EVENT, onFocusFloor);
    return () => window.removeEventListener(FOCUS_FLOOR_EVENT, onFocusFloor);
  }, [scrollToFloor, reducedMotion]);

  // The elevator's floor list closes on any press outside it, or Escape.
  const [floorsOpen, setFloorsOpen] = useState(false);
  useEffect(() => {
    if (!floorsOpen) return undefined;
    const onDown = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest('.elevator')) setFloorsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFloorsOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [floorsOpen]);

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
      const fallback = document.querySelector<HTMLElement>('.scene-controls button, .dock__item');
      // A drag can start on a whole tray card (a plain container): hand focus to the
      // card's own control, since focusing the container itself silently fails.
      const FOCUSABLE =
        'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])';
      const control = preferred.matches(FOCUSABLE)
        ? preferred
        : preferred.querySelector<HTMLElement>(FOCUSABLE);
      const target = preferred.isConnected && control ? control : fallback;
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

  // Ambient life only runs while someone can see it.
  useEffect(() => {
    if (covered) return undefined;
    const h = setInterval(ambientChatter, 11000);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [covered]);

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
    const room = resolveEmployeeRoom(state, employeeId);
    if (
      ['broadcast', 'repair', 'conservatory'].includes(room) &&
      state.resources.morale > 45 &&
      Math.random() < 0.4
    ) {
      const reaction =
        state.flags[`annex.${room}.kept`] !== undefined
          ? 'keptQuip'
          : state.flags[`discovery.${room}`] !== undefined
            ? 'afterQuip'
            : 'roomQuip';
      setBubble({
        employeeId,
        text: t(`annex.${room}.${reaction}`),
        until: Date.now() + 4000,
      });
      return;
    }
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
      audio.play('click', { pitch: voicePitch('pip') });
      // Petting the founder is its own interaction, but she still notices a
      // company-wide mood or a bad assignment before falling back to it.
      const voice = chooseVoice(state, 'pip');
      speak('pip', voice.reason === 'personal' ? 'interaction' : voice.category);
    } else {
      // Everyone else comments on what is actually happening to them: the company
      // mood, or the department they have been put in.
      speak(employeeId, chooseVoice(state, employeeId).category);
      audio.play('footstep', { pitch: voicePitch(employeeId) });
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

  /**
   * Pick a piece up (or put it down). A click lands on the topmost piece under the
   * pointer; clicking the picked piece again where others overlap it hands the
   * pick to the next one down, in paint order, so a piece buried under another is
   * always one or two clicks away. A piece on its own toggles. Keyboard
   * activation always means the focused piece itself.
   */
  function selectDeco(id: string, point?: { x: number; y: number }) {
    if (draggedRef.current) return; // suppress the click that follows a drag
    const stack = point ? decorationStackAt(point.x, point.y) : [];
    setSelected((prev) => {
      if (!point || stack.length === 0) return prev === id ? null : id;
      if (prev && stack.includes(prev)) {
        if (stack.length === 1) return null;
        return stack[(stack.indexOf(prev) + 1) % stack.length];
      }
      return stack[0];
    });
    audio.play('click');
  }

  /** The piece a press on `id` should move: the picked piece if it is under the pointer. */
  function decorationToDrag(e: React.PointerEvent, id: string): string {
    if (!selected || selected === id) return id;
    return decorationStackAt(e.clientX, e.clientY).includes(selected) ? selected : id;
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

  function beginDrag(
    e: React.PointerEvent,
    kind: 'employee' | 'decoration',
    id: string,
    sourceOverride?: HTMLElement | null,
  ) {
    if (e.button != null && e.button !== 0) return;
    if (kind === 'decoration' && !decorMode) return;
    if (kind === 'employee' && decorMode) return;
    e.preventDefault();
    window.getSelection()?.removeAllRanges();

    // A second press must never strand the first pointer session.
    cancelActiveDragRef.current?.();
    pendingFocusRestoreRef.current = null;

    const source = sourceOverride ?? (e.currentTarget as HTMLElement);
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
        setDragLive({ x: clientX, y: clientY });
        const next: DragState = { kind, id, room, overRoom: target.room, valid: target.valid };
        setDrag((prev) => (sameDrag(prev, next) ? prev : next));
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
      setDragLive({ x: clientX, y: clientY, preview });
      const next: DragState = {
        kind,
        id,
        room,
        overRoom: target.room,
        valid: Boolean(preview ? preview.valid && target.room === preview.roomId : target.valid),
        previewRoomId: preview?.roomId,
        regionId: preview?.regionId,
        regionKind: preview?.regionKind,
      };
      setDrag((prev) => (sameDrag(prev, next) ? prev : next));
    }

    function flush() {
      rafId = 0;
      if (!latest) return;
      applyMove(latest.x, latest.y);
    }

    // Hold a piece (or a teammate) near the top or bottom edge of the tower view
    // and the building scrolls the other floors to you — the only way to reach a
    // floor that is out of sight in a corner window. Faster the closer to the edge;
    // nothing happens over the HUD, the dock or the storage strip.
    let scrollRafId = 0;
    function edgeScroll() {
      scrollRafId = 0;
      const scroller = scrollerRef.current;
      if (!scroller || !latest || cleaned) return;
      const box = scroller.getBoundingClientRect();
      const zone = Math.min(56, box.height * 0.2);
      const y = latest.y;
      let dy = 0;
      if (y >= box.top && y < box.top + zone) dy = -Math.ceil(((box.top + zone - y) / zone) * 14);
      else if (y <= box.bottom && y > box.bottom - zone)
        dy = Math.ceil(((y - (box.bottom - zone)) / zone) * 14);
      if (dy === 0) return;
      const before = scroller.scrollTop;
      scroller.scrollTop = before + dy;
      if (scroller.scrollTop !== before) {
        applyMove(latest.x, latest.y);
        scrollRafId = requestAnimationFrame(edgeScroll);
      }
    }

    function move(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      if (!started && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD)
        return;
      started = true;
      latest = { x: ev.clientX, y: ev.clientY };
      if (!rafId) rafId = requestAnimationFrame(flush);
      if (!scrollRafId) scrollRafId = requestAnimationFrame(edgeScroll);
    }

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
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
      // A drag that had begun never turns into a click on whatever is under the
      // pointer when the button finally comes up (a release the OS swallowed, or
      // a cancelled stream whose mouse is still down). The next deliberate press
      // or key starts clean.
      draggedRef.current = started;
      if (started) {
        const reset = () => {
          draggedRef.current = false;
          window.removeEventListener('pointerdown', reset, true);
          window.removeEventListener('keydown', reset, true);
        };
        window.addEventListener('pointerdown', reset, true);
        window.addEventListener('keydown', reset, true);
      }
      setDrag(null);
      setDragLive(null);
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
      setDragLive(null);
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

  /**
   * Tap-to-place: with a piece picked (on a floor or in the tray), a tap on an
   * empty spot of a room puts it there, exactly as a drop at that point would.
   */
  function placePickedAt(event: React.MouseEvent<HTMLElement>) {
    if (!decorMode || !selected || draggedRef.current) return;
    const hit = event.target as HTMLElement;
    if (hit.closest('.floor__deco, .critter-btn, .station-btn, button')) return;
    const target = decorationTarget(event.clientX, event.clientY, selected);
    const preview = target.preview;
    if (!preview || !target.valid || preview.roomId !== target.room) {
      if (target.room) {
        notify('rooms', t(preview?.reasonKey ?? 'decorate.reject.invalid'), 'neutral');
        audio.play('error');
      }
      return;
    }
    if (
      engine.moveDecorationToRoom(
        selected,
        preview.roomId,
        preview.point.x,
        preview.point.y,
        preview.depth,
        preview.regionKind,
      )
    ) {
      audio.play('place');
      dustPuff(preview.clientX, preview.clientY);
      const id = selected;
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

  return (
    <div
      className={`office ${decorMode ? 'office--decorating' : ''} ${
        drag ? 'office--dragging' : ''
      }`}
      aria-label="office diorama"
      // The scene scale is published here so it cascades to every room, sprite,
      // fixture and decoration inside the diorama — and to nothing in the HUD.
      ref={sceneScopeRef}
    >
      {/* The world behind the tree: a fixed sky that the trunk scrolls in front of.
          On a companion-sized window it is only a sliver at the bark's edges; on
          a big window it becomes the landscape around the company. */}
      <div className="office__view">
        <div className="office__sky" aria-hidden>
          <span className="office__cloud office__cloud--1" />
          <span className="office__cloud office__cloud--2" />
          <span className="office__cloud office__cloud--3" />
          <span className="office__hills" />
        </div>

        <div className="office__world" ref={scrollerRef} data-testid="office-world">
          <div className="office__tower">
            <TreeBranches />
            <TreeCanopy />
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
                const canDropHere =
                  decorMode && drag?.kind === 'decoration' && drag.overRoom === room.id;
                const selectedPlacedHere =
                  selected !== null &&
                  selectedRoom() === room.id &&
                  isDecorationPlaced(state, selected);
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
                      {!decorMode && ['broadcast', 'repair', 'conservatory'].includes(room.id) ? (
                        <button
                          className="floor__activity"
                          onClick={() =>
                            requestActivity(
                              room.id === 'broadcast'
                                ? 'cableUntangle'
                                : room.id === 'repair'
                                  ? 'bugSquash'
                                  : 'coffeeRescue',
                            )
                          }
                        >
                          {t(`annex.${room.id}.activity`)}
                        </button>
                      ) : null}
                      {!decorMode && occupants.length > 0 ? (
                        <div className="floor__people">
                          {occupants.map(([id, rt]) => (
                            <button
                              key={id}
                              onClick={() => {
                                if (engine.openTalk(id, undefined, true)) audio.play('paper');
                              }}
                            >
                              {rt.nickname ?? t(EMPLOYEES_BY_ID[id].nameKey)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {!decorMode &&
                      discoveries.some((discovery) => discovery.roomId === room.id) ? (
                        <button
                          className="floor__discovery"
                          onClick={() => {
                            const discovery = discoveries.find((entry) => entry.roomId === room.id);
                            if (discovery && engine.inspectFacility(discovery.id))
                              audio.play('paper');
                          }}
                        >
                          {t('discovery.inspect')}
                        </button>
                      ) : null}
                      <span className="floor__status">
                        {occupants.length > 0 ? (
                          <Tip
                            content={
                              <TipContent
                                title={t('overview.capacityTitle')}
                                lines={[
                                  t('overview.capacityTip'),
                                  `${occupants.length} / ${ROOM_CAP}`,
                                ]}
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

                    <div
                      className={`floor__stage ${canDropHere ? 'floor__stage--dropping' : ''}`}
                      onClick={decorMode ? placePickedAt : undefined}
                    >
                      {/* built-in room identity (window, rug, department fixture) */}
                      <RoomDressing roomId={room.id} />

                      {/* placed decorations sit at their chosen normalized position,
                    layered by surface (wall behind, floor grounded, ceiling above) */}
                      {placed.map(({ def, placement }) => (
                        <div
                          key={def.id}
                          data-deco={def.id}
                          data-region-kind={
                            decorationInstance(state, def.id)?.regionKind ?? undefined
                          }
                          data-anchor={placementSpec(def.id).anchor}
                          data-depth={decorationInstance(state, def.id)?.depth}
                          data-layer={decorationSide(
                            decorationDepthKind(def.id, placement.surface),
                            decorationInstance(state, def.id)?.layer,
                          )}
                          className={`floor__deco floor__deco--${placement.surface} ${decorationAnchorClass(def.id)} ${
                            isRug(def.id) ? 'floor__deco--rug' : ''
                          } ${selected === def.id ? 'is-selected' : ''} ${
                            drag?.kind === 'decoration' && drag.id === def.id ? 'is-dragging' : ''
                          } ${justPlaced === def.id ? 'is-placing' : ''}`}
                          style={{
                            ...decorationAnchorStyle(def.id),
                            left: `${placement.x * 100}%`,
                            bottom: `${placement.y * 100}%`,
                            // Its side of the team (wall art and rugs behind, floor
                            // furniture in front, unless the player swapped it), then
                            // its nearness on its surface. A picked-up piece keeps its
                            // place in the room, so front/back is visible while chosen.
                            zIndex: decorationZ(
                              def.id,
                              placement.surface,
                              decorationInstance(state, def.id)?.depth,
                              decorationInstance(state, def.id)?.layer,
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
                            onToggle={(event) =>
                              selectDeco(
                                def.id,
                                event && event.detail > 0
                                  ? { x: event.clientX, y: event.clientY }
                                  : undefined,
                              )
                            }
                            onInteract={() => audio.play(interactSound(decorKind(def.id)))}
                            onPointerDown={
                              decorMode
                                ? (e) => {
                                    const pick = decorationToDrag(e, def.id);
                                    beginDrag(
                                      e,
                                      'decoration',
                                      pick,
                                      pick === def.id
                                        ? null
                                        : document.querySelector<HTMLElement>(
                                            `.floor__deco[data-deco="${pick}"] .decor`,
                                          ),
                                    );
                                  }
                                : undefined
                            }
                          />
                        </div>
                      ))}

                      {/* semantic region + live footprint/collision preview */}
                      {drag?.kind === 'decoration' && drag.previewRoomId === room.id ? (
                        <LiveRegionGuide roomId={room.id} />
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
                          recentEmployee === id ||
                          (visiting && interaction?.phase === 'interacting');
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
                            !interactedRecently &&
                            (hoveredEmployee === id || focusedEmployee === id),
                        };
                        const anim: CritterState = machineFor(id).update(inputs, now);
                        const accent =
                          def?.outfits.find((o) => o.id === rt.outfitId)?.accent ??
                          def?.accent ??
                          '#3f7d4f';
                        const label = rt.nickname ?? t(def?.nameKey ?? id);
                        // What they feel, held steady on screen (a threshold never
                        // makes a sticker flicker); an event's emotion shows at once.
                        const eventEmotion = Boolean(
                          rt.emotion && (rt.emotion.until === null || rt.emotion.until > now),
                        );
                        const mood = steadyMood(
                          id,
                          employeeMood(state, id, now),
                          now,
                          eventEmotion,
                        );
                        const moodLabel = t(`mood.${mood}`);
                        // The sticker sits just above the top of the head: the sprite's
                        // own measured headroom and baseline, in scene pixels.
                        const stickerBottom = sprite
                          ? `calc((${slot.bottom}px + ${(
                              sprite.officeHeight *
                              perspective *
                              Math.max(0.3, 1 - sprite.figureTop - Math.max(0, sprite.baseline))
                            ).toFixed(1)}px) * var(--asset-scale) + 2px)`
                          : `calc(${slot.bottom}px * var(--asset-scale) + ${Math.round(
                              VECTOR_CRITTER_OFFICE_SIZE * perspective * sceneScale * 0.92,
                            )}px)`;
                        const carried = drag?.kind === 'employee' && drag.id === id;
                        return (
                          <Fragment key={id}>
                            <button
                              data-employee={id}
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
                                zIndex: visiting
                                  ? SCENE_DEPTH.characterFocus
                                  : characterDepth(slot.bottom),
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
                                  size={Math.round(
                                    VECTOR_CRITTER_OFFICE_SIZE * perspective * sceneScale,
                                  )}
                                  title={label}
                                  seed={idx + room.floor}
                                />
                              )}
                            </button>
                            <EmployeeBubble
                              employeeId={id}
                              mood={mood}
                              color={MOOD_TONE[mood]}
                              label={moodLabel}
                              name={label}
                              tilt={stickerTilt(id)}
                              speech={bubble?.employeeId === id ? bubble.text : null}
                              className={`${carried ? 'is-carried' : ''} ${visiting ? 'is-visiting' : ''}`}
                              style={{
                                left: `${ex * 100}%`,
                                bottom: stickerBottom,
                                zIndex: SCENE_DEPTH.sticker,
                              }}
                            />
                          </Fragment>
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
                            {selected ? (
                              <LayerToggle
                                id={selected}
                                surface={
                                  decorationInstance(state, selected)?.surfaceType ??
                                  decorationSurface(selected)
                                }
                                layer={decorationInstance(state, selected)?.layer}
                                onChange={(layer) => {
                                  if (engine.setDecorationLayer(selected, layer)) {
                                    audio.play('place');
                                  }
                                }}
                              />
                            ) : null}
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
            <TreeRoots />
          </div>
        </div>

        <SceneControls
          rooms={rooms}
          currentFloor={currentFloor}
          floorsOpen={floorsOpen}
          setFloorsOpen={setFloorsOpen}
          onGo={(roomId) => {
            scrollToFloor(roomId, reducedMotion ? 'auto' : 'smooth');
            const tone = ROOM_TONE[ROOM_PROFILES_BY_ID[roomId]?.temper ?? 'operational'];
            audio.play(tone.sfx, { pitch: tone.pitch });
          }}
          decorMode={decorMode}
          onToggleDecor={toggleDecorMode}
          canUndo={engine.canUndoDecoration()}
          canRedo={engine.canRedoDecoration()}
          onUndo={() => engine.undoDecoration()}
          onRedo={() => engine.redoDecoration()}
          hint={null}
          occupancy={(roomId) =>
            Object.entries(state.employees).filter(
              ([id, rt]) => rt.hired && resolveEmployeeRoom(state, id) === roomId,
            ).length
          }
        />
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
          hint={selected ? t('decorate.pickedHint') : t('office.decorateHint')}
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

      {drag ? (
        <DragGhost
          drag={drag}
          sceneScale={sceneScale}
          reducedMotion={reducedMotion}
          title={drag.kind === 'decoration' ? t(`deco.${drag.id}.name`) : ''}
        />
      ) : null}
    </div>
  );
});
