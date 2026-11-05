# 21. Shore installations: labeled mock bases, public regional hazards

**Purpose.** Lets LOCKER answer the ship question for naval station support: which support event is at risk, why, what could improve it, what it costs others, and which records show it. A shore failure feeds into the ship forecast it affects.

**This is a mock for demonstration.** Only the base names are real. NAVAL STATION NORFOLK (MOCK) and NSA HAMPTON ROADS (MOCK) have invented facilities, work orders, failures, parts, staff and events, and nothing here reports on the actual bases. Public data supplies regional storm, grid and tide figures only. Keep the `(MOCK)` label on every use, and do not map either base to real infrastructure in this package.

## Units

| Unit | Name | UIC | DoDAAC | Role |
|---|---|---|---|---|
| `NSNORFOLK` | NAVAL STATION NORFOLK (MOCK) | `99201` | `N99201` | Homeport; berths Varnell at Pier 10, Ashby at Pier 11, Kessler at Pier 12 |
| `NSAHR` | NSA HAMPTON ROADS (MOCK) | `99202` | `N99202` | Donor of mobile power |

All identities are **[PH]**. Units carry `kind: installation` in `squadron/shore_profile.json`.

## How shore connects to ships

Each ship event has a support event ashore, listed in `prerequisite_events`. The support window opens `lead_days` before the ship event and ends as it starts. Both are evaluated in the same Monte Carlo run, so a pier failure lowers the ship's odds directly. When a ship event moves, its support window moves with it.

## File contract

Installations use the ship file names so one engine evaluates both. **[PROP]** These names are a canonical mapping, not a claim about real shore systems:

| Canonical file | Shore meaning |
|---|---|
| `csmp.csv` | Facility work orders |
| `requisition_status.csv` | Shore supply status (`NOSS (proposed)`) |
| `onboard_allowance_cosal.csv` | Installation storeroom allowance |
| `roster.csv`, `quals.csv`, `watchbill.csv` | Public works staffing, qualifications, duty roster |
| `nec_billets.csv` | Shore billets |
| `sked_schedule.csv`, `sked_loep.csv` | Facility preventive maintenance |
| `insurv_findings.csv` | Facility condition findings |
| `readiness_baseline.csv` | Reported shore readiness. Research notes indicate DRRS covers facilities for shore units; here that appears through `e_score` and `limiting_factor` |
| `training_readiness.csv`, `cert_status.csv` | Crew refresher training and facility certifications |
| `schedule_30day.csv` | Installation calendar, used for transfer windows |
| `availabilities.csv` | Planned facility outages (empty in this exercise) |

Shared files carry shore rows too: `squadron/events_missions.json`, `wholesale_stock.csv` and `fleet_onboard_stock.csv`. Installations have no `casrep_messages/` folder because CASREPs are a shipboard report.

## `hazard_model.csv`

One row per hazard and asset. Rows sharing a `hazard_id` share random draws, so one storm hits every asset it touches.

| Column | Type | Meaning | Tag |
|---|---|---|---|
| `hazard_id` | str | Shared identity for a regional event | PROP |
| `ship_id` | str | Owning installation | PH |
| `eic` | str | Component affected | PROP |
| `hazard_kind` | enum | `RATE` (any day) or `WINDOW` (a known tide window) | PROP |
| `rate_per_day` | float | Daily rate for `RATE` rows | S, regional |
| `window_start` | ts | Window opening for `WINDOW` rows | S |
| `p_trigger` | float | Chance a window causes disruption | PROP |
| `median_down_days` | float | Median disruption length | S, regional |
| `sigma` | float | Lognormal spread | PROP |
| `score` | float | Component score while disrupted | PROP |
| `title` | str | Display label | PROP |
| `derivation` | str | How the number was obtained | PROP |
| `public_source` | str | Public dataset name | S |
| `as_of` | ts | Record time | PROP |
| `provenance` | str | Evidence tag | PROP |

## Public inputs

