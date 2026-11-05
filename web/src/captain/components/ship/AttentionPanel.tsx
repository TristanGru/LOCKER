import { ArrowRight, Crosshair, Network, ShieldCheck, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ShipPayload } from '../../api/types';
import clsx from '../../lib/clsx';
import { useStore } from '../../state/store';
import { STATUS } from '../../theme/status';
import { OddsNumber } from '../ui/OddsNumber';
import { RecordId } from '../ui/RecordId';
import { StatusBadge } from '../ui/StatusBadge';

/** Needs attention: next domino, mission at risk, watch list. Sits beside the department list. */
export function AttentionPanel({ ship }: { ship: ShipPayload }) {
  const { openNode, setFocus } = useStore();
  const navigate = useNavigate();
  const d = ship.nextDomino;
  const m = ship.missionAtRisk;
  const order = { risk: 0, watch: 1, ready: 2 } as const;
  const flagged = ship.systems.filter((s) => s.status !== 'ready').sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));

  const go = (path: string, mission?: string) => {
    if (mission) setFocus(mission);
    navigate(path);
  };

  return (
    <aside className="space-y-4" aria-label="Needs attention">
      <h2 className="label-caps !text-ink-muted">Needs attention</h2>

      {d ? (
        <section className="relative overflow-hidden rounded-2xl border border-risk bg-risk/10 p-5 shadow-[0_0_40px_-18px_rgba(251,77,93,0.9)]">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-risk">
            <Crosshair className="h-4 w-4 animate-pulse" aria-hidden /> Next domino · {d.missionCode}
          </div>
          <button onClick={() => openNode(d.nodeId)} className="mt-1 block text-left text-[1.4rem] font-bold leading-tight text-ink hover:underline">
            {d.label}
          </button>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{d.reason}</p>
          {d.gain > 0 && (
            <p className="mt-2 text-sm text-ink">
              Fixing it alone adds about <span className="num font-bold text-ready">+{Math.round(d.gain * 100)} pts</span> to {d.missionCode}.
            </p>
          )}
          {d.sourceIds.length > 0 && (
            <div className="mt-3">
              <div className="label-caps mb-1.5">Source records</div>
              <div className="flex flex-wrap gap-1.5">
                {d.sourceIds.map((r) => (
                  <RecordId key={r} id={r} />
                ))}
              </div>
            </div>
          )}
          <button className="btn-risk mt-4 w-full" onClick={() => go('/fixes', d.missionId)}>
            <Wrench className="h-4 w-4" aria-hidden /> See fixes
          </button>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-2xl border border-ready/40 bg-ready-soft p-5">
          <ShieldCheck className="h-6 w-6 text-ready" aria-hidden />
          <span className="text-base text-ink">No domino in sight.</span>
        </section>
      )}

      {m && (
        <section className={clsx('glass p-5', STATUS[m.status].border)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="label-caps">Mission {m.status === 'risk' ? 'at risk' : 'on watch'}</div>
              <div className="text-xl font-bold text-ink">{m.code}</div>
              <div className="text-sm text-ink-muted">
                {m.name} · <span className="num">D+{m.daysOut}</span>
              </div>
            </div>
            <StatusBadge status={m.status} />
          </div>
          <div className="mt-2 flex items-end gap-3">
            <OddsNumber value={m.odds} className={clsx('text-5xl font-bold leading-none', STATUS[m.status].text)} />
            <span className="pb-1 text-sm text-ink-dim">odds ready</span>
          </div>
          <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-ink/[0.08]">
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${m.odds * 100}%`, background: STATUS[m.status].hex }} />
            <div className="absolute inset-y-0 w-px bg-ready/80" style={{ left: '82%' }} />
            <div className="absolute inset-y-0 w-px bg-risk/80" style={{ left: '50%' }} />
          </div>
          <button className="btn-ghost mt-4 w-full" onClick={() => go('/missions')}>
            All missions <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </section>
      )}

      <section className="glass p-5">
        <div className="label-caps mb-2">Watch items ({flagged.length})</div>
        {flagged.length === 0 ? (
          <p className="text-sm text-ink-muted">Every system is Ready.</p>
        ) : (
          <ul className="space-y-1.5">
            {flagged.map((s) => {
              const meta = STATUS[s.status];
              const Icon = meta.icon;
              return (
                <li key={s.id}>
                  <button onClick={() => openNode(s.id)} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-ink/[0.06]">
                    <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', meta.text)} aria-label={meta.label} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">
                        {s.name} <span className={clsx('font-semibold', meta.text)}>· {meta.label}</span>
                      </span>
                      <span className="block truncate text-xs text-ink-dim" title={s.reason}>
                        {s.reason}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button className="btn-accent w-full py-3 text-base" onClick={() => go('/dominoes', d?.missionId)}>
        <Network className="h-5 w-5" aria-hidden /> Open Davy's Dominoes
      </button>
    </aside>
  );
}
