// ---------------------------------------------------------------------------
// LOCKER API contract. Screens only ever see these types (via api.ts).
// A real backend must return the same shapes from the same endpoints.
// ---------------------------------------------------------------------------

export type Status = 'ready' | 'watch' | 'risk' | 'unknown';
export type NodeKind = 'mission' | 'equipment' | 'part' | 'person';
export type CasrepCategory = 'C2' | 'C3' | 'C4';

export interface Ship {
  name: string;
  hull: string;
  homeport: string;
  deployInDays: number;
}

export interface SourceRecord {
  id: string;
  system: string;
  title: string;
  asOf: string; // ISO timestamp the source last reported
  ageHours: number;
  stale: boolean;
  summary: string;
  fields: Record<string, string>;
}

export interface Contradiction {
  id: string;
  nodeId: string;
  field: string;
  a: { recordId: string; value: string };
  b: { recordId: string; value: string };
  note: string;
}

export interface FeedFreshness {
  id: string;
  label: string;
  asOf: string;
  ageHours: number;
  stale: boolean;
}

export interface Freshness {
  oldestHours: number;
  staleCount: number;
  feeds: FeedFreshness[];
}

export interface Mission {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string;
  date: string; // ISO
  daysOut: number;
  /** Sampled event-interval readiness. This is the decision number. */
  odds: number; // 0..1
  /** Modeled probability at event start. Separate from the interval score. */
  oddsAtStart: number;
  /** Interval points versus the no-decision baseline. Null when either side is unknown. */
  baselineDelta: number | null;
  status: Status;
  nextDominoId: string | null;
  nextDominoLabel: string | null;
  nextDominoReason: string | null;
  requires: string[];
  flaggedCount: number;
  recordId: string;
}

export interface OddsPoint {
  at: string;
  odds: number;
  label: string;
}

export interface MissionsPayload {
  ship: Ship;
  missions: Mission[];
  history: Record<string, OddsPoint[]>; // odds after baseline, each event and each approval
  freshness: Freshness;
  stopped: boolean;
  generatedAt: string;
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  subtitle: string;
  status: Status;
  p: number; // probability this node is good to go for the focused mission(s)
  reason: string; // short "why flagged" line
  metric: string; // headline metric shown on the card, e.g. "ETA 8 d" or "41%"
  missions: string[];
  recordIds: string[];
  dataAgeHours: number;
  stale: boolean;
  contradictionCount: number;
  nextDominoFor: string[]; // mission ids for which this node is the next domino
  temp?: boolean;
  when?: { hours: number; label: string } | null; // part ETA / sailor departure, hours from now
}

export interface GraphEdge {
  id: string;
  source: string; // dependent (mission -> equipment -> part/person)
  target: string; // dependency
  critical: boolean; // dependency is not ready
}

export interface GraphPayload {
  focus: string | 'all';
  nodes: GraphNode[];
  edges: GraphEdge[];
  missions: Mission[];
  generatedAt: string;
}

export interface NodeLink {
  id: string;
  kind: NodeKind;
  label: string;
  status: Status;
}

export interface NodeDetail {
  node: GraphNode;
  why: string[];
  records: SourceRecord[];
  contradictions: Contradiction[];
  dependsOn: NodeLink[];
  dependents: NodeLink[];
  perMission: { missionId: string; code: string; p: number; status: Status }[];
}

export type DeckPosition = 'top' | 'below' | 'none';

/** Hull type of the ship record; picks the 3D model. Parsed from the hull string ("DDG-1047") when not given. */
export type HullType = 'CVN' | 'DDG' | 'CG' | 'FFG' | 'LCS' | 'LHD' | 'SSN' | 'SSBN' | 'SSGN';

export interface ShipSystem {
  id: string; // same id as the graph node
  name: string;
  tag: string;
  department: string;
  deck: DeckPosition; // 'top' = on deck, 'below' = below deck, 'none' = list only
  location: string;
  /**
   * Semantic mount point (e.g. 'air_radar', 'engine_p', 'reactor'). Each hull model resolves it to its own
   * position, so pins move with the ship class. null = list only. A mount the hull lacks gets no pin.
   */
  mount: string | null;
  status: Status;
  reason: string;
  dataAgeHours: number;
  stale: boolean;
  sourceIds: string[];
  isNextDomino: boolean;
  dominoVia: string | null; // the part or sailor behind it, when the domino is not the system itself
}

export interface ShipDepartment {
  id: string;
  name: string;
  ready: number;
  total: number;
  counts: Record<Status, number>;
  worst: Status;
}

