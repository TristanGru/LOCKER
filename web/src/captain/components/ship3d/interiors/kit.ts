import * as THREE from 'three';
import { mulberry } from '../geom';

/** Seeded so LED patterns don't flicker between frames. Advances as rooms are built. */
const rn = mulberry(99);
/** The same seeded stream, for room builders that need a repeatable pattern. */
export const rnd = () => rn();

export interface IMats {
  steel: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  red: THREE.MeshStandardMaterial;
  blue: THREE.MeshStandardMaterial;
  yel: THREE.MeshStandardMaterial;
  grn: THREE.MeshStandardMaterial;
  sil: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  rack: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  orange: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  lamp: THREE.MeshStandardMaterial;
  scrT: THREE.MeshStandardMaterial;
  scrB: THREE.MeshStandardMaterial;
  scrA: THREE.MeshStandardMaterial;
  ledG: THREE.MeshStandardMaterial;
  ledR: THREE.MeshStandardMaterial;
  ledA: THREE.MeshStandardMaterial;
  shell: THREE.MeshStandardMaterial;
  olive: THREE.MeshStandardMaterial;
  navy: THREE.MeshStandardMaterial;
  bunk: THREE.MeshStandardMaterial;
  rubberW: THREE.MeshStandardMaterial;
  heli: THREE.MeshStandardMaterial;
}

const imat = (n: string, c: number, o: THREE.MeshStandardMaterialParameters = {}) => {
  const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, metalness: 0.12, ...o });
  m.name = n;
  return m;
};

/** A fresh material set for one compartment (disposed with the room). */
export function makeMats(): IMats {
  const m = imat;
  return {
    steel: m('steel', 0xb4bec4, { metalness: 0.35, roughness: 0.45 }),
    dark: m('dark_machinery', 0x3a424a, { metalness: 0.3, roughness: 0.55 }),
    paint: m('equipment_green', 0x6d8a74),
    red: m('pipe_red', 0xc4443a, { metalness: 0.2 }),
    blue: m('pipe_blue', 0x4a86c8, { metalness: 0.2 }),
    yel: m('safety_yellow', 0xe3c230),
    grn: m('pipe_green', 0x58b078, { metalness: 0.2 }),
    sil: m('duct_silver', 0xcdd4d8, { metalness: 0.35, roughness: 0.4 }),
    white: m('insulation_white', 0xeceee9, { roughness: 0.9 }),
    brass: m('copper', 0xcf9f50, { metalness: 0.4, roughness: 0.4 }),
    rack: m('rack_grey', 0x86929a, { metalness: 0.3 }),
    rubber: m('rubber', 0x1d2024, { roughness: 0.95 }),
    orange: m('orange', 0xdb8c30),
    glass: m('glass', 0x22333f, { roughness: 0.1, metalness: 0.3 }),
    lamp: m('lamp', 0xffffff, { emissive: 0xfff3d6, emissiveIntensity: 1.6 }),
    scrT: m('screen_teal', 0x0a2a30, { emissive: 0x3fd9e8, emissiveIntensity: 1.5, emissiveMap: screenTex('trace') }),
    scrB: m('screen_blue', 0x0a1a30, { emissive: 0x4a8cff, emissiveIntensity: 1.5, emissiveMap: screenTex('plot') }),
    scrA: m('screen_amber', 0x2a1a05, { emissive: 0xffb23a, emissiveIntensity: 1.4, emissiveMap: screenTex('text') }),
    ledG: m('led_green', 0x000000, { emissive: 0x38ff7a, emissiveIntensity: 2.5 }),
    ledR: m('led_red', 0x000000, { emissive: 0xff4a3a, emissiveIntensity: 2.5 }),
    ledA: m('led_amber', 0x000000, { emissive: 0xffb23a, emissiveIntensity: 2.5 }),
    shell: m('shell_brass', 0xd8b255, { metalness: 0.5, roughness: 0.35 }),
    olive: m('olive_drab', 0x6b7a55),
    navy: m('navy_blue', 0x38598a),
    bunk: m('bunk_frame', 0x929da5, { metalness: 0.35 }),
    rubberW: m('mattress', 0x8c9bb0),
    heli: m('heli_grey', 0x5d6b75),
  };
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, rx = 1, ry = 1) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  draw(ctx, w, h);
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.repeat.set(rx, ry);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
}

