// ---------------------------------------------------------------------------
// In-browser mock backend. Implements every LOCKER endpoint against the JSON
// in /src/mock. Swap it out by pointing api.ts at a real server.
// It never edits ship data: events are the only "incoming" data, and the plan
// model only changes when the captain approves a fix.
// ---------------------------------------------------------------------------
import graphJson from '../mock/graph.json';
import recordsJson from '../mock/records.json';
import eventsJson from '../mock/events.json';
import fixesJson from '../mock/fixes.json';
import shipJson from '../mock/ship.json';
import { ApiError } from './errors';
import {
  applyEffect,
  buildGraph,
  buildMissions,
  clone,
  diffStates,
  evalMission,
  fmtHours,
  missionOdds,
  nextDomino,
  nodeLabel,
  nodeRecordIds,
  pct,
  recordAgeHours,
  type EquipmentDef,
  type PartDef,
  type PersonDef,
  type RecordDef,
  type State,
} from './engine';
import type {
  Brief,
  BriefSection,
  Contradiction,
  DecisionRequest,
  DecisionResult,
  DemoEvent,
  Effect,
  EventsPayload,
  Fix,
  FixParam,
  FixesPayload,
  Freshness,
  GraphPayload,
  HullType,
  LogEntry,
  LogType,
  MissionsPayload,
  NextEventResult,
  NodeDetail,
  NodeLink,
  OddsPoint,
  RecordDetail,
  ShipPayload,
  ShipSystem,
  ScenarioChange,
  ScenarioRequest,
  ScenarioResult,
  SourceRecord,
  Status,
  StopRequest,
  StopResult,
} from './types';

interface EventDef {
  id: string;
  seq: number;
  type: DemoEvent['type'];
  title: string;
  summary: string;
  feed: string;
  records: Omit<RecordDef, 'asOfMs'>[];
  attach: Record<string, string[]>;
  contradictions: Contradiction[];
  effects: Effect[];
}

interface FixDef {
  id: string;
  missionIds: string[];
  title: string;
  action: string;
  rationale: string;
  owner: string;
  effort: Fix['effort'];
  confidence: number;
  targets: string[];
  recordIds: string[];
  externalApproval?: string;
  effects: Effect[];
  param?: FixParam;
}

const EVENTS = eventsJson as unknown as EventDef[];
const FIX_CATALOG = fixesJson as unknown as FixDef[];
const CAPTAIN = 'CO (Captain)';
const SYSTEM = 'LOCKER';

// --- server state -----------------------------------------------------------------
interface ServerState {
  model: State;
  delivered: DemoEvent[];
  decisions: Record<string, { decision: 'approved' | 'rejected'; at: string; missionId: string; note?: string }>;
  fixParams: Record<string, number>;
  recommended: Set<string>;
  log: LogEntry[];
  history: Record<string, OddsPoint[]>;
  stopped: boolean;
  logSeq: number;
  scenarioSeq: number;
}

function initialModel(now: number): State {
  const g = graphJson as unknown as {
    ship: State['ship'];
    missions: State['missions'];
    equipment: EquipmentDef[];
    parts: PartDef[];
    people: PersonDef[];
    contradictions: Contradiction[];
  };
  const r = recordsJson as unknown as {
    staleAfterHours: number;
    feeds: { id: string; label: string; ageHours: number }[];
    records: (Omit<RecordDef, 'asOfMs'> & { ageHours?: number })[];
  };
  const feedAge = new Map(r.feeds.map((f) => [f.id, f.ageHours]));
  return structuredClone({
    ship: g.ship,
    bootMs: now,
    missions: g.missions,
    equipment: Object.fromEntries(g.equipment.map((e) => [e.id, e])),
    parts: Object.fromEntries(g.parts.map((p) => [p.id, p])),
    people: Object.fromEntries(g.people.map((p) => [p.id, p])),
    records: Object.fromEntries(
      r.records.map(({ ageHours, ...rec }) => [
        rec.id,
        { ...rec, asOfMs: now - (ageHours ?? feedAge.get(rec.feed) ?? 0) * 3_600_000 },
      ]),
    ),
    feeds: r.feeds.map((f) => ({ id: f.id, label: f.label, asOfMs: now - f.ageHours * 3_600_000 })),
    contradictions: g.contradictions,
    attached: {},
    staleAfterHours: r.staleAfterHours,
  } satisfies State);
}

