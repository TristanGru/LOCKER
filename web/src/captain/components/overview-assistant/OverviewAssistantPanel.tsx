import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X } from 'lucide-react';
import { OverviewChat } from './OverviewChat';

export function OverviewAssistantPanel({ filter, domain }: { filter: string; domain: string }) {
  const [open, setOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); launcher.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);
  return createPortal(<>
    {open && <aside id="overview-chat-panel" role="dialog" aria-modal="false" aria-labelledby="overview-chat-title"
      className="fixed bottom-24 right-4 z-[70] max-h-[calc(100dvh-7rem)] w-[min(35rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-abyss-800 shadow-2xl sm:right-6">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-abyss-800 px-5 py-3">
        <h2 id="overview-chat-title" className="flex items-center gap-2 font-bold"><MessageSquare className="h-5 w-5" aria-hidden /> Ask LOCKER</h2>
        <button ref={closeButton} type="button" aria-label="Close overview assistant" className="rounded-lg p-2 hover:bg-ink/10 focus-visible:outline focus-visible:outline-2" onClick={close}><X className="h-5 w-5" aria-hidden /></button>
      </div>
      <OverviewChat filter={filter} domain={domain} />
    </aside>}
    <button ref={launcher} type="button" aria-label={open ? 'Minimize overview assistant' : 'Open overview assistant'} aria-expanded={open} aria-controls={open ? 'overview-chat-panel' : undefined} onClick={() => open ? close() : setOpen(true)}
      className="fixed bottom-6 right-4 z-[70] flex items-center gap-2 rounded-full border border-line bg-abyss-800 px-5 py-3 font-semibold text-ink shadow-xl transition hover:-translate-y-0.5 hover:bg-abyss-700 focus-visible:outline focus-visible:outline-2 sm:right-6">
      {open ? <X className="h-5 w-5" aria-hidden /> : <MessageSquare className="h-5 w-5" aria-hidden />} {open ? 'Minimize' : 'Ask LOCKER'}
    </button>
  </>, document.body);
}
