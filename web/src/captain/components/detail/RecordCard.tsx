import { motion } from 'framer-motion';
import type { SourceRecord } from '../../api/types';
import clsx from '../../lib/clsx';
import { fmtAge } from '../../theme/status';
import { RecordId } from '../ui/RecordId';
import { StaleBadge } from '../ui/StaleBadge';

/**
 * One source record. Shows only the cited part of the source (a CSV row as column/value pairs, or the cited
 * line with a little context), and every value wraps so nothing runs past the panel edge.
 */
export function RecordCard({ record, expanded = false, index = 0 }: { record: SourceRecord; expanded?: boolean; index?: number }) {
  const fields = Object.entries(record.fields).filter(([, v]) => v);
  const ex = record.excerpt;
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index }}
      className={clsx('min-w-0 overflow-hidden rounded border bg-abyss-900 p-4', record.stale ? 'border-stale/60' : 'border-line')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RecordId id={record.id} />
        {record.stale ? <StaleBadge hours={record.ageHours} compact /> : <span className="num text-xs text-ink-dim">{fmtAge(record.ageHours)}</span>}
      </div>
      <div className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-dim">{record.system}</div>
      <h4 className="mt-0.5 break-words text-base font-semibold text-ink">{record.title}</h4>

      {fields.length > 0 && (
        <dl className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-line pt-3 text-sm">
          {fields.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="capitalize text-ink-dim">{k}</dt>
              <dd className="min-w-0 break-all font-mono text-[0.8rem] text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {ex?.kind === 'row' && ex.pairs.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-dim">Cited row</div>
          <dl className="grid grid-cols-[minmax(6rem,38%)_minmax(0,1fr)] border-t border-line text-[0.82rem]">
            {ex.pairs.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="border-b border-line/70 py-1 pr-3 capitalize text-ink-dim">{k}</dt>
                <dd className="min-w-0 break-words border-b border-line/70 py-1 text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {ex?.kind === 'lines' && ex.lines.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-dim">Cited text</div>
          <div className="max-h-48 overflow-y-auto rounded-sm border border-line bg-abyss-800 font-mono text-[0.76rem] leading-relaxed">
            {ex.lines.map((l) => (
              <div key={l.n} className={clsx('grid grid-cols-[2.5rem_minmax(0,1fr)]', l.hit && 'bg-accent/10 font-semibold text-ink')}>
                <span className="select-none border-r border-line px-1.5 text-right text-ink-dim">{l.n}</span>
                <span className={clsx('whitespace-pre-wrap break-words px-2', !l.hit && 'text-ink-muted')}>{l.text || ' '}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <p className="mt-3 text-xs text-ink-dim">
          Reported <span className="num">{new Date(record.asOf).toLocaleString()}</span>. Read-only copy; LOCKER never edits source systems.
        </p>
      )}
    </motion.article>
  );
}
