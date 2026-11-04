import { Cog, Flag, Package, UserRound, type LucideIcon } from 'lucide-react';
import type { NodeKind } from '../../api/types';

export const KIND_META: Record<NodeKind, { label: string; icon: LucideIcon }> = {
  mission: { label: 'Mission', icon: Flag },
  equipment: { label: 'Equipment', icon: Cog },
  part: { label: 'Part', icon: Package },
  person: { label: 'Sailor', icon: UserRound },
};