let S: ServerState = freshServer();

function freshServer(): ServerState {
  const now = Date.now();
  const s: ServerState = {
    model: initialModel(now),
    delivered: [],
    decisions: {},
    fixParams: {},
    recommended: new Set(),
    log: [],
    history: {},
    stopped: false,
    logSeq: 0,
    scenarioSeq: 0,
  };
  return s;
}

function log(type: LogType, actor: string, message: string, refs: string[] = []) {
  S.logSeq += 1;
  S.log.push({ id: `LOG-${String(S.logSeq).padStart(4, '0')}`, ts: new Date().toISOString(), type, actor, message, refs });
}

function snapshot(label: string) {
  const at = new Date().toISOString();
  for (const m of S.model.missions) {
    (S.history[m.id] ??= []).push({ at, odds: missionOdds(S.model, m), label });
  }
}

function bootLog() {
  snapshot('Baseline');
  log('system', SYSTEM, `Connected to ${S.model.ship.name}. Read-only access to maintenance, supply, personnel and ops feeds.`);
  for (const m of buildMissions(S.model)) {
    log('system', SYSTEM, `${m.code} baseline: ${pct(m.odds)} ready, ${m.daysOut} days out.`, [m.recordId]);
  }
}
bootLog();

// --- helpers ---------------------------------------------------------------------------
function requireRunning(action: string) {
  if (S.stopped) throw new ApiError(423, `LOCKER is stopped. Resume before you ${action}.`, 'STOPPED');
}

function findMission(id: string | null | undefined) {
  const m = S.model.missions.find((x) => x.id === id);
  if (!m) throw new ApiError(404, `Mission ${id ?? '(none)'} not found`, 'NOT_FOUND');
  return m;
}

function toRecord(r: RecordDef, now: number): SourceRecord {
  const ageHours = recordAgeHours(r, now);
  return {
    id: r.id,
    system: S.model.feeds.find((f) => f.id === r.feed)?.label ?? r.feed,
    title: r.title,
    asOf: new Date(r.asOfMs).toISOString(),
    ageHours,
    stale: ageHours >= S.model.staleAfterHours,
    summary: r.summary,
    fields: r.fields,
  };
}

function freshness(now: number): Freshness {
  const feeds = S.model.feeds.map((f) => {
    const ageHours = Math.max(0, (now - f.asOfMs) / 3_600_000);
    return { id: f.id, label: f.label, asOf: new Date(f.asOfMs).toISOString(), ageHours, stale: ageHours >= S.model.staleAfterHours };
  });
  return {
    oldestHours: Math.max(...feeds.map((f) => f.ageHours)),
    staleCount: feeds.filter((f) => f.stale).length,
    feeds,
  };
}

function effectsWithParam(def: FixDef, value: number | undefined): Effect[] {
  if (!def.param || value === undefined) return def.effects;
  return def.effects.map((e) => {
    if (def.param!.key === 'hours' && (e.op === 'setPartEta' || e.op === 'delayPart')) return { ...e, hours: value };
    if (def.param!.key === 'days' && e.op === 'shiftMission') return { ...e, days: value };
    return e;
  });
}

function evaluateFix(def: FixDef, missionId: string): Fix {
  const value = S.fixParams[def.id] ?? def.param?.default;
  const after = clone(S.model);
  for (const e of effectsWithParam(def, value)) applyEffect(after, e);
  const m = findMission(missionId);
  const decided = S.decisions[def.id];
  return {
    id: def.id,
    missionId,
    rank: 0,
    title: def.title,
    action: def.action,
    rationale: def.rationale,
    owner: def.owner,
    effort: def.effort,
    confidence: def.confidence,
    targets: def.targets,
    recordIds: def.recordIds.filter((r) => S.model.records[r]),
    oddsBefore: missionOdds(S.model, m),
    oddsAfter: missionOdds(after, after.missions.find((x) => x.id === missionId)!),
    otherMissions: def.missionIds
      .filter((id) => id !== missionId)
      .map((id) => {
        const om = findMission(id);
        return { missionId: id, code: om.code, before: missionOdds(S.model, om), after: missionOdds(after, after.missions.find((x) => x.id === id)!) };
      }),
    param: def.param && value !== undefined ? { ...def.param, value } : undefined,
    externalApproval: def.externalApproval,
    decision: decided ? decided.decision : 'pending',
  };
}

