/**
 * LOCKER mark: a working PPI radar scope. A beam sweeps clockwise with a fading phosphor trail; each contact
 * lights up as the beam passes over it and decays until the next pass. One contact is red (the problem LOCKER
 * is tracking). Timing lives in styles/index.css (.radar-*); "reduce motion" holds it still.
 */

const C = 20; // center
const R = 15; // scope radius
const PERIOD = 4; // seconds per sweep (keep in step with --radar-period in index.css)

/** Point on the scope at a bearing measured clockwise from north (degrees). */
const at = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)] as const;
};

/** Phosphor trail: thin wedges behind the beam, fading out over ~70 degrees. */
const TRAIL = Array.from({ length: 9 }, (_, i) => {
  const a1 = -(i + 1) * 8;
  const a2 = -i * 8;
  const [x1, y1] = at(a1, R);
  const [x2, y2] = at(a2, R);
  return { d: `M${C} ${C} L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`, o: 0.42 * (1 - i / 9) ** 1.6 };
});

/** Contacts: bearing (deg), range, and whether it is the red one. */
const CONTACTS: { deg: number; r: number; risk?: boolean }[] = [
  { deg: 62, r: 9, risk: true },
  { deg: 148, r: 12 },
  { deg: 236, r: 6.5 },
  { deg: 318, r: 11.5 },
];

export function LogoMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="LOCKER radar">
      <rect x="0.5" y="0.5" width="39" height="39" rx="2" fill="rgb(var(--abyss-950))" stroke="rgb(var(--line-strong))" />
      {/* range rings and bearing lines */}
      <circle cx={C} cy={C} r={R} fill="none" stroke="rgb(var(--ink))" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx={C} cy={C} r={R * 0.62} fill="none" stroke="rgb(var(--ink))" strokeOpacity="0.28" strokeWidth="0.8" />
      <circle cx={C} cy={C} r={R * 0.28} fill="none" stroke="rgb(var(--ink))" strokeOpacity="0.2" strokeWidth="0.7" />
      <line x1={C - R} y1={C} x2={C + R} y2={C} stroke="rgb(var(--ink))" strokeOpacity="0.2" strokeWidth="0.7" />
      <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="rgb(var(--ink))" strokeOpacity="0.2" strokeWidth="0.7" />
      {[30, 60, 120, 150, 210, 240, 300, 330].map((d) => {
        const [x1, y1] = at(d, R - 1.6);
        const [x2, y2] = at(d, R);
        return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(var(--ink))" strokeOpacity="0.4" strokeWidth="0.7" />;
      })}

      {/* contacts: each brightens when the beam reaches its bearing, then decays */}
      {CONTACTS.map((c) => {
        const [x, y] = at(c.deg, c.r);
        return (
          <circle
            key={c.deg}
            className="radar-blip"
            cx={x}
            cy={y}
            r={c.risk ? 1.9 : 1.3}
            fill={c.risk ? 'rgb(var(--risk))' : 'rgb(var(--accent))'}
            style={{ animationDelay: `${((c.deg / 360) * PERIOD).toFixed(3)}s` }}
          />
        );
      })}

      {/* sweep: trail + leading edge, rotating about the center */}
      <g className="radar-sweep">
        {TRAIL.map((w, i) => (
          <path key={i} d={w.d} fill="rgb(var(--accent))" fillOpacity={w.o} />
        ))}
        <line x1={C} y1={C} x2={C} y2={C - R} stroke="rgb(var(--accent))" strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <circle cx={C} cy={C} r="1.3" fill="rgb(var(--accent))" />
    </svg>
  );
}
