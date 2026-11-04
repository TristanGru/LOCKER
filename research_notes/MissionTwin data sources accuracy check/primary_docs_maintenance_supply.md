# Primary document accuracy check: maintenance and supply

Date: 2026-11-04

Scope: `data_sources/00_README.md`, `01_sked_pms.md`, `02_omms_ng_csmp.md`, `04_r_supply_milstrip.md`, `05_navsup_wholesale.md`, `06_fleet_stock_positions.md`, `09_mfom_mission_tree.md`, `15_availabilities_nmd.md`, and matching synthetic files under `data_sources/Synthetic Data/`.

Primary documents checked locally:
- `Data Source Docs/OPNAVINST_4790.4G.pdf` (3-M policy, 1 Aug 2024)
- `Data Source Docs/Volume_II_D5.pdf` (JFMM Rev D Chg 5, Vol II, 13 Jun 2025)
- `Data Source Docs/JFMM_ACN_02-26_VI-21.pdf` (JFMM admin change, 4 Apr 2026)
- `Data Source Docs/OPNAVINST_4700.7N.pdf` (maintenance policy for Navy ships, 5 Dec 2024)
- `Data Source Docs/OPNAVINST_4441.12F.pdf` (retail supply support, 4 Dec 2024)
- `Data Source Docs/4440.19G.pdf` (cannibalization/diversion, 5 May 2021)
- `Data Source Docs/MILSTRIP.pdf` (DLM 4000.25-1 legacy MILSTRIP, 2 Apr 2019)
- `Data Source Docs/ADC_1114_Change_MRA_Times_based_on_TDD.pdf`
- `Data Source Docs/DoDAAC_Assignment_Logic.pdf`

## Findings

### M1. PMS and SKED concept

Spec: `01_sked_pms.md` treats SKED/PMS as scheduled preventive maintenance with MIPs, MRCs, accomplishment state, spot checks and IEM.

Source: `OPNAVINST_4790.4G.pdf`, p. 2, says PMS is the standardized method for planning, scheduling and accomplishing preventive maintenance by ship's force. The same page describes scheduling as planning, managing, executing and tracking maintenance requirements and accomplishments. It also says the Maintenance Data System is where applicable maintenance efforts are reported.

Verdict: CONFIRMED.

Recommended correction: none for the top-level concept. Keep every SKED CSV layout marked as proposed/unofficial because no public SKED export layout was found.

### M2. LOST PMS versus overdue/alert semantics

Spec: `01_sked_pms.md` uses `status` values `SCHEDULED`, `COMPLETE`, `LOST`, `IEM` and uses LOST checks as precursor signals.

Source: the available current public primary documents confirm PMS accomplishment tracking, but they do not define SKED 3.2 `LOST` or alert semantics. `Volume_II_D5.pdf` and `JFMM_ACN_02-26_VI-21.pdf` hits for "lost" were mostly lost time/contact, not SKED LOST checks.

Verdict: UNVERIFIABLE from current local primary documents.

Recommended correction: retain `LOST` as an informed synthetic status, but label the exact SKED semantics `[UNVERIFIED]`. Do not equate LOST with a 2-Kilo or CASREP; use it only as a maintenance-risk signal unless a matching work candidate exists.

### M3. 2-Kilo field model and CSMP

Spec: `02_omms_ng_csmp.md` says JCN is UIC + work center + JSN, and models APL/AEL, equipment noun, EIC, location, equipment status, when discovered, deferral, priority, type availability, remarks and CSMP summary.

Source: `Volume_II_D5.pdf`, p. 400, sample message work candidate lists the core 2-Kilo fields: UIC, work center, JSN, APL/AEL, equipment name, when discovered, status, cause, deferral reason, equipment serial, EIC, safety hazard, location, when discovered date, ship's force man-hours, deferral date, deadline date, remarks/description, CSMP summary, priority, type availability, special purpose and drawings. `Volume_II_D5.pdf`, pp. 470-471, lists ship UIC, work center JCN, APL/AEL, ship name, hull number, equipment noun name, EIC, location, SWLIN, JSN, status, when discovered date, deferred date, symptoms/supporting information, type availability, required delivery date, recommended resolution, maintenance action requested, MFOM in CSMP shore file and initial estimate.

Verdict: CONFIRMED in structure.

Recommended correction: add `cause_code`, `safety_hazard_code`, `deadline_date` / `required_delivery_date`, `csmp_summary`, and optionally `swlin` to the proposed CSMP schema. Keep exact OMMS-NG/AWN field names marked proposed.

### M4. Synthetic CSMP code values are not realistic enough

Spec/data: `data_sources/Synthetic Data/*/csmp.csv` uses `when_discovered_code = A`, `deferral_reason_code = 1/3`, `priority = 3`, `type_avail = 4` for routine rows. Examples: `KESSLER/csmp.csv` rows like `99101CF010001`.

Source: JFMM current examples show the fields but not all value meanings. Earlier public 3-M manual notes found the real 2-Kilo codes are numeric for When Discovered, not alpha, and priority is 1 Mandatory, 2 Essential, 3 Highly Desirable, 4 Desirable. JFMM confirms these fields are still present.

Verdict: WRONG for `when_discovered_code` format; PARTLY CONFIRMED for having the fields.

Recommended correction: replace alpha `A` with numeric codes. For the demo pump failure, use a numeric code consistent with discovery during operation or PMS, not `A`. Keep legacy/public code meanings in `status_code_reference.csv` with source status as dated if a current code table is not public.

### M5. Type availability and availabilities

