import { motion } from 'framer-motion';
import { Database, DatabaseZap } from 'lucide-react';
import type { Freshness } from '../../api/types';
import clsx from '../../lib/clsx';
import { fmtAge } from '../../theme/status';
import { StaleBadge } from '../ui/StaleBadge';

/** Data-freshness banner for the top of the overview. */
export function FreshnessBanner({ freshness }: { freshness: Freshness }) {
  const stale = freshness.feeds.filter((f) => f.stale);
  const fresh = freshness.feeds.filter((f) => !f.stale);
  const anyStale = stale.length > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      className={clsx('glass flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3', anyStale && 'border-stale/45')}
    >
      <div className="flex items-center gap-3">
        <div className={clsx('grid h-11 w-11 place-items-center rounded-xl border', anyStale ? 'stale-stripes border-stale/50' : 'border-ready/40 bg-ready-soft')}>
          {anyStale ? <DatabaseZap className="h-6 w-6 text-slate-100" aria-hidden /> : <Database className="h-6 w-6 text-ready" aria-hidden />}
        </div>
        <div className="leading-tight">
          <div className="text-lg font-semibold text-ink">
            {anyStale ? `${stale.length} of ${freshness.feeds.length} data feeds are stale` : 'All data feeds are current'}
          </div>
          <div className="text-sm text-ink-muted">
            {anyStale ? 'Items using stale data show a striped age badge. Confirm them before acting.' : 'Every feed reported in the last 24 hours.'}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        {stale.map((f) => (
          <span key={f.id} className="inline-flex items-center gap-2 rounded-lg border border-stale/40 bg-white/[0.03] px-2.5 py-1.5 text-sm text-ink">
            {f.label} <StaleBadge hours={f.ageHours} compact />
          </span>
        ))}
        {fresh.length > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border border-ready/30 px-2.5 py-1.5 text-sm text-ink-muted"
            title={fresh.map((f) => `${f.label}: ${fmtAge(f.ageHours)}`).join(', ')}
          >
            <span className="font-semibold text-ready">{fresh.length}</span> feeds current
            <span className="num text-xs text-ink-dim">(newest {fmtAge(Math.min(...fresh.map((f) => f.ageHours)))})</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}
