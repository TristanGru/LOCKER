import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { BaseLayout, ShipBerth, ShipSystem } from '../../api/types';
import { add, bx, cyl, disposeTree, mk, plate, strip, V } from '../ship3d/geom';
import { buildPins, disposePins, layoutLabels, type PinSet } from '../ship3d/pins';
import type { Mount } from '../ship3d/types';

export type BaseView = 'overhead' | 'iso' | 'waterfront';
export type Ground = 'photo' | 'plain';

/** Extent of the aerial photo in scene units (web/public/shore/*.json, written by scripts/build_shore_imagery.py). */
interface PhotoMeta {
  image: string;
  attribution: string;
  scene: { x_north: number; x_south: number; z_east: number; z_west: number };
}

/** Pin every vertex to its spot on the photo: image left = west (max z), top = north (min x). */
function photoUV(geo: THREE.BufferGeometry, s: PhotoMeta['scene']) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (s.z_west - pos.getZ(i)) / (s.z_west - s.z_east);
    uv[i * 2 + 1] = (s.x_south - pos.getX(i)) / (s.x_south - s.x_north);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Hand-drawn layout pieces the photo replaces (it shows the real roads, aprons, runways and buildings). */
const PHOTO_HIDES = /^(waterfront_road|quay\d|apron\d|runway|context_)/;
export type MountPoints = Record<string, [number, number, number]>;

/** Camera offsets from the view target, for the traced waterfront and for the small stylized layout. */
const OFFSETS: Record<'outline' | 'stylized', Record<BaseView, [number, number, number]>> = {
  outline: { overhead: [0, 205, 34], iso: [62, 58, 92], waterfront: [10, 24, 118] },
  stylized: { overhead: [0, 235, 20], iso: [-105, 92, 118], waterfront: [0, 38, 165] },
};
const IDLE_FRAME_MS = 80; // Water and rings animate slowly; this keeps idle CPU low, especially on software WebGL.
const SKY_TOP = '#5f86ab';
const SKY_HORIZON = '#a9bdca';

const flat = (color: number, roughness = 0.85, metalness = 0.05) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function materials() {
  return {
    land: flat(0x5f6f58, 0.95), turf: flat(0x4f6548, 0.95), apron: flat(0x8b8f8e, 0.9), road: flat(0x3a3f44, 0.92), mark: flat(0xd8d8cf, 0.8),
    pier: flat(0xa7aaa8, 0.85), pierSide: flat(0x6f7476, 0.9), building: flat(0xb3ad9f), buildingAlt: flat(0x9a9f9f), roof: flat(0x5e6468), steel: flat(0x9aa7b2, 0.5, 0.5),
    crane: flat(0xd9a441, 0.55, 0.3), hull: flat(0x7d8892, 0.55, 0.3), hullDark: flat(0x4a5158, 0.7, 0.2), deck: flat(0x5f6870, 0.8), tank: flat(0xdfe3e4, 0.45, 0.4),
    power: flat(0x38506a, 0.6, 0.4), glass: flat(0x9ad1e6, 0.2, 0.3), tree: flat(0x3b5a36, 0.95),
  };
}
type Mats = ReturnType<typeof materials>;

function waterSurface(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 1300; i++) {
    ctx.fillStyle = `rgba(${90 + random() * 80},${90 + random() * 80},255,0.32)`;
    ctx.fillRect(random() * 256, random() * 256, 8 + random() * 26, 1 + random() * 2);
  }
  const normal = new THREE.CanvasTexture(canvas);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(size / 26, size / 26);
  const material = new THREE.MeshStandardMaterial({ color: 0x24536b, roughness: 0.62, metalness: 0.08, normalMap: normal, normalScale: new THREE.Vector2(0.22, 0.22) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.name = 'water';
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return { mesh, normal };
}

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, SKY_TOP);
  gradient.addColorStop(0.55, SKY_HORIZON);
  gradient.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A generic destroyer silhouette, about 155 m long at 10 m per unit. Not a model of any specific ship. */
