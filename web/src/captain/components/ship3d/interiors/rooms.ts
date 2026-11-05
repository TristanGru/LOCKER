import * as THREE from 'three';
import type { HullInfo, Zone } from '../types';
import { Bx, Cy, led, ledMat, makeMats, pipes, rail, rnd, roomLights, shell, sign, Sph, texGrate, Tor, tray, type IMats, type InteriorRoom } from './kit';

export type Family =
  | 'turb'
  | 'gen'
  | 'chill'
  | 'jet'
  | 'shaft'
  | 'rack'
  | 'cic'
  | 'mag'
  | 'gun'
  | 'hangar'
  | 'bay'
  | 'reactor'
  | 'sonar'
  | 'reel'
  | 'torp'
  | 'cat'
  | 'arr'
  | 'elev'
  | 'well'
  | 'berth';

/** Mount key → compartment family. Unknown mounts fall through to the zone. */
export const MOUNT_FAMILY: Record<string, Family> = {
  engine_p: 'turb',
  engine_s: 'turb',
  engine: 'turb',
  genset_1: 'gen',
  genset_2: 'gen',
  chill: 'chill',
  waterjet: 'jet',
  propulsor: 'shaft',
  air_radar: 'rack',
  sat: 'rack',
  control: 'cic',
  photonics: 'cic',
  vls_fwd: 'mag',
  vls_aft: 'mag',
  magazine: 'mag',
  harpoon: 'mag',
  nsm: 'mag',
  ram: 'mag',
  vls: 'mag',
  gun: 'gun',
  gun_aft: 'gun',
  ciws: 'gun',
  flight: 'hangar',
  mission_bay: 'bay',
  reactor: 'reactor',
  sonar: 'sonar',
  sonar_bow: 'sonar',
  towed_array: 'reel',
  torpedo: 'torp',
  planes: 'torp',
  dds: 'torp',
  catapult: 'cat',
  arrest: 'arr',
  elev: 'elev',
  well: 'well',
};

const ZONE_FAMILY: Record<Zone, Family> = {
  machinery: 'turb',
  vls: 'mag',
  reactor: 'reactor',
  rooms: 'berth',
  well: 'well',
  missile: 'mag',
  torp: 'torp',
};

function famEngine(p: IMats, v: 'turb' | 'gen' | 'chill' | 'jet' | 'shaft', label = 'MACHINERY SPACE'): InteriorRoom {
  const W = 24;
  const L = 11;
  const H = 7.5;
  const G = shell(p, W, L, H, '#8f9d94');
  roomLights(G, p, W, L, H, 7);
  pipes(G, p, W, H, [
    [-3.6, 0.16, 'red'],
    [-3.1, 0.1, 'blue'],
    [3.4, 0.14, 'yel'],
    [3.9, 0.1, 'grn'],
    [-4.2, 0.13, 'sil'],
    [4.4, 0.18, 'white'],
  ]);
  tray(G, p, W, H, [-1.3, 1.6]);
  const bl: InteriorRoom['blockers'] = [];
  Bx(G, 11, 0.5, 3.4, p.dark, 0, 0.3, 0);
  if (v === 'gen') {
    Cy(G, 1.15, 1.15, 5.5, p.paint, 0, 2.1, 0, 'x');
    Cy(G, 1.3, 1.3, 0.5, p.steel, -2.9, 2.1, 0, 'x');
    Cy(G, 1.3, 1.3, 0.5, p.steel, 2.9, 2.1, 0, 'x');
    Bx(G, 3, 2.6, 2.4, p.steel, 5, 1.8, 0);
    // Control panel on the far side of the set, facing the walkway you start on.
    Bx(G, 2.2, 2.4, 1, p.rack, -5.6, 1.4, 2.6);
    for (let i = 0; i < 4; i++) Bx(G, 0.1, 0.1, 0.02, [p.ledG, p.ledA, p.ledG, p.ledR][i], -6.2 + i * 0.35, 2.2, 2.09);
    Bx(G, 1.2, 0.6, 0.03, p.scrT, -5.6, 1.5, 2.09);
  } else if (v === 'chill') {
    for (const z of [-1.5, 1.6]) {
      Cy(G, 1.0, 1.0, 8, p.steel, 0, 2.1, z, 'x');
      for (let i = -3; i <= 3; i++) Tor(G, 1.04, 0.07, p.dark, i * 1.1, 2.1, z, 'x');
      Cy(G, 0.6, 0.6, 1.4, p.paint, -4.8, 2.1, z, 'x');
    }
    for (const x of [-3, 2.5]) {
      Cy(G, 0.1, 0.1, 4, p.blue, x, 3.6, 0, 'z');
      Cy(G, 0.35, 0.35, 0.9, p.paint, x, 0.9, 3);
    }
  } else if (v === 'jet') {
    Cy(G, 1.6, 1.0, 5, p.steel, -1, 2.2, 0, 'x');
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const blade = Bx(G, 0.2, 0.06, 0.9, p.dark, -3.6, 2.2 + Math.sin(a) * 0.9, Math.cos(a) * 0.9);
      blade.rotation.x = a;
    }
    Cy(G, 0.5, 0.5, 7, p.steel, 6.5, 2.2, 0, 'x');
    Cy(G, 0.9, 0.9, 0.4, p.dark, 3.5, 2.2, 0, 'x');
  } else if (v === 'shaft') {
    Cy(G, 0.55, 0.55, W - 1, p.steel, 0, 1.6, 0, 'x');
    for (const x of [-5, 0, 6]) {
      Cy(G, 0.9, 0.9, 0.45, p.dark, x, 1.6, 0, 'x');
      Tor(G, 0.92, 0.06, p.yel, x + 0.25, 1.6, 0, 'x');
    }
    Bx(G, 3, 1.6, 1.8, p.paint, -2, 0.9, 0);
    Cy(G, 0.7, 0.7, 1.4, p.dark, 3, 1.6, 0, 'x');
  } else {
    Cy(G, 1.25, 1.25, 8, p.steel, -1, 2.4, 0, 'x');
    for (let i = -3; i <= 3; i++) Tor(G, 1.3, 0.09, p.dark, -1 + i * 1.2, 2.4, 0, 'x');
    Cy(G, 1.9, 1.25, 1.6, p.steel, -5.8, 2.4, 0, 'x');
    Bx(G, 3, 5.5, 3, p.sil, -6.9, 5.2, 0);
    Bx(G, 2, 3.8, 2, p.steel, 2, 5.6, 0);
    Cy(G, 0.4, 0.4, 2.2, p.dark, 4.1, 2.4, 0, 'x');
    Bx(G, 3.2, 2.8, 2.8, p.paint, 6.4, 2.2, 0);
    Cy(G, 0.5, 0.5, 4.2, p.steel, 10, 1.4, 0, 'x');
  }
  bl.push({ x0: -8, x1: 8.5, z0: -1.8, z1: 1.8 });
  if (v !== 'shaft') {
    for (const z of [-2.4, 2.4]) {
      const gr = new THREE.Mesh(new THREE.BoxGeometry(10, 0.08, 1), new THREE.MeshStandardMaterial({ map: texGrate(10, 1), roughness: 0.8 }));
      gr.position.set(0, 2.9, z);
      G.add(gr);
      rail(G, p, -5, 5, 1.1, z + (z < 0 ? -0.5 : 0.5));
    }
    for (const x of [-5, 5]) Bx(G, 0.3, 2.9, 0.3, p.dark, x, 1.45, -2.9);
  }
  for (const z of [-2.2, 2.2]) Bx(G, 11.8, 0.02, 0.12, p.yel, 0, 0.03, z);
  Bx(G, 2.2, 1.1, 0.9, p.paint, -8.5, 0.55, -4.6);
  const screen = Bx(G, 1.8, 0.5, 0.06, p.scrT, -8.5, 1.35, -4.35);
  screen.rotation.x = -0.4;
  for (let i = 0; i < 5; i++) Cy(G, 0.09, 0.09, 0.04, p.steel, -9.2 + i * 0.35, 0.95, -4.14, 'z');
  for (let i = 0; i < 4; i++) Cy(G, 0.22, 0.22, 1.6, p.yel, 3 + i * 0.8, 0.8, 4.8);
  for (const x of [-6, -4]) {
    Cy(G, 0.08, 0.08, 3.6, p.red, x, 1.8, -4.8);
    Tor(G, 0.2, 0.03, p.red, x, 1.2, -4.68, 'z');
  }
  sign(G, label, '#c4443a', '#ffffff', -W / 2 + 0.05, 3.6, 0, Math.PI / 2, 2.2);
  // Start on the side walkway, angled across the machinery; end-on, a turbine or generator reads as a ball.
  return { group: G, blockers: bl, eye: [-9.5, -3.6], look: [1, 0.3], bounds: [-W / 2 + 0.7, W / 2 - 0.7, -L / 2 + 0.6, L / 2 - 0.6] };
}

