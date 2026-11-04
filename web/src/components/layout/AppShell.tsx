import { motion } from 'framer-motion';
import { useLocation, useOutlet } from 'react-router-dom';
import { DetailPanel } from './DetailPanel';
import { Header } from './Header';
import { LeftNav } from './LeftNav';
import { StoppedBanner } from './StopControl';

export function AppShell() {
  const location = useLocation();
  const outlet = useOutlet();
  return (
    <div className="flex h-full flex-col print:block print:h-auto">
      <div className="print:hidden">
        <Header />
        <StoppedBanner />
      </div>
      <div className="flex min-h-0 flex-1 print:block">
        <div className="flex print:hidden">
          <LeftNav />
        </div>
        <main className="relative min-w-0 flex-1 overflow-hidden print:overflow-visible">
          {/* Screens fade in on arrival, but the old screen is swapped out immediately.
              No exit animation: an exit that never finishes (e.g. a screen full of
              layout-animated cards) must never be able to trap navigation. */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="h-full overflow-y-auto print:h-auto print:overflow-visible"
          >
            {outlet}
          </motion.div>
          <div className="print:hidden">
            <DetailPanel />
          </div>
        </main>
      </div>
    </div>
  );
}
