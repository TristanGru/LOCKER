import { GitCompareArrows } from 'lucide-react';
import type { Contradiction } from '../../api/types';
import { RecordId } from '../ui/RecordId';

export function ContradictionCard({ c }: { c: Contradiction }) {
  return (
    <div className="rounded-xl border border-watch/45 bg-[rgba(251,191,36,0.06)] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-watch">
        <GitCompareArrows className="h-4 w-4" aria-hidden /> Sources disagree: {c.field}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <Side value={c.a.value} recordId={c.a.recordId} />
        <span className="self-center text-xs font-bold uppercase text-ink-muted">vs</span>
        <Side value={c.b.value} recordId={c.b.recordId} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{c.note}</p>
    </div>
  );
}

function Side({ value, recordId }: { value: string; recordId: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-abyss-900/70 p-3">
      <span className="text-sm font-semibold text-ink">"{value}"</span>
      <RecordId id={recordId} className="self-start" />
    </div>
  );
}