function famRack(p: IMats, which: 'radar' | 'comms' | 'equip' = 'equip'): InteriorRoom {
  const W = 18;
  const L = 8;
  const H = 3.4;
  const G = shell(p, W, L, H, '#aab3ad');
  roomLights(G, p, W, L, H, 6);
  pipes(G, p, W, H, [
    [-3.4, 0.07, 'red', H - 0.3],
    [3.4, 0.06, 'blue', H - 0.3],
  ]);
  tray(G, p, W, H, [-1.2, 1.2]);
  const bl: InteriorRoom['blockers'] = [];
  for (const z of [-2.4, 2.4]) {
    for (let i = 0; i < 13; i++) {
      const x = -7.2 + i * 1.2;
      const big = i === 6;
      Bx(G, 1, big ? 2.35 : 2.2, 0.8, p.rack, x, big ? 1.18 : 1.1, z);
      Bx(G, 0.9, 1.7, 0.04, p.dark, x, 1.15, z + (z < 0 ? 0.42 : -0.42));
      const f = z < 0 ? 1 : -1;
      if (big) Bx(G, 0.7, 1, 0.03, p.scrB, x, 1.4, z + f * 0.45);
      else {
        Bx(G, 0.36, 0.22, 0.02, [p.scrT, p.scrA, p.scrB][i % 3], x - 0.18, 1.62, z + f * 0.45);
        for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) if (rnd() < 0.7) Bx(G, 0.025, 0.025, 0.02, ledMat(p), x + 0.12 + k * 0.06, 1.72 - r * 0.07, z + f * 0.45);
      }
      for (let k = 0; k < 4; k++) Bx(G, 0.7, 0.03, 0.02, p.sil, x, 0.5 + k * 0.35, z + f * 0.44);
      const grille = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.02), new THREE.MeshStandardMaterial({ map: texGrate(5, 1.4), roughness: 0.7 }));
      grille.position.set(x, 2.0, z + f * 0.43);
      G.add(grille);
      for (const dx of [-0.42, 0.42]) Bx(G, 0.03, 0.5, 0.05, p.sil, x + dx, 1.15, z + f * 0.47);
      Bx(G, 0.4, 0.06, 0.02, p.white, x, 0.32, z + f * 0.45);
    }
    bl.push({ x0: -7.9, x1: 7.9, z0: z - 0.5, z1: z + 0.5 });
  }
  Bx(G, 0.35, H - 2.2, 0.25, p.brass, 0, 2.2 + (H - 2.2) / 2, -2.4);
  Bx(G, 10, 0.3, 0.25, p.brass, 0, H - 0.55, -2.4);
  Bx(G, 0.35, 0.3, 3.6, p.brass, 5, H - 0.55, -0.7);
  Bx(G, 2.2, 0.06, 1, p.dark, 6.8, 0.8, 0);
  Bx(G, 0.08, 0.7, 0.08, p.dark, 6.1, 0.4, 0.4);
  Bx(G, 0.08, 0.7, 0.08, p.dark, 7.5, 0.4, -0.4);
  Bx(G, 0.6, 0.4, 0.04, p.scrT, 6.5, 1.1, 0);
  Bx(G, 0.6, 0.4, 0.04, p.scrB, 7.2, 1.1, 0);
  Cy(G, 0.25, 0.25, 0.08, p.rubber, 8.2, 0.5, 0.6);
  Cy(G, 0.04, 0.04, 0.45, p.dark, 8.2, 0.28, 0.6);
  if (which === 'radar') {
    sign(G, 'RADAR EQUIPMENT', '#1f6f82', '#ffffff', -W / 2 + 0.05, 2.7, L * 0.2, Math.PI / 2, 1.8);
  } else if (which === 'comms') {
    sign(G, 'COMMUNICATIONS', '#1f6f82', '#ffffff', -W / 2 + 0.05, 2.7, L * 0.2, Math.PI / 2, 1.8);
  } else sign(G, 'EQUIPMENT ROOM', '#1f6f82', '#ffffff', -W / 2 + 0.05, 2.7, L * 0.2, Math.PI / 2, 1.8);
  return { group: G, blockers: bl, eye: [-8, 0], look: [1, 0], bounds: [-W / 2 + 0.6, W / 2 - 0.6, -L / 2 + 0.5, L / 2 - 0.5] };
}

