# MissionTwin maintenance data specs (01 SKED/PMS, 02 OMMS-NG/2-Kilo/CSMP, 09 MFOM) — accuracy check against public sources, as of Nov 2026

Research date: 2026-11-04. Scope: every factual claim, field, code vocabulary, identifier format and process description in `data_sources/01_sked_pms.md`, `02_omms_ng_csmp.md`, `09_mfom_mission_tree.md`, plus the identifier rows in `00_README.md` sections 3-4 that these specs rely on.

**Method and access notes (read first).**
- **Main primary source obtained this session: NAVSEAINST 4790.8C, Ships' 3-M Manual, 14 Mar 2013, Distribution A** (586-page PDF with a text layer, mirrored on Wikimedia Commons). Text was extracted locally and searched. It contains the full periodicity code list, MIP/MRC numbering, the SKED 3.2 appendix (App. G), accomplishment-rating formulas, and the complete OPNAV 4790/2K block instructions and code tables (App. A and B). It is **[DATED: 2013]**. The current manual, NAVSEAINST 4790.8D (17 Jun 2021), and JFMM Rev D Chg 5 Vol VI were blocked (HTTP 403 from navsea.navy.mil, by both direct download and fetch). So "CONFIRMED" below usually means "confirmed in the 2013 manual". Whether 4790.8D or JFMM Vol VI Ch 19 changed a value could not be checked.
- **Second primary source: the GAO-24-106525 PDF** (9 Sep 2024), with its full text extracted locally.
- Other sources: Google Patents (MFOM), Breaking Defense, HigherGov renderings of the FY2027 P-1 and of contract records, and company press releases. Search-snippet-only items are marked (snippet).
- Labels used: **CONFIRMED**, **WRONG**, **OUTDATED**, **UNVERIFIABLE**. Some items get a qualifier such as "CONFIRMED (2013)" or "PARTLY WRONG".

