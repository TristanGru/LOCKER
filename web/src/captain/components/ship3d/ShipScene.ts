import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ShipSystem, Status } from '../../api/types';
import { clampCut, disposeSplit, KD, makeSplit, type Split } from './cutaway';
import { buildSea, dress } from './dress';
import { disposeTree, mk, V } from './geom';
import { hullDef } from './hulls';
import { disposeInterior, type Blocker } from './interiors/kit';
import { buildLanding } from './interiors/rooms';
import { createMaterials, disposeMaterials, setXray, type Mats } from './materials';
import { buildPins, disposePins, layoutLabels, type Anchor, type PinSet } from './pins';
import type { BuildCtx, CutMode, HullInfo, HullType, PinInfo, ViewKind } from './types';

/** What the cut panel shows. */
export interface CutState {
  focusId: string | null;
  name: string | null;
  status: Status | null;
  /** Compartment or zone name at the cut. */
  title: string;
  detail: string | null;
  where: string;
  mode: CutMode;
}

export interface SceneEvents {
  /** A new hull finished building; lists the mount keys it offers. */
  onHull: (type: HullType, mounts: Set<string>) => void;
  /** The camera view changed (a cut switches to 'cut'). */
  onView: (kind: ViewKind) => void;
  /** A cut opened, moved or closed (null). */
  onCut: (state: CutState | null) => void;
  /** Walked into a compartment (title) or left it (null). */
  onInside: (title: string | null) => void;
  /** Rendering failed (lost context, shader error): the host should fall back to the SVG view. */
  onError: (err: unknown) => void;
}

const SKIP = /^(pin_|stem_|next_domino|masthead|cut_section|hull_number)/;

interface Inside {
  group: THREE.Group;
  blockers: Blocker[];
  bounds: [number, number, number, number];
  offset: THREE.Vector3;
  lights: [THREE.Light, number][];
  fog: THREE.Fog | THREE.FogExp2 | null;
  ground: boolean;
  sea: boolean;
  halves: boolean[];
  overlayDisplay: string;
  exposure: number;
  saved: {
    fov: number;
    near: number;
    far: number;
    ez: boolean;
    ep: boolean;
    rs: number;
    mind: number;
    maxd: number;
    minp: number;
    maxp: number;
    damp: boolean;
  };
}
const isDesc = (o: THREE.Object3D | null, root: THREE.Object3D) => {
  while (o) {
    if (o === root) return true;
    o = o.parent;
  }
  return false;
};

/**
 * Imperative three.js scene for the ship model. React owns the controls and panels; this class owns the
 * renderer, camera, hull, pins, cut-away and per-frame work. One instance per mounted <ShipModel3D>.
 */
