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
    <div role="tablist" aria-label="Mission" className="flex flex-wrap overflow-hidden rounded border border-line-strong bg-abyss-900">
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
              // Segmented control: active segment carries a navy underline, not a glow.
              'flex items-center gap-2 border-r border-line px-4 py-2 text-left transition-colors last:border-r-0',
              active ? 'bg-abyss-800 shadow-[inset_0_-3px_0_rgb(var(--accent))]' : 'hover:bg-abyss-800',
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
            'px-4 py-2 text-sm font-bold transition-colors',
            value === 'all' ? 'bg-abyss-800 text-ink shadow-[inset_0_-3px_0_rgb(var(--accent))]' : 'text-ink-muted hover:bg-abyss-800',
          )}
        >
          All missions
        </button>
      )}
    </div>
  );
}