function destroyer(M: Mats) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.85, -7.5);
  shape.lineTo(0.85, -7.5);
  shape.lineTo(1.0, -2);
  shape.lineTo(0.95, 3);
  shape.quadraticCurveTo(0.6, 6, 0, 8);
  shape.quadraticCurveTo(-0.6, 6, -0.95, 3);
  shape.lineTo(-1.0, -2);
  shape.closePath();
  const hull = new THREE.ExtrudeGeometry(shape, { depth: 1.05, bevelEnabled: false });
  hull.rotateX(-Math.PI / 2);
  hull.rotateY(Math.PI);
  add(g, 'hull', hull, M.hull, 0, 0.05, 0);
  bx(g, 'boot', M.hullDark, 1.95, 0.22, 14, 0, 0.14, -0.2);
  bx(g, 'house_fwd', M.hull, 1.3, 1.25, 3.8, 0, 1.7, -1.5);
  bx(g, 'bridge', M.deck, 1.05, 0.55, 1.7, 0, 2.55, -2.3);
  bx(g, 'house_aft', M.hull, 1.15, 0.85, 2.6, 0, 1.5, 3.1);
  cyl(g, 'stack_a', M.hullDark, 0.3, 0.38, 0.95, 0, 2.3, 0.7, 10);
  cyl(g, 'stack_b', M.hullDark, 0.3, 0.38, 0.9, 0, 2.2, 2.2, 10);
  cyl(g, 'mast', M.steel, 0.05, 0.13, 2.1, 0, 3.8, -1.2, 6);
  bx(g, 'yard', M.steel, 1.0, 0.06, 0.06, 0, 4.1, -1.2);
  cyl(g, 'gun', M.deck, 0.3, 0.38, 0.3, 0, 1.25, -5.2, 12);
  const barrel = cyl(g, 'barrel', M.steel, 0.045, 0.045, 1.2, 0, 1.33, -5.85, 6);
  barrel.rotation.x = Math.PI / 2;
  return g;
}

function facility(id: string, M: Mats) {
  const g = new THREE.Group();
  g.name = `facility_${id}`;
  if (id === 'crane') {
    for (const side of [-5, 5]) bx(g, `rail${side}`, M.road, 42, 0.2, 0.7, 0, 0.2, side);
    for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) bx(g, `leg${x}${z}`, M.crane, 1, 10, 1, x, 5.3, z);
    bx(g, 'portal', M.crane, 12, 1.6, 12, 0, 10.8, 0);
    bx(g, 'cab', M.glass, 3, 2.6, 3, 0, 12.9, -2);
    bx(g, 'boom', M.crane, 1.1, 1.1, 27, 0, 15.5, 9).rotation.x = -0.34;
  } else if (id === 'fuel') {
    cyl(g, 'tank_a', M.tank, 7, 7, 8, -4, 4, -18, 28);
    cyl(g, 'tank_b', M.tank, 5, 5, 7, 11, 3.5, -22, 28);
    bx(g, 'pump_house', M.building, 7, 3.5, 5, 0, 1.8, 0);
    bx(g, 'line', M.steel, 22, 0.4, 0.4, 12, 0.6, 2);
  } else if (id === 'gate') {
    bx(g, 'house', M.building, 7, 3.6, 5, 10, 1.8, 0);
    bx(g, 'canopy', M.roof, 18, 0.5, 8, 0, 5, 0);
    for (const side of [-1, 1]) bx(g, `post${side}`, M.steel, 0.6, 5, 0.6, 8 * side, 2.5, 0);
  } else if (id === 'water') {
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) bx(g, `leg${x}${z}`, M.steel, 0.5, 15, 0.5, x, 7.5, z);
    cyl(g, 'tank', M.tank, 5, 5, 5, 0, 17, 0, 24);
    cyl(g, 'cap', M.roof, 0.5, 5.2, 2, 0, 20.5, 0, 24);
  } else if (id === 'msub') {
    bx(g, 'trailer', M.deck, 20, 1, 6.5, 0, 1.3, 0);
    bx(g, 'transformer', M.power, 11, 5, 5.5, 2.5, 4.2, 0);
    bx(g, 'cab', M.building, 5, 4, 6, -12.5, 2.6, 0);
    for (const x of [-13, -6, 5, 9]) cyl(g, `wheel${x}`, M.road, 1.1, 1.1, 7, x, 1.1, 0, 14).rotation.x = Math.PI / 2;
  } else if (id === 'lgate') {
    bx(g, 'road', M.road, 11, 0.14, 14, 0, 0.1, 7);
    bx(g, 'house', M.building, 6, 3.4, 5, 9, 1.7, 0);
    bx(g, 'canopy', M.roof, 15, 0.5, 7, 0, 4.6, 0);
  }
  return g;
}

