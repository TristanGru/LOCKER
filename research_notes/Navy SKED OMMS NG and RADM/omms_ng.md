# OMMS-NG (Organizational Maintenance Management System - Next Generation): fact sheet for MissionTwin synthetic data

Research date: 2026-11-04. Research method note: most authoritative primary documents (NAVSEAINST 4790.8 Ships' 3-M Manual, JFMM, GAO-24-106525 full PDF, NAVSEA SERMC Capabilities Manual) were either 403-blocked or returned as compressed PDF binaries that could not be text-extracted in this environment. Several findings therefore rest on search-result excerpts of those documents rather than full reads; this is flagged per finding. No current (2026) primary source on OMMS-NG status was found.

## 1. Acronym interpretation, purpose, users, and relation to NTCSS / R-Supply / R-ADM

### Takeaway
"OMNS" almost certainly means OMMS-NG, the NTCSS shipboard maintenance application used since 2001 to document and report material deficiencies (2-Kilos / CSMP). It sits alongside R-Supply (supply/finance) and R-ADM (personnel, training, qualifications) in the NTCSS suite, and it is being replaced, unevenly, by AWN and ultimately by NOBLE's N-MRO.

### Cited Findings
- Expansion: "Organizational Maintenance Management System - Next Generation (US Navy)" — [Acronym Finder](https://www.acronymfinder.com/Organizational-Maintenance-Management-System-_-Next-Generation-(US-Navy)-(OMMS_NG).html). GAO uses the same expansion: "Organizational Maintenance Management System-Next Generation (OMMS-NG)" — [GAO-24-106525 (Sep 2024), via search excerpt](https://www.gao.gov/assets/gao-24-106525.pdf)
- Alternative expansion seen: a 3-M training document on Scribd calls it "Operational Maintenance Management System" and lists it alongside PMS, IEM (Inactive Equipment Maintenance), and MDS (Maintenance Data System) as 3-M subsystems/tools. This is low-authority — [Scribd 3M-301](https://www.scribd.com/doc/76030748/3M-301)
- The Navy began using OMMS-NG in 2001 "to document and report shipboard material deficiencies" — [GAO-24-106525, via search excerpt](https://www.gao.gov/assets/gao-24-106525.pdf)
- OMMS-NG is described as a computer program for tracking corrective and preventive maintenance and "putting in jobs" — [Scribd 3M-301](https://www.scribd.com/doc/76030748/3M-301)
- NTCSS includes Relational Supply (RSupply), OMMS-NG, and NALCOMIS. OMMS-NG gives Navy maintenance personnel access to maintenance information for ship readiness. R-ADM is the authoritative personnel database for afloat NTCSS activities and tracks training and qualifications — [DON CIO CHIPS article (archived, ~2010s, dated), via search excerpt](https://webarchive.library.unt.edu/web/20170125022744/http:/www.doncio.navy.mil/(cyg51dffug4mbb45uqya2y45)/CHIPS/ArticleDetails.aspx?ID=4354)
- NTCSS came from merging SNAP (Shipboard Non-Tactical ADP Program), NALCOMIS, and Maintenance Resource Management. Its functions cover administrative data, maintenance resource management, supply and financial management, and medical support — [same CHIPS article, via search excerpt](https://webarchive.library.unt.edu/web/20170125022744/http:/www.doncio.navy.mil/(cyg51dffug4mbb45uqya2y45)/CHIPS/ArticleDetails.aspx?ID=4354)
- NTCSS started in 1995 to help Navy personnel manage ship, submarine, and aircraft support activities. GAO called it a risky program — [GAO-06-215 (2005/2006, dated)](https://www.gao.gov/assets/a248695.html)
- Navy budget exhibits (PE 0604231N) describe NTCSS running on the shipboard ISNS network, with a web-enablement initiative toward an enterprise database — [FY2005 PE 0604231N (dated)](https://www.globalsecurity.org/military/library/budget/fy2005/navy-peds/0604231N.pdf)
- Contractor job postings describe OMMS-NG work as coordinating, entering, tracking, closing, and analyzing "maintenance and supply data in U.S. Navy OMMS-NG, R-Supply reports, and Microsoft Excel worksheets." This points to a close operational coupling of OMMS-NG with R-Supply and to Excel as the de facto export/analysis medium — [Military Spouse Jobs posting: Process Control Analyst, OMMS-NG](https://militaryspouse.dejobs.org/jacksonville-fl/process-control-analyst-us-navy-omms-ng/1DEC57136032487E84E27C90DFE25E91/job)
- Aviation analogue: NALCOMIS / NTCSS Optimized OMA is the aviation organizational maintenance system and is covered by NAMP Chapter 13, not by OMMS-NG — [NAMP Ch 13 NALCOMIS NTCSS OMA](https://navalsafetycommand.navy.mil/Portals/100/Documents/13-NAMP%20CH%2013-NALCOMIS_NTCSS_OMA.pdf)

### Inferences
- "OMNS" is most plausibly a mishearing or typo of OMMS-NG. Other candidates the team might mean:
  - (a) OMMS, the pre-NG Organizational Maintenance Management System under SNAP.
  - (b) AWN (Automated Work Notification), the OMMS-NG replacement on many ships.
  - (c) NALCOMIS OMA, if the context is aviation squadrons.
  - (d) NOME (Naval Operational Maintenance Environment), the NOBLE successor requirement.
  No Navy system named "OMNS" was found.
- Roles by convention: the work center supervisor (WCS) originates 2-Kilos and assigns job sequence numbers (see section 2), the division officer and department head review them, and the 3-M Coordinator manages the ship's 3-M program and CSMP. The 3-M Coordinator role is standard 3-M terminology, but its OMMS-NG-specific permissions were not confirmed in a fetched source.
- For MissionTwin, the three NTCSS apps map cleanly to its inputs: OMMS-NG maps to the maintenance backlog/CSMP, R-Supply to parts and requisition status, and R-ADM to crew qualifications. The planned maintenance schedule comes from SKED, which is separate (see section 5).

### Gaps
- No current NAVWAR/PEO MLB page describing OMMS-NG was found or fetched.
- The exact role-based permissions inside OMMS-NG (for example, the 3-M coordinator approval workflow) were not confirmed from a primary source.

## 2. Data held: 2-Kilo, CSMP, JCN, deferrals, configuration, parts, CASREP linkage

### Takeaway
The atomic record is the OPNAV 4790/2K (Ship's Maintenance Action Form, the "2-Kilo"). Its Blocks 1-3 form the JCN: a 5-character UIC, a 4-character work center, and a 4-digit job sequence number. Deferred 2-Kilos make up the CSMP. Each 2-Kilo is written against an equipment configuration record (APL / EIC / location) and carries priority, type-availability and remarks fields, with the CASREP date-time group in remarks when the job documents a casualty.

### Cited Findings
- JCN = Blocks 1-3 of the 2-Kilo: "these blocks form the JOB CONTROL NUMBER (JCN). From day one the job will always be identified by this combination" — [NAVSEA SERMC Capabilities Manual (22 Apr 2022), via search excerpt](https://www.navsea.navy.mil/Portals/103/Documents/SERMC/Capabilities%20Manual%2022APR2022.pdf)
- Block 1 is the Ship's UIC (5 characters, described as numeric). Block 2 is the work center code (4 alphanumeric characters, left-justified). Block 3 is the job sequence number (JSN), assigned by the work center supervisor and typically 4 numeric characters — [NAVSEAINST 4790.8B (dated, superseded) and related, via search excerpts](https://upload.wikimedia.org/wikipedia/commons/4/48/04790-008C_CH-1.pdf); [TPub ET manual Fig 13-15](https://electronicstechnician.tpub.com/14344/Figure-13-15-Ship-S-Maintenance-Action-Form-Opnav-4790-2K-479.html)
  - Caution: the Navy UIC is commonly an alphanumeric "N12345" form, so "5 numeric" likely refers to the 5 digits after the N. This is unconfirmed.
- "THE 4790/2K DOCUMENTS A DEFERRED MAINTENANCE ACTION. WITHOUT IT, WORK WILL NOT BE ENTERED." (in the context of SERMC accepting work) — [NAVSEA SERMC Capabilities Manual (8 Feb 2023), via search excerpt](https://www.navsea.navy.mil/Portals/103/Documents/SERMC/Capabilities%20Manual%208FEB2023.pdf)
- Block 41 is the Priority code. Block 42 is the Type Availability (TA) code: 1 = Depot, 2 = IMA, 3 = Fleet Technical Support (TYCOM or NAVSEA), 4 = S/F (Ship's Force) — [NAVSEA SERMC Capabilities Manual (2022/2023), via search excerpt](https://www.navsea.navy.mil/Portals/103/Documents/SERMC/Capabilities%20Manual%2022APR2022.pdf)
- When a 2-Kilo is "written to document a casualty report (CASREP), include the CASREP date-time group" in the remarks — [NAVSEA SERMC Capabilities Manual, via search excerpt](https://www.navsea.navy.mil/Portals/103/Documents/SERMC/Capabilities%20Manual%208FEB2023.pdf)
- Ship's Force must ensure "the Equipment Status Code corresponds directly to the equipment configuration (Allowance Parts List (APL)/Equipment Identification Code (EIC)/Location)." This shows 2-Kilos carry APL, EIC, location and an equipment status code tied to configuration — [COMUSFLTFORCOMINST 4790 (JFMM), via search excerpt](https://v.vibdoc.com/comusfltforcominst-479055419.html)
- The 2K reports deferred maintenance and completions that do not change configuration. Configuration-changing actions and alterations go on OPNAV 4790/CK. The 4790/2P is used with the 2K when work is deferred to an IMA. The CO or an authorized representative signs original deferrals in Block E. Block G is the senior person in the lead work center, and Block H is the verifier — [TPub Aviation 14310 "OPNAV 4790/2K..." (dated training manual)](https://navyaviation.tpub.com/14310/css/Maintenance-Planning-And-Estimating-Form-Opnav-4790-2P-268.htm)
- Older NAVSEAINST 4790.8C contains a CSMP section (4-7) with a shipboard subsection — [search result on NAVSEAINST 4790.8C (2013, dated)](https://www.navsea.navy.mil/Portals/103/Documents/NAVINST/04790-008C_CH-1.pdf)
- A 2-Kilo is required per ship per fiscal year for certain PMS services (SERMC context) — [NAVSEA SERMC Capabilities Manual 2023, via search excerpt](https://www.navsea.navy.mil/Portals/103/Documents/SERMC/Capabilities%20Manual%208FEB2023.pdf)

### Inferences
- CSMP is best modeled as the set of open/deferred 2-Kilo records (one row per JCN) plus status and history. This is standard 3-M usage; the CSMP section text was not read directly.
- The parts-to-supply link is best modeled as a requisition/document-number field on the job, joined to R-Supply status. This is supported indirectly by the OMMS-NG plus R-Supply job descriptions; the exact field name was not confirmed.

### Gaps
- Full block list for the 2K (about 40+ numbered blocks plus lettered signature blocks) and exact code tables were not retrieved. This includes When Discovered, Status, Action Taken, Deferral Reason, Cause, Safety, and Equipment Status codes. The authoritative source is NAVSEAINST 4790.8D / JFMM Vol VI Ch 19 (Ships' 3-M); the PDFs could not be parsed here.
- How COSAL/configuration data (the CDM / configuration database) is loaded into OMMS-NG was not confirmed.

## 3. CASREP relationship

### Takeaway
CASREPs are operational message reports governed by NTTP 1-03.1 (Operational Reports). The documented OMMS-NG-side linkage found is that the corresponding 2-Kilo/CSMP job carries the CASREP date-time group in its remarks, and the JFMM contains CASREP handling procedures. No public source confirmed a CASREP-generation module inside OMMS-NG.

### Cited Findings
- 2-Kilo remarks must include the CASREP date-time group when the job documents a CASREP — [NAVSEA SERMC Capabilities Manual](https://www.navsea.navy.mil/Portals/103/Documents/SERMC/Capabilities%20Manual%208FEB2023.pdf)
- JFMM (COMUSFLTFORCOMINST 4790.3) contains CASREP handling procedures. This is cited in a Navy maintenance controller job posting, a secondary source — [search result: Glassdoor/USAJOBS maintenance controller postings](https://www.usajobs.gov/job/878052100)
- Public contracting shows CASREP categories in use (for example, "C4 CASREP repairs" for USNS Alan Shepard, T-AKE 3) — [BidPulsar opportunity](https://bidpulsar.com/opportunities/34002240303b4f658822a70e218d50fa-usns-alan-shepard-t-ake-3-c4-casrep-repairs)
- An academic research vessel's SMM includes a CASREP closeout form. This is a non-Navy analogue of an equipment casualty report lifecycle — [UW SSSG SMM 9.1.5](https://sssgwiki.ocean.washington.edu/smm/Forms/SMM%209.1.5%20Closeout%20Equipment%20Casualty%20Reporting%20(CASREP).pdf)

### Inferences
- These points are general Navy knowledge, not verified in this session, so mark them unverified:
  - CASREP categories are C2 (minor degradation of a primary mission or major degradation of a secondary mission), C3 (major degradation of a primary mission) and C4 (loss of at least one primary mission).
  - Report types are INITIAL, UPDATE, CORRECT and CANCEL (casualty corrected).
- For MissionTwin, model it as a CASREP record (serial, DTG, category, equipment/EIC, mission areas affected, parts needed with requisition numbers, ETR) joined many-to-one to a JCN via the DTG/serial in remarks.

### Gaps
- NTTP 1-03.1 text was not retrieved. Categories, message format (CASREP set/line structure) and whether NTCSS/OMMS-NG has a CASREP tool remain unconfirmed from sources.

## 4. Exports, reports, interfaces, shore replication

### Takeaway
The documented interfaces are OMMS-NG to SKED (a funded interface that the Navy stopped funding) and OMMS-NG/AWN conversion. OMMS-NG data feeds the 3-M MDS ashore. Publicly documented field layouts are the paper 2-Kilo block definitions in the 3-M Manual / JFMM, not a digital file spec.

### Cited Findings
- GAO: "just as the Navy stopped funding the interface between OMMS-NG and SKED, the Navy began to deploy an application to replace OMMS-NG (known as Automated Work Notification)" — [GAO-24-106525 (Sep 2024), via search excerpt](https://www.gao.gov/assets/gao-24-106525.pdf)
- A 2012 Fleet Forces blog comment (anonymous, weak source) complains of AWN-to-OMMS-NG conversion problems requiring constant manual coordination — [USFF blog archive (2012, dated)](http://usfleetforces.blogspot.com/2012/02/fleet-fam-update.html)
- AWN is the shipboard segment of MFOM (Maintenance Figure of Merit) and was intended to replace OMMS-NG — [GlobalSecurity/navy.mil news 2010 "NAVSEA Conducts Shipboard, Shore-based Workflow Application" (dated)](https://www.globalsecurity.org/military/library/news/2010/04/mil-100416-nns03.htm)
- MDS (Maintenance Data System) is a 3-M subsystem — [Scribd 3M-301](https://www.scribd.com/doc/76030748/3M-301)
- The current Ships' 3-M Manual is NAVSEAINST 4790.8D (17 Jun 2021), implementing OPNAVINST 4790.4F. Much of its procedural content moved to JFMM Vol VI Ch 19 — [NAVSEAINST 4790.8D, via search excerpt](https://www.navsea.navy.mil/Portals/103/Documents/NAVINST/04790.008D.pdf); [JFMM ACN Apr 2024](https://www.navsea.navy.mil/Portals/103/Documents/SUBMEPP/JFMM/ACN/JFMM%20ACN%20%20R021626Z%20APR%2024%20.pdf)

### Inferences
- The realistic "export" a ship user has is a CSMP report or listing, plus ad hoc Excel extracts (see the job posting in section 1). A CSV/Excel CSMP extract is therefore the most realistic synthetic artifact.

### Gaps
- No public digital file layout (CSV/XML schema) for OMMS-NG exports or shore replication was found.
- Shore databases were not confirmed: NMD (Navy Maintenance Database) and the MFOM / NAVSEA 3-M data warehouse naming and current ingest paths are unverified.

## 5. Status and modernization (as of Nov 2026)

### Takeaway
OMMS-NG is legacy and is being replaced in two layers. AWN (MFOM) has replaced it on many but not all ships, with some ships, largely West Coast, still on OMMS-NG per GAO in 2024. NOBLE's N-MRO (Lockheed Martin + IFS, awarded 2021) is the enterprise successor that covers the NOME requirement. No source confirming full OMMS-NG retirement by 2026 was found.

### Cited Findings
- The Navy did not deploy AWN to all ships. Some ships (largely West Coast) still use OMMS-NG while others use AWN — [GAO-24-106525 (9 Sep 2024), via search excerpt](https://www.gao.gov/assets/gao-24-106525.pdf)
- GAO found the Navy is replacing "old and fragmented logistics IT systems" for sailor-led maintenance but did not communicate its vision well. Recommendation 7 (on N-MRO purpose and applicability) had not been acted on as of November 2025 — [GAO-24-106525 product page](https://www.gao.gov/products/gao-24-106525)
- NOBLE family: NOSS (supply), NAMS (aviation maintenance), and NOME ("a single enterprise-wide Maritime MRO capability"). NTCSS is described as the largest legacy system it replaces. Palantir provides the Integrated Data Environment (IDE) — [Palantir/BusinessWire, Mar 2020](https://www.businesswire.com/news/home/20200305005915/en/Palantir-Awarded-Contract-Support-U.S.-Navy-NOBLE)
- NOSS was awarded to One Network Enterprises ($42.6M OTA, Nov 2020) — [PR Newswire](https://prnewswire.com/news-releases/the-united-states-navy-awards-43-million-contract-to-one-network-enterprises-for-the-naval-operational-business-logistics-enterprise-noble-naval-operational-supply-system-noss-301166187.html)
- N-MRO was awarded to Lockheed Martin + IFS (May 2021). It covers both the NAMS and NOME requirements and more than 3,000 assets, using AI, digital twin and predictive analytics, for more than 200,000 sailors. It was to be fielded initially at multiple sites — [Seapower](https://seapowermagazine.org/navy-selects-lockheed-martin-ifs-to-deliver-intelligent-ship-aircraft-maintenance/); [ExecutiveBiz](https://www.executivebiz.com/articles/ifs-lockheed-to-support-navy-n-mro-program-with-ship-aircraft-maintenance-tool-scott-helmer-quoted)
- RAND planned NOME initial capability for Q4 FY2022 and full objective capability for Q4 FY2025. These were plans, not confirmed achievements — [RAND RR2974z1](https://www.rand.org/content/dam/rand/pubs/research_reports/RR2900/RR2974z1/RAND_RR2974z1.pdf)
- FY2020 budget exhibits show NTCSS RDT&E (project 3032) at zero from FY2020 onward, with NOBLE (project 3260) funded — [PE 0604231N PB2020](https://www.globalsecurity.org/military/library/budget/fy2020/navy-peds/U_0604231N_5_PB_2020.pdf)

### Inferences
- In late 2026, a realistic fleet likely has a mix of OMMS-NG, AWN and early N-MRO data sources. MissionTwin should treat "OMMS-NG-like" data as a generic 2-Kilo/CSMP schema, source-agnostic.

### Gaps
- No 2025-2026 primary source on N-MRO shipboard fielding counts, the OMMS-NG sunset date, or NTCSS decommissioning was found.

## 6. Synthetic generator guidance (CSMP / 2-Kilo record)

### Takeaway
Build records around the sourced core and treat the code tables as placeholders. The sourced core is: JCN = UIC(5) + WC(4) + JSN(4), plus EIC/APL/location, priority (Block 41), type availability 1-4 (Block 42), remarks with CASREP DTG, deferral signature/date, and lead WC and verifier.

### Cited Findings
- Sourced field anchors: JCN composition and lengths; TA codes 1-4; Block 41 priority; CASREP DTG in remarks; Equipment Status Code tied to APL/EIC/Location; deferral signed by the CO (Block E); 2P for IMA deferral; CK for configuration changes — see section 2 sources ([SERMC Capabilities Manual](https://www.navsea.navy.mil/Portals/103/Documents/SERMC/Capabilities%20Manual%208FEB2023.pdf), [TPub 14310](https://navyaviation.tpub.com/14310/css/Maintenance-Planning-And-Estimating-Form-Opnav-4790-2P-268.htm), [JFMM excerpt](https://v.vibdoc.com/comusfltforcominst-479055419.html))

### Inferences
- Suggested CSMP CSV columns. Values are illustrative and synthetic; code values marked (U) are unverified placeholders:
  - `jcn` = `21843EA010042`. This is synthetic: UIC "21843" (render as N21843 in the display UIC field), WC "EA01" (engineering-style, 4 characters), JSN "0042".
  - `uic`, `work_center`, `jsn`
  - `eic` (7-character alphanumeric, format (U)), `apl` (9-character, format (U)), `equipment_noun`, `location` (compartment number, for example `4-180-0-E` (U))
  - `date_discovered`, `date_deferred`, `when_discovered_code` (U), `status_code` (U), `deferral_reason_code` (U)
  - `priority` (Block 41; values (U)), `type_avail` (1 Depot / 2 IMA / 3 FTS / 4 S/F, sourced), `safety_flag` (U), `est_man_hours`
  - `casrep_dtg` / `casrep_serial`, `casrep_category` (C2/C3/C4 (U)), `req_doc_numbers` (to join with R-Supply), `remarks`, `lead_wc`, `verifier`, `co_deferral_signed`
  - `job_state` (open / deferred / in-work / completed)
- Do not present placeholder code tables as authoritative. Label them in the hackathon UI as "synthetic, 3-M-like".

### Gaps
- Exact allowed values for status, deferral reason, when discovered, priority, action taken and safety codes, and the exact EIC/APL formats, need NAVSEAINST 4790.8D / JFMM Vol VI Ch 19. Those were not text-retrievable in this session; a human with a PDF reader should pull them from navsea.navy.mil.
