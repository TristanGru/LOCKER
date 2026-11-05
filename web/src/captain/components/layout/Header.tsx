import { useEffect } from 'react';
import { api, dashboard } from '../../api/api';
import { useStore } from '../../state/store';
import { useApi } from '../../state/useApi';
import { ControlsMenu } from './ControlsMenu';
import { FreshnessIndicator } from './FreshnessIndicator';
import { LogoMark } from './Logo';
import { StopButton } from './StopControl';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const { setStopped, ship, changeShip, focus, setFocus } = useStore();
  const { data: snapshot } = useApi(dashboard);
  const { data } = useApi(() => api.getMissions());
  const ashore = snapshot?.state.ships.find((s: any) => s.ship_id === ship)?.kind === 'installation';

  useEffect(() => {
    if (data) { setStopped(data.stopped); if (!data.missions.some(m=>m.id===focus)) setFocus(data.missions[0]?.id || 'all'); }
  }, [data, setStopped, focus, setFocus]);

  return (
    <header className="on-navy relative z-40 flex min-w-0 items-center gap-5 border-b-2 border-[rgb(var(--accent))] bg-masthead px-5 py-2.5">
      <div className="flex shrink-0 items-center gap-3 border-r border-line pr-5">
        <LogoMark className="h-9 w-9" />
        <span className="leading-none">
          <span className="block text-[1.2rem] font-bold tracking-[0.12em] text-ink">LOCKER</span>
          <span className="mt-1 block text-[0.68rem] font-medium uppercase tracking-[0.08em] text-ink-dim">Readiness decision support</span>
        </span>
      </div>

      <label className="flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-dim">{ashore ? 'Installation' : 'Ship'}<select aria-label={ashore ? 'Selected installation' : 'Selected ship'} value={ship} onChange={e=>changeShip(e.target.value)} className="rounded border border-line-strong bg-abyss-950 px-2.5 py-1.5 text-sm font-semibold normal-case tracking-normal text-ink">{snapshot?.state.ships.filter((s: any)=>(s.kind==='installation')===ashore).map((s: any)=><option key={s.ship_id} value={s.ship_id}>{s.name}</option>)}</select></label>
      {data && (
        <div className="hidden min-w-0 items-center truncate border-l border-line pl-4 text-sm text-ink-muted lg:flex">
          <span className="truncate font-semibold text-ink">{data.ship.name}</span>
          <span className="mx-2 shrink-0 text-ink-dim">·</span>
          <span className="shrink-0">
            {data.ship.kind==='installation' ? 'next support in' : 'deploys in'} <span className="num font-semibold text-ink">{data.ship.deployInDays}</span> days
          </span>
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <ThemeToggle />
        <FreshnessIndicator freshness={data?.freshness ?? null} />
        <ControlsMenu snapshot={snapshot} ship={ship} />
        <StopButton />
      </div>
    </header>
  );
}
