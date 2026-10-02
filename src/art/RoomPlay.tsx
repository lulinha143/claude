import { useEffect, useRef, type CSSProperties } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Glyph, type GlyphName } from './Glyph';
import { Icon } from './UiIcon';
import { Tip, TipContent } from '../ui/Tooltip';
import { formatClock } from '../sim/format';
import type { ClickStationDef } from '../content/clickStations';
import { NUTS_BY_ID } from '../content/nuts';
import {
  ODDITIES_BY_ID,
  ROOM_ROUTINES,
  type OddityAnchor,
  type OddityDef,
  type RoutineKind,
} from '../content/roomPlay';
import type { RoutineView } from '../sim/roomPlay';
import type { RoomPayout, RoomPlayResult } from '../sim/engine';

// The office side of room play: the routine chip that sits on each station, the
// curiosity that turns up at a wall fixture or in a corner, and the paper slip
// that says what just happened. Everything here is small on purpose: the room
// and the people in it tell the story, these only point at it.

const KIND_GLYPH: Record<RoutineKind, GlyphName> = {
  brew: 'cup',
  tend: 'wrench',
  watch: 'eye',
  deliver: 'parcel',
  tune: 'dial',
};

/** Where in the room (0..1 across) each anchor sits, for slips that come from it. */
export const ANCHOR_X: Record<OddityAnchor, number> = {
  wall: 0.14,
  wallRight: 0.86,
  corner: 0.1,
  ceiling: 0.5,
};

function side(x: number): 'left' | 'right' | 'center' {
  return x < 0.3 ? 'left' : x > 0.7 ? 'right' : 'center';
}

/** The routine's own name and what it does, plus who helps and how. */
function routineTip(
  view: RoutineView,
  t: TFunction,
  nameOf: (employeeId: string) => string,
  extra: string | null,
) {
  const lines: Array<string | null> = [t(`play.${view.roomId}.tip`)];
  if (extra) lines.push(extra);
  if (view.helpers.length > 0) {
    const names = view.helpers
      .map((helper) =>
        helper.reason === 'set'
          ? t('play.helpers.set', { name: t(`ensemble.${helper.id}.name`) })
          : t(`play.helpers.${helper.reason}`, { name: nameOf(helper.id) }),
      )
      .join(', ');
    lines.push(t('play.helpers.title', { names }));
    if (view.kind !== 'tune') lines.push(t(`play.helpers.${view.kind}`));
  } else if (view.kind !== 'tune') {
    lines.push(t(`play.helpers.none.${view.kind}`));
  }
  if (view.done > 0) lines.push(t('play.doneCount', { count: view.done }));
  return <TipContent title={t(`play.${view.roomId}.name`)} lines={lines} />;
}

/**
 * The station's routine, as a small tag on top of the machine. Only shows when
 * there is something to see: a brew to start or to share, a stuck machine, a
 * blip, a parcel, the room's mode.
 */
export function RoutineChip({
  view,
  station,
  nameOf,
  onAct,
  now,
}: {
  view: RoutineView;
  station: ClickStationDef;
  nameOf: (employeeId: string) => string;
  onAct: (view: RoutineView, element: HTMLElement) => void;
  now: number;
}) {
  const { t } = useTranslation();
  const room = view.roomId;
  let label: string;
  let tone: 'start' | 'running' | 'ready' | 'alert' | 'mode' | 'muted';
  let actionable = true;
  let extra: string | null = null;
  let detail: JSX.Element | null = null;

  switch (view.status) {
    case 'quiet':
      return null;
    case 'idle':
      label = t(`play.${room}.start`);
      tone = 'start';
      break;
    case 'running':
      label = formatClock(view.remaining ?? 0);
      tone = 'running';
      actionable = false;
      extra = t('play.readyIn', { time: formatClock(view.remaining ?? 0) });
      break;
    case 'ready':
      label = t(`play.${room}.ready`);
      tone = 'ready';
      break;
    case 'jammed': {
      label = t(`play.${room}.problem`);
      tone = 'alert';
      const left = Math.max(0, (view.needed ?? 3) - (view.taps ?? 0));
      extra = t('play.tendLeft', { count: left });
      detail = (
        <span className="play-chip__pips" aria-hidden>
          {Array.from({ length: view.needed ?? 3 }, (_, i) => (
            <i key={i} className={i < (view.taps ?? 0) ? 'is-on' : ''} />
          ))}
        </span>
      );
      break;
    }
    case 'blip': {
      label = t(`play.${room}.blip`);
      tone = 'alert';
      const left = Math.max(0, ((view.until ?? now) - now) / 1000);
      detail = (
        <span
          key={view.until}
          className="play-chip__drain"
          style={{
            animationDuration: `${left.toFixed(2)}s`,
            ['--drain-from' as string]: (left / Math.max(1, view.window ?? left)).toFixed(3),
          }}
          aria-hidden
        />
      );
      break;
    }
    case 'parcel':
      label =
        view.parcelFor && view.parcelFor !== ''
          ? t('play.parcelFor', { name: nameOf(view.parcelFor) })
          : t(`play.${room}.order`);
      tone = 'ready';
      break;
    case 'mode':
    case 'needsSomeone': {
      if (view.kind === 'tune') {
        label = view.mode ? t(`play.${room}.mode.${view.mode}.name`) : t(`play.${room}.off`);
        tone = view.status === 'needsSomeone' ? 'muted' : view.mode ? 'mode' : 'start';
        extra = view.mode ? t(`play.${room}.mode.${view.mode}.effect`) : t('play.tuneFirst');
        if (view.status === 'needsSomeone') extra = `${extra} ${t('play.tuneNeedsSomeone')}`;
      } else {
        label = t('play.needsSomeone');
        tone = 'muted';
        actionable = false;
      }
      break;
    }
  }

  const style: CSSProperties = {
    left: `${station.x * 100}%`,
    // Just above the machine (stations are drawn 81 scene pixels tall).
    bottom: `calc(${station.bottom + 80}px * var(--asset-scale))`,
    ['--p' as string]: (view.progress ?? 0).toFixed(3),
  };
  const content = (
    <>
      <span className="play-chip__icon" aria-hidden>
        {view.status === 'running' ? <span className="play-chip__ring" /> : null}
        <Glyph name={KIND_GLYPH[view.kind]} size={11} />
      </span>
      <span className="play-chip__label">{label}</span>
      {detail}
    </>
  );
  const common = {
    className: `play-chip play-chip--${view.kind} is-${tone}`,
    'data-room': room,
    'data-kind': view.kind,
    'data-status': view.status,
    'data-side': side(station.x),
    style,
  };
  return (
    <Tip content={routineTip(view, t, nameOf, extra)}>
      {actionable ? (
        <button
          type="button"
          {...common}
          aria-label={`${t(`play.${room}.name`)}: ${label}`}
          onClick={(event) => onAct(view, event.currentTarget)}
        >
          {content}
        </button>
      ) : (
        <span {...common} role="status" aria-label={`${t(`play.${room}.name`)}: ${label}`}>
          {content}
        </span>
      )}
    </Tip>
  );
}

