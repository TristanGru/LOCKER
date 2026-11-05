import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, CalendarClock, Crosshair, FileText, Info, ListChecks, Printer, ScrollText, Target, Wrench } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api } from '../api/api';
import type { Brief as BriefT, Status } from '../api/types';
import { MissionTabs } from '../components/ui/MissionTabs';
import { RecordId } from '../components/ui/RecordId';
import { StaleBadge } from '../components/ui/StaleBadge';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import { StatusBadge } from '../components/ui/StatusBadge';
import clsx from '../lib/clsx';
import { useStore } from '../state/store';
import { useApi } from '../state/useApi';
import { STATUS, fmtAge, oddsStatus, pct } from '../theme/status';

export function Brief() {
  const { focus, setFocus } = useStore();
  const missionId = focus === 'all' ? 'M1' : focus;
  const missionsQ = useApi(() => api.getMissions());
  const briefQ = useApi(() => api.getBrief(missionId), [missionId]);
  const [printing, setPrinting] = useState(false);
  const missions = missionsQ.data ? [...missionsQ.data.missions].sort((a, b) => a.daysOut - b.daysOut) : [];

  async function print(b: BriefT) {
    setPrinting(true);
    try {
      await api.logAction('brief', `Printed "${b.title}" (${pct(b.odds)}, ${STATUS[b.status].label}).`, [b.missionId]);
    } catch {
      /* printing must still work if logging fails */
    }
    setPrinting(false);
    window.print();
  }

  return (
    <div className="mx-auto max-w-[120rem] space-y-5 px-8 pb-10 pt-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-[2.2rem] font-bold leading-tight tracking-tight">Readiness Brief</h1>
          <p className="mt-1 text-lg text-ink-muted">Generated from the current picture. Every statement cites its source record.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {missions.length > 0 && <MissionTabs missions={missions} value={missionId} onChange={(id) => setFocus(id)} />}
          <button className="btn-accent px-5 py-3 text-base" disabled={!briefQ.data || printing} onClick={() => briefQ.data && print(briefQ.data)}>
            <Printer className="h-5 w-5" aria-hidden /> Print
          </button>
        </div>
      </div>

      {briefQ.loading && (
        <div className="glass mx-auto max-w-5xl space-y-4 p-10">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-24 w-full" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
      {briefQ.error != null && !briefQ.data && <ErrorState error={briefQ.error} onRetry={briefQ.reload} className="glass" />}
      {briefQ.data && briefQ.data.sections.length === 0 && (
        <EmptyState icon={FileText} title="Nothing to brief" className="glass">
          No data is available for this mission yet.
        </EmptyState>
      )}
      {briefQ.data && briefQ.data.sections.length > 0 && <BriefDoc brief={briefQ.data} missionCode={missions.find((m) => m.id === missionId)?.code} />}
    </div>
  );
}

// ---------------------------------------------------------------- parsing
// The backend writes the brief as structured plain text (headings in capitals, "- " bullets, indented
// continuation lines, [n] citations). This page only re-lays it out; the wording stays the backend's.

interface Item {
  text: string;
  notes: string[];
}
interface Section {
  key: string;
  heading: string;
  items: Item[];
}
interface Parsed {
  asOf: string | null;
  disclaimer: string[];
  sections: Section[];
}

function parseBrief(text: string): Parsed {
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').filter((l) => l.trim()))
    .filter((b) => b.length);
  const banner = (l: string) => /^SYNTHETIC\b/.test(l.trim());
  const first = blocks.shift() ?? [];
  const pre = first.filter((l) => !banner(l) && !/^READINESS BRIEF\b/.test(l.trim()));
  const asOf = pre.find((l) => /^As of\b/.test(l)) ?? null;
  const disclaimer = pre.filter((l) => l !== asOf);
  const sections: Section[] = [];
  for (const b of blocks) {
    if (b.every(banner)) continue;
    const isBullet = (l: string) => /^\s*- /.test(l);
    const heading = isBullet(b[0]) ? '' : b[0].trim();
    const key = heading.replace(/\s*\(.*\)$/, '').toUpperCase();
    if (key === 'SOURCES') continue; // rendered from the structured citation list below
    const items: Item[] = [];
    for (const line of heading ? b.slice(1) : b) {
      if (isBullet(line)) items.push({ text: line.replace(/^\s*- /, '').trim(), notes: [] });
      else if (/^\s{2,}/.test(line) && items.length) items[items.length - 1].notes.push(line.trim());
      else items.push({ text: line.trim(), notes: [] });
    }
    sections.push({ key, heading: heading || 'Notes', items });
  }
  return { asOf, disclaimer, sections };
}

const COLOR_STATUS: Record<string, Status> = { GREEN: 'ready', YELLOW: 'watch', RED: 'risk' };
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

// ---------------------------------------------------------------- document

function BriefDoc({ brief, missionCode }: { brief: BriefT; missionCode?: string }) {
  const meta = STATUS[brief.status];
  const generated = new Date(brief.generatedAt);
  const raw = brief.sections.flatMap((s) => s.paragraphs.map((p) => p.text)).join('\n\n');
  const doc = parseBrief(raw);
  const [flash, setFlash] = useState<number | null>(null);

  /** Text with [n] citation markers turned into chips that jump to the source list. */
  const Cited = ({ text, className }: { text: string; className?: string }) => {
    const parts = text.split(/(\[\d+\])/g).filter(Boolean);
    return (
      <span className={className}>
        {parts.map((part, i) => {
          const m = /^\[(\d+)\]$/.exec(part);
          if (!m) return <span key={i}>{part}</span>;
          const n = Number(m[1]);
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                document.getElementById(`cite-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setFlash(n);
                window.setTimeout(() => setFlash((f) => (f === n ? null : f)), 1800);
              }}
              title={brief.citations[n - 1] ? `${brief.citations[n - 1].system}: ${brief.citations[n - 1].title}` : `Source ${n}`}
              className="num mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-md border border-accent/40 bg-accent/10 px-1 align-[0.12em] text-[0.68rem] font-bold text-accent transition hover:bg-accent/20 print:border-black/40 print:bg-transparent print:text-black"
            >
              {n}
            </button>
          );
        })}
      </span>
    );
  };

  return (
    <motion.article
      key={brief.generatedAt + brief.missionId}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass mx-auto max-w-5xl overflow-hidden print:max-w-none print:rounded-none print:border-0 print:bg-white print:text-black print:shadow-none print:backdrop-blur-none"
    >
      <Classification text={brief.classification} />
      <div className="px-10 pb-10 pt-8 print:px-0 print:pt-4">
        {/* masthead */}
        <header className="flex flex-wrap items-start justify-between gap-6 md:flex-nowrap">
          <div className="min-w-0 flex-1">
            <div className="label-caps print:text-black/60">{brief.unit} · Commanding Officer's readiness brief</div>
            <h2 className="mt-1.5 text-[2.1rem] font-bold leading-tight tracking-tight text-ink print:text-black">{brief.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted print:text-black/70">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" aria-hidden />
                {doc.asOf ? doc.asOf.replace(/\.\s*Read-only; the captain decides\.?$/, '') : `Generated ${generated.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Info className="h-4 w-4" aria-hidden /> Read-only. The captain decides.
              </span>
            </div>
          </div>
          <div className={clsx('min-w-[11rem] shrink-0 rounded-2xl border px-5 py-4 text-right', meta.border, meta.bg, 'print:border-black/30 print:bg-transparent')}>
            <StatusBadge status={brief.status} size="lg" />
            <div className={clsx('num mt-2 text-5xl font-bold leading-none', meta.text, 'print:text-black')}>{pct(brief.odds)}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-ink-dim print:text-black/60">odds mission capable</div>
          </div>
        </header>

        {/* bottom line up front */}
        <section className={clsx('mt-7 flex gap-4 rounded-2xl border-l-4 px-6 py-5', meta.bg, 'print:bg-transparent')} style={{ borderLeftColor: meta.hex }}>
          <Target className={clsx('mt-1 h-6 w-6 shrink-0', meta.text, 'print:text-black')} aria-hidden />
          <div>
            <div className="label-caps print:text-black/60">Bottom line up front</div>
            <p className="mt-1 text-xl font-semibold leading-snug text-ink print:text-black">{brief.bottomLine}</p>
          </div>
        </section>

        {doc.sections.map((s) => (
          <Block key={s.heading} section={s}>
            {s.key === 'BOTTOM LINE' ? (
              <Outlook items={s.items} Cited={Cited} highlight={missionCode} />
            ) : s.key === 'NEXT DOMINO' ? (
              <Dominoes items={s.items} Cited={Cited} />
            ) : s.key === 'RANKED FIXES' ? (
              <Fixes items={s.items} Cited={Cited} />
            ) : s.key === 'DATA WARNINGS' ? (
              <Warnings items={s.items} Cited={Cited} />
            ) : (
              <Bullets items={s.items} Cited={Cited} />
            )}
          </Block>
        ))}

        {doc.disclaimer.length > 0 && (
          <p className="mt-8 flex gap-2 rounded-xl border border-line px-4 py-3 text-sm text-ink-muted print:border-black/20 print:text-black/70">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{doc.disclaimer.join(' ')}</span>
          </p>
        )}

        {/* sources */}
        <section className="mt-9 border-t border-line pt-6 print:border-black/30">
          <SectionTitle icon={ScrollText}>Sources ({brief.citations.length})</SectionTitle>
          <ol className="mt-3 grid gap-2 md:grid-cols-2 print:grid-cols-1">
            {brief.citations.map((c, i) => (
              <li
                key={c.id}
                id={`cite-${i + 1}`}
                className={clsx(
                  'flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-500 print:border-black/20',
                  flash === i + 1 ? 'border-accent bg-accent/10' : 'border-line',
                )}
              >
                <span className="num grid h-6 min-w-[1.5rem] shrink-0 place-items-center rounded-md bg-accent/10 px-1 text-xs font-bold text-accent print:bg-transparent print:text-black">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-ink print:text-black">
                    {c.system}: {c.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="print:hidden">
                      <RecordId id={c.id} />
                    </span>
                    <span className="hidden font-mono text-xs print:inline">{c.id}</span>
                    {c.stale ? (
                      <span className="print:hidden">
                        <StaleBadge hours={c.ageHours} compact />
                      </span>
                    ) : (
                      <span className="num text-xs text-ink-dim print:hidden">{fmtAge(c.ageHours)}</span>
                    )}
                    <span className="hidden text-xs print:inline">({fmtAge(c.ageHours)}{c.stale ? ', STALE' : ''})</span>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <Classification text={brief.classification} />
    </motion.article>
  );
}

type CitedT = (p: { text: string; className?: string }) => ReactNode;

const ICONS: Record<string, typeof Target> = { 'BOTTOM LINE': ListChecks, 'NEXT DOMINO': Crosshair, 'RANKED FIXES': Wrench, 'DATA WARNINGS': AlertTriangle };
const TITLES: Record<string, string> = { 'BOTTOM LINE': 'Mission outlook', 'NEXT DOMINO': 'Next domino', 'RANKED FIXES': 'Ranked fixes', 'DATA WARNINGS': 'Data warnings' };
const BLURBS: Record<string, string> = {
  'BOTTOM LINE': 'Odds across each event window, odds at the start, and whether the plan makes it on stated dates.',
  'NEXT DOMINO': 'The single requirement holding each mission back, and what making it certain would add.',
  'RANKED FIXES': 'For decision. Nothing changes until approved on the Fixes tab.',
  'DATA WARNINGS': 'Records that disagree, are missing, or are out of date. Check these before relying on the numbers.',
};

function SectionTitle({ icon: Icon, children }: { icon: typeof Target; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2.5 text-[1.05rem] font-bold uppercase tracking-[0.12em] text-ink print:text-black">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent print:bg-transparent print:text-black">
        <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
      </span>
      {children}
    </h3>
  );
}

function Block({ section, children }: { section: Section; children: ReactNode }) {
  const title = TITLES[section.key] ?? titleCase(section.heading);
  return (
    <section className="mt-9 break-inside-avoid">
      <SectionTitle icon={ICONS[section.key] ?? FileText}>{title}</SectionTitle>
      {BLURBS[section.key] && <p className="ml-[2.65rem] mt-1 text-sm text-ink-muted print:text-black/70">{BLURBS[section.key]}</p>}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

/** "TIDEWATCH (Group Sail..., 161200Z NOV 26): YELLOW, 78% across interval; 90% at start. Planned ...: MAKE, 12.2 days margin. [1][2]" */
function Outlook({ items, Cited, highlight }: { items: Item[]; Cited: CitedT; highlight?: string }) {
  const re = /^(.*?) \((.*)\): ([A-Z]+), (\d+)% across interval; (\d+)% at start\.\s*Planned across the event window \(on stated ETAs\): ([A-Z]+)(?:, ([\d.]+) days margin)?\.?\s*(.*)$/;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((it, i) => {
        const m = re.exec(it.text);
        if (!m) return <Bullets key={i} items={[it]} Cited={Cited} />;
        const [, name, desc, color, across, start, plan, margin, rest] = m;
        const st = COLOR_STATUS[color] ?? oddsStatus(Number(across) / 100);
        const sm = STATUS[st];
        const Icon = sm.icon;
        const descParts = desc.split(/,\s*(?=\d{6}Z)/);
        const makes = plan === 'MAKE';
        const focus = !!highlight && name.toUpperCase().includes(highlight.toUpperCase());
        return (
          <div key={i} className={clsx('relative overflow-hidden rounded-2xl border p-4 print:border-black/30', focus ? `${sm.border} shadow-[0_0_0_2px_rgba(34,211,238,0.25)]` : 'border-line')}>
            <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: sm.hex }} aria-hidden />
            <div className="flex items-start justify-between gap-3 pl-1.5">
              <div className="min-w-0">
                <div className="text-lg font-bold leading-tight text-ink print:text-black">{name}</div>
                <div className="mt-0.5 text-sm leading-snug text-ink-muted print:text-black/70">{descParts[0]}</div>
                {descParts[1] && <div className="num mt-0.5 text-xs text-ink-dim print:text-black/60">{descParts[1]}</div>}
              </div>
              <span className={clsx('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold', sm.text, sm.border)}>
                <Icon className="h-3.5 w-3.5" aria-hidden /> {sm.label}
              </span>
            </div>
            <div className="mt-3 flex items-end gap-5 pl-1.5">
              <div>
                <div className={clsx('num text-[2.4rem] font-bold leading-none', sm.text, 'print:text-black')}>{across}%</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-dim">across the event</div>
              </div>
              <div>
                <div className="num text-xl font-bold leading-none text-ink-muted print:text-black">{start}%</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-dim">at start</div>
              </div>
              <div className="ml-auto text-right">
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold',
                    makes ? 'bg-ready-soft text-ready' : 'bg-risk-soft text-risk',
                    'print:border print:border-black/30 print:bg-transparent print:text-black',
                  )}
                >
                  Plan: {makes ? 'makes it' : titleCase(plan)}
                </span>
                {margin && <div className="num mt-1 text-xs text-ink-muted print:text-black/70">{margin} days margin</div>}
              </div>
            </div>
            {(rest || it.notes.length > 0) && (
              <div className="mt-3 border-t border-line pl-1.5 pt-2 text-xs leading-snug text-ink-dim print:border-black/20 print:text-black/60">
                {rest && <Cited text={rest} className="mr-1" />}
                {it.notes.map((n, j) => (
                  <Cited key={j} text={n} className="block" />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** "TIDEWATCH: CIC air defense team trainer current (P ok 91%; making it certain adds 7 pts). [5]" */
function Dominoes({ items, Cited }: { items: Item[]; Cited: CitedT }) {
  const re = /^(.*?): (.*) \(P ok (\d+)%; making it certain adds (\d+) pts\)\.?\s*(.*)$/;
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => {
        const m = re.exec(it.text);
        if (!m) return <Bullets key={i} items={[it]} Cited={Cited} />;
        const [, mission, req, pok, gain, rest] = m;
        const p = Number(pok) / 100;
        const sm = STATUS[oddsStatus(p)];
        return (
          <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line px-4 py-3 print:border-black/30">
            <span className="rounded-md bg-ink/[0.06] px-2 py-1 text-xs font-bold uppercase tracking-wider text-ink-muted print:bg-transparent print:text-black">{mission}</span>
            <span className="min-w-[12rem] flex-1 text-[0.98rem] font-medium text-ink print:text-black">
              {req}
              {rest && <Cited text={' ' + rest} />}
            </span>
            <span className="flex items-center gap-2">
              <span className="relative h-2 w-20 overflow-hidden rounded-full bg-ink/[0.08]" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p * 100}%`, background: sm.hex }} />
              </span>
              <span className="num text-sm font-semibold text-ink-muted print:text-black">{pok}% met</span>
            </span>
            <span className="num rounded-lg bg-ready-soft px-2 py-1 text-sm font-bold text-ready print:bg-transparent print:text-black">+{gain} pts if fixed</span>
          </li>
        );
      })}
    </ul>
  );
}

/** "#1 Pull NIIN ... (SYNTH). SEASHIELD 40%->59%. Donor: no donor cost." */
function Fixes({ items, Cited }: { items: Item[]; Cited: CitedT }) {
  const re = /^#(\d+) (.*?)\.\s+(\S[^.]*?) (\d+)%->(\d+)%\.\s*(?:Donor: (.*?)\.(?=\s|$))?\s*(.*)$/;
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => {
        const m = re.exec(it.text);
        if (!m) return <Bullets key={i} items={[it]} Cited={Cited} />;
        const [, rank, title, mission, from, to, donor, rest] = m;
        const after = STATUS[oddsStatus(Number(to) / 100)];
        const noCost = !donor || /^no donor cost$/i.test(donor.trim());
        const costs = !!donor && /-\d/.test(donor);
        return (
          <li key={i} className={clsx('flex gap-4 rounded-xl border px-4 py-3 print:border-black/30', rank === '1' ? 'border-accent/50 bg-accent/[0.04]' : 'border-line')}>
            <span
              className={clsx(
                'num grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-base font-extrabold',
                rank === '1' ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-ink-muted',
                'print:border-black/40 print:bg-transparent print:text-black',
              )}
            >
              {rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-snug text-ink print:text-black">{title}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="num inline-flex items-center gap-1.5 font-semibold text-ink-muted print:text-black">
                  {mission} {from}% <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  <span className={clsx('font-bold', after.text, 'print:text-black')}>{to}%</span>
                </span>
                <span className={clsx('text-xs', costs ? 'font-semibold text-watch' : 'text-ink-dim', 'print:text-black/70')}>
                  {noCost ? 'No cost to other units' : costs ? `Cost to other units: ${donor}` : `Effect on other units: ${donor}`}
                </span>
                {rest && <Cited text={rest} className="text-xs text-ink-dim" />}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** "X7: Lost PMS on CIWS-MT with no 2-Kilo. [8]" */
function Warnings({ items, Cited }: { items: Item[]; Cited: CitedT }) {
  return (
    <ul className="divide-y divide-watch/20 overflow-hidden rounded-xl border border-watch/40 bg-[rgba(251,191,36,0.05)] print:divide-black/10 print:border-black/30 print:bg-transparent">
      {items.map((it, i) => {
        const m = /^([A-Z]\d+): (.*)$/.exec(it.text);
        return (
          <li key={i} className="flex items-start gap-3 px-4 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-watch print:text-black" aria-hidden />
            {m && <span className="num shrink-0 rounded-md border border-watch/40 px-1.5 py-0.5 text-[11px] font-bold text-watch print:border-black/30 print:text-black">{m[1]}</span>}
            <Cited text={m ? m[2] : it.text} className="text-[0.95rem] text-ink print:text-black" />
          </li>
        );
      })}
    </ul>
  );
}

function Bullets({ items, Cited }: { items: Item[]; Cited: CitedT }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[1.02rem] leading-relaxed text-ink print:text-black">
          <span className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent print:bg-black" aria-hidden />
          <span>
            <Cited text={it.text} />
            {it.notes.map((n, j) => (
              <Cited key={j} text={n} className="block text-sm text-ink-muted" />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Classification({ text }: { text: string }) {
  return (
    <div className="bg-ready/80 py-1.5 text-center text-xs font-extrabold tracking-[0.3em] text-abyss-950 print:border-y print:border-black print:bg-white print:text-black">
      {text}
    </div>
  );
}
