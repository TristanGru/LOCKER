import * as THREE from 'three';
import { add, bx, cyl, jet, mk, plate, strip } from '../geom';
import { hull } from '../loft';
import type { BuildCtx, HullBuild, Mount, Zone } from '../types';

export interface FlatCfg {
  cls: 'CVN' | 'LHD';
  HH: number;
  x0: number;
  x1: number;
  bowX: number;
  hw: (x: number) => number;
  deck: [number, number][];
  beam: number;
}

/** Flat-top (CVN / LHD): lofted hull under a flight-deck polygon, island, deck markings and parked aircraft. */
export function buildFlat(cfg: FlatCfg, ctx: BuildCtx): HullBuild {
  const { M } = ctx;
  const g = new THREE.Group();
  g.name = cfg.cls;
  const { HH, x0, x1 } = cfg;
  const Y = HH + 1.2;
  hull(g, { x0, x1, bowX: cfg.bowX, HH, hw: cfg.hw, flare: 1 }, ctx);
  plate(g, 'flight_deck', M.deck, cfg.deck, 1.2, HH);
  strip(g, 'centerline', M.white, x0 + 8, 0, x1 - 30, 0, 0.25, Y + 0.02);
  const mounts: Record<string, Mount> = {};
  const hy = HH * 0.35;

  if (cfg.cls === 'CVN') {
    for (const [n, a, b, c2, d] of [
      ['cat_1', 70, -7, 150, -4],
      ['cat_2', 70, 8, 150, 5],
      ['cat_3', -8, -19, 68, -14],
      ['cat_4', -8, 15, 60, 11],
    ] as const) {
      strip(g, n + '_track', M.dark, a, b, c2, d, 1.4, Y + 0.01);
      strip(g, n + '_slot', M.white, a, b, c2, d, 0.2, Y + 0.03);
    }
    const zc = (x: number) => -4 + (x - 30) * (26 / 180);
    strip(g, 'angled_runway_center', M.white, 30, -4, -155, zc(-155), 0.3, Y + 0.02);
    for (const o of [-6, 6]) strip(g, 'angled_runway_edge', M.helo, 30, -4 + o, -155, zc(-155) + o, 0.3, Y + 0.02);
    for (const x of [-100, -108, -116, -124]) strip(g, 'arresting_wire', M.white, x, zc(x) - 6, x, zc(x) + 6, 0.12, Y + 0.04);
    for (const [x, z] of [
      [100, 17],
      [58, 20],
      [-50, 20],
      [-70, -30],
    ]) {
      bx(g, 'aircraft_elevator', M.elev, 22, 0.1, 13, x, Y + 0.04, z);
      for (const s of [-1, 1]) bx(g, 'elevator_edge', M.helo, 22, 0.04, 0.25, x, Y + 0.06, z + s * 6.5);
    }
    // island
    bx(g, 'island_lower', M.house, 44, 9, 8, 16, Y + 4.5, 25);
    bx(g, 'island_pri_fly', M.house, 30, 5, 7, 18, Y + 11.5, 24.8);
    bx(g, 'island_pri_fly_glass', M.glass, 31, 1.4, 7.4, 18, Y + 11.8, 24.8);
    bx(g, 'island_roof', M.light, 32, 0.3, 8, 18, Y + 14.2, 25);
    cyl(g, 'island_mast', M.house, 0.9, 2, 22, 14, Y + 25, 25, 4).rotation.y = Math.PI / 4;
    bx(g, 'mast_platform', M.dark, 6, 0.3, 6, 14, Y + 19, 25);
    bx(g, 'mast_platform_2', M.dark, 4, 0.3, 4, 14, Y + 27, 25);
    bx(g, 'sps48_array', M.radar, 0.6, 4.5, 7.5, 14, Y + 31, 25);
    for (const [dx, hh] of [
      [3, 8],
      [-3, 6],
      [0, 10],
    ])
      cyl(g, 'whip', M.dark, 0.05, 0.07, hh, 14 + dx, Y + 36 + hh / 2 - 2, 25, 6);
    for (const [n, x] of [
      ['dome_fwd', 28],
      ['dome_aft', 2],
    ] as const)
      add(g, n, new THREE.SphereGeometry(2.4, 20, 14), M.light, x, Y + 15.2 + 2, 25);
    bx(g, 'island_radar_panel', M.radar, 0.5, 4, 4, 36, Y + 11, 22);
    bx(g, 'island_radar_panel2', M.radar, 0.5, 4, 4, 0, Y + 11, 22);
    (
      [
        [-140, 29],
        [-140, -34],
        [120, -25],
        [110, 25],
      ] as const
    ).forEach(([x, z], i) => {
      cyl(g, 'sponson_' + i, M.dark, 3, 3.4, 1.4, x, HH + 0.1, z, 16);
      cyl(g, 'weapon_pedestal_' + i, M.dark, 1, 1.2, 1.4, x, Y + 0.8, z, 16);
      add(g, 'weapon_dome_' + i, new THREE.SphereGeometry(1.1, 16, 12), M.light, x, Y + 2.2, z);
    });
    (
      [
        [-148, 22, 0],
        [-134, 22, 0.1],
        [-120, 22, -0.05],
        [-106, 22, 0],
        [-92, 22, 0.08],
        [-78, 22, 0],
        [84, 24, 0],
        [96, 24, 0.1],
        [108, 24, 0],
        [120, 23, -0.1],
        [132, 22, 0],
        [104, -19, 0.3],
        [118, -18, 0.25],
        [-60, -12, 0],
      ] as const
    ).forEach(([x, z, r], i) => jet(g, M, x, Y, z, r + Math.PI, 'parked_aircraft_' + i));
    Object.assign(mounts, {
      flight: mk(-70, Y + 12, 6, 'dn', Y),
      catapult: mk(110, Y + 12, 0, 'up', Y),
      arrest: mk(-112, Y + 12, zc(-112), 'dn', Y),
      elev: mk(58, Y + 12, 20, 'up', Y),
      air_radar: mk(14, Y + 37, 25, 'dn', Y + 31),
      sat: mk(28, Y + 22, 25, 'up', Y + 17),
      ciws: mk(-140, Y + 10, 29, 'up', Y + 3),
      ram: mk(110, Y + 10, 25, 'up', Y + 3),
      reactor: mk(-20, hy, -4, 'up'),
      engine_p: mk(-70, hy, -9, 'up'),
      engine_s: mk(-70, hy, 9, 'up'),
      magazine: mk(80, hy, 0, 'up'),
      genset_1: mk(20, hy, 6, 'up'),
    });
    ctx.lights.push([14, Y + 38, 25]);
  } else {
    [-100, -78, -56, -34, -12, 10].forEach((x, i) => {
      const r = add(g, 'landing_spot_' + i, new THREE.RingGeometry(2.8, 3.3, 32), M.white, x, Y + 0.04, i % 2 ? 4 : -4);
      r.rotation.x = -Math.PI / 2;
    });
    for (const [x, z] of [
      [-62, 10],
      [52, 10],
    ])
      bx(g, 'aircraft_elevator', M.elev, 16, 0.1, 10, x, Y + 0.04, z);
    bx(g, 'island_lower', M.house, 32, 8, 6, 16, Y + 4, 11.5);
    bx(g, 'island_pri_fly', M.house, 20, 4, 5.5, 17, Y + 10, 11.3);
    bx(g, 'island_glass', M.glass, 21, 1.2, 5.8, 17, Y + 10.4, 11.3);
    bx(g, 'island_roof', M.light, 22, 0.3, 6, 17, Y + 12.2, 11.5);
    cyl(g, 'island_mast', M.house, 0.7, 1.5, 16, 16, Y + 20, 11.5, 4).rotation.y = Math.PI / 4;
    bx(g, 'mast_platform', M.dark, 4, 0.3, 4, 16, Y + 16, 11.5);
    bx(g, 'air_search_array', M.radar, 0.5, 3.4, 6, 16, Y + 24, 11.5);
    add(g, 'radome', new THREE.SphereGeometry(2, 20, 14), M.light, 27, Y + 14.2, 11.5);
    (
      [
        [-100, -14],
        [100, 14],
        [100, -14],
      ] as const
    ).forEach(([x, z], i) => {
      cyl(g, 'ram_pedestal_' + i, M.dark, 1, 1.2, 1.4, x, Y + 0.8, z, 16);
      add(g, 'ram_dome_' + i, new THREE.SphereGeometry(1.1, 16, 12), M.light, x, Y + 2.2, z);
    });
    bx(g, 'well_deck_door', M.dark, 0.3, 8, 20, x0 - 0.1, HH - 5, 0);
    (
      [
        [-90, 1, 0],
        [-60, -2, 0.2],
        [30, -3, 0],
        [60, 3, 0.1],
      ] as const
    ).forEach(([x, z, r], i) => jet(g, M, x, Y, z, r + Math.PI, 'parked_aircraft_' + i));
    Object.assign(mounts, {
      flight: mk(-40, Y + 11, -2, 'dn', Y),
      elev: mk(52, Y + 10, 10, 'up', Y),
      air_radar: mk(16, Y + 26, 11.5, 'dn', Y + 24),
      sat: mk(27, Y + 19, 11.5, 'up', Y + 14),
      ram: mk(100, Y + 9, 14, 'up', Y + 3),
      ciws: mk(-100, Y + 9, -14, 'up', Y + 3),
      well: mk(x0 + 14, hy, 0, 'up'),
      engine_p: mk(-30, hy, -6, 'up'),
      engine_s: mk(-30, hy, 6, 'up'),
      genset_1: mk(20, hy, 5, 'up'),
    });
    ctx.lights.push([16, Y + 26, 11.5]);
  }
  const zone =
    cfg.cls === 'CVN'
      ? (x: number): Zone => (Math.abs(x + 20) < 25 ? 'reactor' : Math.abs(x + 70) < 30 ? 'machinery' : x > 60 ? 'vls' : 'rooms')
      : (x: number): Zone => (x < -90 ? 'well' : Math.abs(x + 30) < 25 ? 'machinery' : 'rooms');
  return { g, mounts, len: x1 - x0, beam: cfg.beam, HH, mid: HH / 2, deckY: Y, flat: true, hangar: true, deckPoly: cfg.deck, zone };
}
