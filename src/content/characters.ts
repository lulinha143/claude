import type { EmployeeMood } from '../sim/types';

// Who each teammate IS, as data: how they sound, what they like to receive, and
// the shape of their personal story. Their words live in the locale files
// (`arc.<id>.*`, `gifts.*`), so this file only holds what the game needs to
// reason about them. Every one of the 23 has an entry; tests enforce it.

export type GiftId = 'coffee' | 'acorn' | 'golden' | 'plant' | 'puzzle' | 'scarf';

/** A voice for the little babble they make when they speak. */
export interface VoiceProfile {
  /** base pitch, Hz. Big animals are low, small ones high. */
  base: number;
  wave: OscillatorType;
  /** milliseconds per syllable: Sonny drawls, Junie rattles. */
  pace: number;
}

/** Which part of the company their story touches, besides your friendship. */
export type StoryFlavor = 'morale' | 'reputation' | 'production' | 'golden';

export interface CharacterProfile {
  /**
   * Grammatical gender of how they are spoken of and speak of themselves, for
   * the languages that agree words with it (pt-BR: "cansado"/"cansada"). Passed
   * to i18next as the `context`, so a language without it simply ignores it.
   */
  gender: 'female' | 'male';
  voice: VoiceProfile;
  /** what they love (found by giving it), like, and find baffling. The rest get polite thanks. */
  gifts: { loves: GiftId; likes: GiftId; odd: GiftId };
  story: {
    flavor: StoryFlavor;
    /** how each option leaves them feeling: part1 a/b, part2 a/b, part3 a/b. */
    moods: [EmployeeMood, EmployeeMood, EmployeeMood, EmployeeMood, EmployeeMood, EmployeeMood];
    /** a teammate who turns up in their story (part 2, option b). */
    partner: string;
  };
}