export class ShipScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(45, 1, 0.01, 500);
  private ctl: OrbitControls;
  private key: THREE.DirectionalLight;
  private ground: THREE.Mesh;
  private guide: THREE.Mesh;
  private M: Mats = createMaterials();
  private info: HullInfo | null = null;
  private pinSet: PinSet | null = null;
  private sea: THREE.Group | null = null;
  private split: Split | null = null;
  private cutMode: CutMode = 'x';
  private cutFace = 1;
  private curView: ViewKind = 'sky';
  private userMoved = false;
  /** Camera flight between views, eased like the Shore Overview's. */
  private tween: { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; start: number; dur: number; near: number; far: number } | null = null;
  private animate = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private xray = true;
  private seaOn = true;
  private visible = true;
  private failed = false;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private down: { x: number; y: number; t: number } | null = null;
  private hover: { x: number; y: number } | null = null;
  private t0 = performance.now();
  /** False until the camera has been fitted to the current hull (labels would project to NaN before). */
  private framed = false;
  private inside: Inside | null = null;
  private keys = new Set<string>();
  private walkT = 0;
  private fw = new THREE.Vector3();
  private rt = new THREE.Vector3();
  private mv = new THREE.Vector3();

  constructor(
    private host: HTMLElement,
    private overlay: HTMLElement,
    private ev: SceneEvents,
  ) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.18;
    r.localClippingEnabled = true; // cut halves use per-material clipping planes
    r.domElement.className = 's3-canvas';
    host.prepend(r.domElement);
    this.renderer = r;

    this.ctl = new OrbitControls(this.cam, r.domElement);
    this.ctl.enableDamping = true;
    this.ctl.dampingFactor = 0.08;
    this.ctl.addEventListener('start', () => {
      this.userMoved = true;
      this.tween = null; // the user took the camera; stop flying
    });

    // Studio key + fill, cool rim and warm fill, soft ground shadow.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0));
    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0002;
    this.scene.add(this.key, this.key.target);
    const fill = new THREE.DirectionalLight(0xfff4e6, 0.5);
    fill.position.set(-5, 3, -4);
    const rim = new THREE.DirectionalLight(0x7fd8ff, 1.3);
    rim.position.set(-60, 40, -90);
    const warm = new THREE.DirectionalLight(0xffe2b8, 0.6);
    warm.position.set(80, 30, 60);
    this.scene.add(fill, rim, warm);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ opacity: 0.18 }));
    this.ground.name = 'ground_shadow';
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Cyan guide plane that previews where a click on the hull will cut.
    this.guide = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.guide.name = 'cut_guide';
    this.guide.visible = false;
    this.scene.add(this.guide);

    this.resize();
    this.ro = new ResizeObserver(() => {
      this.resize();
      if (this.info && !this.userMoved) this.view(this.curView);
    });
    this.ro.observe(host);
    // Stop drawing while the panel is scrolled out of view.
    this.io = new IntersectionObserver((es) => {
      this.visible = es.some((e) => e.isIntersecting);
    });
    this.io.observe(host);

    const el = r.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerleave', this.onLeave);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    r.setAnimationLoop(this.loop);
  }

  // ---------------------------------------------------------------- public API

  /**
   * `points` are the dataset's mount positions (model units). The hand-built hull places the mounts it
   * knows; any other mount a system uses falls back to the dataset position, so no system loses its pin.
   */
  setHull(type: HullType, hullNumber: string, systems: ShipSystem[], points: Record<string, [number, number, number]> = {}) {
    this.leave(true);
    this.closeCut();
    this.clearHull();
    this.framed = false;
    const ctx: BuildCtx = { M: this.M, hc: null, lights: [] };
    const b = hullDef(type).build(ctx);
    const info: HullInfo = { ...b, type, hc: ctx.hc, lights: ctx.lights, bb: new THREE.Box3() };
    const deck = info.deckY ?? 0;
    info.quietMounts = new Set();
    for (const [id, [x, y, z]] of Object.entries(points))
      if (!info.mounts[id]) {
        info.mounts[id] = mk(x, y, z, 'up', y > deck ? deck : y - 1);
        info.quietMounts.add(id);
      }
    dress(info, this.M, hullNumber);
    info.bb.setFromObject(info.g);
    this.info = info;
    info.g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scene.add(info.g);
    this.fitShadow(info.bb);
    this.pinSet = buildPins(info, systems, this.overlay, this.cutAtSystem);
    setXray(this.M, this.xray);
    this.sea = buildSea(info);
    this.sea.visible = this.seaOn;
    this.scene.add(this.sea);
    this.scene.fog = new THREE.Fog(0x08111d, info.len * 1.6, info.len * 7);
    this.ev.onHull(type, new Set(Object.keys(info.mounts)));
    if (this.curView === 'cut') this.curView = 'sky';
    // two frames so the stage has its final size before fitting the camera
    requestAnimationFrame(() => requestAnimationFrame(() => this.info === info && this.view(this.curView)));
  }

  /** Live status update: rebuild only the pins (and re-open an open cut so its halves carry them). */
  setSystems(systems: ShipSystem[]) {
    const info = this.info;
    if (!info) return;
    this.leave(true);
    if (this.pinSet) disposePins(this.pinSet);
    this.pinSet = buildPins(info, systems, this.overlay, this.cutAtSystem);
    const sp = this.split;
    if (sp) {
      const f = sp.focus ? (this.pinSet.pins[sp.focus.id] ?? null) : null;
      this.openCut(f ? (sp.mode === 'z' ? f.p.z : f.p.x) : sp.cx, f, false);
    }
  }

  setView(kind: ViewKind) {
    if (this.inside) this.leave(true);
    this.view(kind, true);
  }

  setXray(on: boolean) {
    this.xray = on;
    setXray(this.M, on, this.split?.cm);
  }

  setSea(on: boolean) {
    this.seaOn = on;
    if (this.sea && !this.inside) this.sea.visible = on;
  }

  /** Across (x) or lengthwise (z). Changing it while cut re-opens at the same system or position. */
  setCutMode(m: CutMode) {
    this.cutMode = m;
    const sp = this.split;
    const info = this.info;
    if (!sp || !info) return;
    const f = sp.focus;
    this.openCut(m === 'z' ? (f ? f.p.z : 0) : f ? f.p.x : (info.bb.min.x + info.bb.max.x) / 2, f);
  }

  /** Cut the ship open at a system's pin. */
  cutAtSystem = (id: string) => {
    const pi = this.pinSet?.pins[id];
    if (pi) this.openCut(this.cutMode === 'z' ? pi.p.z : pi.p.x, pi);
  };

  flip() {
    if (this.inside) return;
    this.cutFace *= -1;
    this.view('cut', true);
  }

  /** Step into the compartment at the open cut. Drag looks around; WASD walks. */
  enter() {
    const sp = this.split;
    const info = this.info;
    if (!sp || !info || this.inside) return;
    this.tween = null; // stepping inside places the camera directly
    const focus = sp.focus;
    const lengthwise = sp.mode === 'z';
    const x = focus ? focus.p.x : lengthwise ? (info.bb.min.x + info.bb.max.x) / 2 : sp.cx;
    const z = lengthwise ? sp.cx : (focus?.p.z ?? 0);
    const landing = buildLanding(info, { x, z, mount: focus?.mount ?? null, lengthwise });
    const room = landing.room;
    const title = focus ? `${focus.name} · ${landing.title}` : landing.title;
    const offset = V(0, 0, 900);
    room.group.position.copy(offset);

    const lights: [THREE.Light, number][] = [];
    this.scene.traverse((o) => {
      const l = o as THREE.Light;
      if (l.isLight) {
        lights.push([l, l.intensity]);
        l.intensity *= 0.05;
      }
    });
    this.scene.add(room.group);
    // Indoors the outdoor exposure blows painted bulkheads out to white.
    const exposure = this.renderer.toneMappingExposure;
    this.renderer.toneMappingExposure = 0.86;
    const fog = this.scene.fog;
    this.scene.fog = null;
    const ground = this.ground.visible;
    this.ground.visible = false;
    const halves = sp.halves.map((h) => h.visible);
    for (const h of sp.halves) h.visible = false;
    const seaVis = !!this.sea?.visible;
    if (this.sea) this.sea.visible = false;
    this.guide.visible = false;
    const overlayDisplay = this.overlay.style.display;
    this.overlay.style.display = 'none';

    const ctl = this.ctl;
    const saved: Inside['saved'] = {
      fov: this.cam.fov,
      near: this.cam.near,
      far: this.cam.far,
      ez: ctl.enableZoom,
      ep: ctl.enablePan,
      rs: ctl.rotateSpeed,
      mind: ctl.minDistance,
      maxd: ctl.maxDistance,
      minp: ctl.minPolarAngle,
      maxp: ctl.maxPolarAngle,
      damp: ctl.enableDamping,
    };
    this.cam.fov = 72;
    this.cam.near = 0.05;
    this.cam.far = 140;
    this.cam.updateProjectionMatrix();
    ctl.enableZoom = false;
    ctl.enablePan = false;
    ctl.enableDamping = false;
    ctl.rotateSpeed = -0.6;
    ctl.minDistance = 0.02;
    ctl.maxDistance = 0.02;
    ctl.minPolarAngle = Math.PI * 0.3;
    ctl.maxPolarAngle = Math.PI * 0.75;
    const tg = V(offset.x + room.eye[0], 1.65, offset.z + room.eye[1]);
    const look = V(room.look[0], 0, room.look[1]).normalize();
    ctl.target.copy(tg);
    this.cam.position.copy(tg).addScaledVector(look, -0.02);
    ctl.update();
    this.userMoved = true;
    this.walkT = performance.now();
    this.keys.clear();
    this.inside = {
      group: room.group,
      blockers: room.blockers,
      bounds: room.bounds,
      offset,
      lights,
      fog,
      ground,
      sea: seaVis,
      halves,
      overlayDisplay,
      exposure,
      saved,
    };
    this.ev.onInside(title);
  }

  /** Leave the compartment and restore the cut (unless quiet, for a hull change or dispose). */
  leave(quiet = false) {
    const inn = this.inside;
    if (!inn) return;
    this.scene.remove(inn.group);
    disposeInterior(inn.group);
    this.renderer.toneMappingExposure = inn.exposure;
    for (const [l, intensity] of inn.lights) l.intensity = intensity;
    this.scene.fog = inn.fog;
    this.ground.visible = inn.ground;
    const sp = this.split;
    if (sp) sp.halves.forEach((h, i) => (h.visible = inn.halves[i] ?? true));
    if (this.sea) this.sea.visible = inn.sea && this.seaOn;
    this.overlay.style.display = inn.overlayDisplay;
    const s = inn.saved;
    this.cam.fov = s.fov;
    this.cam.near = s.near;
    this.cam.far = s.far;
    this.cam.updateProjectionMatrix();
    const ctl = this.ctl;
    ctl.enableZoom = s.ez;
    ctl.enablePan = s.ep;
    ctl.rotateSpeed = s.rs;
    ctl.minDistance = s.mind;
    ctl.maxDistance = s.maxd;
    ctl.minPolarAngle = s.minp;
    ctl.maxPolarAngle = s.maxp;
    ctl.enableDamping = s.damp;
    this.inside = null;
    this.keys.clear();
    this.ev.onInside(null);
    if (!quiet && sp) this.view('cut');
  }

  close() {
    const wasCut = !!this.split;
    this.leave(true);
    this.closeCut();
    if (wasCut) this.view(this.curView, true);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.io.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerleave', this.onLeave);
    this.leave(true);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.split) disposeSplit(this.split);
    this.split = null;
    this.clearHull();
    disposeTree(this.scene);
    disposeMaterials(this.M);
    this.ctl.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
    this.overlay.replaceChildren();
  }

  // ---------------------------------------------------------------- cut-away

  private openCut(cx: number, focus: PinInfo | null, reframe = true) {
    const info = this.info;
    if (!info) return;
    this.leave(true);
    const mode = this.cutMode;
    cx = clampCut(info, mode, cx);
    const prev = this.split;
    const sp = makeSplit(info, mode, cx, focus, prev);
    if (prev) {
      for (const h of prev.halves) this.scene.remove(h);
      disposeSplit(prev);
    }
    for (const h of sp.halves) this.scene.add(h);
    setXray(this.M, this.xray, sp.cm);
    this.split = sp;
    info.g.visible = false;
    this.guide.visible = false;
    const where =
      mode === 'z'
        ? Math.abs(cx) < 0.05
          ? 'on the centerline'
          : `${Math.abs(cx).toFixed(1)} m off centerline, ${cx < 0 ? 'port' : 'starboard'}`
        : `${(cx - info.bb.min.x).toFixed(0)} m from stern`;
    this.ev.onCut({
      focusId: focus?.id ?? null,
      name: focus?.name ?? null,
      status: focus?.st ?? null,
      title: sp.label,
      detail: focus ? (KD[focus.mount]?.[1] ?? null) : null,
      where,
      mode,
    });
    if (reframe) this.view('cut', true);
    else this.applyHalves();
  }

  private closeCut() {
    const sp = this.split;
    if (!sp) return;
    if (this.curView === 'cut') this.curView = 'iso';
    for (const h of sp.halves) this.scene.remove(h);
    disposeSplit(sp);
    this.split = null;
    if (this.info) this.info.g.visible = true;
    this.ev.onCut(null);
  }

  /** Ease the halves apart and move the clipping planes and label anchors with them. */
  private stepSplit() {
    const anchors = this.pinSet?.anchors ?? [];
    const sp = this.split;
    if (!sp) {
      for (const a of anchors) a.v.copy(a.base);
      return;
    }
    sp.cur += (sp.gap - sp.cur) * 0.12;
    const off = sp.cur / 2;
    const ax = sp.mode === 'z' ? 'z' : 'x';
    sp.halves[0].position[ax] = off;
    sp.halves[1].position[ax] = -off;
    sp.planes.fwd.constant = -(sp.cx + off);
    sp.planes.aft.constant = sp.cx - off;
    const oneSide = this.curView === 'cut';
    for (const a of anchors) {
      a.v.copy(a.base);
      // The system we cut at sits on the cut itself: keep its label on the face we are looking at.
      if (oneSide && a.id === sp.focus?.id) a.v[ax] += this.cutFace === 1 ? -off : off;
      else a.v[ax] += a.base[ax] >= sp.cx ? off : -off;
    }
  }

  /** In the cut view the half in front of the face is hidden; elsewhere both show. */
  private applyHalves() {
    const sp = this.split;
    if (!sp) return;
    const cut = this.curView === 'cut';
    sp.halves[0].visible = !(cut && this.cutFace === 1);
    sp.halves[1].visible = !(cut && this.cutFace === -1);
  }

  private labelHidden = (a: Anchor) => {
    const sp = this.split;
    if (!sp) return false;
    if (a.id === sp.focus?.id) return false;
    const ax = sp.mode === 'z' ? 'z' : 'x';
    return (a.base[ax] >= sp.cx && !sp.halves[0].visible) || (a.base[ax] < sp.cx && !sp.halves[1].visible);
  };

  // ---------------------------------------------------------------- camera

  private clearHull() {
    if (this.pinSet) disposePins(this.pinSet);
    this.pinSet = null;
    if (this.info) {
      this.scene.remove(this.info.g);
      disposeTree(this.info.g, new Set(Object.values(this.M)));
    }
    if (this.sea) {
      this.scene.remove(this.sea);
      disposeTree(this.sea);
    }
    this.info = null;
    this.sea = null;
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  private fitShadow(bb: THREE.Box3) {
    this.ground.position.y = bb.min.y;
    const sphere = bb.getBoundingSphere(new THREE.Sphere());
    const R = sphere.radius;
    this.key.target.position.copy(sphere.center);
    this.key.position.copy(sphere.center).add(V(4, 7, 5).normalize().multiplyScalar(R * 2));
    const sc = this.key.shadow.camera;
    sc.left = -R * 1.5;
    sc.right = R * 1.5;
    sc.top = R * 1.5;
    sc.bottom = -R * 1.5;
    sc.near = 0.5;
    sc.far = R * 5;
    sc.updateProjectionMatrix();
  }

  /** Pixel bands occupied by the filter bar and the legend. Both blur the canvas behind them. */
  private chromeInsets() {
    const bar = this.host.querySelector('[aria-label="3D model filters"]')?.parentElement as HTMLElement | null;
    const legend = this.host.querySelector('[aria-label="3D model legend"]') as HTMLElement | null;
    return {
      top: (bar?.offsetHeight ?? 0) + 8,
      bottom: (legend?.offsetHeight ?? 0) + 8,
    };
  }

  /**
   * Side view looks along the beam, so the mast is a thin strip at the top of the picture.
   * Fit the whole hull, including the mast, and leave the filter bar plus one label of
   * headroom above it. Framing only the waterline hull parks that mast, and the Exterior
   * communications pin on it, inside the bar's blur.
   */
  private sideFrame(info: HullInfo, th: number, tv: number, ex: number) {
    const h = this.host.clientHeight || 1;
    const chrome = this.chromeInsets();
    const topFrac = Math.min(0.34, (chrome.top + 64) / h);
    const botFrac = Math.min(0.22, chrome.bottom / h);
    const usable = Math.max(0.45, 1 - topFrac - botFrac);
    const yMin = info.bb.min.y;
    const yMax = info.bb.max.y;
    const ySpan = Math.max(yMax - yMin, info.HH * 2, 1);
    const framed = ySpan / usable;
    const shipCenter = (yMin + yMax) / 2;
    const midScreen = botFrac + usable / 2;
    const targetY = shipCenter - (midScreen - 0.5) * framed;
    const dist = Math.max((info.len / 2 + ex) / th, framed / 2 / tv) * 1.06;
    return { center: V(0, targetY, 0), dir: V(0, 0.04, 1), dist };
  }

  /** The ship itself: the model's bounds trimmed to its length and beam, so wake and sea dressing don't count. */
  private hullBox(info: HullInfo) {
    const b = info.bb.clone();
    b.min.x = Math.max(b.min.x, -info.len / 2 - 2);
    b.max.x = Math.min(b.max.x, info.len / 2 + 2);
    b.min.z = Math.max(b.min.z, -info.beam / 2 - 1);
    b.max.z = Math.min(b.max.z, info.beam / 2 + 1);
    return b;
  }

  /**
   * Camera distance along `dir` (from target `c`) that keeps every corner of `bb` (widened by the split gaps)
   * inside the view, with room left for the toolbar above and the legend below the canvas.
   */
  private fitBox(bb: THREE.Box3, c: THREE.Vector3, dir: THREE.Vector3, th: number, tv: number, ex: number, exz: number) {
    const fwd = dir.clone().normalize().negate();
    const right = new THREE.Vector3().crossVectors(fwd, V(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd);
    const H = 0.92; // horizontal share of the half-width the ship may use
    const VT = 0.72; // upper half: the toolbar overlays the top of the canvas
    const VB = 0.84; // lower half: the legend strip overlays the bottom
    let dist = 0;
    for (const x of [bb.min.x - ex, bb.max.x + ex])
      for (const y of [bb.min.y, bb.max.y])
        for (const z of [bb.min.z - exz, bb.max.z + exz]) {
          const p = V(x, y, z).sub(c);
          const px = p.dot(right);
          const py = p.dot(up);
          const pz = p.dot(fwd);
          dist = Math.max(dist, Math.abs(px) / (th * H) - pz, (py > 0 ? py / (tv * VT) : -py / (tv * VB)) - pz);
        }
    return dist;
  }

  /** Frame the camera for a named view. Re-runs on resize until the user first orbits. `fly` eases the camera there. */
  private view(kind: ViewKind, fly = false) {
    const info = this.info;
    if (!info) return;
    if (kind === 'cut' && !this.split) kind = 'iso';
    this.curView = kind;
    this.userMoved = false;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const asp = w > 50 && h > 50 ? w / h : 1.4;
    const tv = Math.tan((22.5 * Math.PI) / 180);
    const th = tv * asp;
    let c = V(0, info.mid, 0);
    const sp = this.split;
    const zm = !!sp && sp.mode === 'z';
    const ex = sp && !zm ? sp.gap * 0.5 : 0;
    const exz = zm && sp ? sp.gap * 0.5 : 0;
    const fit = Math.max((info.len / 2 + ex) / th, (info.beam / 2 + exz) / tv) * 1.22 + info.HH * 0.5;
    const side = this.sideFrame(info, th, tv, ex);
    if (kind === 'side') c = side.center;
    const hb = this.hullBox(info);
    // aim at the middle of the ship, not the waterline, so the tall mast doesn't push the camera back
    if (kind === 'iso') c = V((hb.min.x + hb.max.x) / 2, hb.min.y + (hb.max.y - hb.min.y) * 0.4, (hb.min.z + hb.max.z) / 2);
    const dirs: Record<string, [THREE.Vector3, number]> = {
      sky: [V(0, 1, 0.001), fit],
      iso: [V(0.45, 0.6, 0.9), this.fitBox(hb, c, V(0.45, 0.6, 0.9), th, tv, ex, exz)],
      side: [side.dir, side.dist],
    };
    if (kind === 'cut' && sp) {
      const topY = info.sub ? info.HH : Math.max(info.deckY || info.HH, ...(info.houses || []).map((hs) => hs.y0 + hs.h));
      const cy = info.sub ? info.mid : topY / 2;
      const f = this.cutFace;
      c = zm ? V((info.bb.min.x + info.bb.max.x) / 2, cy, sp.cx - (f * sp.gap) / 2) : V(sp.cx - (f * sp.gap) / 2, cy, 0);
      dirs.cut = [
        zm ? V(0.1, 0.12, f) : V(f * 0.8, 0.22, 0.4),
        zm
          ? Math.max((info.len / 2 / th) * 1.04, (topY * 1.4) / (2 * tv)) * 1.04
          : (Math.max(topY * 1.5, (info.beam * 1.4) / asp) / (2 * tv)) * 1.15 + sp.gap * 0.5,
      ];
    }
    const [d, dist] = dirs[kind] ?? dirs.iso;
    const near = Math.max(dist / 200, 0.05);
    const far = dist * 20;
    const pos = c.clone().add(d.clone().normalize().multiplyScalar(dist));
    if (fly && this.animate && this.framed) {
      // Widen the clip range for the flight so nothing pops in or out on the way; set exactly on arrival.
      this.cam.near = Math.min(this.cam.near, near);
      this.cam.far = Math.max(this.cam.far, far);
      this.cam.updateProjectionMatrix();
      this.tween = { p0: this.cam.position.clone(), p1: pos, t0: this.ctl.target.clone(), t1: c.clone(), start: performance.now(), dur: 900, near, far };
    } else {
      this.tween = null;
      this.cam.near = near;
      this.cam.far = far;
      this.cam.updateProjectionMatrix();
      this.cam.position.copy(pos);
      this.ctl.target.copy(c);
      this.ctl.update();
    }
    this.framed = true;
    this.applyHalves();
    this.ev.onView(kind);
  }

  // ---------------------------------------------------------------- input

  private setRay(x: number, y: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.cam);
  }

  /** First hull surface under the ray (skips pins, labels, caps and decals). */
  private pickHull(roots: THREE.Object3D[]) {
    return this.ray
      .intersectObjects(roots, true)
      .find((h) => h.object.visible && !SKIP.test(h.object.name) && !/^(pin_|stem_)/.test(h.object.parent?.name || ''));
  }

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  /** A click (not a drag): pin = cut at that system, hull = cut there, empty space = close the cut. */
  private onUp = (e: PointerEvent) => {
    const d0 = this.down;
    this.down = null;
    const info = this.info;
    if (!d0 || !info || this.inside) return;
    if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 5 || performance.now() - d0.t > 600) return;
    this.setRay(e.clientX, e.clientY);
    const sp = this.split;
    const roots = sp ? sp.halves.filter((h) => h.visible) : [info.g];
    const ph = this.ray.intersectObjects(roots, true).find((x) => /^pin_/.test(x.object.name));
    if (ph) {
      this.cutAtSystem(ph.object.name.slice(4));
      return;
    }
    const h = this.pickHull(roots);
    if (!h) {
      this.close();
      return;
    }
    const ax = this.cutMode === 'z' ? 'z' : 'x';
    let x = h.point[ax];
    if (sp && sp.mode === this.cutMode) x -= (isDesc(h.object, sp.halves[0]) ? 1 : -1) * (sp.cur / 2);
    this.openCut(x, null);
  };

  private onMove = (e: PointerEvent) => {
    this.hover = e.buttons ? null : { x: e.clientX, y: e.clientY };
    if (e.buttons) this.guide.visible = false;
  };

  private onLeave = () => {
    this.hover = null;
    this.guide.visible = false;
  };

  private typing(e: KeyboardEvent) {
    const t = e.target;
    return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.typing(e)) this.keys.add(e.key.toLowerCase());
    if (e.key === 'Escape') {
      if (this.inside) {
        e.preventDefault();
        this.leave();
        return;
      }
      if (this.split) this.close();
    }
    if (this.inside && (e.key.startsWith('Arrow') || e.key === ' ')) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  /** WASD / arrows at 3.2 m/s (Shift 6.5), stopped by room bounds and equipment boxes. */
  private stepWalk() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.walkT) / 1000);
    this.walkT = now;
    const inn = this.inside;
    if (!inn) return;
    this.fw.set(this.ctl.target.x - this.cam.position.x, 0, this.ctl.target.z - this.cam.position.z);
    if (this.fw.lengthSq() < 1e-9) return;
    this.fw.normalize();
    this.rt.set(-this.fw.z, 0, this.fw.x);
    this.mv.set(0, 0, 0);
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) this.mv.add(this.fw);
    if (k.has('s') || k.has('arrowdown')) this.mv.addScaledVector(this.fw, -1);
    if (k.has('d') || k.has('arrowright')) this.mv.add(this.rt);
    if (k.has('a') || k.has('arrowleft')) this.mv.addScaledVector(this.rt, -1);
    if (this.mv.lengthSq() === 0) return;
    this.mv.normalize().multiplyScalar((k.has('shift') ? 6.5 : 3.2) * dt);
    const o = inn.offset;
    const b = inn.bounds;
    const nx = this.ctl.target.x - o.x;
    const nz = this.ctl.target.z - o.z;
    const hit = (x: number, z: number) =>
      x < b[0] || x > b[1] || z < b[2] || z > b[3] || inn.blockers.some((r) => x > r.x0 - 0.3 && x < r.x1 + 0.3 && z > r.z0 - 0.3 && z < r.z1 + 0.3);
    let ax = nx + this.mv.x;
    let az = nz;
    if (hit(ax, az)) ax = nx;
    az = nz + this.mv.z;
    if (hit(ax, az)) az = nz;
    const dx = ax - nx;
    const dz = az - nz;
    this.ctl.target.x += dx;
    this.ctl.target.z += dz;
    this.cam.position.x += dx;
    this.cam.position.z += dz;
  }

  /** Hover preview (once per frame, not per mouse event). */
  private stepHover() {
    const info = this.info;
    const hv = this.hover;
    this.hover = null;
    if (!hv || this.inside) return;
    const el = this.renderer.domElement;
    if (this.split || !info) {
      this.guide.visible = false;
      el.style.cursor = '';
      return;
    }
    this.setRay(hv.x, hv.y);
    const pin = this.ray.intersectObjects([info.g], true).find((x) => /^pin_/.test(x.object.name));
    const h = pin ? null : this.pickHull([info.g]);
    el.style.cursor = pin ? 'pointer' : h ? 'crosshair' : '';
    if (!h) {
      this.guide.visible = false;
      return;
    }
    this.guide.visible = true;
    if (this.cutMode === 'z') {
      this.guide.rotation.y = 0;
      this.guide.position.set((info.bb.min.x + info.bb.max.x) / 2, info.mid, h.point.z);
      this.guide.scale.set(info.len * 1.1, info.HH * 1.7, 1);
    } else {
      this.guide.rotation.y = Math.PI / 2;
      this.guide.position.set(h.point.x, info.mid, 0);
      this.guide.scale.set(info.beam * 1.5, info.HH * 1.7, 1);
    }
  }

  private stepTween(now: number) {
    const tw = this.tween;
    if (!tw) return;
    const k = Math.min(1, (now - tw.start) / tw.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // ease in-out cubic
    this.cam.position.lerpVectors(tw.p0, tw.p1, e);
    this.ctl.target.lerpVectors(tw.t0, tw.t1, e);
    if (k >= 1) {
      this.tween = null;
      this.cam.near = tw.near;
      this.cam.far = tw.far;
      this.cam.updateProjectionMatrix();
    }
  }

  private loop = () => {
    if (!this.visible || this.failed) return;
    try {
      const now = performance.now();
      const t = (now - this.t0) / 1000;
      this.stepTween(now);
      this.ctl.update();
      this.stepWalk();
      this.stepHover();
      this.stepSplit();
      if (this.pinSet && this.framed && !this.inside) {
        // next-domino ring breathes so it reads as "act here"
        const k = 1 + 0.12 * Math.sin(t * 3.2);
        for (const r of this.pinSet.rings) r.scale.set(k, k, k);
        const chrome = this.chromeInsets();
        layoutLabels(this.pinSet.anchors, this.cam, this.host.clientWidth, this.host.clientHeight, this.labelHidden, chrome);
      }
      this.renderer.render(this.scene, this.cam);
    } catch (err) {
      this.failed = true;
      this.ev.onError(err);
    }
  };
}
