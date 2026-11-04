import type { BuildCtx } from '../types';
import { buildSub } from './sub';

/** Guided-missile submarine, 170 m x 12.8 m: converted hull, 22 cruise-missile tubes, lock-out hatches, dry deck shelter. */
export const buildSSGN = (ctx: BuildCtx) =>
  buildSub(
    { cls: 'SSGN', L: 170, Dm: 12.8, sailU: 0.3, sailH: 7.6, sailL: 12, sailPlanes: true, tubes: { cols: 12, rows: 2, u0: 0.4 }, lock: true, dds: true },
    ctx,
  );
