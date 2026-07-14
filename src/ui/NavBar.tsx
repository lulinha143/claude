import { useTranslation } from 'react-i18next';
import { useStore, type ViewId } from '../state/store';
import { Icon, type IconName } from '../art/UiIcon';

const ITEMS: { id: ViewId; icon: IconName }[] = [
  { id: 'office', icon: 'rooms' },
  { id: 'shop', icon: 'shop' },
  { id: 'employees', icon: 'employees' },
  { id: 'company', icon: 'company' },
  { id: 'collections', icon: 'encyclopedia' },
  { id: 'achievements', icon: 'achievements' },
  { id: 'focus', icon: 'focus' },
  { id: 'decorate', icon: 'decorate' },
  { id: 'stats', icon: 'stats' },
  { id: 'prestige', icon: 'prestige' },
  { id: 'settings', icon: 'settings' },
];

export function NavBar() {
  const { t } = useTranslation();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  return (
    <nav className="nav" aria-label="main navigation">
      {ITEMS.map(({ id, icon }) => (
        <button
          key={id}
          className={`nav__item ${view === id ? 'is-active' : ''}`}
          onClick={() => setView(id)}
          aria-current={view === id}
        >
          <Icon name={icon} size={16} />
          <span className="nav__label">{t(`nav.${id}`)}</span>
        </button>
      ))}
    </nav>
  );
}
