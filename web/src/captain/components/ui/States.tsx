import { motion } from 'framer-motion';
import { AlertTriangle, Inbox, RotateCw, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import clsx from '../../lib/clsx';
import { pendingLoads } from '../../state/pendingLoads';
import { LogoMark } from '../layout/Logo';

/** Loading state: the sweeping LOCKER radar (same mark as the masthead and start-up screen) and a label. */
export function Loading({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={clsx('flex flex-col items-center justify-center gap-3 py-16 text-ink-muted', className)}>
      <LogoMark className="h-16 w-16" />
      <span className="text-sm font-medium">{label}…</span>
    </div>
  );
}

/** Placeholder for a lazily loaded part of a screen; counts as "still loading" so the start-up screen waits for it. */
export function PendingSkeleton({ className }: { className?: string }) {
  useEffect(() => {
    pendingLoads.start();
    return () => pendingLoads.finish();
  }, []);
  return <Skeleton className={className} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-ink/[0.06]', className)} />;
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
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-ink/[0.04]">
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