function famCic(p: IMats): InteriorRoom {
  const W = 16;
  const L = 10;
  const H = 3.2;
  const G = shell(p, W, L, H, '#56646d', 0.3);
  for (let i = 0; i < 4; i++)
    for (const z of [-3, 3])
      Bx(G, 1.2, 0.05, 0.16, new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff6a4a, emissiveIntensity: 0.6 }), -5 + i * 3.4, H - 0.2, z);
  for (const [c, x, z, i] of [
    [0x4aa8ff, 6, -3, 28],
    [0x4aa8ff, 6, 3, 28],
    [0x3fd9e8, 0, 0, 22],
    [0xffa04a, -6, 0, 12],
  ] as const) {
    const light = new THREE.PointLight(c, i, 16, 1.6);
    light.position.set(x, 2.2, z);
    G.add(light);
  }
  for (const z of [-3.8, 0, 3.8]) Bx(G, 0.08, 2, 4.2, [p.scrB, p.scrT, p.scrB][Math.floor((z + 4) / 3.8)] ?? p.scrB, W / 2 - 0.15, 1.9, z);
  for (let r = 0; r < 3; r++)
    for (let k = 0; k < 5; k++) {
      const x = -5.6 + r * 2.9;
      const z = -4.4 + k * 2.2;
      Bx(G, 1.5, 0.9, 1, p.paint, x, 0.45, z);
      for (const dz of [-0.28, 0.28]) {
        const s = Bx(G, 0.05, 0.48, 0.6, [p.scrB, p.scrT, p.scrA][(r + k + (dz > 0 ? 1 : 0)) % 3], x + 0.2, 1.2, z + dz);
        s.rotation.z = -0.25;
      }
      Bx(G, 0.5, 0.04, 0.3, p.dark, x - 0.3, 0.93, z);
      Cy(G, 0.28, 0.28, 0.07, p.dark, x - 1.3, 0.5, z);
      Cy(G, 0.04, 0.04, 0.4, p.dark, x - 1.3, 0.25, z);
      Bx(G, 0.08, 0.5, 0.45, p.dark, x - 1.55, 0.8, z);
    }
  sign(G, 'COMBAT INFORMATION CENTER', '#0f1720', '#7fd0e6', -W / 2 + 0.05, 2.5, -2, Math.PI / 2, 2.4);
  return { group: G, blockers: [{ x0: -6.5, x1: -0.3, z0: -5, z1: 5 }], eye: [-7.2, 0], look: [1, 0], bounds: [-W / 2 + 0.7, W / 2 - 0.7, -L / 2 + 0.6, L / 2 - 0.6] };
}

function famMag(p: IMats, label = 'EXPLOSIVES  AUTHORIZED ONLY'): InteriorRoom {
  const W = 20;
  const L = 13;
  const H = 6.2;
  const G = shell(p, W, L, H, '#919c97');
  roomLights(G, p, W, L, H, 6);
  pipes(G, p, W, H, [
    [-5.9, 0.11, 'red'],
    [5.9, 0.11, 'red'],
    [-3, 0.07, 'red'],
    [3, 0.07, 'red'],
  ]);
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 5; j++) {
      if (j === 2) continue;
      const x = -7.2 + i * 1.6;
      const z = -5.4 + j * 2.7;
      Cy(G, 0.37, 0.37, 5.3, p.steel, x, 2.65, z);
      Cy(G, 0.43, 0.43, 0.14, p.dark, x, 5.3, z);
      Cy(G, 0.38, 0.38, 0.3, p.yel, x, 1.4, z);
      Bx(G, 0.9, 0.06, 0.9, p.dark, x, 0.03, z);
      Tor(G, 0.4, 0.03, p.red, x, 4.4, z);
    }
  for (const z of [-5.6, 5.6]) Bx(G, W - 1, 0.25, 0.2, p.yel, 0, H - 0.7, z);
  Bx(G, 0.3, 0.3, L - 2, p.yel, 2, H - 0.7, 0);
  Bx(G, 0.9, 0.5, 0.9, p.dark, 2, H - 1.05, 1.2);
  Cy(G, 0.03, 0.03, 2.3, p.dark, 2, H - 2.2, 1.2);
  Sph(G, 0.16, p.dark, 2, H - 3.4, 1.2);
  Bx(G, 3.2, 0.35, 1.1, p.dark, -3, 0.45, 0);
  for (const dx of [-1, 0, 1]) {
    Cy(G, 0.27, 0.27, 3.2, p.white, -3 + dx, 0.95, 0, 'x');
    Cy(G, 0.27, 0.27, 0.9, p.red, -1 + dx, 0.95, 0, 'x');
  }
  for (const dx of [-1.2, 1.2]) Cy(G, 0.16, 0.16, 0.1, p.rubber, -3 + dx, 0.16, 0.5, 'z');
  sign(G, label, '#c4443a', '#ffffff', -W / 2 + 0.05, 3.2, -2, Math.PI / 2, 2.8);
  return {
    group: G,
    blockers: [
      { x0: -8.1, x1: 8.1, z0: -6.3, z1: -0.9 },
      { x0: -8.1, x1: 8.1, z0: 0.9, z1: 6.3 },
    ],
    eye: [-9, 0],
    look: [1, 0],
    bounds: [-W / 2 + 0.7, W / 2 - 0.7, -L / 2 + 0.6, L / 2 - 0.6],
  };
}

function famGun(p: IMats): InteriorRoom {
  const W = 11;
  const L = 11;
  const H = 5.4;
  const G = shell(p, W, L, H, '#8e9a93');
  roomLights(G, p, W, L, H, 4);
  pipes(G, p, W, H, [
    [-4.2, 0.1, 'red'],
    [4.2, 0.1, 'blue'],
  ]);
  Cy(G, 2.3, 2.3, 1.2, p.dark, 0, 0.9, 0);
  Cy(G, 0.5, 0.5, 2.8, p.steel, 0, 1.6, 0);
  for (let i = 0; i < 22; i++) {
    const a = (i * Math.PI * 2) / 22;
    Cy(G, 0.2, 0.2, 1.4, p.shell, Math.cos(a) * 1.75, 1.9, Math.sin(a) * 1.75);
    Cy(G, 0.2, 0.01, 0.4, p.steel, Math.cos(a) * 1.75, 2.8, Math.sin(a) * 1.75);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 + 0.2;
    Cy(G, 0.18, 0.18, 1.2, p.shell, Math.cos(a), 1.8, Math.sin(a));
  }
  Cy(G, 0.7, 0.7, H, p.steel, 0, H / 2, 0);
  Tor(G, 0.72, 0.05, p.yel, 0, 2.2, 0);
  for (const s of [-1, 1])
    for (let i = 0; i < 6; i++) {
      Bx(G, 0.3, 1.6, 0.9, p.dark, s * 4.6, 0.8, -2.2 + i * 0.9);
      for (let k = 0; k < 3; k++) Cy(G, 0.15, 0.15, 1.2, p.shell, s * 4.6, 0.9, -2.5 + i * 0.9 + (k - 1) * 0.22);
    }
  Bx(G, 1.2, 0.5, 0.8, p.paint, 3, 0.3, 3.5);
  sign(G, 'GUN MAGAZINE', '#c4443a', '#ffffff', -W / 2 + 0.05, 3, -2, Math.PI / 2, 1.8);
  return { group: G, blockers: [{ x0: -2.6, x1: 2.6, z0: -2.6, z1: 2.6 }], eye: [-4.6, 0], look: [1, 0], bounds: [-W / 2 + 0.7, W / 2 - 0.7, -L / 2 + 0.6, L / 2 - 0.6] };
}

