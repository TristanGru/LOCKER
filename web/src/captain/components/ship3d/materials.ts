import * as THREE from 'three';

const mat = (name: string, color: number, o: THREE.MeshStandardMaterialParameters = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.12, ...o });
  m.name = name;
  return m;
};

/** Exterior materials for one scene. Named so GLB/OBJ exports stay readable. */
export function createMaterials() {
  const ds = { side: THREE.DoubleSide };
  const M = {
    hullUp: mat('hull_grey', 0x7d8b98, ds),
    boot: mat('boot_stripe', 0x161b21, ds),
    hullLow: mat('antifouling_red', 0x7a2f2f, ds),
    deck: mat('deck_nonskid', 0x56616b),
    house: mat('superstructure', 0x93a0ac),
    dark: mat('dark_gear', 0x1f2832),
    light: mat('light_grey', 0xc2cad1),
    glass: mat('bridge_glass', 0x0b1822, { roughness: 0.2, metalness: 0.3 }),
    vls: mat('vls_hatch', 0x2a3441),
    radar: mat('radar_array', 0x22d3ee, { emissive: 0x0a5560, emissiveIntensity: 0.7 }),
    helo: mat('deck_marking', 0xe9b52e, { emissive: 0x4a3600, emissiveIntensity: 0.5 }),
    white: mat('white_marking', 0xe8edf1),
    orange: mat('rhib_tube', 0xd98a2b),
    heli: mat('aircraft', 0x4a545e),
    brass: mat('prop_bronze', 0xb08a45),
    elev: mat('elevator', 0x2c3a48),
    sub: mat('pressure_hull', 0x5f6b77, { side: THREE.DoubleSide, roughness: 0.9 }),
    subSail: mat('sail_fairwater', 0x7b8793, { side: THREE.DoubleSide, roughness: 0.85 }),
    fitting: mat('deck_fitting', 0x6a7783),
  };
  return M;
}

export type Mats = ReturnType<typeof createMaterials>;

/** X-ray: make the hull shell see-through so below-deck pins show. Cloned (cut) materials follow their source. */
export function setXray(M: Mats, on: boolean, clones: [THREE.Material, THREE.Material][] = []) {
  for (const m of [M.hullUp, M.boot, M.hullLow]) {
    m.transparent = on;
    m.opacity = on ? 0.5 : 1;
    m.depthWrite = !on;
    m.needsUpdate = true;
  }
  for (const m of [M.sub, M.subSail]) {
    m.transparent = on;
    m.opacity = on ? 0.72 : 1;
    m.depthWrite = !on;
    m.needsUpdate = true;
  }
  for (const [o, c] of clones) {
    c.transparent = o.transparent;
    c.opacity = o.opacity;
    c.depthWrite = o.depthWrite;
    c.needsUpdate = true;
  }
}

export function disposeMaterials(M: Mats) {
  Object.values(M).forEach((m) => m.dispose());
}
