// Navigation as a row of physical file tabs.
//
// This was an unlabelled row of eleven small icons — eleven guesses, with no way
// to tell at a glance where you were. It is now what the fiction wants: a strip of
// folder tabs across a filing rail, grouped into the departments a company like
// this would actually keep records under, each with a name.
//
// The tab language does real work rather than being decoration:
//
//   - Every destination is LABELLED, so the icon is a reinforcement rather than
//     the only clue. Eleven unlabelled glyphs is a memory test.
//   - The active tab loses its bottom border and shares the content panel's
//     surface, so it reads as physically attached to what is below it. That is the
//     whole point of a tab, and it is why the selected state needs no highlight
//     colour to be obvious.
//   - Tabs are grouped by department with a divider, so related destinations sit
//     together instead of forming one undifferentiated run.
//   - The recurring section marker appears on the active tab, tying navigation
//     into the same motif used on every panel heading.
//
// At narrow widths the strip wraps rather than scrolling: a wrapped tab is still
// clickable and readable, whereas a horizontally scrolled one hides destinations
// behind a gesture the player has no reason to expect.

import { useTranslation } from 'react-i18next';
import { useStore, type ViewId } from '../state/store';
import { Icon, type IconName } from '../art/UiIcon';
import { Tip, TipContent } from './Tooltip';

/** Which filing section a destination belongs to. */
type NavGroup = 'operations' | 'records' | 'admin';

interface NavItem {
  id: ViewId;
  icon: IconName;
  group: NavGroup;
}

// Ordered by how often a player needs them, grouped by what they are FOR.
const NAV_ITEMS: readonly NavItem[] = [
  // Running the company day to day.
  { id: 'office', icon: 'rooms', group: 'operations' },
  { id: 'employees', icon: 'employees', group: 'operations' },
  { id: 'shop', icon: 'shop', group: 'operations' },
  { id: 'decorate', icon: 'decorate', group: 'operations' },
  { id: 'focus', icon: 'focus', group: 'operations' },
  // What the company has on file about itself.
  { id: 'company', icon: 'company', group: 'records' },
  { id: 'collections', icon: 'encyclopedia', group: 'records' },
  { id: 'achievements', icon: 'achievements', group: 'records' },
  { id: 'stats', icon: 'stats', group: 'records' },
  // Everything else.
  { id: 'prestige', icon: 'prestige', group: 'admin' },
  { id: 'settings', icon: 'settings', group: 'admin' },
];

function NavTab({
  item,
  active,
  startsGroup,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  startsGroup: boolean;
  onSelect: (id: ViewId) => void;
}) {
  const { t } = useTranslation();
  return (
    <Tip
      content={
        <TipContent title={t(`nav.${item.id}`)} lines={[t(`tip.nav.${item.id}`)]} titleAriaHidden />
      }
    >
      <button
        type="button"
        // `nav__destination` is the long-standing semantic marker for "a place the
        // player can navigate to" and is what the multi-viewport layout specs use
        // to assert every destination stays directly reachable. The tab classes are
        // presentation on top of it.
        className={`nav__item nav__destination nav__tab ${active ? 'is-active' : ''} ${
          startsGroup ? 'starts-group' : ''
        }`.trim()}
        data-view={item.id}
        data-group={item.group}
        onClick={() => onSelect(item.id)}
        aria-label={t(`nav.${item.id}`)}
        aria-current={active ? 'page' : undefined}
      >
        {/* The section marker used across the whole interface, lit on the open tab. */}
        <span className="nav__tab-marker" aria-hidden />
        <Icon name={item.icon} size={15} />
        <span className="nav__tab-label">{t(`nav.short.${item.id}`)}</span>
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
      <div className="nav__rail" role="tablist" aria-label={t('nav.mainNavigation')}>
        {NAV_ITEMS.map((item, index) => (
          <NavTab
            key={item.id}
            item={item}
            active={view === item.id}
            startsGroup={index > 0 && NAV_ITEMS[index - 1].group !== item.group}
            onSelect={setView}
          />
        ))}
      </div>
    </nav>
  );
}
