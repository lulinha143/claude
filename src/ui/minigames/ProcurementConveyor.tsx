import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  procurementSequence,
  procurementResolve,
  procurementScoreDelta,
  PROCUREMENT_DEPTS,
  type ProcurementDept,
  type ProcurementPackage,
  type ProcurementResult,
} from '../../sim/minigames';
import type { SubGameProps } from './MicroGame';

const PACKAGE_COUNT = 26;

// Procurement Conveyor (Logistics department micro-game).
// Parcels arrive on the intake belt; the player DRAGS the front parcel onto the
// correct department chute. Departments are distinguished by icon + shape +
// label (never colour alone). Sideways parcels must be rotated (R / the rotate
// button) before they fit. Fragile parcels reward careful, correct handling.
//
// Controls, redundantly, for accessibility:
//   • Mouse / touch: drag the parcel onto a chute (pointer events → touch too).
//   • Keyboard: 1–4 route the parcel to a department, R rotates it.
//   • The chutes are real buttons, so clicking one also routes the parcel.
// Reduced Motion removes the belt slide, the drag ghost animation and shakes.
export function ProcurementConveyor({ seed, reducedMotion, onScore, onEnd }: SubGameProps) {
  const { t } = useTranslation();
  const packages = useMemo(() => procurementSequence(seed, PACKAGE_COUNT), [seed]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [upright, setUpright] = useState(true);
  const [hoverDept, setHoverDept] = useState<ProcurementDept | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [flash, setFlash] = useState<{ dept: ProcurementDept; result: ProcurementResult } | null>(null);
  const [nudge, setNudge] = useState(false); // "rotate me first" cue on the parcel

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const endedRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const binRefs = useRef(new Map<ProcurementDept, HTMLButtonElement>());

  const current: ProcurementPackage | undefined = packages[index];

  // When a new parcel reaches the front, reset its orientation: sideways parcels
  // start rotated and must be turned upright; the rest are already upright.
  useEffect(() => {
    setUpright(current ? !current.sideways : true);
  }, [index, current]);

  // End exactly once when the belt empties (never inside a state updater).
  useEffect(() => {
    if (!endedRef.current && packages.length > 0 && index >= packages.length) {
      endedRef.current = true;
      onEnd(scoreRef.current);
    }
  }, [index, packages.length, onEnd]);

  // Clean up transient timers on unmount (no setState after unmount).
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    },
    [],
  );

  const rotate = useCallback(() => {
    setUpright((u) => !u);
  }, []);

  const flashBin = useCallback(
    (dept: ProcurementDept, result: ProcurementResult) => {
      setFlash({ dept, result });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (!reducedMotion) flashTimer.current = setTimeout(() => setFlash(null), 260);
      else setFlash(null);
    },
    [reducedMotion],
  );

  const route = useCallback(
    (dept: ProcurementDept) => {
      const pkg = packages[index];
      if (!pkg) return;
      const result = procurementResolve(pkg, dept, upright);
      flashBin(dept, result);

      if (result === 'notUpright') {
        // Doesn't fit yet — gentle cue, no penalty, stay on this parcel.
        setNudge(true);
        if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
        nudgeTimer.current = setTimeout(() => setNudge(false), 500);
        return;
      }

      if (result === 'correct') {
        const nextCombo = comboRef.current + 1;
        comboRef.current = nextCombo;
        setCombo(nextCombo);
        scoreRef.current += procurementScoreDelta(result, nextCombo, pkg);
        setScore(scoreRef.current);
        onScore(scoreRef.current);
      } else {
        // wrong department: reset the combo, but still advance so the belt keeps
        // moving (gentle — never a soft-lock).
        comboRef.current = 0;
        setCombo(0);
      }
      setIndex((i) => i + 1);
    },
    [index, packages, upright, flashBin, onScore],
  );

  // --- keyboard controls (1–4 route, R rotates) ---------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        rotate();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= PROCUREMENT_DEPTS.length) route(PROCUREMENT_DEPTS[n - 1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [route, rotate]);

  // --- pointer drag -------------------------------------------------------
  const deptAtPoint = useCallback((x: number, y: number): ProcurementDept | null => {
    for (const [dept, el] of binRefs.current.entries()) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return dept;
    }
    return null;
  }, []);

  const onPointerDownParcel = useCallback(
    (e: React.PointerEvent) => {
      if (!current) return;
      e.preventDefault();
      setDragPos({ x: e.clientX, y: e.clientY });

      const move = (ev: PointerEvent) => {
        setDragPos({ x: ev.clientX, y: ev.clientY });
        setHoverDept(deptAtPoint(ev.clientX, ev.clientY));
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const dept = deptAtPoint(ev.clientX, ev.clientY);
        setDragPos(null);
        setHoverDept(null);
        if (dept) route(dept);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [current, deptAtPoint, route],
  );

  const upcoming = packages.slice(index + 1, index + 4);
  const remaining = Math.max(0, packages.length - index);

  return (
    <div className={`proc ${reducedMotion ? 'is-reduced' : ''}`}>
      <div className="proc__hud">
        <span>{t('microgame.score', { value: score })}</span>
        <span className={combo >= 3 ? 'proc__combo is-hot' : 'proc__combo'}>
          {t('microgame.combo', { value: combo })}
        </span>
        <span>{remaining}</span>
      </div>

      <div className="proc__belt" role="group" aria-label={t('microgame.procurement.name')}>
        <div className="proc__queue" aria-hidden>
          {upcoming.map((p, i) => (
            <span key={`${p.id}-${i}`} className="proc__queue-item">
              <PackageGlyph pkg={p} upright size={26} />
            </span>
          ))}
        </div>
        <div className="proc__stage">
          {current ? (
            <button
              type="button"
              className={`proc__parcel ${!upright ? 'is-sideways' : ''} ${nudge ? 'is-nudge' : ''} ${
                dragPos ? 'is-dragging' : ''
              }`}
              onPointerDown={onPointerDownParcel}
              aria-label={t('microgame.procurement.parcelFor', {
                dept: t(`microgame.procurement.dept.${current.dept}`),
              })}
            >
              <PackageGlyph pkg={current} upright={upright} size={72} label />
            </button>
          ) : null}
        </div>
        {current ? (
          <button type="button" className="ghost-btn proc__rotate" onClick={rotate}>
            <RotateGlyph /> {t('microgame.procurement.rotate')} <kbd>R</kbd>
          </button>
        ) : null}
      </div>

      <p className="proc__hint muted small">
        {current?.sideways && !upright
          ? t('microgame.procurement.rotateHint')
          : t('microgame.procurement.dragHint')}
      </p>

      <div className="proc__chutes">
        {PROCUREMENT_DEPTS.map((dept, i) => {
          const isFlash = flash?.dept === dept;
          const cls = [
            'bin',
            `bin--${dept}`,
            hoverDept === dept ? 'is-hover' : '',
            isFlash && flash?.result === 'correct' ? 'is-good' : '',
            isFlash && flash?.result === 'wrongDept' ? 'is-bad' : '',
            isFlash && flash?.result === 'notUpright' ? 'is-nofit' : '',
          ].join(' ');
          return (
            <button
              key={dept}
              type="button"
              ref={(el) => {
                if (el) binRefs.current.set(dept, el);
                else binRefs.current.delete(dept);
              }}
              className={cls}
              onClick={() => route(dept)}
              disabled={!current}
              aria-label={t(`microgame.procurement.dept.${dept}`)}
            >
              <span className={`bin__pattern bin__pattern--${DEPT_PATTERN[dept]}`} aria-hidden />
              <DeptGlyph dept={dept} size={28} />
              <span className="bin__label">{t(`microgame.procurement.dept.${dept}`)}</span>
              <kbd>{i + 1}</kbd>
            </button>
          );
        })}
      </div>

      {dragPos ? (
        <div className="proc__ghost" style={{ left: dragPos.x, top: dragPos.y }} aria-hidden>
          {current ? <PackageGlyph pkg={current} upright={upright} size={64} /> : null}
        </div>
      ) : null}
    </div>
  );
}

const DEPT_PATTERN: Record<ProcurementDept, string> = {
  harvest: 'dots',
  roasting: 'rays',
  logistics: 'stripes',
  research: 'grid',
};

// A cardboard parcel stamped with the destination department's icon. When it
// arrives sideways it is drawn rotated (and cannot be filed until rotated back).
// A fragile parcel shows a small "glass" care mark.
function PackageGlyph({
  pkg,
  upright,
  size,
  label,
}: {
  pkg: ProcurementPackage;
  upright: boolean;
  size: number;
  label?: boolean;
}) {
  const { t } = useTranslation();
  const rot = upright ? 0 : -90;
  return (
    <span
      className="proc__box"
      style={{ transform: `rotate(${rot}deg)` }}
      aria-label={label ? t(`microgame.procurement.dept.${pkg.dept}`) : undefined}
    >
      <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-hidden>
        <rect x="7" y="10" width="34" height="30" rx="3" fill="#c9954e" stroke="#5e3f1f" strokeWidth="2" />
        <path d="M7 20 h34" stroke="#5e3f1f" strokeWidth="1.5" opacity="0.5" />
        <path d="M24 10 v30" stroke="#5e3f1f" strokeWidth="1.5" opacity="0.35" />
        {/* packing-tape strip across the top flap */}
        <rect x="18" y="8" width="12" height="6" rx="1" fill="#efe0bd" stroke="#5e3f1f" strokeWidth="1" />
      </svg>
      <span className="proc__box-icon" aria-hidden>
        <DeptGlyph dept={pkg.dept} size={size * 0.42} />
      </span>
      {pkg.fragile ? (
        <span className="proc__fragile" title={t('microgame.procurement.fragile')} aria-hidden>
          <FragileGlyph />
        </span>
      ) : null}
    </span>
  );
}

function DeptGlyph({ dept, size = 28 }: { dept: ProcurementDept; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 32 32', 'aria-hidden': true } as const;
  const stroke = '#2a2016';
  switch (dept) {
    case 'harvest': // leaf
      return (
        <svg {...common}>
          <path d="M6 26 C6 12 20 6 26 6 C26 20 18 26 6 26 Z" fill="#5a9a68" stroke={stroke} strokeWidth="1.6" />
          <path d="M9 24 C14 18 20 12 24 9" stroke={stroke} strokeWidth="1.4" fill="none" />
        </svg>
      );
    case 'roasting': // flame
      return (
        <svg {...common}>
          <path
            d="M16 4 C20 11 24 12 24 19 a8 8 0 0 1 -16 0 C8 14 12 13 14 9 C15 12 17 12 16 4 Z"
            fill="#d98436"
            stroke={stroke}
            strokeWidth="1.6"
          />
        </svg>
      );
    case 'logistics': // forward arrow (shipping)
      return (
        <svg {...common}>
          <path d="M5 16 h16" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          <path d="M18 9 l9 7 -9 7 Z" fill="#6f7fb0" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case 'research': // flask
      return (
        <svg {...common}>
          <path d="M13 5 h6 v8 l6 12 a2 2 0 0 1 -2 3 H9 a2 2 0 0 1 -2 -3 l6 -12 Z" fill="#8f78c0" stroke={stroke} strokeWidth="1.6" />
          <path d="M11 5 h10" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}

function FragileGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden>
      <path d="M4 2 h8 l-1 4 -3 2 -3 -2 Z" fill="#e7d6a8" stroke="#5e3f1f" strokeWidth="1" />
      <path d="M8 8 v4 M6 13 h4" stroke="#5e3f1f" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function RotateGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden>
      <path d="M13 8 a5 5 0 1 1 -1.7 -3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 2 v3 h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
