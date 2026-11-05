import { CheckCircle2, CircleAlert, CircleX, type LucideIcon } from 'lucide-react';
import type { Status } from '../api/types';

// Status is never conveyed by color alone: every status has an icon and a label.
// Icons: Ready ✓, Watch !, At risk ✕.
export interface StatusMeta {
  label: string;
  icon: LucideIcon;
  hex: string;
  text: string;
  bg: string;
  border: string;
  ring: string;
}

export const STATUS: Record<Status, StatusMeta> = {
  unknown: {label:'Unknown',icon:CircleAlert,hex:'rgb(var(--ink-dim))',text:'text-ink-muted',bg:'bg-ink/5',border:'border-line',ring:''},
  risk: {
    label: 'At risk',
    icon: CircleX,
    hex: 'rgb(var(--risk))',
    text: 'text-risk',
    bg: 'bg-risk-soft',
    border: 'border-risk/60',
    ring: 'shadow-risk',
  },
  watch: {
    label: 'Watch',
    icon: CircleAlert,
    hex: 'rgb(var(--watch))',
    text: 'text-watch',
    bg: 'bg-watch-soft',
    border: 'border-watch/55',
    ring: '',
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    hex: 'rgb(var(--ready))',
    text: 'text-ready',
    bg: 'bg-ready-soft',
    border: 'border-ready/40',
    ring: '',
  },
};

export const STATUS_ORDER: Status[] = ['unknown', 'risk', 'watch', 'ready'];

export function fmtAge(hours: number): string {
  if (!Number.isFinite(hours)) return 'Freshness unknown';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min old`;
  if (hours < 48) return `${Math.round(hours)} h old`;
  return `${Math.round(hours / 24)} d old`;
}

export const pct = (p: number) => Number.isFinite(p) ? `${Math.round(p * 100)}%` : 'Unknown';
let bands = {green:.8, yellow:.6};
export const getBands = () => bands;
export function configureBands(value: typeof bands) { bands = value; }

/** Mission status for an odds value (same thresholds as the engine: Ready >= 82%, Watch >= 50%). */
export function oddsStatus(odds: number): Status {
  return !Number.isFinite(odds) ? 'unknown' : odds >= bands.green ? 'ready' : odds >= bands.yellow ? 'watch' : 'risk';
}