Primary-source short names used below:
- **[3M-8C]** = [NAVSEAINST 4790.8C Ships' 3-M Manual, 14 Mar 2013 (PDF, Wikimedia mirror)](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf). Page numbers given as "PDF p. N".
- **[GAO-24]** = [GAO-24-106525 PDF, Sep 2024](https://www.gao.gov/assets/gao-24-106525.pdf), report pp. 44-46.
- **[MFOM-pat]** = [US20120215734A1, Google Patents](https://patents.google.com/patent/US20120215734A1/en).

---

## Q1. SKED version, governing instructions (4790.8D/E, 4790.4F/G), users, and Nov 2026 status (spec 01 §1)

### Takeaway
SKED 3.2 is still the latest version publicly documented. No 3.3 or 4.x was found. NAVSEAINST 4790.8D (17 Jun 2021) is still the current Ships' 3-M Manual; no 4790.8E was found. OPNAVINST 4790.4G (1 Aug 2024) has replaced 4790.4F. The spec's hedge "appears to have moved" can be firmed up. Its SKED user roles and the lost OMMS-NG/SKED interface can be upgraded to sourced, and the interface loss can be dated to 2011.

### Cited Findings
- **Spec: "SKED 3.2 is the latest public version (upgrade from 3.1). No later version found [S]."** **CONFIRMED.**
  - The 2013 manual already has an appendix "How to create and maintain PMS schedules using SKED 3.2". It says "The use of SKED Version 3.2 or higher for PMS Scheduling constitutes full compliance" — [3M-8C, App. G, PDF p. 428](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - A search for "SKED 3.3" found only SKED 3.2 material: Antech pages and job postings asking for SKED 3.2 experience — [Antech SKED](https://www.antechsystems.com/services/maintenance-management/sked/); [Antech performance solutions](https://www.antechsystems.com/?p=1171).
  - SKED is listed as a DON non-major IT investment, "Planned Maintenance System Scheduler" (ID 007-000001412). It "can interface with OMMS-NG, SOMS and other applications". The listing gives no version, budget or sunset — [HigherGov IT program](https://www.highergov.com/it-program/planned-maintenance-system-scheduler-16278).
- **Spec: "NAVSEAINST 4790.8D (3-M Manual, 17 Jun 2021), Appendix G reportedly covers SKED 3.2 [S-SNIP]."**
  - Date and currency: **CONFIRMED**. A search for 4790.8E found nothing newer. 4790.8D cancels 4790.8C, and it "primarily moves 'how to' requirements out of the policy instruction"; the JFMM (Vol VI Ch 19) is the implementing document (snippet) — [NAVSEA 4790.8D PDF](https://www.navsea.navy.mil/Portals/103/Documents/NAVINST/04790.008D.pdf).
  - "Appendix G covers SKED 3.2": **CONFIRMED for 4790.8C (2013)**; **UNVERIFIABLE for 8D**, which was blocked (403).
- **Spec: "OPNAV policy appears to have moved from 4790.4F to 4790.4G [S-SNIP]."** **CONFIRMED.**
  - OPNAVINST 4790.4G is dated 1 Aug 2024, issued by OPNAV N83, is a complete revision and cancels 4790.4F. This comes via a Scribd copy (secondary) — [Scribd 4790.4G (search summary)](https://www.scribd.com/document/845464690/4790-4G).
  - It is cited as a reference by a 2025 Navy Reserve instruction — [CNRFCINST 4790.1B](https://www.navyreserve.navy.mil/Portals/35/CNRFCINST%204790.1B%203M%20ASSESSMENT%20PROGRAM.pdf).
  - 4790.8D (2021) still cites 4790.4F, so the two are out of step (snippet).
- **JFMM currency (context for the specs' "JFMM Vol VI Ch 19" citations).** JFMM is COMUSFLTFORCOMINST 4790.3 **Rev D Change 5, promulgated 13 Jun 2025**. Advance Change Notice 02-26 (4 Apr 2026, Vol VI Ch 21) followed (snippets) — [NAVSEA SUBMEPP JFMM page](https://www.navsea.navy.mil/Home/SUBMEPP/Products/JFMM); [JFMM ACN 02-26](https://www.navsea.navy.mil/Portals/103/Documents/SUBMEPP/JFMM/JFMM_ACN_02-26_VI-21.pdf).
- **Spec users: "Work center supervisor / division officer chain: standard 3-M practice [UNV]."** **CONFIRMED (2013).** SKED 3.2 default roles are: "3-M System Coordinator; Department Head; Division Officer; Leading Chief Petty Officer (LCPO); Work Center Supervisor; Maintenance Personnel (designated as Crew Members in SKED fields); Administrator; Read-Only (for inspectors and observers)". The TYCOM may change the default roles — [3M-8C, App. G-2.2, PDF pp. 428-429](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Spec: "The OMMS-NG to SKED interface lost funding (GAO-24-106525) [S-SNIP]."** **CONFIRMED [S]; add the date.**
  - GAO-24: "Until about 2011, the Navy was able to use SKED to pass parts information to OMMS-NG and automatically order parts... competing priorities among resource managers eliminated funding for data-sharing features in 2011" — [GAO-24, p. 44](https://www.gao.gov/assets/gao-24-106525.pdf).
  - Conflict to note: the 2013 manual still says "SKED 3.2 communicates with third party applications such as [OMMS-NG], Micro-SNAP, [AWN], and [MRAS]" — [3M-8C, App. G-2.4(o), PDF p. 431](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Spec: "Antech says SKED, the PMS MIS and 3-M MDS are being merged into one application... no date [S]."** Not re-fetched this session. It was sourced in prior notes from [Antech, Future of the PMS](https://www.antechsystems.com/services/maintenance-management/future-of-the-planned-maintenance-system/). **UNVERIFIABLE for 2026 progress**: no dated milestone was found.

### Inferences
- Recommended edits to spec 01 §1:
  - "OPNAVINST 4790.4G (1 Aug 2024) superseded 4790.4F [S, secondary copy]; NAVSEAINST 4790.8D (17 Jun 2021) is current and still cites 4.4F; JFMM Rev D Chg 5 (13 Jun 2025) is the implementing manual."
  - Change the WCS/DIVO line from [UNV] to [S-DATED 2013], listing the eight default roles.
  - Change the interface line to "data-sharing funding eliminated in 2011 [S] (GAO-24-106525 p. 44)".
- "In use in Nov 2026" is plausible: there is a DON IT investment listing and current Antech postings, and no retirement notice was found. No 2026-dated primary source states it, though.

### Gaps
- The 4790.8D text could not be read (403). It is unknown whether 8D keeps App. G, the PAR formula and the 2K code tables unchanged, or moved them to JFMM Vol VI Ch 19 (also 403).
- No dated public milestone for the SKED + PMS MIS + 3-M MDS consolidation.

---

## Q2. The SKED 3.2 "no deferral / unperformed = lost" rule, status values, and the accomplishment-rate formula (spec 01 §2, §4.1 `status`, §5, §6, §7)

### Takeaway
The no-deferral rule is real. The spec's corollary, "unperformed checks count as lost", is **wrong**. In SKED 3.2 an unperformed weekly-or-longer check carries forward and raises a **PMS alert** at every weekly closeout while it stays out of periodicity. Only checks with a periodicity shorter than weekly, plus situational (R) checks, can be marked **Lost**. So the demo rows that mark an `M-1R` and a `Q-2` check as `LOST` misrepresent SKED 3.2. The spec's assumed formula `complete / scheduled` is the old SKED 3.1 RAR. SKED 3.2 computes PAR, SAR and SCAR.

### Cited Findings
- **Spec: "A 3-M Manual excerpt says PMS can no longer be deferred in SKED 3.2; unperformed checks count as lost [S-SNIP]."** **PARTLY WRONG.**
  - The first half is **CONFIRMED**: "In SKED 3.1, maintenance tasks that are not performed within periodicity are deferred and counted against accomplishment ratings once. In SKED 3.2, maintenance can no longer be deferred. Rather, when a maintenance task goes out of periodicity, a PMS alert will be generated when a weekly closeout is performed. In addition to an initial PMS alert, a new alert will be generated for every week that the maintenance remains out of periodicity. Each alert is counted against accomplishment ratings" — [3M-8C, App. G-2.4(d), PDF pp. 429-430](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - The "lost" half is **WRONG**. "Supervisors are not allowed to manually reschedule checks that are out of periodicity. If maintenance is not performed, the check is moved to the next week on the schedule when the Work Center is closed out for the week... the Work Center Supervisor shall provide a reason why maintenance was not performed on time" — [3M-8C, App. G-3(c)(3), PDF p. 432](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - The Division Officer or Department Head must acknowledge the alert and the reason — [3M-8C, App. G-8, PDF p. 438](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - "A check with a periodicity of less than weekly may be marked as lost. Checks scheduled to meet situational requirements may also be marked as lost or not applicable (NA)" — [3M-8C, App. G-22, PDF p. 456](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Status vocabulary.** SKED 3.2 check marks are "Mark Complete" and a check note "to identify why a maintenance task is marked **Lost, Not Applicable, or System**", plus PMS alerts for out-of-periodicity checks — [3M-8C, App. G-7(6),(10), PDF pp. 437-438](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - **Spec `status` enum `SCHEDULED, COMPLETE, LOST, IEM`:** COMPLETE and LOST are **CONFIRMED** as real states.
  - `IEM` as a check status **misrepresents** the process. IEM is an equipment-level period. During it, only IEM-periodicity checks (LU lay-up, PM periodic maintenance, SU start-up, OT operational test) are scheduled — [3M-8C, §2-4.5.d(3) and §2-10.4.1, PDF p. 58](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - `NA`, `SYSTEM` and a PMS-alert/out-of-periodicity state are missing.
- **Spec §6: "Kessler CF01, SPY-1D cooling MRC M-1R, week of 2026-10-26: LOST" and "X7: Kessler CF02, CIWS MRC Q-2, week of 2026-10-19: LOST".** **WRONG under SKED 3.2 rules.**
  - Monthly and quarterly checks cannot be marked Lost; they generate PMS alerts.
  - An M-1R that is overdue would also not be out of periodicity yet unless more than about 41 days have passed. The SKED date-range windows are "Monthly 21-41 days; Quarterly 61-121 days; Semiannual 121-243 days; Annual +/- 90 days" — [3M-8C, §2-4.5.d, PDF p. 58](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Accomplishment formula. Spec: "Accomplishment-rate formula (assumed `complete / scheduled`) [UNV]" (§7) and "draw 0.85-0.98; LOST rows are the remainder" (§5).** **OUTDATED** (that is the SKED 3.1 formula).
  - SKED 3.1: "RAR... (completed checks/scheduled checks) = RAR"; ACF = (evaluated - not accomplished)/evaluated; PPR = RAR x ACF — [3M-8C, App. F-20, PDF pp. 424-425](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - SKED 3.2: "Periodic Accomplishment Rating (PAR) measures the percentage of checks performed within periodicity... PAR formula is: **Completed Checks/(Total Checks + Lost Checks + PMS Alerts)**. Example: 25/(28+1+2) = 80% PAR".
  - "Situational Accomplishment Rating (SAR)... Completed Situational Checks/Total Non-NA Situational Checks".
  - "Spot Check Accomplishment Rating (SCAR)" is the third metric — [3M-8C, App. G-22, PDF p. 456](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - "Each Type Commander shall determine satisfactory scores." SKED 3.2 has an administrator-set "PAR pass/fail threshold" — [3M-8C, App. F-20 d and App. G-21, PDF pp. 425, 455](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Spec SKED 3.2 features: "equipment-based schedules, true interval scheduling, situational and metered triggers, IEM periods, scheduled spot checks with scores, fleet-wide feedback reports, forecast view [S]."** **CONFIRMED.**
  - "Weekly checks are performed every 7 days; monthly checks every 31 days; quarterly checks every 91 days" (true interval scheduling).
  - The 3MC schedules spot checks.
  - A Forecast display shows man-hours, tools, parts and test equipment — [3M-8C, App. G-2.4, G-3(c), PDF pp. 430-432](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).

### Inferences
- **Recommended corrections, spec 01:**
  - §2: replace with "In SKED 3.2 PMS cannot be deferred. An unperformed weekly-or-longer check rolls forward and raises a PMS alert at each weekly closeout while out of periodicity (WCS must give a reason; DIVO/DH acknowledges). Only sub-weekly (D/2D/3D) checks and situational (R) checks can be marked Lost (R checks also NA)."
  - §4.1 `status`: use `SCHEDULED, COMPLETE, LOST, NA, SYSTEM` [S-DATED].
  - Add `out_of_periodicity` (bool) and `pms_alert_count` (int, one per weekly closeout while overdue) [PROP shape, S concept].
  - Replace `status = IEM` with `iem_flag = true`, plus IEM-coded checks (`LU`, `PM`, `SU`, `OT`) scheduled during the IEM period.
  - §5/§7: compute `PAR = complete / (total + lost + pms_alerts)` and `SAR = complete_R / non_NA_R`; optionally SCAR. Draw the per-work-center PAR, or better, let it emerge from simulated outcomes.
  - §6 demo: make the SPY-1D cooling signal "M-1R out of periodicity, 2 PMS alerts" (last done more than 41 days before the closeout). Alternatively, use a sub-weekly check (e.g., `D-1` or `3D-1`) or an R check (e.g., `R-1` "prior to getting underway") marked LOST.
  - Same for X7: the CIWS `Q-2` should be "out of periodicity with PMS alerts" (more than 121 days since last done), not LOST. Or switch X7 to a LOST daily or situational check.
- For MissionTwin's "lost-PMS risk signal", PMS alerts (overdue weeks) are the realistic SKED 3.2 signal. LOST counts are a minor component.

### Gaps
- Not confirmed whether 4790.8D / JFMM Rev D Chg 5 changed the PAR/SAR/SCAR formulas or the "less than weekly may be lost" rule since 2013.
- The SCAR formula text was truncated in the extraction and is not reproduced here.
- The SKED 3.2 meaning of "System" as a check mark is not defined in the text read.

---

## Q3. PMS documents, form numbers, periodicity codes, MIP/MRC numbering, Force Revision (spec 01 §3, §4.1, §4.2, §5)

### Takeaway
The document hierarchy and the `M-1R` pattern are right, and the MIP example `4411/001-B6` matches the real RCM MIP format.
- The periodicity table needs fixing. `C` (cycle) is **not** an authorized code; in the 2013 manual a trailing "C" means *Confidential*. Several real codes are missing: 2D, 3D, 2M, 4M, 8M, 9M, xM, AP, and the IEM codes LU/PM/SU/OT.
- SKED 3.2 **eliminated** the weekly, quarterly and cycle schedules and replaced EGLs with Maintenance Items and Maintenance Groups. The paper-form framing (4790/14, /15, /81) is therefore outdated for SKED 3.2.
- The TGL description in the spec is wrong.

### Cited Findings
- **Periodicity table. Spec: "Full table [UNV]: D daily, W weekly, 2W biweekly, M monthly, Q quarterly, S semiannual, A annual, 18M-36M multi-year, C cycle, R situational, U unscheduled."** Corrected from the source:
  - "The only authorized periodicities are as follows":
    - **Calendar:** D Daily; 2D every 2 days; 3D every 3 days; W Weekly; 2W every 2 weeks; M Monthly; 2M every 2 months; Q Quarterly; 4M every 4 months; S Semi-annually; 8M every 8 months; 9M every 9 months; A Annually; "xM Every x months" (the SKED range table also lists 3W).
    - **Non-calendar:** "R Situational Requirement; U Unscheduled Maintenance; AP Assessment Procedure".
    - **IEM:** "LU Lay-Up; PM Periodic Maintenance; SU Start-Up; OT Operational Test" — [3M-8C, §2-4.5.d, PDF pp. 57-58](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - D, W, 2W, M, Q, S, A, R, U: **CONFIRMED**. "18M-36M": **CONFIRMED** as instances of xM. An aviation PMS training text also lists 18M, 24M, 30M, 36M and shows scheduling notation such as `18M-1(6)` (sixth quarter after overhaul) (snippet, dated) — [tpub NAVEDTRA 14310 Table 7-1](https://navyaviation.tpub.com/14310/css/Table-7-1-Periodicity-Codes-251.htm); [Table 7-2](https://navyaviation.tpub.com/14310/css/Table-7-2-Multiple-Month-Periodicity-Scheduling-Table-259.htm).
  - **`C` cycle: WRONG / OUTDATED.** It is not in the authorized list. In the MIP code field, "'C' appended to code denotes Confidential classification. 'S' appended to code denotes Secret classification" — [3M-8C, §2-4.4, PDF p. 54](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf). (A "C = once per overhaul cycle" code may have existed in pre-2000s manuals; not verified.)
  - Trailing symbols: `*` = Safety of Ship; `+` = performed by off-ship personnel; `++` = either; `#` = mandatory related maintenance (e.g., "M-3#") — [3M-8C, §2-4.4(10),(13), PDF pp. 55-56](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **MRC code pattern. Spec: "M-1R: Monthly or every 600 hours... pattern `<periodicity>-<sequence><R?>`, with R meaning calendar plus situational [S] (aviation TGL)."** **CONFIRMED**, now in the Ships' 3-M Manual itself.
  - "(M-1R): Monthly or every 600 operating hours, whichever occurs first"; "(W-3R): Weekly or after each use"; "(S-1R): Semiannually or during each upkeep period"; "(Q-1R): Quarterly or prior to getting underway".
  - Pure situational codes put R first: "(R-1W): When a situation occurs, accomplish weekly".
  - Numbering: "numbered consecutively, e.g., 'D-1', 'D-2'... or 'M-1', 'M-2'"; non-sequential numbers (W-1, W-2, W-3, W-6) can occur when an existing MRC is reapplied — [3M-8C, §2-4.5.d(4),(6),(7), PDF pp. 59-61](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - The spec's regex `<periodicity>-<n><R?>` misses the `R-<n><periodicity>` form (e.g., `R-1W`) and multi-character periodicities (`2W-1`, `18M-2R`).
- **MRC Control Number (not in spec).** "The SYSCOM MRC Control Number is a 7 character alphanumeric code": 2 characters of month/year (1-9 = Jan-Sep, A-C = Oct-Dec, then the last digit of the year), a 4-character Library Control Number, and a final Y/N/U (parts required / not required / unscheduled) — [3M-8C, §2-4.4(8), PDF pp. 54-55](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **MIP number. Spec `mip` = `4411/001-B6` [UNV shape].** **CONFIRMED** as a valid RCM-style MIP.
  - "For MIPs developed using the RCM analysis concept a three-segment code is used. The first segment contains four alphanumeric characters followed by a slash... based on the [ESWBS] number. The second segment... three characters followed by a dash (-). The third segment contains two characters which identify the month and year". `B6` = November 2016.
  - Conventional MIPs use 4 segments (e.g., `EL-10/001-xx`); Surface Missile System MIPs use 7 characters/3 characters-2 characters — [3M-8C, §2-4.4(1), PDF pp. 51-53](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **LOEP. Spec: "LOEP (List of Effective Pages, PMS 5 report)... Report date, force revision number, TYCOM, hull, UIC, work center, MIP numbers, equipment description [S]."** **CONFIRMED**, but the field list is incomplete. The LOEP (Report PMS 5) contains: "(1) Report Date (2) FR Number (3) TYCOM (4) Act. Id (Ship's hull number...) (5) UIC (6) Work Center (7) Name of Ship (8) Changes (denoted by an A or a C) (9) MIP Number (10) MRS tracking number (11) NMR tracking number (12) Nomenclature (13) RIC (APL/AEL)" — [3M-8C, §2-4.4.a, PDF pp. 50-51](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf). SKED 3.2 has a LOEP functional area — [3M-8C, App. G-2.4(m)](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Forms. Spec: MIP OPNAV 4790/85, EGL 4790/81, TGL 4790/107, Quarterly 4790/14, Weekly 4790/15, FBR 4790/7B.**
  - Form numbers: **CONFIRMED [DATED]** from Navy training manuals (paper era) — [tpub FC vol 1](https://www.tpub.com/fcv1/8.htm); the 2013 manual refers to these documents by name, not form number.
  - **For SKED 3.2 the weekly, quarterly and cycle schedules and EGLs are OUTDATED.** "This appendix highlights the major changes in policy dictated by the use of SKED 3.2, such as the elimination of weekly, quarterly, and cycle schedules." "SKED 3.1 uses Equipment Guide Lists (EGLs); SKED 3.2 organizes equipment using Maintenance Items and Maintenance Groups." "The weekly and quarterly schedules of SKED 3.1 have been replaced with the Schedule display... The cycle schedule... replaced with the Review display" — [3M-8C, App. G-2, G-2.4(b),(f),(g), PDF pp. 428-430](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - The MRC location block reads "EGL (SKED 3.1), maintenance group (SKED 3.2)" — [3M-8C, §2-4.5.e, PDF p. 62](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - **TGL description, spec: "Situational/tag-driven checks": WRONG.** The Tag Guide List lists the equipment and components that must be tagged out (safety tag-out) to perform an MRC. It is not a list of situational checks — [tpub FC vol 1](https://www.tpub.com/fcv1/8.htm) (dated; per prior session notes). Situational checks are R-coded MRCs with state, trigger and metered events — [3M-8C, §2-4.5.d(6), PDF pp. 59-60](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **MRC content. Spec: "Who (rate), what, when, how, with what resources [S]."** **CONFIRMED**: MRCs describe "who, what, how, and with what resources" — [3M-8C, §2-4.5, PDF p. 57](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - `man_hours` is "The average time, per equipment, per person... not including time for tool preparation and return, tag out" — [3M-8C, §2-4.4(12)](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - The Rates field can carry a count ("for example, 2ETs").
  - The WCS assigns crew members to tasks in SKED 3.2 — [3M-8C, App. G-7(5)](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - Spec `rate`, `min_skill_level` and `assigned_to`: **CONFIRMED** in concept.
- **Force Revision. Spec `force_rev` = `1-27`, rule `<quarter>-<yy>` [UNV].** **Format CONFIRMED; the rule wording is slightly off.** "The FR number... will identify each FR in the calendar year. For example, the first package issued in calendar year 2000 was assigned the number 1-00" — [3M-8C, §2-7, PDF p. 83](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf). It is a sequence within the calendar year, not formally a quarter. Four FRs per year — [Antech Tailored Force Revisions](https://www.antechsystems.com/services/maintenance-management/tailored-force-revisions/).
  - **The value `1-27` is UNVERIFIABLE and probably anachronistic** for an extract dated 2026-11-04: it is the first FR of calendar 2027, and no source shows when FR 1-27 is distributed.
- **Spec §5: "Most rows are D, W or M periodicity; Q, S, A cluster in specific weeks [S-SNIP]."** **OUTDATED for SKED 3.2.** The clustering reflects the SKED 3.1 or paper quarterly schedule. SKED 3.2 uses "true interval scheduling" from the last scheduled instance (W = 7 days, M = 31, Q = 91) — [3M-8C, App. G-3(c), PDF pp. 431-432](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Spec §5: "R checks fire when the schedule (spec 13) has an underway event that week."** **CONFIRMED** in concept. State events ("at sea"/"in port"), triggers ("getting underway", "entering port") and metered events exist, with offsets such as "96 hours prior to getting underway" — [3M-8C, §2-4.5.d(6), PDF pp. 59-61](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Spec: "GAO found MRCs 'sometimes inaccurate with respect to the time and personnel needed' [S]."** **CONFIRMED.** Recs 3 and 4 (on maintenance cards) are still open, with August 2025 updates — [GAO-24-106525 product page](https://www.gao.gov/products/gao-24-106525).

### Inferences
- **Recommended corrections, spec 01 §3/§4:**
  - Periodicity table: replace it with the 2013 authorized list. Drop `C`. Add 2D, 3D, 3W, 2M, 4M, 8M, 9M, xM (e.g., 18M, 24M, 30M, 36M), AP, and the IEM codes LU/PM/SU/OT. Note the `*`, `+`, `++` and `#` suffixes.
  - Change the `mrc` regex to `^(?:(?:\d{1,2})?[DWMQSA]-\d+R?|R-\d+(?:\d{0,2}[DWMQSA])?|U-\d+|(?:LU|PM|SU|OT)-\d+)$` (or simply document both forms `M-1R` and `R-1W`).
  - Rename `mrc` to `mrc_code`. Optionally add `mrc_control_no` (7 characters: date code + 4-character library number + Y/N/U).
  - Mark `mip` shape as [S-DATED] (RCM format).
  - Rename `egl_location` to `maint_item_location`, and add `maintenance_group` (SKED 3.2 terms). Keep EGL only as a legacy alias.
  - Fix the TGL row to "list of components to tag out to perform the MRC". Note that 4790/14 and /15 are paper/SKED 3.1 artifacts; SKED 3.2 uses the Schedule, Review and Forecast displays.
  - `force_rev`: describe it as `<n>-<yy>`, the nth FR of the calendar year. Use `4-26` or `3-26` for a Nov 2026 extract unless the team confirms that 1-27 has been issued.
  - LOEP (§4.2): add `changes_flag` (A/C), `ric_apl_ael`, `ship_name` and `act_id`.
  - §5 generator: schedule from `last_done + interval_days` (W 7, M 31, Q 91, S ~182, A ~365). Flag out of periodicity using the 2013 windows (M 21-41 d, 2M 41-83, Q 61-121, 4M 83-165, S 121-243, 8M 165-331, 9M/A/multi-month ±90 d).

### Gaps
- No public Ships' 3-M source in this session gave a current (2021+) periodicity list. If 4790.8D or JFMM added codes, they are not reflected here.
- The TGL definition rests on a dated tpub manual from earlier notes; tpub subdomains failed TLS this session.

---

## Q4. OPNAV 4790/2K block structure, JCN, and the real code tables (spec 02 §3, §4.1, §4.2; README JCN row)

### Takeaway
The JCN definition, Block 41 = Priority, Block 42 = Type Availability 1-4, and Block E = CO deferral signature are all correct. The real code tables are public (2013 manual) and differ from the spec's placeholder legends in **format** (When Discovered is numeric 0-9, not letters A-E) and in **meaning** (Deferral Reason codes 0-9 and Priority codes 1-4 mean different things). Since the real tables are public, the placeholders should be replaced. Other fixes:
- `equipment_noun` is limited to 16 characters on the 2K.
- Block G is a signature, so it cannot hold a work center code.
- The Block 7 Status codes 0-3 are now sourced from the 2K itself, which validates the MFOM mapping.

### Cited Findings
- **JCN. Spec: "JCN = UIC(5) + WC(4) + JSN(4) = 13 chars [S]"; Blocks 1-3; "From day one the job will always be identified by this combination."** **CONFIRMED.**
  - "The JCN is comprised of three blocks. Block 1 is the ship's Unit Identification Number (UIC) (5 numeric characters), Block 2 is the Work Center (WC)... and Block 3 is the Job Sequence Number (JSN)." "All activities involved continue to use the same JCN on all maintenance and supply documents" — [3M-8C, App. A "JOB CONTROL NUMBER", PDF p. 278](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - JSN: "A 4-character number assigned by the Work Center... sequentially from the Ship's Work Candidate/Job Sequence Number (JSN) Log. The first position of the JSN is used to identify the tool or organization that created the 2K... activities other than the ship creating jobs for the ship, this first character will be an 'Alpha' character" — [3M-8C, App. A "JOB SEQUENCE NUMBER", PDF p. 278](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - The example `99101CF010042` is a valid shape.
- **Block 2. Spec: "Work center (4 alphanumeric, left-justified)."** **CONFIRMED**, with a nuance. "For ships, a four-position Work Center code will be entered. For repair departments of tenders, SIMAs, RMCs, and other IMAs, a three-digit code... entered left-to-right leaving the right most position blank" — [3M-8C, App. B Block 2, PDF p. 317](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Block 41. Spec: "Priority — S (values UNV)"; placeholder legend "`1` mission critical, `2` mission degrading, `3` routine".** **The legend is WRONG.**
  - Real codes: "1 Mandatory; 2 Essential; 3 Highly Desirable; 4 Desirable" — [3M-8C, App. B Block 41, PDF p. 325](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - App. A definitions: 1 MANDATORY = "Critical safety or damage control item. Required for performance of ship's mission..."; 2 ESSENTIAL = "Required for sustained performance of ship's mission..."; 3 HIGHLY DESIRABLE = "Required for efficient performance..."; 4 DESIRABLE = "Some contribution to efficient performance..." — [3M-8C, App. A "PRIORITY", PDF pp. 283-284](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - "Every work candidate starts with a priority of four (4)"; a flow chart raises it — [3M-8C, App. A, PDF p. 284](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Block 42. Spec: "Type Availability: 1 Depot, 2 IMA, 3 Fleet Technical Support, 4 Ship's Force [S]."** **CONFIRMED.**
  - "1 Depot (shipyard or ship repair facility); 2 Intermediate Maintenance Activity (tender, repair ship, etc.); 3 Fleet Technical Support. TYCOM Support Unit... or technical assistance from NAVSEACOMBATSYSENGSTA or Regional Maintenance Centers or contractor representative; 4 Ship's Force (Orig. Work Center, Organizational Level)" — [3M-8C, App. B Block 42, PDF pp. 325-326](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - App. A adds OMMS-NG display labels ("Depot", "Fleet Repair Center"/"Regional Repair Center", "Fleet Technical Support", "Originating Work Center"/"Organizational Level"). It appears to split Ship's Force into "4" and "A" rows (garbled in extraction) — [3M-8C, App. A "TYPE OF AVAILABILITY", PDF p. 299](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Block 6 When Discovered. Spec placeholder: "`A` during PMS, `B` during operation, `C` casualty, `D` inspection, `E` other".** **WRONG format and vocabulary.**
  - Real codes are one numeric digit: "1 Lighting Off or Starting; 2 Normal Operation; 3 During Operability Test; 4 During Inspection; 5 Shifting Operational Modes; 6 During PMS; 7 Securing; 8 During AEC (Assessment of Equipment) Program; 9 No Failure, PMS Accomplishment Only; 0 Not Applicable" — [3M-8C, App. B Block 6, PDF pp. 317-318](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - There is no "casualty" When Discovered code.
  - Alpha when-discovered codes belong to aviation (NAMP "DISCD"), not Ships' 3-M (snippet) — [tpub DISCD](https://navyaviation.tpub.com/14292/css/Discd-When-Discovered-Code-98.htm).
- **Block 7 Status. Spec `status_code` "equipment status 0-3 (MFOM mapping) — S (MFOM) / UNV (2K)".** **CONFIRMED from the 2K.** "Block 7 - STATUS (STA): ...effect of the failure or malfunction on the operational performance capability of the equipment **when the need for maintenance was first discovered**. 1 Operational; 2 Non-Operational; 3 Reduced Capability; 0 Not Applicable" — [3M-8C, App. B Block 7, PDF p. 318](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - Caveat: it is a status-at-discovery field, not a live equipment state.
- **Block 8 Cause (missing from spec).** "1 Abnormal Environment; 2 Manufacturer/Installation Defects; 3 Lack of Knowledge or Skill; 4 Communications Problem; 5 Inadequate Instruction/Procedure; 6 Inadequate Design; 7 Normal Wear and Tear; 0 Other or No Malfunction" — [3M-8C, App. B Block 8, PDF pp. 318-319](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Block 9 Deferral Reason. Spec placeholder: "`1` lack of parts, `2` lack of tech capability, `3` lack of time / operations, `4` awaiting availability, `5` other".** **WRONG meanings (numeric format OK).**
  - Real codes: "1 Due to Ship's Force Work Backlog/Operational Priority; 2 Lack of Material; 3 No Formal Training on this equipment; 4 Formal Training Inadequate for this Equipment; 5 Inadequate School Practical Training; 6 Lack of Facilities/Capabilities; 7 Not Authorized for Ship's Force Accomplishment; 8 For Ship's Force Overhaul of Availability Work List; 9 Lack of Technical Documentation; 0 Other – or Not Applicable" — [3M-8C, App. B Block 9, PDF p. 319](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - The manual adds: "The remarks should not include statements explaining what has been coded in another place of the form; i.e., 'DEFERRAL REASON 2 = LACK OF MATERIAL'" — [3M-8C, App. B Block 35, PDF p. 324](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Block 15 Safety Hazard (spec lists "Safety" as an unverified table).** "1 Critical... Correct Immediately; 2 Serious... Suspension of Equipment/System/Space Use is Required; 3 Moderate... Waiver... Pending Correction; 4 Minor; 5 Negligible; 0 Not Safety Related". Codes 6-9 are TYCOM-assignable — [3M-8C, App. B Block 15, PDF pp. 320-321](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Other 2K blocks relevant to `csmp.csv` (2013 numbering):**
  - Block 4 APL/AEL
  - Block 5 Equipment Noun Name, "limited to 16 positions"; AN designations are substituted for electronics
  - Block 13 Ident/serial number
  - Block 14 EIC
  - Block 16 Location ("compartment number, deck, frame, or side notation")
  - Block 17 When Discovered Date (Julian)
  - Block 25 S/F man-hours expended
  - Block 26 Deferral date (Julian, e.g., "4011" for 11 Jan 1994)
  - Block 27 S/F man-hours remaining
  - Block 28 Deadline date
  - Block 35 Remarks ("what is wrong... XXX... what must be done")
  - Block 37 CSMP Summary
  - Block 43 Integrated priority
  - Blocks C/D DIVO and DH initials
  - Block E CO signature
  - Block F TYCOM authorization
  - Source: [3M-8C, App. B §B-3.7, PDF pp. 316-326](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Block E. Spec: "Original deferral signature: CO or authorized representative [S]."** **CONFIRMED**, but it is conditional: "Required on all deferrals for outside assistance" — [3M-8C, App. B Block E, PDF p. 326](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Blocks G and H. Spec: "G Senior person in lead work center"; "H Verifier"; csv `lead_wc` = `CF01` mapped to "Block G"; `verifier` = `M-0002` mapped to "Block H".**
  - G/H meaning: **CONFIRMED in substance.** App. A "COMPLETED BY (ENTERED ON 2K): The signature and rate of the senior person actively engaged in the job at the lead Work Center" — [3M-8C, PDF pp. 258-259](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf). "Block H - ACCEPTED BY: The signature and rank or rate of the individual authorized by the tended ship to verify the acceptability of work performed. Completion of this block is mandatory when a 2K is used to report completion of a previously deferred maintenance action" — [3M-8C, App. B, PDF p. 337](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - **The `lead_wc` → Block G mapping is WRONG.** Block G holds a person's signature and rate, not a work center code. Lead and assist work centers are separate data elements (IMA lead work center: "A 3- or 4-character code") — [3M-8C, App. A, PDF pp. 255, 269](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Companion forms. Spec: "4790/2P accompanies IMA deferrals; 4790/CK records configuration changes [S]."** **CONFIRMED.** The manual has chapters for the OPNAV 4790/CK (Configuration Change Form), 4790/2L (Supplemental Form) and 4790/2P (Maintenance Planning and Estimating Form) — [3M-8C, TOC App. B, PDF pp. 16-17](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **CSMP. Spec: "The CSMP is the set of deferred/open 2-Kilos [S]."** **CONFIRMED** in substance. Block 37 "CSMP SUMMARY... displayed on management reports". CSMP reports are "sequenced by ship, Work Center, type availability, and JSN" — [3M-8C, App. B Block 37, PDF p. 324; Ch. 4 CSMP reports, PDF pp. 127-128](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Spec: "Equipment status code must match the configuration record (APL / EIC / location) [S] (JFMM)."** **CONFIRMED (snippet)** — [JFMM excerpt mirror](https://v.vibdoc.com/comusfltforcominst-479055419.html). The JFMM text read was only a snippet; whether "Equipment Status Code" there is the same field as Block 7 STA was not established.

### Inferences
- **Recommended corrections, spec 02 §3/§4:**
  - Block table: Priority values [S-DATED] = 1 Mandatory, 2 Essential, 3 Highly Desirable, 4 Desirable. Add Block 6 WND, Block 7 STA, Block 8 CAS, Block 9 DFR, Block 15 Safety, Block 4 APL, Block 5 noun (16 characters max), Block 14 EIC, Block 16 location, Block 17/26 Julian dates, Block 37 CSMP summary.
  - Replace the §4.2 placeholder legends with the real public tables above, tagged [S-DATED 2013] rather than [PH]:
    - `when_discovered_code` becomes numeric 0-9. The demo pump failure found while running would be `2` (Normal Operation); found during PMS would be `6`.
    - `deferral_reason_code` 0-9. The demo job awaiting parts and FTS fits `2` (Lack of Material), or `6` (Lack of Facilities/Capabilities) for the tech-assist component.
    - `priority` 1-4. The demo job stays `1` (Mandatory).
  - Add optional `cause_code` (0-7) and `safety_code` (0-5).
  - `status_code`: re-tag as [S] (2K Block 7). Document that it is status at discovery.
  - `equipment_noun`: cap at 16 characters. `PUMP, COOLING WATER, SPY-1D` (27 characters) violates the form; use e.g. `PUMP CW SPY-1D` (14).
  - `lead_wc`: re-tag as [PROP] (or "IMA lead work center", App. A), not Block G. Add `completed_by` (Block G, member_id) if needed. Keep `verifier`, but call it "accepted_by (Block H)".
  - `co_deferral_signed`: rule = must be `true` when the job is deferred for outside assistance (`type_avail` 1-3).
  - Optionally carry Julian `yddd` copies of dates (README's `6308` convention matches the 2K Julian practice).

### Gaps
- Whether 4790.8D / JFMM Rev D Chg 5 renumbered blocks or changed any code table after 2013 is unknown (403).
- OMMS-NG/AWN on-screen field names (vs paper block numbers) are not public.

---

## Q5. The "CASREP DTG must appear in 2-Kilo remarks" rule and the CSMP-CASREP-parts join (spec 02 §2, §4.1, §5; README §6)

### Takeaway
The rule is real but rests on a NAVSEA regional maintenance center manual (SERMC Capabilities Manual 2022/2023), seen only as a search snippet. The 2013 3-M Manual separately lists a **"CASREP DATE TIME GROUP"** 2K data element and says CASREP information "will be documented in the work candidate." So a structured DTG field likely exists alongside remarks; the spec's claim that remarks are "the only documented machine-joinable CASREP link" overstates the case. The JCN-to-supply-documents link is sourced.

### Cited Findings
- **Spec: "The 2-Kilo for a casualty must carry the CASREP DTG in its remarks [S]."** **CONFIRMED (snippet).** SERMC Capabilities Manual text: when a 2K is "written to document a casualty report (CASREP), include the CASREP date-time group" (snippet) — [SERMC Capabilities Manual 8 Feb 2023](https://www.navsea.navy.mil/Portals/103/Documents/SERMC/Capabilities%20Manual%208FEB2023.pdf); [22 Apr 2022 edition](https://www.navsea.navy.mil/Portals/103/Documents/SERMC/Capabilities%20Manual%2022APR2022.pdf). The PDF itself returned 403. The snippet does not say explicitly that the DTG goes in "remarks" (Block 35); prior notes inferred that.
- The 3-M Manual's App. A data-element list includes "CASREP DATE TIME GROUP" (definition text not extracted) — [3M-8C, App. A, PDF p. 257](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf). The priority flow chart repeats "IF OPERATIONAL REPORTING IS REQUIRED, CASREP INFORMATION WILL BE DOCUMENTED IN THE WORK CANDIDATE" — [3M-8C, App. A, PDF pp. 285-287](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- JCN as the parts link: "It is important that all activities involved continue to use the same JCN on all maintenance and supply documents" — [3M-8C, App. A, PDF p. 278](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf). The spec's `req_doc_numbers` field name stays [UNV]; the join direction is sourced.
- UPDATE/CORRECT/CANCEL CASREPs reference the DTG of the initial CASREP (snippet) — [NETCINST 3040.1A](https://www.netc.navy.mil/Portals/46/NETC/inst/30401A.pdf). This supports the DTG as the stable key.

### Inferences
- Keep the generator rule (DTG verbatim in remarks). Change spec 02 §2 wording from "the only documented machine-joinable CASREP link" to "the 2K carries the CASREP DTG (SERMC manual; 3-M Manual data element 'CASREP DATE TIME GROUP'); field placement in OMMS-NG/AWN not public." Keep `casrep_dtg` as its own column, which the data element supports.
- Re-tag README §6 "[S]" to "[S-SNIP]" for the remarks placement.

### Gaps
- SERMC manual full text not read (403). The exact OMMS-NG/AWN field for the CASREP DTG is unknown.

---

## Q6. OMMS-NG vs AWN vs N-MRO in Nov 2026; NTCSS sunset (spec 02 §1, `system_of_record`)

### Takeaway
- The OMMS-NG/AWN facts are now confirmed from the GAO PDF text: in use since 2001, AWN partially replaced it, and West Coast ships stayed on OMMS-NG.
- The April 2025 SECNAV cancellation of the Lockheed Martin N-MRO agreement is confirmed. The FY2027 P-1 says N-MRO requests no FY2027 procurement.
- "N-MRO restarts with a commercial pilot" is **not confirmed as worded**. What is documented is the DIU/Navy LOG IT "NextMRO" commercial prize challenge, with winners announced June 2026.
- No public NTCSS sunset date was found. NTCSS is still receiving afloat upgrades in FY2027 and moving to CANES hosting.

### Cited Findings
- **Spec: "OMMS-NG... used since 2001 'to document and report shipboard material deficiencies' [S-SNIP]."** **CONFIRMED [S].** "In 2001, the Navy began to use one software application, the [OMMS-NG] to document and report shipboard material deficiencies" — [GAO-24, p. 44](https://www.gao.gov/assets/gao-24-106525.pdf).
- **Spec: "AWN... has replaced OMMS-NG on some ships [S]. Some ships, largely West Coast, still ran OMMS-NG in 2024 [S-SNIP]."** **CONFIRMED [S].** "Just as the Navy stopped funding the interface between OMMS-NG and SKED, the Navy began to deploy an application to replace OMMS-NG (known as Automated Work Notification)... the Navy did not deploy the Automated Work Notification system to all ships. As a result, some ships (largely on the West Coast) continue to use OMMS-NG, while others use the Automated Work Notification system." Sailors said "OMMS or Automated Work Notification systems sometimes drop work orders" — [GAO-24, p. 44](https://www.gao.gov/assets/gao-24-106525.pdf).
- **N-MRO before cancellation (context).** "In 2020, the Navy combined ongoing efforts into the N-MRO program." It was planned for all activities by FY2026, then re-planned (as of March 2024) for "Navy-wide by the end of fiscal year 2030". Deployment to "a single test ship" slipped from July 2023 to February 2024 — [GAO-24, pp. 44-45](https://www.gao.gov/assets/gao-24-106525.pdf).
  - GAO Rec 7 (communicate N-MRO information) is still open: "As of November 2025, the Navy has not taken actions" — [GAO product page](https://www.gao.gov/products/gao-24-106525).
- **Spec: "N-MRO: the Lockheed Martin agreement was cancelled by SECNAV memo in April 2025."** **CONFIRMED.**
  - Breaking Defense, 25 Apr 2025: SECNAV Phelan's memo ordered "termination of all contracts under the NMRO logistics program"; "for 5 years systems integrators have over-engineered the software to the point where it is unusable"; Navy CIO to produce "a new acquisition strategy and a management review for NMRO by July 31" — [Breaking Defense](https://breakingdefense.com/2025/04/navy-secretary-axes-contracts-for-fleet-maintenance-software-dei-climate-in-300m-purge/).
  - Also reported by [DefenseScoop, 25 Apr 2025](https://defensescoop.com/2025/04/25/navy-terminates-it-contracts-grants-phelan-doge-hegseth/) (snippet).
  - The FY2027 P-1 (as rendered by HigherGov, line 2611): the acquisition approach changed after "an April 2025 Secretary of the Navy memorandum [that] directed cancellation of N-MRO's Other Transaction Authority agreement with Lockheed Martin"; "Neither N-MRO equipment line requests FY 2027 procurement; both show procurement resuming in later years" — [HigherGov NTCSS P-1 line 2611](https://highergov.com/budget/naval-tactical-command-support-system-ntcss-cecc987) (secondary rendering of the budget exhibit).
- **Spec: "N-MRO restarts with a commercial pilot [secondary, FY2027 budget rendering]."** **UNVERIFIABLE as worded.** The P-1 rendering fetched this session mentions no "commercial pilot". What is documented:
  - DIU, with the Navy's Logistics IT (LOG IT) Program Office, ran "Project NextMRO" to find commercial replacements for "antiquated logistics structures". Winners were announced 10 Jun 2026: 1st Appian, 2nd Game Plan Tech, 3rd Fathom5, with $5.5M total in prizes. Fathom5 describes "moving from a prize challenge to building the Navy's NextMRO platform" — [Fathom5, 10 Jun 2026](https://www.fathom5.com/news/fathom5-takes-home-diu-nextmro-prize-challenge); [DIU on X](https://x.com/DIU_x/status/2062232348368769278) (snippet).
  - DIU launched the challenge around September 2025 (snippet) — [Inside Defense](https://insidedefense.com/daily-news/diu-launches-challenge-search-integration-capable-navy-mro-solutions).
  - A June 2026 $249.9M multiple-award IDIQ (62 firms) for naval MRO/supply chain IT modernization was reported (snippet only, not verified) — [envzone](https://envzone.com/award-record/navy-awards-249-9m-multiple-award-idiq-for-naval-maintenance-it-systems/).
- **NTCSS sunset.** **No public sunset date found.**
  - FY2027 P-1 line 2611 (NTCSS, OPN BA 02): FY2025 $27.2M actual; FY2026 $15.9M enacted; FY2027 $10.1M requested; FY2028-31 forecasts rise to $22.3M.
  - "FY 2027 plans include 35 NTCSS afloat equipment upgrades, compared with 37 in FY 2026."
  - "NTCSS continues its transition to a Consolidated Afloat Networks and Enterprise Services (CANES)-hosted environment."
  - NOSS "is intended to replace legacy ashore supply applications, including NTCSS Relational Supply", with "initial deployment of Minimum Viable Commercial Release 1 in FY 2027"
  - Source: [HigherGov NTCSS P-1](https://highergov.com/budget/naval-tactical-command-support-system-ntcss-cecc987).
- **Spec: "Shore. OMMS-NG data feeds the 3-M Maintenance Data System (MDS) ashore [DATED]."** **UNVERIFIABLE** this session (no new source). Ships' 3-M is described as the "database of record for all maintenance-related execution data" (snippet, prior notes) — [NAVSEA NUWC Keyport NSLC](https://www.navsea.navy.mil/Home/Warfare-Centers/NUWC-Keyport/NSLC/Products-Services/Maintenance-Planning/).
- **Spec: "Contractor postings describe data entered and closed 'in OMMS-NG, R-Supply reports, and Microsoft Excel worksheets' [S]."** Not re-checked; sourced in prior notes — [Military Spouse Jobs posting](https://militaryspouse.dejobs.org/jacksonville-fl/process-control-analyst-us-navy-omms-ng/1DEC57136032487E84E27C90DFE25E91/job).

### Inferences
- **Recommended edits, spec 02 §1:**
  - Upgrade the OMMS-NG 2001 and West Coast claims to [S] with GAO-24 p. 44.
  - Rewrite the N-MRO bullet: "N-MRO's Lockheed Martin OTA agreement was cancelled by an April 2025 SECNAV memo [S]; FY2027 budget requests no N-MRO procurement, resuming later [S, secondary rendering]; DIU/LOG IT NextMRO commercial prize challenge named winners in June 2026 [S, vendor + DIU]; no fielded successor confirmed as of Nov 2026."
  - Drop "restarts with a commercial pilot" unless the team can cite the budget text.
- `system_of_record` enum: keeping `N-MRO` is fine as a value. A DDG CSMP in Nov 2026 realistically sits in OMMS-NG or AWN, so the generator rule (Kessler/Varnell OMMS-NG, Ashby AWN) is realistic. Do not assign N-MRO to any demo ship.
- NTCSS: state "no public sunset date; still funded and being upgraded afloat in FY2026-27 (CANES hosting)".

### Gaps
- **GAO-25-106990** (named in the brief) could not be identified. No search result matched that number, so it is not used here.
- No 2026 primary Navy statement on OMMS-NG/AWN fleet counts.
- Full FY2027 OPN P-40 text was not read directly (only HigherGov's rendering).

---

## Q7. Work center code convention and shared identifiers in README §3-4 (UIC, WC, JCN, Julian)

### Takeaway
The README's UIC (5 characters) and JCN (13 characters) are confirmed. The work center "code style" is now sourced: department letter + division letter + 2-digit work center. That makes `CF01`, `CE01`, `EA01` and `EE01` structurally right. Some specific division letters (`ER01` for main propulsion, `OD01` for navigation) are not verifiable and may mislead.

### Cited Findings
- **README: "UIC | 5 chars | [S] format."** **CONFIRMED**, and more precisely: on the 2K, "5 numeric characters" — [3M-8C, App. A JCN, PDF p. 278](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf). For boats without their own UIC, use the parent's UIC — [3M-8C, App. A "UIC", PDF p. 299](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf). `99101` is valid in form.
- **README / spec 01 §4.3: "Work center | 4 alphanumeric | CF01 | [S] length, [UNV] code style".** Code style **CONFIRMED**: "Ships use a 4-position Work Center code. The first two positions identify the Department and Division. The last two positions identify the Division Work Center." IMAs use 3-position codes (e.g., "10A", "67A") — [3M-8C, App. A "WORK CENTER", PDF pp. 300-301](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **README: "JCN | UIC(5) + WC(4) + JSN(4) = 13 chars | 99101CF010042 | [S]."** **CONFIRMED** (see Q4).
- **README: "4 Nov 2026 = day 308, so YDDD = 6308."** **CONFIRMED** by arithmetic (2026 is not a leap year: 304 days through 31 Oct, plus 4). The 2K uses Julian dates (e.g., deferral date "4011" for 11 Jan 1994) — [3M-8C, App. B Block 26, PDF p. 323](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).

### Inferences
- Spec 01 §4.3 work center table: re-tag "code style" as [S-DATED].
  - `CF01`, `CF02`, `CE01` (Combat Systems: F = fire control, E = electronics) and `EA01`, `EE01` (Engineering: A = auxiliaries, E = electrical) follow the pattern.
  - `ER01` for "main propulsion" is risky. On many ships "R" conventionally denotes the Repair (damage control) division; a main-propulsion code would carry that division's letter (e.g., MP division). This is general knowledge **[UNV]**, so flag it rather than assert it.
  - `OD01` for navigation is likewise **[UNV]**: navigation often sits in a Navigation department or division, not "Operations-D".
  - Mark these assignments [PH], as the spec already does. Consider swapping `ER01` to a neutral, unambiguous placeholder.

### Gaps
- No public source in this session gave the actual DDG-51 department/division letter assignments.

---

## Q8. Accuracy of the MFOM patent description (spec 09 §1, §3.1 scoring; spec 02 status map)

### Takeaway
The patent description is largely accurate: 0-1 scores, weighted average, a modified average when a child is critical, the status map 0=1.0/1=0.8/3=0.6/2=0, "3M and CASREPs are the only direct feeds", the Time Accelerator, and DRRS-N bands 80-100 green, 60-79 yellow, 0-59 red. Corrections needed:
- The patent is an **abandoned application**, not a granted patent; filed 2011, published 2012.
- The hierarchy has more levels than the spec lists.
- The status map is explicitly "interim logic" from 2K Block 7.
- The spec's "cap at 0.59" critical-child rule is MissionTwin's own invention, not the patent's. It must not carry the "sourced" provenance.

### Cited Findings
- **Bibliographic (spec says "patent (US20120215734A1, ~2012) [S]").** **CONFIRMED with correction.** "Maintenance figure of merit system and method for obtaining material condition of ships"; inventors Jarratt M. Mowery, Randy D. Bennett, Rick Leeker, Charles W. Chesterman Jr.; application US13/030,158 filed 2011-02-18; published 2012-08-23; **legal status: Abandoned** (Google's assumption) — [MFOM-pat](https://patents.google.com/patent/US20120215734A1/en).
- **Spec hierarchy: "warfare mission → Navy Tasks → functional area → system → component → part".** **CONFIRMED, simplified.** The patent: "War Fighting/Mission/Naval Tasking, Functional Area, System, Sub-System, Component, Sub-Component, Lower Sub-Component, Part and Piece." Objects are grouped into parent/child "families" that are vertical, horizontal or operationally linked — [MFOM-pat](https://patents.google.com/patent/US20120215734A1/en).
- **Spec: "Equipment scored 0.0-1.0. Parents roll up by weighted average, or a modified average when a 'critical' child exists."** **CONFIRMED.**
  - "A dimensionless number from 0.0 to 1.0." Simple weighted average applies when all children are non-critical. "If at least one Child is critical—modified weighted average is used": the lowest-scoring child's EOC is combined with its own weight and the other children's weighted scores.
  - Warfare areas use a simple average, NTAs a simple weighted average — [MFOM-pat](https://patents.google.com/patent/US20120215734A1/en).
  - **Spec §3.1 field rule: "if a critical child scores 0, the parent is capped (we cap at 0.59, i.e. red) [PROP]."** It is correctly tagged PROP in the field rules. But the JSON `"provenance": "sourced (MFOM patent ~2012)"` on the `scoring` block covers `rollup: weighted_average_with_critical_child`, which in MissionTwin includes the cap. That **misrepresents** the patent: the patent's method is a modified weighted average with no cap.
- **Spec: "'The Ship's 3M System and CASREPS are the only reporting systems that directly feed' equipment status into MFOM."** **CONFIRMED**: "Currently the Ship's 3M System and CASREPS are the only reporting systems that directly feed" EOC data with configuration information — [MFOM-pat](https://patents.google.com/patent/US20120215734A1/en).
- **Spec: "2-Kilo equipment status maps to scores: status 0 = 1.0, 1 = 0.8, 3 = 0.6, 2 = 0."** **CONFIRMED.** The patent ties this to OPNAV 4790/2K Block 7 (STA) as interim logic: "ACTION: Use 1=0.8; 2=0; 3=0.6; and 0=1.0 for EOC values" — [MFOM-pat](https://patents.google.com/patent/US20120215734A1/en).
  - It is consistent with the 2K codes 1 Operational / 2 Non-Operational / 3 Reduced Capability / 0 N/A — [3M-8C, App. B Block 7](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
- **Spec: "A 'Time Accelerator' weights repairs by weeks to the next deployment."** **CONFIRMED**: "The Time Accelerator is a unit value in weeks until ship is deploying on next mission." RMC MFOM = MFOMp × TA — [MFOM-pat](https://patents.google.com/patent/US20120215734A1/en).
- **Spec: "Sends 0-100 warfare-area indices to DRRS, banded 80-100 green, 60-79 yellow, 0-59 red."** **CONFIRMED**: DRRS-N requires "an integer 0≦x≦100 and color (red, yellow, or green)"; "The integers 80-100 are indicated in green"; "60-79 are reflected in yellow"; red is "(0-59)" — [MFOM-pat](https://patents.google.com/patent/US20120215734A1/en).
  - Spec 09 §3.1 uses `"bands": {"green": 0.80, "amber": 0.60}`. The thresholds are right; the patent says **yellow**, not amber.

### Inferences
- **Recommended edits, spec 09:**
  - Cite as "US patent application 2012/0215734 A1 (filed Feb 2011, published Aug 2012, abandoned)".
  - List the full hierarchy, and note that MissionTwin collapses Sub-System/Sub-Component/Lower Sub-Component/Piece.
  - In the JSON, split provenance: `status_score_map` and `bands` = sourced; `rollup` = "proposed (patent uses modified weighted average with lowest critical child; MissionTwin adds 0.59 cap)".
  - Rename `amber` to `yellow`, or note the equivalence.
  - Note that Block 7 STA is status at discovery, and that the patent calls the map "interim".
  - In spec 02 §3, change "(MFOM patent, ~2012)" to "(MFOM patent application, 2011/2012, abandoned)".
- Mapping nuance for the engine: "Operational" scores 0.8 rather than 1.0 because an open 2K exists against the equipment. Equipment with no open job is implicitly 1.0.

### Gaps
- The last ~9k characters of the patent page were not read (the fetch truncated at 100k). The exact modified-weighted-average formula text was paraphrased by the fetch tool, not quoted verbatim.
- Whether current MFOM still uses these constants is unknown (no public post-2012 algorithm document found).

---

## Q9. Is MFOM still in use in 2026, and who runs it? (spec 09 §1 "Program")

### Takeaway
MFOM is active in 2026. NIWC Atlantic funds MFOM test, operations and support through an Engineering Services Network (ESN) delivery order running to at least July 2027, and posted a FY2026 market survey for MFOM system and software engineering support. VSolvit's "MFOM recompete" dates from March 2022. The spec's present-tense "VSolvit holds the MFOM recompete" is therefore **outdated or incomplete**.

### Cited Findings
- **Spec: "VSolvit holds the MFOM recompete supporting NIWC Atlantic [S]."** **OUTDATED / incomplete.**
  - VSolvit's post "VSolvit Awarded MFOM Recompete Contract" is dated **5 Mar 2022** (~$75M, via a linked source; NIWC Atlantic) — [VSolvit](https://vsolvit.com/vsolvit-awarded-mfom-recompete-contract/). An earlier [2018 VSolvit MFOM contract](https://vsolvit.com/2018-vsolvit-mfom-contract/) page also exists.
  - **Delivery order N6523624F3026 to Engineering Services Network (ESN)** under N0017819D7599: "Maintenance Figure of Merit (MFOM) test, operations and support". Up to $35,570,747. Awarding office NIWC Atlantic (N65236). Period of performance **2 Jul 2024 - 1 Jul 2027** (potential to 1 Jul 2029) — [HigherGov contract record](https://highergov.com/contract/N0017819D7599-N6523624F3026).
  - ESN describes the same award as "MFOM Family of Applications Maintenance Support": a five-year (base + 4 options) follow-on for NIWC Atlantic's Enterprise Systems Department, work primarily in Norfolk — [ESN press release](https://esncc.com/about-us/news/navy-awards-esn-inc-356m-contract-maintenance-figure-merit-mfom-family-applications).
  - A NIWC market survey for "Maintenance Figure of Merit (MFOM) System and Software Engineering Support", solicitation **N65236-26-RFPREQ-LSUBP00095** (FY26 numbering), restricted to SeaPort-NxG holders (snippet; posting date not confirmed) — [G2X notice](https://g2xchange.com/app/opportunities/sam/bf7aaa6f-12f4-4241-86b5-71ce9bf623de).
- **Spec: "IOC October 2007 [DATED]."** **UNVERIFIABLE** this session (no source found or re-fetched).
- **Spec: "AWN (the OMMS-NG replacement) is MFOM's shipboard segment [DATED]."** **UNVERIFIABLE now** (the GlobalSecurity/NNS 2010 page returned 403). It is consistent with: the 2013 3-M Manual naming AWN and MRAS as SKED 3.2 partner applications — [3M-8C, App. G-2.4(o)](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf); and GAO-24 describing AWN as the OMMS-NG replacement on some ships — [GAO-24, p. 44](https://www.gao.gov/assets/gao-24-106525.pdf).

### Inferences
- **Recommended edit, spec 09 §1 Program:** "MFOM remains active in 2026 under NIWC Atlantic. ESN holds the MFOM test, operations and support order (Jul 2024 - Jul 2027) [S]. VSolvit won an MFOM support recompete in Mar 2022 [S]. NIWC issued an FY26 market survey for MFOM system and software engineering support [S-SNIP]. Current scoring constants are not public."
- With N-MRO's OTA cancelled (Q6), MFOM/AWN remain the operative readiness-roll-up path for surface ships in 2026. This is an inference from the funding evidence, not a stated fact.

### Gaps
- No public 2025-2026 description of MFOM functions, user base or DRRS-N interface.
- The award date and awardee of the FY26 MFOM SSE solicitation were not found.

---

## Q10. Real EIC and APL formats, so placeholders can mimic them (spec 01 `eic`, spec 02 `eic`/`apl`, spec 09 `eic`)

### Takeaway
A real **EIC is a 7-character hierarchical code** (system, subsystem, equipment category, then 3 characters of detail). A real **APL is a 9-character number** (example "882170236"). The spec's `SPY1D`, `SPY1D-CW`, `SPY1D-ARR`, `CIWS` and `APL-PH-000123` do not match these formats, so they should be changed or moved to a separate human-readable key.

### Cited Findings
- **EIC.** "EQUIPMENT IDENTIFICATION CODE (EIC) (ENTERED ON 2K AND CK): A 7-character code that identifies the equipment. The first position identifies the system; the first and second characters together identify the subsystem; the third and fourth together identify the equipment category in that system. The remaining three digits provide greater definition... Where the EIC is known to more than four digits, it should be recorded at that level. EICs are listed in the SCLSIS Index Report or Ships' 3-M Reference CD-ROM/DVD." An item identifiable only to the subsystem is reported as the subsystem "followed by two zeros". The example given is "QD" for transceivers-communications. Identifiable only to the system: "system identification, followed by three zeros" — [3M-8C, App. A "EIC", PDF p. 263](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - **Spec `eic` values `SPY1D`, `SPY1D-CW`, `SPY1D-ARR`, `CIWS`: WRONG format**: variable length, a hyphen, and not hierarchical by position. The spec does tag them PROP and "real EIC format UNV", but they misrepresent the real length and structure.
- **APL/AEL.** "Block 4 - APL/AEL: Enter the APL/AEL of the equipment being reported. These numbers are found in the COSAL or SCLSIS Index Report. An example of an APL would be '882170236' and an AEL would be '2-260034096'" — [3M-8C, App. B Block 4, PDF p. 317](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf).
  - **Spec `apl` = `APL-PH-000123` [PH]: WRONG format** (13 characters with letters and hyphens versus a 9-character APL).
- **Equipment noun (related).** Block 5 is "limited to 16 positions"; AN designations are substituted for electronics — [3M-8C, App. B Block 5, PDF p. 317](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf). See Q4.

### Inferences
- **Recommended placeholders:**
  - Keep a readable `system_key` (e.g., `SPY1D-CW`) as the MissionTwin join key [PROP].
  - Add a real-format `eic`: 7 characters, letter-first, positionally hierarchical, with trailing zeros where known only to the system or subsystem. For example, use a parent system `X?00000`-style and child `X?1A000`-style pair, with a parent/child relationship visible in the leading characters, and tag them [PH].
  - Avoid inventing values that collide with real EIC tables (not public); pick an unusual first letter and mark `placeholder`.
  - APL: a 9-digit numeric placeholder with an implausible prefix (e.g., `999000123`), tagged [PH].
  - `equipment_noun` ≤ 16 characters.
- Update spec 09 §4: "Every `eic` referenced... must exist in the tree" should apply to `system_key`, with `eic` carried as an attribute. Otherwise the 7-character format forces tree keys to change.

### Gaps
- The real EIC system/subsystem letter assignments (SCLSIS Index / 3-M Reference DVD) are not public, so a "realistic" first letter for radar or combat systems cannot be chosen from sources.
- Whether APLs can contain letters was not established (the only example found is all-numeric).
