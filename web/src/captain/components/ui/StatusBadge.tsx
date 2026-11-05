import clsx from '../../lib/clsx';
import type { Status } from '../../api/types';
import { STATUS } from '../../theme/status';

interface Props {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ status, size = 'md', className }: Props) {
  const meta = STATUS[status];
  const Icon = meta.icon;
  return (
    <span
      className={clsx(
        // Status tag: square, icon + word (never color alone), tinted fill with a solid status edge.
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border border-l-[3px] font-semibold uppercase tracking-[0.04em]',
        meta.text,
        meta.bg,
        meta.border,
        size === 'sm' && 'px-1.5 py-px text-[0.68rem]',
        size === 'md' && 'px-2 py-0.5 text-[0.78rem]',
        size === 'lg' && 'px-2.5 py-1 text-[0.9rem]',
        className,
      )}
    >
      <Icon className={clsx(size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-3.5 w-3.5' : 'h-4 w-4')} strokeWidth={2.5} aria-hidden />
      {meta.label}
    </span>
  );
}
