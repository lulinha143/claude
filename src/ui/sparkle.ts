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
