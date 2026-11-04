# Primary document accuracy check: readiness, training, personnel, schedule, CASREP and INSURV

Date: 2026-11-04

Scope: `data_sources/03_casrep.md`, `07_r_adm.md`, `08_fltmps_nec.md`, `10_roc_poe.md`, `11_drrs_readiness_baseline.md`, `12_training_readiness.md`, `13_ofrp_schedule.md`, `14_certifications_events.md`, `16_daily_reports.md`, `17_movrep_logreq.md`, `18_insurv.md`, `19_catalog_and_assumptions.md`, `20_fielded_access.md`, and matching synthetic files.

Primary documents checked locally:
- `Data Source Docs/3501.360B.pdf` (DRRS-S, 9 Dec 2024)
- `Data Source Docs/3000.15A.pdf` (OFRP, 10 Nov 2014)
- `Data Source Docs/COMNAVSURFPAC_COMNAVSURFLANTINST-3502_7-1Nov18-Surface_Force_Training_Readiness_Manual.pdf`
- `Data Source Docs/OPNAVINST_3500.34H.pdf` (PQS, 1 Nov 2021)
- `Data Source Docs/OPNAVINST_4730.5S.pdf` (INSURV material inspections, 22 Mar 2022)
- `Data Source Docs/2024 Publicly_Releasable_Annual_Report_rev1 (1).pdf`
- `Data Source Docs/OPNAVINST_4790.4G.pdf`
- `Data Source Docs/Volume_II_D5.pdf`

## Findings

### R1. DRRS-S versus DRRS-N

Spec: `11_drrs_readiness_baseline.md` says DRRS-N survives as a reporting construct and DRRS-S is the input/display tool.

Source: `3501.360B.pdf`, p. 1, states that DRRS-S is the Navy's authoritative system for readiness reporting and confirms DRRS-N has been retired. It also removes the obsolete DRRS-N to DRRS-S data-flow discussion. `3501.360B.pdf`, p. 6, says a unit must have an approved NMETL before it can be assessed and reported through DRRS-S, and that PESTOF resource pillar data is mapped to NMETLs to inform the commander's assessment.

Verdict: OUTDATED.

Recommended correction: replace "DRRS-N construct" wording with "DRRS-S authoritative system; legacy DRRS-N terms may appear in older notes." Keep NMETL, PESTOF and commander assessment as DRRS-S concepts.

### R2. DRRS colors and bands

Spec/data: `11_drrs_readiness_baseline.md`, `missiontwin/domain.py`, `missiontwin/generate.py`, and synthetic readiness files use `GREEN`, `AMBER`, `RED` bands.

Source: `3501.360B.pdf` confirms DRRS-S/NMETL/PESTOF but the local primary document did not validate the MFOM 80/60 bands or color names. Earlier MFOM-related notes support green/yellow/red bands, not amber. The current generator uses `AMBER`.

Verdict: UNVERIFIABLE / likely terminology mismatch.

Recommended correction: use `YELLOW` in data and UI for the 60-79 band unless a current Navy source supports `AMBER`. If the product UI prefers amber visually, keep the data value `YELLOW` and render it amber.

### R3. "DRRS lags reality" framing

Spec: `11_drrs_readiness_baseline.md` says the baseline is the last DRRS report before the day-0 casualty and MissionTwin projects forward.

Source: `3501.360B.pdf` establishes DRRS-S as the authoritative reporting system, not a predictive system. It requires unit readiness assessment against NMETLs and PESTOF data, but does not provide a real-time predictive forecast mechanism.

Verdict: CONFIRMED as a product framing if worded carefully.

Recommended correction: say "DRRS-S is authoritative for reported current readiness; MissionTwin projects future mission impact from faster-changing source feeds." Avoid implying DRRS-S is stale by design or wrong.

### R4. OFRP phase list

Spec/data: `13_ofrp_schedule.md` and `schedule_30day.csv` use `MAINTENANCE`, `BASIC`, `INTEGRATED`, `SUSTAINMENT`, and sometimes `DEPLOYED`.

Source: `3000.15A.pdf`, p. 2, defines the cycle from maintenance phase to the next maintenance phase and names maintenance/basic/integrated or advanced/sustainment. `3000.15A.pdf`, p. 6, says the sustainment phase begins after integrated or advanced phase, continues through the post-deployment period, and deployments may be conducted within sustainment.

Verdict: PARTLY WRONG.

Recommended correction: replace `DEPLOYED` as an OFRP phase with `SUSTAINMENT` plus an employment/schedule status such as `DEPLOYED` or `UNDERWAY`. The synthetic files sampled already use `INTEGRATED`, `BASIC`, and `SUSTAINMENT`, which is good.