/** Grey-scale display content; the material's emissive colour tints it. */
function screenTex(kind: 'trace' | 'plot' | 'text') {
  return canvasTex(256, 160, (c, w, h) => {
    c.fillStyle = '#1a1a1a';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#3c3c3c';
    c.lineWidth = 1;
    for (let x = 0; x <= w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y <= h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.fillStyle = '#d0d0d0';
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    if (kind === 'trace') {
      c.beginPath();
      for (let x = 0; x <= w; x += 4) c.lineTo(x, h * 0.5 + Math.sin(x / 14) * 26 + Math.sin(x / 5) * 6);
      c.stroke();
    } else if (kind === 'plot') {
      for (const r of [28, 56, 74]) { c.beginPath(); c.arc(w * 0.38, h / 2, r, 0, Math.PI * 2); c.stroke(); }
      c.beginPath(); c.moveTo(w * 0.38, h / 2); c.lineTo(w * 0.38 + 70, h / 2 - 34); c.stroke();
      for (let i = 0; i < 9; i++) c.fillRect(w * 0.38 + Math.cos(i * 2.3) * (20 + i * 6) - 3, h / 2 + Math.sin(i * 2.3) * (16 + i * 5) - 3, 6, 6);
      for (let i = 0; i < 6; i++) c.fillRect(w * 0.74, 16 + i * 22, 40 + ((i * 37) % 30), 8);
    } else {
      for (let i = 0; i < 7; i++) c.fillRect(14, 14 + i * 20, 60 + ((i * 53) % 150), 9);
    }
    c.strokeStyle = '#8a8a8a';
    c.lineWidth = 4;
    c.strokeRect(2, 2, w - 4, h - 4);
  });
}

const texDeck = (rx: number, ry: number) =>
  canvasTex(
    256,
    256,
    (c, w, h) => {
      c.fillStyle = '#5b6269';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        c.fillStyle = `rgba(${rn() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rn() * 0.07})`;
        c.fillRect(rn() * w, rn() * h, 2, 2);
      }
      c.strokeStyle = 'rgba(0,0,0,.4)';
      c.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        c.beginPath();
        c.moveTo(i * 64, 0);
        c.lineTo(i * 64, h);
        c.stroke();
        c.beginPath();
        c.moveTo(0, i * 64);
        c.lineTo(w, i * 64);
        c.stroke();
      }
      c.strokeStyle = 'rgba(255,255,255,.08)';
      for (let x = 0; x < w; x += 16)
        for (let y = 0; y < h; y += 16) {
          c.beginPath();
          c.moveTo(x, y + 8);
          c.lineTo(x + 8, y);
          c.stroke();
        }
    },
    rx,
    ry,
  );

const texWall = (rx: number, ry: number, base: string) =>
  canvasTex(
    256,
    256,
    (c, w, h) => {
      c.fillStyle = base;
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1600; i++) {
        c.fillStyle = `rgba(0,0,0,${rn() * 0.05})`;
        c.fillRect(rn() * w, rn() * h, 1, 6 + rn() * 24);
      }
      c.strokeStyle = 'rgba(0,0,0,.3)';
      c.lineWidth = 2;
      c.strokeRect(0, 0, w, h);
      c.beginPath();
      c.moveTo(0, h / 2);
      c.lineTo(w, h / 2);
      c.stroke();
      const grime = c.createLinearGradient(0, h * 0.78, 0, h);
      grime.addColorStop(0, 'rgba(40,36,30,0)');
      grime.addColorStop(1, 'rgba(40,36,30,.22)');
      c.fillStyle = grime;
      c.fillRect(0, h * 0.78, w, h * 0.22);
      c.fillStyle = 'rgba(0,0,0,.3)';
      for (let x = 8; x < w; x += 24) {
        c.fillRect(x, 4, 3, 3);
        c.fillRect(x, h / 2 + 4, 3, 3);
        c.fillRect(x, h - 8, 3, 3);
      }
    },
    rx,
    ry,
  );

export const texGrate = (rx: number, ry: number) =>
  canvasTex(
    128,
    128,
    (c, w, h) => {
      c.fillStyle = '#14181c';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#8c979e';
      c.lineWidth = 3;
      for (let i = 0; i <= 8; i++) {
        c.beginPath();
        c.moveTo(i * 16, 0);
        c.lineTo(i * 16, h);
        c.stroke();
        c.beginPath();
        c.moveTo(0, i * 16);
        c.lineTo(w, i * 16);
        c.stroke();
      }
    },
    rx,
    ry,
  );

