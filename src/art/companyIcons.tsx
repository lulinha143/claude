// Company identity icons.
// -----------------------------------------------------------------------------
// A small, cohesive set of emblems the player can pick as their company logo.
// They share the exact drawing language of the UI icon set (24×24 viewBox,
// `currentColor`, 1.8px round strokes) so the chosen mark sits naturally inside
// the header badge and anywhere else the company logo appears, and inherits
// theming / high-contrast automatically.

export type CompanyIconId =
  | 'paw'
  | 'fox'
  | 'beaver'
  | 'owl'
  | 'raccoon'
  | 'crow'
  | 'coffee'
  | 'briefcase'
  | 'gear'
  | 'leaf'
  | 'tree'
  | 'building'
  | 'heart'
  | 'star'
  | 'moon'
  | 'sun'
  | 'gem'
  | 'crown';

export const COMPANY_ICON_IDS: CompanyIconId[] = [
  'paw',
  'fox',
  'beaver',
  'owl',
  'raccoon',
  'crow',
  'coffee',
  'leaf',
  'tree',
  'heart',
  'star',
  'moon',
  'sun',
  'gem',
  'crown',
  'briefcase',
  'gear',
  'building',
];

export const DEFAULT_COMPANY_ICON: CompanyIconId = 'paw';

const dot = (cx: number, cy: number, r = 0.9) => (
  <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
);

