import type { CSSProperties, ReactNode } from 'react';
import type { EmployeeMood } from '../sim/types';

type MoodFace =
  | 'smile'
  | 'proud'
  | 'calm'
  | 'focus'
  | 'spark'
  | 'curious'
  | 'tired'
  | 'frustrated'
  | 'worried'
  | 'angry'
  | 'embarrassed'
  | 'wired'
  | 'suspicious'
  | 'excited'
  | 'sad';

const MOOD_FACE: Record<EmployeeMood, MoodFace> = {
  happy: 'smile',
  proud: 'proud',
  relaxed: 'calm',
  focused: 'focus',
  inspired: 'spark',
  curious: 'curious',
  tired: 'tired',
  frustrated: 'frustrated',
  worried: 'worried',
  angry: 'angry',
  embarrassed: 'embarrassed',
  overcaffeinated: 'wired',
  suspicious: 'suspicious',
  excited: 'excited',
  sad: 'sad',
};

function FaceEyes({ face }: { face: MoodFace }) {
  if (face === 'calm' || face === 'proud' || face === 'tired') {
    return <path className="mood-emoji__line" d="M5.1 9.2c.7.6 1.4.6 2.1 0M12.8 9.2c.7.6 1.4.6 2.1 0" />;
  }
  if (face === 'focus' || face === 'suspicious' || face === 'angry') {
    return (
      <>
        <path className="mood-emoji__line" d={face === 'angry' ? 'm4.8 7.4 2.8 1M15.2 7.4l-2.8 1' : 'm4.8 8.2 2.8-.7M15.2 8.2l-2.8-.7'} />
        <circle className="mood-emoji__ink" cx="6.4" cy="9.7" r="1" />
        <circle className="mood-emoji__ink" cx="13.6" cy="9.7" r="1" />
      </>
    );
  }
  if (face === 'wired' || face === 'excited') {
    return (
      <>
        <circle className="mood-emoji__eye-ring" cx="6.3" cy="9" r="1.7" />
        <circle className="mood-emoji__eye-ring" cx="13.7" cy="9" r="1.7" />
      </>
    );
  }
  if (face === 'worried' || face === 'sad') {
    return (
      <>
        <path className="mood-emoji__line" d="m4.9 8.2 2.7-.8M15.1 8.2l-2.7-.8" />
        <circle className="mood-emoji__ink" cx="6.4" cy="9.7" r=".9" />
        <circle className="mood-emoji__ink" cx="13.6" cy="9.7" r=".9" />
      </>
    );
  }
  return (
    <>
      <circle className="mood-emoji__ink" cx="6.4" cy="9.2" r="1" />
      <circle className="mood-emoji__ink" cx="13.6" cy="9.2" r="1" />
    </>
  );
}

function FaceMouth({ face }: { face: MoodFace }) {
  if (face === 'smile' || face === 'proud' || face === 'spark') {
    return <path className="mood-emoji__line" d="M6.1 12.7c2 2.4 5.8 2.4 7.8 0" />;
  }
  if (face === 'excited') {
    return <path className="mood-emoji__mouth-fill" d="M6.2 12.4c1.8 3.1 5.8 3.1 7.6 0Z" />;
  }
  if (face === 'curious') {
    return <circle className="mood-emoji__mouth-fill" cx="10" cy="13.6" r="1.15" />;
  }
  if (face === 'sad' || face === 'angry' || face === 'frustrated' || face === 'worried') {
    return <path className="mood-emoji__line" d="M6.2 14.4c2-2.1 5.6-2.1 7.6 0" />;
  }
  if (face === 'wired') {
    return <path className="mood-emoji__line" d="m6.1 13.3 1.5-.7 1.6.7 1.6-.7 1.6.7 1.5-.7" />;
  }
  return <path className="mood-emoji__line" d="M6.4 13.4h7.2" />;
}

function FaceAccent({ face }: { face: MoodFace }): ReactNode {
  if (face === 'spark') return <path className="mood-emoji__accent" d="M15.8 3v3M14.3 4.5h3M4.2 4.3v1.8M3.3 5.2h1.8" />;
  if (face === 'tired') return <path className="mood-emoji__accent" d="m14.6 4.8 2-2h-2l2-2" />;
  if (face === 'embarrassed') return <path className="mood-emoji__cheek" d="M3.8 11.7h3M13.2 11.7h3" />;
  if (face === 'sad') return <path className="mood-emoji__tear" d="M14.7 10.8c1.4 1.7 1.2 2.8 0 2.8s-1.4-1.1 0-2.8Z" />;
  if (face === 'frustrated') return <path className="mood-emoji__accent" d="M15.4 4.7h2M16.4 3.7v2" />;
  if (face === 'suspicious') return <path className="mood-emoji__accent" d="M14.6 5.2c1-1 2.1-1 3.1 0" />;
  return null;
}

/** A crisp project-owned emoji face, consistent across platforms and sizes. */
export function MoodEmoji({
  mood,
  color,
  className = '',
}: {
  mood: EmployeeMood;
  color: string;
  className?: string;
}) {
  const face = MOOD_FACE[mood];
  return (
    <span
      className={`mood-emoji ${className}`}
      style={{ ['--mood-color' as string]: color } as CSSProperties}
      data-mood={mood}
      aria-hidden
    >
      <svg viewBox="0 0 20 20" focusable="false">
        <circle className="mood-emoji__face" cx="10" cy="10" r="7.4" />
        <FaceEyes face={face} />
        <FaceMouth face={face} />
        <FaceAccent face={face} />
      </svg>
    </span>
  );
}

/** Persistent employee-anchored emotion bubble for final and fallback art. */
export function EmployeeMoodBubble({
  mood,
  color,
  label,
}: {
  mood: EmployeeMood;
  color: string;
  label: string;
}) {
  return (
    <span
      className="employee-mood-bubble"
      style={{ ['--mood-color' as string]: color } as CSSProperties}
      title={label}
      data-mood={mood}
      aria-hidden
    >
      <MoodEmoji mood={mood} color={color} className="employee-mood-bubble__emoji" />
    </span>
  );
}
