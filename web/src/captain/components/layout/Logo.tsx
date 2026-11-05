/** LOCKER mark: a plain scope reticle with one contact. Static, no sweep animation. */
export function LogoMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect x="0.5" y="0.5" width="39" height="39" rx="2" fill="none" stroke="rgb(var(--line-strong))" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="rgb(var(--ink))" strokeWidth="1.6" />
      <circle cx="20" cy="20" r="7" fill="none" stroke="rgb(var(--ink))" strokeOpacity="0.55" strokeWidth="1.2" />
      <line x1="4" y1="20" x2="36" y2="20" stroke="rgb(var(--ink))" strokeOpacity="0.45" strokeWidth="1" />
      <line x1="20" y1="4" x2="20" y2="36" stroke="rgb(var(--ink))" strokeOpacity="0.45" strokeWidth="1" />
      <rect x="25" y="23" width="4" height="4" fill="rgb(var(--risk))" />
    </svg>
  );
}
