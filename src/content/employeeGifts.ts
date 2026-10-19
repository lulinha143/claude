import { CHARACTERS, type GiftId } from './characters';
import type { EventEffect } from './types';

export type { GiftId } from './characters';

// Gifts are a small discovery game. Six everyday presents; each teammate LOVES
// one, LIKES one, is BAFFLED by one, and politely thanks you for the rest. A gift
// only teaches you how that teammate felt about THAT gift: the favourite is found
// by giving it, never shown in advance. Once you are trusted, a teammate who has
// had a couple of misses drops a hint.

export interface GiftDef {
  id: GiftId;
  /** what it costs to bring. Coffee comes from the machine. */
  cost: { nuts?: number; goldenNuts?: number };
  /** what the gift does on its own, whoever receives it. */
  base: EventEffect[];
}

export const GIFTS: readonly GiftDef[] = [
  {
    id: 'coffee',
    cost: {},
    base: [{ type: 'productionBoost', value: 1.08, durationSeconds: 240 }],
  },
  { id: 'acorn', cost: { nuts: 500 }, base: [] },
  { id: 'plant', cost: { nuts: 300 }, base: [] },
  { id: 'puzzle', cost: { nuts: 900 }, base: [] },
  { id: 'scarf', cost: { nuts: 1500 }, base: [] },
  { id: 'golden', cost: { goldenNuts: 1 }, base: [{ type: 'morale', value: 4 }] },
];

export const GIFTS_BY_ID: Record<GiftId, GiftDef> = Object.fromEntries(
  GIFTS.map((gift) => [gift.id, gift]),
) as Record<GiftId, GiftDef>;

export type GiftReaction = 'loved' | 'liked' | 'polite' | 'odd';

/** Each teammate's favourite gift (what giving it first time turns into a keepsake). */
export const GIFT_PREFERENCES: Record<string, GiftId> = Object.fromEntries(
  Object.entries(CHARACTERS).map(([id, character]) => [id, character.gifts.loves]),
);

/**
 * The favourites before gifts became a discovery game. Only used to carry an old
 * save's "you gave them their favourite" memory over as the gift it really was.
 */
export const LEGACY_GIFT_FAVORITES: Record<string, 'coffee' | 'acorn' | 'golden'> = {
  pip: 'coffee',
  marlow: 'acorn',
  rizzo: 'golden',
  bea: 'acorn',
  corvus: 'golden',
  mina: 'coffee',
  nixie: 'coffee',
  otto: 'acorn',
  hazel: 'golden',
  junie: 'coffee',
  moss: 'coffee',
  fenn: 'golden',
  pingo: 'coffee',
  canela: 'acorn',
  nino: 'acorn',
  bia: 'coffee',
  quincy: 'coffee',
  dorm: 'acorn',
  inky: 'coffee',
  echo: 'acorn',
  rosa: 'golden',
  perry: 'golden',
  axel: 'acorn',
};

/** How `employeeId` feels about `gift`. */
export function giftReaction(employeeId: string, gift: GiftId): GiftReaction {
  const prefs = CHARACTERS[employeeId]?.gifts;
  if (!prefs) return 'polite';
  if (prefs.loves === gift) return 'loved';
  if (prefs.likes === gift) return 'liked';
  if (prefs.odd === gift) return 'odd';
  return 'polite';
}

/** What a reaction does to the relationship (on top of the gift's own effects). */
export const REACTION_EFFECTS: Record<GiftReaction, EventEffect[]> = {
  loved: [
    { type: 'friendship', value: 10 },
    { type: 'emotion', emotion: 'excited', durationSeconds: 900 },
  ],
  liked: [
    { type: 'friendship', value: 6 },
    { type: 'emotion', emotion: 'happy', durationSeconds: 420 },
  ],
  polite: [{ type: 'friendship', value: 3 }],
  odd: [
    { type: 'friendship', value: 1 },
    { type: 'emotion', emotion: 'curious', durationSeconds: 240 },
  ],
};

/** The line a teammate says for a reaction. */
export function giftReplyKey(employeeId: string, reaction: GiftReaction): string {
  switch (reaction) {
    case 'loved':
      return `gifts.reactions.${employeeId}`;
    case 'liked':
      return `gifts.liked.${employeeId}`;
    case 'odd':
      return `gifts.odd.${employeeId}`;
    default:
      return `gifts.polite.${employeeId}`;
  }
}

/** The flag that records a gift was tried with this teammate (and when). */
export function giftFlag(employeeId: string, gift: GiftId): string {
  return `${employeeId}.gift.${gift}`;
}
