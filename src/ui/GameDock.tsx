// The dock: five destinations along the bottom of the window.
//
// It replaces an eleven-tab filing rail. The office is not a destination at all —
// it is the game, always on screen — so the dock only opens things over it:
//
//   Team · Upgrades · Decorate · Activities · Archive      (Settings: the HUD gear)
//
// The Archive gathers the five "records" pages (Company, Collections,
// Achievements, Stats, Prestige) behind one door with tabs inside its sheet.
// Pressing the open destination again closes its sheet and returns to the office,
// exactly where the player left it.
//
// The recommended next step is no longer a full-width banner: the destination it
// points at gets a small acorn dot, and a paper note pops out above the dock for
// a few seconds when a new suggestion appears (NextStepHint).

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore, type ViewId } from '../state/store';
import { Icon, type IconName } from '../art/UiIcon';
import { Tip, TipContent } from './Tooltip';
import { computeNextStep, type NextStep } from '../sim/nextStep';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { availableFacilityDiscoveries } from '../sim/facilityDiscoveries';
import { focusFloor } from './officeEvents';

export const ARCHIVE_VIEWS: readonly ViewId[] = [
  'company',
  'collections',
  'achievements',
  'stats',
  'prestige',
];

export type DockId = 'team' | 'upgrades' | 'decorate' | 'activities' | 'archive';

interface DockItem {
  id: DockId;
  icon: IconName;
  views: readonly ViewId[];
  /** The view a press opens. The Archive reopens the page last read. */
  open: ViewId;
}

const DOCK_ITEMS: readonly DockItem[] = [
  { id: 'team', icon: 'employees', views: ['employees'], open: 'employees' },
  { id: 'upgrades', icon: 'shop', views: ['shop'], open: 'shop' },
  { id: 'decorate', icon: 'decorate', views: ['decorate'], open: 'decorate' },
  { id: 'activities', icon: 'focus', views: ['focus'], open: 'focus' },
  { id: 'archive', icon: 'company', views: ARCHIVE_VIEWS, open: 'company' },
];

/** Which dock destination a view lives behind (null = the office itself). */
export function dockFor(view: string): DockId | null {
  return DOCK_ITEMS.find((item) => item.views.includes(view as ViewId))?.id ?? null;
}

let lastArchiveView: ViewId = 'company';
export function rememberArchiveView(view: ViewId): void {
  if (ARCHIVE_VIEWS.includes(view)) lastArchiveView = view;
}

/** The single "what next?" suggestion, shared by the dock dot and the note. */
export function useNextStep(): NextStep | null {
  const { state } = useGame();
  if (!state.settings.showHints) return null;
  return computeNextStep(state);
}

export function GameDock() {
  const { t } = useTranslation();
  const { engine } = useGame();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const talkOpen = Boolean(engine.activeTalk);
  const step = useNextStep();
  const hinted = step ? dockFor(step.view) : null;

  function press(item: DockItem) {
    const active = !talkOpen && item.views.includes(view);
    engine.closeTalk();
    if (active) {
      setView('office');
      return;
    }
    setView(item.id === 'archive' ? lastArchiveView : item.open);
  }

  return (
    <nav className="dock" aria-label={t('nav.mainNavigation')}>
      <div className="dock__shelf">
        {DOCK_ITEMS.map((item) => {
          const active = !talkOpen && item.views.includes(view);
          const label = t(`dock.${item.id}`);
          return (
            <Tip
              key={item.id}
              content={
                <TipContent
                  title={label}
                  lines={[
                    t(`dock.tip.${item.id}`),
                    hinted === item.id && step ? stepText(t, step) : null,
                  ]}
                  titleAriaHidden
                />
              }
            >
              <button
                type="button"
                className={`dock__item nav__destination ${active ? 'is-active' : ''}`}
                data-dock={item.id}
                data-view={item.open}
                aria-pressed={active}
                aria-label={label}
                onClick={() => press(item)}
              >
                <span className="dock__icon" aria-hidden>
                  <Icon name={item.icon} size={20} />
                </span>
                <span className="dock__label" aria-hidden>
                  {label}
                </span>
                {hinted === item.id ? <span className="dock__dot" aria-hidden /> : null}
              </button>
            </Tip>
          );
        })}
      </div>
    </nav>
  );
}

function stepText(t: (key: string, options?: Record<string, unknown>) => string, step: NextStep) {
  const name = step.employeeId ? t(EMPLOYEES_BY_ID[step.employeeId]?.nameKey ?? '') : '';
  return t(`nextStep.${step.key}`, { name });
}

const HINT_VISIBLE_MS = 9000;

/**
 * A paper note that pops out above the dock when a NEW suggestion appears, then
 * tucks itself away (the dock dot stays). Clicking it goes there.
 */
export function NextStepHint() {
  const { t } = useTranslation();
  const { state, engine } = useGame();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const opening = useStore((s) => s.showOpening || s.showOnboarding);
  const step = useNextStep();
  const stepId = step ? `${step.key}:${step.employeeId ?? ''}` : null;
  const [visibleFor, setVisibleFor] = useState<string | null>(null);

  // Pop out once per NEW suggestion, then tuck away. (Keyed on the suggestion
  // only, so a re-render cannot restart or cancel the timer.)
  useEffect(() => {
    if (!stepId || opening) return undefined;
    setVisibleFor(stepId);
    const timer = window.setTimeout(
      () => setVisibleFor((current) => (current === stepId ? null : current)),
      HINT_VISIBLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [stepId, opening]);
  const visible = stepId !== null && visibleFor === stepId;
  const setVisible = (on: boolean) => setVisibleFor(on ? stepId : null);

  const discoveryRoom =
    step?.view === 'office' ? availableFacilityDiscoveries(state)[0]?.roomId : undefined;

  if (!step || !visible || engine.activeTalk || dockFor(step.view) === dockFor(view)) {
    return null;
  }

  function go() {
    if (!step) return;
    setVisible(false);
    if (step.view === 'office') {
      setView('office');
      if (discoveryRoom) focusFloor(discoveryRoom);
      return;
    }
    setView(step.view as ViewId);
  }

  const target = dockFor(step.view);
  return (
    <div className="next-hint" data-target={target ?? 'office'} role="status">
      <button type="button" className="next-hint__note" onClick={go}>
        <Icon name="notification" size={14} />
        <span>{stepText(t, step)}</span>
      </button>
      <button
        type="button"
        className="next-hint__dismiss"
        aria-label={t('common.dismiss')}
        onClick={() => setVisible(false)}
      >
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}
