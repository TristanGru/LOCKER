import type { Dashboard, Mission } from './types';
import { dateLabel, percent } from './ui';
import './timeline.css';

/** Requirement probability at each sampled date, NOT material score or interval probability. */
export default function ReadinessTimeline({ data, mission }: { data: Dashboard; mission: Mission }) {
  const dates = data.forecast.grid_dates;
  if (dates.length < 2) return null;
  const base = data.baseline.missions.find(item => item.event_id === mission.event_id);
  const lo = Date.parse(dates[0]), hi = Date.parse(dates[dates.length - 1]);
  const x = (date: string) => 45 + 650 * (Date.parse(date) - lo) / (hi - lo);
  const y = (value: number) => 160 - 130 * value;
  const baselineByDate = new Map(data.baseline.grid_dates.map((date, index) => [date, base?.curve?.[index]]));
  const curve = (values: (number | null)[] | undefined, times = dates) => {
    let pen = false;
    return (values || []).map((value, index) => {
      if (value == null || !times[index] || Date.parse(times[index]) < lo || Date.parse(times[index]) > hi) { pen = false; return ''; }
      const command = pen ? 'L' : 'M'; pen = true;
      return `${command}${x(times[index])},${y(value)}`;
    }).join(' ');
  };
  return <section className="readiness-timeline panel" aria-label="Readiness over time">
    <div className="section-heading"><div><span className="eyebrow">REQUIREMENT PROBABILITY / NOT MATERIAL SCORE</span><h2>{mission.label}: readiness over time</h2></div><b>Interval: {percent(mission.p_assessed)}</b></div>
    <svg viewBox="0 0 720 190" role="img" aria-label={`${mission.label} requirement probability by sampled date; table available below`}>
      <rect x={Math.max(45, x(mission.start))} y="25" width={Math.max(0, Math.min(695, x(mission.end)) - Math.max(45, x(mission.start)))} height="135" fill="currentColor" opacity=".07" />
      {[0, .5, 1].map(value => <g key={value}><line x1="45" x2="695" y1={y(value)} y2={y(value)} stroke="currentColor" opacity=".15" /><text x="4" y={y(value) + 4} fill="currentColor" fontSize="11">{percent(value)}</text></g>)}
      <path d={curve(base?.curve, data.baseline.grid_dates)} fill="none" stroke="currentColor" opacity=".4" strokeDasharray="5 4" strokeWidth="2" />
      <path d={curve(mission.curve)} fill="none" stroke="#36a99b" strokeWidth="3" />
      <text x="45" y="182" fill="currentColor" fontSize="11">{dateLabel(dates[0])}</text>
      <text x="695" y="182" fill="currentColor" fontSize="11" textAnchor="end">{dateLabel(dates[dates.length - 1])}</text>
    </svg>
    <p className="fine-print">Solid: current exercise. Dashed: same-source baseline without injections or decisions. Shading: event window. Each point is readiness at that sampled date, not sustained interval readiness. Unknown evidence produces gaps, not zero probability.</p>
    <details><summary>Accessible timeline table</summary><div className="table-scroll"><table><thead><tr><th>UTC date</th><th>Current requirement odds</th><th>Baseline requirement odds</th></tr></thead><tbody>{dates.map((date, index) => <tr key={date}><td>{dateLabel(date)}</td><td>{percent(mission.curve?.[index])}</td><td>{percent(baselineByDate.get(date))}</td></tr>)}</tbody></table></div></details>
  </section>;
}
