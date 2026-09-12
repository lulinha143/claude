/**
 * A populated save for visual QA and scene measurement.
 *
 * An empty founder's desk is not a useful thing to look at or measure: the point
 * of both harnesses is the *populated* office, with the whole photographic cast
 * standing in rooms at four-to-a-room so composition, scale and depth are all
 * actually exercised.
 */

// The full 2.0 cast, four to a room (ROOM_CAP), grouped so each room is full.
// `bia` is deliberately absent from the photographic cast: the bear has no artwork
// yet and renders as the vector critter.
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
  // the bear: no artwork, vector fallback, deliberately still here
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
      reputation: 400,
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
