import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { CheckCircle2, ChevronsDown } from 'lucide-react';
import { memo } from 'react';
import clsx from '../../lib/clsx';
import { NODE_SIZE } from './layout';

export interface SummaryData extends Record<string, unknown> {
  labels: string[];
  noun: string;
  size: 'summary' | 'fold';
  dimmed: boolean;
}
export type SummaryNode = Node<SummaryData, 'summary'>;

const handleStyle = { opacity: 0, width: 8, height: 8, border: 'none' };

/** Healthy items folded into one card. Clicking it shows every item. */
export const SummaryCard = memo(function SummaryCard({ data }: NodeProps<SummaryNode>) {
  const { w, h } = NODE_SIZE[data.size];
  const big = data.size === 'summary';
  return (
    <div style={{ width: w, height: h }} className={clsx('relative transition-opacity duration-300', data.dimmed && 'opacity-30')}>
      <Handle type="target" position={Position.Left} style={handleStyle} isConnectable={false} />
      <div className="flex h-full flex-col rounded-2xl border border-dashed border-ready/40 bg-abyss-800/60 px-4 py-2.5 backdrop-blur-md transition hover:border-ready/70 hover:bg-abyss-800/90 [&>*]:shrink-0">
        <div className="flex items-center gap-2 text-ready">
          <CheckCircle2 className={big ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden />
          <span className={clsx('font-bold', big ? 'text-lg' : 'text-base')}>
            <span className="num">{data.labels.length}</span> {data.noun} Ready
          </span>
        </div>
        <p className={clsx('mt-1 overflow-hidden text-[0.8rem] leading-[1.1rem] text-ink-muted', big ? 'line-clamp-2' : 'line-clamp-1')}>{data.labels.join(' · ')}</p>
        <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-accent">
          <ChevronsDown className="h-3.5 w-3.5" aria-hidden /> Click to show every item
        </span>
      </div>
    </div>
  );
});