/** Deterministic, generic buildings and trees for context. Their positions are invented, not traced. */
function scatter(g: THREE.Group, M: Mats, spots: { x: number; z: number; w: number; d: number; h: number; alt: boolean }[], trees: [number, number][]) {
  const matrix = new THREE.Matrix4();
  for (const alt of [false, true]) {
    const rows = spots.filter((s) => s.alt === alt);
    if (!rows.length) continue;
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), alt ? M.buildingAlt : M.building, rows.length);
    const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.roof, rows.length);
    rows.forEach((s, i) => {
      walls.setMatrixAt(i, matrix.compose(V(s.x, s.h / 2 + 1, s.z), new THREE.Quaternion(), V(s.w, s.h, s.d)));
      roofs.setMatrixAt(i, matrix.compose(V(s.x, s.h + 1.1, s.z), new THREE.Quaternion(), V(s.w + 0.3, 0.25, s.d + 0.3)));
    });
    walls.name = 'context_buildings';
    roofs.name = 'context_roofs';
    g.add(walls, roofs);
  }
  if (trees.length) {
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.6, 7), M.tree, trees.length);
    crowns.name = 'context_trees';
    trees.forEach(([x, z], i) => crowns.setMatrixAt(i, matrix.makeTranslation(x, 2.3, z)));
    g.add(crowns);
  }
}

function shoreZ(shoreline: [number, number][], x: number) {
  const sorted = [...shoreline].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < sorted.length - 1; i++) {
    const [x0, z0] = sorted[i];
    const [x1, z1] = sorted[i + 1];
    if (x >= x0 && x <= x1) return z0 + ((z1 - z0) * (x - x0)) / Math.max(x1 - x0, 1e-6);
  }
  return sorted[x < sorted[0][0] ? 0 : sorted.length - 1][1];
}

