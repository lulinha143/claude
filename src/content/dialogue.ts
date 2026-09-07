// Dialogue is stored as arrays in the locale files under `dialogue.<category>`.
// This registry declares how many lines each category has so the (framework
// independent) selector can pick an index with cooldown/recency tracking; the
// UI resolves the actual localized string. Keeping counts here means the
// localization completeness checker can verify every locale has enough lines.
export const DIALOGUE_COUNTS: Record<string, number> = {
  pip: 12,
  marlow: 10,
  rizzo: 10,
  bea: 10,
  corvus: 10,
  mina: 10,
  nixie: 10,
  otto: 10,
  hazel: 10,
  junie: 10,
  moss: 10,
  fenn: 10,
  pingo: 10,
  canela: 10,
  nino: 6,
  bia: 6,
  quincy: 6,
  dorm: 6,
  inky: 6,
  echo: 6,
  rosa: 6,
  perry: 6,
  axel: 6,
  idle: 12,
  upgrade: 8,
  lowMorale: 8,
  focus: 6,
  prestige: 6,
  interaction: 8,
};

export const DIALOGUE_CATEGORIES = Object.keys(DIALOGUE_COUNTS);

export function totalDialogueLines(): number {
  return Object.values(DIALOGUE_COUNTS).reduce((a, b) => a + b, 0);
}
