# 15 CNO availabilities and maintenance periods (NMD / NMD-R / NDE)

Tags: see `00_README.md` section 1.

## 1. The real source

- **CMAV** (Continuous Maintenance Availability): "notionally a two-week availability, every four months" **[S]** (NAVSEA JFMM training notes). Forward-deployed equivalent: Surface Incremental Availability **[S]**.
- **DSRA** (docking selected restricted availability): ~15-18 months, from SAM.gov notices **[S-SNIP, durations UNV]**. Non-docking SRA typical duration not confirmed **[UNV]**.
- **BAWP** (Baseline Availability Work Package, SURFMEPP) defines each ship's work across the cycle **[S]**.
- **NMD-R** holds "planned milestone dates and avail costs" **[S]**. Original completion date is recorded in **NDE** at availability start **[S]**.
- Publicly attested milestones: **A-120** and **"package lock"** only **[S]**.
- **Overruns are chronic.** 50 of 71 surface ship maintenance periods (~70%) ran long, 2014-2018 **[S]** (GAO-20-86). ~75% late and 33,700 extra days, FY2014-2019 **[S]**. Navy-reported delay days down 62% since 2019 to 2,633, goal ≥71% on time by Sep 2025, outcome unknown **[S-SNIP]**. GAO-25-106990 (Jan 2025): spare parts, too few qualified maintainers and deferred maintenance persist across 149 combat surface ships **[S]**.

## 2. Why MissionTwin uses it

A slipped availability pushes everything after it: light-off, crew cert, Basic Phase certs, and missions. In the 2-4 week horizon, a CMAV extension is the most common schedule domino.

## 3. Mock file

### 3.1 `availabilities.csv` **[PROP]**

Grain: one row per availability per ship (with history as superseding rows).

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `avail_id` | str | `AV-VARNELL-26-02` | | PROP |
| `ship_id` | str | `VARNELL` | | PH |
| `avail_type` | enum | `CMAV` | `CMAV`, `SRA`, `DSRA`, `SIA`, `PMAV` | S (CMAV, DSRA, SIA) / UNV (others) |
| `planned_start` | date | `2026-10-25` | | S concept |
| `planned_completion` | date | `2026-11-08` | original, NDE | S concept |
| `forecast_completion` | date | `2026-11-11` | current estimate | PROP |
| `actual_completion` | date | | | |
| `a120_date` | date | | for CNO avails | S |
| `package_lock_date` | date | | | S |
| `growth_work_items` | int | `14` | | PROP |
| `slip_reason` | str | `Growth work; parts delay` | | PROP |
| `source_msg_dtg` | str | | | PROP |
| `as_of`, `provenance` | | | | |

## 4. Generator rules

- Slip probability for CMAVs: most finish late **[PROP, informed by S overrun rates]**. Extension size from `delay_model_params.yaml`.
- Superseding rows for every forecast change (history preserved).

## 5. Demo scenario rows

- **X6:** Varnell `AV-VARNELL-26-02` CMAV, planned 25 Oct-8 Nov, forecast completion extended to **11 Nov**; Varnell's ASW cert planned start 7 Nov is now invalid (spec 14).
- Kessler: last CMAV completed in September; next not in horizon.

## 6. Sources

NAVSEA JFMM training notes; SAM.gov DSRA notice; NAVSEA SURFMEPP; NAVSEA SNA 2020; LCE case study; GAO-20-86; GAO FY14-19 report; Inside Defense; GAO-25-106990. Links in `reports/MissionTwin additional data sources.md`.
