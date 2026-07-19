import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, type ViewId } from '../state/store';
import { Icon, type IconName } from '../art/UiIcon';
import { Tip, TipContent } from './Tooltip';
import { INTERACTION_CANCEL_EVENT, INTERACTION_FOCUS_EVENT } from './interactionLifecycle';

interface NavItem {
  id: ViewId;
  icon: IconName;
}

const PRIMARY_ITEMS: readonly NavItem[] = [
  { id: 'office', icon: 'rooms' },
  { id: 'employees', icon: 'employees' },
  { id: 'shop', icon: 'shop' },
  { id: 'decorate', icon: 'decorate' },
  { id: 'focus', icon: 'focus' },
];

const SECONDARY_ITEMS: readonly NavItem[] = [
  { id: 'company', icon: 'company' },
  { id: 'collections', icon: 'encyclopedia' },
  { id: 'achievements', icon: 'achievements' },
  { id: 'stats', icon: 'stats' },
  { id: 'prestige', icon: 'prestige' },
  { id: 'settings', icon: 'settings' },
];

function NavDestination({
  item,
  active,
  onSelect,
  location,
}: {
  item: NavItem;
  active: boolean;
  onSelect: (id: ViewId) => void;
  location: 'primary' | 'secondary';
}) {
  const { t } = useTranslation();
  return (
    <Tip
      content={
        <TipContent
          title={t(`nav.${item.id}`)}
          lines={[t(`tip.nav.${item.id}`)]}
          titleAriaHidden
        />
      }
    >
      <button
        type="button"
        className={`nav__item nav__destination nav__destination--${location} ${active ? 'is-active' : ''}`.trim()}
        data-view={item.id}
        onClick={() => onSelect(item.id)}
        aria-label={t(`nav.${item.id}`)}
        aria-current={active ? 'page' : undefined}
      >
        <Icon name={item.icon} size={21} />
        {location === 'secondary' ? (
          <span className="nav__panel-label" aria-hidden="true">
            {t(`nav.${item.id}`)}
          </span>
        ) : null}
      </button>
    </Tip>
  );
}

export function NavBar() {
  const { t } = useTranslation();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const [moreOpen, setMoreOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const restoreMoreFocusRef = useRef(false);
  const secondaryActive = SECONDARY_ITEMS.some((item) => item.id === view);

  useEffect(() => {
    const restoreMoreFocus = () => {
      if (!restoreMoreFocusRef.current) return;
      restoreMoreFocusRef.current = false;
      window.requestAnimationFrame(() =>
        moreButtonRef.current?.focus({ preventScroll: true }),
      );
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') restoreMoreFocus();
    };

    window.addEventListener('focus', restoreMoreFocus);
    window.addEventListener(INTERACTION_FOCUS_EVENT, restoreMoreFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', restoreMoreFocus);
      window.removeEventListener(INTERACTION_FOCUS_EVENT, restoreMoreFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    morePanelRef.current?.querySelector<HTMLButtonElement>('.nav__destination')?.focus();

    const closeTransient = () => {
      restoreMoreFocusRef.current = false;
      setMoreOpen(false);
    };
    const closeForFocusLoss = () => {
      restoreMoreFocusRef.current =
        morePanelRef.current?.contains(document.activeElement) ?? false;
      setMoreOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) closeTransient();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeTransient();
      moreButtonRef.current?.focus();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') closeForFocusLoss();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', closeForFocusLoss);
    window.addEventListener(INTERACTION_CANCEL_EVENT, closeForFocusLoss);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', closeForFocusLoss);
      window.removeEventListener(INTERACTION_CANCEL_EVENT, closeForFocusLoss);
    };
  }, [moreOpen]);

  const select = (id: ViewId) => {
    const selectedFromOpenMore = moreOpen;
    restoreMoreFocusRef.current = false;
    setView(id);
    setMoreOpen(false);
    if (selectedFromOpenMore) {
      window.requestAnimationFrame(() => moreButtonRef.current?.focus({ preventScroll: true }));
    }
  };

  return (
    <nav ref={navRef} className="nav" aria-label={t('nav.mainNavigation')}>
      <div className="nav__primary">
        {PRIMARY_ITEMS.map((item) => (
          <NavDestination
            key={item.id}
            item={item}
            active={view === item.id}
            onSelect={select}
            location="primary"
          />
        ))}
        <Tip
          content={
            <TipContent title={t('nav.more')} lines={[t('tip.nav.more')]} titleAriaHidden />
          }
        >
          <button
            ref={moreButtonRef}
            type="button"
            className={`nav__item nav__more-toggle ${secondaryActive ? 'is-active' : ''}`.trim()}
            aria-label={
              secondaryActive
                ? t('nav.moreCurrent', { destination: t(`nav.${view}`) })
                : t('nav.more')
            }
            aria-expanded={moreOpen}
            aria-controls="nav-more-destinations"
            aria-current={secondaryActive && !moreOpen ? 'page' : undefined}
            onClick={() => {
              restoreMoreFocusRef.current = false;
              setMoreOpen((open) => !open);
            }}
          >
            <Icon name="menu" size={21} />
          </button>
        </Tip>
      </div>
      <div
        ref={morePanelRef}
        id="nav-more-destinations"
        className={`nav__more-panel ${moreOpen ? 'is-open' : ''}`.trim()}
        role="group"
        aria-label={t('nav.moreDestinations')}
      >
        {SECONDARY_ITEMS.map((item) => (
          <NavDestination
            key={item.id}
            item={item}
            active={view === item.id}
            onSelect={select}
            location="secondary"
          />
        ))}
      </div>
    </nav>
  );
}
