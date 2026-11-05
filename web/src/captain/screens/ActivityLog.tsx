import { motion } from 'framer-motion';
import {
  Bot,
  CheckCircle2,
  Cpu,
  FileText,
  FlaskConical,
  Lightbulb,
  OctagonX,
  Play,
  Radio,
  ScrollText,
  Search,
  SlidersHorizontal,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api/api';
import type { LogEntry, LogType } from '../api/types';
import { RecordId } from '../components/ui/RecordId';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import clsx from '../lib/clsx';
import { useApi } from '../state/useApi';

const TYPE_META: Record<LogType, { label: string; icon: LucideIcon; cls: string }> = {
  event: { label: 'Event', icon: Radio, cls: 'text-watch border-watch/40 bg-[rgba(251,191,36,0.06)]' },
  recommendation: { label: 'Recommendation', icon: Lightbulb, cls: 'text-accent border-accent/40 bg-accent/[0.06]' },
  approval: { label: 'Approval', icon: CheckCircle2, cls: 'text-ready border-ready/40 bg-ready-soft' },
  rejection: { label: 'Rejection', icon: XCircle, cls: 'text-ink-muted border-line-strong bg-ink/[0.04]' },
  modification: { label: 'Modification', icon: SlidersHorizontal, cls: 'text-accent border-accent/40 bg-accent/[0.06]' },
  scenario: { label: 'What-if', icon: FlaskConical, cls: 'text-[#a78bfa] border-[#a78bfa]/40 bg-[#a78bfa]/[0.07]' },
  stop: { label: 'STOP', icon: OctagonX, cls: 'text-risk border-risk/60 bg-risk-soft' },
  resume: { label: 'Resume', icon: Play, cls: 'text-ready border-ready/40 bg-ready-soft' },
  brief: { label: 'Brief', icon: FileText, cls: 'text-ink border-line-strong bg-ink/[0.04]' },
  system: { label: 'System', icon: Cpu, cls: 'text-ink-dim border-line bg-ink/[0.03]' },
};

const FILTERS: { id: string; label: string; types: LogType[] }[] = [
  { id: 'all', label: 'All', types: [] },
  { id: 'events', label: 'Events', types: ['event'] },
  { id: 'recs', label: 'Recommendations', types: ['recommendation'] },
  { id: 'decisions', label: 'Decisions', types: ['approval', 'rejection', 'modification'] },
  { id: 'stop', label: 'STOP / Resume', types: ['stop', 'resume'] },
  { id: 'whatif', label: 'What-if', types: ['scenario'] },
  { id: 'other', label: 'Briefs & system', types: ['brief', 'system'] },
];

// Source-record IDs open in the detail panel; other refs (fix ids, scenario ids, mission ids) are labels.
const RECORD_REF = /^(OPS|MAINT|CASREP|REQN|VTRK|PERS|SUP|DRR|ENGLOG)-/;

export function ActivityLog() {
  const logQ = useApi(() => api.getLog());
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const entries = logQ.data ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTERS) c[f.id] = f.types.length ? entries.filter((e) => f.types.includes(e.type)).length : entries.length;
    return c;
  }, [entries]);

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const needle = q.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!f.types.length || f.types.includes(e.type)) &&
        (!needle || e.message.toLowerCase().includes(needle) || e.actor.toLowerCase().includes(needle) || e.refs.some((r) => r.toLowerCase().includes(needle))),
    );
  }, [entries, filter, q]);

  return (
    <div className="mx-auto max-w-[120rem] space-y-5 px-8 pb-10 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2.2rem] font-bold leading-tight tracking-tight">Activity Log</h1>
          <p className="mt-1 text-lg text-ink-muted">Every event, recommendation, decision and STOP, newest first. Nothing is ever deleted.</p>
        </div>
        <label className="relative block w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search messages or record IDs"
            className="w-full rounded-xl border border-line bg-abyss-900/70 py-3 pl-10 pr-4 text-base text-ink placeholder:text-ink-dim focus:border-accent/60 focus:outline-none"
          />
        </label>
      </div>

      <div role="tablist" aria-label="Filter by type" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-semibold transition',
              filter === f.id ? 'border-accent/70 bg-accent/15 text-accent' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {f.label}
            <span className="num rounded-sm bg-ink/[0.08] px-1.5 text-xs">{counts[f.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <section className="glass overflow-hidden">
        {logQ.loading && <Loading label="Reading the log" />}
        {logQ.error != null && !logQ.data && <ErrorState error={logQ.error} onRetry={logQ.reload} />}
        {logQ.data && shown.length === 0 && (
          <EmptyState icon={ScrollText} title={entries.length ? 'No matching entries' : 'The log is empty'}>
            {entries.length ? 'Try another filter or search.' : 'Actions appear here as they happen.'}
          </EmptyState>
        )}
        {shown.length > 0 && (
          <ol aria-label="Log entries" className="divide-y divide-line">
            {shown.map((e, i) => (
              <Row key={e.id} entry={e} index={i} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Row({ entry: e, index }: { entry: LogEntry; index: number }) {
  const meta = TYPE_META[e.type];
  const Icon = meta.icon;
  const t = new Date(e.ts);
  const isHuman = e.actor.startsWith('CO');
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.02 }}
      className={clsx('grid grid-cols-[7.5rem_11rem_1fr] items-start gap-4 px-5 py-3.5', e.type === 'stop' && 'bg-[rgba(251,77,93,0.08)] shadow-[inset_4px_0_0_0_#fb4d5d]')}
    >
      <div className="num pt-1 text-sm text-ink-muted">
        {t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        <div className="text-[0.7rem] text-ink-dim">{e.id}</div>
      </div>
      <div>
        <span className={clsx('inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs font-bold', meta.cls)}>
          <Icon className="h-3.5 w-3.5" aria-hidden /> {meta.label}
        </span>
        <div className="mt-1 flex items-center gap-1 text-xs text-ink-dim">
          {isHuman ? <span className="font-semibold text-ink-muted">{e.actor}</span> : (
            <>
              <Bot className="h-3.5 w-3.5" aria-hidden /> {e.actor}
            </>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-base leading-snug text-ink">{e.message}</p>
        {e.refs.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {e.refs.map((r) =>
              RECORD_REF.test(r) ? (
                <RecordId key={r} id={r} />
              ) : (
                <span key={r} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[0.75rem] text-ink-dim">
                  {r}
                </span>
              ),
            )}
          </div>
        )}
      </div>
    </motion.li>
  );
}
