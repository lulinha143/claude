import type { CSSProperties } from 'react';
import type { EmployeeMood } from '../sim/types';
import { SpeechNote } from './SpeechNote';
import { STICKER_FOR_MOOD, StickerArt } from './EmotionSticker';

/**
 * A mood as a small inline sticker (Team rows, the visit header, consequence
 * lists). Same artwork as the office stickers, without the drop shadow.
 */
export function MoodEmoji({
  mood,
  color,
  className = '',
}: {
  mood: EmployeeMood;
  color: string;
  className?: string;
}) {
  const kind = STICKER_FOR_MOOD[mood];
  return (
    <span
      className={`mood-emoji ${className}`}
      style={{ ['--mood-color' as string]: color } as CSSProperties}
      data-mood={mood}
      data-sticker={kind}
      aria-hidden
    >
      <StickerArt kind={kind} compact />
    </span>
  );
}

/**
 * A teammate's emotion sticker, stuck just above their head.
 *
 * It lives in the stage's top layer (not inside the character's button) so a
 * plant or lamp standing in front of someone never hides how they feel, and it
 * is positioned by OfficeScene from the same slot and sprite metrics that place
 * the character. While they are saying something the sticker gives a small hop
 * and the words appear in a speech note anchored to it.
 */
export function EmployeeBubble({
  employeeId,
  mood,
  color,
  label,
  speech,
  name,
  tilt = 0,
  style,
  className = '',
}: {
  employeeId: string;
  mood: EmployeeMood;
  color: string;
  label: string;
  speech?: string | null;
  /** the speaking teammate's display name, shown on the speech note. */
  name?: string;
  /** a small per-teammate tilt, in degrees. */
  tilt?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const speaking = Boolean(speech);
  const kind = STICKER_FOR_MOOD[mood];
  return (
    <span
      className={`employee-bubble ${className}`}
      style={
        {
          ...style,
          ['--mood-color' as string]: color,
          ['--sticker-tilt' as string]: `${tilt}deg`,
          // Out of step with the neighbours, so a row of stickers never bobs in unison.
          ['--sticker-phase' as string]: `${(-((tilt + 6) / 12) * 5.6).toFixed(2)}s`,
        } as CSSProperties
      }
      data-employee={employeeId}
      data-mode={speaking ? 'speech' : 'emoji'}
      data-mood={mood}
      data-sticker={kind}
      title={label}
      aria-hidden
    >
      {/* Keyed by sticker, so a change of heart peels the old one off and sticks
          the new one on (the arrival animation replays). */}
      <span className="mood-emoji employee-bubble__sticker" key={kind} data-mood={mood}>
        <StickerArt kind={kind} />
      </span>
      {speech ? <SpeechNote name={name ?? label} text={speech} color={color} /> : null}
    </span>
  );
}
