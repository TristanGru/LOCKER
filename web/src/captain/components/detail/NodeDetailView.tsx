import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpLeft, CircleAlert, Clock, Crosshair, FileText, GitCompareArrows, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { api } from '../../api/api';
import type { NodeLink } from '../../api/types';
import clsx from '../../lib/clsx';
import { useStore } from '../../state/store';
import { useApi } from '../../state/useApi';
import { STATUS, fmtAge, pct } from '../../theme/status';
import { KIND_META } from '../graph/kinds';
import { OddsNumber } from '../ui/OddsNumber';
import { StaleBadge } from '../ui/StaleBadge';
import { ErrorState, Loading } from '../ui/States';
import { StatusBadge } from '../ui/StatusBadge';
import { ContradictionCard } from './ContradictionCard';
import { RecordCard } from './RecordCard';

export function NodeDetailView({ id }: { id: string }) {
  const { focus } = useStore();
  const { data, error, loading, reload } = useApi(() => api.getNode(id, focus), [id, focus]);

  if (loading) return <Loading label="Pulling source records" />;
  if (error != null && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { node } = data;
  const meta = STATUS[node.status];
  const kind = KIND_META[node.kind];
  const KindIcon = kind.icon;
  const flagged = node.status !== 'ready';

  return (
    <div className="space-y-6 p-5">
      {/* identity */}
      <div>
        <div className="flex items-start gap-4">
          <div className={clsx('grid h-14 w-14 shrink-0 place-items-center rounded-2xl border', meta.border, meta.bg)}>
            <KindIcon className={clsx('h-7 w-7', meta.text)} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="label-caps">{kind.label}</div>
            <h2 className="text-2xl font-bold leading-tight text-ink">{node.label}</h2>
            <div className="mt-0.5 font-mono text-sm text-ink-dim">{node.subtitle}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusBadge status={node.status} size="lg" />
          {node.kind === 'mission' ? (
            <OddsNumber value={node.p} className={clsx('text-4xl font-bold', meta.text)} />
          ) : (
            <span className={clsx('num text-xl font-bold', meta.text)}>{node.metric}</span>
          )}
          <span className="ml-auto">{node.stale ? <StaleBadge hours={node.dataAgeHours} /> : <DataAge hours={node.dataAgeHours} />}</span>
        </div>
      </div>

      {node.nextDominoFor.length > 0 && (
        <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-start gap-3 rounded-xl border border-risk bg-[#2a0b12] p-4 animate-pulseRing">
          <Crosshair className="mt-0.5 h-5 w-5 shrink-0 text-risk" aria-hidden />
          <div>
            <div className="font-bold uppercase tracking-wider text-risk">Next domino</div>
            <p className="text-sm text-ink">This is the single item whose fix would raise the odds the most. See the Fixes screen for options.</p>
          </div>
        </motion.div>
      )}

      <Section title={flagged ? "Why it's flagged" : 'Status'} icon={flagged ? <CircleAlert className="h-4 w-4" /> : <Info className="h-4 w-4" />}>
        <ul className="space-y-2">
          {data.why.map((w, i) => (
            <li key={i} className="flex gap-2.5 text-base leading-relaxed text-ink">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: i === 0 ? meta.hex : 'rgba(140,180,220,0.5)' }} />
              {w}
            </li>
          ))}
        </ul>
        {data.perMission.length > 0 && node.kind !== 'mission' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.perMission.map((pm) => {
              const m = STATUS[pm.status];
              const Icon = m.icon;
              return (
                <span key={pm.missionId} className={clsx('inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm', m.border, m.bg)}>
                  <Icon className={clsx('h-4 w-4', m.text)} aria-label={m.label} />
                  <span className="font-semibold text-ink">{pm.code}</span>
                  {node.kind !== 'person' && (
                    <span className={clsx('num font-semibold', m.text)}>
                      {pct(pm.p)} {node.kind === 'part' ? 'on time' : 'ready'}
                    </span>
                  )}
                  <span className="text-ink-muted">· {m.label}</span>
                </span>
              );
            })}
          </div>
        )}
      </Section>

      {data.contradictions.length > 0 && (
        <Section title={`Contradictions (${data.contradictions.length})`} icon={<GitCompareArrows className="h-4 w-4" />}>
          <div className="space-y-3">
            {data.contradictions.map((c) => (
              <ContradictionCard key={c.id} c={c} />
            ))}
          </div>
        </Section>
      )}

      <Section title={`Source records (${data.records.length})`} icon={<FileText className="h-4 w-4" />}>
        {data.records.length === 0 ? (
          <p className="text-sm text-ink-muted">No source records linked.</p>
        ) : (
          <div className="space-y-3">
            {data.records.map((r, i) => (
              <RecordCard key={r.id} record={r} index={i} />
            ))}
          </div>
        )}
      </Section>

      {(data.dependsOn.length > 0 || data.dependents.length > 0) && (
        <div className="grid gap-5">
          {data.dependsOn.length > 0 && (
            <Section title="Depends on" icon={<ArrowDownRight className="h-4 w-4" />}>
              <LinkList links={data.dependsOn} />
            </Section>
          )}
          {data.dependents.length > 0 && (
            <Section title="Needed by" icon={<ArrowUpLeft className="h-4 w-4" />}>
              <LinkList links={data.dependents} />
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function DataAge({ hours }: { hours: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
      <Clock className="h-4 w-4" aria-hidden /> Data <span className="num">{fmtAge(hours)}</span>
    </span>
  );
}

export function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="label-caps mb-3 flex items-center gap-2 !text-ink-muted">
        {icon && <span className="text-accent">{icon}</span>}
        {title}
      </h3>
      {children}
    </section>
  );
}

export function LinkList({ links }: { links: NodeLink[] }) {
  const { openNode } = useStore();
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => {
        const m = STATUS[l.status];
        const Icon = m.icon;
        const KindIcon = KIND_META[l.kind].icon;
        return (
          <button
            key={l.id}
            onClick={() => openNode(l.id)}
            className={clsx('inline-flex items-center gap-2 rounded-lg border bg-abyss-900/60 px-2.5 py-1.5 text-sm transition hover:bg-white/[0.06]', m.border)}
            title={`${l.label}: ${m.label}`}
          >
            <KindIcon className="h-4 w-4 text-ink-dim" aria-hidden />
            <span className="text-ink">{l.label}</span>
            <Icon className={clsx('h-4 w-4', m.text)} aria-label={m.label} />
          </button>
        );
      })}
    </div>
  );
}
