import { FileSearch } from 'lucide-react';
import clsx from '../../lib/clsx';
import { useStore } from '../../state/store';

/** Clickable source-record ID chip. Opens the record in the detail panel. */
export function RecordId({ id, className }: { id: string; className?: string }) {
  const { openRecord } = useStore();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openRecord(id);
      }}
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/[0.07] px-1.5 py-0.5 font-mono text-[0.78rem] text-accent transition hover:border-accent/70 hover:bg-accent/15',
        className,
      )}
      title={`Open source record ${id}`}
    >
      <FileSearch className="h-3.5 w-3.5" aria-hidden />
      {id}
    </button>
  );
}