function link(id: string, status: Status): NodeLink {
  const { label, kind } = nodeLabel(S.model, id);
  return { id, label, kind, status };
}

// --- endpoint handlers -----------------------------------------------------------------------
function getMissions(): MissionsPayload {
  const now = Date.now();
  return {
    ship: S.model.ship,
    missions: buildMissions(S.model),
    history: S.history,
    freshness: freshness(now),
    stopped: S.stopped,
    generatedAt: new Date(now).toISOString(),
  };
}

function getGraph(focus: string): GraphPayload {
  const now = Date.now();
  if (focus !== 'all') findMission(focus);
  const { nodes, edges } = buildGraph(S.model, focus, now);
  return { focus, nodes, edges, missions: buildMissions(S.model), generatedAt: new Date(now).toISOString() };
}

function getNode(id: string, focus: string): NodeDetail {
  const now = Date.now();
  const graph = buildGraph(S.model, focus === 'all' ? 'all' : focus, now);
  let node = graph.nodes.find((n) => n.id === id);
  let full = graph;
  if (!node) {
    full = buildGraph(S.model, 'all', now);
    node = full.nodes.find((n) => n.id === id);
  }
  if (!node) throw new ApiError(404, `Node ${id} not found`, 'NOT_FOUND');
  const statusOf = new Map(full.nodes.map((n) => [n.id, n.status]));

  const perMission = S.model.missions
    .map((m) => ({ m, ev: evalMission(S.model, m).nodes.get(id) }))
    .filter((x) => x.ev)
    .map(({ m, ev }) => ({ missionId: m.id, code: m.code, p: ev!.p, status: ev!.status }));

  const why: string[] = [];
  if (node.kind === 'mission') {
    const m = findMission(id);
    const d = nextDomino(S.model, m);
    why.push(`${pct(node.p)} chance of being ready on day ${m.dayOffset}.`);
    if (d) why.push(`Next domino: ${nodeLabel(S.model, d.id).label}. Fixing it alone adds about ${Math.round(d.gain * 100)} points.`);
    const flagged = full.nodes.filter((n) => n.missions.includes(id) && n.id !== id && n.status !== 'ready');
    if (flagged.length) why.push(`${flagged.length} linked item${flagged.length > 1 ? 's are' : ' is'} flagged: ${flagged.map((n) => n.label).join(', ')}.`);
    else why.push('No linked items are flagged.');
  } else {
    why.push(...node.reason.split(' · '));
    for (const pm of perMission) {
      const m = findMission(pm.missionId);
      const r = evalMission(S.model, m).nodes.get(id)!.reason;
      if (perMission.length > 1 && r !== node.reason) why.push(`For ${pm.code}: ${r}`);
    }
    if (node.nextDominoFor.length || S.model.missions.some((m) => nextDomino(S.model, m)?.id === id)) {
      const ms = S.model.missions.filter((m) => nextDomino(S.model, m)?.id === id);
      for (const m of ms) {
        const d = nextDomino(S.model, m)!;
        why.push(`This is the next domino for ${m.code}: fixing it adds about ${Math.round(d.gain * 100)} points to the odds.`);
      }
    }
  }
  if (node.stale) why.push(`Some source data is ${Math.round(node.dataAgeHours)} h old. Confirm before acting.`);

  const dependsOn = full.edges.filter((e) => e.source === id).map((e) => link(e.target, statusOf.get(e.target) ?? 'ready'));
  const dependents = full.edges.filter((e) => e.target === id).map((e) => link(e.source, statusOf.get(e.source) ?? 'ready'));

  return {
    node,
    why,
    records: nodeRecordIds(S.model, id).map((r) => toRecord(S.model.records[r], now)),
    contradictions: S.model.contradictions.filter((c) => c.nodeId === id),
    dependsOn,
    dependents,
    perMission,
  };
}

