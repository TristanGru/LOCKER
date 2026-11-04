import type { BuildCtx } from '../types';
import { buildSurf } from './surface';

/** Cruiser, 173 m x 16.8 m: two guns, two VLS, Harpoon canisters, two funnels. */
export const buildCG = (ctx: BuildCtx) => buildSurf({ cls: 'CG', L: 173, B: 16.8, HH: 11 }, ctx);