/** Compartment marker ("bull's-eye"): deck-frame-position-use, stencilled in a yellow disc. */
const bullseyeTex = (txt: string) =>
  canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#e3c230';
    c.beginPath();
    c.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#14181c';
    c.lineWidth = 8;
    c.stroke();
    c.fillStyle = '#14181c';
    c.font = '800 40px Inter, Arial, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(txt, w / 2, h / 2 - 22);
    c.font = '700 26px Inter, Arial, sans-serif';
    c.fillText('FR ' + txt.split('-')[1], w / 2, h / 2 + 26);
  });

const signTex = (txt: string, bg: string, fg: string) =>
  canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = fg;
    c.lineWidth = 8;
    c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = fg;
    c.font = '700 44px Inter, Arial, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(txt, w / 2, h / 2 + 2);
  });

export const Bx = (G: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  G.add(o);
  return o;
};

export const Cy = (G: THREE.Object3D, r0: number, r1: number, h: number, m: THREE.Material, x: number, y: number, z: number, ax: 'x' | 'y' | 'z' = 'y', seg = 28) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m);
  o.position.set(x, y, z);
  if (ax === 'x') o.rotation.z = Math.PI / 2;
  else if (ax === 'z') o.rotation.x = Math.PI / 2;
  G.add(o);
  return o;
};

export const Sph = (G: THREE.Object3D, r: number, m: THREE.Material, x: number, y: number, z: number) => {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m);
  o.position.set(x, y, z);
  G.add(o);
  return o;
};

export const Tor = (G: THREE.Object3D, R: number, r: number, m: THREE.Material, x: number, y: number, z: number, ax: 'x' | 'y' | 'z' = 'y') => {
  const o = new THREE.Mesh(new THREE.TorusGeometry(R, r, 10, 28), m);
  o.position.set(x, y, z);
  if (ax === 'x') o.rotation.y = Math.PI / 2;
  else if (ax === 'y') o.rotation.x = Math.PI / 2;
  G.add(o);
  return o;
};

