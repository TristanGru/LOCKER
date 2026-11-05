import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { motion, useAnimationControls } from 'framer-motion';
import { Crosshair, GitCompareArrows } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { GraphNode, Status } from '../../api/types';
import clsx from '../../lib/clsx';
import { STATUS } from '../../theme/status';
import { OddsNumber } from '../ui/OddsNumber';
import { StaleBadge } from '../ui/StaleBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { KIND_META } from './kinds';
import { NODE_SIZE } from './layout';

export interface CardData extends Record<string, unknown> {
  node: GraphNode;
  selected: boolean;
  dimmed: boolean;
  /** Shown only to connect a filter match to its mission: drawn faded. */
  context?: boolean;
  /** Seconds to wait before showing a status change (cascade). */
  delay: number;
  missionCodes: Record<string, string>;
  daysOut?: number;
}

export type CardNode = Node<CardData, 'card'>;

const handleStyle = { opacity: 0, width: 8, height: 8, border: 'none' };

/**
 * Shows a change with a "domino tip": the card falls forward and comes back up
 * in its new color. Everything on the card (status, odds, reason, domino tag)
 * lags the data by `delay` seconds, so a cascade ripples part -> equipment -> mission.
 */
function useDominoNode(node: GraphNode, delay: number) {
  const [shown, setShown] = useState(node);
  const controls = useAnimationControls();
  const key = `${node.status}|${node.p.toFixed(4)}|${node.reason}|${node.metric}|${node.nextDominoFor.join(',')}|${node.stale}|${node.contradictionCount}`;
  const lastKey = useRef(key);

  useEffect(() => {
    if (lastKey.current === key) {
      setShown(node);
      return;
    }
    lastKey.current = key;
    const statusChanged = node.status !== shown.status;
    const t = setTimeout(() => {
      setShown(node);
      if (statusChanged) {
        void controls.start({
          rotateX: [0, -68, 0],
          scale: [1, 1.05, 1],
          transition: { duration: 0.75, ease: [0.3, 0.9, 0.3, 1] },
        });
      }
    }, delay * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, node]);

  return { shown, controls };
}

export const NodeCard = memo(function NodeCard({ data }: NodeProps<CardNode>) {
  const { selected, dimmed, context, delay, missionCodes } = data;
  const { shown: node, controls } = useDominoNode(data.node, delay);
  const shown = node.status;
  const meta = STATUS[shown];
  const kind = KIND_META[node.kind];
  const KindIcon = kind.icon;
  const isDomino = node.nextDominoFor.length > 0;
  const { w, h } = NODE_SIZE[node.kind];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: dimmed ? 0.3 : context ? 0.5 : 1, scale: 1 }}
      transition={{ delay: delay, duration: 0.45, ease: [0.22, 1, 0.36, 1], opacity: { delay: dimmed ? 0 : delay, duration: 0.35 } }}
      style={{ width: w, height: h }}
      className="relative"
    >
      <Handle type="target" position={Position.Left} style={handleStyle} isConnectable={false} />
      <Handle type="source" position={Position.Right} style={handleStyle} isConnectable={false} />

      {isDomino && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-4 left-4 z-10 flex items-center gap-1.5 rounded-sm border border-risk bg-risk/15 px-2.5 py-1 text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-risk"
        >
          <Crosshair className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
          Next domino
          <span className="font-mono font-semibold normal-case tracking-normal text-risk/80">
            · {node.nextDominoFor.map((m) => missionCodes[m] ?? m).join(', ')}
          </span>
        </motion.div>
      )}

      <motion.div
        animate={controls}
        style={{ transformPerspective: 700, transformOrigin: '50% 100%' }}
        className={clsx(
          'group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-abyss-800/90 backdrop-blur-md transition-[border-color,box-shadow] duration-500',
          selected ? 'border-accent shadow-focus' : meta.border,
          isDomino && !selected && 'animate-pulseRing border-risk',
          !selected && !isDomino && shown === 'risk' && '',
        )}
      >
        {/* status rail */}
        <div className="absolute inset-y-0 left-0 w-1.5 transition-colors duration-500" style={{ background: meta.hex }} />

        {node.kind === 'mission' ? (
          <MissionBody node={node} status={shown} daysOut={data.daysOut} />
        ) : (
          <div className="flex h-full flex-col pl-5 pr-4 pt-3 pb-3 [&>*]:shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-dim">
                <KindIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {kind.label}
                  {node.kind === 'equipment' && <span className="font-mono normal-case tracking-normal text-ink-muted"> · {node.subtitle.split(' · ')[0]}</span>}
                </span>
                {node.temp && <span className="rounded bg-accent/15 px-1 text-accent">TAD</span>}
              </span>
              <StatusBadge status={shown} size="sm" />
            </div>
            <div className="mt-1.5 truncate text-[1.1rem] font-semibold leading-6 text-ink" title={node.label}>
              {node.label}
            </div>
            <div
              className={clsx('mt-1 overflow-hidden text-[0.82rem] leading-[1.15rem] text-ink-muted', node.kind === 'person' ? 'line-clamp-1' : 'line-clamp-2')}
              title={node.reason}
            >
              {node.reason}
            </div>
            {node.kind !== 'person' && (
              <div className="mt-auto flex items-center gap-2 pt-1.5">
                <span className={clsx('num text-sm font-bold', meta.text)}>{node.metric}</span>
                {node.contradictionCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-watch/50 bg-watch-soft px-1.5 py-0.5 text-[0.68rem] font-semibold text-watch" title="Sources disagree">
                    <GitCompareArrows className="h-3 w-3" aria-hidden /> {node.contradictionCount} conflict
                  </span>
                )}
                {node.stale && <StaleBadge hours={node.dataAgeHours} compact className="ml-auto" />}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
});

function MissionBody({ node, status, daysOut }: { node: GraphNode; status: Status; daysOut?: number }) {
  const meta = STATUS[status];
  return (
    <div className="flex h-full flex-col pl-5 pr-4 pt-3 pb-3 [&>*]:shrink-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-dim">
          <KIND_META.mission.icon className="h-3.5 w-3.5" aria-hidden /> Mission
          {daysOut !== undefined && <span className="num rounded bg-ink/[0.08] px-1.5 py-0.5 text-ink-muted">D+{daysOut}</span>}
        </span>
        <StatusBadge status={status} size="sm" />
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[1.35rem] font-extrabold tracking-wide text-ink">{node.label}</div>
          <div className="truncate text-sm text-ink-muted">{node.subtitle}</div>
        </div>
        <OddsNumber value={node.p} className={clsx('text-[2.6rem] font-bold leading-none', meta.text)} />
      </div>
      <div className="mt-auto truncate border-t border-line pt-2 text-[0.8rem] text-ink-muted" title={node.reason}>
        {node.reason}
      </div>
    </div>
  );
}
