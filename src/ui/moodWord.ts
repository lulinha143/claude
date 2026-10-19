import type { TFunction } from 'i18next';
import { CHARACTERS } from '../content/characters';
import type { EmployeeMood } from '../sim/types';

/**
 * A teammate's mood as a word that agrees with them: in pt-BR Beta is "Cansada"
 * and Bento "Cansado". The gender goes to i18next as the context
 * (`mood.tired_female`), and a language without the form falls back to the plain
 * key, so English is untouched.
 */
export function moodWord(t: TFunction, mood: EmployeeMood, employeeId: string): string {
  return t(`mood.${mood}`, { context: CHARACTERS[employeeId]?.gender });
}

/** The same agreement for how a room suits them ("Não é a sala dela"). */
export function affinityWord(t: TFunction, tier: string, employeeId: string): string {
  return t(`affinity.${tier}`, { context: CHARACTERS[employeeId]?.gender });
}
