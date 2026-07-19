import { useTranslation } from 'react-i18next';
import { useStore, type ViewId } from '../state/store';
import { Icon, type IconName } from '../art/UiIcon';
import { Tip, TipContent } from './Tooltip';

interface NavItem {
  id: ViewId;
  icon: IconName;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'office', icon: 'rooms' },
  { id: 'employees', icon: 'employees' },
  { id: 'shop', icon: 'shop' },
  { id: 'decorate', icon: 'decorate' },
  { id: 'focus', icon: 'focus' },
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
}: {
  item: NavItem;
  active: boolean;
  onSelect: (id: ViewId) => void;
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
        className={`nav__item nav__destination ${active ? 'is-active' : ''}`.trim()}
        data-view={item.id}
        onClick={() => onSelect(item.id)}
        aria-label={t(`nav.${item.id}`)}
        aria-current={active ? 'page' : undefined}
      >
        <Icon name={item.icon} size={19} />
      </button>
    </Tip>
  );
}

export function NavBar() {
  const { t } = useTranslation();
  const view = useStore((state) => state.view);
  const setView = useStore((state) => state.setView);

  return (
    <nav className="nav" aria-label={t('nav.mainNavigation')}>
      <div className="nav__primary">
        {NAV_ITEMS.map((item) => (
          <NavDestination
            key={item.id}
            item={item}
            active={view === item.id}
            onSelect={setView}
          />
        ))}
      </div>
    </nav>
  );
}
