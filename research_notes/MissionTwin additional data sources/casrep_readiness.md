# CASREPs and the Navy Readiness Reporting Systems They Feed (MissionTwin research notes, as of 2026-11-04)

Scope note: SKED, OMMS-NG and R-ADM were covered in earlier research and are only cross-referenced here. That research also noted that 2-Kilos must cite the CASREP date-time group (DTG). Every source below is unclassified and public. Many primary documents are hard to reach: the Sabre Systems DRRS training site (elearning.sabresystems.com) did not resolve during this session, and the NETC CASREP instruction returned HTTP 403. Some facts therefore come from search-result snippets of those documents or from older training manuals (tpub.com, 1990s NWP 10-1-10 era). Those facts are flagged **[DATED]** or **[SNIPPET-ONLY]**.

## Q1: CASREP message format, categories, fields, generation and storage

### Takeaway
A CASREP is a serialized, set-based message (MSGID, REF, POSIT, CASUALTY, EQUIP, ESTIMATE, ASSIST, parts, AMPN, RMKS) with four report types: INITIAL, UPDATE, CORRECT (CASCOR) and CANCEL (CASCAN). It is filed for mission-essential equipment that can't be fixed within 48 hours. Categories 2, 3 and 4 run from minor degradation to loss of a primary mission, and category 1 is not used. Public sources describe the categories and set names, but not the current NTTP 1-03.1 field-by-field layout.

