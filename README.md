# Handoff: LOCKER Ship Overview · 3D Ship Model + Cut-away

## Overview
Two deliverables for the LOCKER app (React + Vite + TS + Tailwind):

1. **Mission Overview redesign** (`Mission Overview.dc.html`): analysis of the current screen (artboard 1A) and a proposed layout (artboard 2B).
2. **Ship Overview 3D** (`Ship 3D.html`): a 3D version of the "Ship profile · sky view" panel. It builds a model for the ship's hull type, places the system status pins on it, lets the user cut the ship open (across or lengthwise) at a pin or anywhere on the hull, and lets them step inside the compartment.

## About the Design Files
The files in this bundle are **design references created in HTML**. They are prototypes that show the intended look and behavior, not production code to copy. Recreate them in the LOCKER codebase (`/src`, React 18 + TypeScript + Tailwind) using its existing patterns: `api.ts` as the only data entry point, `useApi`, the `STATUS` theme in `src/theme/status.ts`, and the `Panel`, `StatusBadge` and `RecordId` components.

## Fidelity
**High fidelity** for colors, type, status semantics and interaction. The 3D geometry is **procedural and approximate**. It should be treated as a working spec for structure and behavior, not final art. If real ship models (GLB) become available, load those and keep the `mount` contract below.

## Where it goes in the app
Replace `<ShipProfile>` inside `Panel title="Ship profile · sky view"` in `src/screens/ShipOverview.tsx` with a new `<ShipModel3D>`, keeping the existing sky-view SVG as a fallback (no WebGL / print). Suggested files:

```
src/components/ship3d/
  ShipModel3D.tsx        // mounts canvas, owns view/cut/inside state
  hulls/ddg.ts cvn.ts lhd.ts cg.ts ffg.ts lcs.ts ssn.ts ssbn.ts ssgn.ts   // each returns { group, mounts, info }
  loft.ts                // hull loft from a width function
  cutaway.ts             // clipping planes, section cap builder, split animation
  interiors/*.ts         // walk-in compartment builders
  pins.ts                // pin + label projection, collision nudging
```
Use three.js `0.184` (or react-three-fiber with the same primitives). Dependencies: `three`, OrbitControls. No other libraries.

## Data contract change (important)
Today `ship.json` systems carry fixed `pinX/pinY/labelSide`, which only fit one hull. Replace them with a **semantic `mount`** and add a hull type to the ship record:

```ts
interface ShipPayload { hullType: 'CVN'|'DDG'|'CG'|'FFG'|'LCS'|'LHD'|'SSN'|'SSBN'|'SSGN'; ... }
interface ShipSystem  { id; name; status; isNextDomino; mount: string; deck: 'top'|'below'; ... }
```
- `hullType` can be parsed from the existing hull string (`/^([A-Z]{2,4})-/` on e.g. "DDG-1047").
- Each hull builder exposes `mounts: Record<mount, {p: Vector3, side:'up'|'dn', base: number}>`. A system whose mount does not exist on the hull is listed as "No mount on this hull" and gets no pin.
- Mount keys used in the prototype: `flight, vls_fwd, vls_aft, gun, gun_aft, air_radar, sat, ciws, ram, harpoon, nsm, mission_bay, waterjet, catapult, arrest, elev, magazine, well, reactor, engine_p, engine_s, engine, genset_1, genset_2, chill, sonar, sonar_bow, towed_array, torpedo, planes, dds, control, photonics, propulsor`.
- Status colors come from the app theme: ready `#34d399`, watch `#fbbf24`, risk `#fb4d5d`. Status must also show as text in the label ("Ready / Watch / At risk"), never color alone.

## Screens / Views

