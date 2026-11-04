import * as THREE from 'three';
import { add, bx, chamf, cyl, mk, plate, V } from '../geom';
import { hull } from '../loft';
import type { BuildCtx, HullBuild, House, Mount } from '../types';

export interface SurfCfg {
  cls: 'CG' | 'FFG' | 'LCS';
  L: number;
  B: number;
  HH: number;
  bowU?: number;
  /** Trimaran: narrow main hull plus two outriggers. */
  tri?: boolean;
  mainB?: number;
  out?: number;
}

/** Generic surface combatant (CG / FFG / LCS): lofted hull plus a kit of deck fittings placed by class. */
export function buildSurf(c: SurfCfg, ctx: BuildCtx): HullBuild {
  const { M } = ctx;
  const houses: House[] = [];
  const g = new THREE.Group();
  g.name = c.cls;
  const L = c.L;
  const x0 = -L / 2;
  const HH = c.HH;
  const D = HH + 0.3;
  const B = c.B;
  const X = (u: number) => x0 + u * L;
  const bowU = c.bowU || 0.62;
  const shape = (x: number) => {
    const u = (x - x0) / L;
    const w = u < 0.2 ? 0.8 + (u / 0.2) * 0.2 : 1;
    return u < bowU ? w : Math.sqrt(Math.max(0, 1 - Math.pow((u - bowU) / (1 - bowU), 2)));
  };
  const hw = (x: number) => ((c.tri ? c.mainB! : B) / 2) * shape(x);
  hull(g, { x0, x1: x0 + L, bowX: X(c.tri ? 0.8 : bowU), HH, hw }, ctx);
  if (c.tri) {
    const out = c.out!;
    for (const s of [-1, 1]) hull(g, { x0: X(0.06), x1: X(0.82), bowX: X(0.6), HH: HH * 0.8, hw: (x) => 2.3 * Math.min(1, shape(x) * 1.2), zOff: s * out }, ctx);
    plate(
      g,
      'trimaran_deck',
      M.deck,
      [
        [X(0), -out - 4.5],
        [X(0.62), -out - 4.5],
        [X(0.9), -4],
        [X(0.96), 0],
        [X(0.9), 4],
        [X(0.62), out + 4.5],
        [X(0), out + 4.5],
      ],
      0.5,
      HH - 0.1,
    );
  } else {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 90; i++) {
      const x = x0 + (L * i) / 90;
      pts.push([x, hw(x) * 1.04]);
    }
    plate(g, 'main_deck', M.deck, [...pts.map(([x, z]) => [x, -z] as [number, number]), ...pts.slice().reverse()], 0.3, HH);
    const a: THREE.Vector3[] = [];
    const b: THREE.Vector3[] = [];
    for (let i = 2; i < 88; i++) {
      const [x, z] = pts[i];
      const w = z - 0.3;
      if (w < 1) break;
      a.push(V(x, D + 1.1, -w));
      b.push(V(x, D + 1.1, w));
    }
    add(g, 'deck_railing', new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...a, ...b.reverse()]), 300, 0.07, 4, false), M.light, 0, 0, 0);
  }
  const T = c.tri ? HH + 0.4 : D;
  const mounts: Record<string, Mount> = {};

  const helo = (u: number, len: number, w: number) => {
    const x = X(u);
    bx(g, 'helo_deck', M.dark, len, 0.12, w, x, T + 0.06, 0);
    const r = add(g, 'helo_circle', new THREE.RingGeometry(4.8, 5.4, 48), M.helo, x, T + 0.14, 0);
    r.rotation.x = -Math.PI / 2;
    bx(g, 'helo_bar_x', M.helo, len * 0.6, 0.02, 0.3, x, T + 0.13, 0);
    bx(g, 'helo_bar_z', M.helo, 0.3, 0.02, w * 0.8, x, T + 0.13, 0);
    const hg = new THREE.Group();
    hg.name = 'helicopter';
    add(hg, 'fuselage', new THREE.SphereGeometry(1.2, 24, 16), M.heli, 0, 2, 0).scale.set(2.4, 1, 0.95);
    bx(hg, 'tail_boom', M.heli, 5, 0.55, 0.5, -4.2, 2.4, 0);
    bx(hg, 'tail_fin', M.heli, 0.9, 1.6, 0.15, -6.4, 3.1, 0);
    for (let i = 0; i < 4; i++) {
      const bl = bx(hg, 'blade_' + i, M.dark, 4.9, 0.06, 0.35, Math.cos(i * (Math.PI / 2) + 0.5) * 2.5, 3.75, Math.sin(i * (Math.PI / 2) + 0.5) * 2.5);
      bl.rotation.y = -(i * (Math.PI / 2) + 0.5);
    }
    hg.position.set(x + 1, T + 0.2, 0);
    g.add(hg);
  };
  const hangar = (u0: number, u1: number, w: number, h: number) => {
    bx(g, 'hangar', M.house, (u1 - u0) * L, h, w, X((u0 + u1) / 2), T + h / 2, 0);
    bx(g, 'hangar_door', M.dark, 0.12, h - 1.2, w * 0.8, X(u0) - 0.03, T + h / 2 - 0.3, 0);
    bx(g, 'hangar_roof', M.light, (u1 - u0) * L - 0.4, 0.15, w - 0.4, X((u0 + u1) / 2), T + h, 0);
  };
  const vls = (n: string, u: number, cols: number, rows: number) => {
    const x = X(u);
    const cw = cols * 1.5;
    const cd = rows * 1.5;
    bx(g, n + '_frame', M.dark, cw + 0.8, 0.35, cd + 0.8, x, T + 0.18, 0);
    const cg = new THREE.BoxGeometry(1.15, 0.12, 1.15);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) add(g, n + '_hatch', cg, M.vls, x - cw / 2 + 1.5 * i + 0.75, T + 0.4, -cd / 2 + 1.5 * j + 0.75);
  };
  const gun = (n: string, u: number, big: boolean) => {
    const x = X(u);
    cyl(g, n + '_base', M.dark, big ? 2.7 : 1.8, big ? 2.9 : 2, 0.5, x, T + 0.25, 0, 28);
    const s = new THREE.Shape();
    const pts: [number, number][] = big
      ? [
          [-2.2, 0],
          [2.2, 0],
          [1.5, 2.3],
          [-0.6, 2.7],
          [-2.2, 1.6],
        ]
      : [
          [-1.6, 0],
          [1.6, 0],
          [1.1, 1.7],
          [-0.5, 2],
          [-1.6, 1.2],
        ];
    pts.forEach((p, i) => (i ? s.lineTo(...p) : s.moveTo(...p)));
    const gg = new THREE.ExtrudeGeometry(s, { depth: big ? 3.6 : 2.6, bevelEnabled: false });
    gg.translate(0, 0, big ? -1.8 : -1.3);
    add(g, n + '_turret', gg, M.house, x, T + 0.5, 0);
    add(g, n + '_barrel', new THREE.CylinderGeometry(0.2, 0.24, big ? 6.2 : 3.6, 14), M.dark, x + (big ? 4.6 : 2.8), T + (big ? 1.9 : 1.7), 0).rotation.z = Math.PI / 2;
  };
  /** Stepped deckhouse; returns the roof height. */
  const house = (u0: number, u1: number, w: number, tiers: [number, number][]) => {
    let y = T;
    tiers.forEach(([h, ins], i) => {
      const a = X(u0) + ins * L;
      const b2 = X(u1) - ins * L * 0.6;
      const hz = w / 2 - ins * L * 0.5;
      houses.push({ x0: a, x1: b2, w: hz * 2, y0: y, h });
      chamf(g, 'deckhouse_tier' + i, M.house, a, -hz, b2, hz, 2, h, y);
      bx(g, 'windows_' + i, M.glass, 0.12, 1, hz * 1.1, b2 + 0.02, y + h * 0.6, 0);
      y += h;
    });
    bx(g, 'house_roof', M.light, (u1 - u0) * L * 0.6, 0.2, w * 0.5, X((u0 + u1) / 2), y + 0.1, 0);
    return y;
  };
  const funnel = (u: number, z: number, h: number) => {
    const x = X(u);
    bx(g, 'funnel_block', M.house, 7, h, 5, x, T + h / 2, z);
    cyl(g, 'exhaust', M.dark, 1.6, 1.9, 1.4, x, T + h + 0.7, z - 0.3);
    cyl(g, 'exhaust_b', M.dark, 1.6, 1.9, 1.4, x, T + h + 0.7, z + 0.3);
  };
  const ciws = (n: string, u: number, y: number, z = 0) => {
    const x = X(u);
    cyl(g, n + '_pedestal', M.dark, 1, 1.3, 1.4, x, y + 0.7, z, 16);
    add(g, n + '_radome', new THREE.SphereGeometry(1.15, 20, 14), M.light, x, y + 2.1, z);
  };
  const props = (n: number) => {
    for (const s of n === 1 ? [0] : [-1, 1]) {
      const px = x0 + 1.6;
      const pz = s * B * 0.18;
      cyl(g, 'prop_shaft', M.dark, 0.28, 0.28, 12, px + 5.8, 1.8, pz, 10).rotation.z = Math.PI / 2;
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
      bx(g, 'rudder', M.dark, 2.2, 3.4, 0.22, px - 1.8, 2, pz);
    }
  };
  const arrays = (u: number, y: number, sx: number, sz: number) => {
    for (const [dx, dz, rot, n] of [
      [1, -1, Math.PI / 4, 'fp'],
      [1, 1, -Math.PI / 4, 'fs'],
      [-1, -1, (3 * Math.PI) / 4, 'ap'],
      [-1, 1, (-3 * Math.PI) / 4, 'as'],
    ] as const)
      add(g, 'array_' + n, new THREE.BoxGeometry(0.5, 4.6, 4.6), M.radar, X(u) + dx * sx, y, dz * sz).rotation.y = rot;
  };
  const mast = (u: number, y: number, h: number) => {
    const x = X(u);
    ctx.lights.push([x, y + h + 1.3, 0]);
    cyl(g, 'mast_tower', M.house, 0.8, 1.7, h, x, y + h / 2, 0, 4).rotation.y = Math.PI / 4;
    bx(g, 'mast_platform', M.dark, 4.4, 0.3, 4.4, x, y + h * 0.6, 0);
    bx(g, 'yardarm', M.dark, 0.3, 0.3, 8, x, y + h * 0.85, 0);
    bx(g, 'sps_bar', M.light, 0.35, 0.9, 6, x, y + h + 0.4, 0);
    for (const [dx, dz, hh] of [
      [1.2, 1.2, 5],
      [-1.2, 1.2, 4],
      [-1.2, -1.2, 6],
    ])
      cyl(g, 'antenna_whip', M.dark, 0.04, 0.06, hh, x + dx, y + h * 0.6 + hh / 2, dz, 6);
  };
  const rhibs = (u: number) => {
    for (const s of [-1, 1]) {
      const x = X(u);
      const z = s * (B / 2 - 2.2);
      add(g, 'rhib', new THREE.CapsuleGeometry(0.9, 4.2, 6, 16), M.orange, x, T + 1.2, z).rotation.z = Math.PI / 2;
      bx(g, 'rhib_cradle', M.dark, 6, 0.3, 1.7, x, T + 0.4, z);
    }
  };
  const ram = (n: string, u: number, z: number, y: number) => {
    const x = X(u);
    bx(g, n + '_box', M.dark, 2.6, 1.6, 2.2, x, y + 0.8, z);
    add(g, n + '_dome', new THREE.SphereGeometry(0.9, 16, 12), M.light, x, y + 2, z);
  };
  const sonar = (u: number, r: number) => add(g, 'sonar_dome', new THREE.SphereGeometry(1, 24, 16), M.dark, X(u), 1.8, 0).scale.set(r * 1.6, r, r);
  const hy = HH * 0.35;

  if (c.cls === 'CG') {
    helo(0.1, 22, 13);
    hangar(0.2, 0.28, 14, 6);
    gun('gun_fwd', 0.9, true);
    gun('gun_aft', 0.34, true);
    vls('fwd_vls', 0.79, 8, 4);
    vls('aft_vls', 0.42, 8, 4);
    const top1 = house(0.45, 0.72, 12.5, [
      [4.5, 0],
      [3.6, 0.02],
      [3, 0.04],
    ]);
    funnel(0.5, -1, 5);
    funnel(0.62, 1, 5);
    arrays(0.62, T + 7.5, 2, 2);
    mast(0.5, top1, 14);
    mast(0.66, top1, 10);
    for (let i = 0; i < 4; i++) bx(g, 'harpoon_canister', M.dark, 5, 0.9, 0.9, X(0.41), T + 0.7 + Math.floor(i / 2) * 1, (i % 2 ? 1 : -1) * (B / 2 - 2.6));
    ciws('ciws_fwd', 0.72, T + 11, 0);
    ciws('ciws_aft', 0.3, T + 0.5, 3);
    rhibs(0.4);
    sonar(0.9, 2.8);
    props(2);
    Object.assign(mounts, {
      flight: mk(X(0.1), T + 13, 0, 'dn', T),
      vls_fwd: mk(X(0.79), T + 11, 0, 'up', T),
      vls_aft: mk(X(0.42), T + 11, 0, 'dn', T),
      gun: mk(X(0.9), T + 10, 0, 'dn', T),
      gun_aft: mk(X(0.34), T + 10, 0, 'up', T),
      air_radar: mk(X(0.62), T + 17, 0, 'up', T + 7.5),
      sat: mk(X(0.5), T + 24, 0, 'dn', top1),
      harpoon: mk(X(0.41), T + 8, B / 2 - 2.6, 'up', T),
      ciws: mk(X(0.72), T + 16, 0, 'dn', T + 11),
      engine_p: mk(X(0.45), hy, -3.4, 'up'),
      engine_s: mk(X(0.32), hy, 3.4, 'up'),
      genset_1: mk(X(0.55), hy, -3, 'up'),
      sonar: mk(X(0.9), hy, 0, 'up'),
    });
  } else if (c.cls === 'FFG') {
    helo(0.1, 22, 16);
    hangar(0.2, 0.31, 17, 6.5);
    gun('gun_fwd', 0.9, false);
    vls('fwd_vls', 0.77, 8, 4);
    const top1 = house(0.4, 0.7, 16, [
      [4.5, 0],
      [3.8, 0.02],
      [3.2, 0.04],
    ]);
    arrays(0.58, T + 10.5, 2.6, 2.6);
    funnel(0.45, -3.5, 4);
    funnel(0.45, 3.5, 4);
    mast(0.52, top1, 10);
    ram('ram_fwd', 0.84, 0, T);
    ram('ram_aft', 0.36, 0, T);
    rhibs(0.34);
    sonar(0.9, 2.8);
    props(2);
    Object.assign(mounts, {
      flight: mk(X(0.1), T + 12, 0, 'dn', T),
      vls_fwd: mk(X(0.77), T + 9, 0, 'up', T),
      gun: mk(X(0.9), T + 8, 0, 'dn', T),
      air_radar: mk(X(0.58), T + 16, 0, 'up', T + 10.5),
      sat: mk(X(0.52), T + 22, 0, 'dn', top1),
      ram: mk(X(0.84), T + 8, 0, 'up', T),
      engine_p: mk(X(0.4), hy, -4, 'up'),
      engine_s: mk(X(0.4), hy, 4, 'up'),
      genset_1: mk(X(0.54), hy, 3, 'up'),
      sonar: mk(X(0.9), hy, 0, 'up'),
    });
  } else {
    // LCS trimaran
    const out = c.out!;
    helo(0.18, 26, 20);
    bx(g, 'mission_bay_hangar', M.house, 22, 5, 16, X(0.38), T + 2.5, 0);
    bx(g, 'mission_bay_door', M.dark, 0.12, 3.8, 14, X(0.38) - 11.1, T + 2.2, 0);
    gun('gun_fwd', 0.88, false);
    const top1 = house(0.46, 0.68, 12, [
      [4, 0],
      [3.4, 0.025],
    ]);
    const py = add(g, 'mast_pyramid', new THREE.ConeGeometry(4.2, 11, 4), M.house, X(0.57), top1 + 5.5, 0);
    py.rotation.y = Math.PI / 4;
    bx(g, 'mast_array', M.radar, 0.4, 4, 4, X(0.57) + 2.2, top1 + 5, 0);
    cyl(g, 'mast_spar', M.dark, 0.2, 0.3, 6, X(0.57), top1 + 13, 0, 8);
    ctx.lights.push([X(0.57), top1 + 16.3, 0]);
    ram('ram', 0.46, -4, T + 5);
    for (const s of [-1, 1]) bx(g, 'nsm_launcher', M.dark, 3, 1.1, 1.1, X(0.66), T + 0.6, s * 3.5);
    for (const s of [-1, 1]) cyl(g, 'waterjet', M.dark, 0.9, 1, 2.2, x0 - 0.6, 1.4, s * 5, 16).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) cyl(g, 'waterjet_outer', M.dark, 0.8, 0.9, 2, X(0.06) - 0.6, 1.2, s * out, 16).rotation.z = Math.PI / 2;
    Object.assign(mounts, {
      flight: mk(X(0.18), T + 10, 0, 'dn', T),
      mission_bay: mk(X(0.38), T + 8, 0, 'up', T + 5),
      gun: mk(X(0.88), T + 7, 0, 'dn', T),
      air_radar: mk(X(0.57) + 2.2, top1 + 13, 0, 'up', top1),
      sat: mk(X(0.57), top1 + 17, 0, 'dn', top1 + 13),
      ram: mk(X(0.46), T + 11, -4, 'up', T + 6),
      nsm: mk(X(0.66), T + 6, 0, 'up', T),
      waterjet: mk(x0 + 2, hy, 0, 'up'),
      engine_p: mk(X(0.3), hy, -3, 'up'),
      engine_s: mk(X(0.3), hy, 3, 'up'),
      genset_1: mk(X(0.5), hy, 0, 'up'),
    });
  }
  return {
    g,
    mounts,
    len: L,
    beam: c.tri ? c.out! * 2 + 9 : B,
    HH: HH + 8,
    mid: HH / 2 + 3,
    deckY: T,
    houses,
    vlsX: c.cls === 'CG' ? [X(0.79), X(0.42)] : c.cls === 'FFG' ? [X(0.77)] : [],
  };
}
