import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { ClassificationBanner } from './ClassificationBanner';
import { DetailPanel } from './DetailPanel';
import { Header } from './Header';
import { LeftNav } from './LeftNav';
import { StoppedBanner } from './StopControl';

export function AppShell() {
  const location = useLocation();
  const outlet = useOutlet();
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // The sticky header (banner + masthead, + STOPPED banner when shown) and bottom banner change height,
  // so measure them live; the sticky side menu sits exactly between them.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      root.style.setProperty('--chrome-top', `${topRef.current?.offsetHeight ?? 0}px`);
      root.style.setProperty('--chrome-bottom', `${bottomRef.current?.offsetHeight ?? 0}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    if (topRef.current) ro.observe(topRef.current);
    if (bottomRef.current) ro.observe(bottomRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-full flex-col print:block print:h-auto">
      {/* Markings stay on screen while the page scrolls, as on DoD systems. */}
      <div ref={topRef} className="sticky top-0 z-50 print:hidden">
        <ClassificationBanner position="top" />
        <div className="print:hidden">
          <Header />
          <StoppedBanner />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 print:block">
        {/* Side menu follows the page: pinned under the header, as tall as the visible area. */}
        <div
          className="sticky z-40 flex self-start print:hidden"
          style={{ top: 'var(--chrome-top, 0px)', height: 'calc(100vh - var(--chrome-top, 0px) - var(--chrome-bottom, 0px))' }}
        >
          <LeftNav />
        </div>
        <main className="relative min-w-0 flex-1 overflow-hidden print:overflow-visible">
          {/* Screens fade in on arrival, but the old screen is swapped out immediately.
              No exit animation: an exit that never finishes (e.g. a screen full of
              layout-animated cards) must never be able to trap navigation. */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12 }}
            className="h-full overflow-y-auto print:h-auto print:overflow-visible"
          >
            {outlet}
          </motion.div>
          <div className="print:hidden">
            <DetailPanel />
          </div>
        </main>
      </div>
      <div ref={bottomRef} className="sticky bottom-0 z-50 print:hidden">
        <ClassificationBanner position="bottom" />
      </div>
    </div>
  );
}
