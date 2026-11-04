# Surface Ship Schedules, Operations, Certifications, Maintenance Availabilities and Daily Reports (MissionTwin data sources)

Scope note: This covers how a DDG's schedule (the dates it must be ready and what is planned) is produced, which certification events and availabilities set those dates, and which daily shipboard reports a CO reads. SKED, OMMS-NG and R-ADM were covered in earlier research and are left out here. Research date: 2026-11-04. Many detailed public sources are dated (1996-2012 SWOS and FAS training material). They are marked **[DATED]**. Anything unconfirmed is marked **[UNVERIFIED]**, and synthetic formats are marked **[PROPOSED]**. Several primary pages (gao.gov, cpf.navy.mil, news.usni.org) blocked direct fetch, so their facts come from search-result excerpts. Check the numbers against the original before you put them on a slide.

## 1. Ship employment schedules: production, distribution, OFRP phases, schedule systems, change messages

### Takeaway
A DDG's dates come from the Optimized Fleet Response Plan (OFRP). This is a notional 36-month cycle (Maintenance -> Basic -> Integrated -> Deployment/Sustainment) that in practice often runs 42-44 months. Fleet Forces Command and Pacific Fleet turn it into employment schedules through a quarterly scheduling process. The ship's Operations Officer owns the ship-level long-range and quarterly schedule. Public sources describe the process and the conferences but not today's IT system or a field-level export format.

