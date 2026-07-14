import { Critter } from './Critter';
import { EMPLOYEES } from '../content/employees';
import { shapeFor } from './critterShapes';

// A non-interactive, decorative cozy office diorama used behind the start/title
// screen (and available as a reusable backdrop). Shows the tree-trunk company
// with all employees idling in tiny rooms and a few subtle ambient details.
// Cheap: a handful of static SVG layers + the existing CSS critter animations.
export function OfficeBackdrop({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <div className="backdrop" aria-hidden>
      <svg className="backdrop__trunk" viewBox="0 0 100 200" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bd-bark" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3a2c1f" />
            <stop offset="0.5" stopColor="#4a3826" />
            <stop offset="1" stopColor="#33261a" />
          </linearGradient>
          <radialGradient id="bd-glow" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#e0a43b" stopOpacity="0.25" />
            <stop offset="1" stopColor="#e0a43b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="200" fill="#2a2016" />
        <path
          d="M6 8 C 0 40, 4 90, 3 140 C 2 172, 10 190, 14 200 L86 200 C 90 190, 98 172, 97 140 C 96 90, 100 40, 94 8 C 80 0, 20 0, 6 8 Z"
          fill="url(#bd-bark)"
          stroke="#241a12"
          strokeWidth="1.5"
        />
        <rect x="0" y="0" width="100" height="200" fill="url(#bd-glow)" />
        {/* floor divisions */}
        {[42, 74, 106, 138, 170].map((y) => (
          <line key={y} x1="10" y1={y} x2="90" y2={y} stroke="#241a12" strokeWidth="1.2" opacity="0.5" />
        ))}
        {/* warm room lights */}
        {[30, 62, 94, 126, 158].map((y, i) => (
          <circle
            key={y}
            className={reducedMotion ? undefined : 'backdrop__lamp'}
            cx={i % 2 === 0 ? 24 : 76}
            cy={y}
            r="3"
            fill="#f0be5e"
            style={reducedMotion ? undefined : { animationDelay: `${i * 0.7}s` }}
          />
        ))}
      </svg>

      <div className="backdrop__critters">
        {EMPLOYEES.slice(0, 6).map((def, i) => {
          const shape = shapeFor(def.id);
          const row = Math.floor(i / 2);
          return (
            <div
              key={def.id}
              className="backdrop__critter"
              style={{ left: `${i % 2 === 0 ? 16 : 62}%`, top: `${14 + row * 26}%` }}
            >
              <Critter
                species={shape.species}
                color={def.color}
                accent={def.accent}
                state={i % 3 === 0 ? 'sorting' : 'idle'}
                hasGlasses={shape.hasGlasses}
                reducedMotion={reducedMotion}
                size={54}
                seed={i}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
