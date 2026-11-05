// Presentation adapter only. All readiness calculations and writes belong to FastAPI.
import type * as T from './types';
import { ApiError } from './errors';
import { configureBands, oddsStatus, pct } from '../theme/status';
export { ApiError };
// Set from the signed-in account's first unit (the dataset's unit order); no unit is assumed here.
let selectedShip = '';
let paused = false;
let displayedVersion: number | undefined;
/** Bundled public-domain aerial photos (web/public/shore, written by scripts/build_shore_imagery.py). */
const SHORE_PHOTOS: Record<string, string> = { NSNORFOLK: 'norfolk_naip.json', NSAHR: 'nsahr_naip.json' };
const shownFixes = new Map<string, {fix:T.Fix; version:number}>();
export const currentShip = () => selectedShip;
export function selectShip(id: string) { selectedShip = id; }
export async function backend(path: string, body?: unknown): Promise<any> {
  const r = await fetch('/api/' + path, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type':'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
  const d = await r.json();
  if (r.status === 401 && path !== 'login') window.dispatchEvent(new Event('locker:signed-out'));
  if (!r.ok) throw new ApiError(r.status, typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail || d), r.status === 409 ? 'STALE_VERSION' : 'VALIDATION');
  return d;
}
/** The signed-in account. The server checks it on every request; the UI only hides what the role cannot use. */
export interface Account { username: string; role: 'fleet' | 'co'; title: string; detail: string; units: string[] }
export const auth = {
  session: async (): Promise<Account | null> => (await backend('session')).user,
  accounts: (): Promise<Omit<Account, 'units'>[]> => backend('accounts'),
  login: (username: string): Promise<Account> => backend('login', { username }),
  logout: (): Promise<unknown> => backend('logout', {}),
};

export async function daveyIdentity(): Promise<T.DaveyIdentity> {
  const state = await backend('scenario/version');
  return {epoch:state.epoch, source_revision:state.source_revision, scenario_version:state.version,
    scenario_digest:state.scenario_digest, exercise_cursor:state.cursor, source_health_at:state.source_health_at};
}