export interface ShipPayload {
  name: string;
  hull: string;
  hullType: HullType;
  className: string;
  overall: { readyShare: number; ready: number; total: number };
  counts: Record<Status, number>;
  departments: ShipDepartment[];
  systems: ShipSystem[];
  nextDomino: {
    nodeId: string;
    label: string;
    reason: string;
    systemId: string | null;
    missionId: string;
    missionCode: string;
    gain: number;
    sourceIds: string[];
  } | null;
  missionAtRisk: Mission | null;
  generatedAt: string;
}

export interface RecordDetail {
  record: SourceRecord;
  linkedNodes: NodeLink[];
  contradictions: Contradiction[];
}

// Effects are the only way state changes: events apply them, approved fixes
// apply them, and What-If scenarios apply them to a throwaway copy.
export type Effect =
  | { op: 'setCasrep'; node: string; category: CasrepCategory | null; recordId?: string }
  | { op: 'setPartEta'; node: string; hours: number | null }
  | { op: 'delayPart'; node: string; hours: number }
  | { op: 'setDeparture'; node: string; hours: number | null }
  | { op: 'shiftMission'; mission: string; days: number }
  | { op: 'setBaseP'; node: string; p: number }
  | {
      op: 'addPerson';
      person: { id: string; name: string; rate: string; quals: string[]; note: string; recordIds: string[] };
      supports: string[];
    };

export interface FixParam {
  key: 'hours' | 'days';
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
}

export interface Fix {
  id: string;
  missionId: string;
  rank: number;
  title: string;
  action: string;
  rationale: string;
  owner: string;
  effort: 'Low' | 'Medium' | 'High';
  confidence: number;
  targets: string[]; // node ids the fix touches
  recordIds: string[];
  oddsBefore: number;
  oddsAfter: number;
  otherMissions: { missionId: string; code: string; before: number; after: number }[];
  param?: FixParam & { value: number };
  externalApproval?: string;
  decision: 'pending' | 'approved' | 'rejected';
}

export interface FixesPayload {
  missionId: string;
  fixes: Fix[];
  decided: Fix[];
}

export type DecisionKind = 'approve' | 'reject' | 'modify';

export interface DecisionRequest {
  fixId: string;
  missionId: string;
  decision: DecisionKind;
  note?: string;
  paramValue?: number;
}

export interface NodeChange {
  nodeId: string;
  label: string;
  kind: NodeKind;
  from: Status;
  to: Status;
  depth: number; // 0 = origin of the change; used to cascade the animation
}

export interface MissionDelta {
  missionId: string;
  code: string;
  before: number;
  after: number;
  statusBefore: Status;
  statusAfter: Status;
}

export interface DecisionResult {
  fix: Fix;
  changes: NodeChange[];
  missionDeltas: MissionDelta[];
}

export type ScenarioChange =
  | { kind: 'delayPart'; node: string; hours: number }
  | { kind: 'removePerson'; node: string }
  | { kind: 'shiftMission'; mission: string; days: number }
  | { kind: 'casrep'; node: string; category: CasrepCategory | null };

export interface ScenarioRequest {
  changes: ScenarioChange[];
}

export interface ScenarioResult {
  id: string;
  changes: ScenarioChange[];
  description: string[];
  missionDeltas: MissionDelta[];
  nodeChanges: NodeChange[];
}

export interface DemoEvent {
  id: string;
  seq: number;
  type: 'CASREP' | 'SUPPLY' | 'PERSONNEL' | 'SCHEDULE';
  title: string;
  summary: string;
  recordId: string;
  arrivedAt?: string;
  changes?: NodeChange[];
  missionDeltas?: MissionDelta[];
}

export interface EventsPayload {
  delivered: DemoEvent[];
  remaining: number;
  nextTitle: string | null;
}

export interface NextEventResult {
  event: DemoEvent;
  changes: NodeChange[];
  missionDeltas: MissionDelta[];
  remaining: number;
}

export interface BriefSection {
  heading: string;
  paragraphs: { text: string; cites: string[] }[];
}

export interface Brief {
  missionId: string;
  title: string;
  classification: string;
  generatedAt: string;
  bottomLine: string;
  odds: number;
  status: Status;
  sections: BriefSection[];
  citations: SourceRecord[];
}

export type LogType =
  | 'event'
  | 'recommendation'
  | 'approval'
  | 'rejection'
  | 'modification'
  | 'scenario'
  | 'stop'
  | 'resume'
  | 'brief'
  | 'system';

export interface LogEntry {
  id: string;
  ts: string;
  type: LogType;
  actor: string;
  message: string;
  refs: string[];
}

export interface StopRequest {
  stopped: boolean;
  reason?: string;
}

export interface StopResult {
  stopped: boolean;
  at: string;
}