Spec: `15_availabilities_nmd.md` says CMAVs are short continuous maintenance availabilities, SRA/DSRA/DMP/PIA are availability types, and A-360 style milestones are relevant.

Source: `OPNAVINST_4700.7N.pdf`, p. 72, defines CMAV as a non-CNO-scheduled availability or continuous accomplishment of intermediate/depot maintenance and selected modernization. `Volume_II_D5.pdf`, p. 353, says a scheduled CMAV is normally 2 to 6 weeks and normally scheduled once per non-deployed quarter in port. `Volume_II_D5.pdf`, pp. 76-77, lists SRA, docking SRA, PMA, docking PMA, extended SRA, extended docking SRA, incremental SRA and other less-than-six-month CNO availabilities. `Volume_II_D5.pdf`, pp. 534 onward, contains surface ship milestone schedules with A-880/A-450/etc.; p. 172 includes A-410/A-360 style planning.

Verdict: CONFIRMED with updates.

Recommended correction: change the spec's "CMAV notionally two weeks every four months" to "scheduled CMAV normally 2 to 6 weeks, normally once per non-deployed quarter; often notional two-week examples exist." Keep DMP/PIA class-specific and not central to DDG synthetic data.

### M6. Supply system and R-Supply/NOSS transition

Spec: `04_r_supply_milstrip.md` mixes R-Supply and NOSS and allows `system_of_record = NOSS` on a few shipboard rows.

Source: `OPNAVINST_4441.12F.pdf`, p. 2, confirms Navy retail supply support and asset visibility over Navy cognizance assets, consumer-level inventories, accountable officers, excess material and OSIs. Public NOSS information supports a supply modernization path but does not prove afloat DDGs are running NOSS by Nov 2026.

Verdict: R-Supply retail-supply concept CONFIRMED; shipboard NOSS rows UNVERIFIABLE / likely premature.

Recommended correction: make all shipboard synthetic requisition and COSAL rows `RSUPPLY` unless a source supports an afloat NOSS fielding. If showing NOSS, put it on an ashore or future-state mock row and label it proposed.

### M7. DoDAAC and document numbers

Spec/data: `00_README.md`, `04_r_supply_milstrip.md`, `missiontwin/domain.py`, and `data_sources/Synthetic Data/*/requisition_status.csv` use `R99101`, `R99102`, `R99103` and document numbers like `R991016308A001`.

Source: `MILSTRIP.pdf` confirms the general MILSTRIP concept and document-number location in legacy transactions, but the current local PDFs did not provide a readable current Navy afloat R/V/N prefix table. Earlier research found dated Navy guidance and DLA assignment logic snippets indicating `V` for Atlantic Fleet operating units and `R` for Pacific Fleet operating units.

Verdict: Document-number length/shape is PARTLY CONFIRMED; Norfolk-based `R` prefix is likely WRONG; `A001` serial semantics remain UNVERIFIABLE.

Recommended correction: for Norfolk/CNSL ships, use `V99101`, `V99102`, `V99103` and document numbers like `V9910163080001`, or explicitly rehome the squadron to a Pacific Fleet scenario. Prefer numeric 4-character serials unless `A001` is documented as a synthetic marker.

### M8. Supply status codes and RDD

Spec/data: uses status codes BA, BB, BC, BV, BZ, B5, CB and RDD `999` for CASREP requisitions.

Source: `MILSTRIP.pdf` confirms supply status transactions in legacy MILSTRIP/DLMS context, including DIC AE8, but the local legacy PDF is not the current AP7.16 code table. Earlier research against public mirrors/snippets confirms the broad meanings of BA/BB/BC/BV/BZ/B5/CB and that AP7.16 moved into DLM 4000.25 Volume 2. It also found that RDD 999 has deployment/overseas constraints in DoD/Navy guidance.

Verdict: PARTLY CONFIRMED; current code-table source still incomplete locally.

Recommended correction: keep code values, but fix semantics:
- `BC` means long delay anticipated, so an ESD only 10 days out is odd. Either keep `BB` for short due-in slips or move `BC` ESD weeks out.
- `RDD = 999` should be used only when the scenario justifies expedited NMCS/CASREP handling, such as deployed/overseas or deploying within 30 days. Otherwise use an `N__`, `E__` or ordinary date convention and label it proposed.

### M9. Cannibalization and cross-decking

Spec: `06_fleet_stock_positions.md` distinguishes cross-decking shipboard stock from cannibalizing installed equipment.

Source: `4440.19G.pdf`, p. 1, covers cannibalization of equipment in operational use, in supply-system storage or in inactive fleet units, and diversion of contractor-plant material for urgent operational requirements. `4440.19G.pdf`, p. 5, requires maritime cannibalization metrics and monthly reporting. Public DVIDS/NAVSEA material identifies eCANNAB as the fleet web tool to process, track, route and report maritime cannibalizations.

Verdict: CONFIRMED in principle.

Recommended correction: add `eCANNAB` as the likely cannibalization management source for true installed-equipment cannibalization. Keep storeroom stock cross-decking as a retail/lateral redistribution concept, separate from cannibalization, unless the item is removed from installed equipment.

### M10. CSV banner line

Data: all sampled synthetic CSVs begin with `# SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA` before the header row.

Source: sampled 55 CSV files under `data_sources/Synthetic Data/`.

Verdict: CONFLICT with ordinary CSV consumers.

Recommended correction: either remove the banner from CSV files and keep the synthetic warning in README/manifest, or require all ingest code to skip leading comment lines. As-is, `csv.DictReader` reads a single column named `# SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA` unless custom skipping is implemented.
