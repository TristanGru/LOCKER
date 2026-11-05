import { LogOut, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { api, dashboard } from '../../api/api';
import { useAuth } from '../../state/auth';
import { useStore } from '../../state/store';
import { useApi } from '../../state/useApi';
import { ControlsMenu } from './ControlsMenu';
import { FreshnessIndicator } from './FreshnessIndicator';
import { LogoMark } from './Logo';
import { StopButton } from './StopControl';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const { setStopped, ship, changeShip, focus, setFocus } = useStore();
  const { user, signOut } = useAuth();
  const { data: snapshot } = useApi(dashboard);
  const { data } = useApi(() => api.getMissions());
  const ashore = snapshot?.state.ships.find((s: any) => s.ship_id === ship)?.kind === 'installation';
  const choices = snapshot?.state.ships.filter((s: any) => (s.kind === 'installation') === ashore) ?? [];

  useEffect(() => {
    if (data) { setStopped(data.stopped); if (focus !== 'all' && !data.missions.some(m=>m.id===focus)) setFocus(data.missions[0]?.id || 'all'); }
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

      <label className="flex min-w-[7rem] shrink items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-dim min-[1440px]:min-w-[14rem]"><span className="hidden shrink-0 min-[1440px]:inline">{ashore ? 'Installation' : 'Ship'}</span><select aria-label={ashore ? 'Selected installation' : 'Selected ship'} value={ship} onChange={e=>changeShip(e.target.value)} disabled={choices.length < 2} title={choices.length < 2 ? 'Your account covers this unit only' : undefined} className="w-[14rem] min-w-[7rem] max-w-full shrink truncate rounded border border-line-strong bg-abyss-950 px-2.5 py-1.5 disabled:opacity-100 text-sm font-semibold normal-case tracking-normal text-ink">{choices.map((s: any)=><option key={s.ship_id} value={s.ship_id}>{s.name}</option>)}</select></label>
      {data && (
        <div className="hidden min-w-0 shrink-[8] items-center truncate border-l border-line pl-4 text-sm text-ink-muted 2xl:flex">
          <span className="min-w-0 truncate">
            {data.ship.kind==='installation' ? 'next support in' : 'deploys in'} <span className="num font-semibold text-ink">{data.ship.deployInDays}</span> days
          </span>
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <ThemeToggle />
        <FreshnessIndicator freshness={data?.freshness ?? null} />
        <ControlsMenu snapshot={snapshot} ship={ship} />
        <StopButton />
        <div className="flex items-center gap-1.5 border-l border-line pl-3" aria-label="Signed in account" title={`${user.title} (${user.detail})`}>
          <ShieldCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <span className="hidden max-w-[9rem] truncate text-sm font-semibold text-ink 2xl:inline">{user.username}</span>
          <button type="button" onClick={() => void signOut()} aria-label="Sign out" title={`Sign out ${user.username}`}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition hover:bg-ink/[0.06] hover:text-ink">
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
