import * as THREE from 'three';
import type { ShipSystem, Status } from '../../api/types';
import { STATUS } from '../../theme/status';
import { add, disposeTree, V } from './geom';
import type { HullInfo, PinInfo } from './types';

const COL: Record<Status, number> = { risk: 0xfb4d5d, watch: 0xfbbf24, ready: 0x34d399 };

/** A screen-space label anchor: follows the pin (and its cut half) every frame. */
export interface Anchor {
  id: string;
  el: HTMLButtonElement | null;
  ln: SVGLineElement | null;
  dn: boolean;
  base: THREE.Vector3;
  v: THREE.Vector3;
}

export interface PinSet {
  group: THREE.Group;
  anchors: Anchor[];
  pins: Record<string, PinInfo>;
  rings: THREE.Mesh[];
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Resolve each system's mount on this hull and build its pin (sphere, stem, next-domino ring) plus an
 * HTML label in the overlay. Systems whose mount the hull lacks get no pin.
 */
export function buildPins(info: HullInfo, systems: ShipSystem[], overlay: HTMLElement, onPick: (id: string) => void): PinSet {
  overlay.replaceChildren();
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 's3-leaders');
  svg.setAttribute('aria-hidden', 'true');
  overlay.appendChild(svg);

  const group = new THREE.Group();
  group.name = 'status_pins';
  const anchors: Anchor[] = [];
  const pins: Record<string, PinInfo> = {};
  const rings: THREE.Mesh[] = [];
  const sc = info.len > 200 ? 1.8 : 1;
  const mats = new Map<Status, THREE.MeshStandardMaterial>();
  const matFor = (st: Status) => {
    let m = mats.get(st);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: COL[st], emissive: COL[st], emissiveIntensity: 0.9 });
      m.name = 'pin_' + st;
      mats.set(st, m);
    }
    return m;
  };

  for (const s of systems) {
    if (!s.mount || s.deck === 'none') continue;
    const mt = info.mounts[s.mount];
    if (!mt) continue;
    const st = s.status;
    const p = mt.p.clone();
    pins[s.id] = { id: s.id, name: s.name, mount: s.mount, deck: s.deck, st, dom: s.isNextDomino, p: p.clone() };
    const m = matFor(st);
    add(group, 'pin_' + s.id, new THREE.SphereGeometry((s.deck === 'top' ? 1.4 : 1) * sc, 24, 16), m, p.x, p.y, p.z);
    if (s.deck === 'top') {
      const h = Math.max(0.5, p.y - mt.base);
      add(group, 'stem_' + s.id, new THREE.CylinderGeometry(0.07 * sc, 0.07 * sc, h, 6), m, p.x, mt.base + h / 2, p.z);
    }
    if (s.isNextDomino) {
      const r = add(group, 'next_domino_ring', new THREE.TorusGeometry(2.7 * sc, 0.17 * sc, 12, 48), m, p.x, p.y, p.z);
      r.rotation.x = -Math.PI / 2;
      rings.push(r);
    }

    // Surface ships label deck pins; below-deck pins get a label only when they need attention (status in text, not color alone).
    const labelled = s.deck === 'top' || info.labelAll || s.isNextDomino || st !== 'ready';
    let el: HTMLButtonElement | null = null;
    let ln: SVGLineElement | null = null;
    if (labelled) {
      const meta = STATUS[st];
      el = document.createElement('button');
      el.type = 'button';
      el.className = 's3-lb' + (s.isNextDomino ? ' dom' : '') + (mt.side === 'dn' ? ' dn' : '');
      el.style.borderColor = meta.hex;
      el.setAttribute('aria-label', `${s.name}: ${meta.label}${s.isNextDomino ? ', next domino' : ''}. Cut the ship open here.`);
      if (s.isNextDomino) {
        const cap = document.createElement('small');
        cap.className = 's3-dom';
        cap.textContent = 'NEXT DOMINO';
        el.appendChild(cap);
      }
      el.appendChild(document.createTextNode(s.name));
      const stEl = document.createElement('small');
      stEl.style.color = meta.hex;
      stEl.textContent = meta.label;
      el.appendChild(stEl);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onPick(s.id);
      });
      overlay.appendChild(el);
      ln = document.createElementNS(SVG_NS, 'line');
      ln.setAttribute('stroke', meta.hex);
      ln.setAttribute('stroke-width', '1.5');
      ln.setAttribute('stroke-opacity', '.8');
      svg.appendChild(ln);
    }
    const base = p.clone().add(V(0, 1.6 * sc, 0));
    anchors.push({ id: s.id, el, ln, dn: mt.side === 'dn', base, v: base.clone() });
  }
  info.g.add(group);
  return { group, anchors, pins, rings };
}

export function disposePins(set: PinSet) {
  set.group.parent?.remove(set.group);
  disposeTree(set.group);
}

const tmp = new THREE.Vector3();
type Box = { l: number; r: number; t: number; b: number };

/**
 * Place labels for this frame: project each anchor, keep its fixed side (up/down), then nudge to avoid
 * overlap (up/down steps first, then sideways) and clamp inside the stage. Leader lines join label to pin.
 */
export function layoutLabels(anchors: Anchor[], cam: THREE.Camera, w: number, h: number, hidden: (a: Anchor) => boolean) {
  const placed: Box[] = [];
  for (const a of anchors) {
    if (!a.el || !a.ln) continue;
    if (hidden(a)) {
      a.el.style.display = 'none';
      a.ln.style.display = 'none';
      continue;
    }
    tmp.copy(a.v).project(cam);
    if (tmp.z >= 1) {
      a.el.style.display = 'none';
      a.ln.style.display = 'none';
      continue;
    }
    a.el.style.display = 'block';
    a.ln.style.display = 'block';
    const px = ((tmp.x + 1) / 2) * w;
    const py = ((1 - tmp.y) / 2) * h;
    const ew = a.el.offsetWidth;
    const eh = a.el.offsetHeight;
    const s = (a.dn ? 1 : -1) * (eh + 4);
    const rect = (x: number, y: number): Box => ({ l: x - ew / 2, r: x + ew / 2, t: a.dn ? y : y - eh, b: a.dn ? y + eh : y });
    const ok = (r: Box) => r.l >= 2 && r.r <= w - 2 && r.t >= 2 && r.b <= h - 2 && !placed.some((p) => r.l < p.r && r.r > p.l && r.t < p.b && r.b > p.t);
    const base = py + (a.dn ? 20 : -10);
    const side = ew * 0.6 + 8;
    const tries: [number, number][] = [
      [0, 0],
      [0, s],
      [0, 2 * s],
      [side, 0],
      [-side, 0],
      [side, s],
      [-side, s],
      [0, -s],
      [side, 2 * s],
      [-side, 2 * s],
    ];
    let pick = tries[0];
    for (const o of tries)
      if (ok(rect(px + o[0], base + o[1]))) {
        pick = o;
        break;
      }
    let x = px + pick[0];
    let y = base + pick[1];
    const r0 = rect(x, y);
    x += Math.max(0, 2 - r0.l) - Math.max(0, r0.r - (w - 2));
    y += Math.max(0, 2 - r0.t) - Math.max(0, r0.b - (h - 2));
    placed.push(rect(x, y));
    a.el.style.left = x + 'px';
    a.el.style.top = y + 'px';
    a.ln.setAttribute('x1', String(px));
    a.ln.setAttribute('y1', String(py));
    a.ln.setAttribute('x2', String(x));
    a.ln.setAttribute('y2', String(y));
  }
}
