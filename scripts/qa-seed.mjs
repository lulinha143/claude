/**
 * A populated save for visual QA and scene measurement.
 *
 * An empty founder's desk is not a useful thing to look at or measure: the point
 * of both harnesses is the *populated* office, with the whole photographic cast
 * standing in rooms at four-to-a-room so composition, scale and depth are all
 * actually exercised.
 */

// The full cast, four to a room (ROOM_CAP), grouped so each room is full.
//
// Every one of the 23 animals now has photographic artwork — the bear was the last
// to land — so this roster no longer exercises the vector-critter fallback. That
// path is still covered, by tests/spriteAvailability.test.ts, which is the right
// place for it: it is a load-failure behaviour, not a visual-QA subject.
export const QA_ROSTER = [
  // founder's desk
  { id: 'pip', room: 'founder-desk' },
  { id: 'marlow', room: 'founder-desk' },
  { id: 'nino', room: 'founder-desk' },
  { id: 'junie', room: 'founder-desk' },
  // research
  { id: 'moss', room: 'research' },
  { id: 'mina', room: 'research' },
  { id: 'hazel', room: 'research' },
  { id: 'perry', room: 'research' },
  // lab
  { id: 'axel', room: 'lab' },
  { id: 'quincy', room: 'lab' },
  { id: 'inky', room: 'lab' },
  { id: 'echo', room: 'lab' },
  // marketing
  { id: 'corvus', room: 'marketing' },
  { id: 'rosa', room: 'marketing' },
  { id: 'canela', room: 'marketing' },
  { id: 'fenn', room: 'marketing' },
  // procurement
  { id: 'rizzo', room: 'procurement' },
  { id: 'nixie', room: 'procurement' },
  { id: 'otto', room: 'procurement' },
  { id: 'pingo', room: 'procurement' },
  // construction + sorting
  { id: 'bea', room: 'construction' },
  { id: 'dorm', room: 'construction' },
  // The bear, alone in sorting — which also gives the harness a 1-employee room to
  // photograph next to the full ones, so the progressive room layouts get exercised.
  { id: 'bia', room: 'sorting' },
];

export function qaSave(roster = QA_ROSTER) {
  const employees = {};
  for (const { id, room } of roster) {
    employees[id] = { hired: true, level: 4, friendship: 50, room, x: 0.5 };
  }
  return {
    version: 10,
    onboardingComplete: true,
    lastSaved: Date.now(),
    createdAt: Date.now() - 900_000,
    company: { name: 'Nutshell Inc.' },
    resources: {
      nuts: 5_000_000,
      goldenNuts: 40,
      permanentKernels: 0,
      morale: 80,
      // Comfortably above the highest employee unlock (1150), because the roster below
      // hires the whole cast and reputation is what UNLOCKS them. At 400 the save was
      // internally inconsistent — twelve animals were flagged `hired` while
      // `isEmployeeUnlocked` still said no, so their roster cards showed "unlock at …"
      // instead of their actions and no harness could reach Talk, coffee or promotion
      // for over half the cast.
      reputation: 1_600,
    },
    employees,
    upgrades: {
      'room-sorting': 1,
      'room-lab': 1,
      'room-meeting': 1,
      'room-research': 1,
      'room-marketing': 1,
      'room-construction': 1,
      'room-procurement': 1,
    },
    collections: { nuts: [], outfits: [], logos: ['default'], moments: [], secrets: [] },
    settings: { reducedMotion: false },
  };
}
