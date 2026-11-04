# Audit of `data_sources/Synthetic Data`

Date: 2026-11-04

Scope: teammate synthetic dataset under `data_sources/Synthetic Data/`, compared against the MissionTwin specs, earlier research notes, and the primary-document checks in this folder.

Read-only audit. No dataset files were modified.

## Executive verdict

The dataset is strong for demo mechanics: it has the right families of data, good join coverage, deliberate contradictions, and clear synthetic labeling. It is not yet a realistic representation of Navy source formats. The biggest issues are:

1. Every CSV has a first-line synthetic banner that breaks ordinary CSV readers unless they skip comment lines.
2. Norfolk/CNSL ships use Pacific-style `R` DoDAAC/document-number prefixes; likely should be `V` for Atlantic or be moved to a Pacific scenario.
3. CASREP messages repeat the same serial on follow-ups, use a non-standard `DTG` set, use spaced DTGs in REF lines, and use simplified `PARTS`/`EQUIP` sets.
4. CSMP rows preserve useful 2-Kilo fields but use placeholder code vocabularies, especially alpha `when_discovered_code = A`.
5. Some supply statuses and dates conflict semantically, especially `BC` with near-term ESDs.
6. DRRS/readiness uses `AMBER`; earlier research points to `YELLOW` as the safer data value.
7. The data is more internally complete than the specs in some places: it adds `sked_loep.csv`, `installed_equipment.csv`, `watchbill.csv`, validation files, and explicit anomalies.

## Findings

### D1. CSV banner line breaks standard parsing

File/example: 55 CSV files under `data_sources/Synthetic Data/`, for example `KESSLER/csmp.csv`.

What it shows: first line is `# SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA`, followed by the actual header row.

Real-world/source convention: CSV parsers normally treat the first row as headers unless configured otherwise.

Verdict: CONFLICT.

Concrete fix: remove the banner from CSV files and keep synthetic marking in `README.md`, `manifest.json`, and a `provenance` column, or update all ingest/validation code to skip leading `#` comment lines. This is a practical integration risk, not a Navy-realism issue.

### D2. DoDAAC and document-number prefixes

File/example: `squadron/ships.csv` uses `R99101`, `R99102`, `R99103`; `KESSLER/requisition_status.csv` uses `R991016308A001`; `missiontwin/domain.py` mirrors the same values.

Real-world/source convention: earlier supply research found dated/public Navy and DLA references indicating `R` for Pacific Fleet operating units and `V` for Atlantic Fleet operating units. The scenario text places the ships in Norfolk/CNSL, which is Atlantic. The 14-character MILSTRIP document-number concept is plausible, but the `A001` serial is not sourced for shipboard R-Supply.

Verdict: WRONG / UNVERIFIABLE.

Concrete fix: change Norfolk/CNSL ships to `V99101`, `V99102`, `V99103` and document numbers like `V9910163080001`, or move the exercise squadron to a Pacific setting. Use numeric 4-character serials unless `A001` is explicitly documented as synthetic.

### D3. CASREP follow-up serials

File/example: `KESSLER/casrep_messages/DDG991-26-017_01_INITIAL.txt` and `DDG991-26-017_02_UPDATE.txt` both use `MSGID/CASREP/USS KESSLER/017/NOV//`.

Real-world/source convention: earlier CASREP research found CASREP message serials are sequential per originating unit and should not be repeated until a new 1-999 sequence begins. Follow-ups reference the initial message DTG rather than reusing the initial serial.

Verdict: WRONG.

Concrete fix: leave the project `casrep_id` as `DDG991-26-017`, but make the UPDATE message itself use the next serial, for example `MSGID/CASREP/USS KESSLER/018/NOV//`, and link to the initial by `REF/A/MSG/USS KESSLER/041200ZNOV26//`.

### D4. CASREP DTG and set layout

File/example: all sampled `casrep_messages/*.txt` contain a `DTG/...//` set; follow-up REF lines use spaced DTGs such as `041200Z NOV 26`; parts are represented as `PARTS/...`; equipment as `EQUIP/...`.

Real-world/source convention: public message examples use the DTG in the message header, for example `R 041200Z NOV 26`, not as a CASREP set. Earlier research found `POSIT`, `REF`, `PARTSID` and `1PARTS` in dated CASREP set lists, while `EQUIP` was not confirmed. REF DTGs are typically compressed in message references.

Verdict: WRONG / SIMPLIFIED.

Concrete fix: use a header DTG line; change REF DTGs to compressed form; either switch to `PARTSID`/`1PARTS` style fields or label the simplified `PARTS` set as an exercise abstraction. Add `POSIT` if useful, but keep exact field layout proposed.

### D5. CSMP/2-Kilo structure is useful but code values are placeholders

File/example: `KESSLER/csmp.csv` has JCNs like `99101CF010042`, APL, EIC, equipment noun, location, date discovered, status, deferral reason, priority, type availability, remarks, verifier and system of record.

Real-world/source convention: JFMM current extracts confirm these are the right kinds of 2-Kilo/CSMP fields. However `when_discovered_code = A` in routine rows is not realistic for shipboard 2-Kilos; earlier public 3-M tables use numeric when-discovered codes.

Verdict: PARTLY CONFIRMED, with WRONG code vocabulary.

Concrete fix: replace alpha when-discovered codes with numeric placeholders aligned to public 3-M code tables; add `cause_code`, `safety_hazard_code`, `deadline_date`/`required_delivery_date`, and `csmp_summary`. Keep `system_of_record` values `OMMS-NG`/`AWN` as synthetic unless actual ship fielding is known.

