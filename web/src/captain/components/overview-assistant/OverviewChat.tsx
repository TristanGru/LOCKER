import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';

type Support = { id: string; title?: string; file?: string; loc?: string; kind: string; basis?: string; lineage?: string; stale?: boolean; as_of?: string; identity: any; values: Record<string, unknown>; input_references?: any[]; input_evidence?: Support[]; model_inputs?: any[]; calculation?: any };
type Citation = { number: number; support_id: string; support: Support };
type Message = { id: string; role: 'user'|'assistant'; text: string; method?: string; fallback_reason?: string; answer_status?: string; identity?: any; sections?: { heading: string; sentences: { text: string; citations: number[] }[] }[]; citations?: Citation[] };
type Session = { id: string; packet_id: string; identity: any; messages: Message[]; stale?: boolean; busy: boolean };
async function request(path: string, body?: unknown, method?: string, signal?: AbortSignal) {
  const response = await fetch('/api/overview-assistant/' + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: {'Content-Type':'application/json'}, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body), signal });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Assistant request failed');
  return data;
}
function Source({ support }: { support: Support }) {
  return <div className="space-y-2 break-words text-sm">
    <p className="font-semibold">{support.file ? `${support.file} · ${support.loc}` : support.title}</p>
    <p>{support.kind} {support.basis && `· ${support.basis}`} {support.stale && '· STALE'}</p>
    <p className="text-xs">Source {support.identity.source_revision} · Exercise {support.identity.cursor}</p>
    {support.lineage === 'partial' && <p className="text-watch">Partial lineage: a modeled assessment, not a complete raw-record causal proof.</p>}
    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">{Object.entries(support.values).map(([k,v])=><div className="contents" key={k}><dt className="font-semibold">{k}</dt><dd>{v == null ? 'Unknown' : String(v)}</dd></div>)}</dl>
    {support.calculation && <details><summary>Calculation and filters</summary><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(support.calculation,null,2)}</pre></details>}
    {!!support.model_inputs?.length && <details><summary>Model inputs and assumptions</summary><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(support.model_inputs,null,2)}</pre></details>}
    {!!support.input_evidence?.length && <details><summary>Underlying loaded records</summary>{support.input_evidence.map(s=><div key={s.id} className="my-2 border-t pt-2"><Source support={s} /></div>)}</details>}
    {!!support.input_references?.length && <details><summary>Original input locators (may not be retained as record cards)</summary><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(support.input_references,null,2)}</pre></details>}
  </div>;
}

