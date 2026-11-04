import * as THREE from 'three';
import type { Status } from '../../api/types';
import { disposeTree, mulberry, V } from './geom';
import { hullProfile } from './loft';
import type { CutMode, HullInfo, PinInfo, Zone } from './types';

const COL: Record<Status, number> = { unknown: 0x94a3b8, risk: 0xfb4d5d, watch: 0xfbbf24, ready: 0x34d399 };

/** Section-cap zone colors. */
export const ZC = {
  machinery: 0x8a6424,
  vls: 0x6b2f2f,
  ops: 0x216f82,
  berth: 0x3b4d6a,
  stores: 0x535f6c,
  tank: 0x206661,
  reactor: 0x1d5f73,
  hangar: 0x2a3748,
  well: 0x213040,
  missile: 0x4f2a2a,
  torp: 0x525c68,
} as const;
type FillZone = keyof typeof ZC;

export const ZONE_NAME: Record<Zone, string> = {
  machinery: 'Machinery spaces',
  vls: 'Missile magazine',
  rooms: 'Ops, berthing and stores',
  reactor: 'Reactor compartment',
  well: 'Well deck',
  missile: 'Missile compartment',
  torp: 'Torpedo room',
};

/** Key shown in the side rail. */
export const CUT_LEGEND: [string, string][] = [
  ['Machinery', '#8a6424'],
  ['Ops / combat', '#216f82'],
  ['Berthing', '#3b4d6a'],
  ['Fuel / tanks', '#206661'],
  ['Weapons', '#6b2f2f'],
  ['Reactor', '#2a8fa8'],
];

/** Compartment name and contents for each mount (cut panel and walk-in title). */
export const KD: Record<string, [string, string]> = {
  air_radar: ['Radar equipment room', 'Array transmitters, cabinets and waveguide runs'],
  sat: ['Communications room', 'SATCOM racks and waveguide'],
  gun: ['Gun magazine and handling room', 'Ammunition drum and hoist'],
  gun_aft: ['Gun magazine and handling room', 'Ammunition drum and hoist'],
  ciws: ['CIWS ammunition room', 'Ammunition drum and feed'],
  ram: ['RAM magazine', 'Launcher reloads'],
  harpoon: ['Missile deck stores', 'Canister reloads'],
  nsm: ['Missile stores', 'Strike missile reloads'],
  vls_fwd: ['Forward VLS magazine', 'Vertical launch cells'],
  vls_aft: ['Aft VLS magazine', 'Vertical launch cells'],
  vls: ['Missile tubes', 'Vertical launch tubes'],
  flight: ['Hangar', 'Aircraft and maintenance bay'],
  engine_p: ['Main engine room (port)', 'Gas turbine, gearbox and exhaust uptake'],
  engine_s: ['Main engine room (starboard)', 'Gas turbine, gearbox and exhaust uptake'],
  genset_1: ['Generator room', 'Turbine generator set'],
  genset_2: ['Generator room', 'Turbine generator set'],
  chill: ['AC and refrigeration room', 'Chilled-water plant for radar cooling'],
  sonar: ['Sonar dome', 'Transducer array'],
  reactor: ['Reactor compartment', 'Reactor vessel and steam generators'],
  catapult: ['Catapult machinery room', 'Steam accumulator and launch trough'],
  arrest: ['Arresting-gear engine room', 'Arresting engines and cable'],
  elev: ['Elevator pit', 'Platform and hydraulic ram'],
  magazine: ['Weapons magazine', 'Ordnance racks'],
  well: ['Well deck', 'Landing craft bay'],
  mission_bay: ['Mission bay', 'Mission modules and boats'],
  waterjet: ['Waterjet room', 'Waterjet and impeller'],
  towed_array: ['Towed-array handling room', 'Winch and cable reel'],
  torpedo: ['Torpedo room', 'Torpedo tubes and weapons'],
  planes: ['Hydraulics space', 'Control surface actuators'],
  dds: ['Dry deck shelter', 'Diver lock-out and equipment'],
  control: ['Control room', 'Consoles and fire control'],
  photonics: ['Control room', 'Photonics mast and consoles'],
  engine: ['Engine room', 'Main propulsion turbines'],
  propulsor: ['Propulsor space', 'Shaft, thrust bearing and pump-jet'],
  sonar_bow: ['Sonar sphere', 'Spherical array'],
};

/** Zone at a point along the hull: the hull's own zoning, or a generic surface-ship split. */
export function zoneAt(info: HullInfo, x: number): Zone {
  if (info.zone) return info.zone(x);
  const u = (x - info.bb.min.x) / (info.bb.max.x - info.bb.min.x);
  if (info.vlsX && info.vlsX.some((v) => Math.abs(x - v) < 6)) return 'vls';
  return u > 0.22 && u < 0.55 ? 'machinery' : 'rooms';
}

function polySpan(poly: [number, number][], x: number): [number, number] | null {
  let lo = 1e9;
  let hi = -1e9;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((a[0] <= x && b[0] >= x) || (b[0] <= x && a[0] >= x)) {
      const k = a[0] === b[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
      const z = a[1] + (b[1] - a[1]) * k;
      lo = Math.min(lo, z);
      hi = Math.max(hi, z);
    }
  }
  return hi < lo ? null : [lo, hi];
}

/**
 * Section cap for one half: hull wall ring, dark interior, deck lines and compartments colored by zone.
 * The focused system gets its own room with a schematic equipment drawing and a ring in its status color.
 * Coordinates inside are (u, y) on the cut face; `layer` offsets each drawing a few cm off the face.
 */