### R5. PQS and watch qualifications

Spec/data: `07_r_adm.md`, `quals.csv`, and `watchbill.csv` model PQS refs, watchstation codes, qualification status, sign-offs and requalification.

Source: `OPNAVINST_3500.34H.pdf`, p. 1, says PQS ensures personnel demonstrate required competencies before performing specific duties; PQS delineates minimum knowledge, skills and abilities before standing watches or performing other duties, and documents on-the-job training.

Verdict: CONFIRMED in concept.

Recommended correction: keep roster/quals/watchbill as synthetic R-ADM-like files. Continue to mark PQS numbering, real watchstation codes and R-ADM export fields as proposed unless a public R-ADM layout is found.

### R6. NEC codes

Spec/data: `08_fltmps_nec.md`, `roster.csv`, and `nec_billets.csv` use four-character placeholder NECs like `F9A1`.

Source: no current NEC manual was available locally. Earlier notes say the 2026 NEOCS volume was not downloaded. Public OPNAV PQS instruction does not define NEC format.

Verdict: UNVERIFIABLE for the specific values.

Recommended correction: keep NEC shape as a placeholder, but do not claim real Aegis FC NEC values. Label `F9A1`, `E9C1`, etc. as synthetic.

### R7. CASREP governing publication and message realism

Spec/data: `03_casrep.md` names NTTP 1-03.1 and `casrep_messages/*.txt` use `DTG/...//`, repeated MSGID serials on updates, `PARTS` sets, and `EQUIP` sets.

Source: NTRP/NWP 1-03.1 was not locally available. Earlier public research found the governing publication as NTRP 1-03.1 / formerly NWP 1-03.1, Chapter 4, not NTTP 1-03.1. Earlier public training sources also show CASREP follow-ups reference the initial DTG but do not reuse the same serial; they use standard message header DTGs, not a `DTG` set; and parts sets are `PARTSID` / `1PARTS` in dated public examples.

Verdict: PARTLY WRONG.

Recommended correction:
- Change NTTP to NTRP/NWP 1-03.1 where the spec cites the governing publication.
- In message text, replace `DTG/041200Z NOV 26//` with a real message header line such as `R 041200Z NOV 26`.
- Give UPDATE/CORRECT/CANCEL their own sequential MSGID serials, and link them to the INITIAL by a `REF` line.
- Use compressed DTG in the REF field, for example `041200ZNOV26`.
- Replace `PARTS` with proposed `PARTSID` / `1PARTS` style fields, or mark `PARTS` as a simplified exercise field.
- Keep JSON `casrep_id` anchored to the initial casualty as a project key, not a real message serial.

### R8. CASREP classification and synthetic marking

Spec/data: all CASREP messages are `UNCLAS//SYNTHETIC EXERCISE//`.

Source: earlier GAO research established individual-ship CASREPs are classified when they reveal warfighting capability. The spec already states data is synthetic and unclassified by construction.

Verdict: CONFIRMED as exercise handling; not representative of real operational classification.

Recommended correction: keep the synthetic banner. Add a short note that a real single-ship Cat 3 SPY casualty would likely not be unclassified.

### R9. INSURV

Spec: `18_insurv.md` treats INSURV findings as optional slow material priors.

Source: `OPNAVINST_4730.5S.pdf`, p. 3, says a material inspection is a physical examination of the vessel, spaces and installed equipment, includes demonstrations and records, and identifies material conditions that substantially reduce fitness for naval service, primary/secondary mission performance, or expected service life. It may recommend equipment/systems/programs be decertified, suspended or repaired before operation.

Verdict: CONFIRMED.

Recommended correction: keep INSURV optional and prior-like. Add fields for whether a finding resulted in decertification/suspension/repair-before-use if the dataset wants higher realism.

### R10. Daily reports, MOVREP and LOGREQ

Spec/data: `16_daily_reports.md`, `17_movrep_logreq.md`, and synthetic daily report/MOVREP/LOGREQ files are intentionally local/proposed formats.

Source: no current primary message layout for MOVREP/LOGREQ or daily status reports was available locally. JFMM appendices show Navy message traffic often uses standard `MSGID/GENADMIN`, `REF`, `NARR`, `RMKS`, `BT` patterns for maintenance messages.

Verdict: UNVERIFIABLE as real formats; useful as proposed exercise feeds.

Recommended correction: keep as locally formatted synthetic documents and explicitly avoid claiming they are real message layouts. Use them as "semi-structured command reports" for extraction demos.
