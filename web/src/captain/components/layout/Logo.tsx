/** LOCKER mark: radar scope with a sweep and one red contact. */
export function LogoMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="lk-sweep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--accent))" stopOpacity="0.9" />
          <stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="39" rx="10" fill="rgb(var(--abyss-850))" stroke="rgb(var(--line))" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="rgb(var(--accent))" strokeOpacity="0.7" strokeWidth="1.3" />
      <circle cx="20" cy="20" r="7.5" fill="none" stroke="rgb(var(--accent))" strokeOpacity="0.4" strokeWidth="1.1" />
      <line x1="7" y1="20" x2="33" y2="20" stroke="rgb(var(--accent))" strokeOpacity="0.25" />
      <line x1="20" y1="7" x2="20" y2="33" stroke="rgb(var(--accent))" strokeOpacity="0.25" />
      <g style={{ transformOrigin: '20px 20px' }} className="animate-sweep">
        <path d="M20 20 L20 7 A13 13 0 0 1 31.3 13.5 Z" fill="url(#lk-sweep)" opacity="0.55" />
        <line x1="20" y1="20" x2="20" y2="7" stroke="rgb(var(--accent))" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <circle cx="26.5" cy="24.5" r="2.1" fill="rgb(var(--risk))" />
      <circle cx="20" cy="20" r="1.4" fill="rgb(var(--accent))" />
    </svg>
  );
}
