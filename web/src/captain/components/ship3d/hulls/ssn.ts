import type { BuildCtx } from '../types';
import { buildSub } from './sub';

/** Attack submarine, 115 m x 10.3 m: sail, bow planes, payload tubes, pump-jet. */
export const buildSSN = (ctx: BuildCtx) => buildSub({ cls: 'SSN', L: 115, Dm: 10.3, sailU: 0.42, sailH: 6.8, sailL: 11, vpt: true }, ctx);
