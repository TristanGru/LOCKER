import type { BuildCtx } from '../types';
import { buildFlat } from './flat';

const hw = (x: number) => (x < -140 ? 14 + 0.26 * (x + 165) : x <= 90 ? 20.5 : 20.5 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 90) / 82, 2))));
const deck: [number, number][] = [
  [-160, 30],
  [-20, 30],
  [95, 28],
  [140, 24],
  [168, 8],
  [172, 0],
  [168, -8],
  [140, -24],
  [100, -30],
  [50, -33],
  [-20, -37],
  [-100, -40],
  [-160, -36],
];

/** Carrier, 337 m x 80 m: angled deck, four catapults, four elevators, island, parked aircraft. */
export const buildCVN = (ctx: BuildCtx) => buildFlat({ cls: 'CVN', HH: 24, x0: -165, x1: 172, bowX: 90, hw, deck, beam: 80 }, ctx);
