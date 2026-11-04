import * as THREE from 'three';
import { add, bx, cyl, mk } from '../geom';
import type { BuildCtx, HullBuild, Mount, Side, Zone } from '../types';

export interface SubCfg {
  cls: 'SSN' | 'SSBN' | 'SSGN';
  L: number;
  /** Hull diameter. */
  Dm: number;
  sailU: number;
  sailH: number;
  sailL: number;
  sailPlanes?: boolean;
  /** Virginia payload tubes forward. */
  vpt?: boolean;
  tubes?: { cols: number; rows: number; u0: number };
  /** SSGN lock-out chambers (first tube row). */
  lock?: boolean;
  dds?: boolean;
}

/** Submarine: lathed pressure hull, sail, planes, cruciform tail, pump-jet; optional missile deck. */
export function buildSub(c: SubCfg, ctx: BuildCtx): HullBuild {
  const { M } = ctx;
  const g = new THREE.Group();
  g.name = c.cls;
  const L = c.L;
  const R = c.Dm / 2;
  const x0 = -L / 2;
  const X = (u: number) => x0 + u * L;
  const Y = R;
  const r = (u: number) =>
    u < 0.16 ? R * (0.2 + 0.8 * Math.sin(((u / 0.16) * Math.PI) / 2)) : u > 0.9 ? R * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.9) / 0.1, 2) * 0.97)) : R;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 100; i++) {
    const u = i / 100;
    pts.push(new THREE.Vector2(Math.max(0.02, r(u)), x0 + u * L));
  }
  const hg = new THREE.LatheGeometry(pts, 48);
  hg.rotateZ(-Math.PI / 2);
  add(g, 'pressure_hull', hg, M.sub, 0, Y, 0);

  const sx = X(c.sailU);
  const sh = c.sailH;
  const sl = c.sailL;
  const sw = 3.2;
  {
    const s = new THREE.Shape();
    s.moveTo(-sl / 2, 0);
    s.lineTo(sl / 2, 0);
    s.lineTo(sl / 2 - 1.4, sh);
    s.lineTo(-sl / 2 + 2.2, sh);
    s.closePath();
    const gg = new THREE.ExtrudeGeometry(s, { depth: sw, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 2 });
    gg.translate(0, 0, -sw / 2);
    add(g, 'sail_fairwater', gg, M.subSail, sx, Y + R * 0.82, 0);
  }
  const sy = Y + R * 0.82 + sh;
  for (const [dx, hh, rr] of [
    [-1.6, 4.5, 0.18],
    [0, 3.5, 0.22],
    [1.6, 5.2, 0.14],
    [-3, 3, 0.12],
  ])
    cyl(g, 'sail_mast', M.dark, rr, rr, hh, sx + dx, sy + hh / 2, 0, 10);
  if (c.sailPlanes) for (const s of [-1, 1]) bx(g, 'sail_plane', M.subSail, 3.4, 0.25, 3.8, sx + sl * 0.12, Y + R * 0.82 + sh * 0.55, s * (sw / 2 + 1.9));
  else for (const s of [-1, 1]) bx(g, 'bow_plane', M.subSail, 2.4, 0.25, 3.6, X(0.86), Y + 0.3, s * (R + 1.6));
  for (let i = 0; i < 4; i++) {
    const a = new THREE.Group();
    a.position.set(X(0.05), Y, 0);
    a.rotation.x = (i * Math.PI) / 2 + Math.PI / 4;
    g.add(a);
    add(a, 'tail_fin', new THREE.BoxGeometry(3.2, R * 1.4, 0.35), M.subSail, 0, R * 0.9, 0);
  }
  {
    const sh2 = add(g, 'propulsor_shroud', new THREE.CylinderGeometry(R * 0.55, R * 0.5, 3.2, 36, 1, true), M.sub, x0 + 0.6, Y, 0);
    sh2.rotation.z = Math.PI / 2;
    add(g, 'propulsor_hub', new THREE.ConeGeometry(R * 0.3, 2.4, 24), M.brass, x0 - 1.4, Y, 0).rotation.z = Math.PI / 2;
  }
  const hat = new THREE.CylinderGeometry(1.15, 1.15, 0.18, 24);
  if (c.tubes) {
    const { cols, rows, u0 } = c.tubes;
    bx(g, 'missile_deck', M.subSail, cols * 2.7 + 2, R * 0.28, R * 1.4, X(u0) + cols * 1.35, Y + R * 0.9, 0);
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++)
        add(g, `missile_hatch_${i}_${j}`, hat, c.lock && i < 1 ? M.brass : M.dark, X(u0) + i * 2.7 + 0.7, Y + R * 0.9 + R * 0.14 + 0.1, (j - (rows - 1) / 2) * 2.7);
    if (c.dds) add(g, 'dry_deck_shelter', new THREE.CapsuleGeometry(1.5, 7, 6, 18), M.subSail, X(u0) + 1.5, Y + R * 0.9 + R * 0.14 + 1.8, 0).rotation.z = Math.PI / 2;
  }
  if (c.vpt) for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) add(g, 'vpt_hatch', new THREE.CylinderGeometry(0.55, 0.55, 0.14, 16), M.dark, X(0.76) + i * 1.7, Y + R * 0.97, (j - 0.5) * 1.7);

  const P3 = (x: number, y: number, z: number, side: Side = 'up', base?: number) => mk(x, y, z, side, base ?? y - 2);
  const mm: Record<string, Mount> = {
    photonics: P3(sx - 1.6, sy + 5.4, 0, 'up', sy + 4.5),
    sat: P3(sx + 1.6, sy + 6.6, 0, 'dn', sy + 5.2),
    sonar_bow: P3(X(0.95), Y, 0, 'up'),
    control: P3(sx, Y + R * 0.3, 0, 'up'),
    propulsor: P3(x0 + 0.5, Y, 0, 'dn'),
    towed_array: P3(X(0.04), Y, R * 0.6, 'up'),
  };
  if (c.cls === 'SSN')
    Object.assign(mm, {
      planes: P3(X(0.86), Y, R + 1.8, 'dn', Y),
      vls: P3(X(0.78), Y + R + 2.2, 0, 'up', Y + R),
      torpedo: P3(X(0.85), Y - 0.5, -1.5, 'dn'),
      reactor: P3(X(0.5), Y, 0, 'dn'),
      engine: P3(X(0.28), Y, 0, 'up'),
    });
  else {
    const t = c.tubes!;
    Object.assign(mm, {
      planes: P3(sx + sl * 0.12, Y + R * 0.82 + sh * 0.55, sw / 2 + 3, 'dn', Y + R * 0.82 + sh * 0.55),
      vls: P3(X(t.u0) + t.cols * 1.35, Y + R * 0.9 + R * 0.14 + 1, 0, 'up', Y + R * 0.9),
      torpedo: P3(X(0.86), Y - 0.5, -1.5, 'dn'),
      reactor: P3(X(0.3), Y, 0, 'dn'),
      engine: P3(X(0.16), Y, 0, 'up'),
    });
    if (c.dds) mm.dds = P3(X(t.u0) + 1.5, Y + R * 0.9 + R * 0.14 + 4, 0, 'dn', Y + R);
  }
  ctx.lights.push([sx - 1.6, sy + 5.2, 0]);
  const zone = (x: number): Zone => {
    const u = (x - x0) / L;
    const ur = c.cls === 'SSN' ? 0.5 : 0.3;
    if (c.tubes && u >= c.tubes.u0 && u <= c.tubes.u0 + (c.tubes.cols * 2.7) / L) return 'missile';
    if (u > 0.84) return 'torp';
    if (Math.abs(u - ur) < 0.05) return 'reactor';
    if (u < ur - 0.05) return 'machinery';
    return 'rooms';
  };
  return {
    g,
    mounts: mm,
    len: L,
    beam: Math.max(c.Dm, sw * 2 + 8),
    HH: sy + 6,
    mid: Y,
    labelAll: true,
    sea: Y + R * 0.5,
    sail: { x0: sx - sl / 2, x1: sx + sl / 2, y0: Y + R * 0.82, y1: sy },
    sub: { Y, R, r: (x: number) => r((x - x0) / L) },
    zone,
  };
}
