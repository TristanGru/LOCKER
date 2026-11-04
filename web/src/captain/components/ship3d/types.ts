import type * as THREE from 'three';
import type { HullType, Status } from '../../api/types';
import type { Mats } from './materials';

export type { HullType };

/** Label side for a pin: above ('up') or below ('dn') the pin on screen. */
export type Side = 'up' | 'dn';

/** Where a semantic mount sits on one hull: pin position, label side, and the deck height its stem starts from. */
export interface Mount {
  p: THREE.Vector3;
  side: Side;
  base: number;
}

/** Hull loft config: a width function lofted along x (+x = bow). */
export interface HullLoft {
  x0: number;
  x1: number;
  bowX: number;
  HH: number;
  hw: (x: number) => number;
  zOff?: number;
  flare?: number;
}

export interface House {
  x0: number;
  x1: number;
  w: number;
  y0: number;
  h: number;
}

/** Coarse compartment zone along the hull, used by the cut section and walk-in interiors. */
export type Zone = 'machinery' | 'vls' | 'rooms' | 'reactor' | 'well' | 'missile' | 'torp';

/** What a hull builder returns. */
export interface HullBuild {
  g: THREE.Group;
  mounts: Record<string, Mount>;
  len: number;
  beam: number;
  HH: number;
  mid: number;
  deckY?: number;
  vlsX?: number[];
  houses?: House[];
  flat?: boolean;
  hangar?: boolean;
  deckPoly?: [number, number][];
  zone?: (x: number) => Zone;
  sub?: { Y: number; R: number; r: (x: number) => number };
  sail?: { x0: number; x1: number; y0: number; y1: number };
  sea?: number;
  /** Submarines label every pin, surface ships only deck pins. */
  labelAll?: boolean;
}

/** A built hull plus what the scene derives from it. */
export interface HullInfo extends HullBuild {
  type: HullType;
  hc: HullLoft | null;
  lights: [number, number, number][];
  bb: THREE.Box3;
}

/** Shared state while one hull is being built. */
export interface BuildCtx {
  M: Mats;
  /** First lofted hull (used for decals, sea foam and the cut section). */
  hc: HullLoft | null;
  lights: [number, number, number][];
}

export type HullBuilder = (ctx: BuildCtx) => HullBuild;

export type ViewKind = 'sky' | 'iso' | 'side' | 'cut';
export type CutMode = 'x' | 'z';

/** A system that resolved to a pin on the current hull. */
export interface PinInfo {
  id: string;
  name: string;
  mount: string;
  deck: 'top' | 'below';
  st: Status;
  dom: boolean;
  p: THREE.Vector3;
}
