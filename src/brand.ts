// Central brand identity for the game.
// -----------------------------------------------------------------------------
// This is the ONE place the game's title lives for all runtime code. To rebrand,
// change GAME_TITLE here — the opening title card, browser tab, exported photos
// and any other in-app usage all read from this constant instead of hardcoding
// the name. (Build/packaging metadata that tooling reads statically — the
// Electron productName, the HTML <title>, docs — is kept in sync by hand; each
// of those files has a single occurrence.)
//
// The title is a proper-noun brand, so it is intentionally NOT translated: it
// reads the same in every language.

/** The game's working title. Change this to rebrand everywhere in-app. */
export const GAME_TITLE = 'ZooWorkers';

/** Lowercase, filesystem/id-safe form of the title. */
export const GAME_ID = 'zooworkers';
