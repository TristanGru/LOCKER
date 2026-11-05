import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeedFreshness, Freshness } from '../../api/types';
import clsx from '../../lib/clsx';
import { fmtAge } from '../../theme/status';
import { StaleBadge } from '../ui/StaleBadge';

const UNIT_ORDER = (u: string) => (u === 'squadron' ? 2 : /^NS/.test(u) ? 1 : 0);
const shortAge = (h: number) => fmtAge(h).replace(' old', '');

/**
 * Source-feed freshness. Stale feeds are listed up front; the rest are grouped by unit (one line each, expand to
 * see the feeds) so all 98 feeds stay reachable without a 98-row list. Every feed opens to show its provenance.
 */
export function FreshnessIndicator({ freshness }: { freshness: Freshness | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set());
  const [openFeed, setOpenFeed] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const feeds = freshness?.feeds ?? [];
  const q = query.trim().toLowerCase();
  const match = (f: FeedFreshness) => !q || [f.system, f.file, f.unitName, f.label].some((v) => v?.toLowerCase().includes(q));
  const stale = feeds.filter((f) => f.stale).sort((a, b) => b.ageHours - a.ageHours);
  const groups = useMemo(() => {
    const by = new Map<string, FeedFreshness[]>();
    for (const f of feeds) {
      const u = f.unit ?? 'other';
      by.set(u, [...(by.get(u) ?? []), f]);
    }
    return [...by.entries()]
      .map(([unit, list]) => ({ unit, name: list[0].unitName ?? unit, list: [...list].sort((a, b) => Number(b.stale) - Number(a.stale) || (a.system ?? '').localeCompare(b.system ?? '')) }))
      .sort((a, b) => UNIT_ORDER(a.unit) - UNIT_ORDER(b.unit) || a.name.localeCompare(b.name));
  }, [feeds]);

  if (!freshness) {
    return <div className="h-9 w-48 animate-pulse rounded bg-ink/[0.08]" />;
  }

  const anyStale = freshness.staleCount > 0;
  const toggleUnit = (u: string) =>
    setOpenUnits((s) => {
      const n = new Set(s);
      if (n.has(u)) n.delete(u);
      else n.add(u);
      return n;
    });

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={
          anyStale
            ? `${freshness.staleCount} of ${freshness.feeds.length} feeds stale, oldest ${fmtAge(freshness.oldestHours)}`
            : `All ${freshness.feeds.length} feeds current`
        }
        className={clsx(
          'flex items-center gap-2 rounded-sm border px-3.5 py-1.5 text-sm font-semibold transition',
          anyStale ? 'border-watch/55 text-watch hover:bg-watch/10' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
        )}
      >
        <span>{anyStale ? `${freshness.staleCount} of ${freshness.feeds.length} stale · ${shortAge(freshness.oldestHours)}` : `All ${freshness.feeds.length} feeds current`}</span>
        <ChevronDown className={clsx('h-4 w-4 transition', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        // Light-on-surface tokens even inside the navy masthead: the panel is a normal page surface.
        <div className="theme-surface glass-strong absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[min(70vh,34rem)] w-[26rem] flex-col text-ink" role="dialog" aria-label="Source feeds">
          <header className="border-b border-line px-4 pb-3 pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[0.95rem] font-semibold">Source feeds</h3>
              <span className="num text-sm text-ink-muted">
                {feeds.length} feeds · <span className={anyStale ? 'font-semibold text-watch' : ''}>{stale.length} stale</span>
              </span>
            </div>
            <label className="mt-2.5 flex items-center gap-2 rounded border border-line-strong bg-abyss-900 px-2.5 py-1.5">
              <Search className="h-4 w-4 text-ink-dim" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a feed (system, file or unit)"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-dim focus:outline-none"
                aria-label="Find a feed"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-ink-dim hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {stale.filter(match).length > 0 && (
              <section className="border-b border-line bg-watch/[0.06] px-2 py-2">
                <div className="px-2 pb-1 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-watch">Needs attention</div>
                {stale.filter(match).map((f) => (
                  <FeedRow
                    key={f.id}
                    f={f}
                    unitLabel
                    open={openFeed === f.id}
                    onToggle={() => setOpenFeed(openFeed === f.id ? null : f.id)}
                  />
                ))}
              </section>
            )}

            <section className="px-2 py-2">
              <div className="px-2 pb-1 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-muted">By unit</div>
              {groups.map((g) => {
                const rows = g.list.filter(match);
                if (!rows.length) return null;
                const expanded = openUnits.has(g.unit) || !!q;
                const st = g.list.filter((f) => f.stale).length;
                const ages = g.list.map((f) => f.ageHours).filter(Number.isFinite);
                return (
                  <div key={g.unit} className="border-b border-line last:border-b-0">
                    <button type="button" onClick={() => toggleUnit(g.unit)} aria-expanded={expanded} className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left hover:bg-abyss-800">
                      <ChevronRight className={clsx('h-4 w-4 shrink-0 text-ink-dim transition', expanded && 'rotate-90')} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.name}</span>
                      <span className="num shrink-0 text-xs text-ink-muted">
                        {q ? `${rows.length} of ${g.list.length}` : g.list.length} feeds
                        {st > 0 && <span className="ml-1.5 font-semibold text-watch">· {st} stale</span>}
                      </span>
                      {ages.length > 0 && (
                        <span className="num w-[5.5rem] shrink-0 text-right text-xs text-ink-dim" title="Newest – oldest feed">
                          {shortAge(Math.min(...ages))}–{shortAge(Math.max(...ages))}
                        </span>
                      )}
                    </button>
                    {expanded && (
                      <div className="pb-1.5 pl-5">
                        {rows.map((f) => (
                          <FeedRow key={f.id} f={f} open={openFeed === f.id} onToggle={() => setOpenFeed(openFeed === f.id ? null : f.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {q && !feeds.some(match) && <p className="px-2 py-3 text-sm text-ink-muted">No feed matches "{query}".</p>}
            </section>
          </div>

          <p className="border-t border-line px-4 py-2 text-xs text-ink-muted">Each feed has its own stale threshold (its expected refresh). Click a feed for its provenance.</p>
        </div>
      )}
    </div>
  );
}

/** One feed: a compact line that opens to show where it comes from and how it is used. */
function FeedRow({ f, open, onToggle, unitLabel }: { f: FeedFreshness; open: boolean; onToggle: () => void; unitLabel?: boolean }) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-abyss-800">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.86rem] text-ink" title={f.system}>
            {unitLabel && <span className="font-semibold">{f.unitName} · </span>}
            {f.system ?? f.label}
          </span>
        </span>
        {f.stale ? <StaleBadge hours={f.ageHours} compact /> : <span className="num shrink-0 text-xs text-ink-muted">{fmtAge(f.ageHours)}</span>}
        <ChevronDown className={clsx('h-3.5 w-3.5 shrink-0 text-ink-dim transition', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <dl className="mx-2 mb-2 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 rounded-sm border border-line bg-abyss-800 px-3 py-2 text-[0.8rem]">
          <dt className="text-ink-dim">File</dt>
          <dd className="break-all font-mono text-[0.74rem] text-ink">{f.file}</dd>
          <dt className="text-ink-dim">As of</dt>
          <dd className="num text-ink">
            {new Date(f.asOf).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ({fmtAge(f.ageHours)})
          </dd>
          {f.thresholdDays != null && (
            <>
              <dt className="text-ink-dim">Stale after</dt>
              <dd className="num text-ink">
                {f.thresholdDays} days{f.refresh ? ` · refreshed ${f.refresh}` : ''}
              </dd>
            </>
          )}
          {f.steward && (
            <>
              <dt className="text-ink-dim">Steward</dt>
              <dd className="text-ink">{f.steward}</dd>
            </>
          )}
          {f.records != null && (
            <>
              <dt className="text-ink-dim">Records</dt>
              <dd className="num text-ink">
                {f.records}
                {f.rejected ? ` (${f.rejected} rejected)` : ''}
              </dd>
            </>
          )}
          {f.explanation && (
            <>
              <dt className="text-ink-dim">Used for</dt>
              <dd className="text-ink">
                {f.explanation}
                {f.usage ? <span className="text-ink-muted"> ({f.usage})</span> : null}
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
