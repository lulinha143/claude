import type { ReactNode } from 'react';

// Small objects drawn for the personnel files. Their names and stories live in
// content/locales; these silhouettes remain decorative and offline-safe.
const ITEMS: Record<string, ReactNode> = {
  pip: (
    <>
      <path d="M22 29h34v27q0 9-17 9T22 56Z" fill="#d7a654" />
      <path d="M56 34h5q14 0 10 13t-15 9" />
      <path d="m39 33-7 12 10 3-8 13" />
      <path d="M29 23q8-6 0-13M46 23q8-6 0-13" />
    </>
  ),
  marlow: (
    <>
      <path d="M16 59q-2-22 18-30l8-15q7-5 13 6l6 16q15 5 18 22-1 16-31 16T16 59Z" fill="#8ba77e" />
      <path d="M32 32q3 18 16 20t14-16M21 65q26 7 52-2" />
    </>
  ),
  rizzo: (
    <>
      <path d="m18 47 48-22q9-3 11 7L36 56Z" fill="#698d99" />
      <path d="M18 48v17h59V55H34" fill="#b9b8ad" />
      <path d="M31 60h39M65 29l4 10" />
    </>
  ),
  bea: (
    <>
      <path d="m14 37 58-20 12 32-59 20Z" fill="#c49b65" />
      <path d="m22 41 45-16m-35 27 39-14m-43 23 42-13" />
      <ellipse cx="49" cy="42" rx="8" ry="3" transform="rotate(-19 49 42)" />
      <path d="m18 37 8 9m50 1 6 3" />
    </>
  ),
  corvus: (
    <>
      <path d="M23 35h14l33-17v44L37 47H23Z" fill="#c57b53" />
      <path d="m35 48 9 20H31l-5-20" fill="#bfb79d" />
      <path d="M70 18q13 20 0 44M80 21l7-6m-5 24h9m-10 16 7 5" />
    </>
  ),
  mina: (
    <>
      <path d="M10 32h12m52 0h12M43 35q5-8 10 0" />
      <path d="M20 24h23v26H20Zm33 0h23v26H53Z" fill="#a7c7c7" />
      <path d="m25 30 11-2m-10 9 9-5m23-2 11-2m-10 9 9-5M20 49l7 9h9l7-9m10 0 7 9h9l7-9" />
    </>
  ),
  nixie: (
    <>
      <path d="M27 25h44v42H27Z" fill="#b5b2a0" />
      <path d="M33 32h25v16H33Z" fill="#90b8a6" />
      <path d="m40 39 5-4 6 7 4-3M36 18v7m26-12v12M17 46h10m44 9h10" />
      <circle cx="38" cy="57" r="3" fill="#bd7559" />
      <circle cx="59" cy="57" r="5" fill="#dcb660" />
    </>
  ),
  otto: (
    <>
      <path d="M25 15h47v57H25Z" fill="#84a28b" />
      <path d="M25 15h8v57M42 26h20M40 36h25M40 45h25M40 54h25m-12-18v27" />
      <path d="M32 69h37" stroke="#f7e8c7" />
    </>
  ),
  hazel: (
    <>
      <path d="m42 31 9 7-21 30-10-7Z" fill="#b58a54" />
      <path d="m36 16 13-6 22 25-12 11Z" fill="#9c784e" />
      <path d="m40 21 18 20m-9-25 17 20M53 67h30v8H49v-5Z" fill="#c8aa71" />
    </>
  ),
  junie: (
    <>
      <path d="M24 19h49v55H24Z" fill="#b89a65" />
      <path d="M30 26h37v42H30Z" fill="#fff4da" />
      <path d="M39 15h19v13H39Z" fill="#b6b8ad" />
      <path d="m35 38 3 3 5-7m4 4h14m-26 11 3 3 5-7m4 4h14M35 60h26" />
    </>
  ),
  moss: (
    <>
      <path d="m47 41-16 32m16-32 18 32m-18-32v29" />
      <path d="m22 28 46-17 8 23-46 17Z" fill="#ba9c5c" />
      <path d="m20 27 10 26m37-43 10 26M48 42v7" />
      <path d="m35 28 27-10" stroke="#fff1c9" />
    </>
  ),
  fenn: (
    <>
      <path d="M16 28h65v42H16Z" fill="#a98255" />
      <path d="M37 28V17h23v11M16 42q33 13 65 0M43 44h12v14H43Z" fill="#d3b370" />
      <path d="M22 64h53" />
    </>
  ),
  pingo: (
    <>
      <path d="M25 13h46v62H25Z" fill="#71959f" />
      <path d="M33 13v62M41 26h23m-19 31 6-15 12-4" />
      <circle cx="45" cy="57" r="3" fill="#d8b66a" />
      <circle cx="63" cy="38" r="3" fill="#d8b66a" />
      <path d="M50 42h7v6" />
    </>
  ),
  canela: (
    <>
      <path d="M24 16h45v57H24Z" fill="#b99970" />
      <path d="M33 16v57M45 50q-8-16 5-22 17 12 4 22Zm6-17v26M18 24h11m-11 11h11m-11 11h11m-11 11h11" />
      <path d="M59 17v55" stroke="#774e3b" />
    </>
  ),
  nino: (
    <>
      <path d="M16 28q28-9 62 0-7 18 0 36-28 10-62 0 6-18 0-36Z" fill="#a9a1bd" />
      <path d="M23 34q25-5 48 0M25 60q22 5 43 0m-45-26 4 5m42-5-4 5" />
    </>
  ),
  bia: (
    <>
      <path d="M25 26h45v40q-22 12-45 0Z" fill="#d8ac59" />
      <ellipse cx="47.5" cy="26" rx="22.5" ry="8" fill="#dbc69a" />
      <path d="M24 32q23 9 47 0M31 41h33v18H31Z" fill="#f9e9bd" />
      <path d="m46 45 6 4-2 6h-6l-2-6Z" fill="#b08743" />
    </>
  ),
  quincy: (
    <>
      <path d="M26 24h43v43q-21 12-43 0Z" fill="#b6d0c2" />
      <path d="M24 17h47v10H24Z" fill="#ba9c68" />
      <path d="M35 22h3m7 0h3m7 0h3M33 65l28-7" />
      <ellipse cx="48" cy="47" rx="8" ry="10" fill="#93a264" />
      <path d="M48 38v18m-8-13-7-4m7 10-8 3m24-9 7-4m-7 10 8 3" />
    </>
  ),
  dorm: (
    <>
      <path d="M13 19v54m70-54v54M13 29q33 58 70 0" />
      <path d="M18 35q30 13 59 0-20 37-30 34Z" fill="#88a9a1" />
      <path d="M28 42q18 10 36 0m-29 8 24 7m-10-10-5 15" />
    </>
  ),
  inky: (
    <>
      <path d="M22 49h53v23H22Z" fill="#a98d68" />
      <path d="M28 55h41v11H28Z" fill="#7c6268" />
      <path d="M41 47V29q-12-19 7-19t7 19v18Z" fill="#b69160" />
      <path d="M32 45h32v8H32Z" fill="#c5b995" />
    </>
  ),
  echo: (
    <>
      <path d="M34 14v26q0 17 14 17t14-17V14h-8v26q0 8-6 8t-6-8V14Z" fill="#adbbb7" />
      <path d="M44 57v18h8V57M23 23q-8 10 0 20m51-20q8 10 0 20" />
    </>
  ),
  rosa: (
    <>
      <path d="m38 42-18 29 15-4 3 9 14-32m4-3 22 28-16-4-3 10-13-30" fill="#b97c78" />
      <path d="M46 31Q8 8 18 38q3 15 28-1 28 18 32 1Q88 8 50 31Z" fill="#d79d91" />
      <path d="M42 28h13v15H42Z" fill="#d9b375" />
    </>
  ),
  perry: (
    <>
      <path d="M28 16h42v55l-7-4-7 4-7-4-7 4-7-4-7 4Z" fill="#f7e6c0" />
      <path d="M29 17h40v13H29Z" fill="#84a3a2" />
      <path d="M36 39h25M36 47h25m-25 9h14m7 0h4" />
      <path d="M23 20v44" />
    </>
  ),
  axel: (
    <>
      <path d="M28 40h40v29q-20 11-40 0Z" fill="#b5cfbf" />
      <path d="M28 47q20 7 40 0M47 57V23" />
      <path d="M47 37Q23 37 29 20q20 0 18 17Zm1-8q-3-20 19-16 0 17-19 16Z" fill="#8da376" />
      <path d="M42 58h21v10H42Z" fill="#f8e6c2" />
    </>
  ),
};

export function KeepsakeArt({ employeeId }: { employeeId: string }) {
  const drawing = ITEMS[employeeId];
  if (!drawing) return null;
  return (
    <svg
      className="keepsake-art"
      viewBox="0 0 96 84"
      width="72"
      height="63"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="48" cy="75" rx="30" ry="3" fill="#6c5633" opacity="0.12" />
      <g
        fill="none"
        stroke="#51402c"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {drawing}
      </g>
    </svg>
  );
}
