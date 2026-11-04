import { motion } from 'framer-motion';
import type { SourceRecord } from '../../api/types';
import clsx from '../../lib/clsx';
import { fmtAge } from '../../theme/status';
import { RecordId } from '../ui/RecordId';
import { StaleBadge } from '../ui/StaleBadge';

export function RecordCard({ record, expanded = false, index = 0 }: { record: SourceRecord; expanded?: boolean; index?: number }) {
  const fields = Object.entries(record.fields);
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index }}
      className={clsx('rounded-xl border bg-abyss-900/60 p-4', record.stale ? 'border-stale/40' : 'border-line')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RecordId id={record.id} />
        {record.stale ? <StaleBadge hours={record.ageHours} compact /> : <span className="num text-xs text-ink-dim">{fmtAge(record.ageHours)}</span>}
      </div>
      <div className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-dim">{record.system}</div>
      <h4 className="mt-0.5 text-base font-semibold text-ink">{record.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{record.summary}</p>
      {fields.length > 0 && (
        <dl className={clsx('mt-3 grid gap-x-4 gap-y-1.5 border-t border-line pt-3 text-sm', expanded ? 'grid-cols-1' : 'grid-cols-[auto_1fr]')}>
          {fields.map(([k, v]) =>
            expanded ? (
              <div key={k} className="flex justify-between gap-4 border-b border-line/50 pb-1.5 last:border-0">
                <dt className="text-ink-dim">{k}</dt>
                <dd className="num text-right text-ink">{v}</dd>
              </div>
            ) : (
              <div key={k} className="contents">
                <dt className="text-ink-dim">{k}</dt>
                <dd className="num text-ink">{v}</dd>
              </div>
            ),
          )}
        </dl>
      )}
      {expanded && (
        <p className="mt-3 text-xs text-ink-dim">
          Reported <span className="num">{new Date(record.asOf).toLocaleString()}</span>. Read-only copy; LOCKER never edits source systems.
        </p>
      )}
    </motion.article>
  );
}
