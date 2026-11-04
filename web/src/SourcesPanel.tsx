import { useState } from "react";
import type { Dashboard, SourceRef } from "./types";
import { SourceButton, dateLabel } from "./ui";

export default function SourcesPanel({ data, ship, onRefresh, onSource }: {
  data: Dashboard; ship: string; onRefresh: (reset: boolean) => void; onSource: (source: SourceRef) => void;
}) {
  const [reset, setReset] = useState(false);
  const health = data.sources;
  return <section className="source-health" aria-label="Source health">
    <div className="section-heading"><h2>Source health & refresh</h2><span>{health.profile} / {health.adapter}</span></div>
    <p>{health.notice}</p>
    <p className="mono">Source revision: {health.source_revision} / schema {health.schema_version} / mapping {health.mapping_version}</p>
    <p>Last successful refresh: {health.last_successful_refresh}. Last attempt: {health.last_attempt.status}.</p>
    {health.last_attempt.error && <p className="error-banner" role="alert">Refresh not activated. Last usable snapshot retained: {health.last_attempt.error}</p>}
    <div className="button-row"><button className="primary" onClick={() => onRefresh(reset)}>Refresh sources</button>
      <label><input type="checkbox" checked={reset} onChange={event => setReset(event.target.checked)} /> Reset exercise when activating changed sources</label></div>
    <p className="fine-print">Playback is preserved when compatible. Existing what-if decisions block changed imports unless you explicitly confirm a reset. An unchanged import is a no-op.</p>
    <details><summary>Configured source directory</summary><code>{health.configured_path}</code></details>
    <details><summary>Inspect {health.sources.length} source datasets and their model coverage</summary><div className="table-scroll"><table><thead><tr><th>Source / dataset</th><th>Health / extract</th><th>Parsed rows/files / issues</th><th>Model coverage</th></tr></thead><tbody>
      {health.sources.map(source => <tr key={source.file}><td>{source.real_system}<small>{source.file}</small>{!source.file.endsWith('/') && <SourceButton source={{ file: source.file }} onOpen={onSource} />}</td>
        <td>{source.status}<small>{source.as_of}</small></td><td>{source.record_count} / {source.rejected_count}</td><td>{source.usage}<small>{source.explanation}</small></td></tr>)}
    </tbody></table></div></details>
    <div className="section-heading"><h2>Reported baseline / {ship}</h2><span>Reported ratings are not model probabilities</span></div>
    <p className="fine-print">Independent report values, not the reset-scenario forecast used for the dashboard's baseline comparison. Material scores use a 0–100 index.</p>
    <div className="table-scroll"><table><thead><tr><th>Area</th><th>Reported rating</th><th>Reported material index</th><th>As of</th><th>Evidence</th></tr></thead><tbody>
      {(data.forecast.reported_baseline[ship] || []).map(row => <tr key={row.mission_area}><td>{row.mission_area}</td><td>{row.rating}</td><td>{row.mfom_index} / 100</td><td>{dateLabel(row.as_of)}</td><td><SourceButton source={row.source} onOpen={onSource} /></td></tr>)}
    </tbody></table></div>
  </section>;
}
