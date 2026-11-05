import { useEffect, useState, type ReactNode } from 'react';
import { pendingLoads } from '../../state/pendingLoads';
import { ClassificationBanner } from './ClassificationBanner';
import { LogoMark } from './Logo';

const SHOW_AFTER_MS = 250; // data faster than this: no start-up screen at all
const QUIET_MS = 150; // nothing pending for this long = the first screen has its data
const GIVE_UP_MS = 20000; // never trap the user; screens show their own errors

type Phase = 'cover' | 'boot' | 'done';

/**
 * Start-up: the app renders underneath right away (so its requests start), hidden until the first screen
 * has its data. Fast loads go straight to the app; slower ones show the sweeping radar until data arrives.
 */
export function BootScreen({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('cover');

  useEffect(() => {
    if (phase === 'done') return;
    let quiet: number | undefined;
    const finish = () => setPhase('done');
    const check = () => {
      window.clearTimeout(quiet);
      if (pendingLoads.get() === 0) quiet = window.setTimeout(() => pendingLoads.get() === 0 && finish(), QUIET_MS);
    };
    const show = window.setTimeout(() => setPhase((p) => (p === 'cover' ? 'boot' : p)), SHOW_AFTER_MS);
    const giveUp = window.setTimeout(finish, GIVE_UP_MS);
    const unsub = pendingLoads.subscribe(check);
    const first = window.setTimeout(check, 0); // after the first render has registered its loads
    return () => {
      unsub();
      [quiet, show, giveUp, first].forEach((t) => window.clearTimeout(t));
    };
  }, [phase === 'done']); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {children}
      {phase === 'cover' && <div className="fixed inset-0 z-[200] bg-abyss-950" aria-hidden />}
      {phase === 'boot' && (
        <div className="on-navy fixed inset-0 z-[200] flex flex-col bg-masthead">
          <ClassificationBanner position="top" />
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center" role="status" aria-live="polite">
            <LogoMark className="h-28 w-28" />
            <div>
              <div className="text-[2.4rem] font-bold leading-none tracking-[0.18em] text-ink">LOCKER</div>
              <div className="mt-2 text-sm font-medium uppercase tracking-[0.12em] text-ink-dim">Readiness decision support</div>
            </div>
            <p className="text-sm text-ink-muted">Loading exercise data…</p>
          </div>
          <ClassificationBanner position="bottom" />
        </div>
      )}
    </>
  );
}
