import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CalendarClock, FlaskConical, Package, Play, Plus, RotateCcw, ShieldAlert, Sparkles, Trash2, UserRoundMinus } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { api } from '../api/api';
import type { CasrepCategory, GraphNode, Mission, ScenarioChange, ScenarioResult } from '../api/types';
import { KIND_META } from '../components/graph/kinds';
import { Panel } from '../components/ui/Panel';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import clsx from '../lib/clsx';
import { useStore } from '../state/store';
import { useApi } from '../state/useApi';
import { STATUS, oddsStatus, pct, getBands } from '../theme/status';

type Kind = ScenarioChange['kind'];
/** A run plus a plain-language note when the result needs explaining. */
/** A run plus the backend's own note (sandbox statement) and a plain-language hint when the result needs explaining. */
type Run = ScenarioResult & { hint?: string; note?: string };

/** Two changes are the same if they touch the same thing (a sailor is the same person on every mission). */
const changeKey = (c: ScenarioChange) =>
  c.kind === 'removePerson' ? `person:${c.node.includes('|prereq:') ? 'shore:' : ''}${c.node.split('|member:')[1]}` : c.kind === 'shiftMission' ? `shift:${c.mission}` : `${c.kind}:${c.node}`;

const KINDS: { kind: Kind; label: string; icon: typeof Package; hint: string }[] = [
  { kind: 'delayPart', label: 'Delay a part', icon: Package, hint: 'Push a part delivery back' },
  { kind: 'removePerson', label: 'Remove a sailor', icon: UserRoundMinus, hint: 'Take a qualified sailor off the ship' },
  { kind: 'shiftMission', label: 'Shift a date', icon: CalendarClock, hint: 'Move a mission earlier or later' },
  { kind: 'casrep', label: 'Break equipment', icon: ShieldAlert, hint: 'Add a hypothetical casualty (seven-day repair estimate)' },
];

