# 02 OMMS-NG / AWN: 2-Kilo jobs and the CSMP

Tags: see `00_README.md` section 1.

## 1. The real system

- **What it is.** OMMS-NG (Organizational Maintenance Management System - Next Generation), an NTCSS application the Navy has used since **2001** "to document and report shipboard material deficiencies" **[S-SNIP]** (GAO-24-106525). The user's "OMNS" almost certainly means OMMS-NG; no system named OMNS was found.
- **Related / successor systems.**
  - **AWN (Automated Work Notification)**, the shipboard segment of MFOM, has replaced OMMS-NG on some ships **[S]**. Some ships, largely West Coast, still ran OMMS-NG in 2024 **[S-SNIP]**.
  - **N-MRO** (NOBLE maintenance): the Lockheed Martin agreement was cancelled by SECNAV memo in April 2025; N-MRO restarts with a commercial pilot **[secondary, FY2027 budget rendering]**.
  - Legacy OMMS (pre-NG), NALCOMIS OMA (aviation): not used here.
- **Users.** Work center supervisors originate 2-Kilos, division officers and department heads review, the 3MC manages the CSMP (standard 3-M practice) **[UNV]**. Contractor postings describe data entered and closed "in OMMS-NG, R-Supply reports, and Microsoft Excel worksheets" **[S]**, so Excel is the working export medium in practice.
- **Shore.** OMMS-NG data feeds the 3-M Maintenance Data System (MDS) ashore **[DATED]**.

## 2. Why MissionTwin pulls it

| Use | How |
|---|---|
| Deferred work backlog | Open/deferred jobs on mission systems are current or latent degradations. |
| CASREP join | The 2-Kilo for a casualty must carry the **CASREP DTG** in its remarks **[S]**. This is the only documented machine-joinable CASREP link. |
| Parts join | Requisition document numbers on the job join to `requisition_status.csv` (field name **[UNV]**). |
| Who does the work | Type Availability 1-4 says whether the fix needs depot, IMA, tech assist or ship's force **[S]**. Drives the repair-time distribution. |
| Equipment identity | APL / EIC / location tie the job to the mission tree **[S]**. |

## 3. How we believe the data is structured

The atomic record is the **OPNAV 4790/2K ("2-Kilo")** Ship's Maintenance Action Form **[S]**.

| Block | Content | Tag |
|---|---|---|
| 1 | Ship UIC (5 chars) | S |
| 2 | Work center (4 alphanumeric, left-justified) | S |
| 3 | Job sequence number (JSN, usually 4 digits), assigned by work center supervisor | S |
| 1-3 | Together = **JCN**. "From day one the job will always be identified by this combination." | S |
| 41 | Priority | S (values UNV) |
| 42 | Type Availability: `1` Depot, `2` IMA, `3` Fleet Technical Support, `4` Ship's Force | S |
| Remarks | Must include the CASREP DTG when the job documents a casualty | S |
| E | Original deferral signature: CO or authorized representative | S |
| G | Senior person in lead work center | S |
| H | Verifier | S |

