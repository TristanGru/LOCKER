# MissionTwin data_sources accuracy audit

Date: 2026-11-04

Bottom line: MissionTwin is representing the right categories of Navy data sources, but not all source formats are realistic yet. For a hackathon demo, the current data is workable if clearly labeled synthetic. For a stronger "we understand Navy data" story, fix the high-signal format issues below before polishing lower-risk assumptions.

## What is represented well

- The source families are right: PMS/SKED, 2-Kilo/CSMP, CASREP, R-Supply/MILSTRIP status, COSAL/onboard allowance, fleet/wholesale stock, R-ADM-like roster/quals/watchbill, FLTMPS/NEC-like billets, DRRS-S readiness baseline, OFRP schedule, cert events, availabilities, INSURV, daily reports and movement/logistics messages.
- The join strategy is credible: CASREP initial DTG, JCN, NIIN/NSN, EIC, member ID, watchstation code, event ID and ship/UIC are the right kinds of keys.
- The dataset intentionally models contradictions. That is realistic and valuable: stale roster versus newer report, lost PMS with no 2-Kilo, part shared by multiple CASREPs, delayed requisition status, and ship-vs-shore qualification drift.
- PQS/qual/watchbill concept is grounded. OPNAVINST 3500.34H says PQS documents the minimum knowledge, skills and abilities before standing watches or specific duties.
- CMAV and availability concepts are grounded. Current JFMM/OPNAV maintenance policy supports CMAVs, CSMP-driven work packages and A- milestone planning.
- INSURV as a slow material-condition prior is reasonable. OPNAVINST 4730.5S ties material inspection findings to mission performance and fitness for naval service.

## Highest priority corrections

1. CSV banner line
   - Every CSV under `data_sources/Synthetic Data/` starts with a synthetic warning before the header. Standard CSV readers parse that as the only column.
   - Fix: remove the banner from CSVs or make every parser skip leading `#` lines.

2. DoDAAC/document numbers
   - The Norfolk/CNSL ships use `R99101`, `R99102`, `R99103`. Research points to `V` for Atlantic Fleet operating units and `R` for Pacific.
   - Fix: change to `V99101`, etc., and update document numbers and joins, or move the exercise to a Pacific setting. Prefer numeric serials over `A001` unless marked synthetic.

3. CASREP messages
   - Follow-up messages reuse the initial serial; they should have their own sequential MSGID serials and reference the initial DTG.
   - `DTG/...//` is not a real CASREP set; use a message header DTG.
   - `PARTS`/`EQUIP` are simplified; public examples point to `PARTSID`/`1PARTS` and do not confirm `EQUIP`.
   - Fix spec 03 and generator together.

4. CSMP/2-Kilo codes
   - The schema is close, but alpha `when_discovered_code = A` is not realistic for shipboard 2-Kilos.
   - Fix: use numeric public/dating-friendly placeholder tables, add missing fields like cause, safety hazard, deadline/RDD and CSMP summary.

5. Supply status timing
   - `BC` means long delay anticipated. A `BC` status with ESD only about 10 days out weakens the story.
   - Fix: keep short slips as `BB`, or push `BC` ESD weeks out so the cross-deck/program-office fix is clearly better.

6. DRRS wording and colors
   - DRRS-N is retired. DRRS-S is the authoritative readiness reporting system as of OPNAVINST 3501.360B.
   - Fix: write specs around DRRS-S, NMETL and PESTOF. Store the middle band as `YELLOW` unless a current source supports `AMBER`.

## Medium priority corrections

- Make shipboard supply `system_of_record = RSUPPLY`; keep `NOSS` for ashore/future-state mock rows unless a public afloat fielding source appears.
- Add `eCANNAB` as the likely source/process for true installed-equipment cannibalization. Keep cross-decking storeroom stock separate from cannibalization.
- Shorten or split CSMP equipment noun names if modeling form fields. Keep a readable equipment description separately.
- Change OFRP docs to say deployments occur within sustainment; do not use `DEPLOYED` as an OFRP phase.
- Back-port actual dataset files into the specs: `installed_equipment.csv`, `sked_loep.csv`, `watchbill.csv`, validation files and scenario event files.

## Output notes created

- `research_notes/MissionTwin data sources accuracy check/primary_docs_maintenance_supply.md`
- `research_notes/MissionTwin data sources accuracy check/primary_docs_readiness_training.md`
- `research_notes/MissionTwin data sources accuracy check/teammate_dataset_audit.md`

Recommended engineering sequence:

1. Fix CSV banner handling.
2. Change DoDAAC/document-number prefixes and update all joins.
3. Fix CASREP message generator/spec.
4. Replace placeholder CSMP code values.
5. Switch `AMBER` to `YELLOW` or explicitly document it as UI-only.
