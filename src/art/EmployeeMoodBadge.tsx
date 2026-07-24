import type { EmployeeMood } from '../sim/types';

type Face = 'smile' | 'calm' | 'focus' | 'spark' | 'low' | 'frown';

const MOOD_FACE: Record<EmployeeMood, Face> = {
  happy: 'smile',
  proud: 'smile',
  relaxed: 'calm',
  focused: 'focus',
  inspired: 'spark',
  curious: 'focus',
  tired: 'low',
  frustrated: 'frown',
  worried: 'low',
  angry: 'frown',
  embarrassed: 'low',
  overcaffeinated: 'spark',
  suspicious: 'focus',
  excited: 'spark',
  sad: 'frown',
};

/**
 * Tiny base-mounted mood stamp used in the office diorama. It communicates
 * status with colour AND a face shape, while staying outside the employee art.
 * The wrapping employee button carries the localized accessible label.
 */
export function EmployeeMoodBadge({
  mood,
  color,
  label,
}: {
  mood: EmployeeMood;
  color: string;
  label: string;
}) {
  const face = MOOD_FACE[mood];
  return (
    <span
      className={`employee-mood-badge employee-mood-badge--${face}`}
      style={{ ['--mood-color' as string]: color }}
      title={label}
      data-mood={mood}
      aria-hidden
    >
      <svg viewBox="0 0 16 16" width="13" height="13" focusable="false">
        <circle className="employee-mood-badge__face" cx="8" cy="8" r="5.6" />
        {face === 'focus' ? (
          <>
            <path d="M4.8 6.6 6.5 7M11.2 6.6 9.5 7" />
            <path d="M5.4 10.1h5.2" />
          </>
        ) : face === 'spark' ? (
          <>
            <path d="M4.8 6.5h2M9.2 6.5h2" />
            <path d="M5.2 9.4c1.5 1.7 4.1 1.7 5.6 0" />
            <path className="employee-mood-badge__spark" d="M12.4 2.2v2.1M11.35 3.25h2.1" />
          </>
        ) : (
          <>
            <circle cx="5.8" cy="6.7" r="0.7" />
            <circle cx="10.2" cy="6.7" r="0.7" />
            {face === 'smile' ? <path d="M5.3 9.1c1.4 1.8 4 1.8 5.4 0" /> : null}
            {face === 'calm' ? <path d="M5.4 9.4c1.7.9 3.5.9 5.2 0" /> : null}
            {face === 'low' ? <path d="M5.5 9.6h5" /> : null}
            {face === 'frown' ? <path d="M5.4 10.4c1.5-1.5 3.7-1.5 5.2 0" /> : null}
          </>
        )}
      </svg>
    </span>
  );
}