export function WhatIf() {
  const graphQ = useApi(() => api.getGraph('all'));
  const missionsQ = useApi(() => api.getMissions());
  const [kind, setKind] = useState<Kind>('delayPart');
  const [target, setTarget] = useState('');
  const [hours, setHours] = useState(48);
  const [days, setDays] = useState(-2);
  const [category, setCategory] = useState<CasrepCategory | null>('C3');
  const [changes, setChanges] = useState<ScenarioChange[]>([]);
  const [running, setRunning] = useState(false);
  const runCount = useRef(1);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Run[]>([]);
  const { bump } = useStore();

  const nodes = graphQ.data?.nodes ?? [];
  const missions = missionsQ.data ? [...missionsQ.data.missions].sort((a, b) => a.daysOut - b.daysOut) : [];
  const options = useMemo(() => optionsFor(kind, nodes, missions), [kind, nodes, missions]);
  const targetId = options.some((o) => o.id === target) ? target : options[0]?.id ?? '';
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.label ?? missions.find((m) => m.id === id)?.code ?? id;

  function draft(): ScenarioChange | null {
    if (!targetId) return null;
    switch (kind) {
      case 'delayPart':
        return { kind, node: targetId, hours };
      case 'removePerson':
        return { kind, node: targetId };
      case 'shiftMission':
        return days === 0 ? null : { kind, mission: targetId, days };
      case 'casrep':
        return { kind, node: targetId, category };
    }
  }

  async function run(list: ScenarioChange[]) {
    if (!list.length) return;
    setRunning(true);
    setError(null);
    try {
      const r = await api.runScenario({ changes: list });
      const moved = r.missionDeltas.some((m) => Math.abs(m.after - m.before) >= 0.005);
      const hint =
        !moved && list.some((c) => c.kind === 'removePerson')
          ? 'Each mission needs a minimum number of qualified sailors on a team, and most teams carry a spare. Losing one sailor is covered by the others, so the odds hold. Add a second sailor from the same team to the scenario to see the effect.'
          : !moved
            ? 'The model has slack here: the change does not reach anything that limits a mission. Combine it with other changes to stress the plan.'
            : undefined;
      setResults((prev) => [{ ...r, id: `Run ${runCount.current++}`, description: list.map((c) => describe(c, labelOf)), note: r.description.join(' '), hint }, ...prev].slice(0, 6));
      bump(); // the run is written to the activity log
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const presets: { label: string; changes: ScenarioChange[] }[] = missions.map(m=>({label:`${m.code}: one day later`,changes:[{kind:'shiftMission',mission:m.id,days:1}]}));

  if (graphQ.loading || missionsQ.loading) return <Loading label="Loading the model" className="h-full" />;
  if (graphQ.error != null && !graphQ.data) return <ErrorState error={graphQ.error} onRetry={graphQ.reload} />;

  const d = draft();
  const inScenario = d ? changes.some((c) => changeKey(c) === changeKey(d)) : false;
  const latest = results[0];

  return (
    <div className="mx-auto max-w-[120rem] space-y-5 px-8 pb-10 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2.2rem] font-bold leading-tight tracking-tight">What-If</h1>
          <p className="mt-1 text-lg text-ink-muted">Try a change in a sandbox. Source data and the shared scenario are never touched. Preview results are not persisted.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/[0.07] px-4 py-2.5 text-sm text-accent">
          <FlaskConical className="h-5 w-5" aria-hidden /> Sandbox mode
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[34rem_1fr]">
        {/* builder */}
        <div className="space-y-5">
          <Panel title="1. Pick a change" icon={<Sparkles className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Change type">
              {KINDS.map((k) => (
                <button
                  key={k.kind}
                  role="radio"
                  aria-checked={kind === k.kind}
                  onClick={() => setKind(k.kind)}
                  className={clsx(
                    'flex items-start gap-2.5 rounded-xl border p-3 text-left transition',
                    kind === k.kind ? 'border-accent/70 bg-accent/10 shadow-focus' : 'border-line hover:border-line-strong',
                  )}
                >
                  <k.icon className={clsx('mt-0.5 h-5 w-5 shrink-0', kind === k.kind ? 'text-accent' : 'text-ink-dim')} aria-hidden />
                  <span>
                    <span className="block font-semibold text-ink">{k.label}</span>
                    <span className="block text-xs text-ink-dim">{k.hint}</span>
                  </span>
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="label-caps">{kind === 'shiftMission' ? 'Mission' : kind === 'removePerson' ? 'Sailor' : kind === 'delayPart' ? 'Part' : 'Equipment'}</span>
              <select
                value={targetId}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-2 w-full rounded-xl border border-line bg-abyss-950/70 px-4 py-3 text-base text-ink focus:border-accent/60 focus:outline-none"
              >
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {kind === 'delayPart' && (
              <Slider label="Delay by" value={hours} min={12} max={240} step={12} unit="h" onChange={setHours} note={`${(hours / 24).toFixed(1)} days`} />
            )}
            {kind === 'shiftMission' && (
              <Slider label="Shift by" value={days} min={-5} max={5} step={1} unit="d" onChange={setDays} note={days < 0 ? `${-days} days earlier` : days > 0 ? `${days} days later` : 'no change'} />
            )}
            {kind === 'casrep' && (
              <div className="mt-4">
                <span className="label-caps">CASREP category</span>
                <div className="mt-2 flex gap-2">
                  {(['C2', 'C3', 'C4'] as (CasrepCategory | null)[]).map((c) => (
                    <button
                      key={c ?? 'none'}
                      onClick={() => setCategory(c)}
                      className={clsx('rounded-lg border px-3 py-2 font-mono text-sm font-bold transition', category === c ? 'border-accent/70 bg-accent/10 text-accent' : 'border-line text-ink-muted hover:border-line-strong')}
                    >
                      {c ?? 'Close'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-5 text-sm text-ink-muted">
              To combine changes, press <span className="font-semibold text-ink">Add to scenario</span>, pick the next change, add it too, then run the scenario below.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-accent" disabled={!d || inScenario} onClick={() => d && setChanges((c) => [...c, d])}>
                <Plus className="h-4 w-4" aria-hidden /> {inScenario ? 'Already in scenario' : 'Add to scenario'}
              </button>
              <button className="btn-ghost" disabled={!d || running} onClick={() => d && run(inScenario ? changes : [...changes, d])}>
                <Play className="h-4 w-4" aria-hidden /> {changes.length ? `Run with the ${changes.length} in scenario` : 'Run just this one'}
              </button>
            </div>
          </Panel>

          <Panel
            title={`2. Scenario (${changes.length})`}
            icon={<FlaskConical className="h-4 w-4" />}
            actions={
              changes.length > 0 && (
                <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => setChanges([])}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Clear
                </button>
              )
            }
          >
            {changes.length === 0 ? (
              <p className="text-sm text-ink-muted">Empty. Add changes above (for example two sailors from the same team, plus a late part) and run them together to see the combined effect.</p>
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {changes.map((c, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                      <span className="num text-xs text-ink-dim">{i + 1}</span>
                      <span className="flex-1 text-sm text-ink">{describe(c, labelOf)}</span>
                      <button onClick={() => setChanges((all) => all.filter((_, j) => j !== i))} className="text-ink-dim hover:text-risk" aria-label="Remove change">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
            {changes.length > 0 && (
              <button className="btn-accent mt-4 w-full" disabled={running} onClick={() => run(changes)}>
                <Play className="h-4 w-4" aria-hidden /> Run scenario ({changes.length} change{changes.length === 1 ? '' : 's'})
              </button>
            )}
          </Panel>

          <Panel title="Quick scenarios">
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button key={p.label} className="rounded-sm border border-line px-3 py-1.5 text-sm text-ink-muted transition hover:border-accent/50 hover:text-ink" disabled={running} onClick={() => run(p.changes)}>
                  {p.label}
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* results */}
        <div className="space-y-5">
          {error && <ErrorState error={error} />}
          {running && !latest && <Loading label="Running scenario" />}
          {!latest && !running && (
            <EmptyState icon={FlaskConical} title="No scenario run yet" className="glass">
              Pick a change and press <span className="font-semibold text-accent">Run</span>, or try a quick scenario.
            </EmptyState>
          )}
          {latest && <ResultView result={latest} labelOf={labelOf} running={running} />}
          {results.length > 1 && (
            <Panel title="Earlier runs this session">
              <ul className="space-y-2">
                {results.slice(1).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                    <span className="num font-bold text-ink-muted">{r.id}</span>
                    <span className="flex-1 text-ink">{r.description.join('; ')}</span>
                    {r.missionDeltas
                      .filter((m) => Math.abs(m.after - m.before) >= 0.005)
                      .map((m) => (
                        <span key={m.missionId} className="num text-xs text-ink-muted">
                          {m.code} {pct(m.before)}→{pct(m.after)}
                        </span>
                      ))}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultView({ result, labelOf, running }: { result: Run; labelOf: (id: string) => string; running: boolean }) {
  const data = result.missionDeltas.map((m) => ({ name: m.code, before: Math.round(m.before * 100), after: Math.round(m.after * 100) }));
  const worst = [...result.missionDeltas].sort((a, b) => a.after - a.before - (b.after - b.before))[0];
  const worstPts = worst ? Math.round((worst.after - worst.before) * 100) : 0;
  return (
    <motion.div key={result.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: running ? 0.6 : 1, y: 0 }} className="space-y-5">
      <Panel title={`Result ${result.id}`} icon={<FlaskConical className="h-4 w-4" />} actions={<span className="text-xs text-ink-dim">Sandbox only · nothing changed</span>}>
        <ul className="space-y-1 text-lg text-ink">
          {result.description.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="num text-sm leading-7 text-ink-dim">{i + 1}.</span>
              {line}
            </li>
          ))}
        </ul>
        {worst && (
          <p className="mt-1 text-base text-ink-muted">
            {worstPts < 0 ? (
              <>
                Biggest hit: <span className="font-semibold text-ink">{worst.code}</span> drops{' '}
                <span className="num font-bold text-risk">{-worstPts} pts</span>
                {worst.statusBefore !== worst.statusAfter && (
                  <>
                    , from {STATUS[worst.statusBefore].label} to <span className={clsx('font-semibold', STATUS[worst.statusAfter].text)}>{STATUS[worst.statusAfter].label}</span>
                  </>
                )}
                .
              </>
            ) : (
              `No mission loses readiness from ${result.description.length > 1 ? 'these changes' : 'this change'}.`
            )}
          </p>
        )}
        {result.note && <p className="mt-2 text-sm text-ink-muted">{result.note}</p>}
        {result.hint && <p className="mt-2 rounded-xl border border-accent/40 bg-accent/[0.06] px-4 py-3 text-sm text-ink">{result.hint}</p>}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {result.missionDeltas.map((m) => {
            const a = STATUS[m.statusAfter];
            const Icon = a.icon;
            const pts = Math.round((m.after - m.before) * 100);
            return (
              <div key={m.missionId} className={clsx('rounded-xl border p-4', pts < 0 ? a.border : 'border-line')}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">{m.code}</span>
                  <span className={clsx('inline-flex items-center gap-1 text-xs font-semibold', a.text)}>
                    <Icon className="h-3.5 w-3.5" aria-hidden /> {a.label}
                  </span>
                </div>
                <div className="num mt-2 flex items-baseline gap-2 text-2xl font-bold">
                  <span className="text-ink-muted">{pct(m.before)}</span>
                  <ArrowRight className="h-5 w-5 self-center text-ink-dim" aria-hidden />
                  <span className={a.text}>{pct(m.after)}</span>
                </div>
                <div className={clsx('num text-sm font-semibold', pts < 0 ? 'text-risk' : pts > 0 ? 'text-ready' : 'text-ink-dim')}>
                  {pts > 0 ? '+' : ''}
                  {pts} pts
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: -12 }} barGap={4}>
              <XAxis dataKey="name" stroke="rgb(var(--line))" tick={{ fill: 'rgb(var(--ink))', fontSize: 13, fontWeight: 700 }} />
              <YAxis domain={[0, 100]} ticks={[0, getBands().yellow*100, getBands().green*100, 100]} stroke="rgb(var(--line))" tick={{ fill: 'rgb(var(--ink-dim))', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <ReferenceLine y={getBands().green*100} stroke="rgb(var(--ready))" strokeDasharray="4 4" />
              <ReferenceLine y={getBands().yellow*100} stroke="rgb(var(--risk))" strokeDasharray="4 4" />
              <Bar dataKey="before" name="Now" fill="rgb(var(--stale) / 0.35)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="before" position="top" formatter={(v: number) => `${v}%`} style={{ fill: 'rgb(var(--ink-muted))', fontSize: 12, fontFamily: 'JetBrains Mono' }} />
              </Bar>
              <Bar dataKey="after" name="What-if" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {data.map((r) => (
                  <Cell key={r.name} fill={STATUS[oddsStatus(r.after / 100)].hex} />
                ))}
                <LabelList dataKey="after" position="top" formatter={(v: number) => `${v}%`} style={{ fill: 'rgb(var(--ink))', fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-slate-400/40" /> Now
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-watch" /> What-if (color = status)
          </span>
        </div>
      </Panel>

      <Panel title={`What would tip over (${result.nodeChanges.length})`}>
        {result.nodeChanges.length === 0 ? (
          <p className="text-sm text-ink-muted">No item changes status.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {result.nodeChanges.map((c) => {
              const from = STATUS[c.from];
              const to = STATUS[c.to];
              const ToIcon = to.icon;
              const KindIcon = KIND_META[c.kind].icon;
              return (
                <li key={c.nodeId} className={clsx('flex items-center gap-3 rounded-xl border px-3 py-2', to.border)}>
                  <KindIcon className="h-4 w-4 text-ink-dim" aria-hidden />
                  <span className="flex-1 text-sm font-medium text-ink">{labelOf(c.nodeId)}</span>
                  <span className={clsx('text-xs', from.text)}>{from.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-dim" aria-hidden />
                  <span className={clsx('inline-flex items-center gap-1 text-xs font-semibold', to.text)}>
                    <ToIcon className="h-3.5 w-3.5" aria-hidden /> {to.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </motion.div>
  );
}

function Slider({ label, value, min, max, step, unit, onChange, note }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; note?: ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="flex items-baseline justify-between">
        <span className="label-caps">{label}</span>
        <span className="num text-2xl font-bold text-accent">
          {value > 0 && unit === 'd' ? '+' : ''}
          {value} {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-[rgb(var(--accent))]" />
      <span className="num flex justify-between text-xs text-ink-dim">
        <span>
          {min} {unit}
        </span>
        <span className="text-ink-muted">{note}</span>
        <span>
          {max} {unit}
        </span>
      </span>
    </label>
  );
}

function optionsFor(kind: Kind, nodes: GraphNode[], missions: Mission[]) {
  const byStatus = (a: GraphNode, b: GraphNode) => ({ risk: 0, watch: 1, ready: 2 })[a.status] - ({ risk: 0, watch: 1, ready: 2 })[b.status] || a.label.localeCompare(b.label);
  const tag = (n: GraphNode) => `${n.label}${n.status !== 'ready' ? ` (${STATUS[n.status].label})` : ''}`;
  switch (kind) {
    case 'delayPart':
      return nodes.filter((n) => n.kind === 'part' && n.id.includes('|job:')).sort(byStatus).map((n) => ({ id: n.id, label: `${tag(n)} · ${n.metric}` }));
    case 'removePerson': {
      // One entry per sailor (they appear once per mission), with role and team depth so the effect is predictable.
      const seen = new Map<string, { id: string; label: string }>();
      for (const n of [...nodes].sort(byStatus)) {
        if (n.kind !== 'person' || !n.id.includes('|member:')) continue;
        const [teamId, member] = n.id.split('|member:');
        const shore = teamId.includes('|prereq:');
        const key = (shore ? 'shore:' : 'ship:') + member;
        if (seen.has(key)) continue;
        const team = nodes.find((t) => t.id === teamId);
        const m = team && /^(?:\w+: )?(\d+) qualified (.+?) \(\w+\) aboard/.exec(team.label);
        const size = nodes.filter((x) => x.id.startsWith(teamId + '|member:')).length;
        const role = m ? m[2].replace(/ \(SYNTH\)/, '').toLowerCase() : '';
        seen.set(key, { id: n.id, label: `${shore ? 'Pier support · ' : ''}${tag(n)}${role ? ` · ${role}` : ''}${m ? ` · ${size} aboard, needs ${m[1]}` : ''}` });
      }
      return [...seen.values()].sort((a, b) => Number(a.label.startsWith('Pier')) - Number(b.label.startsWith('Pier')) || a.label.localeCompare(b.label));
    }
    case 'casrep':
      return nodes.filter((n) => n.kind === 'equipment' && n.id.includes('|system:')).sort(byStatus).map((n) => ({ id: n.id, label: tag(n) }));
    case 'shiftMission':
      return missions.map((m) => ({ id: m.id, label: `${m.code} (D+${m.daysOut}, ${pct(m.odds)})` }));
  }
}

function describe(c: ScenarioChange, labelOf: (id: string) => string): string {
  switch (c.kind) {
    case 'delayPart':
      return `Delay ${labelOf(c.node)} by ${c.hours} h`;
    case 'removePerson':
      return `Remove ${labelOf(c.node)}`;
    case 'shiftMission':
      return `Move ${labelOf(c.mission)} ${Math.abs(c.days)} d ${c.days < 0 ? 'earlier' : 'later'}`;
    case 'casrep':
      return c.category ? `Open ${c.category} CASREP on ${labelOf(c.node)}` : `Close CASREP on ${labelOf(c.node)}`;
  }
}
