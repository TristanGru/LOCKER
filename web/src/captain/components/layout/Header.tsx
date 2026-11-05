import { useEffect } from 'react';
import { api, backend, dashboard } from '../../api/api';
import { useStore } from '../../state/store';
import { useApi } from '../../state/useApi';
import { FreshnessIndicator } from './FreshnessIndicator';
import { LogoMark } from './Logo';
import { StopButton } from './StopControl';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const { setStopped, ship, changeShip, focus, setFocus, bump } = useStore();
  const { data: snapshot } = useApi(dashboard);
  const { data } = useApi(() => api.getMissions());
  const ashore = snapshot?.state.ships.find((s: any) => s.ship_id === ship)?.kind === 'installation';

  useEffect(() => {
    if (data) { setStopped(data.stopped); if (focus !== 'all' && !data.missions.some(m=>m.id===focus)) setFocus(data.missions[0]?.id || 'all'); }
  }, [data, setStopped, focus, setFocus]);

  return (
    <header className="relative z-40 flex min-w-0 items-center gap-4 border-b border-line bg-abyss-900 px-5 py-3">
      <div className="flex shrink-0 items-center gap-3">
        <LogoMark className="h-10 w-10" />
        <span className="text-[1.35rem] font-extrabold tracking-[0.16em] text-ink">LOCKER</span>
      </div>

      <label className="text-sm text-ink-muted">{ashore ? 'Installation' : 'Ship'}<select aria-label={ashore ? 'Selected installation' : 'Selected ship'} value={ship} onChange={e=>changeShip(e.target.value)} className="ml-2 rounded border border-line bg-abyss-950 p-2 text-ink">{snapshot?.state.ships.filter((s: any)=>(s.kind==='installation')===ashore).map((s: any)=><option key={s.ship_id} value={s.ship_id}>{s.name}</option>)}</select></label>
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
        <details className="relative text-sm text-ink-muted"><summary>Sources / controls</summary><div className="absolute right-0 z-50 mt-3 max-h-[75vh] w-[min(90vw,42rem)] overflow-auto rounded-xl border border-line bg-abyss-950 p-5">
          <p>Synthetic exercise • event-interval readiness</p><p>Source revision: {snapshot?.state.source_revision}</p>
          <p>Refresh: {snapshot?.sources.last_attempt.status} {snapshot?.sources.last_attempt.error}</p>
          <button className="m-2 underline" onClick={async()=>{if(!confirm('Validate and refresh sources? Active decisions block changed imports.'))return;try{await backend('sources/refresh',{base_version:snapshot.state.version});}catch(e){alert(String(e));}finally{bump();}}}>Refresh sources</button>
          <button className="m-2 underline" onClick={async()=>{if(!confirm('Refresh sources and reset playback/decisions if changed?'))return;try{await backend('sources/refresh',{base_version:snapshot.state.version,reset_scenario:true});}catch(e){alert(String(e));}finally{bump();}}}>Refresh with reset</button>
          <button className="m-2 underline" onClick={async()=>{try{await backend('undo',{base_version:snapshot.state.version});bump();}catch(e){alert(String(e));}}}>Undo last change</button>
          <p>Thresholds: Ready {snapshot?.forecast.bands.green*100}% / Watch {snapshot?.forecast.bands.yellow*100}%. Unknown evidence is not a probability.</p>
          {snapshot?.sources.sources.map((s:any)=><p className="my-2 border-b border-line" key={s.file}>{s.file}: {s.status} / {s.usage}<br/>{s.explanation}</p>)}
          <h3>Reported baseline (not forecast probabilities)</h3><pre className="whitespace-pre-wrap">{JSON.stringify(snapshot?.forecast.reported_baseline[ship],null,2)}</pre>
          <a href="/?legacy=1" className="underline">Advanced workspace: full source review, assumptions and action preview/apply</a>
        </div></details>
        <StopButton />
      </div>
    </header>
  );
}