function famHangar(p: IMats, bay: boolean): InteriorRoom {
  const W = 30;
  const L = 18;
  const H = 7.5;
  const G = shell(p, W, L, H, '#aeb7b1', 1);
  roomLights(G, p, W, L, H, 8);
  pipes(G, p, W, H, [
    [-7, 0.1, 'red'],
    [7, 0.1, 'red'],
  ]);
  const bl: InteriorRoom['blockers'] = [];
  for (const z of [-6, 6]) Bx(G, W - 1, 0.4, 0.3, p.yel, 0, H - 0.6, z);
  if (!bay) {
    // The aircraft is parked on the flight deck, so the hangar is the empty maintenance bay.
    for (const [x, z] of [
      [-4, -3],
      [2, -3],
      [-4, 3],
      [2, 3],
      [-1, 0],
    ] as const) {
      Bx(G, 1.2, 0.04, 0.12, p.yel, x, 0.04, z);
      Bx(G, 0.12, 0.04, 1.2, p.yel, x, 0.05, z);
    }
    Bx(G, 3.2, 0.9, 1.1, p.paint, -8, 0.45, -6);
    Bx(G, 2.4, 0.08, 1, p.dark, -8, 1.4, -6);
    for (let i = 0; i < 4; i++) Bx(G, 0.15, 0.7, 0.4, p.steel, -8.8 + i * 0.5, 1.05, -6);
    Cy(G, 0.45, 0.45, 1.6, p.red, 6, 0.9, -6, 'x');
    Tor(G, 0.48, 0.06, p.dark, 6, 0.9, -6, 'x');
    Cy(G, 0.06, 0.06, 4, p.dark, 8.2, 0.5, -4, 'z');
    Bx(G, 1.4, 0.8, 0.9, p.orange, 4, 0.4, 6);
    Bx(G, 0.8, 1.1, 0.6, p.dark, 9, 0.55, 5);
    for (const z of [-1.2, 1.2]) Cy(G, 0.35, 0.35, 0.2, p.rubber, 9, 0.35, 5 + z, 'z');
    bl.push({ x0: -9.6, x1: -6.2, z0: -6.8, z1: -5.2 }, { x0: 7.4, x1: 10.2, z0: 4.2, z1: 6.6 });
    // Spare rotor blades on a wall rack.
    for (const x of [-3, 2.4]) Bx(G, 0.12, 2.2, 0.5, p.dark, x, 1.1, -8.4);
    for (let k = 0; k < 3; k++) {
      Bx(G, 6.2, 0.05, 0.42, p.heli, -0.3, 0.8 + k * 0.55, -8.35);
      Bx(G, 0.5, 0.06, 0.44, p.yel, 2.9, 0.8 + k * 0.55, -8.35);
    }
    bl.push({ x0: -3.5, x1: 3, z0: -9, z1: -7.9 });
    // Rolling maintenance stand.
    const st = new THREE.Group();
    for (const [dx, dz] of [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]] as const) {
      Bx(st, 0.07, 2.4, 0.07, p.yel, dx, 1.2, dz);
      Cy(st, 0.08, 0.08, 0.06, p.rubber, dx, 0.08, dz, 'z', 12);
    }
    Bx(st, 1.8, 0.06, 1.4, p.dark, 0, 2.4, 0);
    rail(st, p, -0.85, 0.85, 1.0, -0.7);
    for (let k = 0; k < 6; k++) Bx(st, 1.6, 0.04, 0.12, p.steel, 0, 0.35 + k * 0.35, 0.68);
    st.position.set(-1, 0, 3.4);
    G.add(st);
    bl.push({ x0: -2.1, x1: 0.1, z0: 2.5, z1: 4.3 });
    // Portable floodlight cart.
    Bx(G, 0.8, 0.5, 0.6, p.orange, 5.5, 0.4, 0);
    Cy(G, 0.04, 0.04, 2.2, p.dark, 5.5, 1.75, 0);
    for (const dz of [-0.3, 0.3]) {
      Bx(G, 0.3, 0.22, 0.12, p.dark, 5.5, 2.85, dz);
      Bx(G, 0.26, 0.18, 0.02, p.lamp, 5.5, 2.85, dz + (dz < 0 ? -0.07 : 0.07));
    }
    bl.push({ x0: 5, x1: 6, z0: -0.5, z1: 0.5 });
  } else {
    const cs = [0x5d7a5b, 0x7a6a4a, 0x4a6f8a, 0x8a5a4a];
    for (let i = 0; i < 5; i++)
      for (let k = 0; k < 2; k++)
        Bx(G, 6, 2.5, 2.4, new THREE.MeshStandardMaterial({ color: cs[(i + k) % 4], roughness: 0.6 }), -8 + i * 6.2, 1.25 + k * 2.55, -5.5);
    bl.push({ x0: -11, x1: 8, z0: -7, z1: -4 });
    Cy(G, 1, 1, 7, p.orange, 3, 1.1, 3, 'x');
    Bx(G, 7.4, 0.6, 2.2, p.dark, 3, 0.4, 3);
    bl.push({ x0: -1, x1: 7, z0: 1.5, z1: 4.5 });
  }
  for (let i = 0; i < 3; i++) {
    Bx(G, 1.4, 1.1, 0.8, p.red, -12 + i * 1.5, 0.55, 7.7);
    for (let k = 0; k < 3; k++) Bx(G, 1.3, 0.28, 0.02, p.dark, -12 + i * 1.5, 0.25 + k * 0.3, 7.28);
  }
  bl.push({ x0: -12.8, x1: -8, z0: 7, z1: 9 });
  for (let i = 0; i < 7; i++) Bx(G, 0.2, 5, 0.2, p.sil, W / 2 - 0.3, 2.5, -8 + i * 2.7);
  Bx(G, 0.2, 5, L - 1, new THREE.MeshStandardMaterial({ color: 0x8f9aa2, roughness: 0.6 }), W / 2 - 0.12, 2.5, 0);
  for (let k = 0; k < 10; k++) Bx(G, 0.22, 0.5, 1.6, [p.yel, p.dark][k % 2], W / 2 - 0.1, 0.5, -7.2 + k * 1.6);
  for (let i = 0; i < 8; i++) Tor(G, 0.12, 0.025, p.dark, -10 + i * 3, 0.03, -3 + (i % 2) * 6, 'y');
  sign(G, bay ? 'MISSION BAY' : 'AIRCRAFT ON DECK', '#1f6f82', '#ffffff', -W / 2 + 0.05, 5.2, 0, Math.PI / 2, 3.2);
  return { group: G, blockers: bl, eye: [-12.5, 2], look: [1, -0.1], bounds: [-W / 2 + 0.8, W / 2 - 0.8, -L / 2 + 0.8, L / 2 - 0.8] };
}

