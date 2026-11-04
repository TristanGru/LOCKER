import type { BuildCtx } from '../types';
import { buildSurf } from './surface';

/** Littoral combat ship, 127 m x 31 m trimaran: aft flight deck, mission bay, waterjets. */
export const buildLCS = (ctx: BuildCtx) => buildSurf({ cls: 'LCS', L: 127, mainB: 6.5, B: 31, out: 10.5, tri: true, HH: 7.5, bowU: 0.85 }, ctx);
