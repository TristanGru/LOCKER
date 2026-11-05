import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, askDavey, daveyIdentity } from '../api/api';
import type { DaveyAnswer, DaveyIdentity, DaveyProposedLink, DaveyProposedNode } from '../api/types';
import { useStore } from './store';

interface DaveyValue {
  tab: DaveyTab;
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  clearChat: () => void;
  history: DaveyAnswer[];
  answer: DaveyAnswer | null;
  stale: boolean;
  loading: boolean;
  error: string | null;
  ask: (question: string) => Promise<boolean>;
  adoptAnswer: (answer: DaveyAnswer | null) => void;
  trace: (nodeId: string | null) => void;
  clearTrace: () => void;
  traceNodeId: string | null;
  contextNodeId: string | null;
  clearContextNode: () => void;
  proposedNodes: DaveyProposedNode[];
  proposedLinks: DaveyProposedLink[];
  selectedSuggestionId: string | null;
  selectSuggestion: (id: string | null) => void;
  reviewed: Set<string>;
  dismissed: Set<string>;
  markReviewed: (id: string) => void;
  dismiss: (id: string) => void;
  restore: (id: string) => void;
  graph: {
    answer: DaveyAnswer | null;
    sourceTab: DaveyTab | null;
    proposedNodes: DaveyProposedNode[];
    proposedLinks: DaveyProposedLink[];
    reviewed: Set<string>;
    selectedSuggestionId: string | null;
  };
  selectGraphSuggestion: (id: string | null) => void;
  markGraphReviewed: (id: string) => void;
  dismissGraphSuggestion: (id: string) => void;
}

export type DaveyTab = 'missions' | 'dominoes';

interface DaveySession {
  history: DaveyAnswer[];
  contextNodeId: string | null;
  selectedSuggestionId: string | null;
  reviewed: Set<string>;
  dismissed: Set<string>;
}

const emptySession = ():DaveySession => ({history:[],contextNodeId:null,selectedSuggestionId:null,
  reviewed:new Set(),dismissed:new Set()});

const Context = createContext<DaveyValue | null>(null);

const sameIdentity = (a:DaveyIdentity,b:DaveyIdentity) =>
  a.epoch===b.epoch && a.source_revision===b.source_revision && a.scenario_version===b.scenario_version &&
  a.scenario_digest===b.scenario_digest && a.exercise_cursor===b.exercise_cursor && a.source_health_at===b.source_health_at;

