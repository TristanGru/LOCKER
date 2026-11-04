# 01 SKED: Planned Maintenance System scheduling

Tags: see `00_README.md` section 1.

## 1. The real system

- **What it is.** SKED is NAVSEA's scheduler for the Ships' 3-M Planned Maintenance System (PMS). Developed by Antech Systems. It "views and prints maintenance procedures, automates PMS schedule creation and tracks accomplished maintenance" **[S]** ([Antech](https://www.antechsystems.com/services/maintenance-management/sked/)).
- **Version.** SKED 3.2 is the latest public version (upgrade from 3.1). No later version found **[S]**.
- **Governing manual.** NAVSEAINST 4790.8D (3-M Manual, 17 Jun 2021), Appendix G reportedly covers SKED 3.2 **[S-SNIP]**. OPNAV policy appears to have moved from 4790.4F to 4790.4G **[S-SNIP]**.
- **Users.**
  - 3-M Coordinator (3MC): creates user PINs, bulk-transfers users during crew swaps **[S]**.
  - Sailors in work centers: mark checks "complete" or "lost" with their PIN **[S]**.
  - Leadership: color-coded Accomplishment Rating dashboard by department, division and work center **[S]**.
  - Work center supervisor / division officer chain: standard 3-M practice **[UNV]**.
- **Status, Nov 2026.** In use. Antech says SKED, the PMS MIS and 3-M MDS are being merged into one application that builds configuration-specific schedules ashore; no date **[S]**. The OMMS-NG to SKED interface lost funding (GAO-24-106525) **[S-SNIP]**.

## 2. Why MissionTwin pulls it

| Use | How |
|---|---|
| Material-condition signal | Lost (not accomplished) PMS on a system raises the probability of a future failure or 2-Kilo. Modeled as a **correlation**, not a feed, because the SKED to OMMS-NG interface is unfunded. |
| Maintenance load | Hours of PMS due in the horizon compete with corrective work for the same qualified technicians. |
| Inactive equipment | Equipment in an Inactive Equipment Maintenance (IEM) period is not mission-available. |
| Trust signal | Accomplishment rate per work center is a "how reliable is this work center's reporting" prior. |

**Not used for deferred maintenance.** A 3-M Manual excerpt says PMS can no longer be deferred in SKED 3.2; unperformed checks count as lost **[S-SNIP]**. Deferred work comes from `csmp.csv` (spec 02).

## 3. How we believe the data is structured

SKED follows a published document hierarchy **[S]** ([tpub FC vol 1](https://www.tpub.com/fcv1/8.htm)):

| Document | Form | Contents |
|---|---|---|
| LOEP (List of Effective Pages, PMS 5 report) | report | Report date, force revision number, TYCOM, hull, UIC, work center, MIP numbers, equipment description **[S]** |
| MIP (Maintenance Index Page) | OPNAV 4790/85 | Per equipment: list of MRCs, periodicity codes, man-hours, minimum skill level **[S]** |
| MRC (Maintenance Requirement Card) | card | Who (rate), what, when, how, with what resources **[S]** |
| EGL (Equipment Guide List) | OPNAV 4790/81 | Locations of identical equipment covered by one MRC **[S]** |
| TGL (Tag Guide List) | OPNAV 4790/107 | Situational/tag-driven checks **[S]** |
| Quarterly schedule | OPNAV 4790/14 | Requirements broken into weeks of the quarter **[S]** |
| Weekly schedule | OPNAV 4790/15 | Week's checks with assigned person **[S]** |
| Feedback report | OPNAV 4790/7B | Fleet feedback on MRC problems **[S]** |

SKED 3.2 features **[S]**: equipment-based schedules, "true interval scheduling", situational and metered triggers, IEM periods, scheduled spot checks with scores, fleet-wide feedback reports, forecast view.

**Force Revisions** issue four times a year and change thousands of documents **[S]**.

**Periodicity codes.** Example "M-1R: Monthly or every 600 hours, whichever comes first" supports the pattern `<periodicity>-<sequence><R?>`, with R meaning calendar plus situational **[S]** (aviation TGL). Full table **[UNV]**: `D` daily, `W` weekly, `2W` biweekly, `M` monthly, `Q` quarterly, `S` semiannual, `A` annual, `18M`-`36M` multi-year, `C` cycle, `R` situational, `U` unscheduled.

**Exports.** Only printed schedules/MRCs and an "upline report" that sends "a virtual look of its SKED database to an external requesting authority" are sourced **[S]**. No database engine, file type or field names are public. A fielded MissionTwin would consume SKED data via a Jupiter data product or the merged PMS application, not a direct SKED export **[PROP]**.

**Known data-quality issue.** GAO found MRCs "sometimes inaccurate with respect to the time and personnel needed" **[S]** (GAO-24-106525). Treat MRC man-hours as noisy.

## 4. Mock files

### 4.1 `sked_schedule.csv` **[PROP]**

Grain: one row per scheduled MRC instance per week per ship. Horizon: 6 weeks back (history for lost-PMS signal) to 5 weeks forward.

| Column | Type | Example | Allowed values / rule | Tag |
|---|---|---|---|---|
| `ship_id` | str | `KESSLER` | squadron ids | PROP |
| `uic` | str(5) | `99101` | | S fmt / PH |
| `hull` | str | `DDG-991` | | PH |
| `tycom` | str | `CNSL` | | UNV |
| `force_rev` | str | `1-27` | `<quarter>-<yy>` | UNV |
| `work_center` | str(4) | `CF01` | see 4.3 | S len / UNV codes |
| `mip` | str | `4411/001-B6` | | UNV shape |
| `equipment_desc` | str | `AN/SPY-1D(V) RADAR COOLING SYSTEM` | | PH |
| `eic` | str | `SPY1D-CW` | join to mission tree system | PROP (real EIC format UNV) |
| `egl_location` | str | `01-120-0-E` | compartment-style | UNV |
| `mrc` | str | `M-1R` | `<periodicity>-<n><R?>` | S pattern |
| `periodicity` | str | `M` | code table above | UNV |
| `man_hours` | float | `1.5` | 0.1-24 | S field / PH value |
| `rate` | str | `FC2` | rate + paygrade | S field |
| `min_skill_level` | str | `FC3` | | S field |
| `sched_week_start` | date | `2026-11-02` | Monday | PROP |
| `assigned_to` | str | `M-0007` | member_id from roster | S field (weekly sched names person) |
| `status` | enum | `COMPLETE` | `SCHEDULED`, `COMPLETE`, `LOST`, `IEM` | S (complete/lost); PROP (others) |
| `status_date` | date | `2026-10-29` | empty if SCHEDULED | PROP |
| `recorded_by_pin` | str | `PIN-0007` | synthetic | PROP |
| `spot_check_score` | int | `88` | 0-100, mostly empty | S field / PROP scale |
| `iem_flag` | bool | `false` | | S concept |
| `situational_trigger` | str | `UNDERWAY` | for R-coded checks | S concept / PROP values |
| `notes` | str | | free text | PROP |
| `as_of` | datetime | `2026-11-04T06:00:00Z` | extract time | PROP |
| `provenance` | str | `proposed` | | |

### 4.2 `sked_loep.csv` **[PROP]** (reference, optional)

`ship_id, uic, hull, tycom, force_rev, report_date, work_center, mip, equipment_desc, eic, provenance`. One row per MIP per work center. Mirrors the sourced LOEP fields.

### 4.3 Work centers used **[UNV]** code style, **[PH]** assignments

| WC | Meaning (ours) | Owns |
|---|---|---|
| `CF01` | Combat systems, fire control (Aegis radar) | SPY-1D, cooling |
| `CF02` | Combat systems, weapons control | CIWS, SM launch |
| `CE01` | Combat systems electronics | Comms, ethernet/LAN |
| `EA01` | Engineering, auxiliaries | Chilled water, pumps (non-radar) |
| `EE01` | Engineering, electrical | Power distribution |
| `ER01` | Engineering, main propulsion | GTMs, MRG |
| `OD01` | Operations, navigation | Nav radars |

## 5. Generator rules

- Most rows are `D`, `W` or `M` periodicity; `Q`, `S`, `A` cluster in specific weeks **[S-SNIP]**.
- `R` checks fire when the schedule (spec 13) has an underway event that week.
- Accomplishment rate per work center: draw 0.85-0.98 **[PROP]**; `LOST` rows are the remainder.
- `assigned_to` must be a member in that work center with rate at or above `min_skill_level`.
- Weekly man-hours per work center should not exceed ~40% of the work center's available hours (realism) **[PROP]**.

## 6. Demo scenario rows

- Kessler `CF01`, SPY-1D cooling MRC `M-1R`, week of 2026-10-26: `LOST` (precursor signal to the day-0 pump CASREP).
- **X7:** Kessler `CF02`, CIWS MRC `Q-2`, week of 2026-10-19: `LOST`, with **no** matching 2-Kilo in `csmp.csv`.
- Varnell: accomplishment ~0.96, no lost checks on SPY cooling.

## 7. Open questions

- Full periodicity table, MIP and MRC numbering format: verify in NAVSEAINST 4790.8D Appendix G.
- Confirm the SKED 3.2 no-deferral rule.
- Accomplishment-rate formula (assumed `complete / scheduled`) **[UNV]**.

## 8. Sources

Antech SKED and SKED 3.2 pages; NAVSEA NUWC Keyport NSLC page; NAVSEAINST 4790.8D; CNRFCINST 4790.1B; tpub FC vol 1; navyaviation tpub TGL; GAO-24-106525. Full links in `reports/Navy SKED OMMS NG and RADM.md`.
