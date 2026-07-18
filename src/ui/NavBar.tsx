import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, type ViewId } from '../state/store';
import { Icon, type IconName } from '../art/UiIcon';
import { Tip, TipContent } from './Tooltip';

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
  onSelect: (id: ViewId, restoreMoreFocus: boolean) => void;
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
        onClick={(event) =>
          onSelect(item.id, location === 'secondary' && event.detail === 0)
        }
        aria-label={t(`nav.${item.id}`)}
        aria-current={active ? 'page' : undefined}
      >
        <Icon name={item.icon} size={16} />
        <span className="nav__label nav__label--full">{t(`nav.${item.id}`)}</span>
        <span className="nav__label nav__label--short" aria-hidden="true">
          {t(`nav.short.${item.id}`)}
        </span>
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
  const secondaryActive = SECONDARY_ITEMS.some((item) => item.id === view);

  useEffect(() => {
    if (!moreOpen) return;
    morePanelRef.current?.querySelector<HTMLButtonElement>('.nav__destination')?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMoreOpen(false);
      moreButtonRef.current?.focus();
    };
    const wideQuery = window.matchMedia('(min-width: 601px)');
    const onWide = () => {
      if (wideQuery.matches) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    wideQuery.addEventListener('change', onWide);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      wideQuery.removeEventListener('change', onWide);
    };
  }, [moreOpen]);

  const select = (id: ViewId, restoreMoreFocus: boolean) => {
    const selectedFromOpenMore = moreOpen && restoreMoreFocus;
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
            <TipContent
              title={t('nav.more')}
              lines={[t('tip.nav.more')]}
              titleAriaHidden
            />
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
            aria-current={secondaryActive ? 'page' : undefined}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <Icon name="menu" size={16} />
            <span className="nav__label nav__label--full">{t('nav.more')}</span>
            <span className="nav__label nav__label--short" aria-hidden="true">
              {t('nav.short.more')}
            </span>
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
