# 07 R-ADM: crew roster, PQS qualifications and watchbills

Tags: see `00_README.md` section 1.

## 1. The real system

- **What it is.** "NTCSS Relational Administration (R-ADM)"; it "serves as the afloat personnel management system" on Navy ships and submarines **[S]** (Federal Register 2012-12045, system notice N01070-16). Expanded as "Relational Administrative Data Management" in the 2018 SFTRM **[S-SNIP]**. The user's "RAD-M" is R-ADM; job postings also write "RADM". (RADM otherwise means Rear Admiral.)
- **Authority.** The Surface Force Training and Readiness Manual (COMNAVSURFPAC/SURFLANTINST 3502.7, 2018) **[S-SNIP]**:
  - R-ADM is "the authoritative database for afloat activities with the NTCSS suite to capture individual unit-level training, including PQS, qualifications, and certifications."
  - Every watchstander must be "qualified or interim qualified per R-ADM."
  - "All watchbills will be created, managed, and maintained in R-ADM or another program that pulls data directly from the R-ADM database."
  - Ships without R-ADM "may choose their method of tracking PQS."
- **Entry quality.** Department leadership checks personnel are entered "by duty section, division, and work center" with required PQS assignments **[S]** (Engineering Dept ORM).
- **Data held (Privacy Act notice)** **[S]**: name, **SSN**, demographics, contact, religious preference, clearance, dependents, medical, military record, education. Retrieved by name/SSN. Sources: the individual and the Navy Training Management & Planning System. Destroyed on transfer/separation. **We never mock SSNs or real names.**
- **Shore divergence.** A 2024 MyNavy HR guide reportedly says R-ADM data "is not accepted by NSIPS and is not documented in the ESR," and disconnected afloat data refreshes through "replication" **[S-SNIP]**. Ship and shore qual records can legitimately disagree.
- **STRMS.** Surface Training and Readiness Management System (Aptima / General Dynamics, NAVSEA PMS 339): watchstander qualification/proficiency and watchbill tracking, hosted on the ship's CANES network **[S]**. Relation to R-ADM is unconfirmed **[UNV]**.
- **Status, Nov 2026.** In use; no public sunset or named replacement **[UNV]**. Probably not a NOBLE target (NOBLE is supply and maintenance) **[inference]**.

## 2. Why MissionTwin pulls it

The mission tree (spec 09) says each system needs **k of n qualified people** (for example SPY-1D needs 2 of 3 FC radar-qualified techs). R-ADM supplies:
- Who is aboard, when they leave (PRD, transfer, TAD).
- Who holds which PQS watchstation qualification, at what status, and when requalification is due.
- Who is on the watchbill (and whether that is legal).

## 3. How we believe it is structured

- **PQS** = "the minimum knowledge and skills that an individual must demonstrate in order to qualify to stand watches"; standards carry NAVEDTRA numbers like 43512-2 **[S]**.
- **Watchstation line items** use 4-digit numbers: `2200` Lookout, `2300` Helmsman, `2400` QMOW, `2500` BMOW **[S]** (Sea Cadet-hosted copies mirroring Navy numbering).
- **Qual status values** sourced: qualified, interim qualified, final qualified **[S-SNIP]**. We use `IN_PROGRESS`, `INTERIM`, `QUALIFIED`, `EXPIRED` **[PROP]**.
- **Rates.** Rating + paygrade abbreviations (FC2, STG1, GSM3, ET1) **[S]** (standard).
- **NECs** are 4 alphanumeric characters since Oct 2017 **[S]** (spec 08).
- **Whether PRD, EAOS and NEC sit in R-ADM** is an inference; no public schema **[UNV]**.

## 4. Mock files

### 4.1 `roster.csv` **[PROP]**

Grain: one row per sailor per ship.

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `member_id` | str | `M-0007` | synthetic; never SSN | PROP |
| `ship_id`, `uic` | | `KESSLER`, `99101` | | PH |
| `display_name` | str | `FC1 RAMOS (SYNTH)` | invented surname + rate; for UI only | PH |
| `rate` | str | `FC1` | rating + paygrade | S (style) |
| `rating` | str | `FC` | | S |
| `paygrade` | str | `E6` | | S |
| `department` | str | `COMBAT SYSTEMS` | | S field |
| `division` | str | `CF` | | S field |
| `work_center` | str(4) | `CF01` | matches spec 01 | S field |
| `duty_section` | int | `2` | 1-4 | S field |
| `onboard_status` | enum | `ONBOARD` | `ONBOARD`, `TAD`, `LEAVE`, `TRANSFERRING`, `GAINING` | PROP |
| `status_start`, `status_end` | date | | for TAD/leave/transfer | PROP |
| `report_date` | date | `2025-03-10` | | PROP |
| `prd` | date | `2026-11-10` | projected rotation date | UNV placement |
| `eaos` | date | `2028-06-30` | | UNV placement |
| `necs` | str | `F9A1;F9B2` | `;`-list, 4-char codes | S fmt / PH values |
| `as_of` | datetime | `2026-10-14T08:00:00Z` | | PROP |
| `provenance` | str | | | |