### Cited Findings
- **Governing instructions:** OPNAVINST 3000.15A (OFRP) plus the Fleet companion COMUSFLTFORCOM/COMPACFLTINST 3000.15B (20 Oct 2020). The latter has chapters on OFRP phases, including a "Maintenance and Modernization Phase" and a "Basic Phase." A BUMED implementing instruction describes the phases as "maintenance, basic, advanced or integrated, and sustainment." — [BUMEDINST 3000.1 (cites 3000.15A / 3000.15B)](https://www.med.navy.mil/Portals/62/Documents/BUMED/Directives/Instructions/3000.1.pdf); Fleet 3000.15B PDF found at [sabresystems mirror](https://elearning.sabresystems.com/drrsS/instructions/OPTIMIZED%20FLEET%20RESPONSE%20PLAN.pdf) (fetch failed, so the contents were not read directly).
- **Earlier Fleet Response Plan:** The 2006 OPNAVINST 3000.15 FRP had four phases: maintenance, basic, integrated and sustainment. — [OPNAVINST 3000.15 (2006, archived)](https://webarchive.library.unt.edu/web/20130214181925/http://doni.documentservices.dla.mil/Directives/03000%20Naval%20Operations%20and%20Readiness/03-00%20General%20Operations%20and%20Readiness%20Support/3000.15.PDF) **[DATED]**
- **36-month cycle:** This was the original USFF description in 2016. It covered the maintenance, basic and integrated training phases, a one-month pre-overseas-movement period, and one deployment of no more than 8 months. — [USNI News, 2016](https://news.usni.org/2016/01/19/u-s-fleet-forces-new-deployment-plan-designed-to-create-sustainable-naval-force)
- **CSG month split (2020):** About 6 months of shipyard maintenance, about 8 months of basic plus integrated training, then 22 months covering a 7-month deployment and sustainment. Deployment length was cut from 8 to 7 months. Sustainment after deployment runs about 14 months. — [Defense News, Feb 2020](https://www.defensenews.com/naval/2020/02/07/the-us-navys-vaunted-deployment-plan-is-showing-cracks-everywhere/); [USNI News, Mar 2020](https://news.usni.org/2020/03/02/cno-gilday-defends-36-month-carrier-cycle-says-navy-has-never-missed-a-deployment)
- **Actual cycle length (Feb 2026):** The cycle "often ends up clocking in at 42 to 44 months," mostly because modernization periods run late. — [USNI News, 12 Feb 2026](https://news.usni.org/2026/02/12/improving-maintenance-timelines-key-to-on-time-strike-group-deployments-cno-says) (taken from a search excerpt; the page returned 403)
- **Surface Force Training and Readiness Manual (SFTRM, COMNAVSURFPAC/COMNAVSURFLANTINST 3502.7 series):** It "codifies the 36-month OFRP," per a 2026 Proceedings article. — [USNI Proceedings, Aug 2026](https://www.usni.org/magazines/proceedings/2026/august/navy-readiness-requires-flexible-weighted-certifications)
- **Ship-level schedule ownership [DATED, SWOS c.1996-98]:**
  - "The ship's Operations Officer is primarily responsible for the ship's schedule."
  - The Long Range Schedule looks 18-24 months (6-8 quarters) ahead and is rolled forward each quarter.
  - Build order: deployments, major fleet exercises and SRA first; then notional requirements and inspections; then filler.
  - The CO and XO approve before the schedule leaves the ship.
  - The Ops Officer compiles the ship's Quarterly Employment Schedule (QES) input and submits it up the chain of command.
  - Source: [SWOS Ops Officer lesson 72-2](https://man.fas.org/dod-101/navy/docs/swos/ops/72-2.html)
- **Notional schedules [DATED]:** "Each class of ship has a notional schedule," and these come from the TYCOM and ATG. — [SWOS 72-2](https://man.fas.org/dod-101/navy/docs/swos/ops/72-2.html)
- **Upper-echelon schedule messages [DATED, 1990s names]:**
  - COMNAVSURFLANT ALNAVSURFLANT message: 5-year deployments and major exercises.
  - COMNAVSURFPAC SECRET message: deployment cycles, normally 2 years.
  - COMSECONDFLT quarterly "EMPLOYMENT PLANNING" message: the next 12 months.
  - C3F agenda letter.
  - "C3120 (EMPSKED)" and the squadron give employment dates.
  - TYCOMs set maintenance targets, for example 3 weeks of IMA maintenance per operational quarter.
  - Source: [SWOS 72-2](https://man.fas.org/dod-101/navy/docs/swos/ops/72-2.html)
- **Schedule fill/employment codes [DATED]:** RFS (Ready For Sea), HOLUPK (Holiday Leave and Upkeep), UPK (Upkeep), TBD. — [SWOS 72-2](https://man.fas.org/dod-101/navy/docs/swos/ops/72-2.html)
- **OPTEMPO / PERSTEMPO [DATED]:**
  - OPTEMPO targets were 28 underway days per quarter for non-deployers and 51 for deployers.
  - Turnaround ratio (TAR) goal was 2:1.
  - PERSTEMPO policy came from OPNAVINST 3000.13 series.
  - Source: [SWOS 72-2](https://man.fas.org/dod-101/navy/docs/swos/ops/72-2.html)
- **Quarterly scheduling conference [DATED]:**
  - The "Fleet CINC's Quarterly Employment Scheduling Conference" assembles underway inputs about 6 months ahead.
  - Fleet exercise participants are identified up to 1 year ahead.
  - OPAREA clearance and services requests are due no later than 30 days prior.
  - Diplomatic clearance for out-of-CONUS port visits takes 60-90 days.
  - A "Schedule Change Request" is listed as a required message, but its format is not given.
  - Source: [SWOS 72-4](https://man.fas.org/dod-101/navy/docs/swos/ops/72-4.html); [SWOS ppt "Working Schedule Development"](https://man.fas.org/dod-101/navy/docs/swos/ops/72PT2/tsld012.htm)
- **Current practice (2020s):** Contractor job postings describe a TYCOM "CNO Availability and Maintenance Scheduler Coordinator" role that takes part in the "Fleet Forces Command (FFC) quarterly schedule review process." — [LCE job posting](https://job-openings.youthopps.monster.com/tycom-cno-availability-maintenance-scheduler-coordinator-norfolk-va-us-life-cycle-engineering/5697fff1-2384-43b4-bf3d-cac34fbb2fe8)
- **Planning tools:** An NPS operations-research paper (Brown, Goodman, Wood) on employment scheduling said no automated decision aids were used to produce the employment schedule. — [NPS paper](https://faculty.nps.edu/gbrown/docs/BrownGoodmanWood.pdf) **[DATED; publication year not confirmed]**
- **Notional phase lengths [DATED, pre-FRP]:**
  - Maintenance/ROH/SRA: 9 weeks to 9 months
  - Basic: about 6 months
  - Intermediate: about 4 months
  - Advanced: about 4 weeks
  - Pre-deployment (POM): 30 days
  - Readiness goals by phase: M-5/C-5 in the yard, M-3/C-3 in basic, M-1/C-1 in advanced and POM
  - Source: [SWOS 72-2](https://man.fas.org/dod-101/navy/docs/swos/ops/72-2.html)

### Inferences
- MissionTwin can treat a 30-day schedule as a slice of the OFRP cycle. Each row needs an OFRP phase tag (MAINT / BASIC / INTEGRATED / DEPLOYED / SUSTAINMENT) and an employment code.
- The 2-4 week forecast horizon sits well inside the quarterly schedule's ~6-month lock. Near-term events (certs, underways, CMAVs) are therefore fairly fixed, and changes would show up as schedule-change messages.
- The 42-44-month real cycle versus the 36-month notional one gives a realistic place to inject delays: a late availability pushes Basic Phase events to the right.

### Gaps
- I found no public name or description for the current Fleet scheduling IT system. The prompt's "Navy Scheduling System" could not be confirmed **[UNVERIFIED]**. Earlier research covered SKED, which is the PMS scheduler and a different thing.
- There is no public field layout for the current employment schedule or for the schedule-change-request message.
- There is no official current DDG-specific month split for OFRP phases. The CSG figures above are the closest available.

## 2. Certification and training events tied to missions (SFRM/SFTRM, Basic Phase, ATG, COMPTUEX) and their prerequisites

### Takeaway
Leaving the maintenance phase requires a TYCOM readiness assessment. Navy releases call the current one "READ-E 4" and list LOA, crew certification, dock trials/fast cruise, a navigation assessment and sea trials. The ship then completes Basic Phase mission-area certifications run by ATG; one DDG certified 18 mission areas in 18 weeks. Group Sail/SWATT and COMPTUEX follow in the Integrated Phase, and COMPTUEX is the deployment-certifying exercise. Each certification implicitly needs specific equipment working and specific watch teams qualified.

### Cited Findings
- **Exit from the maintenance phase:** USS Bulkeley's crew certification was part of READ-E 4, a Type-Commander-led readiness assessment for leaving the maintenance phase. Its six events were:
  1. Main reduction gear health assessment
  2. Light-off assessment (LOA)
  3. Crew certification
  4. Dock trials and fast cruise
  5. Squadron/group staff navigation assessment
  6. Contractor sea trials
  - Source: [navy.mil, Bulkeley completes crew certification](https://www.navy.mil/Press-Office/News-Stories/Article/2495853/bulkeley-completes-crew-certification/)
- **Basic Phase exit criteria:** "All Mission Area Certifications must be achieved to exit this Phase." Mobility areas include navigation, seamanship, damage control and communications. — [Brainscape study cards (non-authoritative)](https://brainscape.com/flashcards/phases-assessments-certifications-valida-8365947/packs/14027261) **[UNVERIFIED]**
- **USS Curtis Wilbur (DDG 54):** Basic Phase complete on 30 July 2018 after certification events for 18 mission areas in 18 weeks. — [navy.mil](https://www.navy.mil/Press-Office/News-Stories/display-news/Article/2249867/curtis-wilbur-completes-basic-phase)
- **USS John S. McCain (DDG 56):** Basic Phase Certification on 2 June 2020. Instruction and evaluation covered 23 areas, including seamanship, navigation, supply, engineering, EW, medical and damage control drills. — [CPF](https://www.cpf.navy.mil/Newsroom/News/Article/2637622/uss-john-s-mccain-certified-for-return-to-operations); [Janes](https://www.janes.com/defence-intelligence-insights/defence-news/mccain-crew-completes-basic-certification)
- **Early certification:** The SFTRM lets ships certify early once they show full proficiency. USS Harpers Ferry finished its Basic Phase certification 7 weeks early. — [CPF, "Rewarding a culture of excellence"](https://www.cpf.navy.mil/Newsroom/News/Article/2664387/rewarding-a-culture-of-excellence-ships-crews-can-now-earn-certification-early); [DVIDS](https://www.dvidshub.net/news/312832/surface-ship-readiness-rewarding-culture-excellence)
- **SFTRM revision:** 3502.7A, dated 9 Jan 2020. Its Appendix B covers inspections, certifications, assessments and visits. — [study guide citing 3502.7A](https://studyguides.com/study-methods/overview/cmaxjquu01aso0lplrc3h47rx) **[UNVERIFIED revision; a later revision may be in force as of Nov 2026]**
- **Debate over certification design (2026):** A Proceedings article argues for "flexible, weighted certifications" and certifications that stay active from the Basic Phase onward. This implies certifications currently expire or need revalidation. — [USNI Proceedings, Aug 2026](https://www.usni.org/magazines/proceedings/2026/august/navy-readiness-requires-flexible-weighted-certifications)
- **TSTA/FEP [DATED, older Surface Force Training Manual]:**
  - The Final Evaluation Period is a 3-4 day scenario-driven combat-readiness evaluation that ends the Basic Phase.
  - Engineering certification is phased: ATG trains in TSTA I/II and PEB certifies.
  - Source: [FAS SFTM Ch2 sec1](https://man.fas.org/dod-101/navy/docs/sftm/Ch2sec1.html)
- **TSTA/FEP content:** Firefighting, man overboard, abandon ship and mass-casualty drills. — [CPF, Carl Vinson TSTA/FEP](https://www.cpf.navy.mil/Newsroom/News/Article/3356290/uss-carl-vinson-completes-tailored-ships-training-availabilityfinal-evaluation/)
- **TYCOM training criteria [2005]:** Basic C2, weapons employment, mobility (navigation, seamanship, damage control, engineering, flight operations) and warfare specialty. — [GlobalSecurity/NNS 2005](https://www.globalsecurity.org/military/library/news/2005/04/mil-050408-nns01.htm) **[DATED]**
- **Integrated Phase:**
  - Group Sail (GRUSAIL) includes SWATT (Surface Warfare Advanced Tactical Training). It is multi-platform, multi-warfare-area training at sea that starts strike group integration.
  - COMPTUEX is "the definitive, final training to determine if a strike group and its units are deployment-ready." It starts with a scripted phase and moves to unscripted scenarios.
  - USS Gonzalez sailed Group Sail with CSG-10 in Jan 2026 before COMPTUEX.
  - Sources: [navy.mil, USS Gonzalez begins COMPTUEX](https://www.navy.mil/Press-Office/Press-Releases/display-pressreleases/Article/2263015/uss-gonzalez-begins-comptuex/); [DVIDS Gonzalez Group Sail](https://www.dvidshub.net/news/printable/557024); [CPF Nimitz COMPTUEX](https://www.cpf.navy.mil/Newsroom/News/Article/2735653/nimitz-strike-group-prepares-for-deployment-with-comptuex)
- **DDG-level examples:**
  - USS Sterett did a month of training after SWATT and before joining Nimitz for COMPTUEX. — [PACOM](https://www.pacom.mil/Media/NEWS/Article/2266661/uss-steretts-road-to-7th-fleet-maintenance-training-set-destroyer-up-for-success)
  - USS Wayne E. Meyer "earned certification in warfare areas" during COMPTUEX with CSG-1. — [DVIDS](https://www.dvidshub.net/news/215641/uss-wayne-e-meyer-completes-certification-exercise)
- **Deployment certification:** "Basic Phase Completion" is listed as a deployment certification granted by USFF/C3F/C7F. — [Brainscape](https://www.brainscape.com/flashcards/ats-12905880/packs/21272656) **[UNVERIFIED]**
- **Recurring inspections [DATED]:**
  - Post-overhaul: LOE, CSSQT, WSAT, FORACS
  - Pre-deployment: e.g., CSRR
  - Periodic: INSURV, CMS inspection, every 15-24 months
  - Ships track these on a POA&M with last-done date, periodicity and due date.
  - Source: [SWOS 72-2](https://man.fas.org/dod-101/navy/docs/swos/ops/72-2.html)

### Inferences
- These prerequisite mappings are **[PROPOSED]** and inferred from the names of the events. None comes from a published checklist.

| Event | Inferred prerequisites |
|---|---|
| LOA / mobility-engineering | Main propulsion and electrical plant up; firefighting and DC gear ready; EOOW/EOOW-qualified engineering watch teams |
| Navigation assessment and seamanship | Radars, GPS/WSN, steering; qualified OOD/CO/JOOD bills |
| Air defense (AMW/IAMD) | SPY radar and Aegis combat system, CIWS, SM magazines, qualified CIC watch teams |
| ASW | SQQ-89 / sonar dome, helicopter detachment where assigned |
| SWATT / COMPTUEX | All of the above, plus datalinks (Link 16) and SATCOM |

- For MissionTwin, each mission/event can carry `required_systems[]`, `required_watch_quals[]` and `certification_dependency[]` (for example, "COMPTUEX requires Basic Phase complete"). A CASREP on a required system, or a lapsed qualification, then flags the event as at risk.

### Gaps
- The current SFTRM (3502.7 series) text and the full list of DDG mission-area certifications, with their periodicities, were not retrievable. 18 and 23 are counts from press releases, not from the manual.
- I found no public matrix of equipment or crew-qualification prerequisites per certification.
- The exact meaning of "READ-E" levels (READ-E 1-4?) is not publicly defined in what I found **[UNVERIFIED]**.

## 3. Maintenance availabilities: CNO availabilities, SRA/DSRA/PIA/CMAV, NMD, A-xxx milestones, GAO delay data

### Takeaway
DDG depot maintenance is scheduled as CNO availabilities (SRA, DSRA, and the longer DDG Mod/extended docking periods), with recurring CMAVs of about 2 weeks every 4 months in between. Planning milestones are counted down as A-minus days (A-120, for example) and lead to package "lock." Milestone dates live in NMD/NMD-R. GAO and the Navy report chronic schedule overruns: historically about 70-75% of availabilities finished late, though the Navy reports improvement since 2019.

### Cited Findings
- **SRA (Selected Restricted Availability):** "An availability scheduled by the CNO for the accomplishment of repairs and selected alterations by industrial activities, sometimes coinciding with intermediate level maintenance." — [FAS SWOS Gunnery Officer info](https://man.fas.org/dod-101/navy/docs/swos/gunno/INFO5.html) **[DATED]**
- **DSRA:** An SRA extended to include drydocking. Current DDG DSRA and extended-docking solicitations appear on SAM.gov, for example USS The Sullivans (DDG 68) FY25 DSRA and USS Porter (DDG 78) FY25 Extended Docking SRA. Durations seen in the search excerpts: Ramage DSRA about 15 months; LPD-26 FY27 DSRA a little over 18 months. — [SAM.gov The Sullivans DSRA](https://sam.gov/opp/83c7cce5b34a40a19df81639bd8c13d8/view); [HigherGov Porter EDSRA](https://highergov.com/contract-opportunity/fy25-uss-porter-ddg-78-extended-docking-selected-n00024-24-r-4427-p-9289d); [SAMsearch Murtha DSRA](https://samsearch.co/gov-explore/federal/uss-john-p-murtha-lpd-26-fy27-docking-selected-restricted-availability-dsra-pre/N00024-26-R-4412v2) (durations from search excerpts, so **[UNVERIFIED]**)
- **CMAV:** "notionally a two-week availability, every four months." CMAVs are CONUS and Guam availabilities and are identified as Restricted Availabilities (RAV).
- **SIA (Surface Incremental Availability):** The FDNF equivalent. It is a CNO-scheduled non-docking period that is "scheduled like a CNO availability and executed like a CMAV."
  - Source for both: [NAVSEA JFMM training notes (COMFLTFORCOMINST 4790.3 Rev A Ch-4)](https://www.navsea.navy.mil/Portals/103/Documents/SUBMEPP/JFMM/JFMM_Training_Notes_D4.docx)
- **PIA:** I found no public surface-ship definition. "PIA" is mainly the carrier/submarine term (Planned Incremental Availability) **[UNVERIFIED for DDGs]**.
- **Governing manual:** The Joint Fleet Maintenance Manual (JFMM, COMFLTFORCOMINST 4790.3). An older Vol II Ch 3 sits on FAS. — [JFMM Vol II Ch 3 (FAS, dated)](https://nuke.fas.org/guide/usa/doctrine/navy/jfmm/vol2/CH_03.htm)
- **Lock and completion date:** SURFMEPP issues a Mandatory Material List (Code 200 letter) to the RMCs before "100% package lock." The original completion date is recorded in NDE at the official start of the availability. — [NAVSEA JFMM training notes](https://www.navsea.navy.mil/Portals/103/Documents/SUBMEPP/JFMM/JFMM_Training_Notes.docx)
- **BAWP:** SURFMEPP's Baseline Availability Work Package holds the repair, assessment, modernization and service tasks for each ship's FRP maintenance cycle. — [NAVSEA SURFMEPP Core Products](https://www.navsea.navy.mil/Home/Team-Ships/NAVSEA-21/SURFMEPP/Core-Products/)
- **NMD-R:** Holds "planned milestone dates and avail costs." — [NAVSEA SNA 2020, Surface Ship Readiness & Sustainment brief](https://www.navsea.navy.mil/Portals/103/Documents/Exhibits/SNA2020/SNA2020-SurfaceShipReadinessAndSustainment-CaptSteveMurray.pdf)
- **Databases in daily use:** Job postings for AWP managers list 3-M, M&SWP, NDE, NMD, AIM, TAAS and VSB. Duties include "review and track planning and execution milestones" and "prepare lock letters for TYCOM." — [ManTech Baseline AWP Manager](https://careers.mantech.com/en_US/careers/JobDetail/Baseline-Availability-Work-Package-Manager/65327); [ClearanceJobs](https://api.clearancejobs.com/jobs/8372144/engineering-technician-v-4945)
- **A-120 example:** ILS certifications must be completed and certified by SPMs at A-120, four months before the availability. — [LCE case study](https://www.lce.com/case-studies/lce-helps-u-s-navy-modernize-surface-ships/) (milestone specific to ILS certification)
- **GAO-25-106990 (31 Jan 2025), "Navy Surface Ships: Maintenance Funds and Actions Needed to Address Ongoing Challenges":**
  - The Navy requested about $24.9B for FY2020-23 combat surface ship maintenance and spent about $25.8B.
  - There were 149 combat surface ships as of Nov 2024.
  - Persistent challenges: spare parts, too few qualified maintainers, continual deferred maintenance.
  - The Navy was making progress on 12 of 46 prior recommendations.
  - Source: [GAO-25-106990](https://www.gao.gov/products/GAO-25-106990); [USNI News summary](https://news.usni.org/2025/02/11/gao-report-on-surface-ship-maintenance); [Naval Today](https://navaltoday.com/?p=67141)
- **Navy-reported improvement (Jan 2025):** Days of maintenance delay fell 62% since 2019, to 2,633 days. Goals for Sep 2025: at least 71% of CNO availabilities on time and under 1,714 delay days. — reported in search excerpts from [Inside Defense](https://insidedefense.com/insider/navy-takes-lessons-cruise-lines-coast-guard-and-more-reduce-maintenance-delays) **[Navy-reported, not GAO-verified; did not confirm whether the Sep 2025 goal was met]**
- **Earlier GAO data:**
  - FY2014-2019: more than 33,700 more days in maintenance than planned, and about 75% of maintenance periods not finished on time. — [GAO testimony / reports via search excerpt](https://gao.gov/assets/720/710459.pdf)
  - Surface ships 2014-2018: 50 of 71 periods (about 70%) ran longer than planned. — [GAO-20-86 highlights](https://www.gao.gov/assets/gao-20-86-highlights.pdf); [USNI News 2020](https://news.usni.org/2020/05/13/gao-navy-seeing-improvements-in-surface-ship-maintenance-costs-but-schedule-is-still-an-issue)
  - GAO-21-66 also covers surface ship maintenance delays and causes. — [GAO-21-66](https://www.gao.gov/products/GAO-21-66)
  - Press summary: "only 30 percent of maintenance completed on time since FY2012." — [Task & Purpose](https://taskandpurpose.com/news/navys-maintenance-troubles-gao-report/) (not confirmed against GAO text)
- **Planning horizon:** RAND studied extending DDG-51 depot length and intervals under a 72-month operational cycle, which is relevant to how often DSRAs occur. — [RAND](https://shop.rand.org/products/extending-depot-length-and-intervals-for-ddg-51-class-ships-examining-the-72-month-operational-cycle)

### Inferences
- For synthetic data, model the availabilities this way:
  - CMAV every ~4 months, ~14 days
  - SRA ~4-6 months **[UNVERIFIED duration]**
  - DSRA ~12-18 months
  - Planned completion date versus actual/forecast completion date, with a delay distribution in which most availabilities run late
- A late availability in week 0 cascades into a slipped LOA, crew certification and sea trials, then into Basic Phase events in weeks 2-4. This is the core forecasting story for MissionTwin.
- A-xxx milestones (A-360, A-120, lock, A-0 start, C-0 completion) can appear as synthetic fields. Only A-120 and "package lock" are publicly attested here.

### Gaps
- The full JFMM list of A-minus milestones was not retrieved. The current JFMM Rev C is on NAVSEA but was not fetched.
- I could not confirm the exact current definitions of PIA and DDG Mod availabilities, or the typical durations of DDG SRAs.
- GAO-25-106990's on-time percentage and delay-day figures were not read directly (gao.gov fetch was blocked).

## 4. Daily shipboard reports a captain reads (POD, Eight O'Clock Reports, OPSUM/SITREP, LOGREQ, MOVREP, in-port/underway status)

### Takeaway
Ship-internal daily reports are locally formatted free-text or locally designed forms: the Plan of the Day (XO), the Eight O'Clock (2000) Reports and the night orders. Off-ship naval messages are semi-structured: MOVREP is strictly formatted with numbered lines, while the Daily OPSUM follows a base OPGEN format that operational commanders modify, and LOGREQ follows a set format. A synthetic "daily department status" PDF should therefore be a lightly structured free-text memo.

### Cited Findings
- **Plan of the Day:** The XO issues it. It "sets up the expected sequence of events and gives assignments." It is excluded from the formal directives system, as is the captain's Night Order Book. — [Navy training manual (tpub)](https://navyadvancement.tpub.com/14144/css/Officer-Of-The-Deck-In-Port-Cont-166.htm); [SORM 3120.32D (archived 2012)](https://webarchive.library.unt.edu/web/20130214013851/http://doni.daps.dla.mil/Directives/03000%20Naval%20Operations%20and%20Readiness/03-100%20Naval%20Operations%20Support/3120.32D.pdf) **[DATED; current SORM revision not confirmed]**
- **Eight O'Clock Reports:**
  - "Daily equipment status reports given to the commanding officer by the executive officer each evening at 8 o'clock (2000)."
  - In port they go to the Command Duty Officer, and duty department heads turn them in.
  - "These reports are usually locally generated forms and therefore their content and format may vary among commands." There are also "twelve o'clock reports."
  - Sources: [Electronics Technician manual (tpub)](https://electronicstechnician.tpub.com/14085/css/Eight-Oclock-Reports-22.htm); [FC manual](https://fcsorm.dyndns.org/fcsorm/images/pdfdata/pdfbooks/firecontrolman/fcs01.pdf); [SWOS Ops 72-9](https://man.fas.org/dod-101/navy/docs/swos/ops/72-9.html)
- **XO authority:** "The executive officer is the direct representative of the commanding officer"; XO orders carry the CO's force. — [MyNavyHR XO guide quoting SORM](https://www.mynavyhr.navy.mil/Portals/55/Career/Detailing/Officer/SurfaceWarfare/LDOCWO/3120-1%20AO%20Guide%20-%20Executive%20Officer.pdf)
- **Daily OPSUM:**
  - Ships report operational status to higher command every day they are underway, and sometimes in port during deployment.
  - "The basic format for the OPSUM is found in the NAVY WIDE OPGEN… operational commanders will frequently modify the format."
  - Source: [SWOS Ops 72-9](https://man.fas.org/dod-101/navy/docs/swos/ops/72-9.html) **[DATED]**
- **MOVREP (SSIC N03123), structured [DATED, rev 2/96]:**
  - Departure reports go 48-24 h before sailing. Arrival reports go immediately.
  - Position updates are triggered by a 4-hour change in ETD/ETA or being 100 NM off track; there is a 24-hour storm-evasion update.
  - CHG CNL is sent if the ship does not get underway on time.
  - Line types: ORG, track lines (ETD/VIA/POS/ETA/RDV/DET), MOD lines.
  - Times are in Zulu; lines are numbered with two digits and end with "END"; checksums protect key fields.
  - Source: [SWOS Ops 72-7](https://man.fas.org/dod-101/navy/docs/swos/ops/72-7.html); [Wikipedia: Movement Report System](https://en.wikipedia.org/wiki/Movement_Report_System)
- **LOGREQ:**
  - A formatted message ships send before a port visit, or for delivery at sea, to get services (fuel, water, provisions, trash/CHT, husbanding).
  - NAVSUP runs Fleet Logistics Centers (for example Yokosuka, Pearl Harbor, Norfolk). Fuel goes through DLA Energy and food through DLA Troop Support.
  - Source: [Maritime Professional / NAVSUP FLC article](https://www.maritimeprofessional.com/news/delivering-parts-fuel-mail-over-347860); [NPS thesis on LOGREQ process](https://calhoun.nps.edu/entities/publication/b65dcb9b-8d2d-44e1-9e18-a14f1f63ee6b); [NAVSUP FLC Pearl Harbor Logistics Service Center](https://www.navsup.navy.mil/NAVSUP-Enterprise/NAVSUP-FLC-Pearl-Harbor/Logistics-Service-Center/)
  - Coast Guard analogue: LOGREQ due at least 7 days before arrival, listing fuel, garbage, black water and bilge services. — [USCG Base New Orleans](https://www.dcms.uscg.mil/Our-Organization/Operational-Logistics-Command-LOGCOM/Bases/Base-New-Orleans/Comptroller-Base-Operations/Logistics-Requirements/)
- **OPREP-3 (significant events):** NAVY BLUE goes to the Navy Operations Center for events that are not of national-level interest. PINNACLE requires a 15-minute voice report and a 1-hour message. — [CJCSM 3150.05F](https://www.jcs.mil/Portals/36/Documents/Library/Manuals/CJCSM%203150.05F.pdf); [MCO 3504.2A](https://www.marines.mil/Portals/1/MCO%203504.2A.pdf)
- **Schedule of Events (SOE) [DATED]:** Columns are EVENT, TIME, DESCRIPTION, REMARKS. Event numbers are spaced (050, 100, 150) so events can be inserted. The CO signs. — [SWOS 72-4](https://man.fas.org/dod-101/navy/docs/swos/ops/72-4.html)

### Inferences
| Report | Format |
|---|---|
| POD, Eight O'Clock Reports, department head status, Night Orders, SOE | Free text or local forms; best fit for an unstructured PDF input |
| MOVREP, CASREP (covered earlier), OPREP-3 | Fixed-format messages |
| OPSUM, LOGREQ, SITREP | Semi-structured (labeled paragraphs or sets) |

- The CO's daily picture is mostly the Eight O'Clock Reports, which cover equipment status by department, plus the next day's POD and SOE.

### Gaps
- I found no public field layouts for the current Navy OPSUM, LOGREQ or the "daily SITREP." The NAVSUP Port Visit Guide and NWP/OPGEN texts were not retrieved.
- The current SORM revision (3120.32D or later) and its exact POD and Eight O'Clock Report language were not confirmed.

## 5. Synthetic generator: realistic structure for (a) a 30-day schedule export, (b) a daily department status report, (c) a mission/event list

### Takeaway
Everything in this section is **[PROPOSED]**. No public field-level spec exists for these files. The structures combine attested elements (OFRP phases, employment codes RFS/UPK/HOLUPK, availabilities CMAV/SRA/DSRA, events LOA/crew cert/sea trials/Basic Phase certs/Group Sail/SWATT/COMPTUEX, SOE conventions, Eight O'Clock Report content, Zulu times) into usable synthetic formats.

### Cited Findings
- **Employment and fill codes:** RFS, UPK, HOLUPK, TBD — [SWOS 72-2](https://man.fas.org/dod-101/navy/docs/swos/ops/72-2.html)
- **Maintenance exit events:** MRG assessment, LOA, crew certification, dock trials/fast cruise, navigation assessment, sea trials — [navy.mil Bulkeley](https://www.navy.mil/Press-Office/News-Stories/Article/2495853/bulkeley-completes-crew-certification/)
- **Integrated events:** Group Sail, SWATT, COMPTUEX — [DVIDS Gonzalez](https://www.dvidshub.net/news/printable/557024)
- **CMAV cadence:** about 2 weeks every 4 months — [JFMM training notes](https://www.navsea.navy.mil/Portals/103/Documents/SUBMEPP/JFMM/JFMM_Training_Notes_D4.docx)
- **SOE conventions:** spaced event numbers, CO signature — [SWOS 72-4](https://man.fas.org/dod-101/navy/docs/swos/ops/72-4.html)
- **Eight O'Clock Reports:** daily equipment status by department to the XO and then the CO — [tpub ET manual](https://electronicstechnician.tpub.com/14085/css/Eight-Oclock-Reports-22.htm)

### Inferences

#### (a) 30-day ship schedule export [PROPOSED], CSV columns
`ship_hull, ship_name, date_start_local, date_end_local, tz, ofrp_phase {MAINT|BASIC|INTEGRATED|DEPLOYED|SUSTAINMENT}, employment_code {INPORT|UPK|RFS|HOLUPK|UW_LOCAL_OPS|UW_TRANSIT|CMAV|SRA|DSRA|CERT_EVENT|EXERCISE|PORT_VISIT|TBD}, event_id, event_name, location_or_oparea (e.g., VACAPES, SOCAL, Norfolk Pier 5), underway_flag, isic (e.g., DESRON xx), opcon (e.g., C2F/C3F), required_cert_ids[], status {SCHEDULED|TENTATIVE|CHANGED|CANCELLED}, source_msg_dtg (schedule change DTG), last_change_reason, remarks`

Example rows:

```
DDG-XXX,USS EXAMPLE,2026-11-09,2026-11-20,EST,BASIC,CMAV,AV-26-03,"CMAV 26-3",Norfolk,N,DESRON 2X,C2F,,SCHEDULED,,,"RMC-led, 14 days"
DDG-XXX,USS EXAMPLE,2026-11-23,2026-11-24,EST,BASIC,RFS,,"Ready For Sea / fast cruise",Norfolk,N,,,"",SCHEDULED,,,
DDG-XXX,USS EXAMPLE,2026-11-30,2026-12-04,EST,BASIC,CERT_EVENT,EV-NAV-01,"Navigation & Seamanship cert (ATG)",VACAPES,Y,,,"[MOB-N]",TENTATIVE,251630ZOCT26,"slip from CMAV extension",
```

Use synthetic hulls and names only, so the file is not mistaken for a real schedule.

#### (b) Daily department status report [PROPOSED], free text rendered to PDF
Modeled on the Eight O'Clock Reports and department-head status.

- **Header:** `USS EXAMPLE (DDG XXX) – DAILY DEPARTMENT STATUS / EIGHT O'CLOCK REPORT – DTG 042000R NOV 26 – Status: INPORT NORFOLK / UNDERWAY VACAPES – CDO/OOD: ____`
- **Sections:**
  - Commanding Officer's notes / XO summary
  - Operations (OPS): sensors (SPY, SPS-67, navigation radars), comms/SATCOM, Link 16, upcoming events and SOE status
  - Combat Systems (CSD): Aegis, VLS, CIWS, 5-in gun, SQQ-89/sonar, magazine status
  - Engineering (ENG): GTMs/GTGs on line or available, fuel percentage, potable water, firemain, DC equipment, open CASREPs by number, EOOW watch bill health
  - Supply (SUP): parts on order (DTG and ETA), food stores days, LOGREQ status
  - Navigation (NAV)
  - Admin/Medical: manning, losses or gains, quals pending (e.g., "2 of 3 CIC Watch Supervisors qualified")
  - Training: upcoming ATG events, drills completed
  - Safety/Material: PMS completion %, tag-outs
  - Signature block: department head
- **Style:** Mixed prose with abbreviations, plus some bullets. Each department references its open CASREPs ("CASREP 26-014 SPS-73 C-2, part ETA 12 NOV"). Include a sentence of narrative uncertainty, for example "tech assist from RMC scheduled Thursday, may slip." This gives the NLP extraction something realistic to work on.

#### (c) Mission/event list with required capabilities [PROPOSED], JSON
`event_id, event_name, event_type {CERT|ASSESSMENT|EXERCISE|DEPLOYMENT|TRANSIT|MAINT_EXIT}, ofrp_phase, start, end, oparea, certifying_authority (ATG / TYCOM / ISIC / CSG / C2F-C3F), prerequisite_events[] (e.g., COMPTUEX <- BASIC_PHASE_COMPLETE <- CREW_CERT <- LOA), required_systems[] {system, min_status (FMC/PMC), mission_area}, required_watch_teams[] {team, min_qualified_count}, required_stores (fuel %, ordnance load), consequence_if_missed (slip days / re-cert), notes`

Example dependency chain to encode:

`MRG assessment -> LOA -> crew cert -> dock trials/fast cruise -> nav assessment -> sea trials -> Basic Phase mission-area certs (~18-23 areas) -> Group Sail/SWATT -> COMPTUEX -> deployment`

### Gaps
- None of the formats above are validated against real Navy exports. Before the demo, ask a SWO or Ops Officer on the team or among the mentors to sanity-check the field names and codes.
- No public mission-area code list (e.g., MOB-N, MOB-E, AMW, ASW, SUW, CCC) was confirmed in the current SFTRM. Treat any such codes as illustrative **[UNVERIFIED]**.
