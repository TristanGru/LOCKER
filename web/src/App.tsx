// Placeholder page: proves the API end to end. Replace with the real Captain / Commodore views.
import { useEffect, useState } from "react";
import { api, StaleError } from "./api";

export default function App() {
  const [state, setState] = useState<any>(null);
  const [fc, setFc] = useState<any>(null);
  const [fixes, setFixes] = useState<any>(null);
  const [brief, setBrief] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const load = async () => {
    setState(await api.state());
    setFc(await api.forecast());
  };
  useEffect(() => {
    load();
    const t = setInterval(async () => {
      const v = await api.version();
      if (state && v.version !== state.version) load();
    }, 2000);
    return () => clearInterval(t);
  }, [state?.version]);

  const run = async (f: () => Promise<any>) => {
    try {
      setMsg("");
      await f();
    } catch (e: any) {
      setMsg(e instanceof StaleError ? "Scenario changed, refreshed." : e.message);
    }
    setFixes(null);
    await load();
  };

  if (!state || !fc) return <p>Loading...</p>;
  const v = state.version;
  return (
    <div style={{ fontFamily: "monospace", padding: 16, maxWidth: 1100 }}>
      <div style={{ background: "#2e7d32", color: "#fff", padding: 4 }}>{state.banner}</div>
      <h2>MissionTwin (placeholder UI)</h2>
      <p>
        Scenario now {state.cursor_dtg} ({state.cursor_local}) | seed {state.seed} | {state.runs} runs | LLM:{" "}
        {state.llm.demo_mode
          ? `offline cache (${state.llm.model}); rules/template on cache miss`
          : state.llm.configured ? state.llm.model : "offline (rules extractor, template brief)"}
      </p>
      <p>
        <button onClick={() => run(() => api.play(v))} disabled={!state.next_event}>
          Play next event {state.next_event ?? "(none left)"}
        </button>{" "}
        <button onClick={() => run(() => api.undo(v))}>Undo</button>{" "}
        <button onClick={() => run(() => api.reset(v))}>Reset</button>{" "}
        <button onClick={async () => setBrief((await api.brief("KESSLER")).text)}>Brief (Kessler)</button>
      </p>
      {msg && <p style={{ color: "crimson" }}>{msg}</p>}
      <h3>Feed</h3>
      <ul>
        {state.feed.map((e: any) => (
          <li key={e.event_id}>
            {e.played ? "[x]" : "[ ]"} {e.known_dtg} {e.title}
          </li>
        ))}
      </ul>
      <h3>Missions</h3>
      <table cellPadding={4}>
        <tbody>
          {fc.missions.map((m: any) => (
            <tr key={m.event_id}>
              <td>{m.ship_id}</td>
              <td>{m.label}</td>
              <td>{m.start_dtg}</td>
              <td>
                <b>{Math.round(m.p_ready * 100)}%</b> {m.band}
              </td>
              <td>
                Planned {m.planned?.result}
                {m.planned?.margin_days != null && ` (${m.planned.margin_days.toFixed(1)}d)`}
              </td>
              <td>next domino: {m.next_domino ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Fixes (Kessler)</h3>
      {!fixes ? (
        <button onClick={async () => setFixes(await api.fixes("KESSLER"))}>Rank fixes</button>
      ) : (
        <ol>
          {fixes.candidates.slice(0, 5).map((c: any) => (
            <li key={c.fix_id}>
              {c.title} | own uplift {(c.own_uplift * 100).toFixed(0)} pts | donor cost {(c.donor_cost * 100).toFixed(1)} pts{" "}
              <button onClick={() => run(() => api.decide(v, c.fix_id, "approve"))}>Approve</button>{" "}
              <button onClick={() => run(() => api.decide(v, c.fix_id, "reject"))}>Reject</button>
            </li>
          ))}
        </ol>
      )}
      {brief && <pre style={{ whiteSpace: "pre-wrap", background: "#f4f4f4", padding: 8 }}>{brief}</pre>}
    </div>
  );
}
