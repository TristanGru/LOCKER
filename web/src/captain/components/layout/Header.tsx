import { LogOut, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, dashboard } from '../../api/api';
import { useAuth } from '../../state/auth';
import { lastUnit } from '../../state/lastUnit';
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
  const units: any[] = snapshot?.state.ships ?? [];
  const kindOf = (id: string): 'ship' | 'installation' => (units.find((s) => s.ship_id === id)?.kind === 'installation' ? 'installation' : 'ship');
  const ashore = kindOf(ship) === 'installation';
  // Every unit the account covers, ships and installations together, so any tab can switch to any unit.
  const ships = units.filter((s) => s.kind !== 'installation');
  const shore = units.filter((s) => s.kind === 'installation');
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (units.some((s) => s.ship_id === ship)) lastUnit[kindOf(ship)] = ship;
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /** Each overview shows one kind of unit, so picking the other kind there opens the matching overview. */
  const pick = (id: string) => {
    changeShip(id);
    const kind = kindOf(id);
    if (pathname === '/' && kind === 'installation') navigate('/shore');
    else if (pathname === '/shore' && kind === 'ship') navigate('/');
  };
  const option = (s: any) => <option key={s.ship_id} value={s.ship_id}>{s.name}</option>;

  useEffect(() => {
    if (data) { setStopped(data.stopped); if (focus !== 'all' && !data.missions.some(m=>m.id===focus)) setFocus(data.missions[0]?.id || 'all'); }
  }, [data, setStopped, focus, setFocus]);

  return (
    <header className="on-navy relative z-40 flex min-w-0 items-center gap-4 border-b-2 border-[rgb(var(--accent))] bg-masthead px-5 py-2.5">
      <div className="flex shrink-0 items-center gap-3 border-r border-line pr-5">
        <LogoMark className="h-9 w-9" />
        <span className="leading-none">
          <span className="block text-[1.2rem] font-bold tracking-[0.12em] text-ink">LOCKER</span>
          <span className="mt-1 hidden text-[0.68rem] font-medium uppercase tracking-[0.08em] text-ink-dim min-[1440px]:block">Readiness decision support</span>
        </span>
      </div>

      <label className="flex shrink-0 items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-dim"><span className="hidden min-[1440px]:inline">{ashore ? 'Installation' : 'Ship'}</span><select aria-label={ashore ? 'Selected installation' : 'Selected ship'} value={ship} onChange={e=>pick(e.target.value)} disabled={units.length < 2} title={units.length < 2 ? 'Your account covers this unit only' : undefined} className="rounded border border-line-strong bg-abyss-950 px-2.5 py-1.5 disabled:opacity-100 text-sm font-semibold normal-case tracking-normal text-ink">{ships.length && shore.length ? <><optgroup label="Ships">{ships.map(option)}</optgroup><optgroup label="Installations">{shore.map(option)}</optgroup></> : units.map(option)}</select></label>
      {data && (
        <div className={`hidden shrink-0 items-center whitespace-nowrap border-l border-line pl-4 text-sm text-ink-muted min-[1900px]:flex`}>
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
        <div className="flex items-center gap-1.5 border-l border-line pl-3" aria-label="Signed in account" title={`${user.title} (${user.detail})`}>
          <ShieldCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <span className={`hidden whitespace-nowrap text-sm font-semibold text-ink min-[2000px]:inline`}>{user.username}</span>
          <button type="button" onClick={() => void signOut()} aria-label="Sign out" title={`Sign out ${user.username}`}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition hover:bg-ink/[0.06] hover:text-ink">
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
