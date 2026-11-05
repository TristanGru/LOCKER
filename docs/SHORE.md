# Shore implementation

LOCKER answers the same questions for a naval station as for a ship: which support event is at risk, why, what could improve it, what it costs others, and which records show it. Shore failures feed into the ship forecasts they affect.

**Mock for demonstration.** Only the base names are real. NAVAL STATION NORFOLK (MOCK) and NSA HAMPTON ROADS (MOCK) have invented facilities, work orders, failures, parts, staff and events. Nothing here reports on the actual bases, so present any shown failure as part of the exercise. Public data supplies regional storm, grid and tide figures. Field definitions and sources are in [spec 21](../data_sources/21_shore_installations.md).

## Using it

Open **Shore Overview** in the left navigation. The header selector lists installations on that tab and ships on **Ship Overview**. Each tab remembers the last unit you viewed. Mission Overview, Dominoes, Fixes, What-If and the Readiness Brief all follow the selected unit.

To see a failure reach a ship:

1. Open **Change Feed** and play all five events. The fifth is a Pier 12 transformer failure at Naval Station Norfolk (mock).
2. On **Shore Overview**, Pier 12 shore power shows at risk.
3. On **Ship Overview**, select USS KESSLER and open **Davy's Dominoes**. Mission A's chain continues into the failed pier.
4. Open **Fixes**. Packages for Kessler can include the pier repair, with the cost to NSA Hampton Roads (mock) shown.

The advanced workspace at `/?legacy=1` stays ship-only because its viewer is a DDG.

## How it works

An installation is a unit in the same engine as a ship, with `kind: installation`. It has its own capability tree, work orders, parts, staff and support events, all read through the existing file contract.

```text
Ship event ──requires──> Support event ashore ──requires──> Pier power, crane, fuel, gate, water, staff, training
                                                                     │
                                       Work orders, requisitions ────┤
                                       Public regional hazards ──────┘
```

- **Same run:** A support event is a prerequisite of its ship event, evaluated in the same Monte Carlo run, so a ship's odds can't exceed its support odds.
- **Schedule:** A support window opens `lead_days` before its ship event and ends as it starts. If the ship event moves, the window moves with it. Shifting a support event shifts the ship event.
- **Shared hazards:** Rows sharing a `hazard_id` share random draws, so one storm hits every asset it touches.
- **Missing evidence:** Missing or invalid shore data makes the installation UNKNOWN, and that carries through to the ship events depending on it.
- **Fixes:** A ship's ranking follows its blockers ashore, so one package can combine ship and shore steps. Those packages take longer to rank: about 15 seconds for Kessler after all five events.

## Effect on ship numbers

Adding the shore layer lowered ship odds even before any shore failure, because ship events now depend on support that can itself fail. Probabilities at the scenario baseline, 10,000 runs:

| Event | Without shore | With shore |
|---|---|---|
| Kessler Mission A (interval) | 0.0% | 0.0% |
| Kessler Mission B (interval) | 0.0% | 0.0% |
| Varnell Mission C (interval) | 96.1% | 90.0% |
| Ashby Mission D (interval) | 94.5% | 78.4% |

**Ashby moves from green to yellow.** The largest contributors are the crane refresher's 90% assumed completion chance and the regional and background hazard assumptions. These are model estimates under stated assumptions, not findings. To see them, open a support event's gates or `NSNORFOLK/hazard_model.csv`.

## Limits

- Public rates describe the Norfolk area or a whole utility, not a facility. How they affect a facility is assumed.
- The tide-window multiplier has no public basis.
- Facility file names reuse ship names as a canonical mapping. No real shore system schema was reviewed.
- FEMA National Risk Index and EAGLE-I were not used because their downloads were not automatable.
- The Naval Station Norfolk (mock) piers and runways are traced from public OpenStreetMap data (c) OpenStreetMap contributors, ODbL. The shoreline is approximated, and pier numbers come from OSM names.
- Facilities, buildings, trees, roads and generic ships at other piers are invented and placed for appearance. Hulls are generic silhouettes. Squadron ships appear at their assigned piers when `ship_positions.csv` shows them in port.
- NSA Hampton Roads (mock) still uses a stylized layout.

## Rebuilding the public snapshot

Normal use needs no network. The snapshot is checked in at `data_sources/shore_public/public_hazard_snapshot.json`. To refresh it, regenerate the fixture afterward:

```powershell
pip install --target <dir> pyarrow
$env:PYTHONPATH = "<dir>"
.\.venv\Scripts\python.exe scripts\build_shore_public_data.py --downloads <empty-working-dir>
Remove-Item Env:\PYTHONPATH
.\.venv\Scripts\python.exe -m missiontwin.generate
```

A rebuilt snapshot changes hazard inputs, so forecast numbers and the table above may change.

The 3D outline has its own script, which needs no extra packages. Regenerate the fixture afterward:

```powershell
.\.venv\Scripts\python.exe scripts\build_shore_osm_outline.py --work <empty-working-dir>
.\.venv\Scripts\python.exe -m missiontwin.generate
```