function famReactor(p: IMats): InteriorRoom {
  const W = 15;
  const L = 11;
  const H = 6.8;
  const G = shell(p, W, L, H, '#b0b9b3', 1.05);
  roomLights(G, p, W, L, H, 6);
  pipes(G, p, W, H, [
    [-4.4, 0.14, 'white'],
    [4.4, 0.14, 'white'],
    [-3.8, 0.08, 'red'],
  ]);
  const lead = new THREE.MeshStandardMaterial({ color: 0x5a6168, roughness: 0.7, metalness: 0.15 });
  lead.name = 'shield_grey';
  for (const z of [-5, 5]) Bx(G, W - 1, 3, 0.5, lead, 0, 1.5, z);
  Cy(G, 1.7, 1.7, 5.2, p.steel, 0, 2.7, 0);
  Cy(G, 1.9, 1.9, 0.5, p.dark, 0, 5.4, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i * Math.PI * 2) / 9;
    Cy(G, 0.11, 0.11, 1.4, p.dark, Math.cos(a), 6.4, Math.sin(a), 'y', 10);
  }
  Tor(G, 1.75, 0.12, p.steel, 0, 1.2, 0);
  Tor(G, 1.75, 0.12, p.steel, 0, 4.2, 0);
  for (const z of [-3.6, 3.6]) {
    Cy(G, 1.15, 1.15, 4.6, p.white, 0, 2.5, z);
    Cy(G, 0.9, 0.9, 0.6, p.steel, 0, 5, z);
    Cy(G, 0.32, 0.32, Math.abs(z) - 1.5, p.white, 0, 3.2, z / 2, 'z');
    Tor(G, 1.2, 0.06, p.yel, 0, 1.4, z);
  }
  const gr = new THREE.Mesh(new THREE.BoxGeometry(W - 2, 0.08, 3), new THREE.MeshStandardMaterial({ map: texGrate(8, 1.6), roughness: 0.8 }));
  gr.position.set(0, 0.6, 0);
  G.add(gr);
  rail(G, p, -6, 6, 1.1, -1.8);
  rail(G, p, -6, 6, 1.1, 1.8);
  sign(G, 'RADIOLOGICAL CONTROLS', '#d9b92e', '#14181c', -W / 2 + 0.05, 3, -2, Math.PI / 2, 2.6);
  sign(G, 'REACTOR COMPARTMENT', '#c4443a', '#ffffff', W / 2 - 0.05, 3, 2, -Math.PI / 2, 2.6);
  return {
    group: G,
    blockers: [
      { x0: -2, x1: 2, z0: -2, z1: 2 },
      { x0: -1.4, x1: 1.4, z0: -5, z1: -2.2 },
      { x0: -1.4, x1: 1.4, z0: 2.2, z1: 5 },
    ],
    eye: [-6.2, 0],
    look: [1, 0],
    bounds: [-W / 2 + 0.7, W / 2 - 0.7, -L / 2 + 0.6, L / 2 - 0.6],
  };
}

function famSonar(p: IMats, reel: boolean): InteriorRoom {
  const W = 13;
  const L = 8;
  const H = 3;
  const G = shell(p, W, L, H, '#a1ada6', 0.7);
  roomLights(G, p, W, L, H, 5);
  tray(G, p, W, H, [-1.5, 1.5]);
  const bl: InteriorRoom['blockers'] = [];
  if (reel) {
    Cy(G, 1.5, 1.5, 0.15, p.steel, 0, 1.7, -1.3, 'z');
    Cy(G, 1.5, 1.5, 0.15, p.steel, 0, 1.7, 1.3, 'z');
    Cy(G, 1.15, 1.15, 2.5, new THREE.MeshStandardMaterial({ color: 0x23282d, roughness: 0.9 }), 0, 1.7, 0, 'z');
    Cy(G, 0.3, 0.3, 3, p.dark, 0, 1.7, 0, 'z');
    Bx(G, 2.6, 1.2, 1.4, p.paint, -3.2, 0.7, 0);
    Cy(G, 0.06, 0.06, 5, p.dark, 3.2, 1.5, 0.5, 'x');
    Bx(G, 3, 0.5, 3.4, p.dark, 0, 0.25, 0);
    bl.push({ x0: -1.8, x1: 1.8, z0: -2, z1: 2 }, { x0: -4.2, x1: -2, z0: -1, z1: 1 });
  } else {
    for (let i = 0; i < 5; i++) {
      const z = -3.4;
      Bx(G, 1, 2.2, 0.8, p.rack, -5 + i * 1.2, 1.1, z);
      Bx(G, 0.9, 1.7, 0.04, p.dark, -5 + i * 1.2, 1.15, z + 0.42);
      led(G, p, -5 + i * 1.2, 1.7, z + 0.45, 0);
    }
    bl.push({ x0: -5.6, x1: 0.8, z0: -3.9, z1: -2.9 });
    Cy(G, 1.3, 1.3, 0.06, new THREE.MeshStandardMaterial({ color: 0x061c22, emissive: 0x2fd0d8, emissiveIntensity: 0.9 }), W / 2 - 0.08, 1.7, 0, 'x');
    for (let k = 1; k < 4; k++) Tor(G, 0.3 * k, 0.012, p.scrT, W / 2 - 0.12, 1.7, 0, 'x');
    for (let i = 0; i < 3; i++) {
      Bx(G, 1.5, 0.9, 1, p.paint, 2.5, 0.45, -2 + i * 2);
      const scr = Bx(G, 0.05, 0.5, 0.7, [p.scrT, p.scrB, p.scrA][i], 2.7, 1.2, -2 + i * 2);
      scr.rotation.z = -0.25;
      Cy(G, 0.25, 0.25, 0.07, p.dark, 1.4, 0.5, -2 + i * 2);
      Cy(G, 0.04, 0.04, 0.4, p.dark, 1.4, 0.25, -2 + i * 2);
    }
    bl.push({ x0: 1.6, x1: 3.4, z0: -3, z1: 3 });
  }
  sign(G, reel ? 'TOWED ARRAY HANDLING' : 'SONAR EQUIPMENT ROOM', '#1f6f82', '#ffffff', -W / 2 + 0.05, 2.4, -2, Math.PI / 2, 2.2);
  return { group: G, blockers: bl, eye: [-5.5, 0], look: [1, 0], bounds: [-W / 2 + 0.6, W / 2 - 0.6, -L / 2 + 0.5, L / 2 - 0.5] };
}

function famTorp(p: IMats): InteriorRoom {
  const W = 22;
  const L = 7;
  const H = 3.4;
  const G = shell(p, W, L, H, '#98a39d');
  roomLights(G, p, W, L, H, 6);
  pipes(G, p, W, H, [
    [-2.8, 0.08, 'red', H - 0.3],
    [2.8, 0.08, 'blue', H - 0.3],
  ]);
  const body = new THREE.MeshStandardMaterial({ color: 0x6b7782, metalness: 0.3, roughness: 0.5 });
  body.name = 'torpedo_body';
  for (const s of [-1, 1])
    for (let r = 0; r < 3; r++) {
      Bx(G, 16, 0.1, 0.8, p.bunk, -1.5, 0.35 + r * 0.82, s * 2.3);
      Cy(G, 0.27, 0.27, 6.2, body, -4 + (r % 2) * 1.4, 0.72 + r * 0.82, s * 2.3, 'x');
      Cy(G, 0.27, 0.27, 0.9, [p.orange, p.red, p.yel][r], -0.45 + (r % 2) * 1.4, 0.72 + r * 0.82, s * 2.3, 'x');
      Cy(G, 0.27, 0.27, 6.2, body, 5.4, 0.72 + r * 0.82, s * 2.3, 'x');
      Cy(G, 0.27, 0.27, 0.9, p.steel, 8.95, 0.72 + r * 0.82, s * 2.3, 'x');
    }
  for (const [y, z] of [
    [2.2, -0.9],
    [2.2, 0.9],
    [1.1, -0.9],
    [1.1, 0.9],
  ] as const) {
    Cy(G, 0.4, 0.4, 0.2, p.dark, W / 2 - 0.15, y, z, 'x');
    Tor(G, 0.4, 0.05, p.steel, W / 2 - 0.26, y, z, 'x');
    Cy(G, 0.07, 0.07, 0.5, p.red, W / 2 - 0.3, y + 0.2, z, 'x');
  }
  Bx(G, 0.1, 0.06, 5, p.yel, -1.5, 0.03, 0);
  Bx(G, 16, 0.08, 0.08, p.steel, -1.5, H - 0.8, 0);
  sign(G, 'TORPEDO ROOM', '#c4443a', '#ffffff', -W / 2 + 0.05, 2.7, -1, Math.PI / 2, 1.8);
  return {
    group: G,
    blockers: [
      { x0: -8, x1: 10, z0: -2.8, z1: -1.8 },
      { x0: -8, x1: 10, z0: 1.8, z1: 2.8 },
    ],
    eye: [-9.5, 0],
    look: [1, 0],
    bounds: [-W / 2 + 0.6, W / 2 - 0.6, -L / 2 + 0.5, L / 2 - 0.5],
  };
}

