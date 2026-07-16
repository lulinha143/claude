// A tiny, dependency-free particle burst for satisfying feedback on purchases,
// rewards and room upgrades. Appends short-lived DOM nodes to <body> and cleans
// them up; respects reduced-motion.
export function sparkleBurst(x: number, y: number, count = 12): void {
  if (typeof document === 'undefined') return;
  if (document.documentElement.getAttribute('data-reduced-motion') === 'true') return;
  const root = document.createElement('div');
  root.className = 'sparkle-burst';
  root.style.left = `${x}px`;
  root.style.top = `${y}px`;
  for (let i = 0; i < count; i += 1) {
    const s = document.createElement('span');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 16 + Math.random() * 26;
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    s.style.animationDelay = `${Math.random() * 0.06}s`;
    root.appendChild(s);
  }
  document.body.appendChild(root);
  setTimeout(() => root.remove(), 750);
}

/** Convenience for click handlers: bursts at the pointer position. */
export function sparkleAt(e: { clientX: number; clientY: number }): void {
  sparkleBurst(e.clientX, e.clientY);
}

/**
 * A soft, earthy puff for setting a decoration down: a quick expanding ring plus
 * a few muted motes. Deliberately understated (not the golden reward sparkle).
 * Respects reduced-motion.
 */
export function dustPuff(x: number, y: number): void {
  if (typeof document === 'undefined') return;
  if (document.documentElement.getAttribute('data-reduced-motion') === 'true') return;
  const root = document.createElement('div');
  root.className = 'dust-puff';
  root.style.left = `${x}px`;
  root.style.top = `${y}px`;
  const ring = document.createElement('span');
  ring.className = 'dust-puff__ring';
  root.appendChild(ring);
  const motes = 5;
  for (let i = 0; i < motes; i += 1) {
    const s = document.createElement('span');
    s.className = 'dust-puff__mote';
    const angle = (Math.PI * 2 * i) / motes + Math.random() * 0.5 - Math.PI / 2;
    const dist = 8 + Math.random() * 14;
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--dy', `${-Math.abs(Math.sin(angle) * dist)}px`);
    s.style.animationDelay = `${Math.random() * 0.05}s`;
    root.appendChild(s);
  }
  document.body.appendChild(root);
  setTimeout(() => root.remove(), 650);
}
