// ---------------------------------------------------------------------------
// Mock readiness engine. Pure functions over an in-memory State.
// This stands in for the real backend's model: it only exists so that demo
// events, approved fixes and What-If runs all move the odds consistently.
// ---------------------------------------------------------------------------
import type {
  CasrepCategory,
  Contradiction,
  Effect,
  GraphEdge,
  GraphNode,
  Mission,
  MissionDelta,
  NodeChange,
  NodeKind,
  Ship,
  Status,
} from './types';

export interface MissionDef {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string;
  dayOffset: number;
  recordId: string;
  requires: string[];
}

export interface EquipmentDef {
  id: string;
  name: string;
  tag: string;
  group: string;
  baseP: number;
  note?: string;
  casrep: CasrepCategory | null;
  casrepRecordId?: string;
  parts: string[];
  quals?: { qual: string; min: number; label: string };
  recordIds: string[];
}

export interface PartDef {
  id: string;
  name: string;
  detail: string;
  nsn: string;
  etaHours: number | null; // null = on hand
  installHours: number;
  source: string;
  recordIds: string[];
}

export interface PersonDef {
  id: string;
  name: string;
  rate: string;
  quals: string[];
  departsInHours: number | null;
  recordIds: string[];
  temp?: boolean;
  note?: string;
}

export interface RecordDef {
  id: string;
  feed: string;
  title: string;
  summary: string;
  fields: Record<string, string>;
  asOfMs: number;
}

export interface FeedDef {
  id: string;
  label: string;
  asOfMs: number;
}

export interface State {
  ship: Ship;
  bootMs: number;
  missions: MissionDef[];
  equipment: Record<string, EquipmentDef>;
  parts: Record<string, PartDef>;
  people: Record<string, PersonDef>;
  records: Record<string, RecordDef>;
  feeds: FeedDef[];
  contradictions: Contradiction[];
  attached: Record<string, string[]>; // extra record ids attached to nodes by events
  staleAfterHours: number;
}

// --- thresholds -------------------------------------------------------------
// Mission thresholds compare whole percentages, so the label always matches the
// number on screen (no "80% / Watch" surprises).
export const MISSION_READY = 82;
export const MISSION_WATCH = 50;
const EQUIP_READY = 0.975;
const EQUIP_WATCH = 0.7;
const PART_READY = 0.95;
const PART_WATCH = 0.7;

const STATUS_RANK: Record<Status, number> = { ready: 0, watch: 1, risk: 2 };
export const worse = (a: Status, b: Status): Status => (STATUS_RANK[a] >= STATUS_RANK[b] ? a : b);

export const missionHours = (m: MissionDef) => m.dayOffset * 24;

export function fmtHours(h: number): string {
  const abs = Math.abs(h);
  if (abs < 48) return `${Math.round(abs)} h`;
  const d = abs / 24;
  return `${Number.isInteger(d) ? d : d.toFixed(1)} d`;
}

export const pct = (p: number) => `${Math.round(p * 100)}%`;

// --- probabilities -------------------------------------------------------------
export function partMargin(part: PartDef, mh: number): number | null {
  if (part.etaHours === null) return null;
  return mh - (part.etaHours + part.installHours);
}

export function partP(part: PartDef, mh: number): number {
  const margin = partMargin(part, mh);
  if (margin === null) return 0.99;
  if (margin >= 72) return 0.97;
  if (margin >= 24) return 0.88;
  if (margin >= 0) return 0.72;
  return 0.3;
}

export function qualifiedAvailable(s: State, qual: string, mh: number): PersonDef[] {
  return Object.values(s.people).filter(
    (p) => p.quals.includes(qual) && (p.departsInHours === null || p.departsInHours > mh),
  );
}

export function qualifiedAll(s: State, qual: string): PersonDef[] {
  return Object.values(s.people).filter((p) => p.quals.includes(qual));
}

export function crewP(s: State, e: EquipmentDef, mh: number): number {
  if (!e.quals) return 1;
  const n = qualifiedAvailable(s, e.quals.qual, mh).length;
  if (n >= e.quals.min) return 0.995;
  if (n === e.quals.min - 1) return 0.76;
  return 0.35;
}