function famDeck(p: IMats, v: 'cat' | 'arr' | 'elev' | 'well'): InteriorRoom {
  const W = 22;
  const L = 11;
  const H = 6;
  const G = shell(p, W, L, H, '#8f9c94');
  roomLights(G, p, W, L, H, 6);
  pipes(G, p, W, H, [
    [-4.4, 0.14, 'white'],
    [4.4, 0.12, 'red'],
    [3.8, 0.08, 'blue'],
  ]);
  const bl: InteriorRoom['blockers'] = [];
  if (v === 'cat') {
    for (const z of [-2.6, 2.6]) {
      Cy(G, 1.35, 1.35, 9, p.steel, -2, 1.6, z, 'x');
      for (let i = -3; i <= 3; i++) Tor(G, 1.4, 0.08, p.dark, -2 + i * 1.3, 1.6, z, 'x');
      Cy(G, 0.25, 0.25, 3.6, p.white, 3.8, 2.5, z, 'z');
    }
    bl.push({ x0: -7, x1: 3, z0: -4.2, z1: 4.2 });
    Bx(G, 2, 1.2, 0.8, p.paint, 5.5, 0.6, -4.5);
    Bx(G, 1.8, 0.5, 0.06, p.scrT, 5.5, 1.4, -4.2);
  } else if (v === 'arr') {
    for (const z of [-3, 3]) {
      Cy(G, 1, 1, 6, p.paint, 0, 1.3, z, 'x');
      Cy(G, 0.7, 0.7, 0.6, p.steel, 3.3, 1.3, z, 'x');
      Cy(G, 1.3, 1.3, 1.4, p.dark, 5, 1.7, z, 'z');
      Cy(G, 0.3, 0.3, 1.8, p.steel, -3.6, 1.3, z, 'x');
    }
    bl.push({ x0: -4, x1: 6.5, z0: -4.4, z1: 4.4 });
  } else if (v === 'elev') {
    for (const [x, z] of [
      [-3, -3],
      [3, -3],
      [-3, 3],
      [3, 3],
    ] as const)
      Bx(G, 0.3, H, 0.3, p.dark, x, H / 2, z);
    Bx(G, 6.4, 0.35, 6.4, p.paint, 0, 2.2, 0);
    Cy(G, 0.45, 0.45, 2.2, p.steel, 0, 1.1, 0);
    Cy(G, 0.55, 0.55, 0.5, p.dark, 0, 0.25, 0);
    Bx(G, 6, 0.04, 6, p.yel, 0, 2.42, 0);
    bl.push({ x0: -3.4, x1: 3.4, z0: -3.4, z1: 3.4 });
  } else {
    const wm = new THREE.MeshStandardMaterial({ color: 0x1d6a8a, transparent: true, opacity: 0.75, roughness: 0.1 });
    wm.name = 'seawater';
    Bx(G, W - 1.5, 0.1, L - 1.5, wm, 0, 0.25, 0);
    const lc = new THREE.MeshStandardMaterial({ color: 0x4e5b52, roughness: 0.7 });
    lc.name = 'craft_hull';
    Bx(G, 9, 1.3, 4.4, lc, -2, 1.1, 0);
    Bx(G, 9.6, 0.5, 5, p.rubber, -2, 0.6, 0);
    Bx(G, 3, 1.4, 2.2, p.white, -4, 2.2, 0);
    for (const x of [2, 3.4]) Cy(G, 0.7, 0.7, 0.2, p.dark, x, 2, 0);
    for (const x of [-5.6, -0.4]) Cy(G, 0.9, 0.9, 0.3, p.sil, x, 1.9, 2.4, 'z');
    bl.push({ x0: -7, x1: 3, z0: -3.2, z1: 3.2 });
  }
  const label = v === 'cat' ? 'CATAPULT MACHINERY' : v === 'arr' ? 'ARRESTING GEAR ENGINES' : v === 'elev' ? 'ELEVATOR PIT' : 'WELL DECK';
  sign(G, label, '#d9b92e', '#14181c', -W / 2 + 0.05, 3.4, -2, Math.PI / 2, 2.6);
  return { group: G, blockers: bl, eye: [-9.5, 0], look: [1, 0], bounds: [-W / 2 + 0.7, W / 2 - 0.7, -L / 2 + 0.6, L / 2 - 0.6] };
}

function famBerth(p: IMats, label = 'BERTHING'): InteriorRoom {
  const W = 16;
  const L = 6.4;
  const H = 2.6;
  const G = shell(p, W, L, H, '#a9b0b6', 0.9);
  roomLights(G, p, W, L, H, 6);
  pipes(G, p, W, H, [
    [-2.5, 0.06, 'blue', H - 0.25],
    [2.6, 0.06, 'red', H - 0.25],
  ]);
  for (const s of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const x = -5.4 + i * 2.6;
      for (let r = 0; r < 3; r++) {
        Bx(G, 2.1, 0.08, 0.95, p.bunk, x, 0.3 + r * 0.72, s * 2.4);
        Bx(G, 2, 0.12, 0.85, p.rubberW, x, 0.4 + r * 0.72, s * 2.4);
        Bx(G, 0.5, 0.1, 0.3, p.white, x - 0.7, 0.5 + r * 0.72, s * 2.4);
        Bx(G, 1.4, 0.08, 0.8, [p.olive, p.navy, p.olive][r], x + 0.2, 0.48 + r * 0.72, s * 2.4);
      }
      for (const z of [-0.45, 0.45]) {
        Bx(G, 0.06, 2.3, 0.06, p.bunk, x - 1.05, 1.15, s * 2.4 + z);
        Bx(G, 0.06, 2.3, 0.06, p.bunk, x + 1.05, 1.15, s * 2.4 + z);
      }
      Bx(G, 0.6, 1.9, 0.5, p.paint, x + 1.7, 0.95, s * 2.95);
    }
  const night = new THREE.PointLight(0xff5a4a, 10, 10, 1.5);
  night.position.set(0, H - 0.4, 0);
  G.add(night);
  sign(G, label, '#2c4a6e', '#ffffff', -W / 2 + 0.05, 2, -1.5, Math.PI / 2, 1.4);
  return {
    group: G,
    blockers: [
      { x0: -7, x1: 7, z0: -3.1, z1: -1.7 },
      { x0: -7, x1: 7, z0: 1.7, z1: 3.1 },
    ],
    eye: [-7, 0],
    look: [1, 0],
    bounds: [-W / 2 + 0.6, W / 2 - 0.6, -L / 2 + 0.5, L / 2 - 0.5],
  };
}

