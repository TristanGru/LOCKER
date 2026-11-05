import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import type { DaveyProposedNode } from '../../api/types';
import clsx from '../../lib/clsx';
import { NODE_SIZE } from './layout';

interface ProposedData extends Record<string, unknown> {
  proposal: DaveyProposedNode;
  selected: boolean;
  dimmed: boolean;
  reviewed: boolean;
}

export type ProposedCardNode = Node<ProposedData, 'proposed'>;

const hiddenHandle={opacity:0,width:8,height:8,border:'none'};

export function ProposedNodeCard({data}:NodeProps<ProposedCardNode>) {
  const {proposal,selected,dimmed,reviewed}=data;
  const {w,h}=NODE_SIZE.proposed;
  return <div style={{width:w,height:h,opacity:dimmed?0.3:1}} className={clsx('relative rounded-2xl border-2 border-dashed bg-abyss-800 p-4 shadow-lg',selected?'border-accent shadow-focus':'border-accent/70')}>
    <Handle type="target" position={Position.Left} style={hiddenHandle} isConnectable={false}/>
    <Handle type="source" position={Position.Right} style={hiddenHandle} isConnectable={false}/>
    <p className="flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-accent"><Sparkles className="h-3.5 w-3.5" aria-hidden/> AI-proposed {reviewed?'· Reviewed':''}</p>
    <h3 className="mt-2 truncate text-base font-bold text-ink" title={proposal.label}>{proposal.label}</h3>
    <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">{proposal.why}</p>
    <p className="absolute bottom-3 right-4 text-[0.65rem] font-semibold text-watch">Needs verification</p>
  </div>;
}
