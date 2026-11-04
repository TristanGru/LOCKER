# U.S. Navy Shipboard/Fleet Supply and Parts Data Sources for MissionTwin (part-arrival forecasting, cross-decking, expediting)

Scope note: Research date 2026-11-04. Unclassified, public sources only. Earlier research covered SKED, OMMS-NG (2-Kilo/CSMP, JCN) and R-ADM; they appear here only as links. Labels used: **[UNVERIFIED]** = from general/training knowledge, not confirmed by a source fetched this session. **[DATED]** = source older than about 2022. **[PROPOSED]** = a synthetic layout designed for the hackathon, not an official format. Several key primary sources returned HTTP 403 to automated fetch: the NAVSUP Afloat Automation page and the DLM 4000.25 Vol 2 AP7.16 docx. Their content here comes from search snippets or a secondary mirror (logtool.com).

---

## 1. R-Supply (Relational Supply, NTCSS): contents, status flow, and the NOBLE/NOSS replacement

### Takeaway
R-Supply is the afloat inventory and requisition system inside NTCSS. It holds the ship's COSAL-derived allowance, storeroom stock and outgoing requisitions, and it exchanges COSAL and parts data with OMMS-NG (the CSMP/2-Kilo side). NAVSUP One Touch Support and Global Distance Support Center (GDSC) channels provide the status visibility ashore. NOSS, the supply half of NOBLE, built by One Network Enterprises under a 2020 $42.6M prototype award, is meant to replace legacy NTCSS supply functions. As of November 2026 I found no public source confirming fleet-wide NOSS fielding or R-Supply retirement, so treat R-Supply as the operative system in synthetic scenarios.