function famSteering(p: IMats): InteriorRoom {
  const W = 14;
  const L = 10;
  const H = 5;
  const G = shell(p, W, L, H, '#8d9892');
  roomLights(G, p, W, L, H, 4);
  pipes(G, p, W, H, [
    [-4, 0.12, 'yel'],
    [4, 0.1, 'red'],
  ]);
  for (const z of [-2.2, 2.2]) {
    Cy(G, 0.55, 0.55, 3.6, p.steel, 1.2, 1.8, z);
    Bx(G, 3.4, 0.28, 0.45, p.dark, -0.8, 2.2, z);
    Cy(G, 0.22, 0.22, 2.2, p.paint, -2.6, 1.5, z, 'x');
    Tor(G, 0.6, 0.05, p.yel, 1.2, 3.4, z);
  }
  Bx(G, 2.2, 1.3, 1.1, p.paint, 4.4, 0.65, 0);
  Bx(G, 1.4, 0.5, 0.06, p.scrT, 4.4, 1.5, 0.2);
  sign(G, 'STEERING GEAR', '#c4443a', '#ffffff', -W / 2 + 0.05, 3.2, -2, Math.PI / 2, 2);
  return {
    group: G,
    blockers: [
      { x0: -1.2, x1: 2.4, z0: -3, z1: -1.4 },
      { x0: -1.2, x1: 2.4, z0: 1.4, z1: 3 },
    ],
    eye: [-5.2, 0],
    look: [1, 0],
    bounds: [-W / 2 + 0.6, W / 2 - 0.6, -L / 2 + 0.6, L / 2 - 0.6],
  };
}

function famStores(p: IMats): InteriorRoom {
  const W = 14;
  const L = 8;
  const H = 3.1;
  const G = shell(p, W, L, H, '#a7aea8', 0.85);
  roomLights(G, p, W, L, H, 4);
  for (const s of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const x = -4.5 + i * 2.4;
      Bx(G, 2, 2.2, 0.7, p.paint, x, 1.1, s * 3.1);
      for (let k = 0; k < 3; k++) Bx(G, 1.5, 0.35, 0.5, [p.olive, p.dark, p.navy][k], x, 0.4 + k * 0.6, s * 2.7);
    }
  Cy(G, 0.18, 0.18, 3.2, p.dark, 5.2, 0.3, 0, 'x');
  for (let i = 0; i < 5; i++) Tor(G, 0.28, 0.05, p.steel, 4.2 + i * 0.45, 0.35, 0, 'x');
  sign(G, 'BOW STORES', '#2c4a6e', '#ffffff', -W / 2 + 0.05, 2.3, -1, Math.PI / 2, 1.6);
  return {
    group: G,
    blockers: [
      { x0: -5.6, x1: 3.2, z0: -3.6, z1: -2.6 },
      { x0: -5.6, x1: 3.2, z0: 2.6, z1: 3.6 },
    ],
    eye: [-6, 0],
    look: [1, 0],
    bounds: [-W / 2 + 0.5, W / 2 - 0.5, -L / 2 + 0.5, L / 2 - 0.5],
  };
}

/** Side passage. Doors face the side you entered from, so port and starboard are different rooms. */
function famPassage(p: IMats, port: boolean): InteriorRoom {
  const W = 24;
  const L = 3.6;
  const H = 2.5;
  const G = shell(p, W, L, H, '#9aa3a8', 0.8);
  roomLights(G, p, W, L, H, 8);
  const z = port ? 1.15 : -1.15;
  ['ENG RM', 'MAG', 'GEN', 'CIC', 'RADAR', 'GUN'].forEach((name, i) => {
    const x = -9 + i * 3.4;
    Bx(G, 1.05, 2.05, 0.08, p.paint, x, 1.05, z);
    sign(G, name, '#1c2830', '#d5e2ea', x, 1.65, z + (port ? -0.1 : 0.1), port ? 0 : Math.PI, 0.9);
  });
  Bx(G, W - 2, 0.03, 0.28, p.yel, 0, 0.03, 0);
  sign(G, port ? 'PORT PASSAGE' : 'STBD PASSAGE', '#2c4a6e', '#ffffff', -W / 2 + 0.05, 2, 0, Math.PI / 2, 1.8);
  return { group: G, blockers: [], eye: [-10, 0], look: [1, 0], bounds: [-W / 2 + 0.5, W / 2 - 0.5, -L / 2 + 0.45, L / 2 - 0.45] };
}

type Kind =
  | 'hangar'
  | 'steering'
  | 'engine-p'
  | 'engine-s'
  | 'mag-aft'
  | 'mag-fwd'
  | 'gen-1'
  | 'gen-2'
  | 'cic'
  | 'comms'
  | 'chill'
  | 'radar'
  | 'gun'
  | 'sonar'
  | 'stores'
  | 'berth-fwd'
  | 'berth-aft'
  | 'passage-p'
  | 'passage-s'
  | 'reactor'
  | 'well'
  | 'bay'
  | 'torp'
  | 'cat'
  | 'arr'
  | 'elev'
  | 'jet'
  | 'shaft'
  | 'reel';

const MOUNT_KIND: Record<string, Kind> = {
  flight: 'hangar',
  mission_bay: 'bay',
  engine_p: 'engine-p',
  engine: 'engine-p',
  engine_s: 'engine-s',
  genset_1: 'gen-1',
  genset_2: 'gen-2',
  chill: 'chill',
  waterjet: 'jet',
  propulsor: 'shaft',
  air_radar: 'radar',
  sat: 'comms',
  control: 'cic',
  photonics: 'cic',
  vls_fwd: 'mag-fwd',
  vls: 'mag-fwd',
  vls_aft: 'mag-aft',
  magazine: 'mag-aft',
  harpoon: 'mag-aft',
  nsm: 'mag-fwd',
  ram: 'gun',
  gun: 'gun',
  gun_aft: 'gun',
  ciws: 'gun',
  reactor: 'reactor',
  sonar: 'sonar',
  sonar_bow: 'sonar',
  towed_array: 'reel',
  torpedo: 'torp',
  planes: 'torp',
  dds: 'torp',
  catapult: 'cat',
  arrest: 'arr',
  elev: 'elev',
  well: 'well',
};

/** Stern to bow. A hull click lands in the compartment that owns that station. */
const ALONG: { u: number; kind: Kind }[] = [
  { u: 0.1, kind: 'hangar' },
  { u: 0.18, kind: 'steering' },
  { u: 0.26, kind: 'berth-aft' },
  { u: 0.34, kind: 'engine-p' },
  { u: 0.42, kind: 'mag-aft' },
  { u: 0.5, kind: 'engine-s' },
  { u: 0.56, kind: 'gen-1' },
  { u: 0.62, kind: 'comms' },
  { u: 0.68, kind: 'chill' },
  { u: 0.74, kind: 'radar' },
  { u: 0.8, kind: 'cic' },
  { u: 0.86, kind: 'gen-2' },
  { u: 0.91, kind: 'mag-fwd' },
  { u: 0.95, kind: 'gun' },
  { u: 0.98, kind: 'sonar' },
  { u: 1.02, kind: 'stores' },
];

