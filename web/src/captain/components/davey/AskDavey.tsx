import { useEffect, useState } from 'react';
import { api } from '../../api/api';
import type { Mission } from '../../api/types';
import { useDavey } from '../../state/davey';
import { useStore } from '../../state/store';
import { AssistantPanel } from '../overview-assistant/AssistantPanel';
import { OverviewChat } from '../overview-assistant/OverviewChat';

/** Mission and graph adapters share the overview conversation, retrieval and citations. */
export function AskDavey() {
  const davy=useDavey();
  const {ship,focus,setFocus}=useStore();
  const [missions,setMissions]=useState<Mission[]>([]);
  useEffect(()=>{
    if(!davy.open)return;
    let active=true;
    api.getMissions().then(result=>{if(active)setMissions(result.missions);}).catch(()=>{if(active)setMissions([]);});
    return()=>{active=false;};
  },[davy.open,ship]);
  const answer=davy.graph.sourceTab==='missions'?davy.graph.answer:davy.answer;
  const selected=davy.graph.selectedSuggestionId??davy.selectedSuggestionId;
  const node=answer?.proposed_nodes.find(n=>n.id===selected);
  const link=answer?.proposed_links.find(n=>n.id===selected);
  const fromMission=davy.graph.sourceTab==='missions';
  const ids=node?.evidence_ids??link?.evidence_ids??[];
  return <AssistantPanel open={davy.open} onOpen={davy.openDrawer} onClose={davy.closeDrawer}>
    <div className="space-y-2 border-b border-line p-4 text-sm"><p className="font-semibold">{davy.tab==='missions'?'Mission Overview':"Davy's Dominoes"}</p>
      <label>Mission scope <select aria-label="Davy mission scope" value={focus} onChange={e=>setFocus(e.target.value)} className="max-w-full rounded border bg-abyss-800 p-1"><option value="all">Most urgent on {ship}</option>{missions.map(m=><option key={m.id} value={m.id}>{m.code}</option>)}</select></label>
      {davy.contextNodeId&&<p>Focused graph item: {davy.contextNodeId} <button className="underline" onClick={davy.clearContextNode}>Clear</button></p>}
    </div>
    <OverviewChat filter="all" domain="ship" view={davy.tab} eventId={focus==='all'?null:focus} nodeId={davy.contextNodeId} onAnswer={davy.adoptAnswer} onReset={davy.clearChat}/>
    <div className="space-y-3 border-t border-line p-4">
      {davy.answer?.generation.reason&&<p className="text-xs text-ink-muted">{davy.answer.generation.reason}</p>}
      {davy.answer?.proposed_nodes.filter(n=>davy.dismissed.has(n.id)).map(n=><button key={n.id} className="block text-sm underline" onClick={()=>davy.restore(n.id)}>Restore {n.label}</button>)}
      {davy.answer?.proposed_links.filter(n=>davy.dismissed.has(n.id)).map(n=><button key={n.id} className="block text-sm underline" onClick={()=>davy.restore(n.id)}>Restore proposed connection</button>)}
      {davy.stale&&<p role="status">This graph assessment is historical. Submit a new question for the current state.</p>}
      {!davy.stale&&davy.answer?.warnings.map((warning,i)=><article key={i} className="space-y-2 rounded border p-3"><h3 className="font-semibold">{warning.kind==='emerging'?'Emerging concern · Needs verification':'Forecasted warning'}: {warning.title}</h3><p className="text-sm">{warning.explanation}</p>{warning.claim_ids.map(id=>{const claim=davy.answer?.forecast_claims.find(c=>c.id===id);return claim&&<details key={id}><summary className="text-xs text-accent">[Modeled assessment: {claim.label}]</summary><p className="text-xs">Partial lineage: an existing forecast, not a complete raw-record causal proof.</p><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(claim,null,2)}</pre></details>;})}{warning.evidence_ids.map(id=>{const source=davy.answer?.evidence.find(e=>e.id===id);return source&&<details key={id}><summary className="text-xs text-accent">[Source: {source.file} · {source.loc}]</summary><p className="text-xs">Known at {source.known_at} · {source.hedged?'Uncertain wording':''} · {source.superseded?'Superseded report':''}</p><p className="whitespace-pre-wrap text-sm">{source.excerpt}</p></details>;})}<p className="text-xs">Verify: {warning.verification}</p>{warning.trace_node_id&&<button className="text-sm text-accent underline" onClick={()=>davy.trace(warning.trace_node_id)}>Trace in Dominoes</button>}</article>)}
      {!!(davy.proposedNodes.length||davy.proposedLinks.length)&&<section className="space-y-2 rounded border border-dashed p-3"><h3 className="font-semibold">Tentative graph suggestions · Needs verification</h3><p className="text-xs">Not used in readiness estimates.</p>{[...davy.proposedNodes,...davy.proposedLinks].map(proposal=><button key={proposal.id} className="block text-left text-sm text-accent underline" onClick={()=>davy.selectSuggestion(proposal.id)}>{'label' in proposal?proposal.label:'Proposed connection'}</button>)}<button className="text-sm text-accent underline" onClick={()=>davy.trace(davy.proposedNodes[0]?.id??null)}>Show in Dominoes</button></section>}
      {(node||link)&&<article className="space-y-2 rounded border border-dashed p-3"><h3 className="font-semibold">{node?.label??'Proposed connection'} · Needs verification</h3>{fromMission&&<p className="text-xs">Traced from Mission Overview chat</p>}<p>{node?.why??link?.why}</p>{node&&<p>Verify: {node.verification}</p>}{ids.map(id=>{const evidence=answer?.evidence.find(e=>e.id===id);return evidence&&<details key={id}><summary className="text-sm text-accent">{evidence.file} · {evidence.loc}</summary><p className="text-xs">Known at {evidence.known_at} · {evidence.hedged?'Uncertain wording':''}</p><p className="whitespace-pre-wrap text-sm">{evidence.excerpt}</p></details>;})}<div className="flex gap-3 text-sm"><button className="underline" onClick={()=>fromMission?davy.markGraphReviewed(selected!):davy.markReviewed(selected!)}>{(fromMission?davy.graph.reviewed:davy.reviewed).has(selected!)?'Reviewed':'Mark reviewed'}</button><button className="underline" onClick={()=>fromMission?davy.dismissGraphSuggestion(selected!):davy.dismiss(selected!)}>Dismiss suggestion</button></div><p className="text-xs">Reviewing a suggestion does not change readiness or the modeled graph.</p></article>}
    </div>
  </AssistantPanel>;
}
