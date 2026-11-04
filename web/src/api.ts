// MissionTwin API client. Every write sends base_version (R8); a 409 means "scenario changed, refresh".
// Endpoint reference: missiontwin/api.py. The UI design lives with the frontend dev; this file is the contract.
import type { Dashboard, GraphData, Preview, Proposal, Ranking, SourceDocument } from "./types";

export class StaleError extends Error {}

async function j(method: string, url: string, body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 409) throw new StaleError("Scenario changed, refresh");
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  dashboard: (): Promise<Dashboard> => j("GET", "/api/dashboard"),
  dataContract: () => j("GET", "/api/data-contract"),
  preview: (version: number, proposal: Proposal): Promise<Preview> => j("POST", "/api/preview", { base_version: version, ...proposal }),
  state: () => j("GET", "/api/state"),                       // banner, clock, seed, feed, ships, LLM status
  version: () => j("GET", "/api/scenario/version"),          // poll every 2s (R8)
  forecast: () => j("GET", "/api/forecast"),                 // missions: p_ready, band, planned, gates, curve; ships: areas, systems
  graph: (ship: string, eventId?: string): Promise<GraphData> => j("GET", `/api/graph/${ship}${eventId ? `?event_id=${eventId}` : ""}`),
  facts: (ship?: string) => j("GET", `/api/facts${ship ? `?ship_id=${ship}` : ""}`),
  issues: () => j("GET", "/api/issues"),                     // ingest issues, contradictions X1-X10, stale files
  source: (file: string, loc = "", span = "", profile = "canonical"): Promise<SourceDocument> =>
    j("GET", `/api/source?file=${encodeURIComponent(file)}&loc=${encodeURIComponent(loc)}&span=${encodeURIComponent(span)}&profile=${encodeURIComponent(profile)}`),
  assumptions: () => j("GET", "/api/assumptions"),
  fixes: (ship: string): Promise<Ranking> => j("GET", `/api/fixes/${ship}`),
  schema: () => j("GET", "/api/actions/schema"),             // build the action picker from this (R7)
  log: () => j("GET", "/api/log"),
  play: (v: number) => j("POST", "/api/events/play", { base_version: v }),
  change: (v: number, body: object) => j("POST", "/api/changes", { base_version: v, ...body }),
  decide: (v: number, fix_id: string, decision: "approve" | "reject", approval_delay_days = 0) =>
    j("POST", "/api/fixes/decide", { base_version: v, fix_id, decision, approval_delay_days }),
  undo: (v: number) => j("POST", "/api/undo", { base_version: v }),
  reset: (v: number) => j("POST", "/api/reset", { base_version: v }),
  parse: (text: string, ship_id: string) => j("POST", "/api/actions/parse", { text, ship_id }),
  brief: (ship_id: string) => j("POST", "/api/brief", { ship_id }),
};
