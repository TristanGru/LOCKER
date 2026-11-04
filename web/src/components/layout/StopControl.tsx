import { AnimatePresence, motion } from 'framer-motion';
import { OctagonX, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/api';
import { useStore } from '../../state/store';

/** STOP is always visible. It halts event intake and blocks every approval until resumed. */
export function StopButton() {
  const { stopped, setStopped, bump } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function resume() {
    setBusy(true);
    try {
      await api.stop({ stopped: false });
      setStopped(false);
      bump();
    } finally {
      setBusy(false);
    }
  }

  if (stopped) {
    return (
      <button onClick={resume} disabled={busy} className="btn border-ready/60 bg-ready/15 px-5 py-3 text-base text-ready hover:bg-ready/25">
        <Play className="h-5 w-5" aria-hidden /> Resume
      </button>
    );
  }
  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="btn border-line-strong bg-transparent px-4 py-2 text-sm font-bold tracking-[0.16em] text-ink hover:border-ink-muted hover:bg-white/[0.04]"
        aria-label="STOP all LOCKER actions"
      >
        <OctagonX className="h-4 w-4" strokeWidth={2.4} aria-hidden /> STOP
      </button>
      <StopDialog open={confirming} onClose={() => setConfirming(false)} />
    </>
  );
}

function StopDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setStopped, bump } = useStore();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setReason('');
    const t = setTimeout(() => confirmRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  async function confirm() {
    setBusy(true);
    try {
      await api.stop({ stopped: true, reason: reason.trim() || undefined });
      setStopped(true);
      bump();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="stop-title"
            initial={{ scale: 0.94, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="glass-strong w-full max-w-lg border-risk/50 p-7"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-risk/20">
                <OctagonX className="h-7 w-7 text-risk" aria-hidden />
              </div>
              <h2 id="stop-title" className="text-2xl font-bold">Stop LOCKER?</h2>
            </div>
            <p className="mt-4 text-base text-ink-muted">
              This halts incoming events and blocks every approval and modification until someone presses Resume. Viewing stays available. The stop is written to the activity log.
            </p>
            <label className="mt-5 block">
              <span className="label-caps">Reason (optional)</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirm()}
                placeholder="e.g. Data looks wrong, verifying with CSO"
                className="mt-2 w-full rounded-xl border border-line bg-abyss-950/60 px-4 py-3 text-base text-ink placeholder:text-ink-dim focus:border-accent/60 focus:outline-none"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button className="btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button ref={confirmRef} className="btn border-risk bg-risk px-5 text-white hover:bg-[#ff6371]" disabled={busy} onClick={confirm}>
                <OctagonX className="h-4 w-4" aria-hidden /> Stop everything
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function StoppedBanner({ at }: { at?: string }) {
  const { stopped } = useStore();
  return (
    <AnimatePresence>
      {stopped && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div
            role="status"
            className="flex items-center gap-3 border-b border-risk/50 px-6 py-2.5 text-base font-semibold text-white"
            style={{ backgroundImage: 'repeating-linear-gradient(-45deg, rgba(251,77,93,0.55) 0 14px, rgba(251,77,93,0.35) 14px 28px)' }}
          >
            <OctagonX className="h-5 w-5" aria-hidden />
            LOCKER STOPPED{at ? ` at ${at}` : ''}. No events are processed and nothing can be approved until you press Resume.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
