export function AnnexArchitecture({ roomId }: { roomId: string }) {
  if (!['broadcast', 'repair', 'conservatory'].includes(roomId)) return null;
  return (
    <svg
      className="annex-architecture"
      viewBox="0 0 600 220"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {roomId === 'broadcast' ? (
        <>
          <path d="M0 0h600v220H0Z" fill="#b2a58e" />
          {[0, 42, 84, 476, 518, 560].map((x) => (
            <g key={x}>
              <path d={`M${x} 0h34v220h-34Z`} fill="#897a65" />
              {Array.from({ length: 10 }, (_, i) => (
                <path key={i} d={`M${x + 5} ${i * 23 + 5}h24v13h-24Z`} fill="#9d8c74" />
              ))}
            </g>
          ))}
          <rect
            x="147"
            y="29"
            width="306"
            height="150"
            rx="8"
            fill="#555d54"
            stroke="#c1ad8b"
            strokeWidth="12"
          />
          <path d="M163 44h273v120H163Z" fill="#879890" />
          <path
            d="m163 121 100-77h45l-145 113m111 7 144-120h18L292 164"
            fill="#d0d5bd"
            opacity=".25"
          />
          <path d="M155 190h290v10H155Z" fill="#716450" />
          <rect x="275" y="10" width="50" height="10" fill="#ac715e" />
        </>
      ) : roomId === 'repair' ? (
        <>
          <path d="M0 0h600v220H0Z" fill="#d0d0bd" />
          {Array.from({ length: 7 }, (_, i) => (
            <path key={i} d={`M0 ${i * 34}h600M${i * 90} 0v220`} stroke="#b6b9a6" />
          ))}
          <rect
            x="310"
            y="5"
            width="270"
            height="215"
            fill="#8f9a90"
            stroke="#687367"
            strokeWidth="8"
          />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M316 ${i * 27 + 10}h258`} stroke="#6c786d" strokeWidth="3" />
          ))}
          <path d="M22 0v54h200V0" fill="none" stroke="#929e8a" strokeWidth="8" />
          <path d="M50 72h150v7H50Z" fill="#ece5c4" />
          <path d="M22 210h265" stroke="#a58948" strokeWidth="8" strokeDasharray="20 10" />
        </>
      ) : (
        <>
          <path d="M0 220V0h600v220Z" fill="#b8c9bd" />
          <path d="M0 220V55Q300-100 600 55v165" fill="#ccd6c2" />
          {[0, 100, 200, 300, 400, 500, 600].map((x) => (
            <path
              key={x}
              d={`M300 -50 Q${x} 20 ${x} 220`}
              fill="none"
              stroke="#75897b"
              strokeWidth="5"
            />
          ))}
          <path
            d="M0 93Q300-15 600 93M0 164Q300 92 600 164"
            fill="none"
            stroke="#849988"
            strokeWidth="4"
          />
          <path
            d="M0 200q45-40 90 0t90 0t90 0t90 0t90 0t90 0t90 0"
            fill="none"
            stroke="#99b29a"
            strokeWidth="15"
            opacity=".4"
          />
          <path d="M0 216h600" stroke="#6e8576" strokeWidth="8" />
        </>
      )}
    </svg>
  );
}
