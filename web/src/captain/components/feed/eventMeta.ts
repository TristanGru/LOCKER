import { Building2, CalendarClock, Siren, Truck, UsersRound, type LucideIcon } from 'lucide-react';
import type { DemoEvent } from '../../api/types';

export const EVENT_META: Record<DemoEvent['type'], { label: string; icon: LucideIcon; source: string }> = {
  CASREP: { label: 'CASREP', icon: Siren, source: 'Casualty report' },
  SUPPLY: { label: 'Supply', icon: Truck, source: 'Supply system' },
  PERSONNEL: { label: 'Personnel', icon: UsersRound, source: 'Personnel system' },
  SCHEDULE: { label: 'Schedule', icon: CalendarClock, source: 'Ops schedule' },
  FACILITY: { label: 'Facility', icon: Building2, source: 'Facility work order' },
};
