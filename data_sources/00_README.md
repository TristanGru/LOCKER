# MissionTwin data sources: master index and mock-data contract

**Purpose.** This folder is the single source of truth for MissionTwin's mock data. Each numbered file describes one real Navy data source: what the real system is, how we believe its data is structured, what MissionTwin pulls from it, and the exact synthetic file(s) we generate to stand in for it. Generators, parsers and tests must follow these specs. If a spec and the code disagree, fix one of them on purpose; never let them drift.

**Basis.** Built from two research reports in this repo:
- `reports/Navy SKED OMMS NG and RADM.md`
- `reports/MissionTwin additional data sources.md`

Underlying notes are in `research_notes/`. All sources are unclassified and public. No official field-level schema is public for any of these systems, so **every file layout here is our proposal**, anchored on the real identifiers, forms and code vocabularies we could source.

---

## 1. Evidence tags (used in every spec)

Every fact, column and code value carries one of these tags. Generators should copy the tag into the file's `provenance` column for coded fields.

| Tag | Meaning |
|---|---|
| **[S]** | Sourced: read in a primary or reputable public source |
| **[S-SNIP]** | Sourced only from a search-result excerpt; the primary document blocked retrieval |
| **[DATED]** | Sourced, but from material older than about 2022 (often 1990s training manuals) |
| **[UNV]** | Unverified: general Navy knowledge, not confirmed by a source in our research |
| **[PROP]** | Proposed by us: a layout, legend or rule designed for the hackathon |
| **[PH]** | Placeholder value: deliberately fake (hull numbers, UICs, NIINs, names) |

`provenance` column values in mock files: `sourced`, `proposed`, `placeholder`.

---

## 2. Global conventions (apply to every mock file)

