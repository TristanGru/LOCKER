/** LOCKER mark: radar scope with a sweep and one red contact. */
export function LogoMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="lk-sweep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="39" rx="10" fill="#08101c" stroke="rgba(140,180,220,0.25)" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="#22d3ee" strokeOpacity="0.55" strokeWidth="1.3" />
      <circle cx="20" cy="20" r="7.5" fill="none" stroke="#22d3ee" strokeOpacity="0.3" strokeWidth="1.1" />
      <line x1="7" y1="20" x2="33" y2="20" stroke="#22d3ee" strokeOpacity="0.15" />
      <line x1="20" y1="7" x2="20" y2="33" stroke="#22d3ee" strokeOpacity="0.15" />
      <g style={{ transformOrigin: '20px 20px' }} className="animate-sweep">
        <path d="M20 20 L20 7 A13 13 0 0 1 31.3 13.5 Z" fill="url(#lk-sweep)" opacity="0.55" />
        <line x1="20" y1="20" x2="20" y2="7" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <circle cx="26.5" cy="24.5" r="2.1" fill="#fb4d5d" />
      <circle cx="20" cy="20" r="1.4" fill="#22d3ee" />
    </svg>
  );
}
