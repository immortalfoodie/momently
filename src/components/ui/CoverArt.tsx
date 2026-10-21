export interface CoverArtProps {
  seed: string;
  palette?: string[];
  className?: string;
  height?: number;
}

const DEFAULT_PALETTE = ['#6B2D5C', '#D4A24C', '#F4EDE6', '#2E4057'];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic decorative SVG cover generated from a seed string and a color palette.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Decorative graphic acting as a lightweight, zero-dependency photo stand-in.
 * Strictly enforces `aria-hidden="true"` so assistive screen readers ignore decorative
 * SVG geometry.
 */
export function CoverArt({
  seed,
  palette = DEFAULT_PALETTE,
  className = '',
  height = 180,
}: CoverArtProps) {
  const hash = hashSeed(seed);
  const colors = palette.length >= 3 ? palette : DEFAULT_PALETTE;

  const c1 = colors[hash % colors.length] ?? colors[0]!;
  const c2 = colors[(hash + 1) % colors.length] ?? colors[1]!;
  const c3 = colors[(hash + 2) % colors.length] ?? colors[2]!;

  const showLights = hash % 2 === 0;
  const gradId1 = `cov-g1-${hash}`;
  const gradId2 = `cov-g2-${hash}`;

  const blob1X = 100 + (hash % 200);
  const blob1Y = 40 + ((hash >> 2) % 60);
  const blob2X = 350 + ((hash >> 4) % 180);
  const blob2Y = 100 + ((hash >> 3) % 70);

  return (
    <svg
      viewBox="0 0 600 200"
      preserveAspectRatio="xMidYMid slice"
      style={{ height }}
      aria-hidden="true"
      className={`w-full rounded-[14px] overflow-hidden ${className}`}
    >
      <defs>
        <radialGradient id={gradId1} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={c1} stopOpacity="0.85" />
          <stop offset="100%" stopColor={c2} stopOpacity="0.3" />
        </radialGradient>
        <radialGradient id={gradId2} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={c3} stopOpacity="0.75" />
          <stop offset="100%" stopColor={c1} stopOpacity="0.15" />
        </radialGradient>
      </defs>

      {/* Warm studio backdrop */}
      <rect width="600" height="200" fill="#F4EDE6" />

      {/* Layered soft gradient ambient blobs */}
      <circle cx={blob1X} cy={blob1Y} r="120" fill={`url(#${gradId1})`} />
      <circle cx={blob2X} cy={blob2Y} r="140" fill={`url(#${gradId2})`} />

      {showLights ? (
        // String of celebratory warm festoon lights
        <g stroke="#D4A24C" strokeWidth="1.5" fill="none" opacity="0.85">
          <path d="M 0,30 Q 150,90 300,50 T 600,60" />
          {[60, 140, 220, 300, 380, 460, 540].map((cx, idx) => (
            <circle
              key={cx}
              cx={cx}
              cy={30 + Math.sin(idx) * 20 + 25}
              r={4}
              fill="#FFFFFF"
              stroke="#D4A24C"
              strokeWidth="2"
            />
          ))}
        </g>
      ) : (
        // Festive confetti and star sparkle accents
        <g fill="#D4A24C" opacity="0.7">
          {[
            [50, 40],
            [120, 130],
            [220, 50],
            [320, 120],
            [430, 45],
            [510, 110],
          ].map(([x, y], idx) => (
            <rect
              key={idx}
              x={x}
              y={y}
              width="6"
              height="6"
              rx="1"
              transform={`rotate(${(hash + idx * 30) % 360} ${x} ${y})`}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
