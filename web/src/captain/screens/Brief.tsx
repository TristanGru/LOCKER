import { motion } from 'framer-motion';
import { FileText, Printer } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/api';
import type { Brief as BriefT } from '../api/types';
import { MissionTabs } from '../components/ui/MissionTabs';
import { RecordId } from '../components/ui/RecordId';
import { StaleBadge } from '../components/ui/StaleBadge';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import { StatusBadge } from '../components/ui/StatusBadge';
import clsx from '../lib/clsx';
import { useStore } from '../state/store';
import { useApi } from '../state/useApi';
import { STATUS, fmtAge, pct } from '../theme/status';

export function Brief() {
  const { focus, setFocus } = useStore();
  const missionsQ = useApi(() => api.getMissions());
  const missionId = focus === 'all' ? missionsQ.data?.missions[0]?.id ?? 'all' : focus;
  const briefQ = useApi(() => api.getBrief(missionId), [missionId]);
  const [printing, setPrinting] = useState(false);
  const missions = missionsQ.data ? [...missionsQ.data.missions].sort((a, b) => a.daysOut - b.daysOut) : [];

  async function print(b: BriefT) {
    setPrinting(true);
    try {
      await api.logAction('brief', `Printed "${b.title}" (${pct(b.odds)}, ${STATUS[b.status].label}).`, [b.missionId]);
    } catch {
      /* printing must still work if logging fails */
    }
    setPrinting(false);
    window.print();
  }

  return (
    <div className="mx-auto max-w-[120rem] space-y-5 px-8 pb-10 pt-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-[2.2rem] font-bold leading-tight tracking-tight">Readiness Brief</h1>
          <p className="mt-1 text-lg text-ink-muted">Generated from the current picture. Every statement cites its source record.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {missions.length > 0 && <MissionTabs missions={missions} value={missionId} onChange={(id) => setFocus(id)} />}
          <button className="btn-accent px-5 py-3 text-base" disabled={!briefQ.data || printing} onClick={() => briefQ.data && print(briefQ.data)}>
            <Printer className="h-5 w-5" aria-hidden /> Print
          </button>
        </div>
      </div>

      {briefQ.loading && (
        <div className="glass mx-auto max-w-5xl space-y-4 p-10">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-24 w-full" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
      {briefQ.error != null && !briefQ.data && <ErrorState error={briefQ.error} onRetry={briefQ.reload} className="glass" />}
      {briefQ.data && briefQ.data.sections.length === 0 && (
        <EmptyState icon={FileText} title="Nothing to brief" className="glass">
          No data is available for this mission yet.
        </EmptyState>
      )}
      {briefQ.data && briefQ.data.sections.length > 0 && <BriefDoc brief={briefQ.data} />}
    </div>
  );
}

function BriefDoc({ brief }: { brief: BriefT }) {
  const meta = STATUS[brief.status];
  const index = new Map(brief.citations.map((c, i) => [c.id, i + 1]));
  const generated = new Date(brief.generatedAt);

  return (
    <motion.article
      key={brief.generatedAt + brief.missionId}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass mx-auto max-w-5xl overflow-hidden print:max-w-none print:rounded-none print:border-0 print:bg-white print:text-black print:shadow-none print:backdrop-blur-none"
    >
      <Classification text={brief.classification} />
      <div className="px-10 pb-10 pt-8 print:px-0 print:pt-4">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6 print:border-black/30">
          <div>
            <div className="label-caps print:text-black/60">USS Kestrel Bay (DDG-1047, fictional) · Commanding Officer's readiness brief</div>
            <h2 className="mt-1 text-[2rem] font-bold leading-tight text-ink print:text-black">{brief.title}</h2>
            <div className="num mt-1 text-sm text-ink-dim print:text-black/60">
              Generated {generated.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} by LOCKER · read-only analysis
            </div>
          </div>
          <div className="text-right">
            <StatusBadge status={brief.status} size="lg" />
            <div className={clsx('num mt-2 text-5xl font-bold', meta.text, 'print:text-black')}>{pct(brief.odds)}</div>
            <div className="text-xs uppercase tracking-wider text-ink-dim print:text-black/60">odds mission capable</div>
          </div>
        </header>

        {/* bottom line up front */}
        <section className={clsx('mt-6 rounded-xl border-l-4 px-5 py-4', meta.bg, 'print:bg-transparent')} style={{ borderLeftColor: meta.hex }}>
          <div className="label-caps print:text-black/60">Bottom line</div>
          <p className="mt-1 text-xl font-semibold leading-snug text-ink print:text-black">{brief.bottomLine}</p>
        </section>

        {brief.sections.map((s, si) => (
          <section key={s.heading} className="mt-7 break-inside-avoid">
            <h3 className="flex items-center gap-3 text-lg font-bold uppercase tracking-[0.12em] text-ink-muted print:text-black">
              <span className="num text-accent print:text-black">{si + 1}.</span> {s.heading}
            </h3>
            <div className="mt-2 space-y-2.5">
              {s.paragraphs.map((p, pi) => (
                <p key={pi} className="text-[1.05rem] leading-relaxed text-ink print:text-black">
                  {p.text}
                  {p.cites.map((c) => (
                    <a key={c} href={`#cite-${c}`} onClick={(e) => e.preventDefault()} className="num ml-1 align-super text-[0.72rem] font-bold text-accent print:text-black" title={c}>
                      [{index.get(c)}]
                    </a>
                  ))}
                </p>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-9 border-t border-line pt-6 print:border-black/30">
          <h3 className="text-lg font-bold uppercase tracking-[0.12em] text-ink-muted print:text-black">Sources ({brief.citations.length})</h3>
          <ol className="mt-3 grid gap-2 md:grid-cols-2 print:grid-cols-1">
            {brief.citations.map((c, i) => (
              <li key={c.id} id={`cite-${c.id}`} className="flex items-start gap-3 rounded-lg border border-line px-3 py-2 print:border-black/20">
                <span className="num w-7 shrink-0 pt-0.5 text-sm font-bold text-accent print:text-black">[{i + 1}]</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="print:hidden">
                      <RecordId id={c.id} />
                    </span>
                    <span className="hidden font-mono text-sm print:inline">{c.id}</span>
                    {c.stale ? (
                      <span className="print:hidden">
                        <StaleBadge hours={c.ageHours} compact />
                      </span>
                    ) : (
                      <span className="num text-xs text-ink-dim print:hidden">{fmtAge(c.ageHours)}</span>
                    )}
                    <span className="hidden text-xs print:inline">({fmtAge(c.ageHours)}{c.stale ? ', STALE' : ''})</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-ink print:text-black">
                    {c.system}: {c.title}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <Classification text={brief.classification} />
    </motion.article>
  );
}

function Classification({ text }: { text: string }) {
  return (
    <div className="bg-ready/80 py-1.5 text-center text-xs font-extrabold tracking-[0.3em] text-abyss-950 print:border-y print:border-black print:bg-white print:text-black">
      {text}
    </div>
  );
}
