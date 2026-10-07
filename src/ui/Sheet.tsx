// A sheet: every secondary screen opens OVER the office instead of replacing it.
//
// Small windows: the sheet fills the stage between the HUD and the dock.
// Medium and large windows: it is a paper side panel on the right, and the office
// keeps living (and stays clickable) to its left. Closing a sheet — the close
// button, pressing its dock item again, or Escape — returns to the office exactly
// where the player left it, because the office never unmounts.
//
// The existing view components are hosted unchanged; the sheet supplies the
// paper, the title, the close control and (for the Archive) the tabs.

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore, type ViewId } from '../state/store';
import { canPrestige } from '../sim/prestige';
import { Icon, type IconName } from '../art/UiIcon';
import { ShopView } from './views/ShopView';
import { EmployeesView } from './views/EmployeesView';
import { CompanyView } from './views/CompanyView';
import { CollectionsView } from './views/CollectionsView';
import { AchievementsView } from './views/AchievementsView';
import { FocusView } from './views/FocusView';
import { DecorateView } from './views/DecorateView';
import { StatsView } from './views/StatsView';
import { PrestigeView } from './views/PrestigeView';
import { SettingsView } from './views/SettingsView';
import { ARCHIVE_VIEWS, dockFor, rememberArchiveView } from './GameDock';

const VIEWS: Partial<Record<ViewId, () => JSX.Element>> = {
  shop: ShopView,
  employees: EmployeesView,
  company: CompanyView,
  collections: CollectionsView,
  achievements: AchievementsView,
  focus: FocusView,
  decorate: DecorateView,
  stats: StatsView,
  prestige: PrestigeView,
  settings: SettingsView,
};

/** The destination's own mark on its folder tab (the same icons as the dock). */
const SHEET_ICON: Partial<Record<ViewId, IconName>> = {
  employees: 'employees',
  shop: 'shop',
  decorate: 'decorate',
  focus: 'focus',
  company: 'company',
  collections: 'company',
  achievements: 'company',
  stats: 'company',
  prestige: 'company',
  settings: 'settings',
};

export function Sheet({ view }: { view: ViewId }) {
  const { t } = useTranslation();
  const { state, engine } = useGame();
  const setView = useStore((s) => s.setView);
  const ref = useRef<HTMLElement>(null);
  const archive = ARCHIVE_VIEWS.includes(view);
  const dock = dockFor(view);
  const title =
    view === 'settings' ? t('nav.settings') : dock ? t(`dock.${dock}`) : t(`nav.${view}`);
  const prestigeRelevant =
    view === 'prestige' ||
    canPrestige(state) ||
    state.prestige.count > 0 ||
    state.resources.permanentKernels > 0;
  const tabs = ARCHIVE_VIEWS.filter((id) => id !== 'prestige' || prestigeRelevant);

  useEffect(() => {
    rememberArchiveView(view);
  }, [view]);

  // Bring keyboard focus into the sheet when it opens or changes page, without
  // scrolling the office behind it.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [view]);

  const close = () => {
    engine.closeTalk();
    setView('office');
  };

  const Current = VIEWS[view];
  return (
    <section
      ref={ref}
      className={`sheet sheet--${view} ${archive ? 'sheet--archive' : ''}`}
      aria-label={title}
      data-sheet={view}
      tabIndex={-1}
    >
      <header className="sheet__head">
        <h2 className="sheet__title">
          <span className="sheet__title-icon" aria-hidden>
            <Icon name={SHEET_ICON[view] ?? 'company'} size={15} />
          </span>
          <span className="sheet__title-text">{title}</span>
        </h2>
        {/* The way back is named, not just a cross: the office is where you return. */}
        <button
          type="button"
          className="sheet__close"
          onClick={close}
          aria-label={t('sheet.backToOffice')}
          title={t('sheet.backToOffice')}
        >
          <Icon name="home" size={15} />
          <span className="sheet__close-label" aria-hidden>
            {t('sheet.office')}
          </span>
        </button>
        {archive ? (
          <div className="sheet__tabs" role="tablist" aria-label={t('dock.archive')}>
            {tabs.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={id === view}
                className={`sheet__tab ${id === view ? 'is-active' : ''}`}
                data-view={id}
                onClick={() => setView(id)}
              >
                {t(`nav.${id}`)}
              </button>
            ))}
          </div>
        ) : null}
      </header>
      <div className="sheet__body" key={view}>
        {Current ? <Current /> : null}
      </div>
    </section>
  );
}
