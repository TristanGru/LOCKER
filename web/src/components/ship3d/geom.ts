import * as THREE from 'three';
import type { Mount, Side } from './types';

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function add(g: THREE.Object3D, name: string, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) {
  const o = new THREE.Mesh(geo, m);
  o.name = name;
  o.position.set(x, y, z);
  g.add(o);
  return o;
}

export const bx = (g: THREE.Object3D, n: string, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) =>
  add(g, n, new THREE.BoxGeometry(w, h, d), m, x, y, z);

export const cyl = (g: THREE.Object3D, n: string, m: THREE.Material, r0: number, r1: number, h: number, x: number, y: number, z: number, seg = 24) =>
  add(g, n, new THREE.CylinderGeometry(r0, r1, h, seg), m, x, y, z);

/** A flat strip on deck from (x1,z1) to (x2,z2). */
export function strip(g: THREE.Object3D, n: string, m: THREE.Material, x1: number, z1: number, x2: number, z2: number, w: number, y: number, h = 0.03) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const o = bx(g, n, m, len, h, w, (x1 + x2) / 2, y, (z1 + z2) / 2);
  o.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  return o;
}

/** Extruded deck-plan polygon ([x, z] points) of the given depth, sitting at height y. */
export function plate(g: THREE.Object3D, n: string, m: THREE.Material, pts: [number, number][], depth: number, y: number) {
  const s = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  const gg = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  gg.rotateX(-Math.PI / 2);
  return add(g, n, gg, m, 0, y, 0);
}

/** Chamfered rectangular block (deckhouse tiers). */
export const chamf = (g: THREE.Object3D, n: string, m: THREE.Material, x0: number, z0: number, x1: number, z1: number, c: number, h: number, y: number) =>
  plate(
    g,
    n,
    m,
    [
      [x0 + c, z0],
      [x1 - c, z0],
      [x1, z0 + c],
      [x1, z1 - c],
      [x1 - c, z1],
      [x0 + c, z1],
      [x0, z1 - c],
      [x0, z0 + c],
    ],
    h,
    y,
  );

/** A mount: pin at (x,y,z), label side, stem base height (defaults to 3 m under the pin). */
export const mk = (x: number, y: number, z: number, side: Side = 'up', base?: number): Mount => ({ p: V(x, y, z), side, base: base ?? y - 3 });

/** Small seeded RNG (mulberry32) so procedural detail is the same on every load. */
export function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple jet on a flight deck. */
export function jet(g: THREE.Object3D, M: { heli: THREE.Material; glass: THREE.Material }, x: number, y: number, z: number, rot: number, n: string) {
  const j = new THREE.Group();
  j.name = n;
  const f = add(j, 'fuselage', new THREE.CapsuleGeometry(0.8, 6.5, 4, 12), M.heli, 0, 0.9, 0);
  f.rotation.z = Math.PI / 2;
  bx(j, 'wing', M.heli, 3, 0.12, 9.5, -0.4, 0.8, 0);
  bx(j, 'stabilizer', M.heli, 1.4, 0.1, 4, -3.4, 0.9, 0);
  for (const s of [-1, 1]) bx(j, 'tail_fin', M.heli, 1.6, 1.9, 0.12, -3.3, 1.9, s * 0.9);
  add(j, 'canopy', new THREE.SphereGeometry(0.6, 12, 10), M.glass, 1.4, 1.5, 0).scale.set(1.6, 0.7, 0.8);
  j.position.set(x, y, z);
  j.rotation.y = rot;
  g.add(j);
}

/** Free every geometry and per-object material under a root (shared scene materials are freed separately). */
export function disposeTree(root: THREE.Object3D, keep?: Set<THREE.Material>) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const m of mats) {
      if (keep?.has(m)) continue;
      const map = (m as THREE.MeshStandardMaterial).map;
      if (map) map.dispose();
      m.dispose();
    }
  });
}