interface ShipLayout {
  name: string;
  hull: string;
  hullType?: HullType;
  class: string;
  departments: { id: string; name: string }[];
  systems: Omit<ShipSystem, 'status' | 'reason' | 'dataAgeHours' | 'stale' | 'sourceIds' | 'isNextDomino' | 'dominoVia' | 'tag'>[];
}
const SHIP = shipJson as unknown as ShipLayout;

const HULL_TYPES: HullType[] = ['CVN', 'DDG', 'CG', 'FFG', 'LCS', 'LHD', 'SSN', 'SSBN', 'SSGN'];
/** "DDG-1047 (fictional)" -> 'DDG'. Falls back to DDG for an unknown prefix. */
function parseHullType(hull: string): HullType {
  const m = /^([A-Z]{2,4})-/.exec(hull);
  return m && (HULL_TYPES as string[]).includes(m[1]) ? (m[1] as HullType) : 'DDG';
}

/** The ship-level picture: live status for every system, placed on the hull layout from ship.json. */
function getShip(): ShipPayload {
  const now = Date.now();
  const graph = buildGraph(S.model, 'all', now);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const missions = buildMissions(S.model).sort((a, b) => a.daysOut - b.daysOut);
  const focus = missions.find((m) => m.status === 'risk') ?? missions.find((m) => m.status === 'watch') ?? missions[0] ?? null;

  // The domino may be a part or a sailor; its pin goes on the system it belongs to.
  let dominoSystem: string | null = null;
  const dominoId = focus?.nextDominoId ?? null;
  if (dominoId) {
    if (S.model.equipment[dominoId]) dominoSystem = dominoId;
    else if (S.model.parts[dominoId]) dominoSystem = focus!.requires.find((e) => S.model.equipment[e].parts.includes(dominoId)) ?? null;
    else if (S.model.people[dominoId]) {
      const quals = S.model.people[dominoId].quals;
      dominoSystem = focus!.requires.find((e) => { const q = S.model.equipment[e].quals; return q ? quals.includes(q.qual) : false; }) ?? null;
    }
  }

  const systems: ShipSystem[] = SHIP.systems.map((l) => {
    const n = byId.get(l.id);
    const isNextDomino = l.id === dominoSystem;
    return {
      ...l,
      tag: S.model.equipment[l.id]?.tag ?? '',
      status: n?.status ?? 'ready',
      reason: n?.reason ?? 'No open issues',
      dataAgeHours: n?.dataAgeHours ?? 0,
      stale: n?.stale ?? false,
      sourceIds: n?.recordIds ?? [],
      isNextDomino,
      dominoVia: isNextDomino && dominoId !== l.id ? nodeLabel(S.model, dominoId!).label : null,
    };
  });

  const tally = (list: ShipSystem[]) => ({
    ready: list.filter((s) => s.status === 'ready').length,
    watch: list.filter((s) => s.status === 'watch').length,
    risk: list.filter((s) => s.status === 'risk').length,
  });
  const counts = tally(systems);
  const departments = SHIP.departments.map((d) => {
    const list = systems.filter((s) => s.department === d.id);
    const c = tally(list);
    return { ...d, ready: c.ready, total: list.length, counts: c, worst: (c.risk ? 'risk' : c.watch ? 'watch' : 'ready') as Status };
  });

  const dn = dominoId ? byId.get(dominoId) : undefined;
  return {
    name: SHIP.name,
    hull: SHIP.hull,
    hullType: SHIP.hullType ?? parseHullType(SHIP.hull),
    className: SHIP.class,
    overall: { readyShare: systems.length ? counts.ready / systems.length : 1, ready: counts.ready, total: systems.length },
    counts,
    departments,
    systems,
    nextDomino:
      focus && dominoId
        ? {
            nodeId: dominoId,
            label: nodeLabel(S.model, dominoId).label,
            reason: focus.nextDominoReason ?? dn?.reason ?? '',
            systemId: dominoSystem,
            missionId: focus.id,
            missionCode: focus.code,
            gain: nextDomino(S.model, S.model.missions.find((m) => m.id === focus.id)!)?.gain ?? 0,
            sourceIds: nodeRecordIds(S.model, dominoId),
          }
        : null,
    missionAtRisk: focus && focus.status !== 'ready' ? focus : null,
    generatedAt: new Date(now).toISOString(),
  };
}

