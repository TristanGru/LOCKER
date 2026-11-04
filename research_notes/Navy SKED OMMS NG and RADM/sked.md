# SKED: U.S. Navy Planned Maintenance System (PMS) Scheduling Software (Navy 3-M)

Research date: 2026-11-04. Research method: web search and fetch, about 22 tool calls. Access limits: the NAVSEA-hosted NAVSEAINST 4790.8 PDFs and the NUWC Keyport page returned HTTP 403, public.navy.mil (SWMAG) no longer resolves, the tpub.com subdomains failed TLS, and the GAO PDFs downloaded as binary that could not be parsed (no PDF tooling on this machine). Many details below come from search-engine summaries of those pages and are marked "(search snippet)". They should be checked against the primary PDF before anyone relies on them. Items marked **[UNVERIFIED - background knowledge]** were not confirmed by any source found in this session. They are included only as hints for the synthetic-data team.

---

## 1. Purpose, current version, maintainer, shipboard users

### Takeaway
SKED is NAVSEA's PMS scheduler. Antech Systems developed it for NAVSEA. It creates PMS schedules, displays maintenance procedures and tracks accomplishment. The latest version documented publicly is SKED 3.2, which replaced 3.1. The main users are Sailors and work centers, the 3-M Coordinator (3MC) and command leadership (through dashboards). I found no public source naming NSWC Corona as SKED's maintainer.