/** Watertight box: deck, overhead, bulkheads, door and extinguisher. Sizes are meters. */
export function shell(p: IMats, W: number, L: number, H: number, wall: string, amb = 0.85) {
  const G = new THREE.Group();
  G.name = 'interior_compartment';
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, L), imat('deck_plating', 0xffffff, { map: texDeck(W / 1.4, L / 1.4), roughness: 0.85 }));
  fl.rotation.x = -Math.PI / 2;
  G.add(fl);
  const ce = new THREE.Mesh(
    new THREE.PlaneGeometry(W, L),
    imat('overhead', 0xffffff, { map: texWall(W / 3, L / 3, '#d8dcd6'), side: THREE.DoubleSide }),
  );
  ce.rotation.x = Math.PI / 2;
  ce.position.y = H;
  G.add(ce);
  const wm = imat('bulkhead', 0xffffff, { map: texWall(W / 3, H / 2.2, wall), side: THREE.DoubleSide });
  const wm2 = imat('bulkhead_end', 0xffffff, { map: texWall(L / 3, H / 2.2, wall), side: THREE.DoubleSide });
  for (const [z, r] of [
    [-L / 2, 0],
    [L / 2, Math.PI],
  ] as const) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wm);
    mesh.position.set(0, H / 2, z);
    mesh.rotation.y = r;
    G.add(mesh);
  }
  for (const [x, r] of [
    [-W / 2, Math.PI / 2],
    [W / 2, -Math.PI / 2],
  ] as const) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(L, H), wm2);
    mesh.position.set(x, H / 2, 0);
    mesh.rotation.y = r;
    G.add(mesh);
  }
  for (const z of [-L / 2, L / 2]) Bx(G, W, 0.28, 0.04, p.dark, 0, 0.14, z + (z < 0 ? 0.02 : -0.02));
  for (const x of [-W / 2, W / 2]) Bx(G, 0.04, 0.28, L, p.dark, x + (x < 0 ? 0.02 : -0.02), 0.14, 0);
  // Sky-and-deck fill instead of flat ambient: overheads stay bright, the deck and the undersides of equipment fall off.
  G.add(new THREE.HemisphereLight(0xe6edf2, 0x3a4048, amb * 0.95));
  G.add(new THREE.AmbientLight(0xffffff, amb * 0.12));

  // Structure: frames on the long bulkheads and beams across the overhead, so the walls read as steel.
  const frame = imat('frame', new THREE.Color(wall).multiplyScalar(0.8).getHex(), { roughness: 0.6, metalness: 0.2 });
  for (let x = -W / 2 + 1.5; x < W / 2 - 0.4; x += 1.5) {
    for (const z of [-L / 2, L / 2]) {
      const s = z < 0 ? 1 : -1;
      Bx(G, 0.05, H, 0.15, frame, x, H / 2, z + s * 0.075);
      Bx(G, 0.15, H, 0.03, frame, x, H / 2, z + s * 0.165);
    }
    Bx(G, 0.05, 0.13, L, frame, x, H - 0.065, 0);
    Bx(G, 0.15, 0.03, L, frame, x, H - 0.145, 0);
  }

  // Bulkhead fittings by the door: compartment marker, battle lanterns, sound-powered phone and a power panel.
  const comp = `${H > 5 ? 4 : 2}-${100 + (Math.round(W * L * 7) % 240)}-0-${H > 5 ? 'E' : 'Q'}`;
  const be = new THREE.Mesh(new THREE.CircleGeometry(0.32, 40), imat('bullseye', 0xffffff, { map: bullseyeTex(comp), transparent: true }));
  be.position.set(-W / 2 + 2.6, 1.95, -L / 2 + 0.02);
  G.add(be);
  const lantern = (x: number, z: number) => {
    const s = z < 0 ? 1 : -1;
    Bx(G, 0.26, 0.22, 0.2, p.yel, x, 2.15, z + s * 0.12);
    Cy(G, 0.075, 0.075, 0.04, p.lamp, x, 2.15, z + s * 0.24, 'z', 20);
    Bx(G, 0.04, 0.3, 0.04, p.dark, x, 2.0, z + s * 0.03);
  };
  lantern(-W / 2 + 1.2, -L / 2);
  lantern(W / 2 - 1.6, L / 2);
  Bx(G, 0.32, 0.42, 0.12, p.rack, -W / 2 + 1.5, 1.45, L / 2 - 0.06);
  Bx(G, 0.08, 0.26, 0.08, p.rubber, -W / 2 + 1.5, 1.45, L / 2 - 0.15);
  Bx(G, 0.22, 0.04, 0.02, p.yel, -W / 2 + 1.5, 1.72, L / 2 - 0.12);
  Bx(G, 0.62, 0.86, 0.14, p.rack, -W / 2 + 3.9, 1.35, -L / 2 + 0.07);
  Bx(G, 0.5, 0.06, 0.02, p.white, -W / 2 + 3.9, 1.7, -L / 2 + 0.15);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) Bx(G, 0.06, 0.1, 0.03, p.dark, -W / 2 + 3.72 + k * 0.12, 1.42 - r * 0.18, -L / 2 + 0.15);
  Cy(G, 0.04, 0.04, H - 1.8, p.dark, -W / 2 + 4.12, 1.8 + (H - 1.8) / 2, -L / 2 + 0.1, 'y', 10);

  const door = new THREE.Group();
  Bx(door, 0.22, 2.3, 1.3, p.dark, 0, 1.15, 0);
  Bx(door, 0.1, 2.0, 1.0, p.paint, -0.07, 1.1, 0);
  Cy(door, 0.28, 0.28, 0.06, p.yel, -0.15, 1.15, 0, 'x');
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const spoke = Bx(door, 0.05, 0.04, 0.5, p.yel, -0.18, 1.15, 0);
    spoke.rotation.x = a;
  }
  door.position.set(-W / 2 + 0.12, 0, -L * 0.18);
  G.add(door);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), imat('sign', 0xffffff, { map: signTex('WATERTIGHT DOOR', '#d9b92e', '#14181c') }));
  sg.position.set(-W / 2 + 0.04, 2.55, -L * 0.18);
  sg.rotation.y = Math.PI / 2;
  G.add(sg);
  const ex = new THREE.Group();
  Cy(ex, 0.13, 0.13, 0.55, p.red, 0, 0.5, 0);
  Sph(ex, 0.13, p.red, 0, 0.8, 0);
  Cy(ex, 0.03, 0.03, 0.5, p.rubber, 0.14, 0.6, 0);
  ex.position.set(W / 2 - 0.3, 0, L * 0.35);
  G.add(ex);
  Bx(G, 0.1, 0.5, 0.4, p.red, W / 2 - 0.07, 1.2, L * 0.35 + 0.45);
  return G;
}

