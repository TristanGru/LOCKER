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
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold',
        meta.text,
        meta.bg,
        meta.border,
        size === 'sm' && 'px-2 py-0.5 text-[0.72rem]',
        size === 'md' && 'px-2.5 py-1 text-sm',
        size === 'lg' && 'px-3.5 py-1.5 text-base',
        className,
      )}
    >
      <Icon className={clsx(size === 'sm' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5')} strokeWidth={2.4} aria-hidden />
      {meta.label}
    </span>
  );
}