const PATHS: Record<CompanyIconId, JSX.Element> = {
  paw: (
    <>
      <path d="M7.5 14.5c1.2-2.4 7.8-2.4 9 0 1.4 2.8-.8 5.3-4.5 5.3s-5.9-2.5-4.5-5.3Z" />
      <circle cx="6" cy="10" r="2" />
      <circle cx="10" cy="6.8" r="2" />
      <circle cx="14.5" cy="6.8" r="2" />
      <circle cx="18" cy="10" r="2" />
    </>
  ),
  fox: (
    <>
      <path d="M6 4 L10 8 L6.5 9 Z" />
      <path d="M18 4 L14 8 L17.5 9 Z" />
      <path d="M6.5 8.5 C7 14 9.5 18.5 12 20 C14.5 18.5 17 14 17.5 8.5 C15 9.6 9 9.6 6.5 8.5 Z" />
      {dot(10, 12.4)}
      {dot(14, 12.4)}
      <path d="M10.6 15.6 L12 17 L13.4 15.6" />
      {dot(12, 15.2, 0.7)}
    </>
  ),
  beaver: (
    <>
      <circle cx="7.5" cy="7.5" r="1.9" />
      <circle cx="16.5" cy="7.5" r="1.9" />
      <circle cx="12" cy="12" r="7" />
      {dot(9.6, 11)}
      {dot(14.4, 11)}
      <path d="M10.4 13.6 h3.2" />
      <rect x="10.4" y="15.2" width="3.2" height="3.6" rx="0.6" />
      <path d="M12 15.2 v3.6" strokeWidth="1.2" />
    </>
  ),
  owl: (
    <>
      <path d="M6.5 5 L8.5 8 M17.5 5 L15.5 8" />
      <path d="M12 4 C6.5 4 5.2 9 6.2 13 C7.2 18 10 20 12 20 C14 20 16.8 18 17.8 13 C18.8 9 17.5 4 12 4 Z" />
      <circle cx="9.5" cy="10" r="2.3" />
      <circle cx="14.5" cy="10" r="2.3" />
      {dot(9.5, 10, 0.8)}
      {dot(14.5, 10, 0.8)}
      <path d="M12 12.4 l-1.2 2 h2.4 Z" />
    </>
  ),
  raccoon: (
    <>
      <path d="M7 6 L9.2 9 M17 6 L14.8 9" />
      <circle cx="12" cy="13" r="7" />
      <path d="M7.8 11.4 q1.7 -2.4 3.4 0 M12.8 11.4 q1.7 -2.4 3.4 0" />
      {dot(9.5, 11.6, 0.8)}
      {dot(14.5, 11.6, 0.8)}
      <path d="M12 14 v1.6" />
      {dot(12, 14, 0.8)}
    </>
  ),
  crow: (
    <>
      <path d="M4 13 C6 9 10 8 13 9 C15 6.4 18 6.4 20 7.4 C18.4 9 18.4 10 17.2 11 C17 15 14 17 11 17 C7 17 5 16 4 13 Z" />
      <path d="M20 7.4 l3 1 l-3 1" />
      {dot(15, 10, 0.8)}
      <path d="M4 13 l-2.4 4 4.4 -1" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" />
      <path d="M16 10h2a2 2 0 0 1 0 4h-2" />
      <path d="M8 3c-.6 1 .6 2 0 3M11 3c-.6 1 .6 2 0 3" strokeWidth="1.4" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M9 7V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M3 12h18" strokeWidth="1.4" />
      <rect x="10.4" y="11" width="3.2" height="2.4" rx="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  gear: (
    <>
      {/* eight cog teeth (thick short spokes at the rim) + hub — a clear cog
          silhouette that never reads as the sun's thin rays. */}
      <path
        d="M12 7V4.5M12 17v2.5M17 12h2.5M7 12H4.5M15.5 8.5l1.6-1.6M8.5 8.5 6.9 6.9M15.5 15.5l1.6 1.6M8.5 15.5 6.9 17.1"
        strokeWidth="3"
      />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.8" />
    </>
  ),
  leaf: (
    <>
      <path d="M4.5 19.5 C4 10 11 4 20 4 C20 13 13.5 20 4.5 19.5 Z" />
      <path d="M5 19 C9 14 14 9.5 18.5 7" strokeWidth="1.3" />
    </>
  ),
  tree: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M12 15v6M9 21h6" strokeWidth="1.6" />
      <path d="M12 9l-2.4-2.4M12 11l2.4-2.4" strokeWidth="1.2" />
    </>
  ),
  building: (
    <>
      <path d="M5 21V6l7-3 7 3v15Z" />
      <path d="M9 21v-4h6v4M9 9h1M14 9h1M9 13h1M14 13h1" strokeWidth="1.4" />
    </>
  ),
  heart: (
    <path d="M12 20 C4 14.5 4 7.5 8.4 6.2 C10.4 5.6 12 7 12 8.2 C12 7 13.6 5.6 15.6 6.2 C20 7.5 20 14.5 12 20 Z" />
  ),
  star: <path d="M12 3.5 14.6 9l6 .5-4.6 4 1.5 5.9L12 16.6 6.5 19.4 8 13.5l-4.6-4 6-.5Z" />,
  moon: <path d="M19 14.5 A7.5 7.5 0 1 1 10 4 A6 6 0 0 0 19 14.5 Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19"
        strokeWidth="1.5"
      />
    </>
  ),
  gem: (
    <>
      <path d="M5 9 L8 4 h8 l3 5 -7 11 Z" />
      <path d="M5 9 h14 M8 4 l4 5 4 -5 M12 9 v11" strokeWidth="1.3" />
    </>
  ),
  crown: (
    <>
      <path d="M4 8 L7 14.5 H17 L20 8 L15.3 11 L12 5.5 L8.7 11 Z" />
      <path d="M6.5 17.5 h11" strokeWidth="1.6" />
    </>
  ),
};

/** i18n key for a company icon's accessible name. */
export function companyIconLabelKey(id: CompanyIconId): string {
  return `company.icon.name.${id}`;
}

export function isCompanyIconId(value: string | undefined): value is CompanyIconId {
  return value !== undefined && value in PATHS;
}

/** Normalize any stored value to a valid icon id (defaults to the paw mark). */
export function resolveCompanyIcon(value: string | undefined): CompanyIconId {
  return isCompanyIconId(value) ? value : DEFAULT_COMPANY_ICON;
}

export function CompanyIcon({
  id,
  size = 20,
  title,
  className,
}: {
  id: string | undefined;
  size?: number;
  title?: string;
  className?: string;
}) {
  const resolved = resolveCompanyIcon(id);
  return (
    <svg
      className={className ? `ui-icon company-icon ${className}` : 'ui-icon company-icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-company-icon={resolved}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[resolved]}
    </svg>
  );
}