function getRecord(id: string): RecordDetail {
  const r = S.model.records[id];
  if (!r) throw new ApiError(404, `Record ${id} not found`, 'NOT_FOUND');
  const now = Date.now();
  const nodeIds = [
    ...S.model.missions.map((m) => m.id),
    ...Object.keys(S.model.equipment),
    ...Object.keys(S.model.parts),
    ...Object.keys(S.model.people),
  ];
  const statusOf = new Map(buildGraph(S.model, 'all', now).nodes.map((n) => [n.id, n.status]));
  return {
    record: toRecord(r, now),
    linkedNodes: nodeIds.filter((n) => nodeRecordIds(S.model, n).includes(id)).map((n) => link(n, statusOf.get(n) ?? 'ready')),
    contradictions: S.model.contradictions.filter((c) => c.a.recordId === id || c.b.recordId === id),
  };
}

function getFixes(missionId: string): FixesPayload {
  findMission(missionId);
  const all = FIX_CATALOG.filter((f) => f.missionIds.includes(missionId)).map((f) => evaluateFix(f, missionId));
  const pending = all
    .filter((f) => f.decision === 'pending' && f.oddsAfter - f.oddsBefore >= 0.005)
    .sort((a, b) => b.oddsAfter - b.oddsBefore - (a.oddsAfter - a.oddsBefore))
    .map((f, i) => ({ ...f, rank: i + 1 }));
  for (const f of pending) {
    const key = `${f.id}:${missionId}`;
    if (!S.recommended.has(key)) {
      S.recommended.add(key);
      log('recommendation', SYSTEM, `Recommended for ${findMission(missionId).code}: ${f.title} (${pct(f.oddsBefore)} -> ${pct(f.oddsAfter)}).`, [f.id, ...f.recordIds]);
    }
  }
  const decided = all.filter((f) => f.decision !== 'pending');
  return { missionId, fixes: pending, decided };
}

function postDecision(req: DecisionRequest): DecisionResult {
  const def = FIX_CATALOG.find((f) => f.id === req.fixId);
  if (!def) throw new ApiError(404, `Fix ${req.fixId} not found`, 'NOT_FOUND');
  const m = findMission(req.missionId);
  if (S.decisions[def.id]) throw new ApiError(409, `${def.title} was already ${S.decisions[def.id].decision}.`, 'ALREADY_DECIDED');
  requireRunning('approve, reject or modify fixes');

  if (req.decision === 'modify') {
    if (!def.param || req.paramValue === undefined) throw new ApiError(400, 'This fix has nothing to modify.', 'BAD_REQUEST');
    const v = Math.min(def.param.max, Math.max(def.param.min, req.paramValue));
    S.fixParams[def.id] = v;
    const fix = evaluateFix(def, m.id);
    log('modification', CAPTAIN, `Modified "${def.title}": ${def.param.label} set to ${v} ${def.param.unit}. Projected ${m.code} ${pct(fix.oddsBefore)} -> ${pct(fix.oddsAfter)}.`, [def.id]);
    return { fix, changes: [], missionDeltas: [] };
  }

  if (req.decision === 'reject') {
    S.decisions[def.id] = { decision: 'rejected', at: new Date().toISOString(), missionId: m.id, note: req.note };
    log('rejection', CAPTAIN, `Rejected "${def.title}"${req.note ? `: ${req.note}` : ''}.`, [def.id]);
    return { fix: evaluateFix(def, m.id), changes: [], missionDeltas: [] };
  }

  // approve
  const before = clone(S.model);
  const preview = evaluateFix(def, m.id);
  const value = S.fixParams[def.id] ?? def.param?.default;
  for (const e of effectsWithParam(def, value)) applyEffect(S.model, e);
  S.decisions[def.id] = { decision: 'approved', at: new Date().toISOString(), missionId: m.id, note: req.note };
  const { changes, missionDeltas } = diffStates(before, S.model, Date.now());
  snapshot(`Approved: ${def.title}`);
  log('approval', CAPTAIN, `Approved "${def.title}". ${m.code} ${pct(preview.oddsBefore)} -> ${pct(preview.oddsAfter)} (projected).`, [def.id, ...def.recordIds]);
  return { fix: { ...preview, decision: 'approved' }, changes, missionDeltas };
}

