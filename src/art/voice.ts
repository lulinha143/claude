import { CHARACTERS } from '../content/characters';
import type { AudioManager } from '../audio/audio';

/** A teammate saying `text`: a short babble in their own voice. */
export function speakAloud(audio: AudioManager, employeeId: string, text: string): void {
  const voice = CHARACTERS[employeeId]?.voice;
  if (!voice) return;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  let seed = 0;
  for (let i = 0; i < text.length; i += 1) seed = (seed * 31 + text.charCodeAt(i)) | 0;
  audio.voice(voice, Math.max(2, Math.min(6, Math.round(words / 3))), Math.abs(seed));
}
