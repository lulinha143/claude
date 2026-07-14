import { useTranslation } from 'react-i18next';
import { useStore, type ViewId } from '../state/store';

const ITEMS: ViewId[] = [
  'office',
  'shop',
  'employees',
  'company',
  'collections',
  'achievements',
  'focus',
  'decorate',
  'stats',
  'prestige',
  'settings',
];

export function NavBar() {
  const { t } = useTranslation();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  return (
    <nav className="nav" aria-label="main navigation">
      {ITEMS.map((id) => (
        <button
          key={id}
          className={`nav__item ${view === id ? 'is-active' : ''}`}
          onClick={() => setView(id)}
          aria-current={view === id}
        >
          {t(`nav.${id}`)}
        </button>
      ))}
    </nav>
  );
}