function describeChange(c: ScenarioChange): string {
  const L = (id: string) => nodeLabel(S.model, id).label;
  switch (c.kind) {
    case 'delayPart':
      return `Delay ${L(c.node)} by ${fmtHours(c.hours)}`;
    case 'removePerson':
      return `Remove ${L(c.node)} from the crew`;
    case 'shiftMission': {
      const m = findMission(c.mission);
      return `Move ${m.code} ${Math.abs(c.days)} day${Math.abs(c.days) === 1 ? '' : 's'} ${c.days < 0 ? 'earlier' : 'later'}`;
    }
    case 'casrep':
      return c.category ? `Open a ${c.category} CASREP on ${L(c.node)}` : `Close the CASREP on ${L(c.node)}`;
  }
}

function postScenario(req: ScenarioRequest): ScenarioResult {
  if (!req.changes?.length) throw new ApiError(400, 'Add at least one change to run a scenario.', 'BAD_REQUEST');
  const after = clone(S.model);
  for (const c of req.changes) {
    switch (c.kind) {
      case 'delayPart':
        if (!after.parts[c.node]) throw new ApiError(404, `Part ${c.node} not found`, 'NOT_FOUND');
        applyEffect(after, { op: 'delayPart', node: c.node, hours: c.hours });
        break;
      case 'removePerson':
        if (!after.people[c.node]) throw new ApiError(404, `Sailor ${c.node} not found`, 'NOT_FOUND');
        applyEffect(after, { op: 'setDeparture', node: c.node, hours: 0 });
        break;
      case 'shiftMission':
        findMission(c.mission);
        applyEffect(after, { op: 'shiftMission', mission: c.mission, days: c.days });
        break;
      case 'casrep':
        if (!after.equipment[c.node]) throw new ApiError(404, `Equipment ${c.node} not found`, 'NOT_FOUND');
        applyEffect(after, { op: 'setCasrep', node: c.node, category: c.category });
        break;
    }
  }
  S.scenarioSeq += 1;
  const id = `WI-${String(S.scenarioSeq).padStart(3, '0')}`;
  const { changes, missionDeltas } = diffStates(S.model, after, Date.now());
  const description = req.changes.map(describeChange);
  log(
    'scenario',
    CAPTAIN,
    `What-if ${id}: ${description.join('; ')}. ${missionDeltas.map((d) => `${d.code} ${pct(d.before)} -> ${pct(d.after)}`).join(', ')}. Nothing changed.`,
    [id],
  );
  return { id, changes: req.changes, description, missionDeltas, nodeChanges: changes };
}

function getEvents(): EventsPayload {
  const next = EVENTS[S.delivered.length];
  return { delivered: [...S.delivered].reverse(), remaining: EVENTS.length - S.delivered.length, nextTitle: next?.title ?? null };
}

