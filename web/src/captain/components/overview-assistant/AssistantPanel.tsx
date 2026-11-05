import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X } from 'lucide-react';

/** Shared collapsed launcher and accessible, banner-aware shell for every context. */
export function AssistantPanel({open,onOpen,onClose,children}:{open:boolean;onOpen:()=>void;onClose:()=>void;children:ReactNode}) {
  const launcher=useRef<HTMLButtonElement>(null);
  const closeButton=useRef<HTMLButtonElement>(null);
  const wasOpen=useRef(false);
  useEffect(()=>{
    if(!open){if(wasOpen.current)launcher.current?.focus();wasOpen.current=false;return;}
    wasOpen.current=true;closeButton.current?.focus();
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();}};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[open,onClose]);
  return createPortal(<>
    {open&&<aside id="ask-davy-panel" role="dialog" aria-modal="false" aria-labelledby="ask-davy-title" className="fixed right-4 z-[70] w-[min(35rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-abyss-800 text-ink shadow-2xl print:hidden sm:right-6" style={{bottom:'calc(var(--chrome-bottom, 0px) + 5rem)',maxHeight:'calc(100dvh - var(--chrome-top, 0px) - var(--chrome-bottom, 0px) - 6rem)'}}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-abyss-800 px-5 py-3"><h2 id="ask-davy-title" className="flex items-center gap-2 font-bold"><MessageSquare className="h-5 w-5" aria-hidden/> Ask Davy</h2><button ref={closeButton} type="button" aria-label="Close overview assistant" className="rounded-lg p-2 hover:bg-ink/10 focus-visible:outline focus-visible:outline-2" onClick={onClose}><X className="h-5 w-5" aria-hidden/></button></div>
      {children}
    </aside>}
    <button ref={launcher} type="button" aria-label={open?'Minimize overview assistant':'Open overview assistant'} aria-expanded={open} aria-controls={open?'ask-davy-panel':undefined} onClick={open?onClose:onOpen} className="fixed right-4 z-[70] flex items-center gap-2 rounded-full border border-line bg-abyss-800 px-5 py-3 font-semibold text-ink shadow-xl transition hover:-translate-y-0.5 hover:bg-abyss-700 focus-visible:outline focus-visible:outline-2 print:hidden sm:right-6" style={{bottom:'calc(var(--chrome-bottom, 0px) + 1rem)'}}>{open?<X className="h-5 w-5" aria-hidden/>:<MessageSquare className="h-5 w-5" aria-hidden/>}{open?'Minimize':'Ask Davy'}</button>
  </>,document.body);
}
