import * as THREE from 'three';
import { add, mulberry } from './geom';
import type { HullInfo } from './types';
import type { Mats } from './materials';

/** Masthead lights, hull-number decals, rail posts and small deck fittings. Generated in code, no image files. */
export function dress(info: HullInfo, M: Mats, hullNumber: string) {
  const g = info.g;
  const dg = new THREE.Group();
  dg.name = 'detailing';
  g.add(dg);
  const lm = new THREE.MeshBasicMaterial({ color: 0xfff6dd });
  lm.name = 'mast_light';
  for (const [x, y, z] of info.lights) add(dg, 'masthead_light', new THREE.SphereGeometry(0.28, 12, 10), lm, x, y, z);
  if (info.sub || !info.hc) return;
  const hc = info.hc;
  const rnd = mulberry(7 + Math.round(info.len));
  const Y = info.deckY ?? hc.HH;

  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const cx = cv.getContext('2d');
  if (cx) {
    cx.fillStyle = '#f2f4f6';
    cx.font = '700 104px Inter, Arial, sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(hullNumber, 128, 68, 240);
  }
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  const dm = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false });
  dm.name = 'hull_number_decal';
  const hx = hc.x0 + (hc.x1 - hc.x0) * (info.flat ? 0.74 : 0.8);
  const hh = hc.HH * 0.3;
  for (const s of [-1, 1]) {
    const p = add(dg, 'hull_number', new THREE.PlaneGeometry(hh * 2, hh), dm, hx, hc.HH * 0.7, s * (hc.hw(hx) * 0.992 + 0.06));
    p.rotation.y = s > 0 ? 0 : Math.PI;
  }
  if (info.flat) return;
  for (let x = hc.x0 + 6; x < hc.x1 * 0.78; x += 4) {
    const w = hc.hw(x) * 1.04 - 0.3;
    if (w < 1.2) break;
    for (const s of [-1, 1]) add(dg, 'rail_post', new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), M.light, x, Y + 0.55, s * w);
  }
  const n = Math.round(info.len / 2.2);
  for (let i = 0; i < n; i++) {
    const x = hc.x0 + (hc.x1 * 0.8 - hc.x0) * rnd();
    const w = hc.hw(x);
    if (w < 3) continue;
    const s = rnd() < 0.5 ? -1 : 1;
    const z = s * w * (0.64 + 0.3 * rnd());
    const k = rnd();
    if (k < 0.4) add(dg, 'vent', new THREE.CylinderGeometry(0.28, 0.34, 0.6 + rnd() * 0.5, 10), M.fitting, x, Y + 0.3, z);
    else if (k < 0.75) add(dg, 'deck_box', new THREE.BoxGeometry(0.8 + rnd() * 0.9, 0.5, 0.7), M.fitting, x, Y + 0.25, z);
    else add(dg, 'bollard', new THREE.CylinderGeometry(0.18, 0.22, 0.55, 8), M.dark, x, Y + 0.28, z);
  }
}

function seaTex() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  if (c) {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 256, 256);
    const r = mulberry(3);
    c.strokeStyle = 'rgba(130,190,215,.5)';
    c.lineWidth = 1.4;
    for (let i = 0; i < 70; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const l = 10 + r() * 26;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + l / 2, y - 3 - r() * 3, x + l, y);
      c.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function wakeTex() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const c = cv.getContext('2d');
  if (c) {
    const gr = c.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, 'rgba(255,255,255,.75)');
    gr.addColorStop(0.5, 'rgba(255,255,255,.28)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr;
    c.fillRect(0, 0, 256, 64);
    const r = mulberry(9);
    for (let i = 0; i < 120; i++) {
      c.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.12})`;
      c.fillRect(r() * 256, r() * 64, 10 + r() * 40, 1);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Translucent textured sea with a foam outline around the hull and a wake astern. */
export function buildSea(info: HullInfo) {
  const sea = new THREE.Group();
  sea.name = 'sea';
  const y = info.sea ?? info.HH * 0.5;
  const pl = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshStandardMaterial({ color: 0x1a6a8c, map: seaTex(), transparent: true, opacity: 0.55, roughness: 0.25, metalness: 0.15, depthWrite: false }),
  );
  pl.name = 'sea_surface';
  pl.rotation.x = -Math.PI / 2;
  sea.add(pl);
  const hc = info.hc;
  if (hc && !info.sub) {
    const x0 = hc.x0;
    const x1 = hc.x1;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const x = x0 + ((x1 - x0) * i) / 60;
      pts.push([x, hc.hw(x) * 0.93 + 0.9]);
    }
    const sh = new THREE.Shape();
    pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
    pts
      .slice()
      .reverse()
      .forEach(([x, z]) => sh.lineTo(x, z));
    const fg = new THREE.ShapeGeometry(sh);
    fg.rotateX(-Math.PI / 2);
    const foam = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xe9f6fb, transparent: true, opacity: 0.38, depthWrite: false }));
    foam.name = 'foam';
    foam.position.y = 0.06;
    sea.add(foam);
    const w0 = hc.hw(x0) * 0.95;
    const len = info.len * 1.25;
    const w1 = w0 + info.len * 0.22;
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute([x0, 0, -w0, x0, 0, w0, x0 - len, 0, w1, x0 - len, 0, -w1], 3));
    wg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2));
    wg.setIndex([0, 1, 2, 0, 2, 3]);
    const wk = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ map: wakeTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    wk.name = 'wake';
    wk.position.y = 0.1;
    sea.add(wk);
  }
  sea.position.y = y;
  return sea;
}
