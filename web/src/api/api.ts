// ---------------------------------------------------------------------------
// The ONLY data entry point for the UI.
//
// Today every call is served by the in-browser mock (src/api/mockServer.ts).
// To use a real backend: set VITE_USE_MOCK=false and VITE_API_URL=<base url>
// in a .env file. Paths, methods and payload shapes stay exactly the same.
// ---------------------------------------------------------------------------
import { ApiError } from './errors';
import type {
  Brief,
  DecisionRequest,
  DecisionResult,
  EventsPayload,
  FixesPayload,
  GraphPayload,
  LogEntry,
  LogType,
  MissionsPayload,
  NextEventResult,
  NodeDetail,
  RecordDetail,
  ScenarioRequest,
  ScenarioResult,
  ShipPayload,
  StopRequest,
  StopResult,
} from './types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const BASE_URL: string = import.meta.env.VITE_API_URL ?? '/api';
const MOCK_LATENCY_MS = 260;

type Method = 'GET' | 'POST';

// Dev/rehearsal shortcut: open the app with ?events=N to start with N demo events applied.
let mockReady: Promise<typeof import('./mockServer')> | null = null;
function loadMock() {
  if (!mockReady) {
    mockReady = import('./mockServer').then((mock) => {
      const n = Number(new URLSearchParams(window.location.search).get('events') ?? 0);
      for (let i = 0; i < Math.min(4, Math.max(0, n)); i++) mock.handle('POST', '/events/next');
      return mock;
    });
  }
  return mockReady;
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (USE_MOCK) {
    const mock = await loadMock();
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS + Math.random() * 180));
    // Round-trip through JSON so the UI can never mutate mock state by reference,
    // exactly like a real network boundary.
    const result = mock.handle(method, path, body === undefined ? undefined : JSON.parse(JSON.stringify(body)));
    return JSON.parse(JSON.stringify(result)) as T;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the LOCKER server.', 'NETWORK');
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let code: string | undefined;
    try {
      const j = await res.json();
      message = j.message ?? message;
      code = j.code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message, code);
  }
  return (await res.json()) as T;
}

const qs = (params: Record<string, string>) => `?${new URLSearchParams(params).toString()}`;

export const api = {
  /** GET /ship (ship-level picture: every system, its department and hull position) */
  getShip: () => request<ShipPayload>('GET', '/ship'),
  /** GET /missions */
  getMissions: () => request<MissionsPayload>('GET', '/missions'),
  /** GET /graph (optional ?mission=M1 to focus one mission; default all) */
  getGraph: (mission: string | 'all' = 'all') =>
    request<GraphPayload>('GET', `/graph${mission === 'all' ? '' : qs({ mission })}`),
  /** GET /node/{id} */
  getNode: (id: string, mission: string | 'all' = 'all') =>
    request<NodeDetail>('GET', `/node/${encodeURIComponent(id)}${mission === 'all' ? '' : qs({ mission })}`),
  /** GET /record/{id} (source record lookup, used by clickable record IDs) */
  getRecord: (id: string) => request<RecordDetail>('GET', `/record/${encodeURIComponent(id)}`),
  /** GET /fixes?mission={id} */
  getFixes: (mission: string) => request<FixesPayload>('GET', `/fixes${qs({ mission })}`),
  /** POST /scenario */
  runScenario: (req: ScenarioRequest) => request<ScenarioResult>('POST', '/scenario', req),
  /** POST /decision */
  decide: (req: DecisionRequest) => request<DecisionResult>('POST', '/decision', req),
  /** GET /events */
  getEvents: () => request<EventsPayload>('GET', '/events'),
  /** POST /events/next */
  nextEvent: () => request<NextEventResult>('POST', '/events/next'),
  /** GET /brief?mission={id} */
  getBrief: (mission: string) => request<Brief>('GET', `/brief${qs({ mission })}`),
  /** GET /log */
  getLog: () => request<LogEntry[]>('GET', '/log'),
  /** POST /stop */
  stop: (req: StopRequest) => request<StopResult>('POST', '/stop', req),
  /** POST /log (UI actions such as printing a brief) */
  logAction: (type: LogType, message: string, refs: string[] = []) =>
    request<LogEntry>('POST', '/log', { type, message, refs }),
  /** POST /reset (demo only) */
  resetDemo: () => request<{ ok: boolean }>('POST', '/reset'),
};

export { ApiError };
export type Api = typeof api;
