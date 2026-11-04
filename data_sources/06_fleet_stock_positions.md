# 06 Fleet onboard stock and ship positions (the "borrow from a nearby ship" data)

Tags: see `00_README.md` section 1.

## 1. The real situation

This is where public data is thinnest.
- **No public tool shows other ships' onboard stock** **[S]** (absence noted in research). Likely TYCOM/NAVSUP channels **[UNV]**.
- **Cannibalization is common and rising.** GAO-23-106440: per-ship maintenance cannibalizations rose in **9 of 10 surface ship classes, FY2015-FY2021**, partly from spare-parts shortages **[S]**. ~1 in 2 ships cannibalized in 2011 though the Navy called it a "last resort" **[DATED]**. Navy cannibalization data was understated by up to 50% (aviation, GAO-02-86) **[DATED]**, so any rate is a lower bound.
- **Approval chain unconfirmed.** OPNAV 4440.19E is listed inactive; P-485 and the JFMM were not retrieved **[UNV]**.
- **Two different actions** (keep them separate) **[UNV]** (blog source) / **[PROP]**:
  - **Cross-deck from storeroom stock**: the donor loses a spare; its installed equipment is untouched. Cost = donor's exposure if its own unit fails before resupply.
  - **Cannibalize installed equipment**: the donor's system is degraded, double work (remove + reinstall, per GAO), and may trigger a donor CASREP.
- **Positions.** MOVREP (spec 17) and the schedule (spec 13) say where a ship will be. A fielded tool would get positions from operational message traffic **[UNV]**.

## 2. Why MissionTwin pulls it

- Find donors holding the NIIN.
- Compute the donor's cost: P(donor needs it before its resupply) for cross-deck; direct capability loss for cannibalization.
- Compute transfer time from relative positions and schedules (in company vs in port vs at sea apart).

## 3. Mock files

### 3.1 `fleet_onboard_stock.csv` **[PROP]**

Derived view: one row per NIIN per ship, across the squadron. Generated **from** each ship's `onboard_allowance_cosal.csv` plus installed-equipment entries, so the two never disagree (one source, derived view).

| Column | Type | Example | Tag |
|---|---|---|---|
| `niin` | str | `019990001` | PH |
| `ship_id`, `uic` | | `VARNELL`, `99102` | PH |
| `storeroom_on_hand` | int | `1` | PROP |
| `storeroom_allowance` | int | `1` | PROP |
| `installed_qty` | int | `2` | PROP (two pumps on the system) |
| `installed_system_eic` | str | `SPY1D-CW` | PROP |
| `cross_deck_eligible` | bool | `true` | PROP |
| `cannibalize_eligible` | bool | `true` | PROP |
| `donor_cost_note` | str | `drops below allowance` | PROP |
| `as_of`, `provenance` | | | |

### 3.2 `ship_positions.csv` **[PROP]**

Grain: one row per ship per day across the horizon.

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `ship_id` | str | `VARNELL` | | PH |
| `date` | date | `2026-11-05` | | |
| `status` | enum | `INPORT` | `INPORT`, `UNDERWAY`, `IN_COMPANY` | PROP |
| `port` | str | `NORFOLK VA` | empty if underway | PH (real port names OK) |
| `pier` | str | `PIER 12` | | PH |
| `lat`, `lon` | float | `36.95`, `-76.33` | approximate | PH |
| `in_company_with` | str | `KESSLER` | `;`-list | PROP |
| `next_port`, `next_eta` | | | from MOVREP | PROP |
| `source` | str | `schedule_30day;movrep` | which file it came from | PROP |
| `provenance` | | | | |

### 3.3 Transfer-time rule **[PROP]** (also in `delay_model_params.yaml`)

| Situation | Cross-deck time |
|---|---|
| Same port | 1 day |
| In company at sea | 1-3 days (helo / connected replenishment) |
| Different ports, CONUS | 2-5 days (shipping) |
| Apart at sea | until next common port or replenishment |

## 4. Generator rules

- Derive `fleet_onboard_stock.csv` from the per-ship COSAL files; never hand-edit it.
- Positions come from `schedule_30day.csv` (spec 13), refined by MOVREP lines (spec 17).

## 5. Demo scenario rows

- Varnell, NIIN `019990001`: storeroom on hand 1, allowance 1, installed 2, both cross-deck and cannibalize eligible, `donor_cost_note "drops below allowance"` (**X5**).
- Ashby, NIIN `019990001`: storeroom 0, installed 2 (cannibalization only, which the ranker should score as costly).
- Days 0-8: Kessler and Varnell both `INPORT NORFOLK VA`; cross-deck time = 1 day. Ashby `UNDERWAY` VACAPES until day 5.

## 6. Open questions

- How TYCOMs actually approve cross-decks and cannibalizations, and how long approval takes (no public source).
- Whether any NAVSUP tool exposes other ships' COSAL on hand.

## 7. Sources

GAO-23-106440 (and testimony); Military.com 2011; GAO-02-86; GlobalSpec (OPNAV 4440.19E status); Navy Matters blog (cross-deck vs cannibalize). Links in `reports/MissionTwin additional data sources.md`.
