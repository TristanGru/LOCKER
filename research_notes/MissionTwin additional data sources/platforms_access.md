# Platforms, Data Access and Authorization Paths for a Fielded MissionTwin (as of Nov 4, 2026)

Scope note: I used unclassified public sources only. Several primary .mil pages (media.defense.gov PDFs, doncio.navy.mil, navy.mil print pages, surfpac.navy.mil) returned HTTP 403 or "Request Rejected" to automated fetch. Where that happened, the facts below come from search-result summaries or secondary reporting and are marked [secondary]. Anything older than about 18 months is marked [DATED].

## 1. Enterprise data platforms: what they aggregate and how a new app gets access

### Takeaway
The most credible enterprise path is Advana and its Navy instance, Jupiter. Jupiter already carries a "Warfighting" area (readiness, maintenance, operations), and the Navy's logistics data environment (L-IDE, the NOBLE/Palantir side) is funded to link logistics data into Advana and Jupiter. MissionTwin should present itself as an app consuming Jupiter and L-IDE data products. It should not pull feeds directly from source systems. The January 2026 Department of War (DoW) data mandates strengthen the case for access, because they make data-sharing barriers an operational risk and let CDAO direct release of data.

### Cited Findings
- **Jupiter:** Jupiter is the Department of the Navy (DON) enterprise data environment and a DON subtenant of Advana, the DoD-wide analytics platform run by CDAO. It launched in April 2020. One of its three mission areas is Warfighting (readiness, maintenance and operations data). — [WARU "What is Jupiter?" (jupiter.data.mil)](https://www.waru.edu/sites/default/files/webform/documents/26876/What%20is%20Jupiter.pdf); [GovCIO Media](https://govciomedia.com/how-navys-jupiter-enterprise-data-platform-is-sharpening-financial-management/)
- **Jupiter readiness dashboards:** A vendor source describes Jupiter dashboards with near-real-time readiness data across ships. [vendor, undated, likely DATED] — [Booz Allen](https://www.boozallen.com/insights/defense/why-im-passionate-about-data-for-military-readiness.html)
- **Task Force Hopper and Jupiter:** Task Force Hopper (the Naval Surface Force AI/ML task force, launched summer 2021) chose Advana-Jupiter as its common development environment and single data catalog. Jupiter does not need to host every dataset; it lists each one with its point of contact and details. The design pairs centralized data governance and a one-stop catalog with decentralized AI development nodes. The Surface Analytics Group is the readiness node, with predictive and prescriptive maintenance as priorities. The director said there was "no data catalog" and "not enough clean data," and that security classifications, roles and environments make the infrastructure hard to build. The task force's goal was a surface force that is "AI-ready by 2025." [DATED, Aug 3, 2022] — [FedScoop](https://fedscoop.com/ai-task-force-for-navy-surface-fleet-devising-comprehensive-data-catalog/)
- **Advana restructuring (Jan 2026):** A Deputy Secretary (Feinberg) memo, "Transforming Advana to Accelerate Artificial Intelligence and Enhance Auditability," splits Advana into a **War Data Platform (WDP)**, an Advana for Financial Management track, and a **WDP Application Services** team. The Application Services team's job is to standardize data access for "agentic AI" while supporting the FY2027/28 clean-audit goals. — [memo PDF (media.defense.gov, 403 to fetch)](https://media.defense.gov/2026/Jan/12/2003855667/-1/-1/0/TRANSFORMING-ADVANA-TO-ACCELERATE-ARTIFICIAL-INTELLIGENCE-AND-ENHANCE-AUDITABILITY.PDF); [DefenseScoop, Jan 13, 2026](https://defensescoop.com/2026/01/13/hegseth-ai-tech-hubs-reorganization-dod-dow/); [Holland & Knight](https://www.hklaw.com/en/insights/publications/2026/02/department-of-wars-ai-first-agenda-a-new-era-for-defense-contractors) [secondary]
- **DoW AI Strategy (Jan 9 or 12, 2026; sources differ on the date):**
  - It reaffirms the DoD data decrees.
  - Military departments must deliver federated data catalogs to CDAO within 30 days.
  - CDAO may direct release of any Department data to cleared users with a valid purpose (developers and operators). Denials must be justified to USD(R&E), reportedly within 7 days.
  - Data-sharing barriers are treated as operational risks.
  - A barrier-removal "SWAT team" under R&E can waive non-statutory requirements.
  - GenAI.mil is one of seven "Pace-Setting Projects."
  - Cameron Stanley was named CDAO.
  - — [DefenseScoop](https://defensescoop.com/2026/01/13/hegseth-ai-tech-hubs-reorganization-dod-dow/); [Holland & Knight](https://www.hklaw.com/en/insights/publications/2026/02/department-of-wars-ai-first-agenda-a-new-era-for-defense-contractors); [Breaking Defense](https://breakingdefense.com/2026/01/pentagon-rolls-out-major-reforms-of-rd-ai/)
  - A critical view says the enforcement language largely re-labels the 2021 decrees, and that the release authority is the one substantive change. — [MDAA alert](https://www.missiledefenseadvocacy.org/alerts/mdaa-alert-break-open-the-big-data/) [advocacy source]
- **NOBLE / Palantir:** In 2020 Palantir won the production contract to be the Integrated Data Environment for the NOBLE (Naval Operational Business Logistics Enterprise) family: NOSS (supply), NAMS (aviation maintenance) and NOME (operational maintenance). These systems are used ashore and afloat. NTCSS is the largest legacy system being replaced, and the legacy architecture draws on more than 700 applications and databases. [DATED, Mar 2020] — [Business Wire](https://www.businesswire.com/news/home/20200305005915/en/Palantir-Awarded-Contract-to-Support-U.S.-Navy-NOBLE-System); [FedScoop](https://fedscoop.com/palantir-navy-contract/)
- **L-IDE in the FY2026/27 budget (line 2611, OPN):**
  - The Logistics Integrated Data Environment (L-IDE) has a hybrid architecture.
  - FY2027 L-IDE procurement covers licenses, servers and storage at 4 ashore sites. It also **links logistics data with Advana and Jupiter**.
  - NAMS and NOME were folded into **N-MRO**. An April 2025 SECNAV memo cancelled the Lockheed Martin OTA, and N-MRO is restarting with a COTS pilot.
  - NOSS will replace ashore R-Supply. Minimum Viable Commercial Release 1 is targeted for FY2027.
  - Funding: FY2026 enacted $15.9M; FY2027 request $10.1M.
  - — [HigherGov budget summary of P-1 line 2611](https://www.highergov.com/budget/naval-tactical-command-support-system-ntcss-cecc987/) [secondary rendering of budget justification]
- **NTCSS replication:** An older NTCSS schedule slide shows R-Supply and OMMS-NG fielded afloat and ashore, with a replication agent linking them through the Navy Data Environment. [DATED] — [NTCSS program brief (archive.org)](https://archive.org/download/mipc-navsea_navy_mil/navsea.navy.mil_VAJDUSHSMD4FGWZSUPE57IAHS4NPPFRF.pdf)

### Inferences
- The likely access sequence is:
  1. Find the datasets in the Jupiter/DON federated catalog (CASREP, maintenance, supply, quals).
  2. Request access from each data steward named in the catalog.
  3. Execute a data sharing agreement / MOA. **[Inference]** The exact Jupiter onboarding form is not public.
  4. Build and host on Jupiter/Advana compute, or consume through WDP Application Services APIs once they exist.
- The January 2026 CDAO release authority gives a sponsor a formal escalation route if a data owner refuses. This is a "Barrier Removal" talking point.
- L-IDE's link to Advana and Jupiter suggests supply and maintenance data (R-Supply/NOSS, OMMS-NG/N-MRO) will reach Jupiter through the Palantir-based environment. MissionTwin should not integrate with each NTCSS app separately.

### Gaps
- I could not get the full text of the Advana transformation memo (403). I have no confirmed WDP API specs, onboarding process or timelines.
- I found no public confirmation of which CASREP, SKED/OMMS-NG/AWN or R-ADM tables currently sit in Jupiter. I also found no public "Naval Data Environment / Navy Data Platform" description from 2025–2026.
- I found nothing public on NAVSEA- or NAVSUP-specific data lakes, such as the NAVSEA Maintenance Figure of Merit / MFOM, CMP or NMD data repositories.
- I found no 2026 reporting on NOBLE's afloat/ashore sync status.

## 2. Shipboard environment: CANES hosting, DDIL, ship-to-shore replication, containers afloat

### Takeaway
CANES/ACS (Afloat Core Services) is the mandated hosting baseline for afloat apps, and NTCSS is moving onto CANES hosting. Containerized delivery to ships is in active operational evaluation through Defense Unicorns' UDS under a NIWC Atlantic / PMW 160 program, but it is not yet a fleet-wide standard. A MissionTwin afloat component would need to be a CANES-hosted, DDIL-tolerant package that works offline. A Zarf/UDS bundle fits the evaluation path.

### Cited Findings
- **CANES role:** CANES provides enterprise services, application hosting, network communications and network management afloat. [DATED FY2017; FY2023 DOT&E report also exists] — [DOT&E FY2017](https://www.dote.osd.mil/portals/97/pub/reports/fy2017/navy/2017canes.pdf?ver=2019-08-19-113710-477); [DOT&E FY2023](https://www.dote.osd.mil/Portals/97/pub/reports/FY2023/navy/2023canes.pdf?ver=KvlMM_5kM0qiLiVWpVzFwQ%3D%3D)
- **CANES/ACS as development target:** NAVADMIN 315-18 names CANES/ACS as the baseline development target for all afloat applications. A shore-based **Collaborative Staging Environment** provides the full ACS capability set for developers, though it does not fully virtualize the CANES hardware. [DATED ~2018–2020; navy.mil returned 403, so this is from the search summary] — [navy.mil "First Steps to Making Design 2.0 Reality in Afloat Networks"](https://www.navy.mil/DesktopModules/ArticleCS/Print.aspx?PortalId=1&ModuleId=523&Article=2240143)
- **NTCSS on CANES:** NTCSS afloat is moving to a CANES-hosted environment. Ship-set upgrades are planned at 37 ships in FY2026 and 35 in FY2027, depending on ship availability. — [HigherGov P-1 line 2611](https://www.highergov.com/budget/naval-tactical-command-support-system-ntcss-cecc987/)
- **UDS Fleet:** Defense Unicorns launched UDS Fleet on June 2, 2026. It is part of the Unified Defense Stack, and UDS Enterprise covers data centers. — [PR Newswire via Morningstar](https://www.morningstar.com/news/pr-newswire/20260602cl73089/defense-unicorns-launches-uds-fleet-to-put-mission-operators-in-command-at-the-tactical-edge)
- **Navy shipboard evaluation:**
  - The Navy moved Defense Unicorns to the next phase of a **NIWC Atlantic rapid capabilities program** that grew out of a CANES Next Generation prototype. In the prototype, the company configured hardware and deployed software in shipboard environments.
  - The current phase is operational evaluation aboard ships and at shore sites. It tests whether UDS can be deployed, managed and maintained in real naval environments, including air-gapped and disconnected networks, measured on performance, reliability and scalability.
  - The quoted official is CDR Eric Shuey, APM Tactical Networks Technologies, **PMW 160**: "This evaluation phase is designed to produce the operational data needed to support sound, long-term fleet decisions."
  - No ship names, ATO status or contract value were published.
  - Press release dated Jul 16, 2026; article Jul 20, 2026. Defense Unicorns' own news page lists the item under Sept 2026, so the date is uncertain.
  - — [The Defense Post](https://thedefensepost.com/2026/07/20/defense-unicorns-us-navy-software/); [Yahoo/PR Newswire](https://finance.yahoo.com/technology/articles/u-navy-selects-defense-unicorns-111700973.html); [IntelligentGov](https://www.intelligentgov.tech/2026/08/03/us-navy-advances-defense-unicorns-unified-defense-stack-to-shipboard-operational-evaluation/)
- **UDS management model:** UDS Fleet manages infrastructure and software across multiple ships and shore sites from a common framework. It is described as a candidate for fleet-wide standardization; that is a candidacy, not a procurement decision. — [The Defense Post](https://thedefensepost.com/2026/07/20/defense-unicorns-us-navy-software/); [IntelligentGov](https://www.intelligentgov.tech/2026/08/03/us-navy-advances-defense-unicorns-unified-defense-stack-to-shipboard-operational-evaluation/)
- **Earlier "app store for warships":** Breaking Defense covered the Navy's earlier effort to deliver software to ships through an app-store model (Black Pearl / Overmatch era). [DATED, Mar 2022] — [Breaking Defense](https://breakingdefense.com/2022/03/app-store-for-warships-inside-the-navys-project-to-revamp-how-the-fleet-gets-software/)
- **CASREP mechanics:** A CASREP is submitted when a casualty exceeds the ship's repair capability. It alerts shore activities that parts or technical help are needed, and its classification is set in the message header. [DATED] — [RAND TR-358](https://www.rand.org/content/dam/rand/pubs/technical_reports/2006/RAND_TR358.pdf); [DTIC ADA206315](https://apps.dtic.mil/sti/pdfs/ADA206315.pdf)

### Inferences
- A practical design is "shore-first, afloat-optional":
  - Primary forecasting runs ashore in Jupiter, on the replicated ship data.
  - An optional afloat container (Zarf package / UDS bundle on CANES) serves the ship's own forecast from local NTCSS/NOBLE data when the ship is disconnected (DDIL).
  - The afloat side syncs only small deltas when connectivity returns.
- The facilitator Defense Unicorns is the vendor in the PMW 160 shipboard evaluation. A Zarf-packaged MissionTwin fits that path directly and supports the "Speed to Fleet" and "Fleet Scalability" scores. Unverified: whether hackathon apps can ride the evaluation.

### Gaps
- I found no public confirmation that CANES ACS natively supports Kubernetes or containers in the current baseline. The UDS evaluation implies it is being tested, not fielded.
- I found no public detail on NTCSS / NOBLE replication intervals, bandwidth budgets, or the replication mechanism in 2026.
- I could not confirm the ships or the timeline in the UDS operational evaluation.

## 3. Authorization: ATO paths, impact levels, CUI and compilation, AI/LLM policy

### Takeaway
The fastest credible ATO path is to inherit controls from a platform that already holds an ATO:
- **Ashore:** Jupiter/Advana hosting (CUI).
- **DevSecOps:** a Navy RAISE-eligible platform (Black Pearl, Overmatch Software Armory) so the app's own accreditation is limited to the application layer.
- **Afloat:** the UDS/CANES evaluation path.

LLM features must stay on accredited IL5 services, GenAI.mil being the DON-mandated CUI/IL5 GenAI platform. Aggregated readiness data likely reaches SECRET by compilation. Fleet-wide forecasts may therefore need a SIPR deployment; this is an inference that needs a security classification guide (SCG) check.

### Cited Findings
- **RAISE:**
  - RAISE (Rapid Assess and Incorporate Software Engineering) was piloted in 2023 with the Overmatch Software Armory.
  - It confirms that a DevSecOps platform has the processes and tools to bake in cybersecurity.
  - All DON programs with new software starts or upgrades that use containerized methods must follow RAISE guidance.
  - — [DON CIO, "RAISE 2.0 and Overmatch Software Armory"](https://www.doncio.navy.mil/(k3pdil3u5j2c0ui1hw1s3e55)/ContentView.aspx?id=16441) [search summary; page blocked fetch]
- **Overmatch Software Armory (OSA):** OSA is a Navy DevSecOps ecosystem at NIWC Pacific. It uses RAISE as a continuous cyber accreditation process to "dramatically reduce" time to ATO. — [NIWC Pacific](https://www.niwcpacific.navy.mil/Technology/Overmatch-Software-Armory/)
- **Black Pearl:**
  - Black Pearl's site says it holds a Navy ATO and is (or is becoming) the "RAISE Platform of Choice." The site's wording is inconsistent, so this is unresolved.
  - It calls itself a driver of cATO and says it is "not a software factory."
  - PEO IWS's software factory "The Forge" is reportedly built on Black Pearl [vendor claim].
  - — [blackpearl.navy.mil](https://blackpearl.navy.mil/); [Sigma Defense](https://sigmadefense.com/capabilities/devsecops/); [FedScoop](https://fedscoop.com/navy-black-pearl-devsecops-platform-one/) [DATED]
- **ATO as a barrier:** The January 2026 DoW AI strategy names ATO processes among barriers to eliminate. The R&E barrier-removal SWAT team can waive non-statutory requirements and escalate to the DepSecDef. — [DefenseScoop](https://defensescoop.com/2026/01/13/hegseth-ai-tech-hubs-reorganization-dod-dow/)
- **GenAI.mil:**
  - A January 2026 Navy memo made GenAI.mil the DON's **mandated CUI/IL5 generative-AI platform**, with commands to transition by **April 30, 2026**.
  - Navy guidance allows CUI but **prohibits PII and PHI**.
  - — [Military Times, Aug 31, 2026](https://www.militarytimes.com/industry/techwatch/2026/08/31/the-militarys-chatgpt-is-now-live-via-the-pentagons-genai-platform/)
- **Models on GenAI.mil (as of Aug 31, 2026):**
  - Google Gemini for Government: first model, CUI/IL5.
  - OpenAI ChatGPT Mil: launched Aug 31, 2026, IL5. Initial features are chat, files, projects and custom GPTs.
  - xAI Grok for Government: IL5.
  - The platform is multi-model to avoid vendor lock-in and has 1.7M+ unique users.
  - It is unclassified only and not for combat use. Classified AI is being developed separately.
  - — [Military Times](https://www.militarytimes.com/industry/techwatch/2026/08/31/the-militarys-chatgpt-is-now-live-via-the-pentagons-genai-platform/); [war.gov GenAI.mil launch release](https://www.war.gov/News/Releases/Release/Article/4354916/the-war-department-unleashes-ai-on-new-genaimil-platform/); [war.gov xAI release](https://war.gov/News/Releases/Release/Article/4366573/the-war-department-to-expand-ai-arsenal-on-genaimil-with-xai); [DefenseScoop Dec 9, 2025 (agentic tools rollout)](https://defensescoop.com/2025/12/09/genai-mil-platform-dod-commercial-ai-models-agentic-tools-google-gemini/)
- **Readiness reporting classification:**
  - Since Oct 1, 2019, DRRS-S (hosted by OSD) has been the Navy's primary readiness reporting input tool, and the ashore-hosted DRRS-N was retired. DRRS processes, stores and displays information up to SECRET. — [USFF INST 3501.6 (Jun 2020)](https://elearning.sabresystems.com/drrsS/instructions/USFFINST%203501_6%2014June2020.pdf) [DATED]
  - Earlier DRRS-N resided on SIPRNET, with commanders able to view aggregated readiness. — [OPNAVINST 3501.360A](https://elearning.sabresystems.com/drrsS/instructions/OPNAVINST%203501.360A.pdf) [DATED]
- **Classification rules:** OPNAVINST 5513.3C is cited as the classification-guidance reference for related reporting. I could not retrieve it. — [NPS thesis (DTIC AD1052795)](https://apps.dtic.mil/sti/pdfs/AD1052795.pdf)
- **Navy GenAI user rules:** The DON CIO "Trending" page hosts Navy GenAI guidance. It was blocked to fetch, so its content is unverified. — [DON CIO](https://www.doncio.navy.mil/ContentView.aspx?id=20456)

### Inferences
- **Impact level:** Individual CASREPs, OMMS-NG and R-Supply records are generally CUI, so IL4/IL5 is appropriate for a single-ship view. A fleet-wide, near-real-time forecast of which ships cannot perform which missions closely resembles DRRS-S output, which is SECRET. That makes classification by compilation a real risk.
- **Pitch framing for compilation risk:** Build to IL5 for an unclassified unit-level or TYCOM view. Plan a SIPR (IL6) deployment for the aggregated fleet picture. Engage the Original Classification Authority / SCG owner early. This is a "Barrier Removal" talking point.
- **LLM use:**
  - Route any LLM narrative or summary through GenAI.mil-accredited models, or through models hosted inside the accredited enclave.
  - Strip R-ADM PII before prompts. Navy guidance bars PII/PHI on GenAI.mil, and crew quals data includes names and EDIPIs.
  - Keep the forecasting core deterministic and statistical, with the LLM used only for explanation. This eases Responsible AI review.
- **cATO path:** Build the pipeline on a RAISE-eligible platform (Black Pearl or OSA, the Navy analogs to Kessel Run / Platform One). The app then inherits the platform ATO, and each release goes through the RAISE gate instead of a full RMF package.

### Gaps
- I found no public Jupiter or Advana impact-level statement for 2026. Advana has been described as CUI-capable, but I did not verify the IL in this session.
- I did not retrieve 2026 text for DoD Responsible AI (the 2020 ethical principles and 2022 RAI Strategy/Implementation Pathway) or DoDD 3000.09 relevance. They are not cited here.
- I did not retrieve PEO Digital's role in hosting and ATOs (for example, the Navy commercial cloud / "Flank Speed" and NMMES-TR) in this session.
- I found no public SCG text on CASREP or readiness aggregation.

## 4. Existing readiness and predictive-maintenance analytics to complement

### Takeaway
Navy readiness analytics already exist in pieces: Task Force Hopper and Surface Analytics Group work in Jupiter, Jupiter readiness dashboards, CBM+/predictive maintenance efforts that GAO says are only partly implemented, and DRRS-S as the authoritative readiness record. MissionTwin should position itself as a forecasting layer that consumes these sources and feeds them. It should not compete with DRRS-S, which remains the authoritative report.

### Cited Findings
- **Surface Analytics Group:** It is the Task Force Hopper readiness node, with priorities in predictive/prescriptive maintenance and CBM for unmanned surface vessels, built in Jupiter. [DATED 2022] — [FedScoop](https://fedscoop.com/ai-task-force-for-navy-surface-fleet-devising-comprehensive-data-catalog/)
- **2023 Surface Warfare magazine:** It lists maintenance data among the datasets Task Force Hopper was gathering. [DATED 2023] — [Issuu, Surface Warfare SNA 2023](https://issuu.com/comnavsurfpac/docs/surface_warfare_magazine_sna_edition_2023_v1/s/17854942)
- **GAO on predictive maintenance:** GAO-23-105556 is titled "Military Readiness: Actions Needed to Further Implement Predictive Maintenance." Title only; I did not review the findings in this session. — [GAO-23-105556](https://www.gao.gov/assets/gao-23-105556.pdf)
- **Navy shipboard predictive maintenance tech:** Reporting covers the Navy's push for predictive maintenance and data analytics to improve fleet readiness. [DATED ~2022] — [Military Embedded Systems](https://militaryembedded.com/avionics/computers/us-navy-pushing-predictive-maintenance-data-analytics-to-improve-fleet-readiness); [National Defense Magazine, Mar 2022](https://www.nationaldefensemagazine.org/articles/2022/3/11/navy-to-deploy-new-tech-to-prevent-maintenance-problems)
- **Navy AI use cases:** Predictive ship maintenance is listed among the Navy's top AI use cases. — [ExecutiveBiz](https://www.executivebiz.com/articles/navy-top-5-ai-use-cases-predictive-ship-maintenance-mine-hunting-navair)
- **SURFPAC maintenance management:** A SURFPAC article, "The evolution of Surface Fleet maintenance management," exists. Its article ID suggests 2025–2026, but it was blocked to fetch, so its content is unverified. — [SURFPAC](https://www.surfpac.navy.mil/Media/News/Article/4467231/the-evolution-of-surface-fleet-maintenance-management/)
- **FleetHacker:** It is the second DON AI Hackathon Series event: Nov 4–6, 2026, Norfolk, unclassified, co-facilitated by CDAO and Defense Unicorns. Its focus is agentic AI, human-machine teaming and workflow automation on Surface Force-sourced problems. An earlier DON software hackathon ran Jun 16–19, 2026 in San Diego (WarHacker). [secondary; mostly LinkedIn and a DON CIO page that blocked fetch] — [DON CIO](https://www.doncio.navy.mil/ContentView.aspx?ID=20489); [Defense Tech Acquisition](https://www.defensetechacquisition.com/p/headlines-major-awards-initiatives)

### Inferences
- Positioning: "MissionTwin turns the data Task Force Hopper and the Surface Analytics Group already cataloged in Jupiter into forward-looking, mission-specific readiness forecasts. It writes back recommendations, not records, and leaves DRRS-S and the NTCSS/NOBLE systems as the authoritative sources."
- Because the problem sets are Surface Force-sourced, SURFLANT/SURFPAC (CNSF) and the Surface Analytics Group are the natural transition sponsor and data owner. Jupiter is the natural host.

### Gaps
- I found no public description of a 2025–2026 Navy readiness forecasting tool, such as an Advana "readiness app," NAVSEA CBM+ / ICAS / MFOM analytics or a SEA 05 predictive maintenance program, detailed enough to cite.
- I did not review the GAO-23-105556 findings in detail.
- I found no source tying Task Force Hopper analytics specifically to CASREP data.
