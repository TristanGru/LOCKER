import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import { useEffect } from 'react';
import { useStore } from '../../state/store';
import { NodeDetailView } from '../detail/NodeDetailView';
import { RecordDetailView } from '../detail/RecordDetailView';

/** Slide-out detail panel for any node or source record. Esc closes it. */
export function DetailPanel() {
  const { panel, closePanel, backPanel, canGoBack } = useStore();

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePanel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panel, closePanel]);

  return (
    <AnimatePresence>
      {panel && (
        <motion.aside
          key="detail"
          aria-label="Details"
          initial={{ x: '100%', opacity: 0.4 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.4 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className="absolute inset-y-0 right-0 z-30 flex w-[32rem] max-w-[92vw] flex-col border-l border-line-strong bg-abyss-850/95 shadow-[-30px_0_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            {canGoBack && (
              <button onClick={backPanel} className="btn-ghost !px-2.5 !py-2" aria-label="Back">
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </button>
            )}
            <span className="label-caps">{panel.kind === 'node' ? 'Item detail' : 'Source record'}</span>
            <button onClick={closePanel} className="btn-ghost ml-auto !px-2.5 !py-2" aria-label="Close details">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${panel.kind}:${panel.id}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="flex-1 overflow-y-auto"
            >
              {panel.kind === 'node' ? <NodeDetailView id={panel.id} /> : <RecordDetailView id={panel.id} />}
            </motion.div>
          </AnimatePresence>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
