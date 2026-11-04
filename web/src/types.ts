export interface SourceRef {
  file: string;
  loc?: string;
  span?: string;
  key?: string;
  profile?: "canonical" | "reference";
}
export interface EvidenceItem {
  key: string;
  kind: string;
  title: string;
  eic?: string;
  member_id?: string;
  sources: SourceRef[];
  explain?: string[];
  planned_ready?: string;
  ready_p10?: string;
  ready_p90?: string;
}
export interface Gate {
  gate_id: string;
  kind: string;
  label: string;
  p_ok: number | null;
  uplift: number;
  items: EvidenceItem[];
}
export interface Mission {
  event_id: string;
  ship_id: string;
  label: string;
  name: string;
  start: string;
  end: string;
  p_ready: number | null;
  p_assessed: number | null;
  coverage_issues: string[];
  band: string;
  next_domino: string | null;
  gates: Gate[];
  curve: (number | null)[];
  interval_p_ready: number | null;
  interval_sampling_hours: number;
  interval_gates: { gate_id: string; label: string; p_ok: number }[];
  planned: { result: string; margin_days: number | null };
  areas: string[];
  sources: SourceRef[];
  consequence: string;
}
export interface Forecast {
  reported_baseline: Record<string, ReportedBaseline[]>;
  source_revision: string;
  assessment_basis: string;
  version?: number;
  cursor: string;
  grid_dates: string[];
  bands: { green: number; amber: number };
  runs: number;
  seed: number;
  missions: Mission[];
  ships: Record<
    string,
    {
      systems: Record<string, number[]>;
      system_p_ok: Record<string, number[]>;
      areas: Record<string, { mfom: number[]; p_capable: number[] }>;
    }
  >;
}
export interface AppState {
  source_revision: string;
  version: number;
  banner: string;
  cursor: string;
  cursor_dtg: string;
  ships: { ship_id: string; name: string; hull: string }[];
  feed: {
    event_id: string;
    title: string;
    known_dtg: string;
    played: boolean;
    refs: string[];
  }[];
  next_event: string | null;
  runs: number;
  seed: number;
  llm: { configured: boolean; model: string };
}
export interface Issue {
  id?: string;
  code?: string;
  kind?: string;
  detail?: string;
  reason?: string;
  file?: string;
  loc?: string;
  sources?: SourceRef[];
  severity?: string;
}
export interface VisualSystem {
  eic: string;
  system_eic: string;
  name: string;
  mounts: string[];
  mission_areas: string[];
  components: string[];
  watchstations: string[];
  critical: boolean;
}
export interface VisualRegistry {
  model: string;
  hull_class: string;
  mounts: Record<string, [number, number, number]>;
  systems: VisualSystem[];
  component_to_system: Record<string, string>;
  mission_areas: Record<string, string>;
}
export interface Assumption {
  path: string;
  value: number;
  min: number;
  max: number;
  tag: string;
  source: string;
}
export interface Dashboard {
  sources: SourceHealth;
  state: AppState;
  forecast: Forecast;
  baseline: Forecast;
  issues: {
    ingest_issues: Issue[];
    contradictions: Issue[];
    stale: Record<string, { age_days?: number; as_of?: string }>;
  };
  assumptions: {
    editable: Assumption[];
    rows: {
      key: string;
      value: unknown;
      tag: string;
      source: string;
      edited: boolean;
    }[];
  };
  log: {
    changes: {
      seq: number;
      kind: string;
      actor: string;
      scenario_time: string;
      payload: Record<string, unknown>;
    }[];
    version: number;
  };
  visualization: VisualRegistry;
}
export interface SourceDocument {
  file: string;
  kind: string;
  lines: string[];
  line_numbers?: number[];
  highlight?: number;
  highlight_text?: string;
  page?: number;
  meta?: {
    real_system?: string;
    steward?: string;
    as_of?: string;
    stale?: unknown;
    original_file?: string;
    adapter?: string;
  };
}
export interface Fix {
  fix_id: string;
  rank: number;
  title: string;
  why: string[];
  steps: Record<string, unknown>[];
  net_green: number;
  donor_effects: Record<
    string,
    { mission_p_delta: number; capability_delta: number }
  >;
  missions: {
    event_id: string;
    label: string;
    ship_id: string;
    p_before: number;
    p_after: number;
  }[];
}
export interface Ranking {
  warning?: string;
  candidates: Fix[];
  runs_per_candidate: number;
  rule: string;
}
export interface Proposal {
  kind: "action" | "set_assumption";
  action?: Record<string, unknown>;
  key?: string;
  value?: number;
}
export interface Preview {
  base_version: number;
  before: Forecast;
  after: Forecast;
  proposal: Proposal;
}
export interface GraphData {
  nodes: {
    id: string;
    kind: string;
    label: string;
    p: number | null;
    next?: boolean;
    eic?: string;
    gate_id?: string;
    sources?: SourceRef[];
  }[];
  edges: { source: string; target: string }[];
}
export interface ReportedBaseline {
  mission_area: string; rating: string; mfom_index: number; as_of: string; source: SourceRef;
}
export interface SourceHealth {
  profile: string; adapter: string; source_revision: string; configured_path: string;
  schema_version: number; mapping_version: string; last_successful_refresh: string;
  last_attempt: { status: string; at: string; error?: string };
  coverage: Record<string, string[]>; configuration_errors: string[]; notice: string;
  sources: { file: string; real_system: string; as_of: string; status: string; usage: string;
    explanation: string; record_count: number; rejected_count: number }[];
}