/** A curiosity waiting at its spot in the room. */
export function OddityMarker({
  def,
  onNotice,
}: {
  def: OddityDef;
  onNotice: (def: OddityDef, element: HTMLElement) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="office-oddity"
      data-anchor={def.anchor ?? 'corner'}
      data-kind={def.kind}
      data-oddity={def.id}
      aria-label={t('play.oddity.look')}
      title={t('play.oddity.look')}
      onClick={(event) => onNotice(def, event.currentTarget)}
    >
      <Glyph name="lens" size={13} />
    </button>
  );
}

/** A facility room's secret, standing out in the room once the player has noticed enough. */
export function DiscoveryMarker({ onInspect }: { onInspect: (element: HTMLElement) => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="office-oddity office-oddity--discovery floor__discovery"
      data-anchor="wall"
      aria-label={t('discovery.inspect')}
      title={t('play.oddity.discovery')}
      onClick={(event) => onInspect(event.currentTarget)}
    >
      <Glyph name="sparkle" size={13} />
      <span className="office-oddity__label">{t('discovery.inspect')}</span>
    </button>
  );
}

export interface SlipData {
  /** bumps for each new slip, so the same text twice still re-animates. */
  key: number;
  roomId: string;
  x: number;
  /** where it comes from: the station, or a curiosity's spot. */
  anchor: OddityAnchor | 'station';
  tone: 'play' | 'oddity' | 'nut';
  label: string | null;
  title: string;
  text: string;
  payout: RoomPayout | null;
  complete: string | null;
}

/** What a result says on its slip (null: nothing worth a slip). */
export function slipFor(
  result: RoomPlayResult,
  t: TFunction,
  nameOf: (employeeId: string) => string,
  station: ClickStationDef | undefined,
  key: number,
): SlipData | null {
  const room = result.roomId;
  const spot =
    result.kind === 'oddity' && result.oddityId ? ODDITIES_BY_ID[result.oddityId]?.anchor : null;
  const base = {
    key,
    roomId: room,
    x: spot ? ANCHOR_X[spot] : (station?.x ?? 0.5),
    anchor: spot ?? ('station' as const),
    payout: result.payout,
  };
  const complete = result.roomComplete ? t('play.oddity.complete') : null;
  if (result.oddityId) {
    const def = ODDITIES_BY_ID[result.oddityId];
    const nut = def?.nutId ? NUTS_BY_ID[def.nutId] : undefined;
    return {
      ...base,
      tone: nut ? 'nut' : 'oddity',
      label: nut ? t('play.oddity.nut') : t('play.oddity.new'),
      title: nut ? t(nut.nameKey) : t(`oddity.${result.oddityId}.title`),
      text: t(`oddity.${result.oddityId}.found`),
      complete,
    };
  }
  const title = t(`play.${room}.name`);
  switch (result.kind) {
    case 'brew':
      return {
        ...base,
        tone: 'play',
        label: null,
        title,
        text: t(`play.${room}.done.${result.outcome}`),
        complete,
      };
    case 'tend':
      return result.outcome === 'selfFixed'
        ? null
        : { ...base, tone: 'play', label: null, title, text: t(`play.${room}.fixed`), complete };
    case 'watch':
      return {
        ...base,
        tone: 'play',
        label: null,
        title,
        text: t(`play.${room}.caught`),
        complete,
      };
    case 'deliver':
      return {
        ...base,
        tone: 'play',
        label: null,
        title,
        text: t(`play.${room}.delivered`, {
          name: result.recipient ? nameOf(result.recipient) : '',
        }),
        complete,
      };
    case 'tune':
      return {
        ...base,
        tone: 'play',
        label: null,
        title: t('play.modeNow', { mode: t(`play.${room}.mode.${result.outcome}.name`) }),
        text: t(`play.${room}.mode.${result.outcome}.effect`),
        payout: null,
        complete: null,
      };
    case 'oddity':
      return null;
  }
}

