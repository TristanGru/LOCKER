import { ArrowLeft, ArrowRight, BookOpen, Check, ExternalLink, MessageSquare, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { api, daveyEvidence } from '../../api/api';
import type { DaveyAnswer, DaveyClaim, DaveyEvidence, Mission } from '../../api/types';
import { useDavey, type DaveyTab } from '../../state/davey';
import { useStore } from '../../state/store';
import { pct } from '../../theme/status';

const SUGGESTED:Record<DaveyTab,string[]> = {
  missions:[
    'What parts or repair issues threaten this mission?',
    'What looks acceptable now but may threaten the mission later?',
    'What emerging concerns in the reports should I verify?',
  ],
  dominoes:[
    'What parts or repair issues threaten this mission?',
    'Which repair dependencies should I verify?',
    'Are report-backed nodes missing from this graph?',
  ],
};

function EvidenceButtons({ids,answer,onOpen}:{ids:string[];answer:DaveyAnswer;onOpen:(id:string)=>void}) {
  if(!ids.length)return null;
  return <div className="mt-3 flex flex-wrap gap-2">
    {ids.map(id=>{
      const item=answer.evidence.find(e=>e.id===id);
      return <button key={id} type="button" onClick={()=>onOpen(id)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-accent hover:border-accent" aria-label={`View evidence ${item?.record_key||id}`}>
        <BookOpen className="h-3.5 w-3.5" aria-hidden />{item?.record_key||'Source'}
      </button>;
    })}
  </div>;
}

function ClaimChips({ids,answer}:{ids:string[];answer:DaveyAnswer}) {
  const claims=ids.map(id=>answer.forecast_claims.find(claim=>claim.id===id)).filter((x):x is DaveyClaim=>Boolean(x));
  if(!claims.length)return null;
  return <div className="mt-2 flex flex-wrap gap-2">
    {claims.map(claim=>claim.kind==='mission'?
      <span key={claim.id} className="rounded-lg border border-line px-2 py-1 text-xs text-ink-muted">
        {claim.label}: interval <strong className="text-ink">{pct(claim.p_assessed ?? NaN)}</strong> · at start {pct(claim.p_ready_at_start ?? NaN)}
      </span>:
      <span key={claim.id} className="rounded-lg border border-line px-2 py-1 text-xs text-ink-muted">
        {claim.label}: requirement <strong className="text-ink">{pct(claim.p_ok ?? NaN)}</strong>
      </span>)}
  </div>;
}

export function AskDavey() {
  const davey=useDavey();
  const {ship,focus,setFocus}=useStore();
  const [drafts,setDrafts]=useState<Record<DaveyTab,string>>({missions:'',dominoes:''});
  const draft=drafts[davey.tab];
  const tabLabel=davey.tab==='missions'?'Mission Overview':"Davy's Dominoes";
  function setDraft(next:string|((current:string)=>string)) {
    setDrafts(current=>({...current,[davey.tab]:typeof next==='function'?next(current[davey.tab]):next}));
  }
  const [missions,setMissions]=useState<Mission[]>([]);
  const [scopeUnitName,setScopeUnitName]=useState('');
  const [evidenceId,setEvidenceId]=useState<string|null>(null);
  const [evidence,setEvidence]=useState<DaveyEvidence|null>(null);
  const [evidenceError,setEvidenceError]=useState<string|null>(null);
  const triggerRef=useRef<HTMLButtonElement|null>(null);
  const inputRef=useRef<HTMLTextAreaElement|null>(null);
  const wasOpenRef=useRef(false);
  const openedTabRef=useRef<DaveyTab|null>(null);
  const evidenceRequest=useRef(0);

  useEffect(()=>{
    if(!davey.open)return;
    let active=true;
    api.getMissions().then(result=>{if(active){setMissions(result.missions);setScopeUnitName(result.ship.name);}})
      .catch(()=>{if(active){setMissions([]);setScopeUnitName('');}});
    return()=>{active=false;};
  },[davey.open,ship]);
  useEffect(()=>{
    if(davey.open){wasOpenRef.current=true;openedTabRef.current=davey.tab;inputRef.current?.focus();return;}
    evidenceRequest.current+=1;
    setEvidenceId(null);
    setEvidence(null);
    if(wasOpenRef.current){
      if(openedTabRef.current===davey.tab)triggerRef.current?.focus();
      wasOpenRef.current=false;
      openedTabRef.current=null;
    }
  },[davey.open,davey.tab]);
  useEffect(()=>{evidenceRequest.current+=1;setEvidenceId(null);setEvidence(null);},
    [davey.answer?.answer_id,davey.stale,davey.graph.answer?.answer_id,davey.graph.sourceTab]);
  useEffect(()=>{evidenceRequest.current+=1;setEvidenceId(null);setEvidence(null);setEvidenceError(null);},[davey.tab]);

  useEffect(()=>{
    if(!davey.open)return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      if(evidenceId){closeEvidence();event.stopPropagation();}
      else davey.closeDrawer();
    };
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[davey.open,davey.closeDrawer,evidenceId]);

  function closeEvidence(){
    evidenceRequest.current+=1;
    setEvidenceId(null);
    setEvidence(null);
    setEvidenceError(null);
  }
  function clearCurrentChat(){
    closeEvidence();
    setDraft('');
    davey.clearChat();
  }
  async function openEvidence(id:string,sourceAnswer:DaveyAnswer|null=davey.answer) {
    if(!sourceAnswer||(sourceAnswer.answer_id===davey.answer?.answer_id&&davey.stale))return;
    const request=++evidenceRequest.current;
    setEvidenceId(id);
    setEvidence(null);
    setEvidenceError(null);
    try {
      const result=await daveyEvidence(sourceAnswer.answer_id,id);
      if(request===evidenceRequest.current)setEvidence(result);
    } catch(cause){
      if(request===evidenceRequest.current)setEvidenceError(cause instanceof Error?cause.message:'Evidence is unavailable.');
    }
  }
  function submit(event:FormEvent) {
    event.preventDefault();
    if(davey.loading)return;
    const question=draft.trim();
    if(question.length<3)return;
    closeEvidence();
    void davey.ask(question).then(success=>{
      if(success)setDraft(current=>current.trim()===question?'':current);
    });
  }

  const answer=davey.answer;
  const unitLabel=scopeUnitName||ship;
  const answerMission=missions.find(item=>item.id===answer?.event_id)?.code||answer?.event_id;
  const tracedSuggestionId=davey.graph.sourceTab==='missions'?davey.graph.selectedSuggestionId:null;
  const fromMission=Boolean(tracedSuggestionId);
  const suggestionAnswer=fromMission?davey.graph.answer:answer;
  const suggestionId=tracedSuggestionId??davey.selectedSuggestionId;
  const proposal=suggestionId?suggestionAnswer?.proposed_nodes.find(node=>node.id===suggestionId):null;
  const link=suggestionId?suggestionAnswer?.proposed_links.find(item=>item.id===suggestionId):null;
  const suggestionReviewed=fromMission?davey.graph.reviewed:davey.reviewed;
  const prior=davey.history.slice(0,-1);

  return createPortal(<>
    <button ref={triggerRef} type="button" onClick={davey.open?davey.closeDrawer:davey.openDrawer} aria-label={davey.open?'Minimize Ask Davey':'Ask Davey'} aria-expanded={davey.open} aria-controls={davey.open?'ask-davey-drawer':undefined}
      className="fixed right-4 z-[70] flex items-center gap-2 rounded-full border border-line bg-abyss-800 px-5 py-3 font-semibold text-ink shadow-xl transition hover:-translate-y-0.5 hover:bg-abyss-700 focus-visible:outline focus-visible:outline-2 print:hidden sm:right-6"
      style={{bottom:'calc(var(--chrome-bottom, 0px) + 1rem)'}}>
      {davey.open?<X className="h-5 w-5" aria-hidden />:<MessageSquare className="h-5 w-5" aria-hidden />} {davey.open?'Minimize':'Ask Davey'} <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-accent">AI</span>
    </button>
    {davey.open&&<aside id="ask-davey-drawer" role="dialog" aria-label="Ask Davey" aria-modal="false" className="fixed right-4 z-[70] flex h-[38rem] w-[min(35rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-abyss-800 text-ink shadow-2xl print:hidden sm:right-6"
      style={{bottom:'calc(var(--chrome-bottom, 0px) + 5rem)',maxHeight:'calc(100dvh - var(--chrome-top, 0px) - var(--chrome-bottom, 0px) - 6rem)'}}>
      <header className="flex items-center gap-2 border-b border-line bg-abyss-800 px-5 py-3">
        <MessageSquare className="h-5 w-5" aria-hidden />
        <div className="min-w-0 flex-1"><h2 className="font-bold text-ink">Ask Davey</h2><p className="truncate text-xs text-ink-muted">{tabLabel} chat · Predictive early warning</p></div>
        <button type="button" onClick={clearCurrentChat} className="inline-flex shrink-0 items-center gap-1 rounded border border-line px-2 py-1 text-xs font-semibold hover:bg-ink/10" aria-label={`Clear ${tabLabel} chat`} title={`Clear ${tabLabel} chat`}><Trash2 className="h-3.5 w-3.5" aria-hidden /> New conversation</button>
        <button type="button" onClick={davey.closeDrawer} className="shrink-0 rounded-lg p-2 hover:bg-ink/10 focus-visible:outline focus-visible:outline-2" aria-label="Close Ask Davey"><X className="h-5 w-5" aria-hidden /></button>
      </header>
      <div className="border-b border-line bg-abyss-800 px-5 py-3 text-sm text-ink-muted">
        <label className="flex items-center gap-2">Mission scope <select aria-label="Davey mission scope" value={focus} onChange={event=>setFocus(event.target.value)} className="min-w-0 flex-1 rounded border border-line bg-abyss-800 px-2 py-1.5 text-ink">
          <option value="all">Most urgent on {unitLabel}</option>
          {missions.map(mission=><option key={mission.id} value={mission.id}>{mission.code}</option>)}
        </select></label>
        <p className="mt-2 text-xs">Assessing {unitLabel}. Davey searches current reports and modeled mission risks when you submit a question.</p>
        {davey.contextNodeId&&<p className="mt-2 flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate" title={davey.contextNodeId}>Focused graph item: {davey.contextNodeId}</span><button type="button" onClick={davey.clearContextNode} className="text-accent hover:underline">Clear</button></p>}
      </div>
      <div aria-label="Conversation transcript" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {evidenceId ? <div>
          <button type="button" onClick={closeEvidence} className="mb-4 inline-flex items-center gap-1 text-sm text-accent"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to answer</button>
          {evidenceError&&<p role="alert" className="rounded-lg border border-risk/50 p-3 text-sm text-risk">{evidenceError}</p>}
          {!evidence&&!evidenceError&&<p role="status" className="text-ink-muted">Opening evidence...</p>}
          {evidence&&<article className="rounded-xl border border-line bg-abyss-800 p-4">
            <p className="label-caps">{evidence.kind.replace('_',' ')} {evidence.hedged?'· Uncertain wording':''} {evidence.superseded?'· Superseded report':''}</p>
            <h3 className="mt-2 break-all text-sm font-semibold text-ink">{evidence.file}</h3>
            <p className="mt-1 text-xs text-ink-muted">{evidence.loc} · Known at {new Date(evidence.known_at).toLocaleString()}</p>
            {evidence.fact_annotations.map((fact,index)=><p key={`${fact.type}-${index}`} className="mt-2 text-xs text-watch">Extracted {fact.type.replaceAll('_',' ')}: {fact.status.toLowerCase().replaceAll('_',' ')} · {fact.corroboration.replaceAll('_',' ')}</p>)}
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">{evidence.excerpt}</p>
          </article>}
        </div> : proposal||link ? <div>
          <button type="button" onClick={()=>fromMission?davey.selectGraphSuggestion(null):davey.selectSuggestion(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-accent"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to {fromMission?'Dominoes chat':'answer'}</button>
          <article className="rounded-xl border border-dashed border-accent/70 bg-accent/[0.05] p-4">
            {fromMission&&<p className="mb-2 text-xs font-semibold text-accent">Traced from Mission Overview chat</p>}
            <p className="label-caps text-accent">AI-proposed · Needs verification</p>
            <h3 className="mt-2 text-lg font-bold text-ink">{proposal?.label || 'Proposed connection'}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{proposal?.why||link?.why}</p>
            {proposal?.verification&&<p className="mt-3 text-sm text-ink">Verify: {proposal.verification}</p>}
            {suggestionAnswer&&<EvidenceButtons ids={proposal?.evidence_ids||link?.evidence_ids||[]} answer={suggestionAnswer} onOpen={id=>void openEvidence(id,suggestionAnswer)}/>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={()=>fromMission?davey.markGraphReviewed((proposal||link)!.id):davey.markReviewed((proposal||link)!.id)} className="btn-ghost inline-flex items-center gap-1 !px-3 !py-2"><Check className="h-4 w-4" aria-hidden /> {suggestionReviewed.has((proposal||link)!.id)?'Reviewed':'Mark reviewed'}</button>
              <button type="button" onClick={()=>fromMission?davey.dismissGraphSuggestion((proposal||link)!.id):davey.dismiss((proposal||link)!.id)} className="btn-ghost !px-3 !py-2">Dismiss suggestion</button>
            </div>
            <p className="mt-3 text-xs text-ink-muted">Reviewing a suggestion does not change readiness or the modeled graph.</p>
          </article>
        </div> : <>
          {!answer&&<div className="rounded-xl border border-line p-4">
            <h3 className="flex items-center gap-2 font-semibold text-ink"><Sparkles className="h-4 w-4 text-accent" aria-hidden /> What should Davey check?</h3>
            <p className="mt-2 text-sm text-ink-muted">Ask what could change this mission's outlook next. Davey compares the forecast with currently available reports and flags what needs verification.</p>
          </div>}
          {prior.map(item=><div key={item.answer_id} className="mt-4 space-y-2 text-sm">
            <article aria-label="Your message" className="ml-6 rounded-xl border border-line bg-ink/5 p-3"><p className="text-xs font-bold">You</p><p className="mt-1">{item.question}</p></article>
            <article aria-label="Assistant message" className="mr-1 rounded-xl border border-line p-3"><p className="text-xs font-bold">Davey · {item.generation.label}</p><p className="mt-1 line-clamp-3 text-ink-muted">{item.answer}</p></article>
          </div>)}
          {answer&&<div className="mt-4 space-y-3">
            {davey.stale&&<div role="status" className="rounded-lg border border-watch/70 bg-watch-soft p-3 text-sm text-watch">This answer describes an earlier mission or exercise state. Submit a new question for the current picture.</div>}
            <article aria-label="Your message" className="ml-6 rounded-xl border border-line bg-ink/5 p-3 text-sm">
              <p className="text-xs font-bold">You</p><p className="mt-1">You asked: {answer.question}</p>
            </article>
            <article aria-label="Assistant message" className="mr-1 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <strong className="text-ink">Davey · Predictive assessment</strong>
                <span className="rounded-full border border-accent/50 px-2 py-0.5 text-accent">{answer.generation.label}</span>
                <span>{answerMission} · {unitLabel}</span>
                <span>Exercise {new Date(answer.identity.exercise_cursor).toLocaleString()}</span>
                <span>Answered {new Date(answer.generation.generated_at).toLocaleString()}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{answer.answer}</p>
              <ClaimChips ids={answer.answer_claim_ids} answer={answer}/>
              {!davey.stale&&<EvidenceButtons ids={answer.answer_evidence_ids} answer={answer} onOpen={id=>void openEvidence(id)}/>}
              {answer.generation.reason&&<p className="mt-3 text-xs text-ink-muted">{answer.generation.reason}</p>}
            </article>
            {answer.warnings.map((warning,index)=><div key={`${warning.kind}-${index}`} className="rounded-xl border border-line bg-abyss-800 p-4">
              <p className={`label-caps ${warning.kind==='emerging'?'text-watch':'text-accent'}`}>{warning.kind==='emerging'?'Emerging concern · Needs verification':'Forecasted warning'}</p>
              <h3 className="mt-2 text-base font-bold text-ink">{warning.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{warning.explanation}</p>
              <ClaimChips ids={warning.claim_ids} answer={answer}/>
              {warning.verification&&<p className="mt-2 text-xs text-ink-muted">Verify: {warning.verification}</p>}
              {!davey.stale&&<EvidenceButtons ids={warning.evidence_ids} answer={answer} onOpen={id=>void openEvidence(id)}/>}
              {!davey.stale&&warning.trace_node_id&&<button type="button" onClick={()=>davey.trace(warning.trace_node_id)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">Trace in Dominoes <ArrowRight className="h-4 w-4" aria-hidden /></button>}
            </div>)}
            {(answer.proposed_nodes.length>0||answer.proposed_links.length>0)&&<section className="rounded-xl border border-dashed border-accent/70 bg-accent/[0.05] p-4">
              <h3 className="font-bold text-ink">AI-proposed graph additions</h3>
              <p className="mt-1 text-xs text-ink-muted">Suggestions for review. They are not used in readiness estimates.</p>
              {answer.proposed_nodes.map(node=><div key={node.id} className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm">
                <span className="min-w-0 flex-1 text-ink">{node.label} {davey.reviewed.has(node.id)&&<span className="text-accent">· Reviewed</span>}{davey.dismissed.has(node.id)&&<span className="text-ink-muted">· Dismissed</span>}</span>
                <button type="button" disabled={davey.stale} onClick={()=>davey.dismissed.has(node.id)?davey.restore(node.id):davey.selectSuggestion(node.id)} className="text-accent disabled:opacity-40">{davey.dismissed.has(node.id)?'Restore':'Review'}</button>
              </div>)}
              {answer.proposed_links.map(link=><div key={link.id} className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm">
                <span className="min-w-0 flex-1 text-ink-muted">Proposed connection {davey.reviewed.has(link.id)?'· Reviewed':''}{davey.dismissed.has(link.id)?'· Dismissed':''}</span>
                <button type="button" disabled={davey.stale} onClick={()=>davey.dismissed.has(link.id)?davey.restore(link.id):davey.selectSuggestion(link.id)} className="text-accent disabled:opacity-40">{davey.dismissed.has(link.id)?'Restore':'Review'}</button>
              </div>)}
              {!davey.stale&&<button type="button" onClick={()=>davey.trace(answer.proposed_nodes[0]?.id||answer.proposed_links[0]?.dependency_id||null)} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">Show in Dominoes <ExternalLink className="h-4 w-4" aria-hidden /></button>}
            </section>}
            <p className="pb-2 text-xs text-ink-muted">Searched {answer.coverage.searched} eligible passages; used {answer.coverage.returned}. {answer.coverage.truncated?'Results were limited to a relevant selection.':''}</p>
            {answer.coverage.coverage_issues.length>0&&<p className="text-xs text-watch">Coverage gaps: {answer.coverage.coverage_issues.join('; ')}</p>}
            {answer.coverage.stale_linked_files.length>0&&<p className="text-xs text-watch">Stale linked sources: {answer.coverage.stale_linked_files.join(', ')}</p>}
            {answer.coverage.last_refresh_status==='failed'&&<p className="text-xs text-watch">The last source refresh failed; this answer uses the retained source snapshot.</p>}
          </div>}
          {!davey.loading&&<div className="mt-5"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Suggested predictive questions</p><div className="flex flex-wrap gap-2">{SUGGESTED[davey.tab].map(prompt=><button key={prompt} type="button" onClick={()=>{setDraft(prompt);inputRef.current?.focus();}} className="rounded-full border border-line px-3 py-1.5 text-left text-xs text-ink-muted hover:border-accent hover:text-ink">{prompt}</button>)}</div></div>}
        </>}
      </div>
      <form onSubmit={submit} className="border-t border-line bg-abyss-800 p-4">
        {davey.error&&<p role="alert" className="mb-3 rounded-lg border border-risk/50 px-3 py-2 text-sm text-risk">{davey.error}</p>}
        {davey.loading&&<p role="status" className="mb-2 text-sm text-accent">Analyzing the selected mission and reports...</p>}
        <label className="sr-only" htmlFor="davey-question">Ask Davey a question</label>
        <div className="flex items-end gap-2"><textarea ref={inputRef} id="davey-question" value={draft} onChange={event=>setDraft(event.target.value)}
          onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}
          maxLength={600} rows={2} placeholder="Ask what could affect this mission next..." className="min-w-0 flex-1 resize-none rounded border border-line bg-abyss-800 px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
          <button type="submit" disabled={davey.loading||draft.trim().length<3} className="rounded border border-line px-4 py-2 font-semibold text-ink hover:bg-ink/10 disabled:opacity-50"><Send className="mr-1 inline h-4 w-4" aria-hidden /> Ask</button></div>
        <p className="mt-2 text-xs text-ink-muted">Enter asks · Shift+Enter adds a line. Davey checks current reports and forecast claims when you submit.</p>
      </form>
    </aside>}
  </>,document.body);
}
