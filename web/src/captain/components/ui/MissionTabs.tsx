import type { Mission } from '../../api/types';
import clsx from '../../lib/clsx';
import { STATUS, pct } from '../../theme/status';

/** Mission selector used by Dominoes, Fixes, Brief and What-If. */
export function MissionTabs({
  missions,
  value,
  onChange,
  allowAll = false,
}: {
  missions: Mission[];
  value: string | 'all';
  onChange: (id: string | 'all') => void;
  allowAll?: boolean;
}) {
  return (
    <div role="tablist" aria-label="Mission" className="flex flex-wrap gap-1 rounded-2xl border border-line bg-abyss-900/70 p-1">
      {missions.map((m) => {
        const meta = STATUS[m.status];
        const Icon = meta.icon;
        const active = value === m.id;
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            className={clsx(
              'flex items-center gap-2 rounded-xl px-4 py-2.5 text-left transition',
              active ? 'bg-accent/15 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.6)]' : 'hover:bg-white/[0.04]',
            )}
          >
            <Icon className={clsx('h-4 w-4', meta.text)} aria-label={meta.label} />
            <span className="leading-tight">
              <span className={clsx('block text-sm font-bold', active ? 'text-ink' : 'text-ink-muted')}>{m.code}</span>
              <span className="num block text-xs text-ink-dim">
                D+{m.daysOut} · {pct(m.odds)}
              </span>
            </span>
          </button>
        );
      })}
      {allowAll && (
        <button
          role="tab"
          aria-selected={value === 'all'}
          onClick={() => onChange('all')}
          className={clsx(
            'rounded-xl px-4 py-2.5 text-sm font-bold transition',
            value === 'all' ? 'bg-accent/15 text-ink shadow-[inset_0_0_0_1px_rgba(34,211,238,0.6)]' : 'text-ink-muted hover:bg-white/[0.04]',
          )}
        >
          All missions
        </button>
      )}
    </div>
  );
}