const COPY: Record<Kind, [string, string]> = {
  hangar: ['Hangar bay', 'Tie-downs and maintenance gear. The aircraft is on the flight deck.'],
  steering: ['Steering gear room', 'Rudder stocks and hydraulic rams'],
  'engine-p': ['Port main engine room', 'Gas turbine, reduction gear and uptake'],
  'engine-s': ['Starboard main engine room', 'Gas turbine, reduction gear and uptake'],
  'mag-aft': ['Aft missile magazine', 'Aft vertical launch cells'],
  'mag-fwd': ['Forward missile magazine', 'Forward vertical launch cells'],
  'gen-1': ['No. 1 generator room', 'Aft ship service generator'],
  'gen-2': ['No. 2 generator room', 'Forward ship service generator'],
  cic: ['Combat information center', 'Consoles and status boards'],
  comms: ['Communications room', 'Racks for exterior communications. The antennas are on the mast.'],
  chill: ['Air conditioning plant', 'Chilled water for the combat systems'],
  radar: ['Radar equipment room', 'Transmitters and waveguide. The arrays are topside.'],
  gun: ['Gun magazine', 'Ammunition handling under the mount'],
  sonar: ['Sonar equipment room', 'Processing racks for the bow array'],
  stores: ['Bow stores', 'Bosun stores and ground tackle'],
  'berth-fwd': ['Forward berthing', 'Enlisted berthing, forward'],
  'berth-aft': ['Aft berthing', 'Enlisted berthing, aft'],
  'passage-p': ['Port passageway', 'Port access between the main compartments'],
  'passage-s': ['Starboard passageway', 'Starboard access between the main compartments'],
  reactor: ['Reactor compartment', 'Reactor vessel and steam generators'],
  well: ['Well deck', 'Landing craft bay'],
  bay: ['Mission bay', 'Mission modules and boats'],
  torp: ['Torpedo room', 'Tubes and weapons stowage'],
  cat: ['Catapult machinery', 'Launch accumulators'],
  arr: ['Arresting gear room', 'Arresting engines'],
  elev: ['Elevator pit', 'Platform and ram'],
  jet: ['Waterjet room', 'Impeller and duct'],
  shaft: ['Shaft alley', 'Line shaft and bearings'],
  reel: ['Towed array room', 'Winch and cable reel'],
};

function roomFor(kind: Kind, p: IMats): InteriorRoom {
  switch (kind) {
    case 'hangar':
      return famHangar(p, false);
    case 'bay':
      return famHangar(p, true);
    case 'steering':
      return famSteering(p);
    case 'engine-p':
      return famEngine(p, 'turb', 'PORT MAIN ENGINE');
    case 'engine-s':
      return famEngine(p, 'turb', 'STBD MAIN ENGINE');
    case 'gen-1':
      return famEngine(p, 'gen', 'NO. 1 GENERATOR');
    case 'gen-2':
      return famEngine(p, 'gen', 'NO. 2 GENERATOR');
    case 'chill':
      return famEngine(p, 'chill', 'A/C PLANT');
    case 'jet':
      return famEngine(p, 'jet');
    case 'shaft':
      return famEngine(p, 'shaft', 'SHAFT ALLEY');
    case 'radar':
      return famRack(p, 'radar');
    case 'comms':
      return famRack(p, 'comms');
    case 'cic':
      return famCic(p);
    case 'mag-aft':
      return famMag(p, 'AFT MISSILE MAGAZINE');
    case 'mag-fwd':
      return famMag(p, 'FWD MISSILE MAGAZINE');
    case 'gun':
      return famGun(p);
    case 'reactor':
      return famReactor(p);
    case 'sonar':
      return famSonar(p, false);
    case 'reel':
      return famSonar(p, true);
    case 'torp':
      return famTorp(p);
    case 'cat':
      return famDeck(p, 'cat');
    case 'arr':
      return famDeck(p, 'arr');
    case 'elev':
      return famDeck(p, 'elev');
    case 'well':
      return famDeck(p, 'well');
    case 'stores':
      return famStores(p);
    case 'berth-fwd':
      return famBerth(p, 'FWD BERTHING');
    case 'berth-aft':
      return famBerth(p, 'AFT BERTHING');
    case 'passage-p':
      return famPassage(p, true);
    case 'passage-s':
      return famPassage(p, false);
  }
}

/**
 * Stand in the room's own aisle, a little along it depending on the cut, and look into the room.
 * Each room's designed eye is the aisle; starting against a side bulkhead put equipment in your face.
 */
function place(room: InteriorRoom, seed: number, side: number) {
  const [x0, x1, z0, z1] = room.bounds;
  const t = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
  const hit = (px: number, pz: number) => room.blockers.some((b) => px > b.x0 - 0.4 && px < b.x1 + 0.4 && pz > b.z0 - 0.4 && pz < b.z1 + 0.4);
  const [ex, ez] = room.eye;
  const x = Math.min(x1 - 0.5, Math.max(x0 + 0.5, ex + (t - 0.5) * 2.4));
  const z = Math.min(z1 - 0.5, Math.max(z0 + 0.5, ez + side * 0.3));
  if (!hit(x, z)) room.eye = [x, z];
  const [px, pz] = room.eye;
  // Look toward the far end, keeping the room's designed angle and turning a little toward the middle.
  const dx = px < (x0 + x1) / 2 ? 1 : -1;
  const dz = Math.abs(room.look[1]) * Math.sign((z0 + z1) / 2 - pz || 1) + ((z0 + z1) / 2 - pz) * 0.08;
  const n = Math.hypot(dx, dz) || 1;
  room.look = [dx / n, dz / n];
}

export interface Landing {
  room: InteriorRoom;
  title: string;
  detail: string;
}

/**
 * Each cut lands in the compartment for that station. A system pin picks its own room.
 * A lengthwise cut on the port or starboard side lands in that side's passage.
 * The standing point moves with the cut, so two splits of the same room do not share a doorway.
 */
export function buildLanding(info: HullInfo, cut: { x: number; z: number; mount: string | null; lengthwise: boolean }): Landing {
  const span = Math.max(info.bb.max.x - info.bb.min.x, 1);
  const u = (cut.x - info.bb.min.x) / span;
  let kind: Kind = (cut.mount && MOUNT_KIND[cut.mount]) || ALONG.find((s) => u <= s.u)?.kind || 'stores';
  if (cut.lengthwise && !cut.mount) kind = cut.z < -1.5 ? 'passage-p' : cut.z > 1.5 ? 'passage-s' : kind;
  const room = roomFor(kind, makeMats());
  const side = kind === 'engine-p' || kind === 'passage-p' ? -1 : kind === 'engine-s' || kind === 'passage-s' ? 1 : cut.z >= 0 ? 1 : -1;
  place(room, cut.lengthwise ? cut.z : cut.x, side);
  const [title, detail] = COPY[kind];
  return { room, title, detail };
}

/** Build the walk-in compartment for a mount, or for the zone under an empty-hull cut. */
export function buildInterior(mount: string | null, zone: Zone): InteriorRoom {
  const fam: Family = (mount && MOUNT_FAMILY[mount]) || ZONE_FAMILY[zone] || 'berth';
  const kind: Kind =
    fam === 'turb' ? 'engine-p' : fam === 'gen' ? 'gen-1' : fam === 'rack' ? 'radar' : fam === 'mag' ? 'mag-fwd' : fam === 'hangar' ? 'hangar' : fam === 'berth' ? 'berth-fwd' : (fam as Kind);
  return roomFor(kind, makeMats());
}
