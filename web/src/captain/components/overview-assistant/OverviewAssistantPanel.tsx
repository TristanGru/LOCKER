import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X } from 'lucide-react';
import { backend } from '../../api/api';
import { useStore } from '../../state/store';

type Evidence = { id: string; file: string; loc: string; fields: Record<string, unknown>; text: string; as_of: string; role: string; system: string; steward: string; stale: boolean; source_revision: string };
type Packet = {
  packet_id: string; unit_name: string;
  identity: { version: number; source_revision: string; cursor: string };
  facts: { id: string; text: string; kind: string; basis: string; evidence_ids: string[] }[];
  evidence: Evidence[]; warnings: string[];
  answer: { method: string; fact_ids: string[]; evidence_ids: string[]; note: string };
};

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
  // Portal keeps fixed positioning independent of dashboard glass/transform containers.
  // Unmount on close: no background requests or embedding worker while collapsed.
  return createPortal(<>
    {open && <aside id="overview-chat-panel" role="dialog" aria-modal="false" aria-labelledby="overview-chat-title"
      className="fixed bottom-24 right-4 z-[70] max-h-[calc(100dvh-7rem)] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-abyss-800 shadow-2xl sm:right-6">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-abyss-800 px-5 py-3">
        <h2 id="overview-chat-title" className="flex items-center gap-2 font-bold"><MessageSquare className="h-5 w-5" aria-hidden /> Ask LOCKER</h2>
        <button ref={closeButton} type="button" aria-label="Close overview assistant" className="rounded-lg p-2 hover:bg-ink/10 focus-visible:outline focus-visible:outline-2" onClick={close}><X className="h-5 w-5" aria-hidden /></button>
      </div>
      <OverviewAssistantContent filter={filter} domain={domain} />
    </aside>}
    <button ref={launcher} type="button" aria-label={open ? 'Minimize overview assistant' : 'Open overview assistant'}
      aria-expanded={open} aria-controls={open ? 'overview-chat-panel' : undefined} onClick={() => open ? close() : setOpen(true)}
      className="fixed bottom-6 right-4 z-[70] flex items-center gap-2 rounded-full border border-line bg-abyss-800 px-5 py-3 font-semibold text-ink shadow-xl transition hover:-translate-y-0.5 hover:bg-abyss-700 focus-visible:outline focus-visible:outline-2 sm:right-6">
      {open ? <X className="h-5 w-5" aria-hidden /> : <MessageSquare className="h-5 w-5" aria-hidden />} {open ? 'Minimize' : 'Ask LOCKER'}
    </button>
  </>, document.body);
}