export function DaveyProvider({children}:{children:ReactNode}) {
  const {ship, focus, setFocus, version, panel, closePanel} = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const tab:DaveyTab=location.pathname==='/dominoes'?'dominoes':'missions';
  const [openTab,setOpenTab] = useState<DaveyTab|null>(null);
  const open=openTab===tab;
  const [sessions,setSessions] = useState<Record<DaveyTab,DaveySession>>(()=>({missions:emptySession(),dominoes:emptySession()}));
  const [identity,setIdentity] = useState<DaveyIdentity | null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const [traceTarget,setTraceTarget] = useState<{scope:string;id:string|null}|null>(null);
  const [handoffAnswerId,setHandoffAnswerId] = useState<string|null>(null);
  const pending = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);
  const priorRoute=useRef(location.pathname);
  const updateSession=useCallback((name:DaveyTab,change:(current:DaveySession)=>DaveySession)=>{
    setSessions(current=>{
      const next=change(current[name]);
      return next===current[name]?current:{...current,[name]:next};
    });
  },[]);
  const session=sessions[tab];
  const {history,contextNodeId,selectedSuggestionId,reviewed,dismissed}=session;
  const graphScopeKey = `${ship}|${focus}`;
  const requestScopeKey = `${tab}|${graphScopeKey}|${contextNodeId??''}`;
  const scopeRef = useRef(requestScopeKey);
  scopeRef.current = requestScopeKey;
  const traceNodeId=traceTarget?.scope===graphScopeKey?traceTarget.id:null;
  const answer=history.at(-1) ?? null;
  const stale = Boolean(answer && (answer.ship_id!==ship || (focus==='all' ? answer.requested_event_id!==null : answer.event_id!==focus) ||
    answer.node_id!==contextNodeId ||
    !identity || !sameIdentity(answer.identity,identity)));
  const handoffAnswer=sessions.missions.history.find(item=>item.answer_id===handoffAnswerId)??null;
  const handoffActive=Boolean(tab==='dominoes'&&handoffAnswer&&identity&&
    handoffAnswer.ship_id===ship&&(focus==='all'||focus===handoffAnswer.event_id)&&
    sameIdentity(handoffAnswer.identity,identity));

  useEffect(()=>{
    let active=true;
    daveyIdentity().then(next=>{if(active)setIdentity(next);}).catch(()=>{if(active)setIdentity(null);});
    return()=>{active=false;};
  },[version]);

  useEffect(()=>{
    pending.current?.abort();
    pending.current=null;
    requestSeq.current+=1;
    setLoading(false);
    setError(null);
    setTraceTarget(current=>current?.scope===graphScopeKey?current:null);
    updateSession(tab,current=>{
      const nextContext=current.contextNodeId?.split('|',1)[0]===focus?current.contextNodeId:null;
      return current.contextNodeId===nextContext&&current.selectedSuggestionId===null?current:
        {...current,contextNodeId:nextContext,selectedSuggestionId:null};
    });
  },[requestScopeKey,graphScopeKey,focus,tab,updateSession]);

  useEffect(()=>{
    if(priorRoute.current===location.pathname)return;
    priorRoute.current=location.pathname;
    pending.current?.abort();
    pending.current=null;
    requestSeq.current+=1;
    setLoading(false);
    setError(null);
    setOpenTab(null);
  },[location.pathname]);

  useEffect(()=>{
    if(!answer||!identity||sameIdentity(answer.identity,identity))return;
    pending.current?.abort();
    pending.current=null;
    requestSeq.current+=1;
    setLoading(false);
    setTraceTarget(null);
  },[answer,identity]);

  const openDrawer=useCallback(()=>{
    if(tab==='dominoes'&&panel?.kind==='node'&&panel.id.startsWith('EVT-')){
      const eventId=panel.id.split('|',1)[0];
      updateSession(tab,current=>({...current,contextNodeId:panel.id}));
      setFocus(eventId);
    } else {
      updateSession(tab,current=>current.contextNodeId===null?current:{...current,contextNodeId:null});
    }
    closePanel();
    setOpenTab(tab);
  },[panel,closePanel,setFocus,tab,updateSession]);
  const closeDrawer=useCallback(()=>{
    pending.current?.abort();
    pending.current=null;
    requestSeq.current+=1;
    setLoading(false);
    setOpenTab(null);
  },[]);
  const clearChat=useCallback(()=>{
    pending.current?.abort();
    pending.current=null;
    requestSeq.current+=1;
    setLoading(false);
    setError(null);
    updateSession(tab,()=>emptySession());
    setTraceTarget(null);
    setHandoffAnswerId(null);
  },[tab,updateSession]);

  const ask=useCallback(async(question:string)=>{
    const clean=question.trim();
    if(clean.length<3||clean.length>600)return false;
    pending.current?.abort();
    const controller=new AbortController();
    pending.current=controller;
    const seq=++requestSeq.current;
    const scope=scopeRef.current;
    setLoading(true);
    setError(null);
    try {
      const expected=await daveyIdentity();
      if(controller.signal.aborted||seq!==requestSeq.current)return false;
      setIdentity(expected);
      const previous=history.at(-1);
      const canFollow=previous && previous.ship_id===ship &&
        (focus==='all'?previous.requested_event_id===null:previous.event_id===focus) && previous.node_id===contextNodeId &&
        sameIdentity(previous.identity,expected);
      const response=await askDavey({question:clean,ship_id:ship,event_id:focus==='all'?null:focus,
        node_id:contextNodeId,expected_version:expected.scenario_version,expected_source_revision:expected.source_revision,
        expected_epoch:expected.epoch,expected_scenario_digest:expected.scenario_digest,
        expected_cursor:expected.exercise_cursor,expected_source_health_at:expected.source_health_at,
        request_id:crypto.randomUUID(),
        previous_answer_id:canFollow?previous.answer_id:null},controller.signal);
      if(controller.signal.aborted||seq!==requestSeq.current||scopeRef.current!==scope)return false;
      setIdentity(response.identity);
      updateSession(tab,current=>({...current,history:canFollow?[...current.history.slice(-3),response]:[response],
        reviewed:new Set(),dismissed:new Set(),selectedSuggestionId:null}));
      setTraceTarget(null);
      if(tab==='dominoes')setHandoffAnswerId(null);
      return true;
    } catch(cause) {
      if(controller.signal.aborted||seq!==requestSeq.current)return false;
      setError(cause instanceof ApiError&&cause.status===409?'The exercise changed during analysis. Submit the question again.':
        cause instanceof Error?cause.message:'Davey could not answer this question.');
      return false;
    } finally {
      if(seq===requestSeq.current){setLoading(false);pending.current=null;}
    }
  },[focus,ship,history,contextNodeId,tab,updateSession]);

  const adoptAnswer=useCallback((next:DaveyAnswer|null)=>{
    if(!next)return; // An empty destination chat must not erase an explicit graph handoff.
    setIdentity(next.identity);
    updateSession(tab,current=>current.history.at(-1)?.answer_id===next.answer_id?current:
      {...current,history:[...current.history.slice(-19),next],selectedSuggestionId:null,reviewed:new Set(),dismissed:new Set()});
  },[tab,updateSession]);

  const trace=useCallback((nodeId:string|null)=>{
    if(!answer||stale)return;
    setHandoffAnswerId(tab==='missions'?answer.answer_id:null);
    setTraceTarget({scope:`${ship}|${answer.event_id}`,id:nodeId});
    setFocus(answer.event_id);
    navigate('/dominoes');
    setOpenTab(tab==='dominoes'?tab:null);
  },[answer,stale,ship,setFocus,navigate,tab]);
  const clearTrace=useCallback(()=>{
    setTraceTarget(null);
    setHandoffAnswerId(null);
    updateSession('missions',current=>current.selectedSuggestionId===null?current:{...current,selectedSuggestionId:null});
  },[updateSession]);

  const selectSuggestion=useCallback((id:string|null)=>{
    updateSession(tab,current=>({...current,selectedSuggestionId:id}));
    if(id){
      const link=answer?.proposed_links.find(item=>item.id===id);
      closePanel();
      setOpenTab(tab);
      setTraceTarget({scope:graphScopeKey,id:link?.dependency_id??id});
    }
  },[answer,closePanel,graphScopeKey,tab,updateSession]);
  const markReviewed=useCallback((id:string)=>updateSession(tab,current=>({...current,
    reviewed:new Set(current.reviewed).add(id)})),[tab,updateSession]);
  const dismiss=useCallback((id:string)=>{
    updateSession(tab,current=>({...current,dismissed:new Set(current.dismissed).add(id),selectedSuggestionId:null}));
    setTraceTarget(null);
  },[tab,updateSession]);
  const restore=useCallback((id:string)=>updateSession(tab,current=>{
    const next=new Set(current.dismissed);
    next.delete(id);
    return {...current,dismissed:next};
  }),[tab,updateSession]);
  const clearContextNode=useCallback(()=>updateSession(tab,current=>({...current,contextNodeId:null})),[tab,updateSession]);

  const proposedNodes=useMemo(()=>stale?[]:answer?.proposed_nodes.filter(node=>!dismissed.has(node.id)) ?? [],[answer,stale,dismissed]);
  const proposedLinks=useMemo(()=>{
    if(stale||!answer)return [];
    const visibleNodeIds=new Set(proposedNodes.map(node=>node.id));
    return answer.proposed_links.filter(link=>!dismissed.has(link.id) &&
      (!link.dependent_id.startsWith('proposal:')||visibleNodeIds.has(link.dependent_id)) &&
      (!link.dependency_id.startsWith('proposal:')||visibleNodeIds.has(link.dependency_id)));
  },[answer,stale,dismissed,proposedNodes]);
  const graphAnswer=handoffActive?handoffAnswer:tab==='dominoes'&&!stale?answer:null;
  const graphSourceTab:DaveyTab|null=graphAnswer?(handoffActive?'missions':'dominoes'):null;
  const graphDismissed=handoffActive?sessions.missions.dismissed:dismissed;
  const graphReviewed=handoffActive?sessions.missions.reviewed:reviewed;
  const graphSelectedSuggestionId=handoffActive?sessions.missions.selectedSuggestionId:selectedSuggestionId;
  const graphProposedNodes=useMemo(()=>graphAnswer?.proposed_nodes.filter(node=>!graphDismissed.has(node.id))??[],
    [graphAnswer,graphDismissed]);
  const graphProposedLinks=useMemo(()=>{
    if(!graphAnswer)return [];
    const visible=new Set(graphProposedNodes.map(node=>node.id));
    return graphAnswer.proposed_links.filter(link=>!graphDismissed.has(link.id) &&
      (!link.dependent_id.startsWith('proposal:')||visible.has(link.dependent_id)) &&
      (!link.dependency_id.startsWith('proposal:')||visible.has(link.dependency_id)));
  },[graphAnswer,graphDismissed,graphProposedNodes]);
  const graph=useMemo(()=>({answer:graphAnswer,sourceTab:graphSourceTab,proposedNodes:graphProposedNodes,
    proposedLinks:graphProposedLinks,reviewed:graphReviewed,selectedSuggestionId:graphSelectedSuggestionId}),
    [graphAnswer,graphSourceTab,graphProposedNodes,graphProposedLinks,graphReviewed,graphSelectedSuggestionId]);
  const selectGraphSuggestion=useCallback((id:string|null)=>{
    if(!handoffActive){selectSuggestion(id);return;}
    updateSession('missions',current=>({...current,selectedSuggestionId:id}));
    if(id){
      const link=handoffAnswer?.proposed_links.find(item=>item.id===id);
      closePanel();
      setOpenTab('dominoes');
      setTraceTarget({scope:graphScopeKey,id:link?.dependency_id??id});
    }
  },[handoffActive,selectSuggestion,updateSession,handoffAnswer,closePanel,graphScopeKey]);
  const markGraphReviewed=useCallback((id:string)=>{
    if(!handoffActive){markReviewed(id);return;}
    updateSession('missions',current=>({...current,reviewed:new Set(current.reviewed).add(id)}));
  },[handoffActive,markReviewed,updateSession]);
  const dismissGraphSuggestion=useCallback((id:string)=>{
    if(!handoffActive){dismiss(id);return;}
    updateSession('missions',current=>({...current,dismissed:new Set(current.dismissed).add(id),selectedSuggestionId:null}));
    setTraceTarget(null);
  },[handoffActive,dismiss,updateSession]);
  const value=useMemo<DaveyValue>(()=>({tab,open,openDrawer,closeDrawer,clearChat,history,answer,stale,loading,error,ask,adoptAnswer,trace,clearTrace,
    traceNodeId,contextNodeId,clearContextNode,proposedNodes,proposedLinks,selectedSuggestionId,selectSuggestion,
    reviewed,dismissed,markReviewed,dismiss,restore,graph,selectGraphSuggestion,markGraphReviewed,dismissGraphSuggestion}),
    [tab,open,openDrawer,closeDrawer,clearChat,history,answer,stale,loading,error,ask,adoptAnswer,trace,clearTrace,traceNodeId,proposedNodes,proposedLinks,
      contextNodeId,clearContextNode,selectedSuggestionId,selectSuggestion,reviewed,dismissed,markReviewed,dismiss,restore,
      graph,selectGraphSuggestion,markGraphReviewed,dismissGraphSuggestion]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDavey():DaveyValue {
  const value=useContext(Context);
  if(!value)throw new Error('useDavey requires DaveyProvider');
  return value;
}