`scripts/build_shore_public_data.py` writes `data_sources/shore_public/public_hazard_snapshot.json`. Only that script uses the network. The generator copies the snapshot to `squadron/public_hazard_snapshot.json`.

| Dataset | Used for | Limit |
|---|---|---|
| NOAA CO-OPS, Sewells Point 8638610 | Predicted high tides for the scenario, NWS minor flood stage and station datums | Astronomical tide only; surge is not predicted |
| NOAA NCEI Storm Events, 2016-2025 | Coastal flood, wind and rain flood event-days and durations for Norfolk-area records | Regional; effect on a facility is assumed |
| EIA Form 861 via PUDL | Virginia Electric & Power SAIFI and CAIDI, five-year mean with major events | Utility-wide customer average, not a feeder or base |

| OpenStreetMap via Overpass | Pier 1-14 footprints, runways and aprons for the 3D layout, in `norfolk_outline.json` (built by `scripts/build_shore_osm_outline.py`). (c) OpenStreetMap contributors, ODbL | OSM has no coastline way along this waterfront, so the shoreline is approximated through pier roots. Buildings, power and utility features are deliberately not requested |
| OpenStreetMap via Overpass | NSA Hampton Roads site boundary (the Lafayette River Annex landuse polygon), in `nsahr_outline.json` (built by `scripts/build_shore_nsahr_outline.py`), in its own local frame. (c) OpenStreetMap contributors, ODbL | Boundary only; the two NSA Hampton Roads facility positions inside it are invented |
| USDA NAIP via USGS The National Map | Aerial photo under each 3D layout, `web/public/shore/<site>_naip.jpg` (built by `scripts/build_shore_imagery.py --site norfolk` or `--site nsahr`). Public domain | Ground texture only; nothing in the mock is read from the photo |

**Reviewed, not used:**

| Dataset | Reason |
|---|---|
| FEMA National Risk Index | Automated download returned HTTP 403 |
| EAGLE-I county outages | Globus transfer only |
| MIRTA, FRPP | Not needed for a mock; base records here are invented |
| HIFLD Open grid layers | Portal offline since August 2025; linking a real base to specific substations would map a real vulnerability |

## Assumptions

- A coastal flood takes a pier's utility vault out of service. **[PROP]**
- High wind locks out the crane. Rain flooding closes the primary road, leaving base access degraded but usable. **[PROP]**
- A utility interruption degrades a pier feed without failing it, because backup generation is assumed. **[PROP]**
- A spring tide within 1.4 ft of minor flood stage triggers at the regional coastal flood rate x 3. The multiplier is **[PROP]** and has no public basis.

## Seeded scenario and inconsistencies

- **Starting conditions** (open before the feed starts; values are fixed, not drawn):
  - Naval Station Norfolk (mock) `99201SP110004`: Pier 11 transformer bank protective relay failed its trip test. Replacement NIIN 019998006 is `BB`, ESD 09 NOV. Ashby's IRON HORIZON support window is 20-22 NOV.
  - NSA Hampton Roads (mock) `99202MS010002`: the mobile substation trailer's brake controller failed road inspection, so the trailer cannot be towed to a site. Replacement NIIN 019998007 is `BB`, ESD 07 NOV. Standby E starts 16 NOV. The transformer itself still works, so it can still be cannibalized for a pier.
- **E5, 08 NOV:** Pier 12 transformer fails at Naval Station Norfolk (mock). Replacement status `BC`, ESD 15 DEC. Kessler's support window is 11-13 NOV.
- **X5:** Borrowing the transformer drops NSA Hampton Roads (mock) below its allowance.
- **X7:** A crane hoist PM was lost and no work order exists.
- **X11 (new):** Kessler's LOGREQ requests shore power from the failed pier.
- **Fixes the data supports:** borrow from the NSA Hampton Roads (mock) storeroom, cannibalize its mobile substation, pull a reserve unit needing engineering validation, or shift the ship event.