function OverviewAssistantContent({ filter, domain }: { filter: string; domain: string }) {
  const { ship, version } = useStore();
  const [data, setData] = useState<Packet | null>(null);
  const [question, setQuestion] = useState('');
  const [focus, setFocus] = useState('');
  const [systems, setSystems] = useState<{ eic: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [semantic, setSemantic] = useState(false);
  const [mode, setMode] = useState('Exact / lexical retrieval');
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const context = `${ship}:${version}:${domain}:${filter}:${focus}`;
  const current = useRef(context); current.current = context;

  async function load(ask = false) {
    const key = current.current, seq = ++sequence.current;
    setBusy(true); setError('');
    try {
      const state = await backend('state');
      if (current.current !== key || seq !== sequence.current) return;
      const unit = state.ships.find((u:any) => u.ship_id === ship);
      if ((unit?.kind || 'ship') !== domain) return;
      const q = ask ? question : '';
      let semanticIds: string[] = [];
      if (ask && semantic && data && q) {
        setMode('Loading local MiniLM / WASM…');
        worker.current ||= new Worker(new URL('../../workers/overview-embed.worker.ts', import.meta.url), { type: 'module' });
        try {
          const active = worker.current;
          semanticIds = await new Promise<string[]>((resolve, reject) => {
            const timeout = setTimeout(() => { active.terminate(); worker.current = null; reject(new Error('Embedding timed out')); }, 60000);
            active.onerror = () => { clearTimeout(timeout); reject(new Error('Worker unavailable')); };
            active.onmessage = e => { if (e.data.id !== seq) return; clearTimeout(timeout); e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.ids); };
            active.postMessage({ id: seq, packetId: data.packet_id, question: q, records: data.evidence.slice(0,300) });
          });
          setMode('Local MiniLM + lexical retrieval (source values remain authoritative)');
        } catch { setMode('Semantic unavailable — using exact / lexical retrieval'); }
      }
      if (current.current !== key || seq !== sequence.current) return;
      const result = await backend('overview-assistant/brief', {
        unit_id: ship, base_version: state.version, source_revision: state.source_revision,
        focus: focus || null, status_filter: filter, question: q, explain: ask,
        packet_id: ask ? data?.packet_id : null, semantic_ids: semanticIds,
      });
      if (current.current !== key || seq !== sequence.current) return;
      setData(result);
      if (!focus) setSystems(result.summary.systems);
    } catch (e) { if (current.current === key && seq === sequence.current) { setData(null); setError(String(e)); } }
    finally { if (current.current === key && seq === sequence.current) setBusy(false); }
  }
  useEffect(() => { setFocus(''); setQuestion(''); setSystems([]); }, [ship, domain]);
  useEffect(() => { setData(null); void load(); return () => { ++sequence.current; worker.current?.terminate(); worker.current = null; }; }, [context]);
  useEffect(() => () => worker.current?.terminate(), []);
  const selected = new Set(data?.answer.evidence_ids || []);
  return <section className="glass space-y-3 rounded-xl p-5" aria-label="Overview assistant">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold">Command brief · {domain === 'installation' ? 'Shore' : 'Ship'}</h2>
      <button className="rounded border px-3 py-1" onClick={() => void load()} disabled={busy}>Refresh brief</button>
    </div>
    <p className="text-sm text-ink-muted">Read-only synthetic exercise · Facts from the accepted loaded dataset · Filter: {filter}</p>
    <label className="block text-sm">System / capability focus <select className="ml-2 rounded border bg-abyss-800 p-1" value={focus} onChange={e=>setFocus(e.target.value)}><option value="">Whole unit</option>{systems.map(s=><option key={s.eic} value={s.eic}>{s.name}</option>)}</select></label>
    {busy && <p role="status">Preparing source-backed overview…</p>}
    {error && <p role="alert">{error} — refresh the brief to reload current evidence.</p>}
    {data && <>
      <p className="text-xs text-ink-muted">{data.unit_name} · Exercise as of {data.identity.cursor} · Source {data.identity.source_revision} · {data.answer.method}</p>
      <ul className="list-disc space-y-2 pl-5">{data.answer.fact_ids.map(id => data.facts.find(f=>f.id===id)).filter(Boolean).map(f=><li key={f!.id}>{f!.text} <span className="text-xs text-ink-muted">[{f!.kind}; {f!.basis}]</span>{f!.evidence_ids.length > 0 && <a className="ml-2 underline" href={`#evidence-${f!.evidence_ids[0]}`} onClick={event=>{event.preventDefault(); const target=document.getElementById(`evidence-${f!.evidence_ids[0]}`); for(let node=target; node; node=node.parentElement) if(node instanceof HTMLDetailsElement) node.open=true; target?.scrollIntoView({block:'nearest'});}}>Loaded source</a>}</li>)}</ul>
      <p className="text-sm">{data.answer.note}</p>
      <details><summary className="cursor-pointer font-semibold">Loaded sources · {data.evidence.length} eligible records</summary>
        <p className="text-xs">Allowlisted visible fields only. These are recorded values, not predictions. Source lists are not arithmetic inputs for the model.</p>
        {[...data.evidence].sort((a,b)=>Number(selected.has(b.id))-Number(selected.has(a.id))).map(e=><details id={`evidence-${e.id}`} key={e.id} className="my-2 rounded border p-2"><summary className="cursor-pointer">{e.file} · {e.loc}{selected.has(e.id) ? ' · relevant' : ''}</summary><p className="text-xs">{e.system} · {e.steward} · Source {e.source_revision}{e.stale ? ' · STALE' : ''}</p><p className="text-xs">Known/effective: {e.as_of} · {e.role}</p><dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">{Object.entries(e.fields).map(([k,v])=><div className="contents" key={k}><dt className="font-semibold">{k}</dt><dd className="break-all">{String(v)}</dd></div>)}</dl></details>)}
      </details>
      <details><summary className="cursor-pointer">Uncertainty and data limitations</summary><ul className="list-disc pl-5">{data.warnings.map(w=><li key={w}>{w}</li>)}</ul></details>
    </>}
    <form onSubmit={e=>{e.preventDefault(); void load(true);}} className="flex flex-wrap gap-2">
      <input aria-label="Ask about this unit" className="min-w-60 flex-1 rounded border bg-abyss-800 px-3 py-2" maxLength={1000} placeholder="Why is this status shown? Show supporting records…" value={question} onChange={e=>setQuestion(e.target.value)} />
      <button className="rounded border px-4 py-2" disabled={busy || !data || !question.trim()}>Ask</button>
    </form>
    <label className="block text-sm"><input type="checkbox" checked={semantic} onChange={e=>{setSemantic(e.target.checked); setMode(e.target.checked ? 'Local MiniLM enabled for questions' : 'Exact / lexical retrieval');}} /> Enable local MiniLM semantic search (Transformers.js)</label>
    <p className="text-xs text-ink-muted">{mode}. Model assets stay local; an enabled generation endpoint may receive selected redacted facts.</p>
  </section>;
}