export function OverviewChat({filter,domain}:{filter:string;domain:string}) {
  const { ship, version } = useStore();
  const [focus,setFocus] = useState('');
  const [session,setSession] = useState<Session|null>(null);
  const [packet,setPacket] = useState<any>(null);
  const [question,setQuestion] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [lastQuestion,setLastQuestion] = useState('');
  const [citation,setCitation] = useState<Citation|null>(null);
  const [semantic,setSemantic] = useState(true);
  const [mode,setMode] = useState('Local evidence search is enabled automatically');
  const abort = useRef<AbortController|null>(null);
  const worker = useRef<Worker|null>(null);
  const serial = useRef(0);
  const sourceButton = useRef<string>('');
  const sourceBack = useRef<HTMLButtonElement|null>(null);
  const key = `locker-chat:${ship}:${domain}:${filter}:${focus}`;
  const active = useRef(key); active.current=key;
  const sessionRef = useRef(session); sessionRef.current=session;
  useEffect(()=>{setFocus('');setQuestion('');},[ship,domain]);
  useEffect(()=>{ if(citation) sourceBack.current?.focus(); else if(sourceButton.current) document.getElementById(sourceButton.current)?.focus(); },[citation]);
  async function initialize(fresh=false) {
    const scope=key, seq=++serial.current;
    abort.current?.abort(); abort.current=new AbortController();
    const signal=abort.current.signal;
    setBusy(true);setError('');setCitation(null);
    try {
      const saved=sessionStorage.getItem(scope);
      if(saved && !fresh) {
        const restored = await request('conversations/'+saved,undefined,undefined,signal).catch(e=>{if(signal.aborted)throw e;return null;});
        if(restored && scope===active.current && seq===serial.current) {
          setSession(restored);
          if(restored.stale) {setPacket(null);return;}
        }
      }
      const state=await fetch('/api/scenario/version',{signal}).then(r=>r.json());
      const body={unit_id:ship,base_version:state.version,source_revision:state.source_revision,focus:focus||null,status_filter:filter};
      const data=await request('conversations',body,undefined,signal);
      if(scope!==active.current || seq!==serial.current)return;
      setPacket(data.packet);
      // Restore the existing conversation, while obtaining a fresh current packet for retrieval.
      if(saved && !fresh) {
        const restored=await request('conversations/'+saved,undefined,undefined,signal).catch(()=>null);
        if(restored && !restored.stale && restored.packet_id===data.packet_id) {
          await request('conversations/'+data.id,undefined,'DELETE',signal);
          if(scope===active.current && seq===serial.current)setSession(restored);
          return;
        }
      }
      if(fresh && saved) await request('conversations/'+saved,undefined,'DELETE',signal).catch(()=>{});
      sessionStorage.setItem(scope,data.id);setSession(data);
    } catch(e) {if(!signal.aborted && scope===active.current)setError(String(e));}
    finally {if(scope===active.current && seq===serial.current)setBusy(false);}
  }
  useEffect(()=>{setSession(null);setPacket(null);void initialize();return()=>{++serial.current;abort.current?.abort();worker.current?.terminate();worker.current=null;};},[key,version]);
  useEffect(()=>{
    if(!session?.busy)return;
    const timer=setInterval(()=>{request('conversations/'+session.id).then(data=>{if(active.current===key)setSession(data);}).catch(()=>{});},2000);
    return()=>clearInterval(timer);
  },[session?.busy,session?.id,key]);
  async function send(text=question) {
    if(!session || session.stale || busy || session.busy || !text.trim())return;
    const scope=key, seq=++serial.current;
    abort.current?.abort();abort.current=new AbortController();const signal=abort.current.signal;
    setBusy(true);setError('');setLastQuestion(text);setQuestion('');
    try {
      let semanticIds:string[]=[];
      if(semantic && packet) {
        setMode('Searching local records…');
        try {
          worker.current ||= new Worker(new URL('../../workers/overview-embed.worker.ts',import.meta.url),{type:'module'});
          const w=worker.current;
          semanticIds=await new Promise<string[]>((resolve,reject)=>{
            const timer=setTimeout(()=>{w.terminate();worker.current=null;reject(new Error('Embedding timeout'));},60000);
            signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Canceled'));},{once:true});
            w.onerror=()=>{clearTimeout(timer);reject(new Error('Worker unavailable'));};
            w.onmessage=e=>{if(e.data.id!==seq)return;clearTimeout(timer);e.data.error?reject(new Error(e.data.error)):resolve(e.data.ids);};
            w.postMessage({id:seq,packetId:packet.packet_id,question:text,records:packet.evidence.slice(0,300)});
          });
          setMode('Local evidence search + exact record matching');
        } catch {
          worker.current?.terminate();worker.current=null;
          setSemantic(false);
          setMode('Using standard record search; no setup is needed');
        }
      }
      if(signal.aborted || scope!==active.current)return;
      const result=await request(`conversations/${session.id}/messages`,{packet_id:session.packet_id,question:text,semantic_ids:semanticIds},undefined,signal);
      if(scope===active.current && seq===serial.current)setSession(result);
    } catch(e) {if(!signal.aborted && scope===active.current)setError(String(e));}
    finally {if(scope===active.current && seq===serial.current)setBusy(false);}
  }
  function cancel() {abort.current?.abort();worker.current?.terminate();worker.current=null;setBusy(false);setError('Response display canceled. Reopen or refresh the conversation to check whether the server finished.');}
  return <section aria-label="Overview assistant" className="space-y-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Command brief · {domain==='installation'?'Shore':'Ship'}</h2><button className="rounded border px-2 py-1 text-sm" disabled={busy} onClick={()=>void initialize(true)}>New conversation</button></div>
    <p className="text-xs text-ink-muted">Read-only synthetic exercise · {ship} · Filter: {filter}. Conversations remain in server memory only.</p>
    <label className="block text-sm">System / capability focus <select className="max-w-full rounded border bg-abyss-800 p-1" value={focus} onChange={e=>setFocus(e.target.value)}><option value="">Whole unit</option>{packet?.summary.systems.map((s:any)=><option key={s.eic} value={s.eic}>{s.name}</option>)}</select></label>
    {session?.stale && <p role="alert">These messages are historical: sources or scenario changed. Start a new conversation before asking about current state.</p>}
    {session && <p className="text-xs text-ink-muted">Exercise {session.identity.cursor} · Source {session.identity.source_revision}</p>}
    {citation ? <div className="space-y-3 rounded border p-3" aria-label="Citation evidence"><button ref={sourceBack} className="underline" onClick={()=>setCitation(null)}>Back to conversation</button><h3 className="font-bold">Source [{citation.number}]</h3><Source support={citation.support}/></div> : <>
      <div aria-label="Conversation transcript" aria-live="polite" className="space-y-3">
        {!session?.messages.length && <p>Ask for a concise summary, the reason behind a status, or the loaded evidence supporting it.</p>}
        {session?.messages.map(message=><article key={message.id} aria-label={message.role==='user'?'Your message':'Assistant message'} className={`space-y-2 rounded-xl border p-3 ${message.role==='user'?'ml-6 bg-ink/5':'mr-1'}`}>
          <p className="text-xs font-bold">{message.role==='user'?'You':`Davy · ${message.method==='template'?'Deterministic fallback':message.method==='cache'?'Cached LLM':'Live LLM'}${message.answer_status ? ' · '+message.answer_status.replaceAll('_',' ') : ''}`}</p>
          {message.role==='user'?<p className="whitespace-pre-wrap">{message.text}</p>:message.sections?.map((section,i)=><div key={i}><h3 className="mb-1 text-sm font-semibold">{section.heading}</h3><p className="text-sm leading-relaxed">{section.sentences.map((sentence,j)=><span key={j}>{sentence.text}{' '}{sentence.citations.map(n=><button id={`citation-${message.id}-${n}`} key={n} aria-label={`Citation ${n}`}  className="mx-0.5 font-semibold text-accent underline" onClick={e=>{sourceButton.current=e.currentTarget.id;setCitation(message.citations!.find(c=>c.number===n)!);}}>[{n}]</button>)}{' '}</span>)}</p></div>)}
          {message.fallback_reason && <p className="text-xs text-ink-muted">Fallback reason: {message.fallback_reason.replaceAll('_',' ')}. These are verified template facts, not generated prose.</p>}
        </article>)}
      </div>
      <div className="flex flex-wrap gap-2">{['Summarize this '+(domain==='installation'?'installation':'ship'),'Explain the leading concern','Which linked ships or shore capabilities are affected?','Show the supporting records'].map(prompt=><button key={prompt} className="rounded-full border px-2 py-1 text-xs" disabled={busy||!session||session.stale||session.busy} onClick={()=>void send(prompt)}>{prompt}</button>)}</div>
    </>}
    {(busy||session?.busy) && <p role="status">Preparing a grounded response… No unvalidated text is streamed.</p>}
    {error && <div role="alert"><p className="text-sm">{error}</p><button className="underline" disabled={busy} onClick={()=>lastQuestion?void send(lastQuestion):void initialize()}>Retry</button></div>}
    <form onSubmit={e=>{e.preventDefault();void send();}} className="space-y-2"><textarea aria-label="Ask about this unit" rows={2} maxLength={1500} value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}} className="w-full resize-y rounded border bg-abyss-800 p-2" placeholder="Ask a follow-up… Enter sends, Shift+Enter adds a line"/><div className="flex gap-2"><button className="rounded border px-4 py-2" disabled={busy||!session||session.stale||session.busy||!question.trim()}>Send</button>{busy&&<button type="button" className="rounded border px-3" onClick={cancel}>Cancel response</button>}</div></form>
    <p className="text-xs text-ink-muted" role="status">{mode}.</p>
    <details><summary className="cursor-pointer text-xs">Advanced search settings</summary><label className="mt-2 block text-xs"><input type="checkbox" checked={semantic} onChange={e=>{setSemantic(e.target.checked);setMode(e.target.checked?'Local evidence search is enabled automatically':'Using standard record search');}}/> Use local semantic search</label><p className="mt-1 text-xs text-ink-muted">MiniLM runs locally through Transformers.js. Search falls back automatically if unavailable. Selected redacted context may be sent to your configured generation endpoint.</p></details>
    {packet&&<details><summary className="cursor-pointer text-sm">Loaded sources · {packet.evidence.length} eligible records</summary>{packet.evidence.slice(0,300).map((e:any)=><details key={e.id} className="border-b py-2"><summary>{e.file} · {e.loc}</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(e.fields,null,2)}</pre></details>)}</details>}
    {packet&&<details><summary>Uncertainty and data limitations</summary><ul className="list-disc pl-5">{packet.warnings.map((w:string)=><li key={w} className="text-xs">{w}</li>)}</ul></details>}
  </section>;
}
