// The colour each department is painted with (the CSS custom properties live in
// tokens.css). Shared by the office floors and the visit stage, so a teammate is
// always seen in their own room's light.
export const DEPT: Record<string, string> = {
  'founder-desk': 'var(--dept-founder)',
  sorting: 'var(--dept-sorting)',
  morale: 'var(--dept-morale)',
  procurement: 'var(--dept-procurement)',
  construction: 'var(--dept-construction)',
  lab: 'var(--dept-lab)',
  marketing: 'var(--dept-marketing)',
  vault: 'var(--dept-vault)',
  research: 'var(--dept-research)',
  meeting: 'var(--dept-meeting)',
  nap: 'var(--dept-nap)',
  basement: 'var(--dept-basement)',
  rooftop: 'var(--dept-rooftop)',
};
