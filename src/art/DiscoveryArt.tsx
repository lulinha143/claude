import { AnnexDecorArt } from './AnnexDecorArt';
/** Evidence sketches retain the incident's own object and silhouette. */
export function DiscoveryArt({ eventId }: { eventId: string }) {
  const annex = {
    'annex-broadcast': 'reel-recorder',
    'annex-repair': 'repair-vise',
    'annex-conservatory': 'rain-collector',
  }[eventId];
  if (annex)
    return (
      <div className={`annex-evidence annex-evidence--${eventId}`} aria-hidden="true">
        <AnnexDecorArt id={annex} scale={2} />
        <span>NI / {eventId.slice(6).toUpperCase()} / 23</span>
      </div>
    );
  const type =
    eventId === 'file-dated-tomorrow'
      ? 'file'
      : eventId === 'camera-thirteen'
        ? 'camera'
        : ['the-plant-clocked-in', 'the-previous-tenant'].includes(eventId)
          ? 'plant'
          : null;
  if (!type) return null;
  return (
    <svg className="discovery-evidence" viewBox="0 0 136 96" aria-hidden="true" focusable="false">
      <g stroke="#655745" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="69" cy="87" rx="49" ry="5" fill="#6e594423" stroke="none" />
        {type === 'file' ? (
          <>
            <path d="M20 22h35l8 8h49v52H20Z" fill="#c6a673" />
            <path d="m38 8 64 6-5 61-64-6Z" fill="#faf1d9" />
            <path d="m49 25 37 4m-39 7 34 3m-35 8 23 2" stroke="#ac9878" />
            <path d="m16 44 91 5 9 36H26Z" fill="#dec797" />
            <path d="m44 59 42 2-1 12-42-2Z" fill="#efe4c8" />
            <path d="m51 64 14 1m6 0 8 1" stroke="#927453" />
            <path d="m84 18-4 16" stroke="#976b85" strokeWidth="5" />
          </>
        ) : type === 'camera' ? (
          <>
            <path d="M23 16h91v58H23Z" fill="#8c938c" />
            <path d="M30 23h77v42H30Z" fill="#273c3a" />
            <path d="M37 56h61M54 57V41h28v16m-20-16V31h17v10" stroke="#a0b69b" fill="none" />
            <path d="M40 30h8m-4-4v8" stroke="#a0b69b" />
            <path d="M51 76v7m33-7v7m-40 2h48" />
            <circle cx="106" cy="70" r="2" fill="#d4b260" stroke="none" />
            <path d="m112 40 9 4-5 7 8 4" stroke="#b3a18b" fill="none" />
          </>
        ) : (
          <>
            <path
              d="M54 50 51 28q-2-13-17-13 0 16 17 17m4 8q5-22 25-20-3 21-25 24m1 10q-1-33 4-41"
              fill="#91a074"
            />
            <path d="M35 54h45l-7 29H42Z" fill="#c38c6e" />
            <path d="M33 51h49v9H33Z" fill="#d9a582" />
            <path d="m65 45 16 17" fill="none" />
            <path d="m77 54 28 1-1 29-28-1Z" fill="#f2e5c7" />
            <circle cx="91" cy="63" r="4" fill="#9eaf87" stroke="none" />
            <path d="m82 73 14 1m-14 5 8 1" stroke="#aa9371" />
            <path d="m89 50 1 6" />
          </>
        )}
      </g>
    </svg>
  );
}
