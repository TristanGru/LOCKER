import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Freshness } from '../../api/types';
import clsx from '../../lib/clsx';
import { fmtAge } from '../../theme/status';
import { StaleBadge } from '../ui/StaleBadge';

export function FreshnessIndicator({ freshness }: { freshness: Freshness | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!freshness) {
    return <div className="h-11 w-56 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  const anyStale = freshness.staleCount > 0;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={
          anyStale
            ? `${freshness.staleCount} of ${freshness.feeds.length} feeds stale, oldest ${fmtAge(freshness.oldestHours)}`
            : `All ${freshness.feeds.length} feeds current`
        }
        className={clsx(
          'flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition',
          anyStale ? 'border-watch/55 text-watch hover:bg-watch/10' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
        )}
      >
        <span>
          {anyStale
            ? `${freshness.staleCount} of ${freshness.feeds.length} stale · ${fmtAge(freshness.oldestHours).replace(' old', '')}`
            : `All ${freshness.feeds.length} feeds current`}
        </span>
        <ChevronDown className={clsx('h-4 w-4 transition', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="glass-strong absolute right-0 top-[calc(100%+8px)] z-50 w-80 p-2"
          >
            <p className="label-caps px-3 pb-2 pt-2">Source feeds</p>
            <ul>
              {freshness.feeds.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.03]">
                  <span className="text-sm text-ink">{f.label}</span>
                  {f.stale ? <StaleBadge hours={f.ageHours} compact /> : <span className="num text-sm text-ink-muted">{fmtAge(f.ageHours)}</span>}
                </li>
              ))}
            </ul>
            <p className="px-3 pb-2 pt-2 text-sm text-ink-muted">Feeds older than 24 h are marked stale.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