1. **Banner.** Every file starts with `SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA`. In CSV, use a first comment line `# SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA`; in JSON, a top-level `"_banner"` key; in text messages, the classification line `UNCLAS//SYNTHETIC EXERCISE//`; in PDFs, a header and footer on every page.
2. **No real people, no PII.** Synthetic `member_id` only (`M-0001` style). Never an SSN, never a real name. Names in daily reports are invented (`LT Brandt`, `FC1 Ramos`).
3. **No real ships.** Fictional hulls in the DDG-99x range, which no real ship uses. **[PH]**
4. **Time.** All timestamps are **Zulu (UTC)**, matching Navy message practice (DTGs are Zulu). ISO 8601 in CSV/JSON (`2026-11-04T08:00:00Z`); DTG form (`041200Z NOV 26`) inside message text. *(The engineering review's pending item C3 will confirm this rule.)*
5. **Scenario clock.** "Scenario now" = `2026-11-04T08:00:00Z` (day 0). Horizon = day 0 to last mission date + 3 days.
6. **Encoding.** UTF-8, comma-separated, header row after the banner line, dates ISO 8601, booleans `true/false`, empty string for null.
7. **Read-only.** MissionTwin never writes to these files. Generated files live in `data/synthetic/<ship_id>/` and `data/synthetic/squadron/`.

---

## 3. The synthetic squadron (shared across all files)

| ship_id | Name | Hull | UIC | DoDAAC | Role in demo | Data depth |
|---|---|---|---|---|---|---|
| `KESSLER` | USS Kessler | DDG-991 | `99101` | `R99101` | Primary ship; full demo scenario | Full |
| `VARNELL` | USS Varnell | DDG-992 | `99102` | `R99102` | Donor; holds the spare cooling pump | Full |
| `ASHBY` | USS Ashby | DDG-993 | `99103` | `R99103` | Third ship for the squadron view | Light |

All UICs, hulls and DoDAACs are **[PH]**. The UIC is 5 characters **[S]**. The DoDAAC form "R + UIC" for afloat units is **[UNV]**.

Squadron: `DESRON 99` (fictional), TYCOM `CNSL` (code style **[UNV]**).

---

## 4. Shared identifier formats

| Identifier | Format | Example | Tag | Defined in |
|---|---|---|---|---|
| UIC | 5 chars | `99101` | [S] format, [PH] value | this file |
| Work center | 4 alphanumeric | `CF01` | [S] length, [UNV] code style | 01, 02 |
| JCN | UIC(5) + WC(4) + JSN(4) = 13 chars | `99101CF010042` | [S] | 02 |
| CASREP DTG | `DDHHMMZ MON YY` | `041200Z NOV 26` | [UNV] exact form, [S] DTG used as key | 03 |
| CASREP serial | 3-digit per-unit serial, 001-999 | `017` | [DATED] | 03 |
| `casrep_id` (our key) | `<hull>-<yy>-<serial>` | `DDG991-26-017` | [PROP] | 03 |
| NSN | FSC(4)-NIIN(9) | `4320-01-999-0001` | [S] structure, [PH] value | 04 |
| NIIN | 9 digits; we use `01999xxxx` to mark fakes | `019990001` | [PH] | 04 |
| MILSTRIP document number | DoDAAC(6) + Julian date YDDD(4) + serial(4) = 14 | `R991016308A001` | [UNV] | 04 |
| Supply status code | 2 chars, AP7.16 vocab | `BB` | [S-SNIP] | 04 |
| Priority designator | `01`-`15` | `02` | [DATED] | 04 |
| member_id | `M-` + 4 digits | `M-0007` | [PROP] | 07 |
| NEC | 4 alphanumeric | `F9A1` | [S] format, [PH] value | 08 |
| PQS watchstation | 4-digit line number | `2200` Lookout | [S] | 07 |
| Mission area | ROC/POE abbreviation | `AW`, `ASW`, `SUW` | [S] | 10 |
| event_id / mission_id | `EVT-<ship>-<nn>` | `EVT-KESSLER-01` | [PROP] | 14 |
| avail_id | `AV-<ship>-<yy>-<nn>` | `AV-KESSLER-26-03` | [PROP] | 15 |

Julian date note: 4 Nov 2026 = day 308, so YDDD = `6308`.

---

## 5. Source catalog (one spec per row)

| # | Spec file | Real source | Mock file(s) | Feeds MissionTwin's |
|---|---|---|---|---|
| 01 | `01_sked_pms.md` | SKED 3.2 (Planned Maintenance System) | `sked_schedule.csv`, `sked_loep.csv` | Lost-PMS risk signal, maintenance load |
| 02 | `02_omms_ng_csmp.md` | OMMS-NG / AWN (2-Kilo, CSMP) | `csmp.csv` | Deferred work, CASREP-to-job-to-part join |
| 03 | `03_casrep.md` | CASREP messages (NTTP 1-03.1) | `casrep_messages/*.txt`, `casreps.json` | Primary event stream, ETRs, categories |
| 04 | `04_r_supply_milstrip.md` | R-Supply / NOSS + MILSTRIP status | `requisition_status.csv`, `onboard_allowance_cosal.csv`, `status_code_reference.csv` | Part arrival forecast |
| 05 | `05_navsup_wholesale.md` | NAVSUP WSS / DLA / OTS / program office | `wholesale_stock.csv` | "Expedite" and "pull from wholesale" fixes |
| 06 | `06_fleet_stock_positions.md` | Fleet onboard stock (no public system) + ship locations | `fleet_onboard_stock.csv`, `ship_positions.csv` | "Borrow from nearby ship" fix |
| 07 | `07_r_adm.md` | R-ADM (crew, PQS, watchbill) | `roster.csv`, `quals.csv`, `watchbill.csv` | k-of-n qualified people per system |
| 08 | `08_fltmps_nec.md` | FLTMPS / NTMPS NEC billets | `nec_billets.csv` | NEC gaps, PRD cliffs, ship-vs-shore drift |
| 09 | `09_mfom_mission_tree.md` | MFOM / AWN readiness tree | `mission_equipment_tree.json` | The dependency graph itself |
| 10 | `10_roc_poe.md` | ROC/POE mission assignments | `roc_poe_mission_map.csv` | Which missions a DDG owes, weights |
| 11 | `11_drrs_readiness_baseline.md` | DRRS-S / DRRS-N (Y/Q/N, PESTO) | `readiness_baseline.csv` | Today's ratings to project forward |
| 12 | `12_training_readiness.md` | TORIS / NTIMS / TFOM | `training_readiness.csv` | Training pillar |
| 13 | `13_ofrp_schedule.md` | OFRP employment schedule | `schedule_30day.csv` | Mission deadlines |
| 14 | `14_certifications_events.md` | SFTRM certifications / ATG events | `events_missions.json`, `cert_status.csv` | Mission requirements and prerequisites |
| 15 | `15_availabilities_nmd.md` | CNO availabilities, NMD/NDE | `availabilities.csv` | Availability slip propagation |
| 16 | `16_daily_reports.md` | Eight O'Clock Reports, POD | `daily_status_<ship>_<date>.pdf`, `pod_<ship>_<date>.pdf` | LLM extraction of status not in systems |
| 17 | `17_movrep_logreq.md` | MOVREP / LOGREQ messages | `movrep/*.txt`, `logreq/*.txt` | Donor proximity, delivery windows |
| 18 | `18_insurv.md` | INSURV inspections (optional) | `insurv_findings.csv` | Slow material prior (optional) |
| 19 | `19_catalog_and_assumptions.md` | Jupiter/Advana catalog + our assumptions | `data_catalog.json`, `delay_model_params.yaml` | Provenance, every engine assumption |
| 20 | `20_fielded_access.md` | How a fielded version gets real data | none (pitch + design constraints) | Speed to Fleet, Barrier Removal |

---

## 6. How the sources join

```
                        roc_poe_mission_map ──► mission_equipment_tree (mission → NTA → system → component → part NIIN)
                                                      │                        │
 events_missions / cert_status ──(required systems, watch teams)               │
        │                                             │                        │
 schedule_30day ◄── availabilities                    ▼                        ▼
        │                                 casreps.json ──casrep_dtg──► csmp.csv (JCN) ──req_doc_numbers──► requisition_status
        │                                     ▲   (also equipment EIC)        │                               │ NIIN
        │                                     │                               │                               ▼
        │                         casrep_messages/*.txt                sked_schedule (equipment,       onboard_allowance_cosal
        │                                                              lost PMS correlation)          fleet_onboard_stock, wholesale_stock
        ▼                                                                                                     │
 ship_positions ◄── movrep / logreq ─────────────────────────────────────────────── donor search (where is the part, where is the ship)

 roster ──member_id──► quals ──watchstation──► watchbill        nec_billets ──NEC──► roster (NECs held)
     └── k-of-n qualified people per system (mission_equipment_tree.required_quals)

 daily_status PDFs ──(LLM extraction, span-verified)──► facts referencing casrep_id / JCN / NIIN / member rate
 readiness_baseline, training_readiness ──► day-0 ratings the forecast projects forward
 data_catalog.json describes every file; delay_model_params.yaml holds every assumption
```

**Primary join keys:** `ship_id` + `uic` everywhere; `casrep_dtg` (CASREP ⇄ CSMP; sourced rule: the 2-Kilo remarks must carry the CASREP DTG **[S]**); `jcn` (CSMP ⇄ requisitions); `niin` (requisitions ⇄ stock files ⇄ mission tree); `eic` (CSMP/CASREP ⇄ mission tree system); `member_id` (roster ⇄ quals ⇄ watchbill); `watchstation_code` / `pqs_ref` (quals ⇄ mission tree required quals); `event_id` (schedule ⇄ events).

---

## 7. The demo storyline (every spec must contain its piece)

All files must tell this one consistent story. Days are relative to scenario now (day 0 = 4 Nov 2026).

| Day | What happens | Appears in |
|---|---|---|
| -21 | Kessler daily-report roster last updated (stale by day 0) | 07, 16 |
| 0 | **Kessler CASREP INITIAL `041200Z NOV 26`**, Cat 3, AN/SPY-1D(V) cooling water pump failed; AW mission degraded | 03, 02 |
| 0 | 2-Kilo JCN `99101CF010042` opened, remarks cite the DTG; requisition `R991016308A001` for NIIN `019990001`, PD `02`, RDD `999`, status `BB` | 02, 04 |
| 1 | Supply status changes `BB` → `BC` (long delay), ESD slips to day 11 | 04, 03 (UPDATE) |
| 1 | Daily report: "NSWC tech rep assist may slip to 12 NOV." Not in any structured file (seeded inconsistency) | 16 |
| 2 | Two of Kessler's three SPY-qualified FC techs show transfer/TAD starting day 6 (PRD + TAD orders) | 07, 08 |
| 3 | Schedule shift: Kessler's Group Sail/SWATT AW event moves earlier, to day 9 | 13, 14 |
| 9 | **Mission A**: Kessler Group Sail/SWATT AW serial (needs SPY + 2 of 3 qualified FC) | 14 |
| 14 | Varnell's own mission (Mission C) | 14 |
| 18 | Ashby's mission (Mission D) | 14 |
| 21 | Kessler Mission B (COMPTUEX start) | 13, 14 |

Fix candidates the data must support:
1. **Borrow (cross-deck) the pump from USS Varnell's storeroom.** Varnell has allowance 1, on hand 1, so the cross-deck drops it below allowance (06, 04).
2. **Expedite / pull from program-office asset.** Wholesale on hand 0, program office holds 1 (05).
3. **Cross-deck a qualified FC from Ashby** (07).
4. **Shift Mission A** if the schedule allows (13).

The engine computes whatever P(ready) results. **No data is tuned to hit a target number.**

---

## 8. Seeded inconsistencies (deliberate, documented)

Real fleet data is fragmented. The mock data must include these, and the UI must surface them as contradictions, not hide them.

| ID | Inconsistency | Files |
|---|---|---|
| X1 | A CASREP DTG with no matching open JCN (Ashby) | 03, 02 |
| X2 | Several CASREPs tracing to one root NIIN (Gridley-style duplicate) (Varnell, 2 CASREPs, 1 ethernet switch NIIN) | 03, 04 |
| X3 | A `BA` status whose estimated ship date has already passed (Ashby) | 04 |
| X4 | Daily report says the tech assist "may slip"; no structured file reflects it (Kessler day 1) | 16 |
| X5 | Donor cross-deck would drop Varnell below its storeroom allowance | 06, 04 |
| X6 | A CMAV extension invalidates a certification start date (Varnell) | 15, 14 |
| X7 | Lost PMS on an item with no matching 2-Kilo (Kessler CIWS) | 01, 02 |
| X8 | A qual present in R-ADM but missing from FLTMPS/NEC record (ship-vs-shore drift) | 07, 08 |
| X9 | Watchbill assigns a sailor whose qual status is not QUALIFIED/INTERIM (Kessler) | 07 |
| X10 | Stale roster: `as_of` older than the 5-day staleness threshold | 07 |

---

## 9. What is still unverified (check before the demo)

- NTTP 1-03.1 current CASREP set order and parts set layout.
- NAVSEAINST 4790.8D Chapter 2 and Appendix G: periodicity codes, the SKED 3.2 no-deferral rule, 2-Kilo code tables.
- DLM 4000.25 Vol 2 AP7.16: the full status-code table (we used a secondary mirror).
- Current SFTRM (3502.7 series) certification list and prerequisites.
- How TYCOMs actually approve a cross-deck or cannibalization.
- Ask on site: a Surface Force mentor on real CASREP/qual formats; Defense Unicorns staff on packaging expectations.
