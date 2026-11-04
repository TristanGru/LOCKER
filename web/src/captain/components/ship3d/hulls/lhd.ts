import type { BuildCtx } from '../types';
import { buildFlat } from './flat';

const hw = (x: number) => (x < -100 ? 12 + 0.14 * (x + 128) * 0.5 : x <= 80 ? 16 : 16 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 80) / 49, 2))));
const deck: [number, number][] = [
  [129, 0],
  [122, -6],
  [95, -16.5],
  [-128, -16.5],
  [-128, 16.5],
  [95, 16.5],
  [122, 6],
];

/** Amphibious assault ship, 257 m x 34 m: straight flight deck, well deck at the stern, island. */
export const buildLHD = (ctx: BuildCtx) => buildFlat({ cls: 'LHD', HH: 18, x0: -128, x1: 129, bowX: 80, hw, deck, beam: 34 }, ctx);
