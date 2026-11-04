/**
 * Top-down destroyer hull, stern on the left, bow on the right.
 * Pure inline SVG (no image files). Pins are positioned by the parent using
 * x%/y% of this drawing, so the viewBox aspect ratio (1000 x 300) matters.
 */
export const HULL_ASPECT = 300 / 1000;

const STROKE = 'rgba(140,180,220,0.55)';
const FAINT = 'rgba(140,180,220,0.22)';
const DECK = '#0d1829';
const DECK_2 = '#111f35';

function VlsGrid({ x, y, cols, rows, cell = 10 }: { x: number; y: number; cols: number; rows: number; cell?: number }) {
  const cells = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++)
      cells.push(<rect key={`${c}-${r}`} x={x + c * cell + 1} y={y + r * cell + 1} width={cell - 2} height={cell - 2} rx={1.2} fill="#0a1424" stroke={FAINT} strokeWidth={0.8} />);
  return (
    <g>
      <rect x={x - 4} y={y - 4} width={cols * cell + 8} height={rows * cell + 8} rx={4} fill={DECK_2} stroke={STROKE} strokeWidth={1.2} />
      {cells}
    </g>
  );
}

export function ShipHull({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 300" className={className} role="img" aria-label="Top-down view of the ship, stern left, bow right">
      <defs>
        <linearGradient id="hull-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#13233b" />
          <stop offset="0.5" stopColor="#0f1d31" />
          <stop offset="1" stopColor="#13233b" />
        </linearGradient>
        <linearGradient id="wake" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="rgba(34,211,238,0.18)" />
          <stop offset="1" stopColor="rgba(34,211,238,0)" />
        </linearGradient>
      </defs>

      {/* wake behind the stern */}
      <path d="M 40 95 L 0 70 L 0 230 L 40 205 Z" fill="url(#wake)" />
      {/* bow wave */}
      <path d="M 968 150 Q 990 120 1000 108 M 968 150 Q 990 180 1000 192" stroke="rgba(34,211,238,0.25)" strokeWidth={2} fill="none" />

      {/* hull */}
      <path d="M 40 78 L 690 60 Q 870 68 972 150 Q 870 232 690 240 L 40 222 Q 30 150 40 78 Z" fill="url(#hull-fill)" stroke={STROKE} strokeWidth={2} />
      {/* deck edge / gunwale */}
      <path d="M 50 88 L 688 71 Q 852 78 948 150 Q 852 222 688 229 L 50 212 Q 42 150 50 88 Z" fill="none" stroke={FAINT} strokeWidth={1} strokeDasharray="6 5" />
      {/* centerline */}
      <line x1={50} y1={150} x2={940} y2={150} stroke={FAINT} strokeWidth={0.8} strokeDasharray="2 8" />

      {/* helo deck with landing circle */}
      <rect x={52} y={92} width={160} height={116} rx={6} fill={DECK} stroke={STROKE} strokeWidth={1.2} />
      <circle cx={132} cy={150} r={44} fill="none" stroke="rgba(251,191,36,0.55)" strokeWidth={2} />
      <circle cx={132} cy={150} r={30} fill="none" stroke="rgba(251,191,36,0.25)" strokeWidth={1} />
      <line x1={88} y1={150} x2={176} y2={150} stroke="rgba(251,191,36,0.35)" strokeWidth={1} />
      <line x1={132} y1={106} x2={132} y2={194} stroke="rgba(251,191,36,0.35)" strokeWidth={1} />
      <text x={132} y={156} textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={800} fontSize={18} fill="rgba(251,191,36,0.6)">
        H
      </text>

      {/* hangar */}
      <rect x={214} y={98} width={74} height={104} rx={4} fill={DECK_2} stroke={STROKE} strokeWidth={1.4} />
      <line x1={214} y1={150} x2={288} y2={150} stroke={FAINT} />
      <text x={251} y={214} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={10} fill="rgba(159,176,198,0.7)" letterSpacing={1.5}>
        HANGAR
      </text>

      {/* aft VLS */}
      <VlsGrid x={318} y={118} cols={8} rows={6} />

      {/* superstructure */}
      <path d="M 420 92 L 640 86 L 652 100 L 652 200 L 640 214 L 420 208 L 410 196 L 410 104 Z" fill={DECK_2} stroke={STROKE} strokeWidth={1.6} />
      {/* stack with exhausts */}
      <rect x={446} y={124} width={58} height={52} rx={14} fill="#0b1626" stroke={STROKE} strokeWidth={1.4} />
      <ellipse cx={464} cy={150} rx={8} ry={15} fill="#060b14" stroke={FAINT} />
      <ellipse cx={486} cy={150} rx={8} ry={15} fill="#060b14" stroke={FAINT} />
      {/* SATCOM domes */}
      <circle cx={510} cy={100} r={9} fill="#0b1626" stroke={STROKE} strokeWidth={1.2} />
      <circle cx={510} cy={200} r={9} fill="#0b1626" stroke={STROKE} strokeWidth={1.2} />
      {/* mast */}
      <line x1={540} y1={112} x2={540} y2={188} stroke={STROKE} strokeWidth={1.6} />
      <line x1={528} y1={150} x2={552} y2={150} stroke={STROKE} strokeWidth={1.6} />
      <circle cx={540} cy={150} r={5} fill="#0b1626" stroke={STROKE} />
      {/* forward deckhouse with radar array faces */}
      <path d="M 590 112 L 626 106 L 646 124 L 646 176 L 626 194 L 590 188 Z" fill="#0b1626" stroke={STROKE} strokeWidth={1.6} />
      <line x1={626} y1={106} x2={646} y2={124} stroke="rgba(34,211,238,0.7)" strokeWidth={3.5} />
      <line x1={626} y1={194} x2={646} y2={176} stroke="rgba(34,211,238,0.7)" strokeWidth={3.5} />
      <line x1={600} y1={112} x2={618} y2={109} stroke="rgba(34,211,238,0.5)" strokeWidth={3} />
      <line x1={600} y1={188} x2={618} y2={191} stroke="rgba(34,211,238,0.5)" strokeWidth={3} />

      {/* forward VLS */}
      <VlsGrid x={686} y={120} cols={8} rows={6} />

      {/* breakwater */}
      <path d="M 790 110 L 806 150 L 790 190" fill="none" stroke={STROKE} strokeWidth={1.4} />

      {/* 5-inch gun: turret + barrel */}
      <rect x={858} y={146} width={70} height={8} rx={3} fill="#0b1626" stroke={STROKE} strokeWidth={1.2} />
      <circle cx={844} cy={150} r={22} fill={DECK_2} stroke={STROKE} strokeWidth={1.6} />
      <circle cx={844} cy={150} r={11} fill="#0b1626" stroke={FAINT} />

      {/* labels */}
      <text x={46} y={268} fontFamily="Inter, sans-serif" fontWeight={700} fontSize={14} letterSpacing={3} fill="rgba(159,176,198,0.85)">
        STERN
      </text>
      <text x={968} y={268} textAnchor="end" fontFamily="Inter, sans-serif" fontWeight={700} fontSize={14} letterSpacing={3} fill="rgba(159,176,198,0.85)">
        BOW →
      </text>
    </svg>
  );
}