### A. Ship 3D view (main)
- **Layout**: full-height stage (flex:1) plus a right side panel 360 px wide (`#060b14`, 1px border `rgba(140,180,220,.14)`, padding 20, gap 14). Header 12×24 padding with the LOCKER mark.
- **Stage background**: `radial-gradient(ellipse at 50% 38%, #14354f 0%, #09131f 52%, #04080f 100%)`.
- **Side panel blocks** (label style: Inter 600 12px, uppercase, letter-spacing .14em, `#9fb0c6`): Hull type (grouped buttons: Surface combatants / Submarines), View (Sky view, Isometric, Side), Hull (X-ray, Sea), Cut direction (Across, Lengthwise), Cut-section key (6 color chips), Pins (one row per system: dot, name, status text; clickable).
- **Buttons**: Inter 600 14px, padding 9×14, radius 10, 1px border `rgba(140,180,220,.26)`, text `#9fb0c6`. Active: text `#22d3ee`, border `rgba(34,211,238,.6)`, bg `rgba(34,211,238,.12)`.
- **Pin labels**: HTML overlay, bg `rgba(6,11,20,.92)`, 1px border in status color, radius 8, padding 3×9, Inter 600 13px; second line status in 11.5px/700. Next-domino pin adds a red "NEXT DOMINO" caption (letter-spacing .12em) and glow `0 0 22px -6px rgba(251,77,93,.9)`. A 1.5px leader line joins label to pin. Labels follow a fixed side per mount (`up`/`dn`), are nudged to avoid overlap (try up/down steps, then sideways), and are clamped to the stage.
- **Scene**: ACES tone mapping (exposure 1.18), key + cool rim (`#7fd8ff`) + warm fill (`#ffe2b8`) lights, fog, translucent textured sea with foam outline and wake, hull number decals, masthead lights, rail posts, deck fittings.

### B. Cut-away
- **Entry**: click a pin, its label, or its row in the Pins list to cut at that system. Click the bare hull to cut anywhere. Hovering the hull shows a cyan guide plane (opacity .22). Click on empty space or Esc closes.
- **Across** cuts at x (plane normal ±x); **Lengthwise** cuts at z (normal ±z). Each half is a clone with its own clipped materials. Halves slide apart by `max(12, 0.22·length)` across or `max(10, 0.6·beam)` lengthwise, with an ease of 12% per frame.
- **Cut face (section cap)**: hull wall ring `#6b7884`, dark interior `#070d15`, deck lines `#a4b0bb`, compartments colored by zone (machinery `#8a6424`, ops `#216f82`, berthing `#3b4d6a`, stores `#535f6c`, tanks `#206661`, weapons `#6b2f2f`, reactor `#1d5f73`, hangar `#2a3748`). The selected system gets its own room with an equipment drawing (turbine, reactor, VLS cells, ammo drum, radar racks, sonar ring, etc.) and a ring in its status color.
- **Camera**: switches to face the cut (Across: direction `(±.8,.22,.4)`; Lengthwise: `(.1,.12,±1)`), hides the half in front, and "Flip" swaps faces.
- **Cut panel** (top-right, 250 px): title row, then buttons Step inside / Flip / Close (5×10 padding, 12px), then `● Status  System name` and a 13px detail line: compartment, description, position ("104 m from stern" or "x m off centerline").

### C. Step inside (walk-in)
- Button in the cut panel. Builds a lit 3D compartment appropriate to the system or zone (engine room, equipment/radar room, combat information center, missile magazine, gun magazine, reactor compartment, hangar/mission bay, sonar/towed array, torpedo room, catapult/arresting gear/elevator/well deck, berthing).
- Controls: drag to look (OrbitControls with the camera/target swapped and inverted rotate speed), W A S D / arrows to walk (3.2 m/s, Shift 6.5), simple AABB collision and room bounds, eye height 1.65 m, FOV 72.
- Outdoor lights are dimmed while inside; Esc or "Leave" restores the cut view.

