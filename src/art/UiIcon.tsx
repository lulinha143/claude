// Unified original UI icon set. All icons share a 24×24 viewBox, use
// `currentColor` (so they inherit text colour and theming), and are drawn with
// consistent 2px round strokes so they stay recognisable at 16–24px. Meaning is
// never conveyed by colour alone — every interactive icon has an aria-label via
// the `title` prop or an accompanying text label in the UI.

export type IconName =
  | 'nut'
  | 'paw'
  | 'golden'
  | 'kernel'
  | 'morale'
  | 'reputation'
  | 'production'
  | 'automation'
  | 'employees'
  | 'rooms'
  | 'shop'
  | 'decorate'
  | 'company'
  | 'coffee'
  | 'focus'
  | 'quiet'
  | 'sound'
  | 'mute'
  | 'minimize'
  | 'maximize'
  | 'restore'
  | 'music'
  | 'music-off'
  | 'ambience'
  | 'sfx'
  | 'save'
  | 'import'
  | 'export'
  | 'achievements'
  | 'stats'
  | 'encyclopedia'
  | 'prestige'
  | 'settings'
  | 'accessibility'
  | 'photo'
  | 'moment'
  | 'daily'
  | 'minigame'
  | 'notification'
  | 'warning'
  | 'success'
  | 'error'
  | 'lock'
  | 'hidden'
  | 'close'
  | 'back'
  | 'undo'
  | 'redo'
  | 'refresh';

interface IconProps {
  name: IconName;
  size?: number;
  title?: string;
  className?: string;
}