export async function askDavey(body:T.DaveyAskRequest, signal?:AbortSignal):Promise<T.DaveyAnswer> {
  const response=await fetch('/api/davey/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  if(response.status===401)window.dispatchEvent(new Event('locker:signed-out'));
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
/** Mounts lower than this (model units; the illustrative ship's main deck is ~10) are drawn below deck, seen in x-ray. */
const BELOW_DECK_HEIGHT = 8;
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
const missionRows = (d: any, ship: string | null = selectedShip): T.Mission[] => d.forecast.missions.filter((m: any) => ship === null || m.ship_id === ship).map((m: any) => {
  const unit = d.state.ships.find((s: any) => s.ship_id === m.ship_id);
  const base = d.baseline?.missions?.find((x: any) => x.event_id === m.event_id);
  const odds = probability(m.p_assessed);
  const oddsAtStart = probability(m.p_ready);
  const baseline = base ? probability(base.p_assessed) : NaN;
  const gate = m.gates.find((g: any) => g.gate_id === m.next_domino);
  return {
    id:m.event_id, code:code(m), name:m.name, unitId:m.ship_id, unitName:unit?.name || m.ship_id, unitKind:unit?.kind === 'installation' ? 'installation' : 'ship', type:m.areas.join(' / '), description:`${m.name}. Interval assessment through ${m.end}. Start: ${pct(oddsAtStart)}. ${m.coverage_issues.join('; ')}`,
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
    nodes.push({id,kind,label,subtitle:kind,p:probability(p),status:oddsStatus(probability(p)),reason,metric:pct(probability(p)),missions:ms,recordIds:sources(refs),dataAgeHours:sourceAge(d,refs),stale:refs.some(s=>Object.keys(d.issues.stale).some(f=>s.file.startsWith(f))),contradictionCount:0,nextDominoFor:chosen.filter(m=>m.nextDominoId===id && m.status!=='ready').map(m=>m.id)}); // a Ready event has no domino to flag
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
          // An open defect that leaves the system at or above the requirement does not limit it: show it as a watch
          // item, not as a 0% chance of readiness under a requirement that is met.
          const tolerated=i.score_while_active!=null && gate.min_score!=null && i.score_while_active>=gate.min_score && (i.p_active_at_mission ?? 0)>0;
          add(id,i.kind==='person'?'person':'part',i.title,mission.p_assessed==null?null:tolerated?1:(i.p_available_interval ?? (i.p_active_at_mission!=null?1-i.p_active_at_mission:gate.p_ok)),i.sources || [],[m.id],
            [...(tolerated?[`Open, but not limiting: while open the system scores ${i.score_while_active}, and this requirement needs ${gate.min_score}.`]:[]),...(i.explain || [])].join('; '));
          if(tolerated){const n=nodes[nodes.length-1];n.status='watch';n.metric='Not limiting';}
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
/** Split one CSV line, honoring quoted fields ("PUMP, COOLING WATER, SPY-1D"). */
function csvSplit(line:string):string[]{
  const out:string[]=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){const ch=line[i];
    if(q){if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(ch==='"')q=false;else cur+=ch;}
    else if(ch==='"')q=true;else if(ch===','){out.push(cur);cur='';}else cur+=ch;}
  out.push(cur);return out;
}
/** Only the cited part of a source: the CSV row as column/value pairs, or the cited line with two lines of context. */
function excerpt(doc:any):T.SourceRecord['excerpt']{
  const lines:string[]=doc.lines || [];const nums:number[]=doc.line_numbers || lines.map((_:string,i:number)=>i+1);
  const at=doc.highlight!=null?nums.indexOf(doc.highlight):-1;
  if(doc.kind==='csv'&&lines.length>1){
    const head=csvSplit(lines[0]);const row=csvSplit(lines[at>0?at:1]);
    return {kind:'row',pairs:head.map((h,i)=>[h.replace(/_/g,' '),row[i] ?? ''] as [string,string]).filter(([,v])=>v!=='')};
  }
  if(!lines.length)return undefined;
  const c=at>=0?at:(doc.highlight_text?lines.findIndex((l:string)=>l.includes(doc.highlight_text)):-1);
  const lo=c>=0?Math.max(0,c-2):0, hi=c>=0?Math.min(lines.length,c+3):Math.min(lines.length,6);
  return {kind:'lines',lines:lines.slice(lo,hi).map((t:string,i:number)=>({n:nums[lo+i] ?? lo+i+1,text:t,hit:lo+i===c}))};
}
async function record(id:string):Promise<T.SourceRecord> {
  if (!id.startsWith('src:')) throw new ApiError(404,'No source reference for this item','NOT_FOUND');
  const ref=JSON.parse(decodeURIComponent(id.slice(4)));
  const doc=await backend('source?'+new URLSearchParams({file:ref.file,loc:ref.loc || '',span:ref.span || ''}));
  return {id,system:doc.meta?.real_system || 'Canonical source',title:ref.key || ref.file,asOf:doc.meta?.as_of || '',ageHours:Math.max(0,(Date.parse(exerciseCursor)-Date.parse(doc.meta?.as_of))/3600000),stale:Boolean(doc.meta?.stale),summary:ref.span || ref.file,fields:{file:ref.file,location:ref.loc || ''},excerpt:excerpt(doc)};
}
async function getMissions():Promise<T.MissionsPayload> {
  const d=await dashboard(); displayedVersion=d.state.version; exerciseCursor=d.state.cursor;
  const unit=d.state.ships.find((s:any)=>s.ship_id===selectedShip) || d.state.ships[0];
  const missions=missionRows(d,unit.ship_id);
  const unitName=(u:string)=>u==='squadron'?'Squadron-wide':(d.state.ships.find((x:any)=>x.ship_id===u)?.name || u);
  const feeds=d.sources.sources.map((s:any)=>{const unit=String(s.file).split('/')[0];return {id:s.file,label:`${s.real_system}: ${s.status} / ${s.usage}`,asOf:s.as_of,ageHours:Math.max(0,(Date.parse(d.state.cursor)-Date.parse(s.as_of))/3600000),stale:s.status!=='loaded',
    unit,unitName:unitName(unit),system:s.real_system,file:s.file,status:s.status,usage:s.usage,steward:s.steward,refresh:s.refresh,thresholdDays:s.staleness_threshold_days,records:s.record_count,rejected:s.rejected_count,explanation:s.explanation};});
  return {ship:{name:unit.name,hull:unit.hull,kind:unit.kind || 'ship',homeport:'Synthetic exercise',deployInDays:missions[0]?.daysOut || 0},missions,history:{},freshness:{feeds,oldestHours:Math.max(0,...feeds.map((f:any)=>f.ageHours).filter(Number.isFinite)),staleCount:feeds.filter((f:any)=>f.stale).length},stopped:paused,generatedAt:d.state.cursor};
}
/** Every unit's missions, ships and installations together, for the fleet-wide Mission Overview. */
async function getFleetMissions():Promise<T.Mission[]> {
  const d=await dashboard(); displayedVersion=d.state.version; exerciseCursor=d.state.cursor;
  return missionRows(d,null);
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
    return {id:gates.length?`${raw.find((m:any)=>m.gates.some((g:any)=>g.gate_id==='system:'+s.eic)).event_id}|system:${s.eic}`:'system:'+s.eic,name:s.eic==='HELO'?'Helo deck':s.name,tag:s.eic,department:(ashore?areaNames[s.mission_areas[0]]:s.mission_areas[0]) || 'Other',deck:!ashore && (d.visualization.mounts[s.mounts[0]]?.[1] ?? Infinity) < BELOW_DECK_HEIGHT?'below':'top',location:ashore?'Illustrative base layout':'Illustrative DDG mount',mount:s.mounts[0] || null,status:oddsStatus(p),reason:Number.isNaN(p)?'Insufficient evidence':gates.length?`Worst scheduled event-interval requirement: ${pct(p)}`:`Material capability (score >= 0.6), nearest forecast sample: ${pct(p)}. Not an event-interval gate.`,dataAgeHours:sourceAge(d,gates.flatMap((g:any)=>g.items.flatMap((i:any)=>i.sources || []))),stale:gates.some((g:any)=>g.items.some((i:any)=>(i.sources || []).some((r:any)=>Object.keys(d.issues.stale).some(f=>r.file.startsWith(f))))),sourceIds:sources(gates.length?gates.flatMap((g:any)=>g.items.flatMap((i:any)=>i.sources || [])):[{file:ashore?'squadron/shore_profile.json':'squadron/mission_equipment_tree.json',key:s.eic}]),isNextDomino:focus?.nextDominoId?.endsWith('system:'+s.eic) || false,dominoVia:null,
      p,
      missions:raw.filter((m:any)=>m.gates.some((g:any)=>g.gate_id==='system:'+s.eic)).map((m:any)=>({id:m.event_id,code:code(m),p:probability(m.gates.find((g:any)=>g.gate_id==='system:'+s.eic).p_ok)})),
      evidence:gates.flatMap((g:any)=>(g.items || []).map((i:any)=>({title:i.title,detail:(i.explain || []).join(' ') || '',p:probability(i.p_available_interval ?? (i.p_active_at_mission!=null?1-i.p_active_at_mission:g.p_ok))})))
        .filter((e:any,k:number,all:any[])=>all.findIndex((x:any)=>x.title===e.title)===k).sort((a:any,b:any)=>(a.p||0)-(b.p||0)).slice(0,4)};
  });
  const tally=(xs:T.ShipSystem[])=>({ready:xs.filter(s=>s.status==='ready').length,watch:xs.filter(s=>s.status==='watch').length,risk:xs.filter(s=>s.status==='risk').length,unknown:xs.filter(s=>s.status==='unknown').length});
  const counts=tally(systems);
  const mountPoints=Object.fromEntries(systems.flatMap(s=>s.mount && d.visualization.mounts[s.mount]?[[s.mount,d.visualization.mounts[s.mount]]]:[]));
  return {name:unit.name,hull:unit.hull,kind:ashore?'installation':'ship',mountPoints,layout:ashore?d.visualization.layouts?.[ship] ?? null:undefined,photo:ashore?SHORE_PHOTOS[ship] ?? null:undefined,berths:ashore?d.state.berths:undefined,hullType:ashore?'Installation':'DDG',className:ashore?'Mock installation for demonstration':'Illustrative DDG',systems,counts,overall:{ready:counts.ready,total:systems.length,readyShare:counts.ready/systems.length},departments:[...new Set(systems.map(s=>s.department))].map(id=>{const xs=systems.filter(s=>s.department===id), c=tally(xs);return {id,name:id,counts:c,ready:c.ready,total:xs.length,worst:c.unknown?'unknown':c.risk?'risk':c.watch?'watch':'ready'};}),missionAtRisk:focus?.status!=='ready'?focus:null,nextDomino:focus?.nextDominoId?{nodeId:focus.nextDominoId,label:focus.nextDominoLabel || '',reason:focus.nextDominoReason || '',systemId:systems.find(s=>s.isNextDomino)?.id || null,missionId:focus.id,missionCode:focus.code,gain:0,sourceIds:[]}:null,generatedAt:d.state.cursor};
}
function deltas(before:any,after:any):T.MissionDelta[] { return after.missions.map((m:any)=>{const b=before.missions.find((x:any)=>x.event_id===m.event_id); return {missionId:m.event_id,code:code(m),before:probability(b.p_assessed),after:probability(m.p_assessed),statusBefore:oddsStatus(probability(b.p_assessed)),statusAfter:oddsStatus(probability(m.p_assessed))};}); }
async function mutate(path:string,body:any={}) {
  if(paused) throw new ApiError(423,'This browser is paused. Resume before making changes.','STOPPED');
  if(displayedVersion===undefined) throw new ApiError(409,'Load the current assessment first.','STALE_VERSION');
  return backend(path,{...body,base_version:displayedVersion});
}
const MOVES = 0.005;
const points = (p:number) => `${p >= 0 ? '+' : '−'}${Math.round(Math.abs(p) * 100)}`; // abs first: Math.round(-0.5) is -0
/** Effects on other units in words: costs first, then units the package also helps. mission_p_delta sums a unit's
 * event changes; capability_delta is its material score. */
function donorText(d:any, effects:Record<string, {mission_p_delta:number; capability_delta:number}>):string {
  const name = (u:string) => d.state.ships.find((s:any) => s.ship_id === u)?.name || u;
  const part = (label:string, x:number) => Math.abs(x) >= MOVES ? `${label} ${points(x)} pts` : '';
  const rows = Object.entries(effects || {}).map(([u, v]) => ({ u, events: v.mission_p_delta, material: v.capability_delta }));
  const say = (r:typeof rows[number]) => `${name(r.u)}: ${[part('event odds (summed)', r.events), part('material', r.material)].filter(Boolean).join(', ')}`;
  const costs = rows.filter((r) => r.events <= -MOVES || r.material <= -MOVES);
  const gains = rows.filter((r) => !costs.includes(r) && (r.events >= MOVES || r.material >= MOVES));
  return [costs.length ? `Cost to other units: ${costs.map(say).join('; ')}.` : 'No cost to other units.',
    gains.length ? `Also helps ${gains.map(say).join('; ')}.` : ''].filter(Boolean).join(' ');
}
async function getFixes(missionId:string):Promise<T.FixesPayload> {
  const d=await dashboard(), ranking=await backend('fixes/'+selectedShip);
  // Rankings compare options on their own larger common-random-number run, so their baseline differs from the headline
  // estimate by sampling noise. Show each option's change on top of the headline number so the page agrees with itself.
  const headline=(id:string)=>probability(d.forecast.missions.find((r:any)=>r.event_id===id)?.p_assessed ?? null);
  const anchor=(id:string, before:number, p:number)=>{const h=headline(id);return Number.isFinite(h)?Math.max(0,Math.min(1,h+(p-before))):p;};
  const fixes=ranking.candidates.map((f:any):T.Fix=>{
    const m=f.missions.find((x:any)=>x.event_id===missionId) || f.missions.find((x:any)=>x.ship_id===selectedShip);
    const after=anchor(m.event_id,m.p_before,m.p_after);
    return {id:f.fix_id,missionId:m.event_id,rank:f.rank,title:f.title,action:f.title,rationale:`${f.why.join('; ').replace(/\.$/,'')}. ${donorText(d,f.donor_effects)}`,owner:'Human review required',effort:'Medium',
      confidence:after,targets:f.gates,recordIds:[],oddsBefore:anchor(m.event_id,m.p_before,m.p_before),oddsAfter:after,
      otherMissions:f.missions.filter((x:any)=>x.event_id!==m.event_id && Math.abs(x.p_after-x.p_before)>=MOVES)
        .map((x:any)=>({missionId:x.event_id,code:x.ship_id+' / '+(code(d.forecast.missions.find((r:any)=>r.event_id===x.event_id)) || x.display || x.codename || x.label),before:anchor(x.event_id,x.p_before,x.p_before),after:anchor(x.event_id,x.p_before,x.p_after)})),
      externalApproval:'Exercise only. Interval comparison; review donor consequences.',decision:'pending'};
  });
  if(ranking.warning) throw new ApiError(422,ranking.warning,'COVERAGE');
  // A tab shows the options that move its own event. Options that only help another event are named, not listed.
  const helpful=fixes.filter((f:T.Fix)=>f.oddsAfter-f.oddsBefore>=MOVES);
  const elsewhere=[...new Set<string>(fixes.flatMap((f:T.Fix)=>f.otherMissions.filter(o=>o.after-o.before>=MOVES).map(o=>o.code)))];
  const note=helpful.length ? ranking.note : fixes.length
    ? `None of the ${fixes.length} ranked options changes this event.${elsewhere.length ? ` They help ${elsewhere.join(', ')}; pick that event above.` : ''}`
    : ranking.note;
  // Decisions live in the backend change log (undo removes them). The latest decision per fix wins.
  const decisions=new Map<string,any>();
  for(const c of d.log?.changes ?? []) if(c.kind==='fix_decision' && c.payload?.fix?.fix_id) decisions.set(c.payload.fix.fix_id,c.payload);
  const forThis=(p:any)=>p.expected ? missionId in p.expected : true;
  const decided=[...decisions.entries()].filter(([,p])=>forThis(p)).map(([id,p]):T.Fix=>{
    const shown=shownFixes.get(id)?.fix;
    return {...(shown ?? {id,missionId,rank:0,title:p.fix.title,action:p.fix.title,rationale:'',owner:'Human review required',effort:'Medium',
      confidence:0,targets:[],recordIds:[],oddsBefore:0,oddsAfter:0,otherMissions:[]}),decision:p.decision==='approve'?'approved':'rejected'};
  }).reverse();
  const pending=helpful.filter((f:T.Fix)=>!decisions.has(f.id));
  // After an approval, alternatives shown before it that no longer help are listed as covered, not silently dropped.
  const approvedHere=decided.some((f)=>f.decision==='approved');
  const live=new Set(helpful.map((f:T.Fix)=>f.id));
  const superseded=approvedHere ? [...shownFixes.values()].map((s)=>s.fix).filter((f)=>f.missionId===missionId && !live.has(f.id) && !decisions.has(f.id)) : [];
  helpful.forEach((fix:T.Fix)=>shownFixes.set(fix.id,{fix,version:d.state.version}));
  return {missionId,fixes:pending,decided,superseded,note};
}
/** "251200Z NOV 26" from an ISO time, matching the backend's DTG style. */
function dtg(iso:string|null|undefined):string|null{
  if(!iso)return null;const t=new Date(iso);if(Number.isNaN(t.getTime()))return null;
  const p=(n:number)=>String(n).padStart(2,'0');
  return `${p(t.getUTCDate())}${p(t.getUTCHours())}${p(t.getUTCMinutes())}Z ${t.toLocaleString('en-US',{month:'short',timeZone:'UTC'}).toUpperCase()} ${String(t.getUTCFullYear()).slice(2)}`;
}
/** One plain-language line per fix step, from the backend's structured step. */
function stepText(d:any,st:any):string{
  const unit=(id:any)=>{const u=d.state.ships.find((x:any)=>x.ship_id===id);return u?u.name:String(id ?? '').replace(/_/g,' ');};
  const jcn=(k:any)=>k?` (JCN ${String(k).replace(/^job:/,'')})`:'';
  const ev=(id:string)=>{const m=d.forecast.missions.find((x:any)=>x.event_id===id);return m?`${code(m)} (${unit(m.ship_id)})`:id;};
  if(st.kind==='part_transfer'&&st.source_kind==='cannibalize')return `Cannibalize NIIN ${st.niin} from ${unit(st.donor)} ${st.donor_comp ?? ''} (${st.installed} installed, ${st.min_working} must keep working) to ${unit(st.receiver)}${jcn(st.item_key)}`;
  if(st.kind==='part_transfer')return `Requisition NIIN ${st.niin} from ${unit(st.holder)} (${st.source_kind}) to ${unit(st.receiver)}${jcn(st.item_key)}`;
  if(st.kind==='expedite')return `Expedite requisition ${st.doc_number} for ${unit(st.receiver)}${jcn(st.item_key)}`;
  if(st.kind==='shift_mission')return `Move ${ev(st.event_id)} ${Math.abs(st.days)} days ${st.days<0?'earlier':'later'}`;
  const rest=Object.entries(st).filter(([k])=>k!=='kind').map(([k,v])=>`${k.replace(/_/g,' ')} ${typeof v==='object'?JSON.stringify(v):v}`).join(', ');
  return `${titleCaseWords(String(st.kind).replace(/_/g,' '))}${rest?': '+rest:''}`;
}
const titleCaseWords=(t:string)=>t.charAt(0).toUpperCase()+t.slice(1);
/** Structured detail for the printed brief: every event of the unit, its unmet requirements and what drives them, and the ranked fixes. */
async function briefDetail(d:any):Promise<T.BriefDetail>{
  const raw=d.forecast.missions.filter((m:any)=>m.ship_id===selectedShip);
  let ranking:any=null;try{ranking=await backend('fixes/'+selectedShip);}catch{ranking=null;}
  const srcLabel=(r:any)=>r?`${r.file}${r.loc?' '+r.loc:''}`:null;
  const missions=raw.map((m:any)=>{
    const gates=(m.gates||[]).filter((g:any)=>g.p_ok==null||g.p_ok<0.995);
    const status=oddsStatus(probability(m.p_assessed));
    return {id:m.event_id,code:code(m),name:m.name||m.label,startDtg:m.start_dtg||dtg(m.start)||'',startLocal:m.start_local||'',endDtg:dtg(m.end),
      pInterval:probability(m.p_assessed),pStart:probability(m.p_ready),status,consequence:m.consequence||'',
      nextDomino:(m.gates||[]).find((g:any)=>g.gate_id===m.next_domino)?.label ?? null,
      requirements:gates.sort((a:any,b:any)=>(a.p_ok??0)-(b.p_ok??0)).map((g:any)=>({label:g.label,kind:g.kind,p:probability(g.p_ok),gain:Math.max(0,g.uplift??0),
        drivers:(g.items||[]).slice(0,3).map((i:any)=>({title:i.title,detail:(i.explain||[]).join('; '),source:srcLabel((i.sources||[])[0])}))})),
      metCount:(m.gates||[]).length-gates.length};
  });
  const ownIds=new Set(raw.map((m:any)=>m.event_id));
  const fixes=(ranking?.candidates||[]).slice(0,5).map((c:any)=>({rank:c.rank,title:c.title,why:c.why||[],steps:(c.steps||[]).map((st:any)=>stepText(d,st)),
    effects:(c.missions||[]).filter((x:any)=>ownIds.has(x.event_id)&&Math.abs(x.p_after-x.p_before)>=MOVES).map((x:any)=>{const r=d.forecast.missions.find((r:any)=>r.event_id===x.event_id);const h=probability(r?.p_assessed ?? null);
      return {code:code(r),before:Number.isFinite(h)?h:x.p_before,after:Number.isFinite(h)?Math.max(0,Math.min(1,h+(x.p_after-x.p_before))):x.p_after};}),
    others:donorText(d,c.donor_effects)}));
  return {asOf:d.state.cursor_dtg||dtg(d.state.cursor)||d.state.cursor,seed:d.state.seed,runs:d.state.runs,missions,fixes};
}
const event=(e:any,i:number):T.DemoEvent=>({id:e.event_id,seq:i+1,type:({casrep:'CASREP',supply:'SUPPLY',personnel:'PERSONNEL',schedule:'SCHEDULE',facility:'FACILITY'} as any)[e.kind] || 'SCHEDULE',title:e.title,summary:e.title,recordId:e.refs[0]?sourceId({file:e.refs[0].split('#')[0]}):'',arrivedAt:e.played?e.known_at:undefined});
/** One activity-log record in plain words, filed under the right filter. */
function logLine(c:any):{type:T.LogType;message:string} {
  const p=c.payload || {};
  switch (c.kind) {
    case 'play_event': return {type:'event',message:`Event received: ${p.title || p.event_id}`};
    case 'fix_decision': {
      const verb=p.decision==='approve'?'Approved':p.decision==='reject'?'Rejected':'Updated';
      return {type:p.decision==='approve'?'approval':p.decision==='reject'?'rejection':'modification',
        message:`${verb} fix: ${p.fix?.title || p.fix?.fix_id || 'fix'}${p.note ? ` (note: ${p.note})` : ''}`};
    }
    case 'set_assumption': return {type:'scenario',message:`Assumption changed: ${p.key} = ${p.value}`};
    case 'confirm_fact': return {type:'system',message:`Report fact ${p.fact_id} ${p.include ? 'confirmed' : 'excluded'} for the forecast`};
    case 'action': {
      const what:Record<string,string>={delay_part:`Delay part ${p.doc_number} by ${p.days} days`,remove_person:`Remove sailor ${p.member_id}`,
        shift_mission:`Shift ${p.event_id} by ${p.days} days`,add_casrep:`Hypothetical CAT ${p.category} casualty on ${p.eic}`};
      return {type:'scenario',message:`${p.ship_id ? p.ship_id+': ' : ''}${what[p.type] || p.type}`};
    }
    default: return {type:'system',message:`${c.kind}: ${JSON.stringify(p)}`};
  }
}
export const api = {
  getMissions,getFleetMissions,getShip,getFixes,
  getGraph:async(focus='all')=>graph(await dashboard(),focus),
  getNode:async(id:string,focus='all'):Promise<T.NodeDetail>=>{const d=await dashboard(),g=graph(d,focus);let node=g.nodes.find(n=>n.id===id);if(!node){const s=(await getShip()).systems.find(s=>s.id===id);if(!s)throw new ApiError(404,'Dependency not in selected ship','NOT_FOUND');node={id,kind:'equipment',label:s.name,subtitle:s.tag,status:s.status,p:NaN,reason:s.reason,metric:'Unknown',missions:[],recordIds:s.sourceIds,dataAgeHours:0,stale:false,contradictionCount:0,nextDominoFor:[]};}return {node,why:[node.reason],records:await Promise.all(node.recordIds.map(record)),contradictions:[],dependsOn:g.edges.filter(e=>e.source===id).map(e=>g.nodes.find(n=>n.id===e.target)!),dependents:g.edges.filter(e=>e.target===id).map(e=>g.nodes.find(n=>n.id===e.source)!),perMission:g.missions.filter(m=>node!.missions.includes(m.id)).map(m=>({missionId:m.id,code:m.code,p:node!.p,status:node!.status}))};},
  getRecord:async(id:string):Promise<T.RecordDetail>=>({record:await record(id),linkedNodes:[],contradictions:[]}),
  getEvents:async():Promise<T.EventsPayload>=>{const d=await dashboard();return {delivered:d.state.feed.map(event).filter((e:T.DemoEvent)=>e.arrivedAt).reverse(),remaining:d.state.feed.filter((e:any)=>!e.played).length,nextTitle:d.state.feed.find((e:any)=>!e.played)?.title || null};},
  nextEvent:async():Promise<T.NextEventResult>=>{const b=await dashboard();await mutate('events/play');const a=await dashboard();const i=b.state.feed.findIndex((e:any)=>!e.played);return {event:event(a.state.feed[i],i),changes:[],missionDeltas:deltas(b.forecast,a.forecast),remaining:a.state.feed.filter((e:any)=>!e.played).length};},
  /** Withdraw the CO's approve/reject on one fix (any decision, not only the newest). The fix returns to the ranked list. */
  undoDecision:async(fixId:string):Promise<{missionDeltas:T.MissionDelta[]}>=>{if(paused)throw new ApiError(423,'This browser is paused. Resume before making changes.','STOPPED');const b=await dashboard();await backend('fixes/undo',{base_version:b.state.version,fix_id:fixId});const a=await dashboard();return {missionDeltas:deltas(b.forecast,a.forecast)};},
  decide:async(req:T.DecisionRequest):Promise<T.DecisionResult>=>{if(req.decision==='modify')throw new ApiError(422,'Use the what-if lab to preview changes.','VALIDATION');const shown=shownFixes.get(req.fixId);if(!shown || paused)throw new ApiError(409,'Reload the comparison and resume before deciding.','STALE_VERSION');const f=shown.fix;const b=await dashboard();await backend('fixes/decide',{base_version:shown.version,fix_id:req.fixId,decision:req.decision,note:req.note || ''});const a=await dashboard();return {fix:{...f,decision:req.decision==='approve'?'approved':'rejected'},changes:[],missionDeltas:deltas(b.forecast,a.forecast)};},
  runScenario:async(req:T.ScenarioRequest):Promise<T.ScenarioResult>=>{
    const p=await backend('captain/preview',{base_version:displayedVersion,ship_id:selectedShip,changes:req.changes});
    return {id:'Preview v'+p.base_version,changes:req.changes,description:['Isolated backend preview; no shared state changed. Hypothetical casualties assume a seven-day repair estimate.'],missionDeltas:deltas(p.before,p.after),nodeChanges:[]};},
  getBrief:async(id:string):Promise<T.Brief>=>{const d=await dashboard(),m=missionRows(d).find(m=>m.id===id) || missionRows(d)[0],b=await backend('brief',{ship_id:selectedShip});const unit=d.state.ships.find((s:any)=>s.ship_id===selectedShip);return {missionId:m.id,title:`${m.code} / ${selectedShip} readiness brief`,unit:unit?`${unit.name} (${unit.hull})`:selectedShip,classification:'SYNTHETIC EXERCISE',generatedAt:d.state.cursor,detail:await briefDetail(d),bottomLine:`${m.code}: ${pct(m.odds)} across sampled event interval`,odds:m.odds,status:m.status,sections:[{heading:'Backend assessment',paragraphs:[{text:b.text,cites:sources(b.citations)}]}],citations:await Promise.all(sources(b.citations).map(record))};},
  getLog:async():Promise<T.LogEntry[]>=>{const l=await backend('log');return l.changes.map((c:any)=>({id:String(c.seq),ts:c.wall_time,actor:c.actor,refs:[],...logLine(c)})).reverse();},
  stop:async(req:T.StopRequest):Promise<T.StopResult>=>{paused=req.stopped;return {stopped:paused,at:new Date().toISOString()};},
  logAction:async(type:T.LogType,message:string,refs:string[]=[]):Promise<T.LogEntry>=>({id:'local',ts:new Date().toISOString(),type,actor:'Browser (not persisted)',message,refs}),
  resetDemo:async()=>{await mutate('reset');return {ok:true};},
};
export type Api = typeof api;
