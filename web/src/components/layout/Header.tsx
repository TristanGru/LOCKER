import { useEffect } from 'react';
import { api } from '../../api/api';
import { useStore } from '../../state/store';
import { useApi } from '../../state/useApi';
import { FreshnessIndicator } from './FreshnessIndicator';
import { LogoMark } from './Logo';
import { StopButton } from './StopControl';

export function Header() {
  const { setStopped } = useStore();
  const { data } = useApi(() => api.getMissions());

  useEffect(() => {
    if (data) setStopped(data.stopped);
  }, [data, setStopped]);

  return (
    <header className="relative z-40 flex min-w-0 items-center gap-4 border-b border-line bg-abyss-900 px-5 py-3">
      <div className="flex shrink-0 items-center gap-3">
        <LogoMark className="h-10 w-10" />
        <span className="text-[1.35rem] font-extrabold tracking-[0.16em] text-ink">LOCKER</span>
      </div>

      {data && (
        <div className="hidden min-w-0 items-center truncate border-l border-line pl-4 text-sm text-ink-muted lg:flex">
          <span className="truncate font-semibold text-ink">{data.ship.name}</span>
          <span className="mx-2 shrink-0 text-ink-dim">·</span>
          <span className="shrink-0">
            deploys in <span className="num font-semibold text-ink">{data.ship.deployInDays}</span> days
          </span>
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <FreshnessIndicator freshness={data?.freshness ?? null} />
        <StopButton />
      </div>
    </header>
  );
}
