import type { HullBuilder, HullType } from '../types';
import { buildCG } from './cg';
import { buildCVN } from './cvn';
import { buildDDG } from './ddg';
import { buildFFG } from './ffg';
import { buildLCS } from './lcs';
import { buildLHD } from './lhd';
import { buildSSBN } from './ssbn';
import { buildSSGN } from './ssgn';
import { buildSSN } from './ssn';

export interface HullDef {
  group: 'Surface combatants' | 'Submarines';
  note: string;
  build: HullBuilder;
}

/**
 * Every hull type the 3D view can build. Each builder returns its geometry plus a `mounts` table, so a
 * system's semantic mount (air_radar, reactor, catapult...) lands where that class carries it.
 */
export const HULLS: Record<HullType, HullDef> = {
  DDG: { group: 'Surface combatants', build: buildDDG, note: 'Destroyer: fixed VLS decks fore and aft, one gun, helo deck astern.' },
  CG: { group: 'Surface combatants', build: buildCG, note: 'Cruiser: fore and aft VLS, two 5-inch guns, Harpoon canisters, two funnels.' },
  FFG: { group: 'Surface combatants', build: buildFFG, note: 'Frigate: 32-cell VLS, single 57 mm gun, enclosed mast, helo deck and hangar astern.' },
  LCS: { group: 'Surface combatants', build: buildLCS, note: 'Littoral combat ship: trimaran hull, wide aft flight deck, mission bay, waterjets.' },
  CVN: { group: 'Surface combatants', build: buildCVN, note: 'Carrier: angled flight deck, four catapults, reactors below, radars on the island.' },
  LHD: { group: 'Surface combatants', build: buildLHD, note: 'Amphib: straight flight deck, well deck at the stern, no catapults or VLS.' },
  SSN: { group: 'Submarines', build: buildSSN, note: 'Attack submarine: bow planes, payload tubes forward, sail amidships, pump-jet.' },
  SSBN: { group: 'Submarines', build: buildSSBN, note: 'Ballistic-missile submarine: 24 missile tubes aft of the sail, sail planes.' },
  SSGN: {
    group: 'Submarines',
    build: buildSSGN,
    note: 'Guided-missile submarine: converted hull, 22 cruise-missile tubes, lock-out chambers and dry deck shelter.',
  },
};

export const HULL_ORDER: HullType[] = ['DDG', 'CG', 'FFG', 'LCS', 'CVN', 'LHD', 'SSN', 'SSBN', 'SSGN'];

export const hullDef = (t: HullType): HullDef => HULLS[t] ?? HULLS.DDG;
