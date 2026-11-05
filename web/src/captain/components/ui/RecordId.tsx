import { FileSearch } from 'lucide-react';
import clsx from '../../lib/clsx';
import { useStore } from '../../state/store';

/** Short label for a source id. The id itself is an encoded record pointer and is too long to show. */
export function sourceLabel(id: string) {
  if (!id.startsWith('src:')) return id;
  try {
    const ref = JSON.parse(decodeURIComponent(id.slice(4))) as { file?: string; key?: string; loc?: string };
    return ref.key || ref.loc || ref.file?.split('/').pop() || 'Source';
  } catch {
    return 'Source';
  }
}

/** Clickable source-record chip. Opens the record in the detail panel. */
export function RecordId({ id, className }: { id: string; className?: string }) {
  const { openRecord } = useStore();
  const label = sourceLabel(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openRecord(id);
      }}
      className={clsx(
        'inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-accent/30 bg-accent/[0.07] px-1.5 py-0.5 font-mono text-[0.78rem] text-accent transition hover:border-accent/70 hover:bg-accent/15',
        className,
      )}
      title={`Open source record ${label}`}
      aria-label={`Open source record ${label}`}
    >
      <FileSearch className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}