/** Traced pier row, runways and aprons from public map data; every facility and building is invented and illustrative. */
function buildOutline(layout: BaseLayout, points: MountPoints, M: Mats) {
  const g = new THREE.Group();
  g.name = 'base_layout';
  const line = [...layout.shoreline].sort((a, b) => a[0] - b[0]);
  const xMin = line[0][0];
  const xMax = line[line.length - 1][0];
  plate(g, 'land', M.land, [...line.map(([x, z]) => [x, z] as [number, number]), [xMax + 60, line[line.length - 1][1]], [xMax + 60, -560], [xMin - 60, -560], [xMin - 60, line[0][1]]], 1, 0);
  strip(g, 'waterfront_road', M.road, xMin + 10, shoreZ(line, xMin + 10) - 7, xMax - 10, shoreZ(line, xMax - 10) - 7, 2.2, 1.05, 0.08);
  for (let i = 0; i < line.length - 1; i++) strip(g, `quay${i}`, M.apron, line[i][0], line[i][1] - 2.4, line[i + 1][0], line[i + 1][1] - 2.4, 5, 1.03, 0.06);

  layout.aprons.forEach((apron, i) => plate(g, `apron${i}`, M.apron, apron, 0.06, 1.02));
  layout.runways.forEach((runway, i) => {
    for (let s = 0; s < runway.points.length - 1; s++) {
      const [x0, z0] = runway.points[s];
      const [x1, z1] = runway.points[s + 1];
      strip(g, `runway${i}_${s}`, M.road, x0, z0, x1, z1, runway.width, 1.1, 0.06);
      const length = Math.hypot(x1 - x0, z1 - z0);
      for (let d = 6; d < length - 3; d += 12) {
        const t = d / length;
        const u = (d + 5) / length;
        strip(g, `runway_mark${i}_${s}_${d}`, M.mark, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, x0 + (x1 - x0) * u, z0 + (z1 - z0) * u, 0.25, 1.14, 0.03);
      }
    }
  });
  for (const pier of layout.piers) {
    plate(g, `${pier.name}_base`, M.pierSide, pier.points, 1.7, 0.25);
    plate(g, `${pier.name}_deck`, M.pier, pier.points, 0.2, 1.95);
    // Invented shore-power cabinet where the pier meets land, for scale.
    if (points[`pier_${pier.name.split(' ')[1]}`]) {
      const root = pier.points.reduce((best, p) => (p[1] < best[1] ? p : best));
      bx(g, `${pier.name}_power_cabinet`, M.power, 2, 1.5, 2, (root[0] + pier.center[0] * 0.08) / 1.08, 2.8, root[1] + 3);
    }
  }
  // Invented facility positions, scaled to the traced map.
  for (const [id, [x, , z]] of Object.entries(points)) {
    if (id.startsWith('pier_')) continue;
    const item = facility(id, M);
    item.position.set(x, 1, z);
    item.scale.setScalar(0.45);
    g.add(item);
  }
  // Generic context, kept clear of facilities, runways and aprons.
  const facilities = Object.values(points);
  const clear = (x: number, z: number, radius: number) =>
    facilities.every(([px, , pz]) => Math.hypot(px - x, pz - z) > radius) &&
    layout.runways.every((r) => r.points.every(([rx, rz]) => Math.hypot(rx - x, rz - z) > 30)) &&
    !layout.aprons.some((a) => a.some(([ax, az]) => Math.hypot(ax - x, az - z) < 30));
  let seed = 41;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const spots: { x: number; z: number; w: number; d: number; h: number; alt: boolean }[] = [];
  for (let x = xMin + 14; x < xMax - 14; x += 11) {
    const shore = shoreZ(line, x);
    for (let row = 0; row < 6; row++) {
      const px = x + random() * 4;
      const pz = shore - 18 - row * 15 - random() * 5;
      if (random() < 0.3 || !clear(px, pz, 10)) continue;
      spots.push({ x: px, z: pz, w: 4 + random() * 6, d: 3 + random() * 5, h: 1.4 + random() * 2.2, alt: random() > 0.5 });
    }
  }
  const trees: [number, number][] = [];
  for (let i = 0; i < 170; i++) {
    const x = xMin + random() * (xMax - xMin);
    const z = shoreZ(line, x) - 16 - random() * 130;
    if (clear(x, z, 8) && spots.every((s) => Math.hypot(s.x - x, s.z - z) > 6)) trees.push([x, z]);
  }
  scatter(g, M, spots, trees);
  return g;
}