export function buildCap(info: HullInfo, cx: number, s: number, focus: PinInfo | null, Z: boolean) {
  const grp = new THREE.Group();
  grp.name = 'cut_section';
  const rnd = mulberry(Math.round(cx * 7) + 11);
  const Lx = (l: number) => cx + s * (0.03 + l * 0.05);
  let LB = 3;

  const mk2 = (geo: THREE.BufferGeometry, color: number, l: number, e?: number, py?: number, pz?: number) => {
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: e ?? 0.32, side: THREE.DoubleSide, roughness: 0.9 }),
    );
    m.name = 'cut_section_part';
    if (Z) {
      m.rotation.y = s === 1 ? 0 : Math.PI;
      m.position.set(pz || 0, py || 0, cx + s * (0.03 + l * 0.05));
    } else {
      m.rotation.y = (s * Math.PI) / 2;
      m.position.set(Lx(l), py || 0, pz || 0);
    }
    grp.add(m);
    return m;
  };
  const poly = (pts: [number, number][], c: number, l: number, e?: number) => {
    const sh = new THREE.Shape();
    pts.forEach(([z, y], i) => {
      const u = Z ? s * z : -s * z;
      if (i) sh.lineTo(u, y);
      else sh.moveTo(u, y);
    });
    return mk2(new THREE.ShapeGeometry(sh), c, l, e);
  };
  const rect = (z0: number, z1: number, y0: number, y1: number, c: number, l: number, e?: number) =>
    poly(
      [
        [z0, y0],
        [z1, y0],
        [z1, y1],
        [z0, y1],
      ],
      c,
      l,
      e,
    );
  const disc = (z: number, y: number, r: number, c: number, l: number, e?: number) => mk2(new THREE.CircleGeometry(r, 40), c, l, e, y, z);
  const ring = (z: number, y: number, r0: number, r1: number, c: number, l: number, e?: number) =>
    mk2(new THREE.RingGeometry(r0, r1, 40), c, l, e, y, z);
  const rad = (cz: number, cy: number, r0: number, r1: number, ang: number, wd: number, c: number, l: number, e?: number) => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const nx = (-sa * wd) / 2;
    const ny = (ca * wd) / 2;
    const p0 = [cz + r0 * ca, cy + r0 * sa];
    const p1 = [cz + r1 * ca, cy + r1 * sa];
    poly(
      [
        [p0[0] + nx, p0[1] + ny],
        [p1[0] + nx, p1[1] + ny],
        [p1[0] - nx, p1[1] - ny],
        [p0[0] - nx, p0[1] - ny],
      ],
      c,
      l,
      e,
    );
  };
  const ST = 0xa4b0bb;
  const DK = 0x14181d;
  const CY = 0x62d1e8;
  const AM = 0xe0a947;
  const RD = 0xd2574b;
  const GN = 0x5fd39a;

  /** Schematic equipment drawing for a mount kind, centered at (cz, cy), w x h. */
  const equip = (kind: string, cz: number, cy: number, w: number, h: number) => {
    const l = LB;
    const mr = Math.min(w, h);
    const racks = (col: number) => {
      const n = Math.max(3, Math.floor(w / 1.1));
      for (let i = 0; i < n; i++) {
        const x = cz - w / 2 + ((i + 0.5) * w) / n;
        rect(x - 0.4, x + 0.4, cy - h * 0.44, cy + h * 0.28, 0x20262d, l, 0.2);
        rect(x - 0.3, x + 0.3, cy + h * 0.04, cy + h * 0.22, col, l + 1, 0.85);
        rect(x - 0.3, x + 0.3, cy - h * 0.3, cy - h * 0.12, 0x333c46, l + 1, 0.25);
        disc(x, cy - h * 0.38, 0.09, GN, l + 1, 0.9);
      }
      rect(cz - 0.14, cz + 0.14, cy + h * 0.28, cy + h * 0.5, ST, l + 1, 0.35);
    };
    const drum = (r: number) => {
      disc(cz, cy - h * 0.04, r, DK, l, 0.2);
      ring(cz, cy - h * 0.04, r * 0.92, r, ST, l + 1, 0.4);
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        disc(cz + Math.cos(a) * r * 0.68, cy - h * 0.04 + Math.sin(a) * r * 0.68, r * 0.13, AM, l + 1, 0.6);
      }
      disc(cz, cy - h * 0.04, r * 0.2, ST, l + 1, 0.3);
      rect(cz - 0.18, cz + 0.18, cy - h * 0.04 + r, cy + h * 0.5, ST, l + 1, 0.35);
    };
    const cells = (co: number, ro: number) => {
      const cw = (w * 0.92) / co;
      const ch = (h * 0.7) / ro;
      for (let i = 0; i < co; i++)
        for (let j = 0; j < ro; j++) {
          const x = cz - w * 0.46 + (i + 0.5) * cw;
          const y = cy - h * 0.4 + (j + 0.5) * ch;
          rect(x - cw * 0.44, x + cw * 0.44, y - ch * 0.44, y + ch * 0.44, 0x2a1212, l, 0.1);
          disc(x, y, Math.min(cw, ch) * 0.3, RD, l + 1, 0.7);
        }
      rect(cz - 0.2, cz + 0.2, cy + h * 0.32, cy + h * 0.5, ST, l + 1, 0.35);
    };
    switch (kind) {
      case 'air_radar':
        racks(CY);
        break;
      case 'sat':
        racks(AM);
        break;
      case 'gun':
      case 'gun_aft':
        drum(mr * 0.4);
        break;
      case 'ciws':
        drum(mr * 0.34);
        break;
      case 'vls_fwd':
      case 'vls_aft':
      case 'vls':
        cells(Math.min(6, Math.max(3, Math.floor(w / 1.2))), 3);
        break;
      case 'harpoon':
      case 'nsm':
      case 'ram':
        cells(4, 2);
        break;
      case 'magazine':
        cells(Math.min(7, Math.max(3, Math.floor(w / 1.1))), 3);
        break;
      case 'flight': {
        rect(cz - w * 0.34, cz + w * 0.12, cy - h * 0.3, cy + h * 0.02, 0x7b8996, l, 0.4);
        rect(cz + w * 0.12, cz + w * 0.4, cy - h * 0.12, cy - h * 0.02, 0x7b8996, l, 0.4);
        rect(cz + w * 0.36, cz + w * 0.4, cy - h * 0.12, cy + h * 0.14, 0x7b8996, l, 0.4);
        rect(cz - w * 0.46, cz + w * 0.3, cy + h * 0.2, cy + h * 0.23, DK, l + 1, 0.3);
        rect(cz - 0.08, cz + 0.08, cy + h * 0.02, cy + h * 0.2, DK, l + 1, 0.3);
        for (const dx of [-0.22, 0.04]) disc(cz + w * dx, cy - h * 0.34, 0.14, DK, l + 1, 0.3);
        rect(cz - w * 0.4, cz - w * 0.1, cy - h * 0.43, cy - h * 0.38, AM, l, 0.5);
        break;
      }
      case 'engine_p':
      case 'engine_s':
      case 'engine': {
        const R = mr * 0.36;
        const x = cz - w * 0.12;
        disc(x, cy - h * 0.03, R, DK, l, 0.2);
        ring(x, cy - h * 0.03, R * 0.9, R, AM, l + 1, 0.55);
        ring(x, cy - h * 0.03, R * 0.58, R * 0.64, ST, l + 1, 0.4);
        for (let i = 0; i < 24; i++) rad(x, cy - h * 0.03, R * 0.25, R * 0.56, (i * Math.PI) / 12, 0.09, AM, l + 1, 0.55);
        disc(x, cy - h * 0.03, R * 0.2, ST, l + 1, 0.4);
        rect(cz + w * 0.22, cz + w * 0.46, cy - h * 0.3, cy + h * 0.2, 0x2b333c, l, 0.2);
        ring(cz + w * 0.34, cy - h * 0.05, 0.25, 0.4, ST, l + 1, 0.4);
        rect(x - 0.35, x + 0.35, cy - h * 0.03 + R, cy + h * 0.5, 0x3a444e, l + 1, 0.3);
        break;
      }
      case 'genset_1':
      case 'genset_2': {
        const R = mr * 0.3;
        rect(cz - w * 0.45, cz + w * 0.45, cy - h * 0.45, cy - h * 0.3, 0x2b333c, l, 0.2);
        disc(cz - w * 0.18, cy - h * 0.02, R, DK, l, 0.2);
        ring(cz - w * 0.18, cy - h * 0.02, R * 0.85, R, GN, l + 1, 0.5);
        disc(cz - w * 0.18, cy - h * 0.02, R * 0.35, ST, l + 1, 0.35);
        rect(cz + w * 0.1, cz + w * 0.42, cy - h * 0.28, cy + h * 0.2, 0x20262d, l, 0.2);
        for (let i = 0; i < 3; i++) disc(cz + w * (0.18 + 0.1 * i), cy + h * 0.06, 0.14, [GN, AM, CY][i], l + 1, 0.9);
        break;
      }
      case 'chill': {
        const R = mr * 0.24;
        for (const dx of [-0.26, 0.2]) {
          disc(cz + w * dx, cy + h * 0.02, R, 0x2c3a46, l, 0.25);
          ring(cz + w * dx, cy + h * 0.02, R * 0.8, R, CY, l + 1, 0.5);
        }
        rect(cz - w * 0.46, cz + w * 0.46, cy - h * 0.3, cy - h * 0.24, 0x5aa7e0, l + 1, 0.6);
        disc(cz + w * 0.4, cy - h * 0.1, R * 0.5, ST, l + 1, 0.4);
        rect(cz - w * 0.42, cz - w * 0.38, cy - h * 0.3, cy + h * 0.02, 0x5aa7e0, l + 1, 0.5);
        break;
      }
      case 'sonar':
      case 'sonar_bow': {
        const R = mr * 0.46;
        disc(cz, cy, R, 0x0f1c24, l, 0.2);
        ring(cz, cy, R * 0.92, R, ST, l + 1, 0.4);
        for (let i = 0; i < 36; i++) rad(cz, cy, R * 0.72, R * 0.9, (i * Math.PI) / 18, 0.1, CY, l + 1, 0.8);
        disc(cz, cy, R * 0.5, 0x16303d, l + 1, 0.3);
        ring(cz, cy, R * 0.4, R * 0.46, ST, l + 1, 0.35);
        break;
      }
      case 'reactor': {
        const R = mr * 0.42;
        disc(cz, cy, R, ST, l, 0.3);
        disc(cz, cy, R * 0.92, 0x0f1c24, l + 1, 0.2);
        for (let k = 0; k < 4; k++) {
          const n = k === 0 ? 1 : 6 * k;
          for (let i = 0; i < n; i++) {
            const a = (i * Math.PI * 2) / n;
            disc(cz + Math.cos(a) * k * R * 0.2, cy + Math.sin(a) * k * R * 0.2, R * 0.065, CY, l + 2, 0.9);
          }
        }
        for (const dx of [-0.14, 0, 0.14]) rect(cz + R * dx * 2.2 - 0.07, cz + R * dx * 2.2 + 0.07, cy + R * 0.92, cy + R * 1.18, ST, l + 1, 0.35);
        for (const sx of [-1, 1]) {
          disc(cz + sx * R * 1.35, cy, R * 0.5, 0x2b333c, l, 0.25);
          ring(cz + sx * R * 1.35, cy, R * 0.4, R * 0.5, AM, l + 1, 0.55);
        }
        break;
      }
      case 'catapult': {
        const R = mr * 0.3;
        disc(cz - w * 0.22, cy - h * 0.06, R, DK, l, 0.2);
        ring(cz - w * 0.22, cy - h * 0.06, R * 0.8, R, ST, l + 1, 0.4);
        rect(cz - w * 0.05, cz + w * 0.46, cy + h * 0.12, cy + h * 0.3, 0x2b333c, l, 0.2);
        rect(cz - w * 0.05, cz + w * 0.46, cy + h * 0.2, cy + h * 0.22, CY, l + 1, 0.8);
        rect(cz + w * 0.12, cz + w * 0.22, cy + h * 0.1, cy + h * 0.34, AM, l + 1, 0.6);
        rect(cz - w * 0.22, cz - w * 0.1, cy + R - h * 0.06, cy + h * 0.2, ST, l + 1, 0.4);
        break;
      }
      case 'arrest': {
        const R = mr * 0.28;
        for (const dx of [-0.26, 0.26]) {
          disc(cz + w * dx, cy - h * 0.08, R, DK, l, 0.2);
          ring(cz + w * dx, cy - h * 0.08, R * 0.78, R, AM, l + 1, 0.5);
          disc(cz + w * dx, cy - h * 0.08, R * 0.3, ST, l + 1, 0.35);
          rect(cz + w * dx - 0.07, cz + w * dx + 0.07, cy + R - h * 0.08, cy + h * 0.5, ST, l + 1, 0.35);
        }
        break;
      }
      case 'elev': {
        rect(cz - w * 0.36, cz + w * 0.36, cy - h * 0.46, cy + h * 0.46, 0x10161d, l, 0.15);
        rect(cz - w * 0.34, cz + w * 0.34, cy + h * 0.04, cy + h * 0.12, CY, l + 1, 0.7);
        rect(cz - 0.12, cz + 0.12, cy - h * 0.46, cy + h * 0.04, ST, l + 1, 0.4);
        for (const sx of [-1, 1]) rect(cz + sx * w * 0.34 - 0.05, cz + sx * w * 0.34 + 0.05, cy - h * 0.46, cy + h * 0.46, 0x62707c, l + 1, 0.3);
        break;
      }
      case 'well': {
        rect(cz - w * 0.46, cz + w * 0.46, cy - h * 0.46, cy - h * 0.2, 0x1d5a7a, l, 0.5);
        rect(cz - w * 0.36, cz + w * 0.36, cy - h * 0.26, cy - h * 0.02, 0x7b8996, l + 1, 0.4);
        rect(cz - w * 0.42, cz + w * 0.42, cy - h * 0.1, cy - h * 0.02, 0x37424d, l + 1, 0.3);
        rect(cz - w * 0.12, cz + w * 0.12, cy - h * 0.02, cy + h * 0.14, 0x62707c, l + 1, 0.35);
        break;
      }
      case 'mission_bay': {
        const cs = [0x3b6a8a, 0x8a6a3b, 0x4a7a5a, 0x7a4a4a];
        for (let i = 0; i < 4; i++) rect(cz - w * 0.46 + i * w * 0.23, cz - w * 0.46 + i * w * 0.23 + w * 0.2, cy - h * 0.42, cy + h * 0.1 + (i % 2) * h * 0.14, cs[i], l, 0.45);
        rect(cz - w * 0.2, cz + w * 0.3, cy - h * 0.44, cy - h * 0.3, 0xd98a2b, l + 1, 0.4);
        break;
      }
      case 'waterjet': {
        const R = mr * 0.4;
        disc(cz, cy, R, DK, l, 0.2);
        ring(cz, cy, R * 0.88, R, ST, l + 1, 0.4);
        for (let i = 0; i < 7; i++) rad(cz, cy, R * 0.18, R * 0.84, (i * Math.PI * 2) / 7, 0.18, CY, l + 1, 0.6);
        disc(cz, cy, R * 0.2, ST, l + 1, 0.4);
        break;
      }
      case 'towed_array': {
        const R = mr * 0.42;
        disc(cz, cy, R, DK, l, 0.2);
        for (const k of [1, 0.78, 0.58, 0.4]) ring(cz, cy, R * k - 0.07, R * k, k > 0.5 ? AM : ST, l + 1, 0.5);
        disc(cz, cy, R * 0.14, ST, l + 1, 0.4);
        rect(cz + R, cz + w * 0.46, cy - 0.1, cy + 0.1, AM, l + 1, 0.5);
        break;
      }
      case 'torpedo': {
        const R = mr * 0.2;
        for (const [dx, dy] of [
          [-0.2, 0.18],
          [0.2, 0.18],
          [-0.2, -0.2],
          [0.2, -0.2],
        ]) {
          disc(cz + w * dx, cy + h * dy, R, 0xbfd0dc, l, 0.3);
          disc(cz + w * dx, cy + h * dy, R * 0.8, DK, l + 1, 0.1);
          disc(cz + w * dx, cy + h * dy, R * 0.55, 0x6a7480, l + 2, 0.4);
        }
        break;
      }
      case 'planes': {
        rect(cz - w * 0.4, cz + w * 0.1, cy - h * 0.12, cy + h * 0.12, 0x2b333c, l, 0.2);
        rect(cz + w * 0.1, cz + w * 0.4, cy - 0.08, cy + 0.08, ST, l + 1, 0.4);
        disc(cz + w * 0.4, cy, 0.3, AM, l + 1, 0.6);
        ring(cz - w * 0.4, cy, 0.2, 0.32, CY, l + 1, 0.6);
        break;
      }
      case 'dds': {
        const R = mr * 0.34;
        disc(cz, cy, R, 0x2b333c, l, 0.2);
        ring(cz, cy, R * 0.88, R, ST, l + 1, 0.4);
        for (let i = 0; i < 4; i++) disc(cz + Math.cos(i * (Math.PI / 2) + 0.8) * R * 0.46, cy + Math.sin(i * (Math.PI / 2) + 0.8) * R * 0.46, R * 0.15, AM, l + 1, 0.5);
        rect(cz - R * 0.3, cz + R * 0.3, cy + R, cy + h * 0.5, ST, l + 1, 0.4);
        break;
      }
      case 'control':
      case 'photonics': {
        for (let i = 0; i < 5; i++) {
          const a = -0.8 + i * 0.4;
          const x = cz + Math.sin(a) * w * 0.38;
          const y = cy - h * 0.1 + (1 - Math.cos(a)) * -h * 0.2;
          rect(x - 0.38, x + 0.38, y - 0.3, y + 0.3, 0x20262d, l, 0.2);
          rect(x - 0.3, x + 0.3, y, y + 0.42, CY, l + 1, 0.85);
          disc(x, y - 0.55, 0.2, 0x4a5560, l + 1, 0.3);
        }
        if (kind === 'photonics') rect(cz - 0.07, cz + 0.07, cy + h * 0.1, cy + h * 0.5, ST, l + 1, 0.45);
        break;
      }
      case 'propulsor': {
        const R = mr * 0.4;
        disc(cz, cy, R, DK, l, 0.2);
        ring(cz, cy, R * 0.88, R, ST, l + 1, 0.4);
        ring(cz, cy, R * 0.5, R * 0.58, AM, l + 1, 0.5);
        disc(cz, cy, R * 0.3, 0x9a7a3a, l + 1, 0.4);
        disc(cz, cy, R * 0.12, ST, l + 2, 0.4);
        break;
      }
      default:
        racks(CY);
    }
  };

  /** Fill one compartment with its zone color and a little zone-specific detail. */
  const fill = (z0: number, z1: number, y0: number, y1: number, zone: FillZone) => {
    const w = z1 - z0;
    const h = y1 - y0;
    const cz = (z0 + z1) / 2;
    const cy = (y0 + y1) / 2;
    rect(z0, z1, y0, y1, ZC[zone], 2);
    if (zone === 'machinery') {
      const r = Math.min(w, h) * 0.33;
      disc(cz - w * 0.15, cy, r, DK, 3, 0.15);
      disc(cz - w * 0.15, cy, r * 0.6, AM, 4, 0.6);
      rect(cz + w * 0.14, cz + w * 0.4, y0 + h * 0.18, y0 + h * 0.82, 0x20262d, 3, 0.2);
      rect(cz + w * 0.2, cz + w * 0.34, y0 + h * 0.3, y0 + h * 0.7, 0x93a0ac, 4, 0.3);
    } else if (zone === 'vls') {
      const co = Math.max(2, Math.min(8, Math.floor(w / 1.1)));
      const ro = Math.max(1, Math.min(3, Math.floor(h / 1.1)));
      const cw = w / co;
      const ch = h / ro;
      for (let i = 0; i < co; i++)
        for (let j = 0; j < ro; j++) {
          rect(z0 + i * cw + 0.12, z0 + (i + 1) * cw - 0.12, y0 + j * ch + 0.12, y0 + (j + 1) * ch - 0.12, 0x2a1212, 3, 0.1);
          disc(z0 + (i + 0.5) * cw, y0 + (j + 0.5) * ch, Math.min(cw, ch) * 0.28, RD, 4, 0.6);
        }
    } else if (zone === 'reactor') equip('reactor', cz, cy, w, h);
    else if (zone === 'tank') {
      rect(z0 + 0.1, z1 - 0.1, y0 + 0.1, y0 + h * (0.45 + rnd() * 0.3), 0x3fb3a8, 3, 0.4);
      rect(z0 + 0.1, z1 - 0.1, y0 + h * 0.4, y0 + h * 0.42, 0x9fe0d8, 4, 0.4);
    } else if (zone === 'hangar') {
      for (let k = 0; k < 3; k++) {
        const z = z0 + w * (0.2 + 0.3 * k);
        rect(z - 0.35, z + 0.35, y0 + 0.15, y0 + Math.min(1.6, h * 0.4), 0x7b8996, 3, 0.4);
        rect(z - 2.5, z + 2.5, y0 + h * 0.12, y0 + h * 0.12 + 0.22, 0x93a0ac, 3, 0.4);
        rect(z - 0.2, z + 0.2, y0 + 0.15, y0 + Math.min(2.4, h * 0.55), 0x62707c, 3, 0.3);
      }
    } else if (zone === 'well') {
      rect(z0 + w * 0.1, z0 + w * 0.45, y0 + 0.2, y0 + Math.min(2.2, h * 0.5), 0x5b6a79, 3, 0.4);
      rect(z0 + w * 0.55, z0 + w * 0.9, y0 + 0.2, y0 + Math.min(2.2, h * 0.5), 0x5b6a79, 3, 0.4);
    } else if (zone === 'missile') {
      disc(cz, cy, Math.min(w, h) * 0.34, 0x2c1414, 3, 0.1);
      disc(cz, cy, Math.min(w, h) * 0.22, RD, 4, 0.6);
    } else if (zone === 'torp') {
      disc(cz, cy, Math.min(w, h) * 0.34, 0x1b2027, 3, 0.2);
      ring(cz, cy, Math.min(w, h) * 0.3, Math.min(w, h) * 0.38, 0xbfd0dc, 4, 0.4);
    } else if (zone === 'ops') {
      const n = Math.max(1, Math.floor(w / 1.3));
      for (let i = 0; i < n; i++) {
        const x = z0 + ((i + 0.5) * w) / n;
        rect(x - 0.42, x + 0.42, y0 + h * 0.15, y0 + h * 0.42, 0x15202a, 3, 0.2);
        rect(x - 0.34, x + 0.34, y0 + h * 0.3, y0 + h * 0.4, CY, 4, 0.9);
        disc(x, y0 + h * 0.1 + 0.05, 0.14, 0x4a5560, 4, 0.3);
      }
      rect(z0 + w * 0.08, z1 - w * 0.08, y0 + h * 0.78, y0 + h * 0.8, 0x7fd0e6, 3, 0.5);
    } else if (zone === 'berth') {
      const n = Math.max(1, Math.floor(w / 1.6));
      for (let i = 0; i < n; i++) {
        const x = z0 + ((i + 0.5) * w) / n;
        for (let r = 0; r < Math.max(2, Math.min(3, Math.floor(h / 0.7))); r++) {
          const y = y0 + 0.12 + (r * (h - 0.2)) / 3;
          rect(x - 0.62, x + 0.62, y, y + 0.5, 0x7f93b0, 3, 0.35);
          rect(x - 0.55, x + 0.1, y + 0.1, y + 0.42, [0x4a6a8f, 0x8f6a4a, 0x5a8f6a][(i + r) % 3], 4, 0.4);
          disc(x + 0.42, y + 0.28, 0.12, 0xd7c3a8, 4, 0.4);
        }
      }
    } else if (zone === 'stores') {
      const co = Math.max(2, Math.floor(w / 0.9));
      const ro = Math.max(1, Math.floor(h / 0.7));
      for (let i = 0; i < co; i++)
        for (let j = 0; j < ro; j++)
          if (rnd() < 0.85) {
            const x = z0 + ((i + 0.5) * w) / co;
            const y = y0 + ((j + 0.5) * h) / ro;
            rect(x - (w / co) * 0.42, x + (w / co) * 0.42, y - (h / ro) * 0.4, y + (h / ro) * 0.4, [0x7a6a4a, 0x5a6a7a, 0x6a7a5a][(i + j) % 3], 3, 0.3);
            rect(x - 0.03, x + 0.03, y - (h / ro) * 0.4, y + (h / ro) * 0.4, 0xcdbb94, 4, 0.3);
          }
    } else {
      const lv = Math.max(2, Math.floor(h / 0.9));
      for (let i = 0; i < lv; i++) {
        const y = y0 + (h * (i + 0.5)) / lv;
        rect(z0 + w * 0.1, z1 - w * 0.1, y - 0.07, y + 0.07, 0x9fb4cc, 3, 0.4);
      }
    }
  };
  const pipes = (w: number, yT: number) => {
    (
      [
        [-0.86, 0x5aa7e0],
        [-0.78, RD],
        [0.8, 0xe0c35a],
        [0.88, GN],
      ] as const
    ).forEach(([k, c]) => disc(w * k, yT - 0.25, 0.12, c, 3, 0.55));
    rect(-w * 0.55, w * 0.55, yT - 0.16, yT - 0.07, 0x4a5560, 3, 0.3);
  };
  const zoneFor = (base: Zone | 'tank', i: number, n: number): FillZone =>
    base === 'machinery'
      ? i === 0
        ? 'ops'
        : i === n - 1
          ? 'tank'
          : 'machinery'
      : base === 'vls'
        ? i === 0
          ? 'ops'
          : i <= 2
            ? 'vls'
            : 'stores'
        : base === 'reactor'
          ? i === 0
            ? 'ops'
            : i === n - 1
              ? 'tank'
              : 'reactor'
          : base === 'well'
            ? i === 0
              ? 'hangar'
              : i <= 2
                ? 'well'
                : 'stores'
            : (['ops', 'berth', 'stores', 'tank', 'tank'] as const)[Math.min(i, 4)];

  const baseZone = zoneAt(info, cx);
  let label = ZONE_NAME[baseZone] || 'Compartments';
  const fo = focus ? { x: focus.p.x, kind: focus.mount, col: COL[focus.st], z: focus.p.z, y: focus.p.y, top: focus.deck === 'top' } : null;
  const marks: [number, number, number][] = [];

  const splitRooms = (z0: number, z1: number, y0: number, y1: number, zn: FillZone) => {
    const w = z1 - z0;
    if (w < 0.7) return;
    const cnt = Math.max(1, Math.round(w / Math.max(2.4, (y1 - y0) * 1.4)));
    const b = [z0];
    for (let j = 1; j < cnt; j++) b.push(z0 + (w * j) / cnt + (rnd() - 0.5) * w * 0.05);
    b.push(z1);
    for (let j = 0; j < cnt; j++) fill(b[j] + 0.1, b[j + 1] - 0.1, y0, y1, zn);
  };
  /** Across-cut deck layout between the given deck levels, with the focus room carved out. */
  const layout = (levels: number[], wAt: (y: number) => number, zoneBase: Zone | 'tank', fy: number) => {
    const n = levels.length - 1;
    for (let i = 0; i < n; i++) {
      const yT = levels[i] - 0.14;
      const yB = levels[i + 1] + 0.14;
      const w = Math.min(wAt(yT), wAt(yB)) - 0.1;
      if (w < 0.6 || yT - yB < 0.4) continue;
      let zn = zoneFor(zoneBase, i, n);
      if (info.hangar && i === 0) zn = 'hangar';
      const hasF = !!fo && fy <= yT && fy >= yB;
      const fw = Math.min(w * 1.1, Math.max((yT - yB) * 2.5, 3.8));
      const fz = Math.max(-w + fw / 2, Math.min(w - fw / 2, fo ? fo.z : 0));
      if (zn === 'hangar' || zn === 'well' || zn === 'missile' || zn === 'torp') {
        fill(-w, w, yB, yT, zn === 'missile' || zn === 'torp' ? (i > 1 ? 'stores' : 'ops') : zn);
        if (hasF && fo) {
          rect(fz - fw / 2, fz + fw / 2, yB, yT, 0x0f1720, 2, 0.25);
          equip(fo.kind, fz, (yB + yT) / 2, fw - 0.3, yT - yB);
          marks.push([fz, (yB + yT) / 2, fw * 0.55]);
        }
        pipes(w, yT);
        continue;
      }
      if (hasF && fo) {
        splitRooms(-w, fz - fw / 2 - 0.05, yB, yT, zn);
        splitRooms(fz + fw / 2 + 0.05, w, yB, yT, zn);
        rect(fz - fw / 2, fz + fw / 2, yB, yT, 0x0f1720, 2, 0.25);
        equip(fo.kind, fz, (yB + yT) / 2, fw - 0.3, yT - yB);
        marks.push([fz, (yB + yT) / 2, fw * 0.55]);
      } else if (zn === 'reactor') {
        const b = [-w, 0, w];
        for (let j = 0; j < 2; j++) fill(b[j] + 0.1, b[j + 1] - 0.1, yB, yT, zn);
      } else splitRooms(-w, w, yB, yT, zn);
      pipes(w, yT);
    }
  };

  const ringMarks = () => {
    if (fo) for (const [z, y, R] of marks) {
      ring(z, y, R, R + 0.16, fo.col, 9, 1);
      disc(z, y, 0.22, fo.col, 9, 1);
    }
  };

  if (Z) {
    // ---------------- lengthwise cut: the face runs bow to stern
    const absz = Math.abs(cx);
    const fxx = fo ? fo.x : 0;
    const stN = 80;
    const runs = (xs: number[], ok: (i: number) => boolean, draw: (a: number, b: number) => void) => {
      let st: number | null = null;
      for (let i = 0; i < xs.length; i++) {
        const g2 = ok(i);
        if (g2 && st === null) st = xs[i];
        if ((!g2 || i === xs.length - 1) && st !== null) {
          draw(st, g2 ? xs[i] : xs[i - 1]);
          st = null;
        }
      }
    };
    if (info.sub) {
      const { Y, R } = info.sub;
      const Lh = info.len;
      const xa0 = -Lh / 2;
      const rr = (x: number) => {
        const r = info.sub!.r(x);
        const v = r * r - cx * cx;
        return v > 0 ? Math.sqrt(v) : 0;
      };
      const xs: number[] = [];
      for (let i = 0; i <= stN; i++) xs.push(xa0 + (Lh * i) / stN);
      const ok0 = xs.filter((x) => rr(x) > 0.3);
      if (ok0.length < 3) {
        grp.userData.label = 'Outside hull';
        return grp;
      }
      poly([...ok0.map((x) => [x, Y + rr(x)] as [number, number]), ...ok0.map((x) => [x, Y - rr(x)] as [number, number]).reverse()], 0x6b7884, 0, 0.3);
      poly([...ok0.map((x) => [x, Y + rr(x) * 0.94] as [number, number]), ...ok0.map((x) => [x, Y - rr(x) * 0.94] as [number, number]).reverse()], 0x070d15, 1, 0.2);
      for (const dy of [0.45, -0.05, -0.5]) runs(xs, (i) => rr(xs[i]) * 0.94 > Math.abs(dy * R) + 0.2, (a, b) => rect(a, b, Y + dy * R - 0.07, Y + dy * R + 0.07, 0xa4b0bb, 3, 0.4));
      rect(xa0 + 1, -Lh * 0.12, Y - 0.1, Y + 0.1, 0xa4b0bb, 4, 0.45);
      let zs: Zone | null = null;
      let za = xa0;
      for (let x = xa0; x <= -xa0 + 0.01; x += 1) {
        const z0 = zoneAt(info, x);
        if (zs === null) {
          zs = z0;
          za = x;
        }
        if (z0 !== zs || x >= -xa0 - 0.5) {
          const xb = x;
          const w = xb - za;
          const cm = (za + xb) / 2;
          if (w > 1.5 && rr(cm) > 1) {
            if (zs === 'missile') {
              for (let xx = za + 1.4; xx < xb - 0.8; xx += 2.7) {
                rect(xx - 1.15, xx + 1.15, Y - 0.28 * R, Y + 0.62 * R, 0x2c1414, 3, 0.1);
                rect(xx - 0.6, xx + 0.6, Y - 0.2 * R, Y + 0.46 * R, RD, 4, 0.6);
                disc(xx, Y + 0.46 * R, 0.6, RD, 4, 0.6);
                rect(xx - 1.15, xx + 1.15, Y + 0.62 * R, Y + 0.68 * R, 0x8e99a4, 4, 0.4);
              }
            } else if (zs === 'torp') {
              for (const dy of [-0.3, 0.1, 0.5]) {
                rect(za + 0.3, xb - 0.3, Y + dy * R - 0.4, Y + dy * R + 0.4, 0xbfd0dc, 3, 0.3);
                rect(za + 1, xb - 0.8, Y + dy * R - 0.22, Y + dy * R + 0.22, 0x6a7480, 4, 0.4);
              }
            } else if (zs === 'reactor') {
              LB = 3;
              equip('reactor', cm, Y + 0.02 * R, Math.min(w, R * 2.2), R * 1.5);
            } else if (zs === 'machinery') {
              LB = 3;
              equip('engine', cm, Y + 0.02 * R, Math.min(w, R * 2.2), R * 1.3);
            } else {
              fill(za + 0.15, xb - 0.15, Y + 0.08 * R, Y + 0.42 * R, 'ops');
              fill(za + 0.15, xb - 0.15, Y - 0.42 * R, Y - 0.1 * R, 'berth');
              fill(za + 0.15, xb - 0.15, Y - 0.8 * R + 0.2, Y - 0.5 * R, 'tank');
            }
          }
          za = x;
          zs = z0;
        }
      }
      const sl = info.sail;
      if (sl && absz < 1.6) {
        rect(sl.x0, sl.x1, sl.y0, sl.y1, 0x7b8793, 0, 0.3);
        rect(sl.x0 + 0.25, sl.x1 - 0.25, sl.y0 + 0.25, sl.y1 - 0.25, 0x070d15, 1, 0.2);
        rect(sl.x0 + 0.3, sl.x1 - 0.3, (sl.y0 + sl.y1) / 2 - 0.06, (sl.y0 + sl.y1) / 2 + 0.06, 0xa4b0bb, 3, 0.4);
        fill(sl.x0 + 0.4, sl.x1 - 0.4, sl.y0 + 0.4, (sl.y0 + sl.y1) / 2 - 0.2, 'ops');
        for (const [dx, hh] of [
          [-1.6, 4.5],
          [0, 3.5],
          [1.6, 5.2],
        ])
          rect((sl.x0 + sl.x1) / 2 + dx - 0.1, (sl.x0 + sl.x1) / 2 + dx + 0.1, sl.y1, sl.y1 + hh, 0xcfd8e0, 3, 0.45);
      }
      if (fo) {
        const fw = Math.min(14, R * 2.4);
        LB = 6;
        rect(fxx - fw / 2, fxx + fw / 2, Y - 0.55 * R, Y + 0.55 * R, 0x0f1720, 5, 0.25);
        equip(fo.kind, fxx, Y, fw - 0.3, R * 1.0);
        marks.push([fxx, Y, R * 0.5]);
        label = (KD[fo.kind] || [label])[0];
      }
    } else if (info.hc) {
      const hc = info.hc;
      const H = hc.HH;
      const pro = hullProfile(H, hc.flare || 1.04);
      const wfAt = (y: number) => {
        if (y >= pro[0][0]) return pro[0][1];
        for (let i = 0; i < pro.length - 1; i++) {
          const a = pro[i];
          const b = pro[i + 1];
          if (y <= a[0] && y >= b[0]) {
            const q = (y - b[0]) / (a[0] - b[0]);
            return b[1] + (a[1] - b[1]) * q;
          }
        }
        return 0;
      };
      /** Lowest height where the hull is at least |z| wide at station x (null = cut misses the hull here). */
      const ybAt = (x: number) => {
        const w = hc.hw(x);
        if (w * 1.04 < absz) return null;
        for (let i = 0; i <= 40; i++) {
          const y = (H * i) / 40;
          if (w * wfAt(y) >= absz) return y;
        }
        return H;
      };
      const xs: number[] = [];
      for (let i = 0; i <= stN; i++) xs.push(hc.x0 + ((hc.x1 - hc.x0) * i) / stN);
      const ybs = xs.map(ybAt);
      const ybn = (x: number) => ybs[Math.max(0, Math.min(stN, Math.round(((x - hc.x0) / (hc.x1 - hc.x0)) * stN)))];
      const vs = xs.map((x, i) => [x, ybs[i]] as [number, number | null]).filter((p): p is [number, number] => p[1] !== null);
      if (vs.length < 3) {
        grp.userData.label = 'Outside hull';
        return grp;
      }
      const vx0 = vs[0][0];
      const vx1 = vs[vs.length - 1][0];
      poly([...vs.map((p) => [p[0], H] as [number, number]), ...vs.map((p) => [p[0], p[1]] as [number, number]).reverse()], 0x6b7884, 0, 0.3);
      poly([...vs.map((p) => [p[0], H - 0.18] as [number, number]), ...vs.map((p) => [p[0], p[1] + 0.18] as [number, number]).reverse()], 0x070d15, 1, 0.2);
      const levels = [H * 0.9, H * 0.7, H * 0.48, H * 0.26, H * 0.05];
      for (const y of levels) runs(xs, (i) => ybs[i] !== null && ybs[i]! < y - 0.25, (a, b) => rect(a, b, y - 0.09, y + 0.09, 0xa4b0bb, 3, 0.4));
      const fy = fo ? (fo.top ? (info.flat ? (fo.kind === 'flight' ? H * 0.8 : H * 0.58) : H * 0.78) : fo.y) : 0;
      for (let i = 0; i < 4; i++) {
        const yT = levels[i] - 0.14;
        const yB = levels[i + 1] + 0.14;
        const hh = yT - yB;
        if (hh < 0.4) continue;
        const hasF = !!fo && fy <= yT && fy >= yB;
        const fw = Math.min(26, Math.max(hh * 3.2, 5.5));
        const sb = Math.max(4, hh * 2.6);
        let x = vx0 + 0.5;
        const roomOk = (a: number, b: number) => {
          const ya = ybn(a);
          const yb2 = ybn(b);
          const ym = ybn((a + b) / 2);
          return ya !== null && yb2 !== null && ym !== null && ya < yB - 0.1 && yb2 < yB - 0.1 && ym < yB - 0.1;
        };
        while (x < vx1 - 1) {
          const xe = Math.min(vx1 - 0.5, x + sb * (0.8 + rnd() * 0.5));
          const xm = (x + xe) / 2;
          let zn = zoneFor(zoneAt(info, xm), i, 5);
          if (info.hangar && i === 0) zn = 'hangar';
          const inF = hasF && xe > fxx - fw / 2 && x < fxx + fw / 2;
          if (inF) {
            if (fxx - fw / 2 - x > 1.2 && roomOk(x, fxx - fw / 2)) fill(x + 0.1, fxx - fw / 2 - 0.05, yB, yT, zn);
            if (xe - (fxx + fw / 2) > 1.2 && roomOk(fxx + fw / 2, xe)) fill(fxx + fw / 2 + 0.05, xe - 0.1, yB, yT, zn);
          } else if (roomOk(x, xe)) fill(x + 0.1, xe - 0.1, yB, yT, zn);
          x = xe;
        }
        if (hasF && fo) {
          rect(fxx - fw / 2, fxx + fw / 2, yB, yT, 0x0f1720, 2, 0.25);
          equip(fo.kind, fxx, (yB + yT) / 2, fw - 0.3, hh);
          marks.push([fxx, (yB + yT) / 2, Math.min(fw, hh * 2) * 0.5]);
        }
      }
      if (fo) label = (KD[fo.kind] || [label])[0];
      if (info.flat && info.deckPoly) {
        const sp = polySpan(
          info.deckPoly.map(([x, z]) => [z, x]),
          cx,
        );
        if (sp) rect(sp[0], sp[1], H, H + 1.2, 0x6f7a85, 2, 0.35);
      } else rect(vx0, vx1, H - 0.14, H + 0.14, 0xb8c4cf, 3, 0.4);
      for (const hs of info.houses || [])
        if (absz < hs.w / 2) {
          rect(hs.x0, hs.x1, hs.y0, hs.y0 + hs.h, 0x93a0ac, 0, 0.3);
          rect(hs.x0 + 0.25, hs.x1 - 0.25, hs.y0 + 0.2, hs.y0 + hs.h - 0.2, 0x0b141e, 1, 0.2);
          const q = hs.h > 6 ? 3 : 2;
          for (let i = 1; i < q; i++) rect(hs.x0 + 0.25, hs.x1 - 0.25, hs.y0 + (hs.h * i) / q - 0.07, hs.y0 + (hs.h * i) / q + 0.07, 0xa4b0bb, 3, 0.4);
          for (let i = 0; i < q; i++) {
            const n = Math.max(1, Math.round((hs.x1 - hs.x0) / 6));
            for (let j = 0; j < n; j++)
              fill(
                hs.x0 + 0.35 + (j * (hs.x1 - hs.x0 - 0.7)) / n + 0.1,
                hs.x0 + 0.35 + ((j + 1) * (hs.x1 - hs.x0 - 0.7)) / n - 0.1,
                hs.y0 + (hs.h * i) / q + 0.3,
                hs.y0 + (hs.h * (i + 1)) / q - 0.2,
                (i + j) % 2 ? 'berth' : 'ops',
              );
          }
        }
    }
    ringMarks();
    grp.userData.label = label + ' · lengthwise';
    return grp;
  }

  // ---------------- across cut: the face is a transverse section at x = cx
  if (info.sub) {
    const { Y } = info.sub;
    const r = info.sub.r(cx);
    if (r > 0.6) {
      const zb = baseZone;
      disc(0, Y, r, 0x6b7884, 0, 0.3);
      disc(0, Y, r * 0.94, 0x070d15, 1, 0.2);
      const ch = (y: number) => Math.sqrt(Math.max(0, r * r - (y - Y) * (y - Y))) * 0.93;
      const lv = [Y + 0.6 * r, Y + 0.12 * r, Y - 0.38 * r, Y - 0.8 * r];
      for (const y of lv) if (ch(y) > 0.3) rect(-ch(y), ch(y), y - 0.07, y + 0.07, 0xa4b0bb, 3, 0.4);
      if (fo) {
        layout(lv, ch, 'rooms', -1e9);
        LB = 6;
        rect(-r * 0.7, r * 0.7, Y - 0.42 * r, Y + 0.5 * r, 0x0f1720, 5, 0.25);
        equip(fo.kind, 0, Y + 0.04 * r, r * 1.34, r * 0.9);
        marks.push([0, Y + 0.04 * r, r * 0.5]);
        label = (KD[fo.kind] || [label])[0];
        const sl = info.sail;
        if (fo.top && sl && cx >= sl.x0 && cx <= sl.x1) rect(-0.1, 0.1, Y + 0.5 * r, sl.y1 + (fo.kind === 'sat' ? 5.2 : 4.2), 0xcfd8e0, 7, 0.5);
      } else if (zb === 'missile') {
        for (const sz of [-1, 1]) {
          disc(sz * r * 0.36, Y + 0.3 * r, r * 0.31, 0x8e99a4, 3, 0.3);
          disc(sz * r * 0.36, Y + 0.3 * r, r * 0.26, 0x2c1414, 4, 0.1);
          disc(sz * r * 0.36, Y + 0.3 * r, r * 0.17, RD, 5, 0.6);
        }
        layout(lv.slice(1), ch, 'rooms', -1e9);
      } else if (zb === 'torp') {
        LB = 3;
        equip('torpedo', 0, Y + 0.1 * r, r * 1.2, r * 1.1);
        layout(lv.slice(2), ch, 'rooms', -1e9);
      } else if (zb === 'reactor') {
        equip('reactor', 0, Y + 0.12 * r, r * 1.7, r * 0.85);
        layout(lv.slice(2), ch, 'rooms', -1e9);
      } else if (zb === 'machinery') {
        for (const sz of [-1, 1]) equip('engine', sz * r * 0.38, Y + 0.22 * r, r * 0.7, r * 0.7);
        layout(lv.slice(2), ch, 'tank', -1e9);
      } else layout(lv, ch, 'rooms', -1e9);
      if (!fo) label = ZONE_NAME[zb] || label;
    }
    const sl = info.sail;
    if (sl && cx >= sl.x0 && cx <= sl.x1) {
      rect(-1.7, 1.7, sl.y0, sl.y1, 0x7b8793, 0, 0.3);
      rect(-1.45, 1.45, sl.y0 + 0.25, sl.y1 - 0.25, 0x070d15, 1, 0.2);
      rect(-1.4, 1.4, sl.y0 + (sl.y1 - sl.y0) * 0.5 - 0.06, sl.y0 + (sl.y1 - sl.y0) * 0.5 + 0.06, 0xa4b0bb, 3, 0.4);
      rect(-1.2, -0.1, sl.y0 + 0.4, sl.y0 + (sl.y1 - sl.y0) * 0.5 - 0.2, ZC.ops, 2);
      rect(0.1, 1.2, sl.y0 + 0.4, sl.y0 + (sl.y1 - sl.y0) * 0.5 - 0.2, ZC.berth, 2);
      label += ' · sail';
    }
  } else if (info.hc) {
    const hc = info.hc;
    const hw = hc.hw(cx);
    if (hw > 0.8) {
      const pro = hullProfile(hc.HH, hc.flare || 1.04);
      const wAt = (y: number) => {
        for (let i = 0; i < pro.length - 1; i++) {
          const a = pro[i];
          const b = pro[i + 1];
          if (y <= a[0] && y >= b[0]) {
            const t = (y - b[0]) / (a[0] - b[0]);
            return hw * (b[1] + (a[1] - b[1]) * t);
          }
        }
        return 0;
      };
      const out: [number, number][] = [...pro.map(([y, w]) => [-hw * w, y] as [number, number]), ...pro.slice().reverse().map(([y, w]) => [hw * w, y] as [number, number])];
      poly(out, 0x6b7884, 0, 0.3);
      poly(
        out.map(([z, y]) => [z * 0.955, hc.HH * 0.5 + (y - hc.HH * 0.5) * 0.97]),
        0x070d15,
        1,
        0.2,
      );
      const H = hc.HH;
      const lv = [H * 0.9, H * 0.7, H * 0.48, H * 0.26, H * 0.05];
      const wa = (y: number) => wAt(y) * 0.955 - 0.05;
      for (const y of lv) rect(-wa(y), wa(y), y - 0.09, y + 0.09, 0xa4b0bb, 3, 0.4);
      for (let i = 0; i < 5; i++) {
        const y = H * (0.12 + 0.18 * i);
        const w = wa(y);
        for (const sz of [-1, 1]) rect(sz * w - 0.04, sz * w + 0.04, y - H * 0.09, y + H * 0.09, 0x8794a1, 3, 0.3);
      }
      const fy = fo ? (fo.top ? (info.flat ? (fo.kind === 'flight' ? H * 0.8 : H * 0.58) : H * 0.78) : fo.y) : 0;
      layout(lv, wa, baseZone, fy);
      if (fo) label = (KD[fo.kind] || [label])[0];
      rect(-wAt(H) * 0.98, wAt(H) * 0.98, H - 0.14, H + 0.14, 0xb8c4cf, 3, 0.4);
      if (info.flat && info.deckPoly) {
        const sp = polySpan(info.deckPoly, cx);
        if (sp) rect(sp[0], sp[1], H, H + 1.2, 0x6f7a85, 2, 0.35);
      }
      for (const hs of info.houses || [])
        if (cx >= hs.x0 && cx <= hs.x1) {
          const w = hs.w / 2;
          rect(-w, w, hs.y0, hs.y0 + hs.h, 0x93a0ac, 0, 0.3);
          rect(-w + 0.25, w - 0.25, hs.y0 + 0.2, hs.y0 + hs.h - 0.2, 0x0b141e, 1, 0.2);
          const q = hs.h > 6 ? 3 : 2;
          for (let i = 1; i < q; i++) rect(-w + 0.25, w - 0.25, hs.y0 + (hs.h * i) / q - 0.07, hs.y0 + (hs.h * i) / q + 0.07, 0xa4b0bb, 3, 0.4);
          for (let i = 0; i < q; i++) {
            fill(-w * 0.9, -w * 0.08, hs.y0 + (hs.h * i) / q + 0.3, hs.y0 + (hs.h * (i + 1)) / q - 0.2, i % 2 ? 'berth' : 'ops');
            fill(w * 0.08, w * 0.9, hs.y0 + (hs.h * i) / q + 0.3, hs.y0 + (hs.h * (i + 1)) / q - 0.2, i % 2 ? 'ops' : 'stores');
          }
        }
    }
  }
  ringMarks();
  grp.userData.label = label;
  return grp;
}