/** Overhead fluorescent fixtures hung below the beams, with a few point lights for pools of light. */
export function roomLights(G: THREE.Group, p: IMats, W: number, L: number, H: number, n: number, pl = true) {
  const ud = G.userData as { pl?: number };
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (W * (i + 0.5)) / n;
    for (const z of [-L * 0.24, L * 0.24]) {
      Bx(G, 1.7, 0.08, 0.3, p.rack, x, H - 0.21, z);
      Bx(G, 1.55, 0.03, 0.2, p.lamp, x, H - 0.265, z);
      for (const dx of [-0.7, 0.7]) Bx(G, 0.02, 0.17, 0.02, p.dark, x + dx, H - 0.085, z);
    }
    if (pl && i % 2 === 0 && (ud.pl ?? 0) < 6) {
      ud.pl = (ud.pl ?? 0) + 1;
      const l = new THREE.PointLight(0xfff0d8, 26, Math.max(10, H * 3), 1.8);
      l.position.set(x, H - 0.6, 0);
      G.add(l);
    }
  }
}

export function pipes(G: THREE.Object3D, p: IMats, W: number, H: number, list: [number, number, keyof IMats, number?][]) {
  for (const [z, r, m, y] of list) {
    const yy = y ?? H - 0.4;
    Cy(G, r, r, W - 0.5, p[m], 0, yy, z, 'x', 16);
    for (let x = -W / 2 + 1; x < W / 2 - 0.5; x += 2.4) Bx(G, 0.05, H - yy - 0.05, 0.22, p.dark, x, (yy + H) / 2, z);
  }
}

export function tray(G: THREE.Object3D, p: IMats, W: number, H: number, zs: number[]) {
  const colors = [p.red, p.blue, p.dark, p.yel, p.grn];
  for (const z of zs) {
    Bx(G, W - 0.6, 0.07, 0.55, p.dark, 0, H - 0.22, z);
    for (let i = 0; i < 5; i++) Bx(G, W - 0.8, 0.05, 0.08, colors[i], 0, H - 0.17, z - 0.2 + i * 0.1);
  }
}

export function sign(G: THREE.Object3D, txt: string, bg: string, fg: string, x: number, y: number, z: number, ry: number, w = 1.8) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), imat('sign', 0xffffff, { map: signTex(txt, bg, fg) }));
  s.position.set(x, y, z);
  s.rotation.y = ry;
  G.add(s);
}

export function rail(G: THREE.Object3D, p: IMats, x0: number, x1: number, y: number, z: number) {
  Cy(G, 0.03, 0.03, x1 - x0, p.yel, (x0 + x1) / 2, y, z, 'x', 8);
  Cy(G, 0.03, 0.03, x1 - x0, p.yel, (x0 + x1) / 2, y * 0.5, z, 'x', 8);
  for (let x = x0; x <= x1 + 0.01; x += 1.4) Cy(G, 0.025, 0.025, y, p.yel, x, y / 2, z, 'y', 8);
}

export function led(G: THREE.Object3D, p: IMats, x: number, y: number, z: number, ry: number, n = 5) {
  const cols = [p.ledG, p.ledG, p.ledA, p.ledR];
  for (let i = 0; i < n; i++) {
    const m = cols[Math.floor(rn() * 4)];
    Bx(G, 0.04, 0.04, 0.02, m, x + Math.cos(ry) * (-0.3 + i * 0.12), y, z);
  }
}

export function ledMat(p: IMats) {
  return [p.ledG, p.ledG, p.ledA, p.ledR][Math.floor(rn() * 4)];
}

/** Solid boxes the walker cannot pass through, in room-local meters. */
export interface Blocker {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface InteriorRoom {
  group: THREE.Group;
  blockers: Blocker[];
  /** Starting eye position, room-local x/z. Eye height is 1.65 m. */
  eye: [number, number];
  /** Horizontal look direction. */
  look: [number, number];
  /** Walkable limits [x0, x1, z0, z1]. */
  bounds: [number, number, number, number];
}

export function disposeInterior(root: THREE.Object3D) {
  const mats = new Set<THREE.Material>();
  const maps = new Set<THREE.Texture>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const list = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const m of list) {
      if (mats.has(m)) continue;
      mats.add(m);
      const sm = m as THREE.MeshStandardMaterial;
      for (const map of [sm.map, sm.emissiveMap]) {
        if (map && !maps.has(map)) {
          maps.add(map);
          map.dispose();
        }
      }
      m.dispose();
    }
  });
}