/** The line the room's speaker says about what just happened (null: nobody says anything). */
export function speechFor(result: RoomPlayResult, pick: () => number): string | null {
  if (!result.speaker) return null;
  if (result.oddityId) {
    const def = ODDITIES_BY_ID[result.oddityId];
    return def ? `play.react.${def.tone}.${pick() < 0.5 ? 1 : 2}` : null;
  }
  switch (result.kind) {
    case 'brew':
    case 'watch':
      return `play.${result.roomId}.say`;
    case 'tend':
      return result.outcome === 'selfFixed'
        ? `play.${result.roomId}.selfFix`
        : `play.${result.roomId}.say`;
    case 'deliver':
      return result.recipient ? `play.parcel.${result.recipient}` : `play.${result.roomId}.say`;
    case 'tune':
      return `play.${result.roomId}.mode.${result.outcome}.react`;
    case 'oddity':
      return null;
  }
}

/** Whether a room has a routine at all (all of them do; locked rooms show nothing). */
export function hasRoutine(roomId: string): boolean {
  return Boolean(ROOM_ROUTINES[roomId]);
}

/** How long a slip stays: long enough to read a curiosity, brief for a routine. */
export function slipSeconds(slip: Pick<SlipData, 'tone'>): number {
  return slip.tone === 'play' ? 4.2 : 7;
}

/** The slip: a little paper note saying what just happened, gone after a few seconds. */
export function OfficeSlip({
  slip,
  onClose,
  formatAmount,
  reducedMotion,
}: {
  slip: SlipData;
  onClose: () => void;
  formatAmount: (value: number) => string;
  reducedMotion: boolean;
}) {
  const { t } = useTranslation();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const timer = window.setTimeout(() => closeRef.current(), slipSeconds(slip) * 1000);
    return () => window.clearTimeout(timer);
  }, [slip]);
  const payout = slip.payout;
  const tags: JSX.Element[] = [];
  if (payout) {
    if (payout.nuts > 0) {
      tags.push(
        <span key="nuts" className="office-slip__tag">
          <Icon name="nut" size={10} />+{formatAmount(payout.nuts)}
        </span>,
      );
    }
    if (payout.golden > 0) {
      tags.push(
        <span key="golden" className="office-slip__tag is-golden">
          <Icon name="golden" size={10} />+{payout.golden}
        </span>,
      );
    }
    if (payout.morale > 0) {
      tags.push(
        <span key="morale" className="office-slip__tag">
          <Icon name="morale" size={10} />+{Math.round(payout.morale)}
        </span>,
      );
    }
    if (payout.reputation > 0) {
      tags.push(
        <span key="rep" className="office-slip__tag">
          <Icon name="reputation" size={10} />+{Math.round(payout.reputation)}
        </span>,
      );
    }
    if (payout.boost) {
      tags.push(
        <span key="boost" className="office-slip__tag">
          <Icon name="production" size={10} />
          {t('play.payout.boost', {
            value: payout.boost.value,
            time: formatClock(payout.boost.seconds),
          })}
        </span>,
      );
    }
    if (payout.rush) {
      tags.push(
        <span key="rush" className="office-slip__tag is-rush">
          {t('play.payout.rush', { seconds: payout.rush })}
        </span>,
      );
    }
  }
  return (
    <div
      key={slip.key}
      className={`office-slip office-slip--${slip.tone} ${reducedMotion ? '' : 'is-animated'}`}
      data-side={side(slip.x)}
      data-anchor={slip.anchor}
      data-room={slip.roomId}
      style={side(slip.x) === 'center' ? { left: `${slip.x * 100}%` } : undefined}
      role="status"
      aria-live="polite"
      onClick={onClose}
    >
      {slip.label ? <small className="office-slip__label">{slip.label}</small> : null}
      <strong className="office-slip__title">{slip.title}</strong>
      <span className="office-slip__text">{slip.text}</span>
      {tags.length ? <span className="office-slip__tags">{tags}</span> : null}
      {slip.complete ? <em className="office-slip__complete">{slip.complete}</em> : null}
    </div>
  );
}