### Cited Findings
- R-Supply is "the single inventory management system afloat" (example given: Trident submarines). COSAL data must be "replicated and synchronized not only between ashore and afloat systems but also between the two afloat maintenance systems" so that repair-parts requisitions can be generated. **[DATED, 2012]** — [DAU Defense AT&L, Garcia & Sparano, May-Jun 2012 (UNT web archive)](https://webarchive.library.unt.edu/web/20121007034509/http://www.dau.mil/pubscats/ATL%20Docs/May_Jun_2012/Garcia_Sparano.pdf)
- COSAL data reaches ships on CD-ROM or through the OMMS-NG/R-Supply database. NAVSEA calls OMMS-NG/R-Supply "the preferred and, most commonly used today," because it "allows for automated update and maintenance of ships' installed systems and equipment." — [NAVSEA NSLC PAFOS Manual Ch. 6 (finalized 28 Feb 2025)](https://www.navsea.navy.mil/Portals/103/Documents/NSLC/PAFOS%20Chapter%206%20finalize%2028%20Feb%2025.docx); [PAFOS Chapter 6](https://www.navsea.navy.mil/Portals/103/Documents/NSLC/Chapter6.docx)
- Storeroom Items (SRIs) are "allowed spares or repair parts carried in the ship's storeroom(s) or elsewhere in the custody of the Supply Officer." (This is the COSAL storeroom-allowance concept.) — [NAVSEA PAFOS Ch. 6](https://www.navsea.navy.mil/Portals/103/Documents/NSLC/Chapter6.docx)
- R-Supply interfaces with other naval systems including NALCOMIS, OMMS-NG, MFOM and NMRO (from a contractor SME job posting). — search snippet of [ClearanceJobs: NTCSS Relational Supply SME](https://clearancejobs.com/jobs/8165757/ntcss-relational-supply-subject-matter-expert-sme)
- A 2025 Navy solicitation (N00244-25-Q-0017) lists the supported systems as "Relational Supply (RSupply Patriot) Unit Level; Relational Supply (R-Supply Patriot) Force Level; NALCOMIS; OMMS-NG." So R-Supply was still in active sustainment in 2025, in Unit Level (small ships/subs) and Force Level (carriers/big-deck amphibs) variants. — search snippet of [orangeslices.ai notice N00244-25-Q-0017](https://orangeslices.ai/?p=112983)
- An archived DLA document describes the R-Supply database exchanging status data with ships and submarines (all ship types), with about 150,000 users. — search snippet of [archive.org DLA document](https://archive.org/download/mipc-dla_mil/dla.mil_BCHA47BGV4T2TWXP276UKZLDJ4TIBEIM.pdf) (not fetched in full)
- NOSS (Naval Operational Supply System) is described as the Navy's future end-to-end supply chain management solution under NOBLE (Naval Operational Business Logistics Enterprise). Its intent is to replace legacy applications and consolidate supply, financial and property management. In November 2020 the Navy awarded One Network Enterprises about $42.6M (an OTA prototype) for NOSS. — [Defense News, 6 Nov 2020](https://www.defensenews.com/it-networks/2020/11/06/us-navy-awards-43m-contract-for-autonomous-supply-chain-management/); [PR Newswire, One Network award](https://prnewswire.com/news-releases/the-united-states-navy-awards-43-million-contract-to-one-network-enterprises-for-the-naval-operational-business-logistics-enterprise-noble-naval-operational-supply-system-noss-301166187.html); [One Network: What is NOSS?](https://www.onenetwork.com/supply-chain-management-resources/supply-chain-glossary/what-is-noss); [NSTXL NOBLE/NOSS prototype opportunity](https://nstxl.org/opportunity/naval-operational-business-logistics-enterprise-noble-prototype-naval-operational-supply-system-noss)
- NTCSS is described as the largest legacy system NOBLE is meant to modernize. Palantir won the NOBLE aviation-maintenance component. — [Intelligence Community News: Palantir wins NOBLE](https://intelligencecommunitynews.com/palantir-wins-us-navy-noble-contract/)
- NAVSUP Business Systems Center (BSC) designs, develops and maintains Navy logistics, supply, transportation and finance IS. It held a "Meet the Fleet" event 4-7 May 2026, but the public article does not mention R-Supply or NOSS status. — [DVIDS, NAVSUP BSC Meets the Fleet in Hampton Roads (May 2026)](https://www.dvidshub.net/news/printable/564984)
- NAVSUP BSC installed HICS 4 (Hazardous Material Inventory Control System) aboard 27 ships since January 2025 (per a January 2026 story). This is an example of a separate shipboard supply application deployed in the current period. — search snippet of [DVIDS, HICS 4 aboard USS Comstock and USS Boxer](https://www.dvidshub.net/news/557177/navsup-business-systems-center-installs-hazardous-material-inventory-control-system-4-aboard-uss-comstock-and-uss-boxer)
- Scale: NAVSUP WSS supports operational readiness for almost 300 deployable ships, 92 submarines and 3,700 aircraft. — search snippet of [DVIDS, NAVSUP WSS FY26 $2.7B buy/repair plan](https://www.dvidshub.net/news/printable/548939)

### Inferences
- MissionTwin's "where is my part" data chain is: OMMS-NG CSMP/2-Kilo job (JCN) -> R-Supply requisition (document number) -> MILSTRIP status (AE_/AS_ transactions) from the source of supply (DLA or NAVSUP WSS) -> R-Supply status file and OTS. The join key between the maintenance and supply sides is the requisition document number, carried on the 2-Kilo/CSMP parts line, plus the NIIN.
- A realistic hackathon model should use R-Supply-style exports and include a `system_of_record` field (`RSUPPLY` | `NOSS`) so a NOSS transition can be shown without asserting fielding dates.

### Gaps
- No public 2025-2026 source confirmed NOSS fielding milestones (limited deployment ships, IOC/FOC dates) or an R-Supply sunset date. Searches of DVIDS and navy.mil returned nothing NOSS-specific after 2020. The NAVSUP Afloat Automation page (403) may hold this.
- Official R-Supply table and field names (for example, the requisition and stock record schemas) are not publicly documented. The "R-Supply Appendix L - System Access and SOD" study-guide reference was not verified.
- **[UNVERIFIED]** R-Supply modules are commonly described as Inventory, Logistics (requisitions/status), Financials and Query, plus Force-Level-only functions. Ships receive status via DAAS/NAVSUP "SUADPS-style" status files processed by R-Supply. Not confirmed this session.

---

## 2. Requisition and shipment status tracking: MILSTRIP document numbers, priorities, status codes, OTS, NAVSUP WSS, DLA, FLCs, CASREP supply

### Takeaway
Each part order is a MILSTRIP requisition with a 14-character document number. Its urgency comes from the priority designator (PD 01-15), derived from the unit's F/AD and the urgency of need. PD 01-03 is Issue Priority Group I. CASREP-driven orders are NORS-type (high priority), and C2/C3/C4 CASREP requisitions use RDD "999". Status returns as two-letter supply status codes (BA = processing for shipment from stock with an ESD; BB = backordered against a due-in; BV = on contract for direct vendor delivery; and others) and as shipment status carrying a transportation control number. NAVSUP One Touch Support and GDSC give ashore visibility, including a dedicated "High Priority (CASREP) Requisition Status" function.

### Cited Findings
**Document number and status-code standards**
- Status code definitions now live in DLM 4000.25 Volume 2, Appendix AP7.16 (Change 18, 15 Sep 2024). The older MILSTRIP appendix AP2.16 in DLM 4000.25-1 refers readers to DLM 4000.25 Vol 2 for updates after 2 April 2019. — search snippets of [DLM 4000.25 Vol 2 AP7.16 (DLA)](https://www.dla.mil/Portals/104/Documents/DLMS/Manuals/DLM/V2/0207.16-v2a7.16.docx); [MILSTRIP DLM 4000.25-1 (DLA)](https://www.dla.mil/Portals/104/Documents/DLMS/Manuals/DLM/MILSTRIP/MILSTRIP.pdf)
- Supply status codes per AP7.16, as mirrored by logtool.com (secondary; condensed):
  - **BA**: being processed for release and shipment from stock; "an estimated shipping date is provided when known."
  - **BB**: backordered against a due-in to stock; held until stock is received; note the ESD and follow up if it passes.
  - **BC**: backordered, with a long delay anticipated.
  - **BD**: delayed pending verification or validation.
  - **BF**: no record of the requisition.
  - **BG**: data fields changed by the supply source.
  - **BH**: substitute or interchangeable item will be supplied.
  - **BM**: document forwarded to another activity.
  - **BQ / BR / BS**: cancelled (requisitioner request / MOV response / failure to respond to MOV).
  - **BV**: procured on contract for direct shipment to the consignee.
  - **BZ**: being processed for direct-delivery procurement.
  - **B3**: RDD unrealistic; the date in rp 70-73 is when materiel will be available.
  - **B5**: follow-up received; action being taken to "improve the ESD."
  - **CB**: rejected, quantity not available.
  - **CG**: rejected, item cannot be identified.
  - **CJ**: rejected, item obsolete or inactivated.
  - **CU**: rejected, item no longer produced.
  - **CW**: not available or uneconomical to mail; local procurement authorized.
  - **CP**: local manufacture, fabrication or procurement source.

  The list totals 33 B-series, 33 C-series and 28 D-series codes. — [logtool.com: DoD Supply Status Codes](https://logtool.com/Toolbox/dod-supply-status-codes)
- In DLMS transactions, BA status carries the estimated shipping date in CCYYMMDD (G6201 = "17", G6202 = ESD). For some statuses the date relates to materiel arrival or delivery. BV relates to procured items on contract for direct shipment to the consignee. — search snippets of [ADC 1049 ESAFAT Supply Status](https://www.dla.mil/Portals/104/Documents/DLMS/ADC/ADC_1049_ESAFAT_Supply_Status.pdf); [ADC 1048 SS Supply Status](https://www.dla.mil/Portals/104/Documents/DLMS/ADC/ADC_1048_SS_Supply_Status.pdf)
- For BB, an older ADC states that the ESD for release to the customer is in record positions 70-73. — search snippet of [ADC 379B BRAC Supply Status Revisions](https://www.dla.mil/Portals/104/Documents/DLMS/ADC/ADC_379B_BRAC%20Supply%20Status%20Revisions.pdf)
- New or revised codes keep being added (for example BX, transportation pre-positioned data, item not yet checked in; SS; BP). Use the latest change. — [ADC395 new supply status code BX](https://www.dla.mil/Portals/104/Documents/DLMS/ADC/ADC395_SBSS_CMOS_Interface940R_NewSupplyStatCodeBX.pdf); [logtool.com](https://logtool.com/Toolbox/dod-supply-status-codes)

**Priorities and delivery standards**
- The priority designator is a two-digit code from 01 (highest) to 15 (lowest). PD 01-03 requisitions fall in Issue Group I and receive expedited handling. Processing time standards are documented in NAVSUP P-485. **[DATED, tpub training manuals]** — search snippets of [tpub Navy Aviation: Requisition Handling Precedence](https://navyaviation.tpub.com/12654/css/Requisition-Handling-Precedence-131.htm); [tpub: Table relating F/ADs and UNDs to priority designators](https://engineeringtraining.tpub.com/14348/Table-2-3-Table-Relating-F-Ads-And-Unds-To-Priority-Designators-36.html)
- Requisitions supporting a casualty report are NORS (Not Operationally Ready-Supply) requisitions. Code 999 in the RDD field is used for C2/C3/C4 CASREP requisitions, and for NMCS/PMCS/Broad Arrow PD 01-04 requisitions when the materiel is for overseas forces. **[DATED]** — search snippets of [tpub: Preparation of NORS/NMCS requisitions](https://navyadministration.tpub.com/14241/css/Preparation-Of-Nors-Nmcs-Requisitions-113.htm); [tpub: Casualty Reporting](https://navyadvancement.tpub.com/14504/css/Casualty-Reporting-133.htm); [tpub: DAAS CASREP requisition message (Fig 5-9)](https://navyadministration.tpub.com/14241/css/Figure-5-9-Daas-Casrep-Requisition-Message-112.htm)
- Time Definite Delivery (TDD) categories:
  - Category 1 = PD 01-03 with any RDD except one beginning with X or S.
  - Category 2 = PD 04-15 with RDD 444/555/777, an RDD beginning with N or E, or an RDD less than 8 days out (CONUS) or 21 days out (OCONUS).
  - Category 3 = PD 04-15 with no RDD or an RDD beyond those thresholds.

  The standards derive from DoDM 4140.01 Vol 8, with a 5-day default in-transit CONUS segment. — search snippets of [DLA TDD training deck v3 (2007, archive.org)](https://archive.org/download/mipc-dla_mil/dla.mil_QEBANV7IVB2MNNMAJXZ62TKSBKBKYL5D.pdf) **[DATED]**; [ADC 1114 Change MRA times based on TDD](https://www.dla.mil/Portals/104/Documents/DLMS/ADC/ADC_1114_Change_MRA_Times_based_on_TDD.pdf); [DLAD 11.402-90 TDD standards](https://www.acquisition.gov/dlad/11.402-90-time-definite-delivery-tdd-standards.)

**NAVSUP visibility tools and organizations**
- The NAVSUP Global Distance Support Center (GDSC) page offers quick links for "Stock Availability, Requisition Status, Part Number Processing, File/Text Upload – MILSTRIP Records" and "One Touch Support High Priority (CASREP) Requisition Status." It also lists a Priority Material Office. — search snippet of [NAVSUP GDSC](https://www.navsup.navy.mil/Mission-Areas/Global-Distance-Support-Center/)
- OTS access requires a DoD PKI certificate registered in the NAVSUP Master Directory (from an NROTC supply binder dated August 2025). The binder also covers Material Obligation Validation (MOV). — search snippet of [NETC NSTC 3-15 Material Obligation Validation (Aug 2025)](https://www.netc.navy.mil/Portals/46/NSTC/NROTC/01.%20Supply%20Binder/03.%20Section%203/3-15%20Material%20Obligation%20Validation%20Aug%202025.pdf)
- Customers can track requisition status and download documents in OTS. — search snippet of [NAVSUP Customer Advisory FY19/FY20](https://www.navsup.navy.mil/Portals/65/Products-Services/CustomerAdvisory_FY19-Expiring-Funds_FY20-Service-Renewals.pdf) **[DATED]**
- Example of CASREP fulfillment logic (DVIDS, 22 Apr 2024). USS Gridley submitted 7 CASREPs for one part, an ethernet switch for the AN/SQQ-89 sonar. The NAVSUP WSS CRUDES Integrated Weapons Support Team validated the requirement with the ISEA, which confirmed 6 were needed. WSS had 5 on the shelf and obtained 1 from program office IWS-5. CASREPs are described as "high-visibility, high-priority requisitions." — [DVIDS: NAVSUP WSS resolves seven CASREPs for a single part, single ship](https://www.dvidshub.net/news/printable/469139)
- NAVSUP WSS uses "Readiness-Focused Standups" to work critical orders. — search result title, [DVIDS 350169](https://www.dvidshub.net/news/printable/350169) (not fetched)

### Inferences
- **[UNVERIFIED]** Standard background, consistent with the sources above but not fetched this session:
  - MILSTRIP document number = 14 characters: requisitioner DoDAAC (6) + ordinal/Julian date YDDD (4) + serial number (4), for example `R21547 6302 A123`. Navy afloat DoDAACs are commonly "R" + the ship's 5-digit UIC (per the cited Navy practice).
  - The PD matrix is F/AD I-V x UND A/B/C:
    - F/AD I = 01/04/11
    - F/AD II = 02/05/12
    - F/AD III = 03/06/13
    - F/AD IV = 07/09/14
    - F/AD V = 08/10/15
  - IPG I = PD 01-03, IPG II = 04-08, IPG III = 09-15.
  - Status documents use DIC AE_ for supply status and AS_ for shipment status. Shipment status carries the TCN, ship date and mode, which allows tracking through IGC/GATES or carrier tracking.
  - Verify all of these against DLM 4000.25-1 AP2.14 (priority) and AP3/AP7 (formats).
- For the delay model, the status code is the main predictor:
  - **BA** with an ESD is near-term; use the ESD plus transit.
  - **BB** has an uncertain ESD tied to the due-in.
  - **BC, BV, BZ** are long-tail (procurement).
  - **CB/CJ/CU/CW** are rejections that require a new action.

### Gaps
- The full TDD day tables (total days by category and area, CONUS vs OCONUS) could not be retrieved. The LMI page refused connection and DoDM 4140.01 Vol 8 was not fetched.
- The P-485 text (Operational Forces Supply Procedures) is not freely fetchable. The CASREP parts-list format (NWP 1-03.1 / CASREP "parts" sets) was not verified this session.
- No public field-level OTS export layout was found.

---

## 3. Cross-decking and cannibalization: policy, rates and data on other ships' stock

### Takeaway
The Navy treats cannibalization as a "last resort." It is widespread, though: about one in two ships reported cannibalizing in 2011, and GAO found per-ship cannibalizations rising in 9 of 10 surface ship classes from FY2015 to FY2021. Public data shows that cannibalizations are tracked (often underreported). It does not show any public "who has one" visibility tool. Other ships' onboard stock is visible in practice through supply-system and fleet channels (TYCOM, ISIC, FLC, NAVSUP WSS stock-availability queries), and the public ship-level approval chain could not be confirmed.

### Cited Findings
- GAO-23-106440 (January 2023) reviewed 10 ship classes and 151 ships. Maintenance cannibalizations (working parts removed and reused elsewhere because of parts shortages) increased per ship across the classes. Data for FY2011-FY2014 was incomplete, so the trend starts in FY2015. CASREPs also increased. Exact per-ship values appear only in report charts. O&S costs were about $17B in FY2020, up about $2.5B from FY2011 to FY2020, including $1.2B more for maintenance. — [GAO-23-106440 product page](https://www.gao.gov/products/gao-23-106440)
- In GAO testimony on the same work:
  - Cannibalization rose in nine of ten ship classes, attributed partly to spare-parts shortages.
  - Original manufacturers for older ships are sometimes out of business.
  - Cannibalization "creates extra work."
  - Maintenance costs rose 24% (over $6B a year) across the ten classes.

  The figures conflict with the product page's "$2.5B O&S increase" because they use different measures. — [GAO transcript 817121](https://www.gao.gov/assets/820/817121.txt)
- Freedom-class LCS and Wasp-class LHD showed the worst cannibalization increases (secondary coverage of GAO-23-106440). — [Janes](https://www.janes.com/defence-news/naval-weapons/latest/us-navy-cannibalises-more-ships-to-make-up-for-part-shortfalls); [Breaking Defense, Jan 2023](https://breakingdefense.com/2023/01/gao-finds-navy-ships-having-more-problems-less-steaming-time-over-past-decade/)
- GAO-25-107468 (September 2025) found F/A-18 and Virginia-class submarine maintainers cannibalizing parts because spares were short. The shortages often came from OEMs holding exclusive rights. Officials judged reverse-engineering or contracting to stock spares "too costly." GAO said cannibalization increases "maintenance costs and workload, and when overused, long-term adverse effects on aircraft availability." This is secondary coverage; the GAO PDF was not opened. — [Task & Purpose](https://taskandpurpose.com/news/navy-fighters-submarines-cannibalize-parts/); [National Security Journal](https://nationalsecurityjournal.org/the-u-s-navy-is-now-cannibalizing-its-own-fighter-jets-and-submarines); [SOFX](https://www.sofx.com/navy-removing-parts-from-idle-jets-submarines-to-keep-fleet-running-gao-report-says/)
- About one in two Navy ships cannibalized parts from other ships to become operationally ready or pass inspections, with submarines the largest contributor. The Navy called the practice a "drastic measure" and "last resort." The article suggests the real frequency is higher than reported. **[DATED, 2011]** — [Military.com DoDBuzz, 19 Jul 2011 (citing Jane's/Sam LaGrone)](https://www.military.com/dodbuzz/2011/07/19/report-parts-swapping-is-endemic-across-navy)
- DoD defines cannibalization as removing serviceable parts from one piece of equipment and installing them in another. GAO found Navy cannibalization data understated by as much as 50% (aviation context). **[DATED, 2001-2002]** — [GAO-02-86](https://www.govinfo.gov/content/pkg/GAOREPORTS-GAO-02-86/html/GAOREPORTS-GAO-02-86.htm); [GAO-01-693T](https://www.govinfo.gov/content/pkg/GAOREPORTS-GAO-01-693T/html/GAOREPORTS-GAO-01-693T.htm)
- The DoD IG recommended that Naval Air Forces review whether maintainers use cannibalization to avoid the higher-level approval that Navy cannibalization guidance requires (aviation). — [DODIG-2020-030](https://media.defense.gov/2019/Nov/21/2002214559/-1/-1/1/DODIG-2020-030.PDF)
- OPNAV 4440.19E covers policies and priority rules for cannibalization of operational equipment. The listing marks it inactive, so it may be superseded. — [GlobalSpec listing OPNAV 4440.19E](https://standards.globalspec.com/std/424385/opnav-4440-19e)
- Terminology (blog, unverified): "cross-decking" = swapping parts from the inventory (non-active stock) of one unit to another; "cannibalization" = pulling parts from installed or active equipment. — [Navy Matters blog, Apr 2016](https://navy-matters.blogspot.com/2016/04/cannibalization.html)
- The real-world "who else has one" search ran through the supply system plus a program office. NAVSUP WSS filled Gridley's CASREPs from wholesale stock plus one unit from IWS-5. — [DVIDS 469139](https://www.dvidshub.net/news/printable/469139)

### Inferences
- MissionTwin's "borrow from a nearby ship" option needs a synthetic **fleet onboard-stock** table: NIIN x UIC x on-hand x location x ship schedule, joined to a ship-position or port table. Modeled cost of the borrow option should include:
  - transfer time (in port vs. a RAS/VERTREP or COD window)
  - donor-ship readiness impact (whether the donor's COSAL allowance drops below the minimum or creates a donor CASREP)
  - the double-maintenance workload GAO notes
  - approval latency
- Distinguish **cross-deck from storeroom stock** (lower cost) from **cannibalize from installed equipment** (higher cost, degrades the donor). That matches the definitional split.
- Because cannibalization is underreported (GAO, IG, Jane's), any rate parameter should be presented as a lower bound.

### Gaps
- I could not confirm the current ship-level cannibalization approval chain (CO vs. ISIC/TYCOM, and whether there is a CASREP cross-reference requirement) from a public current instruction. Candidate sources not retrieved: NAVSUP P-485 Vol I, the Joint Fleet Maintenance Manual (COMUSFLTFORCOMINST 4790.3), and the OPNAV 4440.19 successor.
- No public data source shows other ships' onboard stock. **[UNVERIFIED]** Such visibility reportedly exists via NAVSUP/TYCOM tools and fleet "parts locator" messages, but this was not confirmed.
- I did not extract exact per-class cannibalization rates from GAO-23-106440's charts (PDF, 105 pp.).

---

## 4. Lead-time and delay data to calibrate a delay distribution

### Takeaway
Public sources confirm the direction of delay (rising parts shortages, longer procurement for obsolete or OEM-proprietary parts, rising cannibalization and CASREPs). They do not give a clean public customer-wait-time (CWT) distribution for ship parts. Calibrate synthetically:

- Use TDD categories (PD 01-03 fastest) plus status code as the main drivers.
- Give the BB, BC and BV procurement paths heavy-tailed delays.

### Cited Findings
- TDD standards are the maximum time that should elapse in each pipeline segment. The storage-site-to-CCP segment standard applies only to OCONUS destinations. Commercial door-to-door air is limited to OCONUS TP1/TP2 shipments. **[DATED, DoD 4140.1-R App 8, superseded by DoDM 4140.01]** — search snippet of [LMI TDD Standards page (last updated 2005)](https://scitools.lmi.org/TDDStandards.aspx)
- TDD thresholds: RDD less than 8 days out (CONUS) or less than 21 days out (OCONUS) qualifies for Category 2. The DoDM 4140.01 default in-transit CONUS segment is 5 days. — search snippet of [ADC 1114](https://www.dla.mil/Portals/104/Documents/DLMS/ADC/ADC_1114_Change_MRA_Times_based_on_TDD.pdf)
- Parts take longer for older ships, and some OEMs are out of business. — [GAO transcript 817121](https://www.gao.gov/assets/820/817121.txt)
- Depot maintenance delays (days beyond the scheduled end date) increased across the 10 classes from FY2011 to FY2021. — [GAO-23-106440](https://www.gao.gov/products/gao-23-106440)
- NAVSUP WSS's FY2026 $2.7B Buy/Repair Plan is pitched as "less waiting on critical parts" for forward-deployed units. — search snippet of [DVIDS 548939](https://www.dvidshub.net/news/printable/548939)
- A GAO report covering 1983-1985 requisition data appeared in results (historical CWT baseline). **[DATED; not fetched]** — [GAO 144833](https://www.gao.gov/assets/150/144833.pdf)

### Inferences
- **[PROPOSED]** synthetic delay model (calibration assumptions, not sourced statistics). Days from requisition to onboard receipt, by IPG and status path:
  - **BA, CONUS:** lognormal, median about 4-7 d for IPG I
  - **BA, OCONUS / deployed:** median about 10-20 d, because of the extra CCP, aerial port and COD/VERTREP legs
  - **BB:** median 30-60 d
  - **BV/BZ/BC (procurement):** median 90-180 d, with a tail past 365 d for obsolete or OEM-proprietary items (consistent with GAO's OEM findings)
  - **Expedite:** shift by about 0.3-0.5x
  - **Cross-deck:** 1-3 d in company/port, 3-10 d when the donor is elsewhere in theater

  All values are placeholders the team should label as assumptions.
- The TDD category plus area (CONUS vs OCONUS) gives an "on-time" reference line. P(arrival <= mission date) can be computed against both the ESD and the TDD standard.

### Gaps
- No public current Navy CWT, average customer wait time (ACWT) or backorder-age metric was found. NAVSUP and DLA performance metrics (for example, DLA's Material Availability or Supply Availability targets) were not retrieved.
- The TDD day tables were not retrieved (sources unreachable).
- RAND reports on Navy ship parts lead times (for example, RR2403, which appeared in results) were not reviewed.

---

## 5. Synthetic generator: realistic columns for a requisition-status export and an onboard-allowance (COSAL) file

### Takeaway
Build two synthetic tables keyed on NIIN and document number, using real code vocabularies (MILSTRIP status codes, PD 01-15, RDD 999, NIIN 9 digits, COSAL storeroom allowance). The column layouts below are **[PROPOSED]**. They are modeled on public concepts, not on official R-Supply schemas, which are not public.

### Cited Findings (vocabularies the layouts draw on)
- Status codes BA/BB/BC/BV/BZ/B3/B5/CB/CJ/CU and the ESD field semantics. — [logtool.com](https://logtool.com/Toolbox/dod-supply-status-codes); [ADC 1049](https://www.dla.mil/Portals/104/Documents/DLMS/ADC/ADC_1049_ESAFAT_Supply_Status.pdf)
- PD 01-15, IPG I = 01-03; CASREP RDD 999; NORS. — [tpub](https://navyadministration.tpub.com/14241/css/Preparation-Of-Nors-Nmcs-Requisitions-113.htm) **[DATED]**
- Storeroom Items (SRIs) and COSAL delivered through OMMS-NG/R-Supply. — [NAVSEA PAFOS Ch. 6](https://www.navsea.navy.mil/Portals/103/Documents/NSLC/Chapter6.docx)
- Unit Level vs Force Level R-Supply. — [orangeslices.ai N00244-25-Q-0017](https://orangeslices.ai/?p=112983)

### Inferences — [PROPOSED] layouts

**A. `requisition_status.csv`** (one row per requisition, latest status)

| column | example | notes |
|---|---|---|
| document_number | R21547-6302-A123 | 14-character DoDAAC+YDDD+serial **[UNVERIFIED format detail]** |
| uic / hull | 21547 / DDG-101 | requisitioning ship |
| niin | 012345678 | 9-digit; NSN = FSC (4) + NIIN, e.g., 5998-01-234-5678 |
| fsc / nomenclature / cog | 5998 / "CIRCUIT CARD ASSY" / 7H or 9N | COG 7H/7R etc. = NAVSUP WSS-managed repairable; 9-series = DLA consumable **[UNVERIFIED mapping]** |
| qty / unit_of_issue | 1 / EA | |
| priority_designator | 02 | 01-15 |
| ipg | I | derived |
| rdd | 999 | or Julian / N__ / E__ / 444 / 555 / 777 |
| casrep_ref | DDG101-26-014 | CASREP serial if NORS **[PROPOSED format]** |
| jcn | 21547-E1AA-0123 | links to OMMS-NG 2-Kilo (see prior research) |
| eic | | equipment link to readiness model |
| source_of_supply (RIC) | SMS / N32 / NRP | RIC codes: SMS = DLA, N32 = NAVSUP WSS Mech, NRP = WSS Phil **[UNVERIFIED]** |
| status_code | BB | AP7.16 |
| status_date | 2026-10-28 | |
| esd | 2026-11-20 | estimated ship date, may be null |
| tcn / ship_mode / ship_date | | populated after shipment status |
| eta_onboard | | modeled |
| last_followup_date / followup_count | | AF_/AT_ follow-ups; B5 response |
| expedite_flag / expedite_action | Y / "GDSC/PMO escalation" | |
| system_of_record | RSUPPLY | RSUPPLY or NOSS |

**B. `onboard_allowance_cosal.csv`** (one row per NIIN per ship)

| column | example | notes |
|---|---|---|
| uic / hull | | |
| niin / nsn / nomenclature / cog / smic | | |
| apl_ric | 123456789 | APL/AEL linking part to equipment **[UNVERIFIED field naming]** |
| eic / equipment | | |
| allowance_type | SRI / OSI | SRI = storeroom item (PAFOS); OSI = operating space item |
| allowance_qty | 2 | COSAL allowed quantity |
| high_limit / low_limit / reorder_point | | |
| on_hand_qty | 1 | |
| due_in_qty / due_out_qty | | |
| storeroom_location | 4-120-0-Q | |
| repairable_flag / mtr (mandatory turn-in) | | |
| last_inventory_date | | |
| unit_price | | |
| ship_position / port / next_port_eta | | needed to rank cross-deck donors |
| cross_deck_eligible | computed | on_hand > allowance minimum (storeroom stock) vs installed-only (cannibalization) |

- Suggested synthetic distributions **[PROPOSED]**:
  - **Status mix for open high-priority requisitions:** BA 30%, BB 30%, BV/BZ 15%, BC 5%, BM/BH/BG 10%, rejects (C-series) 5%, no status 5%
  - **COSAL on-hand:** 70-85% of SRIs at or above allowance, 10-20% partial, 5-10% zero balance
  - **Donor search:** 1-3 sister ships of the same class holding the NIIN, with the nearest in company 30-50% of the time

### Gaps
- Official R-Supply and COSAL data element names (for example, exact APL/AEL fields, SMIC, ALLOWANCE TYPE CODE), plus RIC/COG mappings, need verification against NAVSUP P-485, NAVICP COSAL documentation or the PAFOS appendices ([PAFOS Appendix A](https://www.navsea.navy.mil/Portals/103/Documents/NSLC/Appendix_A.doc), not fetched).
- No public sample of an OTS or R-Supply status export was found.