function worstPart(s: State, e: EquipmentDef, mh: number): { part: PartDef; p: number } | null {
  let worst: { part: PartDef; p: number } | null = null;
  for (const id of e.parts) {
    const part = s.parts[id];
    if (!part) continue;
    const p = partP(part, mh);
    if (!worst || p < worst.p) worst = { part, p };
  }
  return worst;
}

export function repairP(s: State, e: EquipmentDef, mh: number): number {
  if (!e.casrep) return e.baseP;
  const wp = worstPart(s, e, mh)?.p ?? 0.9;
  switch (e.casrep) {
    case 'C2':
      return 0.75 + 0.25 * wp;
    case 'C3':
      return 0.45 + 0.5 * wp;
    case 'C4':
      return 0.15 + 0.6 * wp;
  }
}

export function equipP(s: State, e: EquipmentDef, mh: number): number {
  return repairP(s, e, mh) * crewP(s, e, mh);
}

export function missionOdds(s: State, m: MissionDef): number {
  const mh = missionHours(m);
  return m.requires.reduce((acc, id) => acc * equipP(s, s.equipment[id], mh), 1);
}

export function missionStatus(odds: number): Status {
  const whole = Math.round(odds * 100);
  if (whole >= MISSION_READY) return 'ready';
  if (whole >= MISSION_WATCH) return 'watch';
  return 'risk';
}

// --- per-mission node evaluation ------------------------------------------------
export interface NodeEval {
  p: number;
  status: Status;
  reason: string;
  metric: string;
}

function evalEquipment(s: State, e: EquipmentDef, mh: number): NodeEval {
  const p = equipP(s, e, mh);
  let status: Status = p >= EQUIP_READY ? 'ready' : p >= EQUIP_WATCH ? 'watch' : 'risk';
  if (e.casrep) status = worse(status, 'watch');
  const reasons: string[] = [];
  if (e.casrep) {
    const wp = worstPart(s, e, mh);
    const waiting = wp && wp.part.etaHours !== null ? `, waiting on ${wp.part.name} (ETA ${fmtHours(wp.part.etaHours)})` : '';
    reasons.push(`CASREP ${e.casrep} open${waiting}`);
  }
  if (e.quals) {
    const n = qualifiedAvailable(s, e.quals.qual, mh).length;
    if (n < e.quals.min) reasons.push(`Only ${n} of ${e.quals.min} ${e.quals.label}`);
  }
  if (!e.casrep && e.baseP < 0.99 && e.note) reasons.push(e.note);
  return { p, status, reason: reasons.join(' · ') || 'No open issues', metric: pct(p) };
}

function evalPart(part: PartDef, mh: number, needed: boolean): NodeEval {
  const p = partP(part, mh);
  const margin = partMargin(part, mh);
  let status: Status = p >= PART_READY ? 'ready' : p >= PART_WATCH ? 'watch' : 'risk';
  // A spare that is not tied to an open CASREP can't sink a mission.
  if (!needed) status = status === 'risk' ? 'watch' : status;
  let reason: string;
  if (margin === null) reason = 'On hand';
  else if (margin < 0) reason = `Arrives ${fmtHours(-margin)} too late (ETA ${fmtHours(part.etaHours!)} + ${part.installHours} h install)`;
  else if (margin < 24) reason = `Only ${Math.round(margin)} h to spare after install`;
  else reason = `ETA ${fmtHours(part.etaHours!)}, ${fmtHours(margin)} to spare`;
  if (!needed && margin !== null) reason = `Spare on order · ${reason}`;
  return { p, status, reason, metric: part.etaHours === null ? 'On hand' : `ETA ${fmtHours(part.etaHours)}` };
}

