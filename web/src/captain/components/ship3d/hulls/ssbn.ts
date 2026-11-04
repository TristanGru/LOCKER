import type { BuildCtx } from '../types';
import { buildSub } from './sub';

/** Ballistic-missile submarine, 170 m x 12.8 m: 24 missile hatches aft of the sail, sail planes. */
export const buildSSBN = (ctx: BuildCtx) =>
  buildSub({ cls: 'SSBN', L: 170, Dm: 12.8, sailU: 0.3, sailH: 7.6, sailL: 12, sailPlanes: true, tubes: { cols: 12, rows: 2, u0: 0.4 } }, ctx);