- Equipment status code must match the configuration record (**APL / EIC / location**) **[S]** (JFMM).
- Companion forms **[S]**: 4790/2P accompanies IMA deferrals; 4790/CK records configuration changes.
- The **CSMP** (Current Ship's Maintenance Project) is the set of deferred/open 2-Kilos **[S]**.
- **Unverified code tables**: When Discovered, Status, Deferral Reason, Cause, Safety, Equipment Status, Priority values; EIC/APL formats **[UNV]**. Use the placeholder legends in 4.2 and mark them `placeholder`.
- MFOM maps 2-Kilo equipment status to scores: status `0`=1.0, `1`=0.8, `3`=0.6, `2`=0 **[S]** (MFOM patent, ~2012). We use this mapping (spec 09).

## 4. Mock file

### 4.1 `csmp.csv` **[PROP]**

Grain: one row per JCN (open, deferred or recently closed) per ship.

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `jcn` | str(13) | `99101CF010042` | = uic + work_center + jsn | S |
| `ship_id` | str | `KESSLER` | | PROP |
| `uic` | str(5) | `99101` | | S fmt / PH |
| `work_center` | str(4) | `CF01` | spec 01 4.3 | S len |
| `jsn` | str(4) | `0042` | sequential per WC | S |
| `eic` | str | `SPY1D-CW` | join to mission tree | PROP |
| `apl` | str | `APL-PH-000123` | | PH |
| `equipment_noun` | str | `PUMP, COOLING WATER, SPY-1D` | | PH |
| `location` | str | `01-120-0-E` | | UNV |
| `date_discovered` | date | `2026-11-04` | | S field |
| `when_discovered_code` | str | `C` | placeholder legend 4.2 | PH |
| `status_code` | str | `2` | equipment status 0-3 (MFOM mapping) | S (MFOM) / UNV (2K) |
| `job_state` | enum | `OPEN_AWAITING_PARTS` | `OPEN`, `OPEN_AWAITING_PARTS`, `DEFERRED`, `IN_WORK`, `COMPLETED`, `CANCELLED` | PROP |
| `deferral_reason_code` | str | `2` | placeholder legend 4.2 | PH |
| `date_deferred` | date | | empty unless DEFERRED | S field |
| `priority` | str | `1` | placeholder: 1 mission critical, 2 mission degrading, 3 routine | S field / PH values |
| `type_avail` | int | `3` | 1 Depot, 2 IMA, 3 FTS, 4 Ship's Force | S |
| `est_man_hours` | float | `16` | | S field |
| `casrep_dtg` | str | `041200Z NOV 26` | must match a CASREP when present | S rule |
| `casrep_id` | str | `DDG991-26-017` | our derived key | PROP |
| `req_doc_numbers` | str | `R991016308A001` | `;`-separated | UNV field name |
| `remarks` | str | `CASREP 041200Z NOV 26. AWAITING NIIN 019990001. FTS ASSIST REQ.` | free text; DTG must appear verbatim | S rule |
| `lead_wc` | str | `CF01` | Block G | S |
| `verifier` | str | `M-0002` | Block H | S |
| `co_deferral_signed` | bool | `false` | Block E | S |
| `system_of_record` | enum | `OMMS-NG` | `OMMS-NG`, `AWN`, `N-MRO` | PROP |
| `as_of` | datetime | `2026-11-04T06:00:00Z` | | PROP |
| `provenance` | str | `proposed` | | |

### 4.2 Placeholder code legends **[PH]**

All values below are invented and must be marked `placeholder` in the file.

- `when_discovered_code`: `A` during PMS, `B` during operation, `C` casualty, `D` inspection, `E` other.
- `deferral_reason_code`: `1` lack of parts, `2` lack of tech capability (needs outside help), `3` lack of time / operations, `4` awaiting availability, `5` other.
- `priority`: `1` mission critical, `2` mission degrading, `3` routine.

## 5. Generator rules

- Kessler ~60-90 open/deferred jobs, Varnell ~50-70, Ashby ~40 (realistic order of magnitude **[PROP]**).
- Every CASREP in `casreps.json` (except seeded X1) has exactly one JCN whose `remarks` contains the DTG verbatim and whose `casrep_dtg` matches.
- Jobs with `job_state = OPEN_AWAITING_PARTS` must have at least one `req_doc_numbers` entry that exists in `requisition_status.csv`.
- `type_avail` mix: mostly `4` (ship's force); CASREP jobs skew to `3` (FTS) and `2` (IMA) **[PROP]**.
- `system_of_record`: Kessler and Varnell `OMMS-NG`, Ashby `AWN` (shows the mixed fleet) **[PROP]**.

## 6. Demo scenario rows

- **Kessler `99101CF010042`**: SPY-1D cooling water pump, `status_code 2`, `OPEN_AWAITING_PARTS`, `type_avail 3`, `casrep_dtg 041200Z NOV 26`, `req_doc_numbers R991016308A001`, remarks cite the DTG and "FTS ASSIST REQ".
- Varnell: two jobs for the same ethernet switch NIIN, each with its own CASREP DTG (seeded **X2**).
- **X1:** Ashby has a CASREP (`DDG993-26-004`) whose DTG matches **no** JCN.
- **X7:** Kessler CIWS lost PMS (spec 01) has **no** 2-Kilo.

## 7. Open questions

- Real 2-Kilo code tables (NAVSEAINST 4790.8D, JFMM Vol VI Ch 19).
- EIC and APL formats.
- The real field that carries requisition numbers on a job.
- AWN record layout vs OMMS-NG.

## 8. Sources

GAO-24-106525; NAVSEA SERMC Capabilities Manuals (2022, 2023); tpub ET Fig 13-15; JFMM excerpt; tpub 14310 (2P); DON CIO CHIPS (NTCSS); GlobalSecurity/NNS 2010 (AWN/MFOM); MFOM patent US20120215734A1; HigherGov P-1 line 2611 (N-MRO). Links in both reports.
