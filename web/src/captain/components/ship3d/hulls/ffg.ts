import type { BuildCtx } from '../types';
import { buildSurf } from './surface';

/** Frigate, 151 m x 19.8 m: 32-cell VLS, 57 mm gun, enclosed mast. */
export const buildFFG = (ctx: BuildCtx) => buildSurf({ cls: 'FFG', L: 151, B: 19.8, HH: 10.5, bowU: 0.66 }, ctx);
