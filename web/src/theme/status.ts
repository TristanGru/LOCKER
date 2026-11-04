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
  risk: {
    label: 'At risk',
    icon: CircleX,
    hex: '#fb4d5d',
    text: 'text-risk',
    bg: 'bg-risk-soft',
    border: 'border-risk/60',
    ring: 'shadow-risk',
  },
  watch: {
    label: 'Watch',
    icon: CircleAlert,
    hex: '#fbbf24',
    text: 'text-watch',
    bg: 'bg-watch-soft',
    border: 'border-watch/55',
    ring: '',
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    hex: '#34d399',
    text: 'text-ready',
    bg: 'bg-ready-soft',
    border: 'border-ready/40',
    ring: '',
  },
};

export const STATUS_ORDER: Status[] = ['risk', 'watch', 'ready'];

export function fmtAge(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min old`;
  if (hours < 48) return `${Math.round(hours)} h old`;
  return `${Math.round(hours / 24)} d old`;
}

export const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Mission status for an odds value (same thresholds as the engine: Ready >= 82%, Watch >= 50%). */
export function oddsStatus(odds: number): Status {
  const whole = Math.round(odds * 100);
  return whole >= 82 ? 'ready' : whole >= 50 ? 'watch' : 'risk';
}