### Cited Findings
- Antech says it "developed NAVSEA's planned maintenance scheduling software, SKED." It describes SKED as "vital 3M software" that views and prints maintenance procedures, automates creation of PMS schedules, tracks tasks and maintenance accomplished, and includes embedded interactive training videos. Its intended users are U.S. Navy Sailors and Navy work centers. — [Antech Systems: SKED](https://www.antechsystems.com/services/maintenance-management/sked/)
- A NAVSEA (NUWC Keyport / NSLC) page describes SKED as software that "provides the capability to schedule, display and manage planned maintenance events." It also says Sailors can submit technical feedback on maintenance tasks, and that Ships' 3-M is the "database of record for all maintenance-related execution data" (search snippet; the page returned 403 on direct fetch). — [NAVSEA NUWC Keyport, Maintenance Planning](https://www.navsea.navy.mil/home/warfare-centers/nuwc-keyport/nslc/products-services/maintenance-planning/)
- Antech's SKED 3.2 training video list says "SKED 3.1 users can upgrade to SKED 3.2" (standalone configuration and detachment video). No release date is given. — [Antech Systems, training/performance solutions page](https://www.antechsystems.com/?p=1171)
- User roles in SKED 3.2: "A 3MC creates PINs, and Sailors use them" to mark tasks complete or lost. The 3MC can "bulk transfer users in and out of SKED during a crew swap." A dashboard "helps leadership monitor programs," showing Accomplishment Ratings in colors by department, division or work center. — [Antech Systems](https://www.antechsystems.com/?p=1171)
- Antech's PMS support content is "intended for US Navy personnel only" and needs a CAC for access. — [Antech PMS Support](https://www.antechsystems.com/pms-support/)
- The governing NAVSEA instruction is the Ships' 3-M Manual, NAVSEAINST 4790.8D (17 Jun 2021). It cites OPNAVINST 4790.4F as its primary reference. Per a search snippet, NAVSEAINST 4790.8 Appendix G covers creating schedules in SKED 3.2 (direct fetch got 403). — [NAVSEAINST 4790.8D PDF](https://www.navsea.navy.mil/Portals/103/Documents/NAVINST/04790.008D.pdf)
- A later CNRFC instruction cites OPNAVINST 4790.4G, which suggests the OPNAV 3-M policy has moved from 4790.4F to 4790.4G (search snippet). — [CNRFCINST 4790.1B 3M Assessment Program](https://www.navyreserve.navy.mil/Portals/35/CNRFCINST%204790.1B%203M%20ASSESSMENT%20PROGRAM.pdf)
- A Surface Warfare magazine footer page said recent SKED updates included "Leadership dashboards, equipment based schedules," and that future versions would add custom views and reports (search snippet; the host no longer resolves; dated). — [SWMAG vol46 PMS](https://www.public.navy.mil/surfor/swmag/vol46/pmsFooter.htm)

### Inferences
- The 3MC is SKED's administrator role. Work center supervisors and maintenance personnel record accomplishment. Division officers and department heads use the dashboards. The shipboard role hierarchy (WCS, DIVO, DH, 3MC, XO/CO) is standard 3-M, but in this session I sourced only the 3MC, Sailor, work center and "leadership" roles.

### Gaps
- No public source found that names NSWC Corona as SKED's program office or maintainer. NAVSEA (with Antech as developer) is what the sources support. The NAVSEA 3-M program office (possibly NSWC Philadelphia or another warfare center) was not confirmed.
- No SKED 3.2 release date, and no evidence of a SKED 3.3 or 4.x, as of Nov 2026.
- Whether SKED runs inside NTCSS or as standalone/networked software was not confirmed from sources. The "standalone configuration" video suggests it supports standalone installs.

---

## 2. Data SKED holds (MIPs, MRCs, periodicity, work centers, schedules, status, LOEP, Force Revision, feedback, spot checks)

### Takeaway
PMS data is built from a fixed set of documents: LOEP (per work center), MIP (per equipment), MRC (per task), EGL and Tag Guide List. SKED builds cycle, quarterly and weekly schedules from them. SKED 3.2 adds equipment-based schedules, interval scheduling, situational and metered triggers, Inactive Equipment Maintenance (IEM) periods, spot-check scores, feedback reports, forecast views and upline-report export. Force Revisions are issued four times a year.

### Cited Findings
- **MRC (OPNAV 4790):** holds the procedures. Each card covers "who (rate)" does "what," "when," "how," and "with what resources." — [tpub FC vol 1](https://www.tpub.com/fcv1/8.htm)
- **MIP (OPNAV 4790/85):** briefly describes the requirements on all MRCs for one item of equipment. "Included are the periodicity codes, the man-hours involved, the minimum required skill level" and related maintenance requirements. — [tpub FC vol 1](https://www.tpub.com/fcv1/8.htm)
- **EGL (OPNAV 4790/81):** lists the location of every identical equipment item covered by one MRC. Technicians fill it out. **Tag Guide List (OPNAV 4790/107):** lists what must be tagged out. — [tpub FC vol 1](https://www.tpub.com/fcv1/8.htm)
- **LOEP (Report No. PMS 5):** lists the MIPs assigned to a work center. Its fields are report date, **force revision number, TYCOM, hull number and UIC, work center, MIP page numbers, and brief equipment description** for each MIP. — [tpub FC vol 1](https://www.tpub.com/fcv1/8.htm)
- **Quarterly PMS Schedule (OPNAV 4790/14):** "a quarter's worth of specific maintenance requirements, divided into weeks." **Weekly PMS Schedule (OPNAV 4790/15):** posted in each work center, showing who is assigned to perform each maintenance item on each component. — [tpub FC vol 1](https://www.tpub.com/fcv1/8.htm)
- **Cycle schedule:** MIPs feed the Cycle, Quarterly and Weekly schedules (search snippet). — [tpub ET PMS Program](https://electronicstechnician.tpub.com/14085/css/Pms-Program-Combat-Systems-86.htm)
- **PMS Feedback Report (OPNAV 4790/7B, also cited as 4790/713 in an older edition):** used to recommend MRC changes, order replacement cards and report coverage discrepancies. The paper form had an original and four copies (dated, paper era). — [tpub FC vol 1](https://www.tpub.com/fcv1/8.htm); [tpub ET FBR](https://electronicstechnician.tpub.com/14087/css/Pms-Feedback-Report-Fbr-Opnav-4790-7B-26.htm)
- SKED 3.2 manages feedback reports "which communicate across the Fleet." — [Antech](https://www.antechsystems.com/?p=1171)
- **Periodicity code:** defined as the element that "delineates how frequently the maintenance requirement must be performed" (secondary flashcard source). NAVSEAINST 4790.8C has sections "2-4.5 Maintenance Requirement Card (MRC)" and "IEM Periodicity Codes" (search snippet). — [Brainscape 4790.8C flashcards](https://www.brainscape.com/flashcards/navseainst-47908c-ships-maintenance-and-6286599/packs/9649426); [NAVSEAINST 4790.8C CH-1](https://www.navsea.navy.mil/Portals/103/Documents/NAVINST/04790-008C_CH-1.pdf)
- Example of an "R" periodicity from aviation PMS (tag guide list page title): "M-1R: Monthly or every 600 hours, whichever [comes first]." This shows the "R" suffix meaning a calendar periodicity paired with a usage/situational condition. — [navyaviation tpub 14310](https://navyaviation.tpub.com/14310/css/Tag-Guide-List-Tgl-252.htm)
- MIL-DTL-24784 (tech manual standard) notes: "an R periodicity shall be preceded by a recommended calendar periodicity (for example, DR, WR, MR...)." This is a related convention outside PMS. — [emilspec MIL-DTL-24784](https://technicalmanualspecsstandards.emilspec.com/MIL-DTL-24784-14/page12.html)
- **SKED 3.2 data features:** automated workflows, electronic line-outs, equipment-based schedules, "true interval scheduling," situational requirement improvements, and new accomplishment metrics. Accomplishment states include "complete" and "lost" (recorded with a PIN). The situational display supports local states and triggers, custom events, metered events, and scheduling MRCs for metered events. IEM periods can be started, edited, deleted and ended, which returns equipment to active. The forecast display supports maintenance planning. Spot checks come in several types; they can be scheduled and their scores entered in SKED. — [Antech](https://www.antechsystems.com/?p=1171)
- **Deferral:** per a search-snippet summary of NAVSEAINST 4790.8, "in SKED 3.2, maintenance can no longer be deferred." Unaccomplished checks are instead treated as lost or not-accomplished. Verify against App. G. — [NAVSEAINST 4790.8D](https://www.navsea.navy.mil/Portals/103/Documents/NAVINST/04790.008D.pdf)
- **Force Revision:** "The Navy issues a Force Revision four times a year," each with updated maintenance procedure documents, numbering in the thousands. Antech's Tailored Force Revision service reviews a ship's SKED equipment records and recommends adds, changes and deletes as a package for the 3MC to approve. — [Antech Tailored Force Revisions](https://www.antechsystems.com/services/maintenance-management/tailored-force-revisions/)

### Inferences
- A realistic data model has these entities: Ship (UIC, hull) → Work Center (4-character code) → LOEP → MIP (equipment) → MRC (periodicity, man-hours, rate, skill) → EGL (equipment instances and locations) → scheduled instance (week/date) → accomplishment record (status, PIN/user, date) plus Feedback Reports, Spot Checks, IEM periods and situational triggers.

### Gaps
- No sourced, complete periodicity code table. **[UNVERIFIED - background knowledge]**: D (daily), W (weekly), 2W, M (monthly), Q (quarterly), S (semiannual), A (annual), 18M/24M/30M/36M (multi-month), C (overhaul cycle), R (situational/as required), U (unscheduled/corrective). The "-R" suffix marks a combined calendar-plus-situational requirement, and the number after the dash is a sequence within that periodicity (e.g., M-1, M-2, Q-1R, A-3).
- MIP code format and MRC control number format were not confirmed. **[UNVERIFIED]**: MIP codes look like "4411/001-B6" (SCLSIS/ESWBS-type series, sequence, and a date code). The MRC control number is a 7-character alphanumeric printed on each card.
- Schedule marking conventions (e.g., X for completed, circled marks for not-accomplished, reschedule arrows) were not retrieved. The tpub quarterly schedule pages failed TLS.
- Work center code format (e.g., "EE01", "CE02", "DC01") is **[UNVERIFIED]**: four characters, with department/division letters followed by two digits.

---

## 3. Links to readiness metrics, CASREPs and OMMS-NG/CSMP

### Takeaway
SKED computes "Accomplishment Ratings" (the PMS accomplishment rate), and SKED 3.2 added new accomplishment metrics shown on color-coded leadership dashboards. Antech says SKED, the PMS MIS and the 3-M Maintenance Data System (MDS, which holds the 2-Kilo/CSMP corrective data) are being merged into one application. I found no public source documenting a direct software link from SKED to CASREPs or MFOM.

### Cited Findings
- Dashboard "Accomplishment Ratings are shown in colors that indicate how a department, division, or work center is doing"; SKED 3.2 introduced "new accomplishment metrics." — [Antech](https://www.antechsystems.com/?p=1171)
- "The Navy's current PMS Scheduler (SKED), PMS Management Information System (MIS), and 3-M Maintenance Data System (MDS) are being transformed into a cohesive application." Antech is working with NAVSEA and USFF to modernize PMS, including "creating PMS schedules ashore" tied to each ship's equipment configuration. — [Antech, Future of the PMS](https://www.antechsystems.com/services/maintenance-management/future-of-the-planned-maintenance-system/)
- GAO-24-106525 (Sep 9, 2024) uses "sailor-led maintenance" to mean O-level maintenance. It found maintenance cards (MRCs) "sometimes inaccurate with respect to the time and personnel needed." It recommended including COs as stakeholders in card updates (Rec 3) and writing cards at an appropriate level of detail (Rec 4); both were still open per the GAO page. — [GAO-24-106525](https://www.gao.gov/products/gao-24-106525)
- Per search-snippet text of the GAO PDF, the Navy uses "a separate planned maintenance scheduling software (SKED)" alongside other logistics IT, and N-MRO would move this to a single application. — [GAO PDF 872778](https://www.gao.gov/assets/880/872778.pdf)
- Ships' 3-M is described as the "database of record for all maintenance-related execution data" (search snippet). — [NAVSEA NUWC Keyport](https://www.navsea.navy.mil/home/warfare-centers/nuwc-keyport/nslc/products-services/maintenance-planning/)
- GAO survey: 64% of XOs said that relying on classroom training makes sailor-led maintenance moderately to extremely difficult; 75% said the same for repairs. The Navy needed 84,379 enlisted sailors at sea but had 70,705 as of Nov 2023 (about 16% short). — [GAO-24-106525 via search summary](https://www.gao.gov/products/GAO-24-106525); [Military Times](https://www.militarytimes.com/news/your-navy/2024/09/11/how-a-sailor-shortage-is-crippling-ship-maintenance-at-sea/)

### Inferences
- For MissionTwin: PMS accomplishment rate per work center or equipment is the sourced, SKED-native metric. When PMS on an equipment item is lost or not done, a corrective 2-Kilo/CSMP job (in OMMS-NG/MDS) or a CASREP may follow, but the sources found show no automated link. Model it as an analytical correlation, not a system feed.

### Gaps
- No public formula for the PMS accomplishment rate or for MFOM was found in this session. **[UNVERIFIED]**: the rate is commonly computed as accomplished divided by scheduled, with credit rules for partial checks. Consult NAVSEAINST 4790.8D Ch. 2 and the 3-M assessment instructions.
- How SKED data feeds TFOM/MFOM (DRRS-N) was not confirmed.

---

## 4. Export, report and file formats; published field layouts

### Takeaway
Sourced outputs are printed schedules (cycle, quarterly, weekly), MRCs and procedures, and an "upline report" that exports a "virtual look" of the SKED database for import by an external authority. I found no public record layouts, field names or database type for SKED.

### Cited Findings
- SKED "views and prints maintenance procedures" and automates creation of PMS schedules. — [Antech SKED](https://www.antechsystems.com/services/maintenance-management/sked/)
- Upline reporting: "a Command can transmit a virtual look of its SKED database to an external requesting authority," with workflows for generating, exporting and importing the report. — [Antech](https://www.antechsystems.com/?p=1171)
- The LOEP (PMS 5 report) carries report date, force revision number, TYCOM, hull/UIC, work center, MIP numbers and equipment description. These are the closest published "field list." — [tpub FC vol 1](https://www.tpub.com/fcv1/8.htm)
- The paper forms are numbered OPNAV 4790/14 (Quarterly), 4790/15 (Weekly), 4790/85 (MIP), 4790/81 (EGL), 4790/107 (TGL) and 4790/7B (FBR). — [tpub FC vol 1](https://www.tpub.com/fcv1/8.htm); [tpub ET FBR](https://electronicstechnician.tpub.com/14087/css/Pms-Feedback-Report-Fbr-Opnav-4790-7B-26.htm)

### Inferences
- Form fields (OPNAV 4790/14, /15) are the safest public basis for synthetic column names.

### Gaps
- Database engine, file extension of the upline export, and any XML/CSV schema: not found publicly. They are likely in CAC-restricted Antech or NAVSEA documentation.
- Whether NAVSEAINST 4790.8D appendices print sample SKED screens or field definitions: not verified (403).

---

## 5. Current status and modernization path (as of Nov 2026)

### Takeaway
The publicly documented direction is (a) Antech/NAVSEA/USFF consolidating SKED, the PMS MIS and 3-M MDS into one application with ashore-built, configuration-specific schedules, and (b) the Navy's N-MRO program, which GAO describes as a replacement for fragmented O-level logistics IT. I found no source that ties SKED explicitly to NOBLE. As of Nov 2025, GAO recorded that the Navy had not acted on communicating N-MRO plans to stakeholders.

### Cited Findings
- The SKED/MIS/MDS consolidation into a "cohesive application" (no date given). — [Antech Future of PMS](https://www.antechsystems.com/services/maintenance-management/future-of-the-planned-maintenance-system/)
- GAO Rec 7: communicate N-MRO program information to stakeholders. Status: Open; "As of November 2025, the Navy has not taken action." The Navy is replacing "old and fragmented logistics information technology (IT) systems." — [GAO-24-106525](https://www.gao.gov/products/gao-24-106525)
- NOBLE is a family of systems including NOSS (supply), NAMS (aviation maintenance) and NOME (Naval Operational Maintenance Environment). One Network won a $42.6M NOSS award in 2020. — [PR Newswire, 2020 (dated)](https://prnewswire.com/news-releases/the-united-states-navy-awards-43-million-contract-to-one-network-enterprises-for-the-naval-operational-business-logistics-enterprise-noble-naval-operational-supply-system-noss-301166187.html); [Navy RDT&E 0604231N PB2020](https://www.globalsecurity.org/military/library/budget/fy2020/navy-peds/U_0604231N_5_PB_2020.pdf)

### Inferences
- NOME (within NOBLE) and N-MRO are probably the surface maintenance successors where SKED functions may land. The sources do not explicitly name SKED's successor, so treat this as uncertain.

### Gaps
- No 2026 announcement of SKED retirement or migration found. The NTCSS sunset date is not confirmed here.
- How N-MRO relates to NOME/NOBLE is not confirmed. Check the FY2025-27 Navy budget books (0604231N, OPN BLI for NTCSS).

---

## 6. Guidance for a realistic synthetic weekly/quarterly export

### Takeaway
Base the columns on the sourced LOEP fields and the OPNAV 4790/14 and /15 schedule concepts. Use SKED 3.2 status concepts (complete, lost, situational/metered, IEM, spot-check score). Treat MRC/MIP numbering as illustrative only (**[UNVERIFIED]**).

### Cited Findings
- Sourced building blocks: LOEP fields (force revision number, TYCOM, hull, UIC, work center, MIP, equipment description) from [tpub FC vol 1](https://www.tpub.com/fcv1/8.htm). MIP-level periodicity, man-hours and skill level from the same page. The weekly schedule assigns a named person per maintenance item ([tpub](https://www.tpub.com/fcv1/8.htm)). Statuses complete/lost via PIN, IEM, situational and metered triggers, and spot-check scores come from [Antech](https://www.antechsystems.com/?p=1171). The "M-1R" example comes from [navyaviation tpub](https://navyaviation.tpub.com/14310/css/Tag-Guide-List-Tgl-252.htm).

### Inferences (illustrative synthetic schema, not an official layout)
```
ship_uic,hull,tycom,force_rev,work_center,mip,equipment_desc,egl_location,mrc,periodicity,man_hours,rate,sched_week_start,assigned_to,status,status_date,recorded_by_pin,spot_check_score,feedback_report_id,iem_flag,notes
N12345,DDG-0XX,SURFPAC,2-26,EE01,4411/001-XX,"SSTG Lube Oil Purifier",ER2-UPPER,M-1,M,1.5,EN3,2026-11-02,"EN3 Doe",COMPLETE,2026-11-04,****,,,N,
N12345,DDG-0XX,SURFPAC,2-26,EE01,4411/001-XX,"SSTG Lube Oil Purifier",ER2-UPPER,Q-2R,QR,3.0,EN2,2026-11-02,"EN2 Roe",LOST,2026-11-08,****,,,N,"Parts not available"
N12345,DDG-0XX,SURFPAC,2-26,CE02,....,"Radar Set",RADAR-RM,A-1,A,6.0,ET2,2026-11-09,"ET2 Poe",SCHEDULED,,,,,,
N12345,DDG-0XX,SURFPAC,2-26,DC01,....,"Fire Pump",AUX-1,W-1,W,0.5,DC3,2026-11-02,"DC3 Moe",COMPLETE,2026-11-03,****,3.2/4.0,,N,
```
- Plausible distributions: most items in a week are D/W/M; Q/S/A items cluster in particular weeks of the quarterly schedule; and a share of R items is triggered by situational events (e.g., before getting underway). Hull numbers, UICs, MIP codes and force-revision string formats are placeholders.

### Gaps
- Status vocabulary beyond "complete" and "lost" (e.g., partial, not-accomplished reasons, rescheduled) is not sourced. Neither are the force revision numbering format (e.g., "1-26") or the exact MRC/MIP numbering rules. The primary references to check are NAVSEAINST 4790.8D Ch. 2 and App. G (CAC-free PDF on navsea.navy.mil, which was blocked for this tool) and OPNAVINST 4790.4G.
