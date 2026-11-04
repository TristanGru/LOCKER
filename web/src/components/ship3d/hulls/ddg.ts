import * as THREE from 'three';
import { add, bx, chamf, cyl, mk, plate, strip, V } from '../geom';
import { hull } from '../loft';
import type { BuildCtx, HullBuild, Mount } from '../types';

/**
 * Destroyer, ~140 m x 27 m. Lofted from the same outline as the sky-view SVG (1000 x 300 drawing,
 * stern left), so the 3D and fallback pins agree. P() maps drawing coords to meters.
 */
export function buildDDG(ctx: BuildCtx): HullBuild {
  const { M } = ctx;
  const g = new THREE.Group();
  g.name = 'DDG';
  const S = 0.15;
  const P = (x: number, y: number): [number, number] => [(x - 500) * S, (y - 150) * S];
  const D = 10.3;

  const bow: [number, number][] = [];
  for (let i = 0; i <= 200; i++) {
    const u = i / 200;
    const a = (1 - u) * (1 - u);
    const b = 2 * u * (1 - u);
    const cc = u * u;
    bow.push([a * 690 + b * 870 + cc * 972, 150 - (a * 60 + b * 68 + cc * 150)]);
  }
  const hwSvg = (x: number) => {
    if (x <= 40) return 72;
    if (x <= 690) return 72 + ((x - 40) / 650) * 18;
    if (x >= 972) return 0;
    for (let i = 1; i < bow.length; i++)
      if (bow[i][0] >= x) {
        const a = bow[i - 1];
        const b = bow[i];
        const k = (x - a[0]) / Math.max(b[0] - a[0], 1e-6);
        return a[1] + (b[1] - a[1]) * k;
      }
    return 0;
  };
  const hw = (x: number) => hwSvg(x / S + 500) * S;
  const c = { x0: -69, x1: 70.8, bowX: 28.5, HH: 10, hw };
  hull(g, c, ctx);

  const pts: [number, number][] = [];
  for (let i = 0; i <= 90; i++) {
    const x = c.x0 + ((c.x1 - c.x0) * i) / 90;
    pts.push([x, hw(x) * 1.04]);
  }
  const poly: [number, number][] = [...pts.map(([x, z]) => [x, -z] as [number, number]), ...pts.slice().reverse()];
  plate(g, 'main_deck', M.deck, poly, 0.3, 10);
  {
    const a: THREE.Vector3[] = [];
    const b: THREE.Vector3[] = [];
    for (let i = 2; i < 88; i++) {
      const [x, z] = pts[i];
      const w = z - 0.3;
      if (w < 1) break;
      a.push(V(x, D + 1.1, -w));
      b.push(V(x, D + 1.1, w));
    }
    add(g, 'deck_railing', new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...a, ...b.reverse()]), 400, 0.07, 4, false), M.light, 0, 0, 0);
  }

  const box = (n: string, m: THREE.Material, x0: number, y0: number, x1: number, y1: number, h: number, base = D) => {
    const [a, c2] = P(x0, y0);
    const [b, d] = P(x1, y1);
    return bx(g, n, m, Math.abs(b - a), h, Math.abs(d - c2), (a + b) / 2, base + h / 2, (c2 + d) / 2);
  };
  const cb = (n: string, m: THREE.Material, x0: number, y0: number, x1: number, y1: number, ch: number, h: number, base: number) => {
    const [a, c2] = P(x0, y0);
    const [b, d] = P(x1, y1);
    return chamf(g, n, m, a, c2, b, d, ch * S, h, base);
  };

  // flight deck + helicopter
  box('helo_deck', M.dark, 52, 92, 212, 208, 0.12, D + 0.3);
  {
    const [x, z] = P(132, 150);
    const r = add(g, 'helo_circle', new THREE.RingGeometry(5.8, 6.5, 48), M.helo, x, D + 0.46, z);
    r.rotation.x = -Math.PI / 2;
    box('helo_bar_x', M.helo, 88, 148.5, 176, 151.5, 0.02, D + 0.44);
    box('helo_bar_z', M.helo, 130.5, 106, 133.5, 194, 0.02, D + 0.44);
    const hg = new THREE.Group();
    hg.name = 'helicopter';
    add(hg, 'fuselage', new THREE.SphereGeometry(1.2, 24, 16), M.heli, 0, 2, 0).scale.set(2.4, 1, 0.95);
    add(hg, 'cockpit', new THREE.SphereGeometry(0.95, 16, 12), M.glass, 1.9, 2.2, 0).scale.set(1, 0.75, 0.9);
    bx(hg, 'tail_boom', M.heli, 5, 0.55, 0.5, -4.2, 2.4, 0);
    bx(hg, 'tail_fin', M.heli, 0.9, 1.6, 0.15, -6.4, 3.1, 0);
    cyl(hg, 'rotor_mast', M.dark, 0.15, 0.15, 0.8, 0, 3.3, 0, 8);
    for (let i = 0; i < 4; i++) {
      const b = bx(hg, 'blade_' + i, M.dark, 4.9, 0.06, 0.35, Math.cos(i * (Math.PI / 2) + 0.5) * 2.5, 3.75, Math.sin(i * (Math.PI / 2) + 0.5) * 2.5);
      b.rotation.y = -(i * (Math.PI / 2) + 0.5);
    }
    for (const [wx, wz] of [
      [1.2, 0],
      [-1.6, -1],
      [-1.6, 1],
    ])
      cyl(hg, 'wheel', M.dark, 0.28, 0.28, 0.2, wx, 0.55, wz, 12).rotation.x = Math.PI / 2;
    hg.position.set(x + 0.5, D + 0.5, z);
    g.add(hg);
  }

  // hangar
  box('hangar', M.house, 214, 98, 288, 202, 6.5);
  box('hangar_roof', M.light, 216, 100, 286, 200, 0.15, D + 6.5);
  {
    const [x, z] = P(214, 150);
    bx(g, 'hangar_door', M.dark, 0.12, 5.2, 11.5, x - 0.04, D + 3, z);
    bx(g, 'hangar_door_stripe', M.helo, 0.14, 0.3, 11.8, x - 0.05, D + 5.8, z);
  }

  // VLS decks
  for (const [n, x] of [
    ['aft_vls', 318],
    ['fwd_vls', 686],
  ] as const) {
    box(n + '_frame', M.dark, x - 4, 114, x + 84, 186, 0.35);
    const cg = new THREE.BoxGeometry(1.15, 0.12, 1.15);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 6; j++) {
        const [px, pz] = P(x + i * 10 + 5, 118 + j * 10 + 5);
        add(g, `${n}_hatch_${i}_${j}`, cg, M.vls, px, D + 0.5, pz);
      }
  }

  // deckhouse and bridge
  cb('deckhouse_lvl1', M.house, 410, 90, 652, 210, 14, 5, D);
  cb('deckhouse_lvl2', M.house, 430, 104, 640, 196, 12, 4, D + 5);
  cb('bridge_block', M.house, 560, 112, 646, 188, 12, 4.2, D + 9);
  box('bridge_roof', M.light, 562, 114, 644, 186, 0.15, D + 13.2);
  {
    const [x, z] = P(646, 150);
    bx(g, 'bridge_windows_front', M.glass, 0.12, 1.1, 9.4, x, D + 11.2, z);
    for (const s of [-1, 1]) {
      const [x2, z2] = P(603, 150 + s * 38);
      bx(g, 'bridge_windows_side', M.glass, 11.6, 1.1, 0.12, x2, D + 11.2, z2);
    }
  }
  {
    const [x, z] = P(475, 150);
    box('funnel_block', M.house, 446, 122, 504, 178, 4.5, D + 9);
    for (const dz of [-1, 1]) {
      cyl(g, 'exhaust_stack', M.dark, 2.1, 2.5, 2.6, x, D + 14.7, z + dz * 2.9);
      cyl(g, 'exhaust_grille', M.vls, 1.5, 1.5, 0.05, x, D + 16.1, z + dz * 2.9, 16);
    }
  }
  // four fixed radar arrays
  for (const [x0, y0, rot, n] of [
    [636, 118, Math.PI / 4, 'fwd_port'],
    [636, 182, -Math.PI / 4, 'fwd_stbd'],
    [574, 118, (3 * Math.PI) / 4, 'aft_port'],
    [574, 182, (-3 * Math.PI) / 4, 'aft_stbd'],
  ] as const) {
    const [x, z] = P(x0, y0);
    add(g, 'array_' + n, new THREE.BoxGeometry(0.5, 4.8, 4.8), M.radar, x, D + 11.6, z).rotation.y = rot;
  }
  // mast
  {
    const [x, z] = P(540, 150);
    const by = D + 13.5;
    cyl(g, 'mast_tower', M.house, 0.9, 1.9, 16, x, by + 8, z, 4).rotation.y = Math.PI / 4;
    bx(g, 'mast_platform_low', M.dark, 5.2, 0.3, 5.2, x, by + 7, z);
    bx(g, 'mast_platform_high', M.dark, 3.6, 0.3, 3.6, x, by + 12, z);
    bx(g, 'yardarm', M.dark, 0.3, 0.3, 9, x, by + 14.5, z);
    bx(g, 'sps_radar_bar', M.light, 0.35, 0.9, 7, x, by + 16.4, z);
    for (const [dx, dz, hh] of [
      [1.4, 1.4, 6],
      [-1.4, 1.4, 5],
      [-1.4, -1.4, 7],
      [1.4, -1.4, 4.5],
    ])
      cyl(g, 'antenna_whip', M.dark, 0.04, 0.06, hh, x + dx, by + 12.2 + hh / 2, z + dz, 6);
    for (const dz of [-1, 1]) cyl(g, 'esm_drum', M.light, 0.7, 0.7, 1, x, by + 13.2, z + dz * 3.8, 16);
  }
  for (const [n, sy] of [
    ['satcom_port', 100],
    ['satcom_stbd', 200],
  ] as const) {
    const [x, z] = P(510, sy);
    cyl(g, n + '_base', M.dark, 1, 1.2, 0.8, x, D + 5.4, z, 16);
    add(g, n, new THREE.SphereGeometry(1.7, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.light, x, D + 5.8, z);
  }
  for (const [n, x0, y0, base] of [
    ['ciws_hangar', 262, 150, D + 6.65],
    ['ciws_aft', 440, 104, D + 9],
  ] as const) {
    const [x, z] = P(x0, y0);
    cyl(g, n + '_pedestal', M.dark, 1, 1.3, 1.4, x, base + 0.7, z, 16);
    add(g, n + '_radome', new THREE.SphereGeometry(1.15, 20, 14), M.light, x, base + 2.1, z);
    add(g, n + '_gun', new THREE.CylinderGeometry(0.18, 0.18, 2.2, 10), M.dark, x + 1.4, base + 1.5, z + 0.8).rotation.z = Math.PI / 2;
  }
  for (const s of [-1, 1]) {
    const [x, z] = P(480, 150 + s * 70);
    const r = add(g, 'rhib', new THREE.CapsuleGeometry(0.95, 4.6, 6, 16), M.orange, x, D + 1.3, z);
    r.rotation.z = Math.PI / 2;
    bx(g, 'rhib_console', M.dark, 1, 0.8, 0.8, x, D + 2.2, z);
    bx(g, 'rhib_cradle', M.dark, 6.4, 0.3, 1.8, x, D + 0.45, z);
  }
  for (const dy of [-24, 24]) {
    const [x, z] = P(800, 150 + dy);
    cyl(g, 'windlass', M.dark, 0.9, 1, 1.2, x, D + 0.9, z, 16);
  }
  for (const [a, b, c2, d] of [
    [790, 110, 806, 150],
    [806, 150, 790, 190],
  ]) {
    const [x1, z1] = P(a, b);
    const [x2, z2] = P(c2, d);
    strip(g, 'breakwater', M.light, x1, z1, x2, z2, 0.15, D + 0.9, 1.2);
  }
  // 5-inch gun
  {
    const [x, z] = P(844, 150);
    cyl(g, 'gun_base', M.dark, 2.7, 2.9, 0.5, x, D + 0.55, z, 28);
    const s = new THREE.Shape();
    const tp: [number, number][] = [
      [-2.2, 0],
      [2.2, 0],
      [1.5, 2.3],
      [-0.6, 2.7],
      [-2.2, 1.6],
    ];
    tp.forEach((p, i) => (i ? s.lineTo(...p) : s.moveTo(...p)));
    const gg = new THREE.ExtrudeGeometry(s, { depth: 3.6, bevelEnabled: false });
    gg.translate(0, 0, -1.8);
    add(g, 'gun_turret', gg, M.house, x, D + 0.8, z);
    add(g, 'gun_barrel', new THREE.CylinderGeometry(0.22, 0.26, 6.2, 14), M.dark, x + 4.6, D + 2.2, z).rotation.z = Math.PI / 2;
    add(g, 'gun_muzzle_brake', new THREE.CylinderGeometry(0.34, 0.34, 0.7, 14), M.dark, x + 7.6, D + 2.2, z).rotation.z = Math.PI / 2;
  }
  {
    const [x, z] = P(912, 150);
    add(g, 'sonar_dome', new THREE.SphereGeometry(1, 24, 16), M.dark, x, 2, z).scale.set(4, 2.2, 2.2);
  }
  // shafts, props, rudders
  for (const s of [-1, 1]) {
    const px = -67.4;
    const pz = s * 4.6;
    cyl(g, 'prop_shaft', M.dark, 0.28, 0.28, 13, px + 6.2, 2.2, pz, 10).rotation.z = Math.PI / 2;
    const pg = new THREE.Group();
    pg.name = 'propeller';
    pg.position.set(px, 1.3, pz);
    g.add(pg);
    add(pg, 'hub', new THREE.SphereGeometry(0.38, 12, 10), M.brass, 0, 0, 0);
    for (let i = 0; i < 5; i++) {
      const a = new THREE.Group();
      a.rotation.x = (i * Math.PI * 2) / 5;
      pg.add(a);
      add(a, 'blade', new THREE.BoxGeometry(0.1, 1.4, 0.5), M.brass, 0, 0.9, 0).rotation.y = 0.5;
    }
    bx(g, 'rudder', M.dark, 2.2, 3.4, 0.22, px - 1.6, 2, pz + s * 0.8);
  }

  const m = (k: number, sx: number, sy: number, y: number, side: 'up' | 'dn'): Mount => {
    const [x, z] = P(sx, sy);
    return mk(x, y, z, side, k);
  };
  const mounts: Record<string, Mount> = {
    flight: m(D, 132, 150, 20, 'dn'),
    vls_aft: m(D, 358, 150, 17, 'up'),
    sat: m(D + 5.8, 510, 100, 27, 'up'),
    air_radar: m(D + 13.2, 610, 150, 33, 'dn'),
    vls_fwd: m(D, 726, 150, 17, 'up'),
    gun: m(D, 844, 150, 17, 'dn'),
    engine_p: m(0, 300, 150, 3.6, 'up'),
    engine_s: m(0, 400, 150, 3.6, 'up'),
    genset_1: m(0, 480, 150, 3.6, 'up'),
    chill: m(0, 580, 150, 3.6, 'up'),
    genset_2: m(0, 660, 150, 3.6, 'up'),
    sonar: m(0, 912, 150, 3.6, 'up'),
  };
  // below-deck pins alternate port / starboard so they do not stack
  mounts.engine_p.p.z = -3.2;
  mounts.engine_s.p.z = 3.2;
  mounts.genset_1.p.z = -3.2;
  mounts.chill.p.z = 3.2;
  mounts.genset_2.p.z = -3.2;
  mounts.sonar.p.z = 3.2;

  ctx.lights.push([6, D + 13.5 + 17.3, 0]);
  return {
    g,
    mounts,
    len: 140,
    beam: 27,
    HH: 10,
    mid: 0,
    deckY: D,
    vlsX: [-21.3, 33.9],
    houses: [{ x0: -13.5, x1: 22.8, w: 18, y0: D, h: 14 }],
  };
}
