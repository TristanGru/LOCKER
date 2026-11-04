import { motion } from 'framer-motion';
import { AlertTriangle, Inbox, RotateCw, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import clsx from '../../lib/clsx';

/** Radar-sweep loading state. */
export function Loading({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={clsx('flex flex-col items-center justify-center gap-5 py-16 text-ink-muted', className)}>
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 rounded-full border border-accent/30" />
        <div className="absolute inset-[22%] rounded-full border border-accent/20" />
        <div
          className="absolute inset-0 animate-sweep rounded-full"
          style={{ background: 'conic-gradient(from 0deg, rgba(34,211,238,0.55), rgba(34,211,238,0) 28%)' }}
        />
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
      </div>
      <span className="label-caps animate-blink">{label}…</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-white/[0.05]', className)} />;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}
    >
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-white/[0.03]">
        <Icon className="h-8 w-8 text-ink-dim" aria-hidden />
      </div>
      <h3 className="text-xl font-semibold text-ink">{title}</h3>
      {children && <div className="max-w-md text-base text-ink-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className={clsx('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-risk/50 bg-risk-soft">
        <AlertTriangle className="h-8 w-8 text-risk" aria-hidden />
      </div>
      <h3 className="text-xl font-semibold text-ink">Couldn't load this</h3>
      <p className="max-w-md text-base text-ink-muted">{message}</p>
      {onRetry && (
        <button className="btn-ghost mt-2" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}