## Hull types (dimensions in meters, +x = bow)
| Type | Length | Beam | Notes |
|---|---|---|---|
| DDG | ~140 | 27 | Sky-view SVG outline lofted; VLS fore/aft, 5-inch gun, helo deck + hangar |
| CG | 173 | 16.8 | Two guns, two VLS, Harpoon, two funnels |
| FFG | 151 | 19.8 | 32-cell VLS, 57 mm gun, enclosed mast |
| LCS | 127 | 31 | Trimaran, aft flight deck, mission bay, waterjets |
| CVN | 337 | 80 | Angled deck, 4 catapults, 4 elevators, island, parked aircraft |
| LHD | 257 | 34 | Straight deck, well deck, island |
| SSN | 115 | 10.3 | Sail, bow planes, payload tubes, pump-jet |
| SSBN | 170 | 12.8 | 24 missile hatches, sail planes |
| SSGN | 170 | 12.8 | 22 tubes, lock-out hatches, dry deck shelter |

Dimensions are approximate and for the demo only.

## State Management
- `hullType`, `view` (`sky|iso|side|cut`), `xray`, `sea`, `cutMode` (`x|z`), `cut` (`{ position, focusSystemId?, gap, current }`), `cutFace` (±1), `inside` (compartment state or null).
- Selecting a system (pin, label or list row) = `cutAtSystem(id)`. Changing `cutMode` while cut re-opens at the same system or position.
- Camera auto-fit re-runs on resize until the user first orbits.
- Data: `api.getShip()` through `useApi`; re-fetch on the existing store version bump so statuses update live.

## Performance and compatibility
- Cloned materials per half need `renderer.localClippingEnabled = true`. Cap geometry is rebuilt per cut.
- Provide a WebGL-unavailable fallback (existing SVG `ShipProfile`).
- Exporting OBJ/GLB (prototype toolbar) only works with the whole ship visible; omit or disable while cut.

## Design Tokens
- Surfaces: `#03060c` page, `#060b14` header/panels, `#0b1524` cards, `#111e33` raised. Lines `rgba(140,180,220,.14)` / `.26`.
- Text: `#e6eef8`, muted `#9fb0c6`, dim `#6b7d95`. Accent `#22d3ee`.
- Status: ready `#34d399`, watch `#fbbf24`, risk `#fb4d5d`, stale `#94a3b8`.
- Type: Inter 400/600/700/800; JetBrains Mono 500/700 for numbers and IDs. Base 17px (18px ≥1800px) for projector use.
- Radius: 8 (labels), 10 (buttons), 12–16 (cards, panels).
- Min contrast: body text ≥ 4.5:1; raise the old `#6b7d95` small caps to `#9fb0c6` for text under 14 px.

## Mission Overview redesign (separate file)
See `Mission Overview.dc.html`. Artboard **1A** is the current screen recreated from source; **2B** is the proposed version. Findings and changes:
1. Lead with the answer in the page title ("TIDEWATCH needs action: 41% odds, 11 days out. Fix the TR Module first.").
2. Replace the three equal cards with ranked rows: status, odds with a linear 50/82% threshold bar, trend, next domino, one primary action. The at-risk row gets more space.
3. One slim freshness chip in the header instead of header chip + banner + badges.
4. STOP becomes an outlined neutral button so red only means mission risk.
5. Remove decorative grid, glows and nav hints; raise small-text contrast.

## Assets
No external images. All geometry and textures (deck plating, bulkheads, sea, hull numbers, signs) are generated in code. Status/mission icons in the Mission Overview file are inline SVG paths in Lucide style and should be replaced by the codebase's `lucide-react` icons. The LOCKER mark is copied from `src/components/layout/Logo.tsx`.

## Known gaps
- Statuses, system lists for non-DDG hulls, SEASHIELD/DEEP LANTERN values and feed counts are **sample data**.
- No cut section for LCS outrigger hulls.
- Interiors are stylized, not photoreal; equipment drawings on the cut face are schematic.
- Only the Mission Overview screen and the 3D ship view were designed; other screens are untouched.

## Files
- `Ship 3D.html`: the 3D prototype (all hull builders, cut-away, interiors; search for the section comments `hull loft`, `generic surface combatant`, `submarines`, `cut-away`, `walk-in interiors`).
- `three-d-stage.js`: the viewer shell the prototype uses (lights, orbit controls, ground shadow, OBJ/GLB export toolbar). In the app, replace with your own scene setup.
- `Mission Overview.dc.html`: analysis + redesign artboards.