function buildStylized(points: MountPoints, M: Mats) {
  const g = new THREE.Group();
  g.name = 'base_layout';
  bx(g, 'land', M.land, 420, 3, 150, 0, -0.5, -75);
  bx(g, 'quay_apron', M.apron, 180, 0.3, 16, 0, 1.15, -8);
  for (const [id, [x, , z]] of Object.entries(points)) {
    const item = facility(id, M);
    item.position.set(x, 1, z);
    g.add(item);
  }
  const clear = (x: number, z: number) => Object.values(points).every(([px, , pz]) => Math.hypot(px - x, pz - z) > 20);
  const spots = [[-92, -30, 26, 15, 7], [-68, -60, 22, 15, 6], [-38, -62, 26, 13, 6], [-2, -82, 28, 14, 7], [36, -62, 24, 16, 8], [64, -36, 26, 15, 7], [90, -66, 24, 14, 6], [58, -88, 30, 13, 6]]
    .filter(([x, z]) => clear(x, z))
    .map(([x, z, w, d, h], i) => ({ x, z, w, d, h, alt: i % 2 === 0 }));
  scatter(g, M, spots, []);
  return g;
}

export class BaseScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(42, 1, 1, 2400);
  private ctl: OrbitControls;
  private layoutGroup: THREE.Group;
  private shipGroup = new THREE.Group();
  private mats = materials();
  private normal: THREE.Texture;
  private sky: THREE.Texture;
  private pinSet: PinSet | null = null;
  private mounts: Record<string, Mount> = {};
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private visible = true;
  private w = 1;
  private h = 1;
  private currentView: BaseView = 'iso';
  private userMoved = false;
  private dirty = true;
  private lastFrame = 0;
  private animate = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private target: THREE.Vector3;
  /** Aerial-photo ground (Norfolk layout only): photo over the land slab plus a photo layer at water level. */
  private photo: { mat: THREE.MeshStandardMaterial; water: THREE.Mesh; land: THREE.Mesh | null; plainMat: THREE.Material | null; attribution: string } | null = null;
  private ground: Ground = 'photo';
  private disposed = false;
  /** Selected facility: the camera flies to it, its pin pulses and the other labels fade. */
  private selected: string | null = null;
  private tween: { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; start: number; dur: number } | null = null;
  private ray = new THREE.Raycaster();
  private down: { x: number; y: number } | null = null;

  constructor(
    private host: HTMLElement,
    private overlay: HTMLElement,
    points: MountPoints,
    private layout: BaseLayout | null,
    private onPick: (id: string) => void,
    private onError: (error: unknown) => void,
    onPhoto?: (attribution: string) => void,
  ) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.domElement.className = 's3-canvas';
    host.prepend(r.domElement);
    this.renderer = r;
    this.ctl = new OrbitControls(this.cam, r.domElement);
    this.ctl.enableDamping = true;
    this.ctl.dampingFactor = 0.08;
    this.ctl.maxPolarAngle = Math.PI * 0.47;
    this.ctl.minDistance = 14;
    this.ctl.maxDistance = layout ? 620 : 520;
    this.ctl.addEventListener('start', () => {
      this.userMoved = true;
      this.tween = null; // the user took the camera; stop flying
    });
    this.ctl.addEventListener('change', () => {
      this.dirty = true;
    });

    this.sky = skyTexture();
    this.scene.background = this.sky;
    this.scene.fog = new THREE.Fog(new THREE.Color(SKY_HORIZON), layout ? 240 : 320, layout ? 760 : 1100);
    this.scene.add(new THREE.HemisphereLight(0xdfeaf5, 0x59615a, 1.35));
    this.target = pointsCenter(points, layout);
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    const reach = layout ? 150 : 180;
    sun.position.copy(this.target).add(V(-110, 150, 70));
    sun.target.position.copy(this.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 10, far: 520 });
    sun.shadow.bias = -0.0004;
    this.scene.add(sun, sun.target);

    const water = waterSurface(3200);
    this.normal = water.normal;
    water.mesh.position.set(this.target.x, 0, this.target.z);
    this.scene.add(water.mesh);
    this.layoutGroup = layout ? buildOutline(layout, points, this.mats) : buildStylized(points, this.mats);
    this.layoutGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name !== 'land') {
        o.castShadow = true;
        o.receiveShadow = true;
      } else if (o.name === 'land') o.receiveShadow = true;
    });
    this.scene.add(this.layoutGroup, this.shipGroup);
    if (layout) void this.loadPhoto(onPhoto);
    for (const [id, [x, y, z]] of Object.entries(points)) this.mounts[id] = mk(x, y + 4, z, 'up', y - 0.5);

    this.resize();
    this.frameView();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.io = new IntersectionObserver((entries) => {
      this.visible = entries.some((e) => e.isIntersecting);
    });
    this.io.observe(host);
    r.domElement.addEventListener('pointerdown', this.onDown);
    r.domElement.addEventListener('pointerup', this.onUp);
    r.setAnimationLoop(this.loop);
  }

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };

  /** A click (not a drag) on a pin sphere selects it, same as clicking its label. */
  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || !this.pinSet || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.cam);
    const hit = this.ray.intersectObject(this.pinSet.group, true).find((h) => h.object.name.startsWith('pin_'));
    if (hit) this.onPick(hit.object.name.slice(4));
  };

  setSystems(systems: ShipSystem[]) {
    if (this.pinSet) disposePins(this.pinSet);
    this.pinSet = buildPins({ g: this.layoutGroup, mounts: this.mounts, len: this.layout ? 120 : 300, labelAll: true, pinAction: 'Zoom in and show its details.' }, systems, this.overlay, this.onPick);
    if (this.selected && !this.pinSet.pins[this.selected]) this.selected = null;
    this.markSelected();
    this.dirty = true;
  }

  /** Draws the squadron's in-port ships at their piers, and generic traffic at piers with no squadron ship. */
  setBerths(berths: ShipBerth[]) {
    disposeTree(this.shipGroup);
    this.shipGroup.clear();
    if (this.layout) {
      const taken = new Map(berths.filter((b) => b.in_port).map((b) => [b.pier.toUpperCase(), b]));
      this.layout.piers.forEach((pier, index) => {
        const squadron = taken.get(pier.name.toUpperCase());
        const generic = !squadron && index % 2 === 0;
        if (squadron || generic) this.addShip(pier, 1);
        if (generic && index % 4 === 0) this.addShip(pier, -1);
      });
    }
    this.shipGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    this.dirty = true;
  }

  private addShip(pier: BaseLayout['piers'][number], side: number) {
    const ship = destroyer(this.mats);
    // Use the pier's nearest long face on this side, so a T-head doesn't push the ship away from the stem.
    const faces = pier.points.map(([x, z]) => ((x - pier.center[0]) * -Math.sin(pier.axis) + (z - pier.center[1]) * Math.cos(pier.axis)) * side).filter((d) => d > 0.3);
    const offset = (faces.length ? Math.min(...faces) : 2) + 1.3;
    ship.position.set(pier.center[0] - Math.sin(pier.axis) * offset * side, 0, pier.center[1] + Math.cos(pier.axis) * offset * side);
    ship.rotation.y = Math.PI / 2 - pier.axis;
    this.shipGroup.add(ship);
  }

  /** Public-domain aerial photo under the traced layout. Bundled with the app; absent file = plain ground. */
  private async loadPhoto(onPhoto?: (attribution: string) => void) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}shore/norfolk_naip.json`);
      if (!res.ok) return;
      const meta = (await res.json()) as PhotoMeta;
      const tex = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}shore/${meta.image}`);
      if (this.disposed) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
      const s = meta.scene;
      // water-level layer across the whole photo (land slab sits above it)
      const waterMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      const geo = new THREE.PlaneGeometry(s.x_south - s.x_north, s.z_west - s.z_east);
      geo.rotateX(-Math.PI / 2);
      geo.translate((s.x_north + s.x_south) / 2, 0.08, (s.z_east + s.z_west) / 2);
      photoUV(geo, s);
      const water = new THREE.Mesh(geo, waterMat);
      water.name = 'photo_ground';
      water.receiveShadow = true;
      this.scene.add(water);
      const land = (this.layoutGroup.getObjectByName('land') as THREE.Mesh | undefined) ?? null;
      if (land) photoUV(land.geometry, s);
      this.photo = { mat, water, land, plainMat: land ? (land.material as THREE.Material) : null, attribution: meta.attribution };
      this.applyGround();
      onPhoto?.(meta.attribution);
    } catch {
      /* no photo: keep the plain ground */
    }
  }

  setGround(ground: Ground) {
    this.ground = ground;
    this.applyGround();
  }

  private applyGround() {
    const p = this.photo;
    if (!p) return;
    const on = this.ground === 'photo';
    p.water.visible = on;
    if (p.land) p.land.material = on ? p.mat : (p.plainMat ?? p.mat);
    this.layoutGroup.traverse((o) => {
      if (PHOTO_HIDES.test(o.name)) o.visible = !on;
    });
    this.dirty = true;
  }

  setView(view: BaseView) {
    this.currentView = view;
    this.userMoved = false;
    this.selected = null;
    this.markSelected();
    const { pos, target } = this.framePose();
    this.flyTo(pos, target, 700);
  }

  /** Camera pose for the current named view. Pulls back on narrow panels so the waterfront stays in frame. */
  private framePose() {
    const fit = Math.max(1, 1.45 / this.cam.aspect);
    const [x, y, z] = OFFSETS[this.layout ? 'outline' : 'stylized'][this.currentView];
    // The overhead view looks further inland so the toolbar doesn't cover facilities behind the waterfront.
    const inland = this.layout && this.currentView === 'overhead' ? -22 : 0;
    return {
      pos: V(this.target.x + x * fit, this.target.y + y * fit, this.target.z + inland + z * fit),
      target: V(this.target.x, this.target.y, this.target.z + inland),
    };
  }

  private frameView() {
    const { pos, target } = this.framePose();
    this.tween = null;
    this.cam.position.copy(pos);
    this.ctl.target.copy(target);
    this.ctl.update();
    this.dirty = true;
  }

  /** Smooth, eased camera move so the eye can follow where it is going. */
  private flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 1000) {
    if (!this.animate) {
      this.tween = null;
      this.cam.position.copy(pos);
      this.ctl.target.copy(target);
      this.ctl.update();
      this.dirty = true;
      return;
    }
    this.tween = { p0: this.cam.position.clone(), p1: pos, t0: this.ctl.target.clone(), t1: target, start: performance.now(), dur };
    this.dirty = true;
  }

  /** Fly in close to one facility, keeping the current compass bearing and looking down at about 40 degrees. */
  focus(id: string) {
    const pin = this.pinSet?.pins[id];
    if (!pin) return;
    this.userMoved = true;
    this.selected = id;
    this.markSelected();
    const dist = this.layout ? 40 : 72;
    const bearing = this.cam.position.clone().sub(this.ctl.target).setY(0);
    if (bearing.lengthSq() < 1e-6) bearing.set(0, 0, 1);
    bearing.normalize();
    const tilt = 0.72;
    // Aim a little to the right of the pin so it sits in the open space left of the detail card.
    const right = new THREE.Vector3().crossVectors(bearing.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize();
    const target = pin.p.clone().add(V(0, -2, 0)).addScaledVector(right, dist * 0.22 * Math.max(1, 1.6 / this.cam.aspect));
    const pos = target.clone().addScaledVector(bearing, dist * Math.cos(tilt)).add(V(0, dist * Math.sin(tilt), 0));
    this.flyTo(pos, target, 1100);
  }

  /** Back to the overview of the current view. */
  clearFocus() {
    this.selected = null;
    this.userMoved = false;
    this.markSelected();
    const { pos, target } = this.framePose();
    this.flyTo(pos, target, 900);
  }

  private markSelected() {
    for (const a of this.pinSet?.anchors ?? []) {
      a.el?.classList.toggle('sel', a.id === this.selected);
      a.el?.classList.toggle('dim', !!this.selected && a.id !== this.selected);
    }
    this.dirty = true;
  }

  private resize() {
    this.w = Math.max(1, this.host.clientWidth);
    this.h = Math.max(1, this.host.clientHeight);
    // Also sets the canvas CSS size. Without it, display scaling above 100% draws the scene larger than its panel.
    this.renderer.setSize(this.w, this.h);
    this.cam.aspect = this.w / this.h;
    this.cam.updateProjectionMatrix();
    if (!this.userMoved) this.frameView();
    this.dirty = true;
  }

  /** Keeps labels clear of the toolbar and legend, which blur whatever sits behind them. */
  private chromeInsets() {
    const bar = this.host.querySelector('[aria-label="3D model filters"]')?.parentElement as HTMLElement | null;
    const legend = this.host.querySelector('[aria-label="3D model legend"]') as HTMLElement | null;
    return { top: (bar?.offsetHeight ?? 0) + 8, bottom: (legend?.offsetHeight ?? 0) + 8 };
  }

  private loop = (now: number) => {
    if (!this.visible) return;
    try {
      this.ctl.update();
      const idle = now - this.lastFrame >= IDLE_FRAME_MS;
      if (!this.dirty && !(this.animate && idle)) return;
      const step = Math.min(now - this.lastFrame, 200) / 1000;
      this.lastFrame = now;
      this.dirty = false;
      if (this.animate) {
        this.normal.offset.x += step * 0.012;
        this.normal.offset.y += step * 0.007;
      }
      for (const ring of this.pinSet?.rings ?? []) ring.rotation.z += step;
      if (this.tween) {
        const tw = this.tween;
        const k = Math.min(1, (now - tw.start) / tw.dur);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // ease in-out cubic
        this.cam.position.lerpVectors(tw.p0, tw.p1, e);
        this.ctl.target.lerpVectors(tw.t0, tw.t1, e);
        this.ctl.update();
        this.dirty = true;
        if (k >= 1) this.tween = null;
      }
      // The selected pin pulses larger so it stands out in a busy layout.
      for (const o of this.pinSet?.group.children ?? []) {
        if (!o.name.startsWith('pin_')) continue;
        o.scale.setScalar(o.name === 'pin_' + this.selected ? 1 + 0.12 * Math.sin(now / 220) : 1);
      }
      if (this.selected) this.dirty = true;
      this.renderer.render(this.scene, this.cam);
      if (this.pinSet) layoutLabels(this.pinSet.anchors, this.cam, this.w, this.h, () => false, this.chromeInsets());
    } catch (error) {
      this.renderer.setAnimationLoop(null);
      this.onError(error);
    }
  };

  dispose() {
    this.disposed = true;
    if (this.photo) {
      this.photo.mat.map?.dispose();
      this.photo.mat.dispose();
      (this.photo.water.material as THREE.Material).dispose();
      this.photo.water.geometry.dispose();
    }
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.io.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onUp);
    if (this.pinSet) disposePins(this.pinSet);
    this.overlay.replaceChildren();
    disposeTree(this.layoutGroup);
    disposeTree(this.shipGroup);
    this.normal.dispose();
    this.sky.dispose();
    this.ctl.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** The default view centers on the unit's status-bearing facilities. */
function pointsCenter(points: MountPoints, layout: BaseLayout | null) {
  if (!layout) return V(0, 2, -6);
  const piers = Object.entries(points).filter(([id]) => id.startsWith('pier_')).map(([, p]) => p);
  const from = piers.length ? piers : Object.values(points);
  return V(from.reduce((sum, p) => sum + p[0], 0) / from.length, 2, from.reduce((sum, p) => sum + p[2], 0) / from.length - 12);
}
