import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { BarChart3, Check, CheckCircle2, History, Network, OctagonX, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import type { DecisionKind, Fix } from '../api/types';
import { FixCard } from '../components/fixes/FixCard';
import { FixesChart } from '../components/fixes/FixesChart';
import { MissionTabs } from '../components/ui/MissionTabs';
import { OddsNumber } from '../components/ui/OddsNumber';
import { Panel } from '../components/ui/Panel';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import { StatusBadge } from '../components/ui/StatusBadge';
import clsx from '../lib/clsx';
import { useStore } from '../state/store';
import { useApi } from '../state/useApi';
import { STATUS, oddsStatus, pct } from '../theme/status';

interface Toast {
  kind: 'approved' | 'rejected' | 'modified' | 'error';
  text: string;
}

export function Fixes() {
  const { focus, setFocus, stopped, bump, setCascade } = useStore();
  const navigate = useNavigate();
  const missionId = focus === 'all' ? 'M1' : focus;
  const missionsQ = useApi(() => api.getMissions());
  const fixesQ = useApi(() => api.getFixes(missionId), [missionId]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const missions = missionsQ.data ? [...missionsQ.data.missions].sort((a, b) => a.daysOut - b.daysOut) : [];
  const mission = missions.find((m) => m.id === missionId);
  const pending = fixesQ.data?.fixes ?? [];
  const decided = fixesQ.data?.decided ?? [];
  const best = pending[0];

  async function decide(fix: Fix, decision: DecisionKind, extra: { note?: string; paramValue?: number } = {}) {
    setBusyId(fix.id);
    try {
      const r = await api.decide({ fixId: fix.id, missionId, decision, ...extra });
      if (decision === 'approve') {
        setCascade({ changes: r.changes, at: Date.now(), source: fix.id });
        const moved = r.missionDeltas.filter((d) => Math.abs(d.after - d.before) >= 0.005);
        setToast({
          kind: 'approved',
          text: `Approved "${fix.title}". ${moved.map((d) => `${d.code} ${pct(d.before)} → ${pct(d.after)}`).join(', ') || 'No change to mission odds.'}`,
        });
      } else if (decision === 'reject') {
        setToast({ kind: 'rejected', text: `Rejected "${fix.title}". Logged${extra.note ? ` with reason: ${extra.note}` : ''}.` });
      } else {
        setToast({ kind: 'modified', text: `Updated "${fix.title}": now ${pct(r.fix.oddsBefore)} → ${pct(r.fix.oddsAfter)}. Approve it when ready.` });
      }
      bump();
    } catch (e) {
      setToast({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[120rem] space-y-5 px-8 pb-10 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2.2rem] font-bold leading-tight tracking-tight">Fixes</h1>
          <p className="mt-1 text-lg text-ink-muted">Ranked by how much each one raises the odds. Nothing changes until you approve it.</p>
        </div>
        {missions.length > 0 && <MissionTabs missions={missions} value={missionId} onChange={(id) => setFocus(id)} />}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.text}
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={clsx(
              'flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-3.5 text-base',
              toast.kind === 'approved' && 'border-ready/50 bg-ready-soft text-ink',
              toast.kind === 'rejected' && 'border-line-strong bg-ink/[0.05] text-ink',
              toast.kind === 'modified' && 'border-accent/50 bg-accent/10 text-ink',
              toast.kind === 'error' && 'border-risk/60 bg-risk-soft text-ink',
            )}
          >
            {toast.kind === 'approved' && <CheckCircle2 className="h-5 w-5 text-ready" aria-hidden />}
            {toast.kind === 'rejected' && <X className="h-5 w-5 text-ink-muted" aria-hidden />}
            {toast.kind === 'modified' && <SlidersHorizontal className="h-5 w-5 text-accent" aria-hidden />}
            {toast.kind === 'error' && <OctagonX className="h-5 w-5 text-risk" aria-hidden />}
            <span className="flex-1">{toast.text}</span>
            {toast.kind === 'approved' && (
              <button className="btn-ghost !py-1.5" onClick={() => navigate('/dominoes')}>
                <Network className="h-4 w-4" aria-hidden /> See it on the graph
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {fixesQ.error != null && !fixesQ.data && <ErrorState error={fixesQ.error} onRetry={fixesQ.reload} className="glass" />}

      <div className="grid gap-6 xl:grid-cols-[1fr_30rem]">
        {/* ranked fixes */}
        <div className="space-y-4">
          {fixesQ.loading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="glass space-y-3 p-5">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-10 w-64" />
              </div>
            ))}

          {fixesQ.data && pending.length === 0 && (
            <EmptyState icon={ShieldCheck} title={decided.length ? 'Every fix has a decision' : `No fixes needed for ${mission?.code ?? 'this mission'}`} className="glass">
              {decided.length
                ? 'All recommended fixes for this mission were approved or rejected. New ones appear if the picture changes.'
                : 'Nothing linked to this mission is pulling its odds down enough to fix right now.'}
            </EmptyState>
          )}

          <LayoutGroup>
            <AnimatePresence initial={false}>
              {pending.map((f, i) => (
                <FixCard
                  key={f.id}
                  fix={f}
                  index={i}
                  busy={busyId === f.id}
                  disabledReason={stopped ? 'Stopped. Resume to decide.' : null}
                  onApprove={() => decide(f, 'approve')}
                  onReject={(note) => decide(f, 'reject', { note: note || undefined })}
                  onModify={(v) => decide(f, 'modify', { paramValue: v })}
                />
              ))}
            </AnimatePresence>
          </LayoutGroup>
        </div>

        {/* side column */}
        <div className="space-y-5">
          {mission && (
            <Panel>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="label-caps">Odds now</div>
                  <div className="text-2xl font-bold text-ink">{mission.code}</div>
                  <div className="num text-sm text-ink-dim">D+{mission.daysOut}</div>
                </div>
                <StatusBadge status={mission.status} size="lg" />
              </div>
              <div className="mt-2 flex items-end gap-4">
                <OddsNumber value={mission.odds} className={clsx('text-[4rem] font-bold leading-none', STATUS[mission.status].text)} />
                {best && (
                  <div className="pb-2 text-base text-ink-muted">
                    Top fix alone takes it to <span className={clsx('num font-bold', STATUS[oddsStatus(best.oddsAfter)].text)}>{pct(best.oddsAfter)}</span>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {pending.length > 0 && (
            <Panel title="Odds before → after" icon={<BarChart3 className="h-4 w-4" />}>
              <FixesChart fixes={pending} />
              <div className="mt-2 flex items-center gap-4 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-sm bg-slate-400/40" /> Now
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-sm bg-ready" /> After fix (color = new status)
                </span>
              </div>
            </Panel>
          )}

          <Panel title={`Decided (${decided.length})`} icon={<History className="h-4 w-4" />}>
            {decided.length === 0 ? (
              <p className="text-sm text-ink-muted">No decisions yet. Every approval and rejection is written to the activity log.</p>
            ) : (
              <ul className="space-y-2">
                {decided.map((f) => (
                  <motion.li key={f.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 rounded-xl border border-line px-3 py-2.5">
                    {f.decision === 'approved' ? (
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ready/20">
                        <Check className="h-4 w-4 text-ready" aria-hidden />
                      </span>
                    ) : (
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink/10">
                        <X className="h-4 w-4 text-ink-muted" aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{f.title}</span>
                      <span className={clsx('text-xs font-semibold uppercase tracking-wider', f.decision === 'approved' ? 'text-ready' : 'text-ink-dim')}>
                        {f.decision === 'approved' ? 'Approved by CO' : 'Rejected by CO'}
                      </span>
                    </span>
                  </motion.li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