// Each entry returns the inner SVG geometry. Kept compact and consistent.
const PATHS: Record<IconName, JSX.Element> = {
  nut: (
    <>
      <path d="M5 9c2-3 12-3 14 0-1 2-3 3-7 3s-6-1-7-3Z" />
      <path d="M6 9c0 6 3 10 6 10s6-4 6-10" />
    </>
  ),
  paw: (
    <>
      <path d="M7.5 14.5c1.2-2.4 7.8-2.4 9 0 1.4 2.8-.8 5.3-4.5 5.3s-5.9-2.5-4.5-5.3Z" />
      <circle cx="6" cy="10" r="2" />
      <circle cx="10" cy="6.8" r="2" />
      <circle cx="14.5" cy="6.8" r="2" />
      <circle cx="18" cy="10" r="2" />
    </>
  ),
  golden: (
    <>
      <path d="M5 9c2-3 12-3 14 0-1 2-3 3-7 3s-6-1-7-3Z" />
      <path d="M6 9c0 6 3 10 6 10s6-4 6-10" />
      <path d="M12 12v4M10 14h4" strokeWidth="1.4" />
    </>
  ),
  kernel: (
    <>
      <path d="M12 3c4 2 6 6 6 10s-3 8-6 8-6-4-6-8 2-8 6-10Z" />
      <path d="M12 6v12" strokeWidth="1.3" />
    </>
  ),
  morale: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 14c1.2 1.6 5.8 1.6 7 0" />
      <path d="M9 10h.01M15 10h.01" strokeWidth="2.4" />
    </>
  ),
  reputation: <path d="M12 3.5 14.6 9l6 .5-4.6 4 1.5 5.9L12 16.6 6.5 19.4 8 13.5l-4.6-4 6-.5Z" />,
  production: (
    <>
      <path d="M4 20V9l5 3V9l5 3V6l6 3v11Z" />
    </>
  ),
  automation: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"
        strokeWidth="1.5"
      />
    </>
  ),
  employees: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20c0-3 2.5-5 5-5s5 2 5 5" />
      <path d="M16 15c2 .3 4 2 4 5" />
      <circle cx="16.5" cy="8.5" r="2.2" />
    </>
  ),
  rooms: (
    <>
      <path d="M4 20V8l8-4 8 4v12Z" />
      <path d="M4 12h16M12 12v8" strokeWidth="1.5" />
    </>
  ),
  shop: (
    <>
      <path d="M4 8h16l-1 4H5Z" />
      <path d="M5 12v8h14v-8" />
      <path d="M4 8 6 4h12l2 4" />
    </>
  ),
  decorate: (
    <>
      <path d="M12 3c5 0 8 3 8 7 0 3-2 4-4 4h-1c-1 0-1 1-1 2s-1 2-2 2c-4 0-8-3-8-8s3-7 8-7Z" />
      <path d="M8 10h.01M12 8h.01M15 11h.01" strokeWidth="2.2" />
    </>
  ),
  company: (
    <>
      <path d="M5 21V6l7-3 7 3v15Z" />
      <path d="M9 21v-4h6v4M9 9h1M14 9h1M9 13h1M14 13h1" strokeWidth="1.4" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" />
      <path d="M16 10h2a2 2 0 0 1 0 4h-2" />
      <path d="M8 3c-.6 1 .6 2 0 3M11 3c-.6 1 .6 2 0 3" strokeWidth="1.4" />
    </>
  ),
  focus: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" strokeWidth="1.5" />
    </>
  ),
  quiet: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4Z" />
      <path d="M16 9l4 6M20 9l-4 6" strokeWidth="1.6" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4Z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M18.5 7a7 7 0 0 1 0 10" strokeWidth="1.6" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4Z" />
      <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" strokeWidth="1.8" />
    </>
  ),
  minimize: <path d="M5 12h14" strokeWidth="2" />,
  maximize: <rect x="5" y="5" width="14" height="14" rx="1.5" strokeWidth="2" />,
  restore: (
    <>
      <rect x="7" y="7" width="12" height="12" rx="1.5" strokeWidth="2" />
      <path d="M5 15V6a1 1 0 0 1 1-1h9" strokeWidth="1.6" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  'music-off': (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
      <path d="M3 3l18 18" strokeWidth="2.2" />
    </>
  ),
  ambience: (
    <>
      <path d="M3 12h3M9 12h3M15 12h3M21 12h0" strokeWidth="1.6" />
      <path d="M4 8c3 2 5-2 8 0s5-2 8 0M4 16c3 2 5-2 8 0s5-2 8 0" strokeWidth="1.4" />
    </>
  ),
  sfx: (
    <>
      <path d="M3 12h2l2-5 3 10 2-7 2 4h7" />
    </>
  ),
  save: (
    <>
      <path d="M5 5h11l3 3v11H5Z" />
      <path d="M8 5v4h6V5M8 19v-5h8v5" strokeWidth="1.5" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v11M8 10l4 4 4-4" />
      <path d="M4 17v3h16v-3" />
    </>
  ),
  export: (
    <>
      <path d="M12 15V4M8 8l4-4 4 4" />
      <path d="M4 17v3h16v-3" />
    </>
  ),
  achievements: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M9 13l-2 7 5-3 5 3-2-7" />
    </>
  ),
  stats: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 20v-6M12 20v-10M16 20v-4" strokeWidth="2" />
    </>
  ),
  encyclopedia: (
    <>
      <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z" />
      <path d="M18 20a2 2 0 0 0 2-2V6" />
      <path d="M8 8h6M8 11h6" strokeWidth="1.4" />
    </>
  ),
  prestige: (
    <>
      <path d="M12 2c3 3 3 6 0 9-3-3-3-6 0-9Z" />
      <path d="M5 21c0-5 3-8 7-8s7 3 7 8Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
        strokeWidth="1.5"
      />
    </>
  ),
  accessibility: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M5 8c3 1.5 5 1.5 7 1.5S16 9.5 19 8" />
      <path d="M12 9.5V15M9 21l3-6 3 6" />
    </>
  ),
  photo: (
    <>
      <path d="M3 8h4l1.5-2h7L17 8h4v11H3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  moment: (
    <>
      <path d="M4 5h16v14H4Z" />
      <path d="M4 15l4-4 3 3 4-5 5 6" />
      <circle cx="8.5" cy="8.5" r="1.3" />
    </>
  ),
  daily: (
    <>
      <path d="M4 6h16v14H4Z" />
      <path d="M8 3v4M16 3v4M4 10h16" strokeWidth="1.5" />
      <path d="M9 15l2 2 4-4" strokeWidth="1.6" />
    </>
  ),
  minigame: (
    <>
      <path d="M7 8h10a4 4 0 0 1 4 4v0a4 4 0 0 1-7 3H10a4 4 0 0 1-7-3v0a4 4 0 0 1 4-4Z" />
      <path d="M7 12h3M8.5 10.5v3" strokeWidth="1.5" />
      <path d="M15.5 11h.01M17.5 13h.01" strokeWidth="2.2" />
    </>
  ),
  notification: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5 2 6H4c.5-1 2-2 2-6Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 22 20H2Z" />
      <path d="M12 9v5M12 17h.01" strokeWidth="2" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" strokeWidth="2" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" strokeWidth="2" />
    </>
  ),
  lock: (
    <>
      <path d="M6 11h12v9H6Z" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  hidden: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <path d="M4 4l16 16" strokeWidth="1.6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" strokeWidth="2" />,
  back: <path d="M15 5l-7 7 7 7" strokeWidth="2" />,
  undo: (
    <>
      <path d="M9 7 4 12l5 5" />
      <path d="M4 12h9a6 6 0 0 1 6 6v1" />
    </>
  ),
  redo: (
    <>
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12h-9a6 6 0 0 0-6 6v1" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14-4L4 9" />
      <path d="M4 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14 4l2-2" />
      <path d="M20 20v-5h-5" />
    </>
  ),
};

export function Icon({ name, size = 20, title, className }: IconProps) {
  return (
    <svg
      className={className ? `ui-icon ${className}` : 'ui-icon'}
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
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