### 4.2 `quals.csv` **[PROP]**

Grain: one row per sailor per PQS qualification.

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `member_id` | str | `M-0007` | | PROP |
| `ship_id` | str | `KESSLER` | | |
| `pqs_ref` | str | `NAVEDTRA 43xxx-SPY (SYNTH)` | | S fmt / PH |
| `watchstation_code` | str | `4310` | 4-digit | S fmt / PH value |
| `watchstation_name` | str | `SPY RADAR SYSTEM CONTROLLER (SYNTH)` | | PH |
| `qual_status` | enum | `QUALIFIED` | `IN_PROGRESS`, `INTERIM`, `QUALIFIED`, `EXPIRED` | S-SNIP (interim/final) / PROP |
| `pct_complete` | int | `100` | 0-100 | PROP |
| `interim_date` | date | | | PROP |
| `final_date` | date | `2025-08-01` | | PROP |
| `requal_due` | date | `2027-08-01` | | PROP |
| `signed_by` | str | `M-0002` | qualifier member_id | PROP |
| `as_of` | datetime | | | |
| `provenance` | str | | | |

### 4.3 `watchbill.csv` **[PROP]**

Grain: one row per watchstation per watch period per day.

`date, ship_id, watch_period (e.g. 0000-0400), condition (III, II, I), watchstation_code, watchstation_name, section, member_id, as_of, provenance`

Rule (sourced policy **[S-SNIP]**): every `member_id` assigned must have `qual_status` `QUALIFIED` or `INTERIM` for that `watchstation_code`.

## 5. Generator rules

- Kessler ~300 crew (DDG order of magnitude **[UNV]**); ~20-30 FC ratings. Only the systems in the mission tree need detailed quals; everyone else gets basic watchstations (Lookout, Helmsman).
- Qualified headcount per critical watchstation = k to k+2 (thin, realistic margins; fleet manning strain: 84,379 needed at sea vs 70,705 onboard, Nov 2023 **[S]**).
- 5-10% of quals `IN_PROGRESS`, 2-5% `EXPIRED`.
- PRD distribution spread over 36 months, with a few clustered in the horizon.

## 6. Demo scenario rows and seeded inconsistencies

- **Kessler SPY watchstation `4310`:** 3 qualified (`M-0007` FC1, `M-0011` FC2, `M-0019` FC2), k = 2.
  - `M-0007`: `prd 2026-11-10`. Detaches day 6.
  - `M-0011`: TAD day 6 to day 20 (school).
  - **Build change:** the stale roster (X10, `as_of 2026-10-14`) still shows both `ONBOARD`. The departures arrive through the 05 NOV daily report (spec 16), which is newer and overrides the stale roster. That makes staleness matter: the roster is wrong, and only the daily report says so.
  - Result: from day 6, only 1 of the required 2 is aboard.
- **Ashby:** 4 qualified on `4310`; one (`M-0412` FC2) is the cross-deck candidate (fix 3).
- **X8:** Kessler `M-0019` holds the SPY NEC in `roster.csv` but `nec_billets.csv` / FLTMPS shows no holder for it (ship-vs-shore drift).
- **X9:** Kessler watchbill day 2 assigns `M-0023` to `4310` while `qual_status = IN_PROGRESS`.
- **X10:** Kessler `roster.csv` `as_of 2026-10-14` (21 days old, beyond the 5-day staleness threshold).

## 7. Open questions

- Real R-ADM field names and export formats (none public).
- STRMS vs R-ADM roles.
- Real watchstation numbers for Aegis/CIC watchstations (ours are placeholders).

## 8. Sources

Federal Register 2012-12045; COMNAVSURFPAC/SURFLANTINST 3502.7 (2018); Engineering Dept ORM; NAVEDTRA 43512-2; Sea Cadet PQS 2200-2500; Navy Times (NEC 2017); NAVPERS 15878N (2024); NAVADMIN 184/25; GD and Aptima STRMS pages; NAVSEA PMS 339; Military Times (manning). Links in `reports/Navy SKED OMMS NG and RADM.md`.