function evalPerson(s: State, person: PersonDef, mh: number, m: MissionDef): NodeEval {
  const leavesBefore = person.departsInHours !== null && person.departsInHours <= mh;
  let status: Status = 'ready';
  let reason = person.temp ? person.note ?? 'Temporary duty' : 'Available';
  if (leavesBefore) {
    // Risk only if losing this person drops a required system below its minimum.
    const short = m.requires.some((id) => {
      const e = s.equipment[id];
      return e.quals && person.quals.includes(e.quals.qual) && qualifiedAvailable(s, e.quals.qual, mh).length < e.quals.min;
    });
    status = short ? 'risk' : 'watch';
    reason = `Detaches in ${fmtHours(person.departsInHours!)}, before ${m.code}`;
  } else if (person.departsInHours !== null) {
    reason = `Detaches in ${fmtHours(person.departsInHours)} (after ${m.code})`;
  }
  return {
    p: leavesBefore ? 0 : 1,
    status,
    reason,
    metric: person.departsInHours === null ? (person.temp ? 'TAD' : 'Aboard') : `Leaves ${fmtHours(person.departsInHours)}`,
  };
}

export interface MissionEval {
  mission: MissionDef;
  odds: number;
  status: Status;
  nodes: Map<string, NodeEval>;
  kinds: Map<string, NodeKind>;
  edges: { source: string; target: string }[];
}

export function supportersOf(s: State, e: EquipmentDef): PersonDef[] {
  return e.quals ? qualifiedAll(s, e.quals.qual) : [];
}

export function evalMission(s: State, m: MissionDef): MissionEval {
  const mh = missionHours(m);
  const nodes = new Map<string, NodeEval>();
  const kinds = new Map<string, NodeKind>();
  const edges: { source: string; target: string }[] = [];
  const odds = missionOdds(s, m);
  const status = missionStatus(odds);

  for (const eid of m.requires) {
    const e = s.equipment[eid];
    nodes.set(eid, evalEquipment(s, e, mh));
    kinds.set(eid, 'equipment');
    edges.push({ source: m.id, target: eid });
    for (const pid of e.parts) {
      const part = s.parts[pid];
      if (!part) continue;
      const ev = evalPart(part, mh, Boolean(e.casrep));
      const prev = nodes.get(pid);
      if (!prev || STATUS_RANK[ev.status] > STATUS_RANK[prev.status]) nodes.set(pid, ev);
      kinds.set(pid, 'part');
      edges.push({ source: eid, target: pid });
    }
    for (const person of supportersOf(s, e)) {
      nodes.set(person.id, evalPerson(s, person, mh, m));
      kinds.set(person.id, 'person');
      edges.push({ source: eid, target: person.id });
    }
  }
  nodes.set(m.id, { p: odds, status, reason: '', metric: pct(odds) });
  kinds.set(m.id, 'mission');
  return { mission: m, odds, status, nodes, kinds, edges };
}

// --- next domino -------------------------------------------------------------------
export interface Domino {
  id: string;
  gain: number;
  reason: string;
}

export function clone(s: State): State {
  return structuredClone(s);
}

export function nextDomino(s: State, m: MissionDef): Domino | null {
  const mh = missionHours(m);
  const base = missionOdds(s, m);
  const candidates: { id: string; mutate: (c: State) => void }[] = [];
  const seen = new Set<string>();
  for (const eid of m.requires) {
    const e = s.equipment[eid];
    if (e.casrep) {
      for (const pid of e.parts) {
        if (seen.has(pid) || !s.parts[pid] || s.parts[pid].etaHours === null) continue;
        seen.add(pid);
        candidates.push({ id: pid, mutate: (c) => (c.parts[pid].etaHours = null) });
      }
    } else if (e.baseP < 0.99 && !seen.has(eid)) {
      seen.add(eid);
      candidates.push({ id: eid, mutate: (c) => (c.equipment[eid].baseP = 0.995) });
    }
    for (const person of supportersOf(s, e)) {
      if (seen.has(person.id)) continue;
      if (person.departsInHours !== null && person.departsInHours <= mh) {
        seen.add(person.id);
        candidates.push({ id: person.id, mutate: (c) => (c.people[person.id].departsInHours = null) });
      }
    }
  }
  let best: Domino | null = null;
  for (const cand of candidates) {
    const c = clone(s);
    cand.mutate(c);
    const gain = missionOdds(c, c.missions.find((x) => x.id === m.id)!) - base;
    if (gain > 0.004 && (!best || gain > best.gain + 1e-9)) {
      const ev = evalMission(s, m).nodes.get(cand.id);
      best = { id: cand.id, gain, reason: ev?.reason ?? '' };
    }
  }
  return best;
}

