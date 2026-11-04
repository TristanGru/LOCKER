import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { ShipDepartment, ShipSystem } from '../../api/types';
import clsx from '../../lib/clsx';
import { STATUS, STATUS_ORDER, fmtAge } from '../../theme/status';
import { StaleBadge } from '../ui/StaleBadge';
import { StatusBadge } from '../ui/StatusBadge';

/** One department: X/Y ready badge in its worst status color, stacked bar, a row per system. */
export function DepartmentCard({
  dept,
  systems,
  onOpen,
  index,
}: {
  dept: ShipDepartment;
  systems: ShipSystem[]; // already filtered
  onOpen: (id: string) => void;
  index: number;
}) {
  const worst = STATUS[dept.worst];
  const WorstIcon = worst.icon;
  const order = { risk: 0, watch: 1, ready: 2 } as const;
  const rows = [...systems].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="glass flex flex-col overflow-hidden"
      aria-label={dept.name}
    >
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <h3 className="text-base font-bold text-ink">{dept.name}</h3>
        <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-bold', worst.border, worst.bg, worst.text)}>
          <WorstIcon className="h-4 w-4" aria-hidden />
          <span className="num">
            {dept.ready}/{dept.total}
          </span>{' '}
          ready
        </span>
      </header>

      {/* stacked ready / watch / risk bar */}
      <div className="mx-4 flex h-2 overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label={`${dept.counts.ready} ready, ${dept.counts.watch} watch, ${dept.counts.risk} at risk`}>
        {(['ready', 'watch', 'risk'] as const).map((s) =>
          dept.counts[s] ? (
            <motion.div key={s} initial={false} animate={{ width: `${(dept.counts[s] / dept.total) * 100}%` }} transition={{ duration: 0.6 }} style={{ background: STATUS[s].hex }} />
          ) : null,
        )}
      </div>
      <div className="mx-4 mt-1.5 flex gap-3 text-[0.7rem] text-ink-dim">
        {STATUS_ORDER.filter((s) => dept.counts[s] > 0).map((s) => (
          <span key={s} className="num">
            {dept.counts[s]} {STATUS[s].label.toLowerCase()}
          </span>
        ))}
      </div>

      <ul className="mt-2 flex-1 divide-y divide-line border-t border-line">
        {rows.map((s) => (
          <li key={s.id}>
            <button onClick={() => onOpen(s.id)} className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.04]">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.92rem] font-medium text-ink" title={s.name}>
                  {s.name}
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  {s.stale ? <StaleBadge hours={s.dataAgeHours} compact /> : <span className="num text-[0.72rem] text-ink-dim">{fmtAge(s.dataAgeHours)}</span>}
                </span>
              </span>
              <StatusBadge status={s.status} size="sm" />
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-dim transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
