// The tree around the company: a leafy canopy over the top floor, branches that
// reach out into the sky on wide windows, and roots in the grass under the
// Founder's Desk. Pure decoration, drawn with the world tokens (world.css), so it
// themes with the rest of the game and costs nothing to animate.

export function TreeCanopy() {
  return (
    <svg
      className="tree-canopy"
      viewBox="0 0 400 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="tree-bark"
        d="M120 120 C 150 96, 170 92, 200 92 C 230 92, 250 96, 280 120 Z"
      />
      <ellipse className="tree-leaf--deep" cx="70" cy="86" rx="70" ry="34" />
      <ellipse className="tree-leaf--deep" cx="330" cy="86" rx="70" ry="34" />
      <ellipse className="tree-leaf" cx="120" cy="60" rx="84" ry="42" />
      <ellipse className="tree-leaf" cx="280" cy="60" rx="84" ry="42" />
      <ellipse className="tree-leaf" cx="200" cy="44" rx="104" ry="44" />
      <ellipse className="tree-leaf--light" cx="170" cy="32" rx="52" ry="20" />
      <ellipse className="tree-leaf--light" cx="262" cy="46" rx="34" ry="14" />
      <ellipse className="tree-leaf--light" cx="92" cy="56" rx="30" ry="12" />
      <circle className="tree-leaf--deep" cx="232" cy="70" r="6" />
      <circle className="tree-leaf--deep" cx="140" cy="78" r="5" />
    </svg>
  );
}

/** A branch with a couple of leaf clusters, drawn reaching LEFT from the trunk. */
function Branch({ side, top, flip }: { side: 'left' | 'right'; top: string; flip?: boolean }) {
  return (
    <svg
      className={`tree-branch tree-branch--${side}`}
      style={{ top, ...(flip ? { rotate: '8deg' } : null) }}
      viewBox="0 0 230 120"
      aria-hidden="true"
      focusable="false"
    >
      <path className="tree-bark-line" strokeWidth="13" d="M236 70 C 196 64, 160 50, 104 50" />
      <path className="tree-bark-line" strokeWidth="6" d="M160 56 C 146 40, 140 30, 130 18" />
      <ellipse className="tree-leaf--deep" cx="96" cy="56" rx="40" ry="24" />
      <ellipse className="tree-leaf" cx="86" cy="46" rx="34" ry="20" />
      <ellipse className="tree-leaf--light" cx="78" cy="40" rx="16" ry="8" />
      <ellipse className="tree-leaf" cx="128" cy="18" rx="24" ry="15" />
      <ellipse className="tree-leaf--light" cx="122" cy="13" rx="10" ry="5" />
      <ellipse className="tree-leaf--deep" cx="48" cy="64" rx="22" ry="13" />
    </svg>
  );
}

const BRANCHES: readonly { side: 'left' | 'right'; top: string; flip?: boolean }[] = [
  { side: 'left', top: '6%' },
  { side: 'right', top: '17%', flip: true },
  { side: 'left', top: '31%', flip: true },
  { side: 'right', top: '44%' },
  { side: 'left', top: '58%' },
  { side: 'right', top: '71%', flip: true },
  { side: 'left', top: '84%', flip: true },
];

export function TreeBranches() {
  return (
    <>
      {BRANCHES.map((branch) => (
        <Branch key={`${branch.side}-${branch.top}`} {...branch} />
      ))}
    </>
  );
}

/** The foot of the tree: the trunk flares into roots that grip a meadow. */
export function TreeRoots() {
  return (
    <div className="tree-base" aria-hidden="true">
      <svg className="tree-roots" viewBox="0 0 400 60" preserveAspectRatio="none" focusable="false">
        <path
          className="tree-bark"
          d="M44 0 H356 C 350 14, 366 28, 398 36 C 372 40, 352 36, 338 29 C 324 38, 304 42, 286 41 C 270 40, 258 35, 248 29 C 236 38, 220 43, 200 43 C 180 43, 164 38, 152 29 C 142 35, 130 40, 114 41 C 96 42, 76 38, 62 29 C 48 36, 28 40, 2 36 C 34 28, 50 14, 44 0 Z"
        />
        <path
          className="tree-bark-line"
          strokeWidth="2.4"
          d="M112 6 C 108 18, 96 28, 80 33 M288 6 C 292 18, 304 28, 320 33 M200 8 C 198 20, 196 30, 200 40 M150 4 C 150 16, 146 24, 140 30 M250 4 C 250 16, 254 24, 260 30"
        />
      </svg>
    </div>
  );
}