function postNextEvent(): NextEventResult {
  requireRunning('pull the next event');
  const def = EVENTS[S.delivered.length];
  if (!def) throw new ApiError(409, 'All demo events have arrived. Reset the demo to replay.', 'NO_MORE_EVENTS');
  const now = Date.now();
  const before = clone(S.model);
  const dominoesBefore = new Map(S.model.missions.map((m) => [m.id, nextDomino(S.model, m)?.id ?? null]));

  for (const r of def.records) S.model.records[r.id] = { ...r, asOfMs: now };
  for (const [nodeId, ids] of Object.entries(def.attach)) {
    S.model.attached[nodeId] = Array.from(new Set([...(S.model.attached[nodeId] ?? []), ...ids]));
  }
  S.model.contradictions.push(...def.contradictions);
  const feed = S.model.feeds.find((f) => f.id === def.feed);
  if (feed) feed.asOfMs = now;
  for (const e of def.effects) applyEffect(S.model, e);

  const { changes, missionDeltas } = diffStates(before, S.model, now);
  const event: DemoEvent = {
    id: def.id,
    seq: def.seq,
    type: def.type,
    title: def.title,
    summary: def.summary,
    recordId: def.records[0]?.id ?? '',
    arrivedAt: new Date(now).toISOString(),
    changes,
    missionDeltas,
  };
  S.delivered.push(event);
  snapshot(`Event ${def.seq}: ${def.type.toLowerCase()}`);
  log('event', def.feed, `${def.title}. ${missionDeltas.filter((d) => Math.abs(d.after - d.before) >= 0.005).map((d) => `${d.code} ${pct(d.before)} -> ${pct(d.after)}`).join(', ') || 'No change to mission odds.'}`, def.records.map((r) => r.id));

  for (const m of S.model.missions) {
    const d = nextDomino(S.model, m);
    if ((d?.id ?? null) !== dominoesBefore.get(m.id) && d) {
      log('recommendation', SYSTEM, `Next domino for ${m.code} is now ${nodeLabel(S.model, d.id).label}.`, nodeRecordIds(S.model, d.id));
    }
  }
  return { event, changes, missionDeltas, remaining: EVENTS.length - S.delivered.length };
}

function cite(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((r) => S.model.records[r])));
}

function getBrief(missionId: string): Brief {
  const now = Date.now();
  const m = findMission(missionId);
  const me = evalMission(S.model, m);
  const odds = me.odds;
  const status = me.status;
  const d = nextDomino(S.model, m);
  const graph = buildGraph(S.model, m.id, now);
  const flagged = graph.nodes.filter((n) => n.id !== m.id && n.status !== 'ready').sort((a, b) => (a.status === 'risk' ? -1 : 1) - (b.status === 'risk' ? -1 : 1));
  const fixes = getFixes(m.id);
  const statusWord = { ready: 'READY', watch: 'WATCH', risk: 'AT RISK' }[status];
  const date = new Date(S.model.bootMs + m.dayOffset * 86_400_000);
  const missionRecs = nodeRecordIds(S.model, m.id);

  const sections: BriefSection[] = [];
  sections.push({
    heading: 'Mission',
    paragraphs: [
      { text: `OP ${m.code} (${m.name}) starts in ${m.dayOffset} days, on ${date.toUTCString().slice(0, 16)}. ${m.description}`, cites: missionRecs },
    ],
  });

  if (d) {
    const dl = nodeLabel(S.model, d.id).label;
    sections.push({
      heading: 'Next domino',
      paragraphs: [{ text: `${dl}: ${d.reason}. Fixing it alone raises the odds by about ${Math.round(d.gain * 100)} points.`, cites: nodeRecordIds(S.model, d.id) }],
    });
  }

  sections.push({
    heading: 'What could stop the mission',
    paragraphs: flagged.length
      ? flagged.map((n) => ({ text: `${n.status === 'risk' ? 'At risk' : 'Watch'}: ${n.label}. ${n.reason}.`, cites: n.recordIds }))
      : [{ text: 'No linked equipment, parts or people are flagged.', cites: [] }],
  });

  const cx = S.model.contradictions.filter((c) => graph.nodes.some((n) => n.id === c.nodeId));
  if (cx.length) {
    sections.push({
      heading: 'Conflicting records',
      paragraphs: cx.map((c) => ({
        text: `${nodeLabel(S.model, c.nodeId).label}, ${c.field}: one record says "${c.a.value}", another says "${c.b.value}". ${c.note}`,
        cites: [c.a.recordId, c.b.recordId],
      })),
    });
  }

  const approved = fixes.decided.filter((f) => f.decision === 'approved');
  sections.push({
    heading: 'Recommended fixes',
    paragraphs: [
      ...fixes.fixes.slice(0, 3).map((f) => ({
        text: `${f.rank}. ${f.title}: ${pct(f.oddsBefore)} -> ${pct(f.oddsAfter)}. Owner: ${f.owner}.${f.externalApproval ? ` ${f.externalApproval}.` : ''}`,
        cites: f.recordIds,
      })),
      ...approved.map((f) => ({ text: `Approved by the CO: ${f.title}.`, cites: f.recordIds })),
      ...(fixes.fixes.length === 0 && approved.length === 0 ? [{ text: 'No fixes are needed right now.', cites: [] }] : []),
    ],
  });

  const fr = freshness(now);
  const stale = fr.feeds.filter((f) => f.stale);
  sections.push({
    heading: 'Data freshness',
    paragraphs: [
      {
        text: stale.length
          ? `${stale.map((f) => `${f.label} (${Math.round(f.ageHours)} h old)`).join(', ')} ${stale.length > 1 ? 'are' : 'is'} stale. Confirm affected items before acting.`
          : 'All feeds updated within the last 24 h.',
        cites: [],
      },
    ],
  });

  for (const s of sections) for (const p of s.paragraphs) p.cites = cite(p.cites);
  const citedIds = Array.from(new Set(sections.flatMap((s) => s.paragraphs.flatMap((p) => p.cites))));

  const bottomLine =
    status === 'ready'
      ? `${m.code} is READY: ${pct(odds)} chance of being mission capable on day ${m.dayOffset}.`
      : `${m.code} is ${statusWord}: ${pct(odds)} chance of being mission capable on day ${m.dayOffset}.${d ? ` The next domino is ${nodeLabel(S.model, d.id).label}.` : ''}${fixes.fixes[0] ? ` Top fix raises it to ${pct(fixes.fixes[0].oddsAfter)}.` : ''}`;

  return {
    missionId: m.id,
    title: `Readiness Brief: OP ${m.code}`,
    classification: 'UNCLASSIFIED // FICTIONAL DEMO DATA',
    generatedAt: new Date(now).toISOString(),
    bottomLine,
    odds,
    status,
    sections,
    citations: citedIds.map((id) => toRecord(S.model.records[id], now)),
  };
}

