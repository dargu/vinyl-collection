// cover-art.jsx — deterministic generated sleeve art (since we don't have real cover URLs)
// Each sleeve is built from a hash of artist+album so the same record always looks the same.

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function srand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0;
    return ((s ^= s >>> 16) >>> 0) / 4294967296;
  };
}

// Curated palette — restrained, gallery-like. No neon, no candy.
const COVER_PALETTES = [
  ["#0E0E0E", "#E8E4D9"], // ink / cream
  ["#1A1A1A", "#C8C2B2"], // ink / stone
  ["#0A0A0A", "#9A8F7A"], // ink / olive
  ["#FAFAF7", "#0E0E0E"], // cream / ink
  ["#1F2A2E", "#C8C2B2"], // teal-black / stone
  ["#3B2C1E", "#E8E4D9"], // espresso / cream
  ["#5C2018", "#E8E4D9"], // oxblood / cream
  ["#1B2A4E", "#E8E4D9"], // navy / cream
  ["#2E3A2A", "#E8E4D9"], // forest / cream
  ["#7A3413", "#E8E4D9"], // rust / cream
  ["#0E0E0E", "#B89D52"], // ink / brass
  ["#3D3127", "#D6C9A8"], // umber / sand
];

function CoverArt({ artist, album, size = 200, mono = false, coverUrl = null }) {
  // Real cover art from Discogs, when we have it. Falls back to the
  // generated sleeve below only for records Discogs had no match for
  // (as of this import, just one: Monairem's "Moonscape").
  const [imgFailed, setImgFailed] = React.useState(false);
  if (coverUrl && !imgFailed) {
    return (
      <img
        src={coverUrl}
        alt={`${album} — ${artist}`}
        loading="lazy"
        onError={() => setImgFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }
  const seed = hashStr(artist + "·" + album);
  const r = srand(seed);
  const variant = Math.floor(r() * 7);
  const palette = COVER_PALETTES[Math.floor(r() * COVER_PALETTES.length)];
  const [bg, fg] = mono ? ["#0E0E0E", "#E8E4D9"] : palette;
  const initials = (artist || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const w = size, h = size;

  // Each variant is a different abstract sleeve composition
  let inner = null;
  if (variant === 0) {
    // Concentric circles (record-like)
    const cx = w / 2, cy = h / 2;
    inner = (
      <g>
        {[0.9, 0.7, 0.5, 0.3, 0.15].map((k, i) => (
          <circle key={i} cx={cx} cy={cy} r={(w / 2) * k} fill="none" stroke={fg} strokeWidth={i === 4 ? 2 : 0.6} opacity={0.8} />
        ))}
        <circle cx={cx} cy={cy} r={w * 0.04} fill={fg} />
      </g>
    );
  } else if (variant === 1) {
    // Horizontal bands
    const bands = 4 + Math.floor(r() * 3);
    inner = (
      <g>
        {Array.from({ length: bands }).map((_, i) => {
          const y = (h / bands) * i;
          const bh = h / bands;
          const fill = i % 2 === 0 ? fg : bg;
          return <rect key={i} x={0} y={y} width={w} height={bh * 0.35} fill={fill} opacity={i % 2 === 0 ? 1 : 0} />;
        })}
        <text x={w * 0.08} y={h * 0.92} fill={fg} fontFamily="ui-monospace, monospace" fontSize={w * 0.07} letterSpacing={1.5}>
          {(album || "").slice(0, 14).toUpperCase()}
        </text>
      </g>
    );
  } else if (variant === 2) {
    // Big initials Helvetica-style
    inner = (
      <text
        x={w / 2}
        y={h / 2 + w * 0.13}
        fill={fg}
        fontFamily="'Inter Tight', 'Helvetica Neue', sans-serif"
        fontSize={w * 0.5}
        fontWeight={800}
        textAnchor="middle"
        letterSpacing={-w * 0.01}
      >
        {initials}
      </text>
    );
  } else if (variant === 3) {
    // Single big circle
    const off = (r() - 0.5) * w * 0.3;
    inner = (
      <g>
        <circle cx={w / 2 + off} cy={h / 2} r={w * 0.32} fill={fg} />
        <text x={w * 0.08} y={h * 0.94} fill={fg} fontFamily="ui-monospace, monospace" fontSize={w * 0.05} letterSpacing={1.2}>
          {(artist || "").slice(0, 18).toUpperCase()}
        </text>
      </g>
    );
  } else if (variant === 4) {
    // Diagonal split
    inner = (
      <g>
        <polygon points={`0,0 ${w},0 0,${h}`} fill={fg} opacity={0.92} />
        <text x={w * 0.55} y={h * 0.6} fill={fg} fontFamily="'Inter Tight', sans-serif" fontSize={w * 0.16} fontWeight={700}>
          {initials}
        </text>
      </g>
    );
  } else if (variant === 5) {
    // Vertical stripes (right side)
    const cols = 7 + Math.floor(r() * 4);
    inner = (
      <g>
        {Array.from({ length: cols }).map((_, i) => {
          const x = w * 0.5 + (w * 0.5 / cols) * i;
          return <rect key={i} x={x} y={h * 0.1} width={(w * 0.5 / cols) * 0.55} height={h * 0.8} fill={fg} opacity={0.85} />;
        })}
        <text x={w * 0.08} y={h * 0.5} fill={fg} fontFamily="'Inter Tight', sans-serif" fontSize={w * 0.13} fontWeight={700}>
          {initials}
        </text>
      </g>
    );
  } else {
    // Grid of dots
    const n = 5 + Math.floor(r() * 3);
    const dots = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cx = w * 0.18 + ((w * 0.64) / (n - 1)) * i;
        const cy = h * 0.18 + ((h * 0.64) / (n - 1)) * j;
        const rad = (r() < 0.7) ? w * 0.018 : w * 0.038;
        dots.push(<circle key={`${i}-${j}`} cx={cx} cy={cy} r={rad} fill={fg} />);
      }
    }
    inner = <g>{dots}</g>;
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block" }}
    >
      <rect x={0} y={0} width={w} height={h} fill={bg} />
      {inner}
      {/* subtle inner edge to read like a paper sleeve */}
      <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="none" stroke="#000" strokeWidth={0.5} opacity={0.18} />
    </svg>
  );
}

window.CoverArt = CoverArt;
window.hashStr = hashStr;
