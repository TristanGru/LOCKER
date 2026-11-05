// Presentation adapter only. All readiness calculations and writes belong to FastAPI.
import type * as T from './types';
import { ApiError } from './errors';
import { configureBands, oddsStatus, pct } from '../theme/status';
export { ApiError };
let selectedShip = 'KESSLER';
let paused = false;
let displayedVersion: number | undefined;
const shownFixes = new Map<string, {fix:T.Fix; version:number}>();
export const currentShip = () => selectedShip;
export function selectShip(id: string) { selectedShip = id; }
export async function backend(path: string, body?: unknown): Promise<any> {
  const r = await fetch('/api/' + path, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type':'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
  const d = await r.json();
  if (!r.ok) throw new ApiError(r.status, typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail || d), r.status === 409 ? 'STALE_VERSION' : 'VALIDATION');
  return d;
}

export async function daveyIdentity(): Promise<T.DaveyIdentity> {
  const state = await backend('scenario/version');
  return {epoch:state.epoch, source_revision:state.source_revision, scenario_version:state.version,
    scenario_digest:state.scenario_digest, exercise_cursor:state.cursor, source_health_at:state.source_health_at};
}

export async function askDavey(body:T.DaveyAskRequest, signal?:AbortSignal):Promise<T.DaveyAnswer> {
  const response=await fetch('/api/davey/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  const data=await response.json();
  if(!response.ok)throw new ApiError(response.status,typeof data.detail==='string'?data.detail:JSON.stringify(data.detail || data),response.status===409?'STALE_VERSION':'VALIDATION');
  return data as T.DaveyAnswer;
}

export async function daveyEvidence(answerId:string,evidenceId:string):Promise<T.DaveyEvidence> {
  const data=await backend(`davey/answers/${encodeURIComponent(answerId)}/evidence/${encodeURIComponent(evidenceId)}`);
  return data.evidence as T.DaveyEvidence;
}
export async function dashboard(): Promise<any> {
  const d = await backend('dashboard');
  configureBands(d.forecast.bands);
  configureNames(d.forecast.missions);
  return d;
}
const probability = (p: number | null) => p == null ? NaN : p;
let exerciseCursor = '';
function sourceAge(d:any, refs:any[]):number {
  const times=refs.map(ref=>d.sources.sources.find((s:any)=>ref.file.startsWith(s.file.replace(/\/$/,'')))?.as_of).map((x:string)=>Date.parse(x)).filter(Number.isFinite);
  return times.length ? Math.max(0,(Date.parse(d.state.cursor)-Math.min(...times))/3600000) : NaN;
}
// Mission names come from the event plan (events_missions.json codename), registered on every dashboard load.
// A shore support window is named after the ship event it supports; the label is the fallback.
const missionNames = new Map<string, string>();
function configureNames(missions: any[]) {
  missionNames.clear();
  for (const m of missions) if (m.codename) missionNames.set(m.event_id, m.codename);
}
const code = (m: any): string =>
  m?.codename || (m?.supports && missionNames.get(m.supports) ? `PIER SUPPORT: ${missionNames.get(m.supports)}` : m?.label);
const sourceId = (s: any) => 'src:' + encodeURIComponent(JSON.stringify(s));
const sources = (rows: any[] = []) => rows.map(sourceId);
/** Calendar days from the exercise date to the event date. Clock time was rounding a 12-day gap up to 13. */
function daysUntil(start: string, cursor: string) {
  const eventDay = Date.parse(String(start).slice(0, 10));
  const cursorDay = Date.parse(String(cursor).slice(0, 10));
  if (!Number.isFinite(eventDay) || !Number.isFinite(cursorDay)) return 0;
  return Math.round((eventDay - cursorDay) / 86400000);
}
const missionRows = (d: any, ship = selectedShip): T.Mission[] => d.forecast.missions.filter((m: any) => m.ship_id === ship).map((m: any) => {
  const base = d.baseline?.missions?.find((x: any) => x.event_id === m.event_id);
  const odds = probability(m.p_assessed);
  const oddsAtStart = probability(m.p_ready);
  const baseline = base ? probability(base.p_assessed) : NaN;
  const gate = m.gates.find((g: any) => g.gate_id === m.next_domino);
  return {
    id:m.event_id, code:code(m), name:m.name, type:m.areas.join(' / '), description:`${m.name}. Interval assessment through ${m.end}. Start: ${pct(oddsAtStart)}. ${m.coverage_issues.join('; ')}`,
    date:m.start, daysOut:daysUntil(m.start, d.state.cursor), odds, oddsAtStart,
    baselineDelta: Number.isFinite(odds) && Number.isFinite(baseline) ? Math.round((odds - baseline) * 100) : null,
    status:oddsStatus(odds),
    nextDominoId:m.next_domino ? `${m.event_id}|${m.next_domino}` : null,
    nextDominoLabel:gate?.label || null,
    nextDominoReason:gate ? (gate.p_ok == null ? 'Insufficient evidence for this requirement' : `${pct(gate.p_ok)} meets this requirement across the event interval`) : null,
    requires:m.gates.map((g:any)=>`${m.event_id}|${g.gate_id}`), flaggedCount:m.gates.filter((g:any)=>g.p_ok==null || g.p_ok<d.forecast.bands.green).length, recordId:sourceId(m.sources[0]),
  };
});
function graph(d: any, focus = 'all'): T.GraphPayload {
  const missions = missionRows(d); const chosen = missions.some(m=>m.id===focus) ? missions.filter(m=>m.id===focus) : missions;
  const nodes:T.GraphNode[] = [], edges:T.GraphEdge[] = [];
  const add = (id:string,kind:T.NodeKind,label:string,p:number|null,refs:any[],ms:string[],reason='') => {
    nodes.push({id,kind,label,subtitle:kind,p:probability(p),status:oddsStatus(probability(p)),reason,metric:pct(probability(p)),missions:ms,recordIds:sources(refs),dataAgeHours:sourceAge(d,refs),stale:refs.some(s=>Object.keys(d.issues.stale).some(f=>s.file.startsWith(f))),contradictionCount:0,nextDominoFor:chosen.filter(m=>m.nextDominoId===id).map(m=>m.id)});
  };
  for (const m of chosen) {
    const raw=d.forecast.missions.find((x:any)=>x.event_id===m.id);
    add(m.id,'mission',m.code,raw.p_assessed,raw.sources,[m.id],m.description);
    for (const g of raw.gates) {
      const gid=`${m.id}|${g.gate_id}`;
      add(gid,g.kind==='team'?'person':'equipment',g.label,g.p_ok,g.sources || g.items.flatMap((i:any)=>i.sources || []),[m.id],'Event-interval requirement');
      edges.push({id:m.id+'>'+gid,source:m.id,target:gid,critical:g.p_ok==null || g.p_ok<d.forecast.bands.green});
      const addItems=(gate:any,parentId:string,mission:any)=>{
        for (const i of gate.items || []) {
          const id=parentId+'|'+i.key;
          add(id,i.kind==='person'?'person':'part',i.title,mission.p_assessed==null?null:(i.p_available_interval ?? (i.p_active_at_mission!=null?1-i.p_active_at_mission:gate.p_ok)),i.sources || [],[m.id],(i.explain || []).join('; '));
          edges.push({id:parentId+'>'+id,source:parentId,target:id,critical:false});
        }
      };
      addItems(g,gid,raw);
      // The dependency chain continues ashore, so a ship event shows which facility is limiting it.
      if (g.supporting_event) {
        const parent=d.forecast.missions.find((x:any)=>x.event_id===g.supporting_event);
        for (const pg of parent?.gates || []) {
          if (pg.p_ok!=null && pg.p_ok>=d.forecast.bands.green) continue;
          const pid=gid+'|'+pg.gate_id;
          add(pid,pg.kind==='team'?'person':'equipment',`${parent.ship_id}: ${pg.label}`,pg.p_ok,(pg.items || []).flatMap((i:any)=>i.sources || []),[m.id],'Shore support requirement');
          edges.push({id:gid+'>'+pid,source:gid,target:pid,critical:true});
          addItems(pg,pid,parent);
        }
      }
    }
  }
  return {focus,nodes,edges,missions,generatedAt:d.state.cursor};
}
async function record(id:string):Promise<T.SourceRecord> {
  if (!id.startsWith('src:')) throw new ApiError(404,'No source reference for this item','NOT_FOUND');
  const ref=JSON.parse(decodeURIComponent(id.slice(4)));
  const doc=await backend('source?'+new URLSearchParams({file:ref.file,loc:ref.loc || '',span:ref.span || ''}));
  return {id,system:doc.meta?.real_system || 'Canonical source',title:ref.key || ref.file,asOf:doc.meta?.as_of || '',ageHours:Math.max(0,(Date.parse(exerciseCursor)-Date.parse(doc.meta?.as_of))/3600000),stale:Boolean(doc.meta?.stale),summary:ref.span || ref.file,fields:{file:ref.file,location:ref.loc || '',evidence:doc.lines.join('\n')}};
}
async function getMissions():Promise<T.MissionsPayload> {
  const d=await dashboard(); displayedVersion=d.state.version; exerciseCursor=d.state.cursor;
  const unit=d.state.ships.find((s:any)=>s.ship_id===selectedShip) || d.state.ships[0];
  const missions=missionRows(d,unit.ship_id);
  const feeds=d.sources.sources.map((s:any)=>({id:s.file,label:`${s.real_system}: ${s.status} / ${s.usage}`,asOf:s.as_of,ageHours:Math.max(0,(Date.parse(d.state.cursor)-Date.parse(s.as_of))/3600000),stale:s.status!=='loaded'}));
  return {ship:{name:unit.name,hull:unit.hull,kind:unit.kind || 'ship',homeport:'Synthetic exercise',deployInDays:missions[0]?.daysOut || 0},missions,history:{},freshness:{feeds,oldestHours:Math.max(0,...feeds.map((f:any)=>f.ageHours).filter(Number.isFinite)),staleCount:feeds.filter((f:any)=>f.stale).length},stopped:paused,generatedAt:d.state.cursor};
}
async function getShip():Promise<T.ShipPayload> {
  const ship=selectedShip, d=await dashboard(), missions=missionRows(d,ship), focus=[...missions].sort((a,b)=>a.odds-b.odds)[0];
  const unit=d.state.ships.find((s:any)=>s.ship_id===ship), raw=d.forecast.missions.filter((m:any)=>m.ship_id===ship);
  const ashore=unit.kind==='installation', areaNames=d.visualization.mission_areas || {};
  const systems:T.ShipSystem[]=d.visualization.systems.filter((s:any)=>s.eic===s.system_eic && (s.units || []).includes(ship)).map((s:any)=>{
    const gates=raw.flatMap((m:any)=>m.gates.filter((g:any)=>g.gate_id==='system:'+s.eic));
    const index=Math.max(0,d.forecast.grid_dates.map((t:string)=>Date.parse(t)<=Date.parse(d.state.cursor)).lastIndexOf(true));
    const material=d.forecast.ships[ship].system_p_ok[s.eic]?.[index];
    const p=gates.length ? (gates.every((g:any)=>g.p_ok!=null)?Math.min(...gates.map((g:any)=>g.p_ok)):NaN) : probability(material ?? null);
    return {id:gates.length?`${raw.find((m:any)=>m.gates.some((g:any)=>g.gate_id==='system:'+s.eic)).event_id}|system:${s.eic}`:'system:'+s.eic,name:s.eic==='HELO'?'Helo deck':s.name,tag:s.eic,department:(ashore?areaNames[s.mission_areas[0]]:s.mission_areas[0]) || 'Other',deck:!ashore && ['engine_p','engine_s','genset_1','genset_2','chill','sonar'].includes(s.mounts[0])?'below':'top',location:ashore?'Illustrative base layout':'Illustrative DDG mount',mount:s.mounts[0] || null,status:oddsStatus(p),reason:Number.isNaN(p)?'Insufficient evidence':gates.length?`Worst scheduled event-interval requirement: ${pct(p)}`:`Material capability (score >= 0.6), nearest forecast sample: ${pct(p)}. Not an event-interval gate.`,dataAgeHours:sourceAge(d,gates.flatMap((g:any)=>g.items.flatMap((i:any)=>i.sources || []))),stale:gates.some((g:any)=>g.items.some((i:any)=>(i.sources || []).some((r:any)=>Object.keys(d.issues.stale).some(f=>r.file.startsWith(f))))),sourceIds:sources(gates.length?gates.flatMap((g:any)=>g.items.flatMap((i:any)=>i.sources || [])):[{file:ashore?'squadron/shore_profile.json':'squadron/mission_equipment_tree.json',key:s.eic}]),isNextDomino:focus?.nextDominoId?.endsWith('system:'+s.eic) || false,dominoVia:null};
  });
  const tally=(xs:T.ShipSystem[])=>({ready:xs.filter(s=>s.status==='ready').length,watch:xs.filter(s=>s.status==='watch').length,risk:xs.filter(s=>s.status==='risk').length,unknown:xs.filter(s=>s.status==='unknown').length});
  const counts=tally(systems);
  const mountPoints=ashore?Object.fromEntries(systems.flatMap(s=>s.mount && d.visualization.mounts[s.mount]?[[s.mount,d.visualization.mounts[s.mount]]]:[])):undefined;
  return {name:unit.name,hull:unit.hull,kind:ashore?'installation':'ship',mountPoints,layout:ashore?d.visualization.layouts?.[ship] ?? null:undefined,berths:ashore?d.state.berths:undefined,hullType:ashore?'Installation':'DDG',className:ashore?'Mock installation for demonstration':'Illustrative DDG',systems,counts,overall:{ready:counts.ready,total:systems.length,readyShare:counts.ready/systems.length},departments:[...new Set(systems.map(s=>s.department))].map(id=>{const xs=systems.filter(s=>s.department===id), c=tally(xs);return {id,name:id,counts:c,ready:c.ready,total:xs.length,worst:c.unknown?'unknown':c.risk?'risk':c.watch?'watch':'ready'};}),missionAtRisk:focus?.status!=='ready'?focus:null,nextDomino:focus?.nextDominoId?{nodeId:focus.nextDominoId,label:focus.nextDominoLabel || '',reason:focus.nextDominoReason || '',systemId:systems.find(s=>s.isNextDomino)?.id || null,missionId:focus.id,missionCode:focus.code,gain:0,sourceIds:[]}:null,generatedAt:d.state.cursor};
}
function deltas(before:any,after:any):T.MissionDelta[] { return after.missions.map((m:any)=>{const b=before.missions.find((x:any)=>x.event_id===m.event_id); return {missionId:m.event_id,code:code(m),before:probability(b.p_assessed),after:probability(m.p_assessed),statusBefore:oddsStatus(probability(b.p_assessed)),statusAfter:oddsStatus(probability(m.p_assessed))};}); }
async function mutate(path:string,body:any={}) {
  if(paused) throw new ApiError(423,'This browser is paused. Resume before making changes.','STOPPED');
  if(displayedVersion===undefined) throw new ApiError(409,'Load the current assessment first.','STALE_VERSION');
  return backend(path,{...body,base_version:displayedVersion});
}
async function getFixes(missionId:string):Promise<T.FixesPayload> {
  const d=await dashboard(), ranking=await backend('fixes/'+selectedShip);
  const fixes=ranking.candidates.map((f:any):T.Fix=>{const m=f.missions.find((x:any)=>x.event_id===missionId) || f.missions.find((x:any)=>x.ship_id===selectedShip);return {id:f.fix_id,missionId:m.event_id,rank:f.rank,title:f.title,action:f.title,rationale:f.why.join('; ')+' Donor effects: '+JSON.stringify(f.donor_effects),owner:'Human review required',effort:'Medium',confidence:m.p_after,targets:f.gates,recordIds:[],oddsBefore:m.p_before,oddsAfter:m.p_after,otherMissions:f.missions.filter((x:any)=>x.event_id!==m.event_id).map((x:any)=>({missionId:x.event_id,code:x.ship_id+' / '+code(d.forecast.missions.find((r:any)=>r.event_id===x.event_id)),before:x.p_before,after:x.p_after})),externalApproval:'Exercise only. Interval comparison; review donor consequences.',decision:'pending'};});
  if(ranking.warning) throw new ApiError(422,ranking.warning,'COVERAGE');
  fixes.forEach((fix:T.Fix)=>shownFixes.set(fix.id,{fix,version:d.state.version}));
  return {missionId,fixes,decided:[],note:ranking.note};
}
const event=(e:any,i:number):T.DemoEvent=>({id:e.event_id,seq:i+1,type:({casrep:'CASREP',supply:'SUPPLY',personnel:'PERSONNEL',schedule:'SCHEDULE',facility:'FACILITY'} as any)[e.kind] || 'SCHEDULE',title:e.title,summary:e.title,recordId:e.refs[0]?sourceId({file:e.refs[0].split('#')[0]}):'',arrivedAt:e.played?e.known_at:undefined});
export const api = {
  getMissions,getShip,getFixes,
  getGraph:async(focus='all')=>graph(await dashboard(),focus),
  getNode:async(id:string,focus='all'):Promise<T.NodeDetail>=>{const d=await dashboard(),g=graph(d,focus);let node=g.nodes.find(n=>n.id===id);if(!node){const s=(await getShip()).systems.find(s=>s.id===id);if(!s)throw new ApiError(404,'Dependency not in selected ship','NOT_FOUND');node={id,kind:'equipment',label:s.name,subtitle:s.tag,status:s.status,p:NaN,reason:s.reason,metric:'Unknown',missions:[],recordIds:s.sourceIds,dataAgeHours:0,stale:false,contradictionCount:0,nextDominoFor:[]};}return {node,why:[node.reason],records:await Promise.all(node.recordIds.map(record)),contradictions:[],dependsOn:g.edges.filter(e=>e.source===id).map(e=>g.nodes.find(n=>n.id===e.target)!),dependents:g.edges.filter(e=>e.target===id).map(e=>g.nodes.find(n=>n.id===e.source)!),perMission:g.missions.filter(m=>node!.missions.includes(m.id)).map(m=>({missionId:m.id,code:m.code,p:node!.p,status:node!.status}))};},
  getRecord:async(id:string):Promise<T.RecordDetail>=>({record:await record(id),linkedNodes:[],contradictions:[]}),
  getEvents:async():Promise<T.EventsPayload>=>{const d=await dashboard();return {delivered:d.state.feed.map(event).filter((e:T.DemoEvent)=>e.arrivedAt).reverse(),remaining:d.state.feed.filter((e:any)=>!e.played).length,nextTitle:d.state.feed.find((e:any)=>!e.played)?.title || null};},
  nextEvent:async():Promise<T.NextEventResult>=>{const b=await dashboard();await mutate('events/play');const a=await dashboard();const i=b.state.feed.findIndex((e:any)=>!e.played);return {event:event(a.state.feed[i],i),changes:[],missionDeltas:deltas(b.forecast,a.forecast),remaining:a.state.feed.filter((e:any)=>!e.played).length};},
  decide:async(req:T.DecisionRequest):Promise<T.DecisionResult>=>{if(req.decision==='modify')throw new ApiError(422,'Use the what-if lab to preview changes.','VALIDATION');const shown=shownFixes.get(req.fixId);if(!shown || paused)throw new ApiError(409,'Reload the comparison and resume before deciding.','STALE_VERSION');const f=shown.fix;const b=await dashboard();await backend('fixes/decide',{base_version:shown.version,fix_id:req.fixId,decision:req.decision,note:req.note || ''});const a=await dashboard();return {fix:{...f,decision:req.decision==='approve'?'approved':'rejected'},changes:[],missionDeltas:deltas(b.forecast,a.forecast)};},
  runScenario:async(req:T.ScenarioRequest):Promise<T.ScenarioResult>=>{
    const p=await backend('captain/preview',{base_version:displayedVersion,ship_id:selectedShip,changes:req.changes});
    return {id:'Preview v'+p.base_version,changes:req.changes,description:['Isolated backend preview; no shared state changed. Hypothetical casualties assume a seven-day repair estimate.'],missionDeltas:deltas(p.before,p.after),nodeChanges:[]};},
  getBrief:async(id:string):Promise<T.Brief>=>{const d=await dashboard(),m=missionRows(d).find(m=>m.id===id) || missionRows(d)[0],b=await backend('brief',{ship_id:selectedShip});return {missionId:m.id,title:`${m.code} / ${selectedShip} readiness brief`,classification:'SYNTHETIC EXERCISE',generatedAt:d.state.cursor,bottomLine:`${m.code}: ${pct(m.odds)} across sampled event interval`,odds:m.odds,status:m.status,sections:[{heading:'Backend assessment',paragraphs:[{text:b.text,cites:sources(b.citations)}]}],citations:await Promise.all(sources(b.citations).map(record))};},
  getLog:async():Promise<T.LogEntry[]>=>{const l=await backend('log');return l.changes.map((c:any)=>({id:String(c.seq),ts:c.wall_time,type:'system',actor:c.actor,message:c.kind+': '+JSON.stringify(c.payload),refs:[]})).reverse();},
  stop:async(req:T.StopRequest):Promise<T.StopResult>=>{paused=req.stopped;return {stopped:paused,at:new Date().toISOString()};},
  logAction:async(type:T.LogType,message:string,refs:string[]=[]):Promise<T.LogEntry>=>({id:'local',ts:new Date().toISOString(),type,actor:'Browser (not persisted)',message,refs}),
  resetDemo:async()=>{await mutate('reset');return {ok:true};},
};
export type Api = typeof api;