// --- labels ----------------------------------------------------------------------
export function nodeLabel(s: State, id: string): { label: string; subtitle: string; kind: NodeKind } {
  const m = s.missions.find((x) => x.id === id);
  if (m) return { label: m.code, subtitle: m.name, kind: 'mission' };
  const e = s.equipment[id];
  if (e) return { label: e.name, subtitle: `${e.tag} · ${e.group}`, kind: 'equipment' };
  const part = s.parts[id];
  if (part) return { label: part.name, subtitle: part.nsn, kind: 'part' };
  const person = s.people[id];
  if (person) return { label: person.name, subtitle: `${person.quals.map(qualName).join(', ')} qualified`, kind: 'person' };
  return { label: id, subtitle: '', kind: 'equipment' };
}

export function qualName(q: string): string {
  return { SR7: 'SR-7 radar', CIWS: 'CIWS', GSM: 'Gas turbine', STG: 'Sonar', LSE: 'LSE' }[q] ?? q;
}

// --- records & freshness ------------------------------------------------------------
export function recordAgeHours(r: RecordDef, now: number): number {
  return Math.max(0, (now - r.asOfMs) / 3_600_000);
}

export function nodeRecordIds(s: State, id: string): string[] {
  const m = s.missions.find((x) => x.id === id);
  const base =
    (m && [m.recordId]) ||
    s.equipment[id]?.recordIds ||
    s.parts[id]?.recordIds ||
    s.people[id]?.recordIds ||
    [];
  const extra = s.attached[id] ?? [];
  const casrep = s.equipment[id]?.casrepRecordId;
  return Array.from(new Set([...base, ...(casrep ? [casrep] : []), ...extra])).filter((r) => s.records[r]);
}

// --- full graph -----------------------------------------------------------------------
export function buildGraph(s: State, focus: string | 'all', now: number) {
  const missions = focus === 'all' ? s.missions : s.missions.filter((m) => m.id === focus);
  const evals = missions.map((m) => evalMission(s, m));
  const dominoes = new Map<string, Domino | null>(s.missions.map((m) => [m.id, nextDomino(s, m)]));

  const agg = new Map<string, { ev: NodeEval; kind: NodeKind; missions: string[] }>();
  const edgeSet = new Map<string, { source: string; target: string }>();
  for (const me of evals) {
    for (const [id, ev] of me.nodes) {
      const prev = agg.get(id);
      const kind = me.kinds.get(id)!;
      if (!prev) agg.set(id, { ev, kind, missions: [me.mission.id] });
      else {
        prev.missions.push(me.mission.id);
        if (STATUS_RANK[ev.status] > STATUS_RANK[prev.ev.status] || (ev.status === prev.ev.status && ev.p < prev.ev.p)) {
          prev.ev = ev;
        }
      }
    }
    for (const e of me.edges) edgeSet.set(`${e.source}->${e.target}`, e);
  }

  const nodes: GraphNode[] = [];
  for (const [id, { ev, kind, missions: ms }] of agg) {
    const { label, subtitle } = nodeLabel(s, id);
    const recordIds = nodeRecordIds(s, id);
    const ages = recordIds.map((r) => recordAgeHours(s.records[r], now));
    const dataAgeHours = ages.length ? Math.max(...ages) : 0;
    const nextDominoFor = s.missions.filter((m) => dominoes.get(m.id)?.id === id).map((m) => m.id);
    let reason = ev.reason;
    if (kind === 'mission') {
      const d = dominoes.get(id);
      reason = d ? `Next domino: ${nodeLabel(s, d.id).label}` : 'No domino in sight';
    }
    nodes.push({
      id,
      kind,
      label,
      subtitle,
      status: ev.status,
      p: ev.p,
      reason,
      metric: ev.metric,
      missions: kind === 'mission' ? [id] : ms,
      recordIds,
      dataAgeHours,
      stale: dataAgeHours >= s.staleAfterHours,
      contradictionCount: s.contradictions.filter((c) => c.nodeId === id).length,
      nextDominoFor: focus === 'all' ? nextDominoFor : nextDominoFor.filter((m) => m === focus),
      temp: s.people[id]?.temp,
      when:
        kind === 'part' && s.parts[id].etaHours !== null
          ? { hours: s.parts[id].etaHours!, label: 'ETA' }
          : kind === 'person' && s.people[id].departsInHours !== null
            ? { hours: s.people[id].departsInHours!, label: 'Leaves' }
            : null,
    });
  }
  const status = new Map(nodes.map((n) => [n.id, n.status]));
  const edges: GraphEdge[] = Array.from(edgeSet.values()).map((e) => ({
    id: `${e.source}->${e.target}`,
    source: e.source,
    target: e.target,
    critical: status.get(e.target) !== 'ready',
  }));
  return { nodes, edges };
}

