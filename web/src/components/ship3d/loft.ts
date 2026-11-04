import * as THREE from 'three';
import { add } from './geom';
import type { BuildCtx, HullLoft } from './types';

/** One profile point: height y and the fraction of the half-width at that height. */
export interface ProfilePt {
  y: number;
  wf: number;
}

/**
 * Loft a hull band: for each station along x, a ring of profile points mirrored port/starboard,
 * scaled by the width function hw(x). The bow rakes forward with height.
 */
export function loft(g: THREE.Object3D, name: string, prof: ProfilePt[], m: THREE.Material, c: HullLoft) {
  const keel = prof[prof.length - 1].wf === 0;
  const R = keel ? prof.length * 2 - 1 : prof.length * 2;
  const pos: number[] = [];
  const idx: number[] = [];
  const N = 90;
  const xs: number[] = [];
  for (let i = 0; i <= N; i++) xs.push(c.x0 + ((c.x1 - c.x0) * i) / N);
  for (const x of xs) {
    const ring: [ProfilePt, number][] = prof.map((p) => [p, -1]);
    for (let k = prof.length - 1; k >= (keel ? 1 : 0); k--) ring.push([prof[k], 1]);
    for (const [p, s] of ring) {
      const f = p.y / c.HH;
      const xr = x > c.bowX ? c.bowX + (x - c.bowX) * (0.82 + 0.18 * f) : x;
      pos.push(xr, p.y, (c.zOff || 0) + s * c.hw(x) * p.wf);
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < R - 1; j++) {
      const a = i * R + j;
      const b = (i + 1) * R + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  // transom cap
  const cc = pos.length / 3;
  pos.push(c.x0, c.HH / 2, c.zOff || 0);
  for (let j = 0; j < R - 1; j++) idx.push(cc, j, j + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return add(g, name, geo, m, 0, 0, 0);
}

/** Section profile of a surface hull, scaled to hull height HH (topsides, boot stripe, underwater body). */
export const hullProfile = (HH: number, flare = 1.04): [number, number][] => {
  const k = HH / 10;
  return [
    [10 * k, flare],
    [8 * k, 1],
    [5.7 * k, 0.935],
    [5 * k, 0.92],
    [3.6 * k, 0.84],
    [2.2 * k, 0.66],
    [1 * k, 0.36],
    [0, 0],
  ];
};

/** Full surface hull: underwater body, boot stripe and topsides. Records the first hull for decals/cuts. */
export function hull(g: THREE.Object3D, c: HullLoft, ctx: BuildCtx) {
  if (!ctx.hc) ctx.hc = c;
  const k = c.HH / 10;
  const s = (a: ProfilePt[]) => a.map((p) => ({ y: p.y * k, wf: p.wf }));
  const { M } = ctx;
  loft(g, 'hull_underwater', s([{ y: 5, wf: 0.92 }, { y: 3.6, wf: 0.84 }, { y: 2.2, wf: 0.66 }, { y: 1, wf: 0.36 }, { y: 0, wf: 0 }]), M.hullLow, c);
  loft(g, 'hull_boot_stripe', s([{ y: 5.7, wf: 0.935 }, { y: 5, wf: 0.92 }]), M.boot, c);
  loft(g, 'hull_topsides', s([{ y: 10, wf: c.flare || 1.04 }, { y: 8, wf: 1.0 }, { y: 5.7, wf: 0.935 }]), M.hullUp, c);
}
