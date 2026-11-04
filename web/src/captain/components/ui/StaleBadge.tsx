import { Clock } from 'lucide-react';
import clsx from '../../lib/clsx';
import { fmtAge } from '../../theme/status';

/** Grey striped badge showing data age, e.g. "30 h old". */
export function StaleBadge({ hours, className, compact }: { hours: number; className?: string; compact?: boolean }) {
  return (
    <span
      title={`Source data is ${fmtAge(hours)}. Confirm before acting.`}
      className={clsx(
        'stale-stripes inline-flex items-center gap-1.5 rounded-full border border-stale/50 font-semibold text-slate-200',
        compact ? 'px-2 py-0.5 text-[0.7rem]' : 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden />
      <span className="num">{fmtAge(hours)}</span>
    </span>
  );
}
