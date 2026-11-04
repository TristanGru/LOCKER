# R-ADM (NTCSS Relational Administration / "Relational Administrative Data Management"): shipboard personnel and qualification data for MissionTwin

Research date: 2026-11-04. Many primary Navy PDFs (navy.mil portals, allhands, gdmissionsystems, mynavyhr, manuallib) returned HTTP 403 to automated fetch. Where noted, a finding comes from a search-engine summary of the document, not a full read. Most of the sources that describe R-ADM in detail are dated 2012 to 2018.

## Q1. What is R-ADM, does "RAD-M" mean it, who uses it, and how does it relate to NTCSS, OMMS-NG, R-Supply and shore personnel systems?

### Takeaway
"RAD-M" almost certainly means R-ADM. R-ADM is the personnel-administration application in the Naval Tactical Command Support System (NTCSS) suite, alongside R-Supply (supply) and OMMS-NG (maintenance). Its official Privacy Act name is "NTCSS Relational Administration (R-ADM)." Surface Force training manuals expand it as "Relational Administrative Data Management" and make it the authoritative afloat database for PQS, qualifications, certifications and watchbills.

### Cited Findings
- Official system name: "Naval Tactical Command Support System (NTCSS) Relational Administration (R-ADM)." Privacy Act system of records notice N01070-16, 77 FR 29619, May 18, 2012 (dated). — [GovInfo FR 2012-12045](https://www.govinfo.gov/content/pkg/FR-2012-05-18/html/2012-12045.htm); [DoD SORN index N01070-16](https://pclt.defense.gov/DIRECTORATES/Privacy-and-Civil-Liberties-Directorate/Privacy/SORNsIndex/Article/4008604/n01070-16/)
- The notice says NTCSS "is an information system for the management of supply, maintenance, and personnel administration" for ships, submarines, aviation squadrons and intermediate maintenance activities. It also says "the R-ADM application serves as the afloat personnel management system." — [GovInfo FR 2012-12045](https://www.govinfo.gov/content/pkg/FR-2012-05-18/html/2012-12045.htm)
- System location: "United States Navy ships and submarines." Covered individuals: "United States Navy commissioned and enlisted personnel." — [GovInfo FR 2012-12045](https://www.govinfo.gov/content/pkg/FR-2012-05-18/html/2012-12045.htm)
- The Surface Force Training and Readiness Manual (COMNAVSURFPAC/COMNAVSURFLANTINST 3502.7, Nov 2018) uses the expansion "Relational Administrative Data Management (R-ADM)." It says "each individual will be qualified or interim qualified per Relational Administrative Data Management (R-ADM)" (search-engine summary; the full PDF returned 403). — [SFTRM 3502.7 (allhands.navy.mil)](https://allhands.navy.mil/Portals/1/Optask/references/COMNAVSURFPAC_COMNAVSURFLANTINST-3502_7-1Nov18-Surface_Force_Training_Readiness_Manual.pdf?ver=W4gxIOXq_F2u55iCVjiVzQ%3D%3D)
- The same manual says "R-ADM is designated as the authoritative database for afloat activities with the Naval Tactical Command Support System (NTCSS) suite to capture individual unit-level training, including PQS, qualifications, and certifications." (search summary) — [SFTRM 3502.7](https://allhands.navy.mil/Portals/1/Optask/references/COMNAVSURFPAC_COMNAVSURFLANTINST-3502_7-1Nov18-Surface_Force_Training_Readiness_Manual.pdf?ver=W4gxIOXq_F2u55iCVjiVzQ%3D%3D)
- "Ships that do not have R-ADM may choose their method of tracking PQS." R-ADM is therefore not installed on every unit. (search summary) — [SFTRM 3502.7](https://allhands.navy.mil/Portals/1/Optask/references/COMNAVSURFPAC_COMNAVSURFLANTINST-3502_7-1Nov18-Surface_Force_Training_Readiness_Manual.pdf?ver=W4gxIOXq_F2u55iCVjiVzQ%3D%3D)
- Users and roles: the Engineering Department Organization and Regulations Manual tells the department to "Review the administrative or Relational Admin (R-ADM) or program of record (POR) database periodically to ensure that all departmental personnel are entered correctly by duty section, division, and work center" and that each person has the required PQS assignments. This shows department heads, division officers and work-center supervisors maintaining R-ADM data, not only the admin office. (search summary) — [Naval Safety Command, Engineering Dept ORM](https://navalsafetycommand.navy.mil/portals/100/documents/Engineering-Dept-Organization-Regulations-Manual.pdf)
- Relationship to NOBLE: the NTCSS budget line (PE 0604231N) also covers the Naval Operational Business Logistics Enterprise (NOBLE) family, which includes the Naval Operational Supply System (NOSS) and Naval Maintenance, Repair and Overhaul (N-MRO). NOSS is meant to replace legacy supply systems such as NTCSS R-Supply. A 2016 notice said NTCSS must move from client-server to "a modern and sustainable solution set." (search summaries of the budget justification books and a SAM notice; the PDFs returned 403) — [PB2020 RDT&E 0604231N](https://www.globalsecurity.org/military/library/budget/fy2020/navy-peds/U_0604231N_5_PB_2020.pdf); [SAM Daily, Dec 2016](https://samdaily.us/archive/2016/12-December/22-Dec-2016/FBO-04356941.htm); [GovConWire on Palantir NOBLE IDE](https://www.govconwire.com/articles/palantir-to-provide-integrated-data-environment-for-noble-system-under-navy-contract)
- Relationship to NSIPS: a MyNavy HR career counselor guide (NAVPERS 15878N, Sep 30, 2024) reportedly says R-ADM and "ASM" data "is not accepted by NSIPS and is not documented in the ESR [Electronic Service Record]." It notes that NSIPS Web Afloat is available on most surface ships, and that disconnected afloat application data is "refreshed" through "replication." (search summary; the PDF returned 403) — [NAVPERS 15878N](https://www.mynavyhr.navy.mil/Portals/55/Career/CareerCounseling/CCC%20NAVPERS%2015878N%20-%20UPDATE.pdf)
- NSIPS Web Afloat is still a current shipboard path. An August 2025 NAVADMIN gives separate procedures for "NSIPS Web Afloat users and commands without access to NSIPS." — [NAVADMIN 184/25](https://www.mynavyhr.navy.mil/Portals/55/Messages/NAVADMIN/NAV2025/NAV25184.pdf?ver=OKC4P-obQleuV6cWKUKbLA%3D%3D)

### Other plausible meanings of "RAD-M" / "RADM"
- **RADM = Rear Admiral** (upper half, O-8), the standard Navy rank abbreviation. This is the most common Navy use of "RADM," but it is not a system. (General Navy usage; no specific source fetched.)
- **R-ADM spelled "RADM" in informal sources.** Job postings list "RADM" with TORIS and NTMPS/FLTMPS as surface training systems, so "RADM" with no hyphen often means the same application. — [search results incl. ClearanceJobs postings](https://www.clearancejobs.com/jobs/8384304)
- I found no other Navy information system called "RAD-M."

### Inferences
- Treat R-ADM as the NTCSS "personnel/training" sibling of OMMS-NG (maintenance) and R-Supply (supply). A MissionTwin data model that mirrors NTCSS would have three source feeds: R-ADM for people and quals, OMMS-NG/SKED for maintenance, and R-Supply plus CASREPs for supply and equipment.
- R-ADM is a shipboard "local" system. NSIPS/ESR (pay and personnel record) and FLTMPS/NTMPS (shore training records and NEC manning) are the authoritative shore systems for most personnel facts.

### Gaps
- No public R-ADM user manual, data dictionary or screen list was found.
- What "ASM" expands to in NAVPERS 15878N was not confirmed. Possibly an aviation squadron administrative/maintenance tool; unverified.
- Which program office currently owns R-ADM was not confirmed from a fetched page. Historically NTCSS was under SPAWAR / PEO EIS / NAVWAR; unverified for 2026.

## Q2. What data does R-ADM hold?

### Takeaway
Official sources confirm demographic, personnel, medical, education and military-record data. Training sources confirm PQS progress, interim and final qualifications, certifications, watchbills, duty-section, division and work-center assignment. The SORN names the Navy Training Management & Planning System (NTMPS) as a record source. No public field-level schema exists.

### Cited Findings
- Records listed in the SORN: "Name, Social Security Number (SSN), gender, race/ethnicity, birth date, place of birth, home telephone number." The list continues with personal email, mailing/home address, religious preference, security clearance, spouse information, marital status, dependent child information, medical information, military records and education information. — [GovInfo FR 2012-12045](https://www.govinfo.gov/content/pkg/FR-2012-05-18/html/2012-12045.htm)
- Retrieval keys: "Name and Social Security Number (SSN)." — [GovInfo FR 2012-12045](https://www.govinfo.gov/content/pkg/FR-2012-05-18/html/2012-12045.htm)
- Record sources: "Individual and Navy Training Management & Planning System." This points to a shore-to-ship training data feed. — [GovInfo FR 2012-12045](https://www.govinfo.gov/content/pkg/FR-2012-05-18/html/2012-12045.htm)
- Retention: "Retain on board. Destroy when personnel are transferred, separated, or when no longer needed, whichever is earlier." — [GovInfo FR 2012-12045](https://www.govinfo.gov/content/pkg/FR-2012-05-18/html/2012-12045.htm)
- Safeguards: "System is protected and controlled using encryption and passwords." — [GovInfo FR 2012-12045](https://www.govinfo.gov/content/pkg/FR-2012-05-18/html/2012-12045.htm)
- Qualification data: individual unit-level training, PQS, qualifications and certifications. Qualification states include "qualified" and "interim qualified." — [SFTRM 3502.7](https://allhands.navy.mil/Portals/1/Optask/references/COMNAVSURFPAC_COMNAVSURFLANTINST-3502_7-1Nov18-Surface_Force_Training_Readiness_Manual.pdf?ver=W4gxIOXq_F2u55iCVjiVzQ%3D%3D)
- A student study aid (not authoritative) says R-ADM tracks "progress, interim qualification, or Final Qualification for shipboard personnel PQS." — [Brainscape ATS flashcards](https://www.brainscape.com/flashcards/10370055/packs/18574076)
- Watchbills: "all watchbills will be created, managed, and maintained in R-ADM or another program that pulls data directly from the R-ADM database." — [SFTRM 3502.7](https://allhands.navy.mil/Portals/1/Optask/references/COMNAVSURFPAC_COMNAVSURFLANTINST-3502_7-1Nov18-Surface_Force_Training_Readiness_Manual.pdf?ver=W4gxIOXq_F2u55iCVjiVzQ%3D%3D) (also quoted in the [Brainscape flashcards](https://www.brainscape.com/flashcards/10370055/packs/18574076))
- Organization fields: personnel are assigned "by duty section, division, and work center" with "required PQS assignments." — [Engineering Dept ORM](https://navalsafetycommand.navy.mil/portals/100/documents/Engineering-Dept-Organization-Regulations-Manual.pdf)
- PQS definition: "a compilation of the minimum knowledge and skills that an individual must demonstrate in order to qualify to stand watches or perform other specific routine duties." — [NAVEDTRA 43512-2 PQS, Sep 2024](https://navalsafetycommand.navy.mil/Portals/100/Documents/PQS_43512-2_Personnel_Working_Aloft.pdf)
- PQS standards are identified by NAVEDTRA numbers, for example NAVEDTRA 43512-1 (Fall Protection) and 43512-2 (Personnel Working Aloft), both Sep 2024. — [NAVEDTRA 43512-1](https://navalsafetycommand.navy.mil/Portals/100/Documents/PQS_43512-1_Fall_Protection.pdf); [NAVEDTRA 43512-2](https://navalsafetycommand.navy.mil/Portals/100/Documents/PQS_43512-2_Personnel_Working_Aloft.pdf)
- PQS watchstation line items are numbered, for example 2200 Lookout, 2300 Helmsman, 2400 QMOW (Quartermaster of the Watch) and 2500 Boatswain's Mate of the Watch. (Example PQS documents hosted by a Sea Cadet unit; they mirror the Navy PQS numbering style.) — [2200 Lookout](https://nscsgrayfox.org/Documents/PQS/2200%20Lookout.pdf); [2300 Helmsman](https://www.nscsgrayfox.org/Documents/PQS/2300%20Helmsman.pdf); [2400 QMOW](https://nscsgrayfox.org/Documents/PQS/2400%20QMOW%20Quartermaster%20Of%20The%20Watch.pdf); [2500 BMOW](https://www.nscsgrayfox.org/Documents/PQS/2500%20Boatswains%20Mate%20Of%20The%20Watch.pdf)

### Inferences
- PRD, EAOS, rate/rating, NEC and onboard/TAD/transfer status almost certainly sit in R-ADM under "military records." They are mastered in NSIPS/ESR and FLTMPS/NTMPS, then replicated or entered locally. I found no public source listing these exact R-ADM fields.
- Because R-ADM data "is not accepted by NSIPS," shipboard quals in R-ADM and shore records can diverge. That gives MissionTwin a realistic data-quality scenario to model.

### Gaps
- Field-level schema, table names and code values (for example the exact status enumeration beyond qualified, interim and final) are not public.
- Whether R-ADM stores an NEC billet-requirements table or only holdings was not confirmed. FLTMPS/NTMPS is cited as the NEC-requirement source (see Q4).

## Q3. Which systems track qualification and training readiness, and which is authoritative for "is this sailor qualified for watchstation X"?

### Takeaway
For afloat surface units on NTCSS, policy names R-ADM as authoritative for PQS, watchstation qualifications and certifications, and for watchbills. FLTMPS/NTMPS is the shore authority for formal school training and NEC requirements and manning. TORIS/TFOM covers unit and team training readiness. STRMS is a newer CANES-hosted tool for watchstander proficiency and watchbill design.

### Cited Findings
- R-ADM is authoritative afloat for individual PQS, quals and certifications (SFTRM 2018). — [SFTRM 3502.7](https://allhands.navy.mil/Portals/1/Optask/references/COMNAVSURFPAC_COMNAVSURFLANTINST-3502_7-1Nov18-Surface_Force_Training_Readiness_Manual.pdf?ver=W4gxIOXq_F2u55iCVjiVzQ%3D%3D)
- FLTMPS: "Tracks training completion utilizing Fleet Training Management and Planning System (FLTMPS)" (job-listing language). A BUMED instruction requires PQS completion documentation to be uploaded into NSIPS, Navy Medicine LMS and FLTMPS for reservists. — [ZipRecruiter FLTMPS jobs](https://www.ziprecruiter.com/Jobs/Fltmps/2); [BUMEDINST 1510.27](https://www.med.navy.mil/Portals/62/Documents/BUMED/Directives/Instructions/1510.27.pdf)
- The legacy Surface Force Training Manual (dated, 1990s-2000s, FAS mirror) calls PQS the Navy's standard program for qualifying watchstanders. It says the PQS reference should determine "which data elements will be displayed on any automated tracking system." — [SFTM Ch3 Sec3 (FAS)](https://man.fas.org/dod-101/navy/docs/sftm/Ch3sec3.html)
- STRMS (Surface Training and Readiness Management System) was developed by Aptima for Surface Combat Systems Training Command (2022 news). It is a tool for "assessing, monitoring, and reporting the readiness of Surface Warfighters." — [Aptima](https://aptima.com/?p=18733); [Veterans News Report, Jun 2022](https://www.veteransnewsreport.com/2022/06/13/aptima-surface-training-readiness-management-system-us-navy/); [ExecutiveBiz](https://www.executivebiz.com/articles/aptima-to-provide-navy-with-surface-training-and-readiness-management-system)
- General Dynamics' STRMS datasheet describes "individual watchstander qualification/experience/proficiency and watchbill tracking," "efficient watchbill design with embedded qualification tracking," and individual and team proficiency scores. It says "STRMS is a platform hosted locally on the ship's CANES network" with a current ATO, CANES certified. (search summary; the datasheet returned 403) — [GD STRMS datasheet](https://gdmissionsystems.com/-/media/general-dynamics/maritime-and-strategic-systems/pdf/surface-training-readiness-management-system-strms-datasheet.ashx); [GD STRMS page](https://gdmissionsystems.com/shipboard-integration-and-combat-systems/strms)
- NAVSEA PMS 339 (Surface Training Systems) lists a division "Responsible for Combat Systems Trainers, Ready Relevant Learning (RRL) support and the Surface Training Readiness Management System (STRMS)." — [NAVSEA 21 Surface Training Systems](https://www.navsea.navy.mil/serve-from-netstorage/Home/Team-Ships/NAVSEA-21/Surface-Training-Systems/index.html)
- Job postings list STRMS alongside TORIS, RADM and NTMPS/FLTMPS, which suggests they coexist. They do not show how the systems interconnect. — [ClearanceJobs posting](https://www.clearancejobs.com/jobs/8384304)

### Inferences
- In a 2026 surface ship, the realistic answer to "who is qualified for watchstation X" is R-ADM, or STRMS or another POR tool that pulls from R-ADM. Formal school and NEC data comes from FLTMPS/NTMPS. MissionTwin should label R-ADM-style data as the "watchstation qual" source and FLTMPS-style data as the "NEC/school" source.

### Gaps
- Whether STRMS reads from or replaces R-ADM is unconfirmed (only a study-aid source exists).
- eNTRS, Navy eLearning and MyNavy Portal roles in shipboard qualification tracking were not substantiated by any fetched source.
- Aviation and submarine equivalents (for example squadron systems and submarine training tools) were not researched.

## Q4. How does crew qualification feed readiness reporting (DRRS-N, PESTO)?

### Takeaway
DRRS-N reports resource readiness in PESTO pillars (Personnel, Equipment, Supply, Training, Ordnance, plus Facilities in some documents). The Personnel pillar draws on FLTMPS/NTMPS for NEC requirements and manning. The surface Training pillar flows TORIS to NTIMS to DRRS-N, with TFOM as the core metric. No source shows R-ADM feeding DRRS-N directly.

### Cited Findings
- DRRS-N displays resource data for personnel, equipment, supply, training and ordnance (PESTO). Some documents add facilities (PESTOF). (search summaries of NTRP 1-03.5 Feb 2016 and SFTRM) — [NTRP 1-03.5 (Feb 2016)](https://elearning.sabresystems.com/drrsS/instructions/NTRP%201-03.5%20DRRS-N%20REPORTING%20MANUAL%20EDITION%20FEBRUARY%202016.pdf); [CVN PESTO training deck](https://nanopdf.com/download/cvn3pesto-sabrewebhostingcom_pdf)
- NEC requirements: "FLTMPS/NTMPS is primary source." Personnel shortfalls, including critical NEC and school deficiencies, are reported into DRRS-N. (search summary) — [COMNAVSURFORINST 3502.1D](https://navytribe.com/wp-content/uploads/2015/11/comnavsurforinst-3502-1d-1.pdf)
- Surface training values come from TORIS, which feeds NTIMS, which feeds DRRS-N. TFOM (Training Figure of Merit) is the core training metric. Squadrons' T-pillar values are computed by NTIMS. (search summary; dated 2015-2023) — [COMNAVSURFORINST 3502.1D](https://navytribe.com/wp-content/uploads/2015/11/comnavsurforinst-3502-1d-1.pdf); [DRRS-S PXO presentation, Jan 2023](https://elearning.sabresystems.com/drrsS/presentations/DRRS-S%20PXO%20Presentation_01Jan2023.pdf)

### Inferences
- For MissionTwin: model the Personnel pillar from roster vs. billet NEC fill (FLTMPS-style), and the Training pillar from TFOM-like team and exercise currency (TORIS-style). Use individual watchstation quals (R-ADM-style) as the watchbill-depth driver, for example "number of qualified OODs or EOOWs ≥ 3 for a three-section watch."

### Gaps
- The current NTRP 1-03.5 edition (post-2016) and exact pillar computation formulas were not retrieved. The sabresystems host was unreachable.

## Q5. Export, report and interface formats

### Takeaway
Public evidence covers only replication (periodic refresh of disconnected afloat application data with shore) and the SORN's NTMPS-to-R-ADM source. Watchbills are produced "in R-ADM or another program that pulls data directly from the R-ADM database." No public file or export formats were found.

### Cited Findings
- Afloat applications are disconnected, so their data is "refreshed" periodically through "replication" (NAVPERS 15878N, 2024, search summary). — [NAVPERS 15878N](https://www.mynavyhr.navy.mil/Portals/55/Career/CareerCounseling/CCC%20NAVPERS%2015878N%20-%20UPDATE.pdf)
- Third-party programs may pull directly from the R-ADM database to build watchbills. — [SFTRM 3502.7](https://allhands.navy.mil/Portals/1/Optask/references/COMNAVSURFPAC_COMNAVSURFLANTINST-3502_7-1Nov18-Surface_Force_Training_Readiness_Manual.pdf?ver=W4gxIOXq_F2u55iCVjiVzQ%3D%3D)
- The record source includes the "Navy Training Management & Planning System." — [GovInfo FR 2012-12045](https://www.govinfo.gov/content/pkg/FR-2012-05-18/html/2012-12045.htm)

### Inferences
- "Relational" in the name and "pulls data directly from the R-ADM database" both point to a relational database back end that other tools query. For a hackathon, CSV or JSON exports keyed by a pseudonymous member ID (never SSN) are a reasonable stand-in, but this is not documented R-ADM behavior.

### Gaps
- No public report catalog (for example "qual status by work center" or "PQS delinquency report") or interface control document was found.

## Q6. Current status and modernization (as of Nov 2026)

### Takeaway
No public source found announces an R-ADM sunset date or a named replacement. NOBLE (NOSS for supply, N-MRO for maintenance) is replacing NTCSS logistics functions. Personnel functions are moving toward NSIPS Web Afloat and MyNavy HR, and STRMS is growing on the training and proficiency side. R-ADM's 2026 status is unverified.

### Cited Findings
- NOBLE includes NOSS and N-MRO. NOSS targets replacement of legacy supply systems such as R-Supply. — [PB2020 0604231N](https://www.globalsecurity.org/military/library/budget/fy2020/navy-peds/U_0604231N_5_PB_2020.pdf); [PR Newswire, One Network NOSS award](https://prnewswire.com/news-releases/the-united-states-navy-awards-43-million-contract-to-one-network-enterprises-for-the-naval-operational-business-logistics-enterprise-noble-naval-operational-supply-system-noss-301166187.html)
- Palantir is providing the integrated data environment for NOBLE. — [GovConWire](https://www.govconwire.com/articles/palantir-to-provide-integrated-data-environment-for-noble-system-under-navy-contract)
- NSIPS Web Afloat was in active use in 2025, and R-ADM was still referenced in 2024 MyNavy HR guidance. — [NAVADMIN 184/25](https://www.mynavyhr.navy.mil/Portals/55/Messages/NAVADMIN/NAV2025/NAV25184.pdf?ver=OKC4P-obQleuV6cWKUKbLA%3D%3D); [NAVPERS 15878N](https://www.mynavyhr.navy.mil/Portals/55/Career/CareerCounseling/CCC%20NAVPERS%2015878N%20-%20UPDATE.pdf)
- The NSIPS sustainment bridge contract went to GDIT, with the replacement award expected around Apr-May 2025. (secondary news aggregator) — [OrangeSlices](https://orangeslices.ai/competition-delays-force-us-navy-to-award-50m-standard-integrated-personnel-system-nsips-support-contract-to-gdit/)

### Inferences
- Since NOBLE's public scope is supply and maintenance, R-ADM is probably not directly replaced by NOBLE. This is my inference, not stated in any source.

### Gaps
- No 2025-2026 source confirms whether R-ADM is still fielded, sunset or folded into another tool. FY2025-FY2027 budget books were not retrieved.

## Q7. Realistic synthetic crew roster and qualification export (for the generator)

### Takeaway
The column set below is modeled on the data categories the sources confirm: duty section, division, work center, PQS assignment, qualification status (qualified, interim, final), NEC, rate, PRD and EAOS. It is a synthetic design, not a real R-ADM export layout, which is not public. The NEC format is confirmed: four alphanumeric characters since Oct 2017.

### Cited Findings
- NEC format (NAVADMIN 174/17): "Beginning in October 2017, NEC codes will have four alpha-numeric characters" and are grouped into 12 communities and 23 career fields. The first character is the community, characters 2-3 are unique IDs assigned by the Navy Manpower Analysis Center, and the 4th shows remaining training blocks. The press release gives the example that legacy NEC 2800 (LS Postal Basic) becomes "S000." — [Navy Times, Jul 2017](https://www.navytimes.com/news/your-navy/2017/07/13/navy-overhauls-enlisted-rating-structure-and-nec-codes/); [Wikipedia: Navy Enlisted Classification](https://en.wikipedia.org/wiki/Navy_Enlisted_Classification); [navy.mil press release](https://www.navy.mil/Press-Office/Press-Releases/display-pressreleases/Article/2252290/navy-announces-nec-code-overhaul-and-updated-enlisted-rating-communities-and-ca)
- Organizational keys: duty section, division and work center. — [Engineering Dept ORM](https://navalsafetycommand.navy.mil/portals/100/documents/Engineering-Dept-Organization-Regulations-Manual.pdf)
- Qual status vocabulary: in progress, interim qualified, final qualified. — [SFTRM 3502.7](https://allhands.navy.mil/Portals/1/Optask/references/COMNAVSURFPAC_COMNAVSURFLANTINST-3502_7-1Nov18-Surface_Force_Training_Readiness_Manual.pdf?ver=W4gxIOXq_F2u55iCVjiVzQ%3D%3D); [Brainscape](https://www.brainscape.com/flashcards/10370055/packs/18574076)
- Watchstation and PQS examples: Lookout (2200), Helmsman (2300), QMOW (2400), BMOW (2500). — [nscsgrayfox PQS docs](https://nscsgrayfox.org/Documents/PQS/2200%20Lookout.pdf)

### Inferences: proposed synthetic schema (all values synthetic; do not use SSNs)
**roster.csv**: `member_id` (synthetic, for example M000123), `last_name`, `first_name`, `paygrade` (E1-E9, W2-W5, O1-O6), `rate` (rating + paygrade, for example FC2, STG1, GM3, BM2, ET1, OS3, MM1, GSM2, EM2, HT3, LS2, YN2, HM1, CS3, IT2, QM2; chiefs FCC/STGC/BMC; officers ENS/LTJG/LT/LCDR), `rating` (FC, STG, ...), `department` (OPS, CS (Combat Systems), ENG, DECK/WEPS, SUPPLY, ADMIN/EXEC, NAV, MED), `division` (for example CF, CO, OI, E, M, A, R, 1st DIV, S-1), `work_center` (for example CF01, EA02 style), `duty_section` (1-6), `status` (ONBOARD, TAD, LEAVE, TRANSFERRED, GAINING, IN-SCHOOL, MEDICAL, LIMDU), `report_date`, `prd` (YYYY-MM-DD; typically 24-48 months after report_date for sea duty), `eaos` (YYYY-MM-DD), `nec_primary`, `nec_secondary` (four-character alphanumeric per the 2017 format, for example S000-style; generate plausible codes, since real code lists were not retrieved).

**quals.csv**: `member_id`, `pqs_ref` (for example NAVEDTRA 43xxx-xx), `watchstation_code` (for example 2200, 2300, 3xx), `watchstation_name` (Lookout, Helmsman, Lee Helm, QMOW, BMOW, JOOD, OOD, CIC Watch Officer, EOOW, Sounding & Security, Fire Team Leader, etc.), `status` (NOT_STARTED, IN_PROGRESS, INTERIM, QUALIFIED, EXPIRED/REVOKED), `pct_complete`, `interim_date`, `final_qual_date`, `qualifier_id`, `approved_by` (CO/DH role), `requalification_due`.

**watchbill.csv**: `date`, `watch_period` (for example 0000-0400), `condition` (III/II/I), `watchstation_name`, `section`, `member_id`. Policy requires each assignee to be qualified or interim qualified per R-ADM, so a MissionTwin rule check is "assignee status in {INTERIM, QUALIFIED}."

**nec_billets.csv** (FLTMPS-style): `billet_id`, `work_center`, `required_rate`, `required_nec`, `filled_by_member_id`. Readiness signal: NEC fill gaps and PRD cliffs (multiple critical NEC holders leaving within 90 days).

### Gaps
- No authentic sample export, column header or status code list from R-ADM is publicly available. The schema above is a designed approximation.
- Actual current NEC codes for specific ratings (for example FC Aegis NECs) were not retrieved; the NEC manual NAVPERS 18068 was not fetched.
- Watchbill and SORM requirements (OPNAVINST 3120.32 series) and the PQS program instruction (OPNAVINST 3500.34 series) were not retrieved in this pass.
