import { ChevronRight } from 'lucide-react';
import type { ShipDepartment, ShipSystem } from '../../api/types';
import clsx from '../../lib/clsx';
import { STATUS, fmtAge, pct } from '../../theme/status';
import { StaleBadge } from '../ui/StaleBadge';
import { StatusBadge } from '../ui/StatusBadge';

const ORDER = { unknown: 0, risk: 1, watch: 2, ready: 3 } as const;

/** Short label for where the odds come from; the full sentence stays in the tooltip. */
const basis = (reason: string) =>
  /^Worst scheduled event-interval requirement/.test(reason)
    ? 'Scheduled event requirement'
    : /^Material capability/.test(reason)
      ? 'Material condition (no event depends on it)'
      : /^Insufficient evidence/.test(reason)
        ? 'Insufficient evidence'
        : reason;

/**
 * Every system in one table, grouped by department, worst first. A table reads faster than a grid of cards
 * for a briefing audience: names are never truncated and columns line up for comparison.
 */
export function SystemsTable({ departments, systems, onOpen }: { departments: ShipDepartment[]; systems: ShipSystem[]; onOpen: (id: string) => void }) {
  const groups = departments
    .map((d) => ({ d, rows: systems.filter((s) => s.department === d.id).sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name)) }))
    .filter((g) => g.rows.length)
    .sort((a, b) => ORDER[a.d.worst] - ORDER[b.d.worst] || a.d.name.localeCompare(b.d.name));

  return (
    <div className="overflow-x-auto rounded border border-line bg-abyss-900">
      <table className="w-full min-w-[46rem] border-collapse text-left text-[0.92rem]">
        <thead>
          <tr className="border-b border-line-strong bg-abyss-800 text-[0.74rem] font-semibold uppercase tracking-[0.05em] text-ink-muted">
            <th scope="col" className="px-4 py-2.5">System</th>
            <th scope="col" className="w-[8.5rem] px-3 py-2.5">Status</th>
            <th scope="col" className="w-[5rem] px-3 py-2.5 text-right">Odds</th>
            <th scope="col" className="px-3 py-2.5">Basis</th>
            <th scope="col" className="w-[8rem] px-3 py-2.5">Data</th>
            <th scope="col" className="w-10 px-2 py-2.5">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        {groups.map(({ d, rows }) => (
          <tbody key={d.id}>
            <tr className="border-b border-line bg-abyss-800/60">
              <th scope="rowgroup" colSpan={6} className="px-4 py-2">
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-ink">{d.name}</span>
                  <span className="num text-sm text-ink-muted">
                    {d.ready} of {d.total} ready
                  </span>
                  <span className="ml-auto flex h-1.5 w-32 overflow-hidden bg-line" role="img" aria-label={`${d.counts.ready} ready, ${d.counts.watch} watch, ${d.counts.risk} at risk`}>
                    {(['risk', 'watch', 'ready'] as const).map((st) =>
                      d.counts[st] ? <span key={st} style={{ width: `${(d.counts[st] / d.total) * 100}%`, background: STATUS[st].hex }} /> : null,
                    )}
                  </span>
                </span>
              </th>
            </tr>
            {rows.map((s) => (
              <tr
                key={s.id}
                onClick={() => onOpen(s.id)}
                className={clsx('group cursor-pointer border-b border-line last:border-b-0 hover:bg-abyss-800', s.isNextDomino && 'bg-risk/[0.05]')}
              >
                <td className="px-4 py-2.5">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(s.id); }} className="text-left font-medium text-ink hover:underline">
                    {s.name}
                  </button>
                  <span className="ml-2 font-mono text-[0.72rem] text-ink-dim">{s.tag}</span>
                  {s.isNextDomino && <span className="ml-2 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-risk">Next domino</span>}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={s.status} size="sm" />
                </td>
                <td className={clsx('num px-3 py-2.5 text-right font-semibold', STATUS[s.status].text)}>{s.p != null && Number.isFinite(s.p) ? pct(s.p) : '—'}</td>
                <td className="px-3 py-2.5 text-[0.84rem] leading-snug text-ink-muted" title={s.reason}>
                  {basis(s.reason)}
                </td>
                <td className="px-3 py-2.5 text-[0.8rem] text-ink-muted">{s.stale ? <StaleBadge hours={s.dataAgeHours} compact /> : <span className="num">{fmtAge(s.dataAgeHours)}</span>}</td>
                <td className="px-2 py-2.5 text-ink-dim">
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
