import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AskDavey } from '../davey/AskDavey';
import { DaveyProvider } from '../../state/davey';
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

  // The sticky header and bottom banner change height, so keep the side menu between them.
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
    <DaveyProvider>
      <div className="flex h-full flex-col print:block print:h-auto">
        <div ref={topRef} className="sticky top-0 z-50 print:hidden">
          <ClassificationBanner position="top" />
          <Header />
          <StoppedBanner />
        </div>
        <div className="flex min-h-0 flex-1 print:block">
          <div
            className="sticky z-40 flex self-start print:hidden"
            style={{ top: 'var(--chrome-top, 0px)', height: 'calc(100vh - var(--chrome-top, 0px) - var(--chrome-bottom, 0px))' }}
          >
            <LeftNav />
          </div>
          <main className="relative min-w-0 flex-1 overflow-hidden print:overflow-visible">
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
            {(location.pathname === '/missions' || location.pathname === '/dominoes') && (
              <div className="print:hidden"><AskDavey /></div>
            )}
          </main>
        </div>
        <div ref={bottomRef} className="sticky bottom-0 z-50 print:hidden">
          <ClassificationBanner position="bottom" />
        </div>
      </div>
    </DaveyProvider>
  );
}