// ------------------------------------------------------------------- split

/** An open cut: two clipped clones of the hull sliding apart. */
export interface Split {
  cx: number;
  mode: CutMode;
  halves: THREE.Group[];
  planes: { fwd: THREE.Plane; aft: THREE.Plane };
  cur: number;
  gap: number;
  /** [source material, clipped clone] pairs, so x-ray can follow. */
  cm: [THREE.Material, THREE.Material][];
  focus: PinInfo | null;
  label: string;
}

/** Clamp a cut position to the hull (keeps a sliver at each end so both halves have something in them). */
export function clampCut(info: HullInfo, mode: CutMode, cx: number) {
  if (mode === 'z') {
    const lim = info.beam * 0.4;
    return Math.min(Math.max(cx, -lim), lim);
  }
  const sp = info.bb.max.x - info.bb.min.x;
  return Math.min(Math.max(cx, info.bb.min.x + sp * 0.06), info.bb.max.x - sp * 0.06);
}

/** Build both halves: each a deep clone of the hull with its own clipped materials plus a section cap. */
export function makeSplit(info: HullInfo, mode: CutMode, cx: number, focus: PinInfo | null, prev: Split | null): Split {
  const Zm = mode === 'z';
  const gap = Zm ? Math.max(10, info.beam * 0.6) : Math.max(12, info.len * 0.22);
  const planes = Zm
    ? { fwd: new THREE.Plane(V(0, 0, 1), -cx), aft: new THREE.Plane(V(0, 0, -1), cx) }
    : { fwd: new THREE.Plane(V(1, 0, 0), -cx), aft: new THREE.Plane(V(-1, 0, 0), cx) };
  const halves: THREE.Group[] = [];
  const cm: [THREE.Material, THREE.Material][] = [];
  let label = '';
  for (const [key, s] of [
    ['fwd', -1],
    ['aft', 1],
  ] as const) {
    const h = info.g.clone(true);
    h.name = 'half_' + key;
    h.visible = true;
    const map = new Map<THREE.Material, THREE.Material>();
    h.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.Material;
      let m = map.get(src);
      if (!m) {
        m = src.clone();
        m.clippingPlanes = [planes[key]];
        m.side = THREE.DoubleSide;
        m.clipShadows = true;
        map.set(src, m);
        cm.push([src, m]);
      }
      mesh.material = m;
    });
    const cap = buildCap(info, cx, s, focus, Zm);
    label = cap.userData.label as string;
    h.add(cap);
    halves.push(h);
  }
  return { cx, mode, halves, planes, cur: prev && prev.mode === mode ? prev.cur : 0, gap, cm, focus, label };
}

/** Free what a split owns: clipped material clones and the section caps (hull geometry is shared). */
export function disposeSplit(sp: Split) {
  for (const h of sp.halves) {
    h.parent?.remove(h);
    const cap = h.children.find((c) => c.name === 'cut_section');
    if (cap) disposeTree(cap);
  }
  for (const [, c] of sp.cm) c.dispose();
}