export const CHARACTERS: Record<string, CharacterProfile> = {
  pip: {
    gender: 'male',
    voice: { base: 520, wave: 'triangle', pace: 70 },
    gifts: { loves: 'coffee', likes: 'acorn', odd: 'puzzle' },
    story: {
      flavor: 'morale',
      moods: ['proud', 'embarrassed', 'excited', 'happy', 'inspired', 'proud'],
      partner: 'marlow',
    },
  },
  marlow: {
    gender: 'male',
    voice: { base: 180, wave: 'sine', pace: 140 },
    gifts: { loves: 'acorn', likes: 'scarf', odd: 'coffee' },
    story: {
      flavor: 'morale',
      moods: ['relaxed', 'curious', 'happy', 'proud', 'relaxed', 'happy'],
      partner: 'dorm',
    },
  },
  rizzo: {
    gender: 'male',
    voice: { base: 380, wave: 'square', pace: 80 },
    gifts: { loves: 'golden', likes: 'puzzle', odd: 'scarf' },
    story: {
      flavor: 'production',
      moods: ['excited', 'suspicious', 'excited', 'suspicious', 'proud', 'excited'],
      partner: 'perry',
    },
  },
  bea: {
    gender: 'female',
    voice: { base: 300, wave: 'triangle', pace: 90 },
    gifts: { loves: 'acorn', likes: 'plant', odd: 'golden' },
    story: {
      flavor: 'production',
      moods: ['inspired', 'curious', 'excited', 'relaxed', 'happy', 'relaxed'],
      partner: 'bia',
    },
  },
  corvus: {
    gender: 'male',
    voice: { base: 330, wave: 'sawtooth', pace: 85 },
    gifts: { loves: 'golden', likes: 'coffee', odd: 'plant' },
    story: {
      flavor: 'reputation',
      moods: ['embarrassed', 'excited', 'excited', 'proud', 'proud', 'happy'],
      partner: 'dorm',
    },
  },
  mina: {
    gender: 'female',
    voice: { base: 280, wave: 'sine', pace: 95 },
    gifts: { loves: 'puzzle', likes: 'coffee', odd: 'scarf' },
    story: {
      flavor: 'golden',
      moods: ['curious', 'worried', 'excited', 'suspicious', 'inspired', 'relaxed'],
      partner: 'moss',
    },
  },
  nixie: {
    gender: 'female',
    voice: { base: 760, wave: 'triangle', pace: 55 },
    gifts: { loves: 'coffee', likes: 'puzzle', odd: 'plant' },
    story: {
      flavor: 'production',
      moods: ['excited', 'worried', 'proud', 'curious', 'happy', 'overcaffeinated'],
      partner: 'quincy',
    },
  },
  otto: {
    gender: 'male',
    voice: { base: 420, wave: 'sine', pace: 80 },
    gifts: { loves: 'acorn', likes: 'golden', odd: 'puzzle' },
    story: {
      flavor: 'golden',
      moods: ['relaxed', 'embarrassed', 'excited', 'proud', 'happy', 'sad'],
      partner: 'rizzo',
    },
  },
  hazel: {
    gender: 'female',
    voice: { base: 600, wave: 'triangle', pace: 75 },
    gifts: { loves: 'puzzle', likes: 'golden', odd: 'coffee' },
    story: {
      flavor: 'reputation',
      moods: ['embarrassed', 'proud', 'excited', 'embarrassed', 'proud', 'happy'],
      partner: 'nino',
    },
  },
  junie: {
    gender: 'female',
    voice: { base: 680, wave: 'triangle', pace: 50 },
    gifts: { loves: 'coffee', likes: 'scarf', odd: 'plant' },
    story: {
      flavor: 'production',
      moods: ['curious', 'suspicious', 'excited', 'worried', 'relaxed', 'proud'],
      partner: 'pingo',
    },
  },
  moss: {
    gender: 'male',
    voice: { base: 240, wave: 'sine', pace: 130 },
    gifts: { loves: 'coffee', likes: 'scarf', odd: 'golden' },
    story: {
      flavor: 'morale',
      moods: ['relaxed', 'suspicious', 'curious', 'inspired', 'happy', 'relaxed'],
      partner: 'echo',
    },
  },
  fenn: {
    gender: 'male',
    voice: { base: 400, wave: 'triangle', pace: 70 },
    gifts: { loves: 'golden', likes: 'coffee', odd: 'acorn' },
    story: {
      flavor: 'reputation',
      moods: ['worried', 'proud', 'embarrassed', 'excited', 'happy', 'proud'],
      partner: 'corvus',
    },
  },
  pingo: {
    gender: 'male',
    voice: { base: 450, wave: 'square', pace: 85 },
    gifts: { loves: 'scarf', likes: 'coffee', odd: 'golden' },
    story: {
      flavor: 'production',
      moods: ['sad', 'focused', 'excited', 'relaxed', 'happy', 'proud'],
      partner: 'junie',
    },
  },
  canela: {
    gender: 'female',
    voice: { base: 560, wave: 'sine', pace: 85 },
    gifts: { loves: 'plant', likes: 'acorn', odd: 'golden' },
    story: {
      flavor: 'reputation',
      moods: ['curious', 'suspicious', 'excited', 'curious', 'inspired', 'proud'],
      partner: 'mina',
    },
  },
  nino: {
    gender: 'male',
    voice: { base: 500, wave: 'sine', pace: 120 },
    gifts: { loves: 'scarf', likes: 'acorn', odd: 'puzzle' },
    story: {
      flavor: 'morale',
      moods: ['suspicious', 'relaxed', 'relaxed', 'embarrassed', 'proud', 'happy'],
      partner: 'hazel',
    },
  },
  bia: {
    gender: 'female',
    voice: { base: 150, wave: 'triangle', pace: 120 },
    gifts: { loves: 'coffee', likes: 'acorn', odd: 'plant' },
    story: {
      flavor: 'morale',
      moods: ['worried', 'curious', 'embarrassed', 'suspicious', 'happy', 'proud'],
      partner: 'bea',
    },
  },
  quincy: {
    gender: 'male',
    voice: { base: 260, wave: 'square', pace: 75 },
    gifts: { loves: 'plant', likes: 'coffee', odd: 'scarf' },
    story: {
      flavor: 'production',
      moods: ['curious', 'focused', 'excited', 'sad', 'proud', 'inspired'],
      partner: 'nixie',
    },
  },
  dorm: {
    gender: 'male',
    voice: { base: 200, wave: 'sine', pace: 180 },
    gifts: { loves: 'acorn', likes: 'scarf', odd: 'coffee' },
    story: {
      flavor: 'morale',
      moods: ['relaxed', 'tired', 'relaxed', 'curious', 'happy', 'relaxed'],
      partner: 'marlow',
    },
  },
  inky: {
    gender: 'male',
    voice: { base: 350, wave: 'sine', pace: 60 },
    gifts: { loves: 'puzzle', likes: 'coffee', odd: 'scarf' },
    story: {
      flavor: 'production',
      moods: ['worried', 'excited', 'focused', 'relaxed', 'proud', 'excited'],
      partner: 'junie',
    },
  },
  echo: {
    gender: 'female',
    voice: { base: 900, wave: 'sine', pace: 65 },
    gifts: { loves: 'scarf', likes: 'acorn', odd: 'coffee' },
    story: {
      flavor: 'golden',
      moods: ['inspired', 'curious', 'happy', 'curious', 'relaxed', 'excited'],
      partner: 'moss',
    },
  },
  rosa: {
    gender: 'female',
    voice: { base: 620, wave: 'triangle', pace: 80 },
    gifts: { loves: 'golden', likes: 'scarf', odd: 'acorn' },
    story: {
      flavor: 'reputation',
      moods: ['worried', 'excited', 'proud', 'excited', 'happy', 'proud'],
      partner: 'corvus',
    },
  },
  perry: {
    gender: 'male',
    voice: { base: 310, wave: 'square', pace: 90 },
    gifts: { loves: 'puzzle', likes: 'golden', odd: 'plant' },
    story: {
      flavor: 'golden',
      moods: ['focused', 'sad', 'suspicious', 'embarrassed', 'proud', 'happy'],
      partner: 'rizzo',
    },
  },
  axel: {
    gender: 'male',
    voice: { base: 540, wave: 'sine', pace: 90 },
    gifts: { loves: 'plant', likes: 'acorn', odd: 'coffee' },
    story: {
      flavor: 'morale',
      moods: ['happy', 'curious', 'excited', 'inspired', 'inspired', 'happy'],
      partner: 'canela',
    },
  },
};

export function characterOf(employeeId: string): CharacterProfile | undefined {
  return CHARACTERS[employeeId];
}