function postStop(req: StopRequest): StopResult {
  S.stopped = Boolean(req.stopped);
  if (S.stopped) log('stop', CAPTAIN, `STOP pressed${req.reason ? `: ${req.reason}` : ''}. All automated actions halted.`);
  else log('resume', CAPTAIN, 'Resumed LOCKER after STOP.');
  return { stopped: S.stopped, at: new Date().toISOString() };
}

function postLog(body: { type?: LogType; message?: string; refs?: string[] }): LogEntry {
  if (!body?.message) throw new ApiError(400, 'Log message required', 'BAD_REQUEST');
  log(body.type ?? 'system', CAPTAIN, body.message, body.refs ?? []);
  return S.log[S.log.length - 1];
}

function postReset() {
  S = freshServer();
  bootLog();
  log('system', CAPTAIN, 'Demo reset to the starting scenario.');
  return { ok: true };
}

// --- router --------------------------------------------------------------------------------------
export function handle(method: string, path: string, body?: unknown): unknown {
  const url = new URL(path, 'http://locker.local');
  const p = url.pathname.replace(/\/+$/, '');
  const q = url.searchParams;
  const key = `${method.toUpperCase()} ${p}`;

  if (key === 'GET /missions') return getMissions();
  if (key === 'GET /ship') return getShip();
  if (key === 'GET /graph') return getGraph(q.get('mission') ?? 'all');
  if (method === 'GET' && p.startsWith('/node/')) return getNode(decodeURIComponent(p.slice(6)), q.get('mission') ?? 'all');
  if (method === 'GET' && p.startsWith('/record/')) return getRecord(decodeURIComponent(p.slice(8)));
  if (key === 'GET /fixes') return getFixes(q.get('mission') ?? '');
  if (key === 'POST /scenario') return postScenario(body as ScenarioRequest);
  if (key === 'POST /decision') return postDecision(body as DecisionRequest);
  if (key === 'GET /events') return getEvents();
  if (key === 'POST /events/next') return postNextEvent();
  if (key === 'GET /brief') return getBrief(q.get('mission') ?? '');
  if (key === 'GET /log') return [...S.log].reverse();
  if (key === 'POST /log') return postLog(body as { type?: LogType; message?: string; refs?: string[] });
  if (key === 'POST /stop') return postStop(body as StopRequest);
  if (key === 'POST /reset') return postReset();
  throw new ApiError(404, `No mock route for ${key}`, 'NOT_FOUND');
}