### D6. Equipment noun lengths are not form-realistic

File/example: `csmp.csv` includes nouns like `Combat direction processor` (26 characters) and `Radar (SPY-1D-style)` (20 characters).

Real-world/source convention: earlier 3-M notes found 2-Kilo equipment noun name is limited to 16 positions in the public 3-M form guidance.

Verdict: WRONG for form-like data, acceptable for readable exercise data.

Concrete fix: if modeling 2-Kilo fields closely, add a shortened `equipment_noun_2k` field such as `CDP` or `RADAR SPY1D`, while keeping a human-readable `equipment_desc`.

### D7. Supply status semantics

File/example: `KESSLER/requisition_status.csv` has the scenario order `R991016308A001` moving `BB` to `BC` with `esd = 2026-11-15`. Many routine rows have RDD dates like `2026-11-24` and status codes `BA`, `BB`, `BC`, `BV`, `B5`, `CB`.

Real-world/source convention: BA/BB/BC/BV/BZ/B5/CB are plausible supply status codes. `BC` means long delay anticipated, so a near-term ESD is semantically odd. RDD 999 is plausible for high-priority CASREP/NMCS handling only when the mission/deployment conditions support it.

Verdict: PARTLY CONFIRMED.

Concrete fix: either keep the pump requisition at `BB` with an ESD slip, or make `BC` push ESD weeks out. Add scenario text that Kessler is deployed or deploying within 30 days if using `RDD = 999`.

### D8. NOSS shipboard rows

File/example: generator code creates up to two Ashby requisitions with `system_of_record = NOSS`.

Real-world/source convention: public NOSS/NOBLE information supports ashore supply modernization and planned future increments, but no public source found supports a Nov 2026 DDG afloat NOSS record.

Verdict: UNVERIFIABLE / likely premature.

Concrete fix: make shipboard supply records `RSUPPLY`; use `NOSS` only on ashore/future-state mock data and label it proposed.

### D9. Readiness color vocabulary

File/example: `missiontwin/domain.py` and `missiontwin/generate.py` generate `AMBER` bands; `data_sources/11_drrs_readiness_baseline.md` also uses AMBER.

Real-world/source convention: primary DRRS-S instruction confirms DRRS-S/NMETL/PESTOF but not the color names. Earlier MFOM notes point to green/yellow/red.

Verdict: UNVERIFIABLE / likely terminology mismatch.

Concrete fix: use `YELLOW` as the stored band value and render it with amber color in the UI if desired.

### D10. OFRP phase use is mostly correct

File/example: `schedule_30day.csv` uses `INTEGRATED`, `BASIC`, `SUSTAINMENT`; no sampled row used `DEPLOYED` as the OFRP phase.

Real-world/source convention: OPNAVINST 3000.15A defines maintenance, basic, integrated/advanced and sustainment; deployments occur within sustainment.

Verdict: CONFIRMED for sampled data.

Concrete fix: keep `DEPLOYED` out of `ofrp_phase`; use it under employment/status if needed.

### D11. Roster/quals/watchbill are synthetic but well aligned to the concept

File/example: each ship has 300 roster records, 472 quals records and 1350 watchbill rows. PQS refs are synthetic (`NAVEDTRA 43xxx-4310 (SYNTH)`), watchstation names are synthetic, and member IDs are non-PII.

Real-world/source convention: OPNAVINST 3500.34H supports PQS as the documented qualification process before standing watches or specific duties. No public R-ADM export layout was found.

Verdict: CONFIRMED in concept, UNVERIFIABLE as a real export layout.

Concrete fix: keep current shape, but label field names as MissionTwin proposed. Continue avoiding SSNs.

### D12. INSURV file is reasonable as a slow prior

File/example: `squadron/insurv_findings.csv`.

Real-world/source convention: OPNAVINST 4730.5S describes physical examination of spaces/equipment, demonstrations, records, and material conditions affecting mission performance and fitness for service.

Verdict: CONFIRMED in concept.

Concrete fix: optionally add `recommendation` values like `DECERTIFY`, `SUSPEND`, `REPAIR_BEFORE_USE`, or `PROCESS_NONCONFORMING` to mirror the instruction's possible outcomes.

### D13. Dataset is more complete than specs in useful ways

File/example: dataset adds `installed_equipment.csv`, `sked_loep.csv`, `watchbill.csv`, validation files, `expected_anomalies.json`, `daily_status_expected_facts.json`, and scenario events.

Real-world/source convention: these are proposed integration aids, not source-system exports.

Verdict: CONFIRMED as useful synthetic/demo scaffolding.

Concrete fix: back-port these file types into `00_README.md` and the relevant numbered specs so the docs match what the demo actually ships.

## Cross-dataset consistency risks

- `data_sources/00_README.md`, `missiontwin/domain.py`, and `Synthetic Data/squadron/ships.csv` agree on ships and UICs, but they all carry the likely-wrong `R` DoDAAC prefix for Norfolk.
- `data_sources/03_casrep.md`, generated CASREP messages, and `missiontwin/generate.py` share the same simplified CASREP message format. Fixing this requires spec and generator changes together.
- `data_sources/11_drrs_readiness_baseline.md`, `domain.py`, and `generate.py` share `AMBER`; change together if switching to `YELLOW`.
- `data_sources/04_r_supply_milstrip.md`, `domain.py`, generated requisitions and CSMP `req_doc_numbers` all embed the document numbers. Prefix/serial changes need a coordinated migration.
