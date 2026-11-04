# 20 Fielded access: how a real MissionTwin would get this data

Tags: see `00_README.md` section 1. Not a mock file; this is the design constraint and pitch material behind every spec. It supports Speed to Fleet (20%), Fleet Scalability (20%) and Barrier Removal (15%).

## 1. Data access path

- **Jupiter / Advana.** Jupiter (Navy instance of Advana, Apr 2020) has a Warfighting area for readiness, maintenance and operations data **[S]**. Task Force Hopper made it the surface force's common development environment and single data catalog; the Surface Analytics Group is the readiness node **[DATED]**.
- **L-IDE** (Palantir-based NOBLE data environment) is funded to **link logistics data with Advana and Jupiter** **[secondary]** (FY2027 P-1 line 2611). NTCSS draws on more than 700 applications and databases **[DATED]**.
- **Jan 2026.** A Deputy Secretary memo split Advana into a War Data Platform (WDP), a financial-management track and a WDP Application Services team standardizing data access for agentic AI **[secondary]**. The AI strategy lets **CDAO direct release of Department data to cleared users with a valid purpose**, with denials justified to USD(R&E) **[secondary]**.
- **Inferred access sequence** **[PROP]**: (1) find each dataset in the DON federated catalog; (2) request access from the named steward; (3) execute a data-sharing agreement; (4) build on Jupiter/WDP compute. CDAO release authority is the escalation route.
- No public onboarding form, WDP API spec or list of CASREP/NTCSS tables in Jupiter was found.

## 2. Afloat hosting

- **CANES/ACS** is the mandated development baseline for afloat applications **[S-SNIP, DATED]** (NAVADMIN 315-18 context).
- NTCSS is moving onto CANES hosting: 37 ships in FY2026, 35 in FY2027 **[secondary]**.
- **UDS** (Defense Unicorns) advanced to operational evaluation aboard ships and ashore, including air-gapped networks, under NIWC Atlantic with PMW 160, mid-2026 **[S]**. UDS Fleet launched 2 Jun 2026 **[S]**. Evaluation, not fielded; no ship names or ATO status published.
- Design implication: forecast runs ashore in Jupiter; optional DDIL-tolerant Zarf/UDS bundle on CANES **[PROP]**.

## 3. Authorization

- **RAISE** applies to all DON new starts and upgrades using containers; it certifies the DevSecOps platform so the app only clears a gate **[S-SNIP]**. Overmatch Software Armory (NIWC Pacific) uses RAISE to "dramatically reduce" time to ATO **[S]**. Black Pearl claims a Navy ATO and RAISE status (wording inconsistent) **[S]**.
- Fastest route: inherit controls from Jupiter ashore and a RAISE platform; ride the UDS/CANES evaluation afloat **[PROP]**.

## 4. LLM use

- **GenAI.mil** is the DON's mandated CUI/IL5 generative-AI platform (transition by 30 Apr 2026); allows CUI, **prohibits PII and PHI**; unclassified only **[S]** (Military Times, Aug 2026). Models include Gemini for Government, ChatGPT Mil (from 31 Aug 2026), Grok for Government **[S]**.
- Implication for every spec: R-ADM data carries names and identifiers, so **only de-identified context goes to the LLM**. Mock data already uses synthetic `member_id`s; the brief generator must never send `display_name`. Recommend a `pii_redaction_test.csv` fixture that proves names are stripped from prompts **[PROP]**. Built: `squadron/pii_redaction_test.csv` with columns `case_id`, `ship_id`, `input_text`, `expected_redacted`, `names_that_must_not_appear`. Redaction replaces `<rate> <Surname>` with `<rate> [M-xxxx]` before any prompt is built, and a guard refuses to send any prompt in which a roster surname survives.
- Open-weight on-ship models remain an option for DDIL (design doc R5 note); the AI engineer owns the choice.

## 5. Classification by compilation

- Single-ship CASREP, maintenance and supply records are generally CUI; individual-ship CASREPs become classified when they reveal warfighting capability **[S]** (GAO-12-887). DRRS handles data up to SECRET **[DATED]**.
- A fleet-wide forward map of which ships will lose which missions looks like SECRET readiness output **[inference]**.
- Plan **[PROP]**: IL5 for unit and squadron views; SIPR deployment for the aggregated fleet picture; engage the security classification guide owner early (OPNAVINST 5513.3C cited, not retrieved).

## 6. Pitch lines this enables

- "Read-only. It sits on top of DRRS and MFOM and projects their ratings forward."
- "No new system of record: it consumes Jupiter data products under an inherited RAISE ATO."
- "Runs disconnected on the ship via the same UDS stack the Navy is evaluating."
- "LLM only sees de-identified context, on GenAI.mil or an on-ship open model."
- "Squadron view at IL5 today; fleet view designed for SIPR."

## 7. Sources

WARU "What is Jupiter?"; FedScoop (2020, 2022); HigherGov P-1 line 2611; DefenseScoop (Jan 2026); Holland & Knight; navy.mil NAVADMIN 315-18 context; The Defense Post (Jul 2026); PR Newswire (UDS Fleet); DON CIO (RAISE; FleetHacker); NIWC Pacific OSA; blackpearl.navy.mil; Military Times (Aug 2026); GAO-12-887; USFFINST 3501.6; NPS thesis. Links in `reports/MissionTwin additional data sources.md`.