### Cited Findings
- **Definition:** a casualty is an equipment malfunction or deficiency that can't be corrected within 48 hours and reduces the command's ability to perform its mission. NETCINST 3040.1A (2021) cites NWP 1-03.1 for this. [SNIPPET-ONLY: the PDF returned 403] — [NETC 3040.1A](https://www.netc.navy.mil/Portals/46/NETC/inst/30401A.pdf); also [tpub ET training manual, DATED](https://electronicstechnician.tpub.com/14085/css/The-Casrep-System-96.htm)
- **Report types:** INITIAL, UPDATE, CORRECT and CANCEL. One training source names them "initial (CASREP), update (CASREP with a serial number change), correction (CASCOR), and cancellation (CASCAN)." — [tpub gunners 277, DATED](https://www.tpub.com/gunners/277.htm); [tpub search snippet for CASCOR/CASCAN, DATED](https://www.tpub.com/fcv1/2.htm)
- **DTG references:** UPDATE, CORRECT and CANCEL messages must carry a reference line giving the DTG of the INITIAL CASREP. This is current 2021 NETC policy, consistent with the earlier note that 2-Kilos cite the CASREP DTG. — [NETC 3040.1A, SNIPPET-ONLY](https://www.netc.navy.mil/Portals/46/NETC/inst/30401A.pdf); [tpub gunners 277](https://www.tpub.com/gunners/277.htm)
- **Message structure and serialization:**
  - A CASREP is "one or more data sets" after a standard header (precedence, addressees, classification).
  - The MSGID set "appears immediately after the message classification line."
  - Serial numbers run "sequentially from 1 through 999" for each unit.
  - The DTG of transmission is the CASREP's "as of" time.
  - CASREPs go out even under MINIMIZE.
  - Source: [tpub gunners 277, DATED, NWP 10-1-10 era](https://www.tpub.com/gunners/277.htm)
- **Casualty categories:**
  - Categories 2, 3 and 4 reflect "operational urgency or priority," and category 1 is not used.
  - The category "should never be worse than a mission area M-rating reported through UNITREP" for the primary missions affected. Today the equivalent is the DRRS-N or SORTS rating.
  - Casualties that affect only secondary missions are capped at category 2.
  - Sources: [tpub gunners 276, DATED](https://www.tpub.com/gunners/276.htm); [tpub ET casualty categories, DATED](https://electronicstechnician.tpub.com/14084/css/Casualty-Categories-97.htm)
- **Category criteria (from a study-aid flashcard set, not a directive):**
  - **C4:** mission-essential deficiency worse than C3 that causes loss of at least one primary mission.
  - **C3:** major degradation of a primary mission, short of loss.
  - **C2:** minor degradation of a primary mission, or major degradation or loss of a secondary mission.
  - Source: [Brainscape CASREP flashcards, UNVERIFIED secondary](https://www.brainscape.com/flashcards/casualty-reports-928807/packs/1647312)
- **What each set is for:**
  - ESTIMATE reports the estimated completion date of repairs (the ETR) and factors that may affect the repair schedule.
  - ASSIST says whether the unit needs outside help.
  - AMPN is conditional amplifying text. For example, an AMPN must follow the ESTIMATE set to report receipt of parts previously reported as needed.
  - An UPDATE reports only new or changed information, except that the CASUALTY and ESTIMATE sets are always included.
  - Sources: [tpub search snippets, DATED](https://www.tpub.com/gunners/275.htm); [tpub ET Update CASREP, DATED](https://electronicstechnician.tpub.com/14085/css/Update-Casrep-99.htm)
- **INITIAL rules:**
  - One casualty per INITIAL.
  - An INITIAL is also sent when only outside assistance is needed and no parts are required.
  - When parts or assistance are needed, RMKS gives scheduling information for "a full 30-day period" starting on the earliest date the unit can receive them.
  - Only one outstanding CASREP may exist for each equipment item. New faults on the same item go in an UPDATE.
  - Source: [tpub gunners 275, DATED](https://www.tpub.com/gunners/275.htm)
- **UPDATE triggers:** a new repair date, a significant change in parts status, added assistance needs, extra malfunctions on the same equipment, all ordered parts received, or receipt of a significant part. — [tpub gunners 275, DATED](https://www.tpub.com/gunners/275.htm)
- **CANCEL / CASCOR content:**
  - Final parts status: all parts requested and the dates received.
  - Delay "expressed in hours" caused by supply-system parts unavailability.
  - Man-hours expended.
  - If the casualty was deferred to an availability, the scheduled availability with its location and date, in an AMPN immediately after the CASUALTY set.
  - Source: [tpub gunners 276, DATED](https://www.tpub.com/gunners/276.htm)
- **Ashore flow and storage:**
  - Older Navy training material says CASREPs go to the CNO, fleet commanders and the Ships Parts Control Center. They were "automatically entered into the Navy status of forces database at each FLTCINC site."
  - Central collection, processing and ADP coding happened at the Fleet Material Support Office in Mechanicsburg.
  - Source: [tpub/NAVEDTRA search snippets, DATED, likely 1990s](https://navyaviation.tpub.com/14310/css/Initial-Casualty-Report-Initial-285.htm)
- **Supply side (NAVSUP):**
  - CASREPs are "high visibility, high priority requisitions." NAVSUP Weapon Systems Support (WSS) holds CASREP review sessions and escalates as needed.
  - Example (April 2024): seven CASREPs on one ship were all caused by a single part.
  - Older material shows DAAS "CASREP requisition" messages, meaning parts requisitions are tied to the CASREP.
  - Sources: [DVIDS NAVSUP WSS 2024](https://www.dvidshub.net/news/469139/navsup-wss-resolves-seven-casreps-single-part-single-ship); [tpub DAAS CASREP requisition figure, DATED](https://navyadministration.tpub.com/14241/css/Figure-5-9-Daas-Casrep-Requisition-Message-112.htm)
- **Data ownership and classification:**
  - U.S. Fleet Forces Command and U.S. Pacific Fleet own CASREP data. GAO pulled it from the Maintenance Figure of Merit (MFOM) program.
  - Individual-ship CASREPs are classified when they reveal warfighting capability. Data rolled up above ship level is unclassified.
  - CASREP reports can be filed as often as every 72 hours. They track individual degraded or out-of-commission equipment, not capability areas.
  - Source: [GAO-12-887 text](https://www.gao.gov/assets/650/648722.txt)
- **Subjectivity:**
  - GAO found reporting is inconsistent across ships because of leadership philosophy, crew experience and inspection frequency.
  - The MFOM patent calls CASREP data "subjective in nature because of vague criteria."
  - Sources: [GAO-12-887](https://www.gao.gov/assets/650/648722.txt); [MFOM patent US20120215734A1](https://patents.google.com/patent/US20120215734A1/en)
- **MFOM ingestion:** the patent states that "the Ship's 3M System and CASREPS are the only reporting systems that directly feed" equipment operational capability (EOC) data into MFOM. — [MFOM patent](https://patents.google.com/patent/US20120215734A1/en)

### Inferences
- In practice, CASREPs today are drafted shipboard and sent as formatted record messages. Ashore they are ingested by fleet or TYCOM systems: MFOM, NAVSUP WSS CASREP tracking, and the DRRS-N equipment pillar. MFOM is the most likely "Navy CASREP database" a hackathon team would hear about. I found no public source naming the current shipboard CASREP drafting tool.
- For a synthetic generator, the parameters that matter are:
  - category (2, 3 or 4)
  - equipment and its mission areas
  - ETR in the ESTIMATE set, with revisions in UPDATEs
  - whether outside assistance is needed (ASSIST)
  - parts with requisition status
  - INITIAL to UPDATE to CASCOR or CASCAN lifecycle, with serial numbers and DTG references
  - supply-delay hours at closure (useful as a label for training a delay model)

### Gaps
- I could not read the current NTTP 1-03.1 (or NWP 1-03.1) CASREP chapter or the authoritative category table (Table 13-2 in the older manual is an image). Exact current set names, field order and PARTS-set layout are unverified.
- I found no reliable public source for the INITIAL submission deadline. "Within 24 hours" is commonly cited but UNVERIFIED.
- I found no current public name for the shipboard CASREP generation software, the R-Supply linkage, or the current ashore database of record. NAVSUP P-485 was not checked.

## Q2: DRRS-N (what it holds, NMETs, Y/Q/N, PESTO, CASREP feeds, 2026 status)

### Takeaway
DRRS-N is the Navy's capabilities-based readiness system of record. It rates Navy mission-essential tasks (NMETs) Yes, Qualified Yes or No, and shows the PESTO resource pillars. CASREP category directly caps MET ratings and SORTS equipment C-levels. DRRS-N reports monthly, or within 24 hours of a significant change. Overarching DoD DRRS is still in place in 2026 and is being modernized, not replaced. I found no public evidence of a DRRS-N replacement.

### Cited Findings
- **System of record:**
  - DRRS-N replaced SORTSREPNV and the TYCOM readiness management system as the Navy's program of record for readiness reporting.
  - It provides the mechanism to report Navy unit data to DRRS-S (the DoD enterprise DRRS-Strategic) and to GSORTS.
  - Source: [OPNAVINST 3501.360A, SNIPPET-ONLY](https://elearning.sabresystems.com/drrsS/instructions/OPNAVINST%203501.360A.pdf); [archived OPNAVINST 3501.360, DATED 2013 snapshot](https://webarchive.library.unt.edu/web/20130214013851/http://doni.daps.dla.mil/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.360.pdf)
- **What it shows and the governing manual:**
  - The manual is NTRP 1-03.5, DRRS-N Reporting Manual (Feb 2016 edition).
  - DRRS-N shows whether an organization can perform its NMETs.
  - It tracks resource availability across Personnel, Equipment, Supply, Training and Ordnance (PESTO), plus facilities for shore units.
  - Source: [NTRP 1-03.5 (2016), SNIPPET-ONLY](https://elearning.sabresystems.com/drrsS/instructions/NTRP%201-03.5%20DRRS-N%20REPORTING%20MANUAL%20EDITION%20FEBRUARY%202016.pdf)
- **Commander pushback (2011):** a Fleet Forces post complained that the display emphasized PESTO data the unit commander could not change. [DATED] — [USFF blog 2011](https://usfleetforces.blogspot.com/2011/07/drrs-n-update.html)
- **Rating scale and roll-up:**
  - A MET is a task with conditions and standards. METs and Cores are rated Yes, Qualified Yes or No.
  - Roll-up rule: when less than 51% of METs are Y and the rest are Q, the Core cannot be rated above Q.
  - Source: [DRRS-S CVN SORTS brief, Jan 2023, SNIPPET-ONLY](https://elearning.sabresystems.com/drrsS/presentations/DRRS-S%20CVN%20SORTS_01Jan2023.pdf)
- **CASREP linkage (carrier brief; surface-force rules may differ):**
  - A **Category 4 CASREP** forces the associated MET to N (red) and drops the SORTS equipment category to C-3 or lower.
  - A **Category 3 CASREP** forces the MET to Q or lower and the equipment category to C-2 or lower.
  - Source: [DRRS-S CVN SORTS brief 2023, SNIPPET-ONLY](https://elearning.sabresystems.com/drrsS/presentations/DRRS-S%20CVN%20SORTS_01Jan2023.pdf)
- **Auto-calculated C-levels:** a USFF message titled "Auto Calculated C Levels" (R 221217Z JAN 21) exists. This suggests resource C-levels are now auto-computed from feeder data. Only the title was seen; contents are unverified. — [USFF msg title](https://elearning.sabresystems.com/drrsS/instructions/USFF_Auto%20Calculated%20C%20Levels_R%20221217Z%20JAN%2021.pdf)
- **Fleet instruction:** COMUSFLTFORCOMINST 3501.6 (June 2020) is the fleet readiness reporting instruction. — [USFFINST 3501.6, SNIPPET-ONLY](https://elearning.sabresystems.com/drrsS/instructions/USFFINST%203501_6%2014June2020.pdf)
- **Cadence and classification:** DRRS-N is reported monthly or within 24 hours of a significant change, and its data are classified. — [GAO-12-887](https://www.gao.gov/assets/650/648722.txt)
- **MFOM feed:** MFOM provides "near real-time material-based readiness reporting" to DRRS-N.
  - MFOM sends NTA and warfare-area index values (integer 0-100) to DRRS-N, color-banded 80-100 green, 60-79 yellow, 0-59 red.
  - Sources: [search snippet of Navy press item](https://www.navy.mil/Press-Office/Press-Releases/display-pressreleases/Article/2237938/swrmc-supports-boxer-amphibious-ready-group-deployment); [MFOM patent](https://patents.google.com/patent/US20120215734A1/en)
- **DoD DRRS status in 2026:**
  - DoD uses DRRS to meet 10 U.S.C. §117. The system includes "service-specific systems." DRRS data feed the Semi-annual Readiness Report to Congress and the Joint Force Readiness Review.
  - Source: [CRS IF12240, updated 2026-09-22](https://www.everycrsreport.com/reports/IF12240.html)
- **DoD policy:** DoDD 7730.65 (May 2023) assigns USD(P&R) responsibility for DRRS "operation, modernization, and interoperability." A December 2024 DoD instruction update tasks ASD(Readiness) with continued modernization. — [DoDD 7730.65](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodd/773065p.pdf); [ExecutiveGov Dec 2024](https://executivegov.com/2024/12/dod-updated-defense-readiness-reporting-guidance/)
- **FY25-FY26 budget:** DRRS will "continue integrating new data sources and developing additional functionality." — [HigherGov budget summary](https://www.highergov.com/budget/defense-readiness-reporting-system-drrs-7289dbe)
- **Readiness Decision Impact Model:** described as a DoD tool that uses data to show how senior-level decisions, such as a deployment, affect units, combatant commands and modernization. It is separate from DRRS, not a replacement. Article date and current status are UNVERIFIED. — [ExecutiveGov](https://www.executivegov.com/?p=196774)
- **Development home:** DRRS-N software development was contracted under NIWC Pacific (2015 presolicitation). [DATED] — [HigherGov N66001-15-R-0240](https://highergov.com/contract-opportunity/j-defense-readiness-reporting-system-navy-dr-n66001-15-r-0240-p-58a7e)

### Inferences
- What a CO or commodore already sees in DRRS-N is the current state: Y/Q/N per NMET, PESTO pillars and C-levels, with CASREPs mechanically capping those ratings. MissionTwin should present itself as a forward look. It would project the Y/Q/N status of each NMET at future dates, given open CASREP ETRs, parts delays, maintenance plans and qual expirations. It should not duplicate the current-state view.
- The category 3/4 to MET Q/N mapping is a defensible synthetic rule for MissionTwin. Label it as based on a carrier DRRS-S brief.

### Gaps
- NTRP 1-03.5 full text and the current NMET lists for a DDG were not accessible. The public premise that "DRRS-S" is being replaced appears to be a misunderstanding: DRRS-S is the DoD enterprise layer. I found no 2025-2026 source on a DRRS-N replacement.
- No 2026 status of the Readiness Decision Impact Model was found.

## Q3: Readiness metrics and tools (MFOM, TFOM, SFOM/OFOM, INSURV, Readiness Kill Chain, Advana/Jupiter, ROC/POE)

### Takeaway
MFOM is the material-readiness engine. It scores a hierarchy running from mission area down to part on a 0.0-1.0 scale, with CASREPs and 3M as its only direct equipment-status inputs, and pushes scores to DRRS-N. INSURV gives a 4-5 year inspection snapshot. ROC/POE documents define each class's primary and secondary mission areas and the required capabilities by readiness condition, which is the authoritative mission-to-capability spine. Advana-hosted dashboards (Jupiter, NAVSUP) exist. I found no public definition of a "Navy Readiness Kill Chain."

### Cited Findings
- **MFOM hierarchy:** "War Fighting/Mission/Naval Tasking, Functional Area, System, Sub-System, Component, Sub-Component, Lower Sub-Component, Part and Piece." Mission area sits on top with Navy Tasks (NTAs) below it. Families are Vertical, Horizontal or Operationally Linked. — [MFOM patent](https://patents.google.com/patent/US20120215734A1/en)
- **MFOM scoring:**
  - Index values are dimensionless, from 0.0 to 1.0 (1 = "Fully Operable", 0 = "Totally Inoperative", with 0.8, 0.6, 0.4 and 0.2 as intermediate levels).
  - Roll-up uses a weighted average, or a modified weighted average when a "critical" child exists. Criticality asks whether the parent can operate without the child.
  - Warfare-area scores use a simple average "as required by DRRS-N."
  - Weights are set by subject-matter experts.
  - A "Time Accelerator" equals weeks until the ship deploys on its next mission and is used to prioritize repairs.
  - The OPNAV 4790/2K (2-Kilo) status block maps to equipment operational capability (EOC): status 1 = 0.8, 2 = 0, 3 = 0.6, 0 = 1.0.
  - Source: [MFOM patent](https://patents.google.com/patent/US20120215734A1/en)
- **History, owner and contracts:**
  - MFOM reached initial operating capability on 1 October 2007 (USFFC briefing). [DATED] — [USFFC materiel condition metric model](https://webarchive.library.unt.edu/eot2008/20090109150418/http:/www.acq.osd.mil/log/mpp/uid/USFFC_ship_materiel_condition_metrice_model.pdf)
  - CACI (2015) said MFOM lets the Navy analyze how maintenance tasks affect mission readiness and prioritize them. — [CACI 2015](https://www.defence-industries.com/news/caci-awarded-task-order-contract-to-provide-modeling-and-analysis-support-for-us-navy)
  - VSolvit holds the MFOM recompete contract supporting NIWC Atlantic (single vendor source). — [VSolvit](https://vsolvit.com/vsolvit-awarded-mfom-recompete-contract/)
- **INSURV:**
  - Inspections occur roughly every 48-60 months and assess structures, equipment and systems. They inform retain-or-decommission decisions and complement continuous CASREPs.
  - From 2010 to March 2012, CASREPs rose while INSURV results improved slightly.
  - Sources: [GAO-12-887](https://www.gao.gov/assets/650/648722.txt); [GAO-12-887 product page](https://www.gao.gov/products/gao-12-887)
  - INSURV publishes a releasable annual report (FY2023 available). — [INSURV 2023 Annual Report](https://www.insurv.usff.navy.mil/Portals/41/2023%20Annual%20Report_Releasable_FINAL.pdf)
- **Advana, Jupiter and NAVSUP dashboards:**
  - Jupiter is a web analytics tool built on Advana. It includes readiness information and pulls from "dozens of databases" to picture a unit's health. — [USNI News 2021](https://news.usni.org/2021/05/19/department-of-navy-developing-data-tool-for-cos-to-understand-predict-behavior-of-marines-sailors)
  - NAVSUP WSS hosts dashboards on the Navy Data Platform and Advana. — [DVIDS](https://www.dvidshub.net/news/542720/navsup-wss-transportation-and-distribution-creates-innovative-dashboards-deployed-naval-forces)
  - NAVSUP WSS runs "Readiness-Focused Standups" on backordered mission-critical parts. — [DVIDS](https://dvidshub.net/news/350169/navsup-wss-turns-up-heat-critical-orders-using-readiness-focused-standups)
- **ROC/POE:**
  - ROC/POE instructions (OPNAVINST C3501.2 series and unclassified class-specific 3501.xxx instructions) state each class's mission requirements and expected operating environment. Each assigns primary (P) and secondary (S) mission areas using acronyms such as AW, ASW and SUW.
  - Together, ROC and POE produce a "measurable workload" used to compute personnel requirements for activity manpower documents.
  - Most archived copies are from a 2013 snapshot citing C3501.2K. [DATED]
  - Sources: [archived DON 3501 series index (e.g. 3501.160C, 3501.316B)](https://webarchive.library.unt.edu/web/20130214013851/http://doni.daps.dla.mil/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.160C.pdf)
  - OPNAVINST 3501.115F (2023) updated required readiness levels across several mission areas. — [GlobalSpec listing](https://standards.globalspec.com/std/13083290/opnav-3501-115f)

### Inferences
- **Mission-to-equipment mapping:** MFOM's mission area to NTA to functional area to system to component tree is the closest public analog of an equipment-to-mission-area map. MissionTwin can replicate it synthetically using a weighted tree with critical-child flags and 0-1 EOC values from CASREP or 2-Kilo status.
- The TFOM, SFOM and OFOM figures of merit are presumably the training, supply and ordnance pillar scores in DRRS-N on the same 0-100 green/yellow/red scale. That is UNVERIFIED; no public source was found.

### Gaps
- I found no public sources for TFOM, TORIS or NTIMS mechanics, SFOM or OFOM definitions, or the "Navy Readiness Kill Chain" (the exact phrase returned nothing). Treat these as unverified names to confirm with SMEs.
- The ROC/POE PDF fetch returned empty, so the exact table columns and legend codes are unverified (see the proposed table in Q5).

## Q4: Public data on casualty frequency and duration for calibration

### Takeaway
GAO gives per-ship CASREP counts and trends: 2008-2012 by type, and FY2011-FY2021 for 10 classes (GAO-23-106440). No public source found gives CASREP open duration or time-to-repair distributions. Repair time and delay distributions must be assumed and labeled synthetic.

### Cited Findings
- **GAO-12-887 (January 2008 to March 2012), average CASREPs per ship:**
  - Frigates: 11.8
  - Destroyers: 14.5
  - Cruisers: 18.0
  - Amphibious ships: 22.3
  - Differences are significant at 95%.
- **GAO-12-887 trends:**
  - Surface combatants rose about 2 per ship per year (0.1770 per month). Amphibious ships rose about 3 per ship per year (0.2438 per month).
  - Quarterly averages went from 10.2 (surface combatants) and 16.8 (amphibious) in 2008 Q1 to 17 and 29 in 2012 Q1.
  - GAO gives no duration data.
  - Source: [GAO-12-887 text](https://www.gao.gov/assets/650/648722.txt)
- **GAO-23-106440 (Jan 2023; 151 ships, 10 classes, FY11-FY21):**
  - Casualty reports rose on nearly every class.
  - Wasp-class LHDs and both LCS variants had the largest increases in severe (category 3 and 4) CASREPs.
  - San Antonio-class and Arleigh Burke-class ships had the worst increases in maintenance delays.
  - Navy officials: "there is a level of subjectivity contained with each report."
  - Steaming-hour figures were deemed sensitive.
  - Source: [Breaking Defense on GAO-23-106440](https://breakingdefense.com/2023/01/gao-finds-navy-ships-having-more-problems-less-steaming-time-over-past-decade/)
- **Secondhand figures from press summaries (UNVERIFIED against the GAO report):**
  - Wasp class rose from about 11 CASREPs per ship (FY2011) to about 61 (FY2021).
  - Wasp and LCS averaged about 26 more category 3/4 reports in FY2021 than in FY2011.
  - Source: [Eurasian Times / press summaries](https://eurasiantimes.com/?p=129384); [Turdef](https://turdef.com/article/gao-us-navy-s-ships-suffer-continuous-breakdowns-and-technical-failures)
- **Measurement caveat (older):** a 1990s-era thesis found casualty reports "an unstable measure of ship material readiness." — [TRID listing](https://trid.trb.org/View/398246)

### Inferences
- **Proposed synthetic calibration (assumption, not sourced):**
  - About 15-30 new CASREPs per surface combatant per year, reflecting the 2012 level of about 17 per quarter-average per ship plus growth.
  - Amphibious ships about 1.5x surface combatants.
  - Category mix weighted toward C2.
  - Lognormal or Weibull time-to-repair with a long tail driven by parts delay (supply-delay hours are explicitly recorded at CASCOR).
  - 10-20% of CASREPs deferred and cancelled into an availability.
  - Every number above should be labeled synthetic.

### Gaps
- No public dataset on CASREP duration, ETR slip rates, category mix percentages, or parts-delay share was found. CNA or RAND studies with such data were not located in this session.

## Q5: Synthetic CASREP example structure and ROC/POE-style table (PROPOSED)

### Takeaway
The structures below are **PROPOSED for synthetic data**. They are assembled from the sourced set names and rules above, not copied from NTTP 1-03.1. Field order and delimiters are unverified.

### Cited Findings
The structures below rest on these sourced rules:
- MSGID comes first and the message is serialized 1-999.
- REF to the INITIAL DTG appears on follow-ups.
- ESTIMATE carries the ETR, ASSIST shows outside-assistance need, AMPN follows ESTIMATE for parts receipt, and RMKS holds a 30-day schedule.
- CANCEL/CASCOR records parts delay in hours and man-hours.
- Sources: [tpub gunners 275](https://www.tpub.com/gunners/275.htm), [276](https://www.tpub.com/gunners/276.htm), [277](https://www.tpub.com/gunners/277.htm); [NETC 3040.1A](https://www.netc.navy.mil/Portals/46/NETC/inst/30401A.pdf)

### Inferences
**PROPOSED synthetic CASREP (INITIAL), marked SYNTHETIC / UNCLASSIFIED / EXERCISE:**
```
UNCLAS //N03000//  EXERCISE EXERCISE EXERCISE  (SYNTHETIC - MISSIONTWIN)
MSGID/CASREP/USS NOTIONAL DDG-999/045/INITIAL//
POSIT/3645N/07615W/PIER 12 NORVA//
CASUALTY/AN-SPY-1D(V) SPS RADAR/CAT 3/AW//
EQUIP/APL:XXXXXXXX/ESWBS:452/JCN:DDG999-OA01-1234//
AMPN/TRANSMITTER CFA FAILED. REDUCED AIR SEARCH SECTOR 090-180.//
ESTIMATE/ETR:20261118//
ASSIST/YES/ISEA TECH REP REQUIRED/NIWC-LANT//
PARTS/1/NIIN:01-234-5678/QTY:1/REQN:V12345-6300-0001/PRI:01/STATUS:BACKORDER//
RMKS/AVAIL FOR ASSIST 05-30 NOV NORVA. CREW MAN-HRS TO DATE 36.//
```
- **PROPOSED lifecycle:**
  - UPDATE (serial 046): REF/A/MSG/<INITIAL DTG>//, revised ESTIMATE, parts receipt in AMPN, CASUALTY and ESTIMATE always repeated.
  - CASCOR (serial 047): REF to INITIAL DTG, AMPN with supply-delay hours, man-hours and parts received with dates.
  - CASCAN (alternative ending): AMPN with the scheduled availability, its location and date.
- **PROPOSED data model:**
  - casrep_id = hull + serial
  - initial_dtg, category (2-4)
  - equipment (APL/ESWBS) and mission_areas[]
  - etr_history[] (dtg, etr)
  - assist_required
  - parts[] (niin, req_date, rcpt_date)
  - status (open, corrected, cancelled)
  - supply_delay_hrs, manhours
  - linked_2kilo_jcns[] (ties to the earlier SKED/OMMS-NG/R-ADM research)

**PROPOSED ROC/POE-style mission-to-equipment table (synthetic, UNVERIFIED legend):**

| Mission area (P/S) | ROC capability (synthetic code) | Required in Cond I / III | Key equipment (MFOM-style system) | Critical? | Weight |
|---|---|---|---|---|---|
| AW (P) | AW-1 Provide area air defense | F / M | SPY radar, Aegis weapon system, VLS, SM missiles (ordnance) | Y | 0.35 |
| AW (P) | AW-2 Self-defense vs ASCM | F / F | CIWS, SLQ-32, decoy launchers | Y | 0.25 |
| ASW (P) | ASW-1 Detect/track submarines | F / M | SQQ-89, SQR-19 tow, helo deck/LAMPS | Y | 0.30 |
| SUW (P) | SUW-1 Engage surface targets | F / M | 5-in gun, Harpoon/NSM, SPS-67 | N | 0.20 |
| MOB (P) | MOB-1 Steam/maneuver | F / F | LM2500 GTMs, reduction gear, SSGTGs, steering | Y | 0.40 |
| C4I (P) | CCC-1 Maintain comms | F / F | SATCOM, Link 16, CANES | Y | 0.20 |

- The "F/M/L/A" style codes (Full, Minimal or Maintain, Limited, Augmented) in real ROCs are recalled from training knowledge only and are **UNVERIFIED**. Use them as a placeholder legend.
- MissionTwin can roll this table up MFOM-style (critical-child minimum, otherwise weighted average). It can map a projected score into a DRRS-N-like Y/Q/N, for example ≥0.8 Y, 0.6-0.79 Q, <0.6 N. That mapping mirrors the 80/60 green/yellow/red bands in the MFOM patent and is PROPOSED.

### Gaps
- No public, verbatim modern CASREP message or ROC/POE table was retrieved. The real formats should be validated with a fleet SME before the demo.