export function buildMissions(s: State): Mission[] {
  return s.missions.map((m) => {
    const me = evalMission(s, m);
    const d = nextDomino(s, m);
    const flagged = Array.from(me.nodes.entries()).filter(([id, ev]) => id !== m.id && ev.status !== 'ready').length;
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      type: m.type,
      description: m.description,
      date: new Date(s.bootMs + m.dayOffset * 86_400_000).toISOString(),
      daysOut: m.dayOffset,
      odds: me.odds,
      status: me.status,
      nextDominoId: d?.id ?? null,
      nextDominoLabel: d ? nodeLabel(s, d.id).label : null,
      nextDominoReason: d?.reason ?? null,
      requires: m.requires,
      flaggedCount: flagged,
      recordId: nodeRecordIds(s, m.id).at(-1) ?? m.recordId,
    };
  });
}

// --- effects -----------------------------------------------------------------------------
export function applyEffect(s: State, eff: Effect): void {
  switch (eff.op) {
    case 'setCasrep': {
      const e = s.equipment[eff.node];
      e.casrep = eff.category;
      if (eff.recordId) e.casrepRecordId = eff.recordId;
      break;
    }
    case 'setPartEta':
      s.parts[eff.node].etaHours = eff.hours;
      break;
    case 'delayPart': {
      const part = s.parts[eff.node];
      part.etaHours = Math.max(0, (part.etaHours ?? 0) + eff.hours);
      break;
    }
    case 'setDeparture':
      s.people[eff.node].departsInHours = eff.hours;
      break;
    case 'shiftMission': {
      const m = s.missions.find((x) => x.id === eff.mission)!;
      m.dayOffset = Math.max(1, m.dayOffset + eff.days);
      break;
    }
    case 'setBaseP': {
      const e = s.equipment[eff.node];
      e.baseP = eff.p;
      break;
    }
    case 'addPerson':
      s.people[eff.person.id] = { ...eff.person, departsInHours: null, temp: true };
      break;
  }
}

// --- diffs (drive the cascade animation) ------------------------------------------------------
const DEPTH: Record<NodeKind, number> = { part: 0, person: 0, equipment: 1, mission: 2 };

export function diffStates(before: State, after: State, now: number): { changes: NodeChange[]; missionDeltas: MissionDelta[] } {
  const a = new Map(buildGraph(before, 'all', now).nodes.map((n) => [n.id, n]));
  const b = buildGraph(after, 'all', now).nodes;
  const changes: NodeChange[] = [];
  for (const n of b) {
    const prev = a.get(n.id);
    if (prev && prev.status !== n.status) {
      changes.push({ nodeId: n.id, label: n.label, kind: n.kind, from: prev.status, to: n.status, depth: DEPTH[n.kind] });
    }
  }
  changes.sort((x, y) => x.depth - y.depth);
  const missionDeltas: MissionDelta[] = after.missions.map((m) => {
    const bm = before.missions.find((x) => x.id === m.id)!;
    const ob = missionOdds(before, bm);
    const oa = missionOdds(after, m);
    return { missionId: m.id, code: m.code, before: ob, after: oa, statusBefore: missionStatus(ob), statusAfter: missionStatus(oa) };
  });
  return { changes, missionDeltas };
}
