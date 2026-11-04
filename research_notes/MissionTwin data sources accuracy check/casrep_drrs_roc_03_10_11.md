# Accuracy check of MissionTwin specs 03 (CASREP), 10 (ROC/POE) and 11 (DRRS) against public U.S. Navy sources (as of 4 Nov 2026)

Scope and method. I checked `data_sources/03_casrep.md`, `10_roc_poe.md`, `11_drrs_readiness_baseline.md`, the relevant rows of `00_README.md` sections 1-4, and the synthetic messages `data/synthetic/KESSLER/casrep_messages/DDG991-26-017_01_INITIAL.txt` and `_02_UPDATE.txt`.

Verdict labels:
- **CONFIRMED**: a source supports the claim.
- **WRONG**: a source contradicts the claim.
- **OUTDATED**: true once, superseded now.
- **UNVERIFIABLE**: no public source was found either way.

Source-access caveats:
- secnav.navy.mil/doni returned "Request Rejected" to the fetch tool. An attempt to download it another way was blocked by the session's safety policy, so DONI facts come from search snippets.
- elearning.sabresystems.com (the DRRS-S training site) did not resolve (DNS ENOTFOUND).
- cool.osd.mil failed TLS, and electronicstechnician.tpub.com failed a certificate-name check. Facts from these sites are search-snippet only and are marked [S-SNIP].
- Two primary PDFs were downloaded and read in full by local text extraction:
  - the CG 47 ROC/POE (OPNAVINST 3501.160C, 2012)
  - an NPS thesis that reproduces the DDG-51 ROC table (1997)
- The MFOM CASREP Generator fact sheet was also extracted in full.

## Q1. CASREP governing publication, definition, report types, categories and timing (spec 03 §1-3, README §5/§9)

### Takeaway
The CASREP chapter belongs to **NWP 1-03.1 "Operational Reports" (Chapter 4)**. Navy advancement bibliographies from 2025 show it re-designated **NTRP 1-03.1 (formerly NWP 1-03.1), "with Change-1"**. I found no "NTTP 1-03.1", so the spec's designation is wrong. The following spec claims check out against dated training texts and an MFOM fact sheet:
- the 48-hour rule
- the four report types INITIAL / UPDATE / CORRECT / CANCEL
- Categories 2/3/4 with Cat 1 not used
- the 24-hour INITIAL deadline, which the spec had marked [UNV]

### Cited Findings
**Claim: "Governed by NTTP 1-03.1 (Operational Reports)" (03 §1; README §5 row 03; README §9). WRONG (designation).**
- The Aug 2025 E-5 exam bibliography lists "NTRP 1-03.1 (WITH CHANGE-1), OPERATIONAL REPORTS NTRP 1-03.1 (FORMERLY NWP 1-03.1); CHAPTER 1, 4" [S-SNIP]. — [Navy COOL Aug 2025 E-5 bibs](https://www.cool.osd.mil/usn/bibs/Aug2025%20E5Bibs_R1.htm?rate=FCA)
- The Sept 2025 E-5 bibliography still lists "NWP 1-03.1 CHG 4, OPERATIONAL REPORTS; CHAPTER 4" [S-SNIP]. — [Navy COOL Sept 2025 E-5 bibs](https://www.cool.osd.mil/usn/bibs/Sept2025%20E5Bibs.htm)
- Study materials title the CASREP lesson "Operational Reports: Casualty Report, NWP 1-03.1 ... Chapter 4: Casualty Report" (secondary). — [Course Hero CASREP ppt](https://www.coursehero.com/file/56432635/Casrep-pptppt/); [Quizlet NWP 1-03.1 Ch 4](https://quizlet.com/52944106/nwp-1-031-operational-reports-chapter-4-flash-cards/)
- The predecessor was NWP 10-1-10, "Operational Reports" (dated training text). — [tpub Gunner's Mate p.277](https://www.tpub.com/gunners/277.htm)
- A search for the exact string "NTTP 1-03.1" returned only NWP/NTRP 1-03.1 material.
- A related numbering fact: NTTP 1-03.3 is the publication under which ROC-based mission-area M-ratings are reported. The CG 47 ROC/POE cites "Ref: (b) NTTP 1-03.3" and says "Enclosure (2) will be used to support specific mission area M-ratings reported under reference (b)". — [OPNAVINST 3501.160C (19 Sep 2012), archived](https://webarchive.library.unt.edu/web/20130214013851/http://doni.daps.dla.mil/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.160C.pdf)
- **Correction:** write "NTRP 1-03.1, Operational Reports (formerly NWP 1-03.1), Chapter 4 Casualty Report (CASREP); current edition with Change 1 (edition date not found)". Do not write "NTTP 1-03.1".

**Claim: a casualty "cannot be corrected within 48 hours and reduces mission capability" [S-SNIP] (NETCINST 3040.1A, 2021). CONFIRMED, with a source-choice caveat.**
- The MFOM 2.0 fact sheet says: "A casualty is defined as an equipment malfunction or deficiency that cannot be corrected within 48 hours and that fits any of the following categories: reduces the unit's ability to perform a primary mission; reduces the unit's ability to perform a secondary mission; and reduces a training command's ability to perform its mission..." — [MFOM CASREP Generator fact sheet (undated)](https://foia.sailorbob.org/docs/1776867381_MFOM_CASREP_GENERATOR_r2.pdf)
- NETCINST 3040.1A is dated 26 Aug 2021 and titled "Technical Training Equipment and Training Device Casualty Report." It covers CASREPs on training equipment and cancels NETCINST 3040.1 [S-SNIP]. — [NETCINST 3040.1A](https://www.netc.navy.mil/Portals/46/NETC/inst/30401A.pdf)
- Because NETCINST 3040.1A is a NETC training-equipment instruction, it is a weak primary citation for fleet CASREP rules. **Recommendation:** cite NTRP/NWP 1-03.1 as the governing publication and keep NETCINST 3040.1A as supporting. Add "primary *or secondary* mission" to the definition.

**Claim: report types INITIAL / UPDATE / CORRECT (CASCOR) / CANCEL (CASCAN). CONFIRMED for the four formal types. CASCOR and CASCAN are legacy shorthand [DATED].**
- tpub p.277 refers to "typing each kind of casualty report (INITIAL, UPDATE, CORRECT, or CANCEL)". The fetched page text does not contain "CASCOR" or "CASCAN". — [tpub p.277](https://www.tpub.com/gunners/277.htm)
- The MFOM fact sheet says: "The CASREP system contains four different types of reports: INITIAL, UPDATE, CORRECT, and CANCEL. These reports are submitted using the MFOM CASREP Generator." — [MFOM fact sheet](https://foia.sailorbob.org/docs/1776867381_MFOM_CASREP_GENERATOR_r2.pdf)
- Earlier project research found a dated training text naming them "correction (CASCOR), and cancellation (CASCAN)". — [tpub fcv1 snippet](https://www.tpub.com/fcv1/2.htm)
- **Recommendation:** keep `CORRECT`/`CANCEL` as the type vocabulary, as the spec already does, and label CASCOR/CASCAN "informal/legacy names [DATED]".

**Claim: CORRECT means "Casualty corrected"; CANCEL means "Cancelled, for example deferred to a scheduled availability". CONFIRMED.**
- MFOM fact sheet: "The CORRECT CASREP is submitted when equipment that has been the subject of casualty reporting is repaired and back in operational condition." — [MFOM fact sheet](https://foia.sailorbob.org/docs/1776867381_MFOM_CASREP_GENERATOR_r2.pdf)
- MFOM fact sheet: "The CANCEL CASREP is submitted at the beginning of an availability period." — [MFOM fact sheet](https://foia.sailorbob.org/docs/1776867381_MFOM_CASREP_GENERATOR_r2.pdf)

**Claim: CORRECT records "parts receipt dates, supply delay in hours, man-hours" [DATED]. Partly confirmed.**
- The closing report contains "a final parts status, including a list of all parts" requested and the dates received, the delay "expressed in hours" caused by parts unavailability, and man-hours expended [DATED]. — [tpub Gunner's Mate p.276](https://www.tpub.com/gunners/276.htm); [tpub ET "Cancel CASREP" snippet](https://electronicstechnician.tpub.com/14085/css/Cancel-Casrep-100.htm)
- The ET snippet is on the CANCEL page. I could not confirm whether the current publication requires the same content in CORRECT, in CANCEL, or in both. That part is UNVERIFIABLE.

**Claim: categories ("1 Not used; 2 minor degradation of a primary mission, or degradation/loss of a secondary mission (secondary-mission casualties are capped at C2); 3 major degradation of a primary mission; 4 loss of at least one primary mission"). CONFIRMED [DATED].**
- Categories 2, 3 and 4 reflect operational urgency, and category 1 is not used. Casualties affecting only secondary missions are capped at category 2. — [tpub p.276](https://www.tpub.com/gunners/276.htm)
- "The selected casualty category will never be worse than a mission area M-rating reported through SORTS" [S-SNIP, DATED]. — [tpub ET Casualty Categories](https://electronicstechnician.tpub.com/14084/css/Casualty-Categories-97.htm)
- Category wording from secondary study cards:
  - C4: worse than C3, with loss of at least one primary mission.
  - C3: major degradation of a primary mission.
  - C2: minor degradation of a primary mission, or major degradation or loss of a secondary mission.
  - Source: [Brainscape CASREP cards](https://www.brainscape.com/flashcards/casualty-reports-928807/packs/1647312)
- Possible nuance: a slide deck says ships use 3 categories while training commands use 4 [S-SNIP, unverified]. "Cat 1 not used" may therefore be fleet-only. — [Scribd CASREP slides](https://www.scribd.com/presentation/79930053/CASREP-Power-Point)
- **Minor correction:** change the Cat 2 text to "...or *major degradation or total loss* of a secondary mission".

**Claim: INITIAL deadline "24 hours [UNV]" (03 §7). CONFIRMED [DATED/secondary]. The tag should change from [UNV] to [DATED].**
- An older Navy training text says the initial report is due "not later than 24 hours after the occurrence of a significant equipment casualty that cannot be corrected within 48 hours" [S-SNIP]. — [tpub IC Electrician](https://interiorcommunicationselectrician.tpub.com/14122/141220013.htm)
- An NWP 1-03.1 Ch 4 study card gives "as soon as possible, but not later than 24 hours" (secondary). — [Quizlet NWP 1-03.1 Ch 4](https://quizlet.com/52944106/nwp-1-031-operational-reports-chapter-4-flash-cards/)

**Claims: "One casualty per report; only one open CASREP per equipment item"; "RMKS gives a 30-day availability window"; "UPDATE always repeats CASUALTY and ESTIMATE; must reference the INITIAL's DTG". CONFIRMED [DATED].**
- One casualty per INITIAL; only one outstanding CASREP per equipment item; RMKS schedule for "a full 30-day period". — [tpub p.275](https://www.tpub.com/gunners/275.htm)
- An UPDATE reports only new or changed information, except that the CASUALTY and ESTIMATE sets are always included. — [tpub ET Update CASREP](https://electronicstechnician.tpub.com/14085/css/Update-Casrep-99.htm)
- "Follow-up CASREP messages (UPDATE, CORRECT, or CANCEL) should reference the INITIAL CASREP message DTG." — [tpub p.277](https://www.tpub.com/gunners/277.htm); also NETCINST 3040.1A [S-SNIP] — [NETC](https://www.netc.navy.mil/Portals/46/NETC/inst/30401A.pdf)

**A rule the spec does not use:** GAO lists the CASREP reporting frequency as "As often as every 72 hours" and notes "some casualty report data must be updated every 72 hours" (2012). — [GAO-12-887 text](https://www.gao.gov/assets/650/648722.txt)

### Inferences
- The section-level content of spec 03 is sound. The main fix is the publication designation (NTTP becomes NTRP/NWP 1-03.1).
- The INITIAL deadline can move from open question to [DATED].
- NETCINST 3040.1A should be demoted to a supporting citation, because its scope is training equipment.

### Gaps
- I could not read the NTRP 1-03.1 Change 1 text, so its edition date, current category wording and any changed timelines are unverified.
- The COOL bibliography pages could not be opened (TLS error), so the quoted entries are search snippets.

## Q2. CASREP message structure: set names and order, USMTF conventions, DTG and serials, and realism of the KESSLER example messages (spec 03 §3.Sets, §4.1; README §4)

### Takeaway
The skeleton is realistic:
- standard header, then `BT`
- classification line
- `MSGID/CASREP/<unit>/<serial>/<month>//`
- slash-delimited sets ending in `//`
- CASUALTY, ESTIMATE, ASSIST, AMPN and RMKS sets

Several details misrepresent the real format:
- **(a)** The UPDATE reuses serial 017. Real serials are never repeated.
- **(b)** `DTG/...//` is not a CASREP set. The DTG belongs in the message header line.
- **(c)** In the REF set the DTG should be compressed (`041200ZNOV26`), not spaced.
- **(d)** The real parts sets are **PARTSID** and the columnar **1PARTS**, not `PARTS`.
- **(e)** `POSIT` is missing, and older sources list it among the core sets.
- **(f)** `EQUIP` does not appear in any CASREP set list found.
- **(g)** `AN/SPY-1D(V)` puts a slash inside a slash-delimited field.
- **(h)** The UPDATE repeats unchanged sets, and RMKS does not cover a full 30 days.

### Cited Findings
**Set vocabulary and order (03 §3 "Sets"; README §9 "set order and parts set layout").**
- A Navy training slide set lists CASREP formatting sets as "AMPN, ASSIST, CASUALTY, CHANGE, DELETE, DWNGRADE, ESTIMATE, MSGID, 1PARTS, PARTS ID, POSIT, REF, RMKS, 1STRIP, TECHPUB" [S-SNIP, DATED]. — [Topic 7 Organizational Messages slides](https://slideplayer.com/slide/4399023/); [nanopdf copy](https://nanopdf.com/download/topic-7-org-msging-inst-ppt-rev-10_pdf)
- The NRTC Chapter 13 CASREP section uses PARTSID among its sets and has example INITIAL and UPDATE messages (Figs 13-5 to 13-9). The figure text was not retrievable (HTTP 403). — [NRTC 14110 ch13](https://www.globalsecurity.org/military/library/policy/navy/nrtc/14110_ch13.pdf)
- tpub p.277 names "MSGID, POSIT, and REF" as sets used in CASREPs. — [tpub p.277](https://www.tpub.com/gunners/277.htm)
- A study card gives the order "MSGID POSIT CASUALTY ESTIMATE ASSIST PARTSID" (secondary). — [Quizlet CASREP](https://quizlet.com/122809221/casrep-flash-cards/)
- Verdict on spec 03 "Sets [DATED] (names sourced...)":
  - MSGID, CASUALTY, ESTIMATE, ASSIST, AMPN and RMKS: **CONFIRMED** as real names.
  - `PARTS`: **WRONG** name. The real sets are PARTSID and the columnar 1PARTS; "1" is the columnar-set prefix.
  - POSIT and REF: real sets the spec list omits.
  - `EQUIP`: **UNVERIFIABLE**, and probably invented.
  - The spec order (CASUALTY → ESTIMATE → ASSIST → parts) matches the study-card order, apart from the missing POSIT.

**MSGID set and serials (README §4 "CASREP serial 001-999 [DATED]"; 03 §5 "Serial numbers increase monotonically per ship").**
- "A CASREP message will always be serialized. This serialization will be the MSGID ... set, which appears immediately after the message classification line. The serial numbers are sequential from 1 through 999 for every CASREP originated by a unit. These serial numbers should never be repeated until a new sequence of 1 through 999 has begun." — [tpub p.277](https://www.tpub.com/gunners/277.htm)
- A training text describes an update as a "CASREP with a serial number change". — [tpub p.277 (prior project notes)](https://www.tpub.com/gunners/277.htm)
- A Marine Corps base order uses the MSGID as the CASREP subject line, in the form "CASREP/MCAS XXX/Serial Number" [S-SNIP]. — [MCIEAST-MCB CAMLEJO 3721.1D](https://www.mcieast.marines.mil/Portals/33/Documents/Adjutant/Orders/03000/MCIEAST-MCB%20CAMLEJO%203721.1D.pdf)
- A real 2025 Navy message uses the same USMTF MSGID shape: `MSGID/GENADMIN/CNO WASHINGTON DC/N1/MAR//`, that is format/originator/serial/month. — [NAVADMIN 055/25 (unofficial mirror)](https://navadmin-viewer.fly.dev/NAVADMIN/055/25)
- **Verdict on `MSGID/CASREP/USS KESSLER/017/NOV//`: CONFIRMED** as a realistic shape.
- **Verdict on the UPDATE file reusing `MSGID/CASREP/USS KESSLER/017/NOV//`: WRONG.** Every CASREP message, including UPDATE, CORRECT and CANCEL, takes the unit's next serial. Follow-ups are tied to the INITIAL through the REF to the INITIAL's DTG, not by sharing a serial.
- **Correction:** give `_02_UPDATE.txt` serial `018`, or the next free serial. Keep `casrep_id` (PROP) anchored on the INITIAL's serial or DTG. State in README §4 that `casrep_id` uses the INITIAL's serial and that later messages carry their own serials. The README rule "3-digit, 001-999" is CONFIRMED in range. Zero-padding is UNVERIFIABLE but harmless.

**DTG format (README §2.4 and §4: "`DDHHMMZ MON YY` [UNV exact form]").**
- The header DTG line in a real 2025 Navy message is `R 132108Z MAR 25`: precedence, space, DDHHMMZ MON YY. — [NAVADMIN 055/25 mirror](https://navadmin-viewer.fly.dev/NAVADMIN/055/25)
- The 2021 USFF message title "R 221217Z JAN 21" uses the same form. — [USFF "Auto Calculated C Levels" message](https://elearning.sabresystems.com/drrsS/instructions/USFF_Auto%20Calculated%20C%20Levels_R%20221217Z%20JAN%2021.pdf)
- Inside REF sets, the same message writes the DTG compressed: "131511ZMAR25" for Ref C. — [NAVADMIN 055/25 mirror](https://navadmin-viewer.fly.dev/NAVADMIN/055/25)
- "The date-time-group (DTG) of the message transmission is the effective time ('as of' time) of the CASREP." — [tpub p.277](https://www.tpub.com/gunners/277.htm)
- **Verdicts:**
  - `DDHHMMZ MON YY` for the header DTG: **CONFIRMED**, and the [UNV] tag can be upgraded.
  - `REF/A/MSG/USS KESSLER/041200Z NOV 26//`: **WRONG** spacing. Use `REF/A/MSG/USS KESSLER/041200ZNOV26//`.
  - The `DTG/041200Z NOV 26//` line in both synthetic files is **WRONG**. No "DTG" set exists in any CASREP set list found. Replace it with a header line before `FM`, such as `R 041200Z NOV 26`. The correct precedence for a Cat 3 INITIAL is UNVERIFIABLE.
  - The `casreps.json` key `initial_dtg: "041200Z NOV 26"` (header form) is fine.

**Message framing.**
- Real Navy messages use `BT` to open and close the text and end with `#0001` / `NNNN`. — [NAVADMIN 055/25 mirror](https://navadmin-viewer.fly.dev/NAVADMIN/055/25)
- Verdict: the example's `BT ... BT` framing is **CONFIRMED**. The trailer is optional for the mock.
- Data sets "are preceded by a standard Navy message header consisting of precedence, addressees, and classification", and CASREPs are sent "even under communications MINIMIZE conditions". — [tpub p.277](https://www.tpub.com/gunners/277.htm)

**AMPN placement and UPDATE content.**
- AMPN is conditional amplifying text placed after the set it amplifies. For example, an AMPN after ESTIMATE reports receipt of parts previously reported as needed. For a casualty deferred to an availability, the AMPN goes immediately after the CASUALTY set [DATED]. — [tpub p.275](https://www.tpub.com/gunners/275.htm); [tpub p.276](https://www.tpub.com/gunners/276.htm)
- The example puts the casualty narrative AMPN after the parts line. **Recommendation:** move the narrative AMPN directly after `CASUALTY`. In the UPDATE, put the ETR-slip AMPN directly after `ESTIMATE`.
- The UPDATE should carry only new or changed information plus CASUALTY and ESTIMATE. — [tpub ET Update CASREP](https://electronicstechnician.tpub.com/14085/css/Update-Casrep-99.htm)
- The synthetic UPDATE repeats `ASSIST`, `EQUIP` and `RMKS` unchanged. **Recommendation:** drop the unchanged ASSIST and RMKS. Keep the parts lines only because supply status changed.

**RMKS 30-day window.**
- The rule is a schedule for "a full 30-day period" from the earliest date the unit can receive parts or help. — [tpub p.275](https://www.tpub.com/gunners/275.htm)
- The example RMKS covers only 05-16 NOV. **Recommendation:** extend it to 05 NOV - 04 DEC, for example "05-15 NOV NORVA; 16-20 NOV UNDERWAY GROUP SAIL VACAPES; 21 NOV-04 DEC NORVA".

**APL/EIC/JCN in the CASREP (example `EQUIP` line, `EIC:` field).**
- The MFOM CASREP Generator "Links to the MFOM model via the APL/EIC/JCN of the affected equipment" and "Accepts imports from AWN". — [MFOM fact sheet](https://foia.sailorbob.org/docs/1776867381_MFOM_CASREP_GENERATOR_r2.pdf)
- Verdict: carrying APL, EIC and JCN is **CONFIRMED** as realistic data. The `EQUIP` set name and the `KEY:value` field labels (`CAT:3`, `EIC:`, `REQ:YES`) are **UNVERIFIABLE**.

**Classification line `UNCLAS //N04790//`.**
- Single-ship CASREPs are classified when they reveal warfighting capability. — [GAO-12-887](https://www.gao.gov/assets/650/648722.txt)
- A real Cat 3 CASREP saying "SPY-1D degraded to single array face, AW mission major degradation" would very likely be classified. The UNCLAS mock is acceptable only because it is synthetic. The spec already notes this. **Recommendation:** add a one-line comment in the spec that the real equivalent would carry a classification.

### Inferences
- Slash inside a field: in USMTF the slash is the field delimiter, so `CASUALTY/INITIAL/AN/SPY-1D(V) RADAR/...` would split into extra fields. Earlier project research wrote it as `AN-SPY-1D(V)`. **Recommendation:** use `AN-SPY-1D(V)` or `SPY-1D(V)` in set fields. I found no public MIL-STD-6040 text to cite, so this is an inference.
- SSIC: `N04790` (maintenance) is a plausible style, but the CASREP instruction family uses SSIC 3040 (NETCINST **3040**.1A). `//N03040//` would be the more natural subject code. This is low-confidence; no source shows a real CASREP's SSIC.
- POSIT: older sources list POSIT among the core INITIAL sets. Adding a `POSIT/` line (for example in-port Norfolk) would make the mock more faithful. Its field layout is UNVERIFIABLE, so tag it [PROP].
- Exercise marking: exercise traffic normally starts with an `EXER/` set. This comes from general USMTF knowledge; I found no source this session. The project banner line already serves the same purpose.

### Gaps
- No verbatim modern CASREP example was retrievable. The NRTC Figures 13-5 to 13-9 are images behind a 403. Field-level layouts of CASUALTY, ESTIMATE, ASSIST, PARTSID and 1PARTS remain UNVERIFIABLE.
- MIL-STD-6040 (USMTF) rules on slashes in data fields and on EXER/OPER sets were not retrieved.
- I found no source for CASREP message precedence (ROUTINE, PRIORITY or IMMEDIATE) by category.

## Q3. CASREP supply linkage, ownership, classification, drafting tool and volume calibration (spec 03 §1, §5)

### Takeaway
Three claims hold:
- Ownership: USFF and CPF, with GAO pulling the data from MFOM.
- Classification of single-ship CASREPs (GAO-12-887).
- The "high-priority requisition" link.

The "drafting tool not publicly named" claim is wrong: a fact sheet names the **MFOM CASREP Generator (MFOM 2.0)**. RDD 999 for CASREP requisitions with PD 01-03 is confirmed in dated and surface-force supply guidance. However, UMMIPS restricts 999 to units overseas or deploying within 30 days, which CONUS-based Kessler may not meet.

### Cited Findings
**Claim: "CASREP data is owned by Fleet Forces and Pacific Fleet; GAO pulled it from MFOM [S] (GAO-12-887)". CONFIRMED (2012).**
- Table 3 lists the owner as "United States Fleet Forces Command and United States Pacific Fleet". Footnote 9 says: "We drew casualty report data from the Maintenance Figure of Merit program." — [GAO-12-887 text](https://www.gao.gov/assets/650/648722.txt)

**Claim: individual-ship CASREPs are classified when they reveal warfighting capability; roll-ups are not. CONFIRMED.**
- "Casualty reports, DRRS-N data, and INSURV reports are all classified when they identify warfighting capabilities of individual ships." When data "is consolidated and summarized above the individual ship level it is unclassified." — [GAO-12-887](https://www.gao.gov/assets/650/648722.txt)

**Claim: "Current drafting tool. Not publicly named [UNV]". WRONG / OUTDATED.**
- "These reports are submitted using the MFOM CASREP Generator."
- "As initial, update, correction, and cancellation CASREPs are submitted via the CASREP application, managers are able to monitor the current status of each outstanding casualty."
- "The software also allows application of the CASREP information against objects in the MFOM model."
- Other features: "Implements and enforces the Navy's CASREP guidelines", "No editing of CASREPS", "Accepts imports from AWN".
- Source: [MFOM 2.0 CASREP Generator fact sheet](https://foia.sailorbob.org/docs/1776867381_MFOM_CASREP_GENERATOR_r2.pdf). The sheet is undated, refers readers to mast.mitsinc.us, and is hosted on a third-party FOIA repository, so treat it as medium confidence.
- A study card says CASREPs are generated in the MFOM CASREP Generator after the job is entered and approved in OMMS-NG, then routed up the chain of command (secondary). — [Quizlet CASREPs](https://quizlet.com/413782751/casreps-flash-cards/)
- **Correction:** "Current drafting tool: MFOM CASREP Generator (MFOM 2.0), fed by AWN/OMMS-NG job data and linked by APL/EIC/JCN [S, undated fact sheet]". This also supports the spec's EIC/JCN join keys.

**Claim: NAVSUP treats CASREPs as "high-visibility, high-priority requisitions" [S-SNIP]. CONFIRMED.**
- NAVSUP WSS resolved seven CASREPs on one ship that traced to a single part (Apr 2024). — [DVIDS NAVSUP WSS 2024](https://www.dvidshub.net/news/469139/navsup-wss-resolves-seven-casreps-single-part-single-ship)

**Claim: "CASREP orders are NORS requisitions with RDD 999 for C2/C3/C4 [DATED]" and "every CASREP with parts has matching requisitions with `rdd = 999` and PD 01-03". CONFIRMED with a condition the spec omits.**
- A Navy supply training text says: "You can use 999 when the requisition is considered a C2, C3, or C4 CASREP" [S-SNIP, DATED]. — [tpub Navy supply training (search snippet)](https://navyadministration.tpub.com/14241/css/Preparation-Of-Nors-Nmcs-Requisitions-113.htm)
- COMNAVSURFPAC/COMNAVSURFLANTINST 4400.1A (Surface Supply Procedures, 17 Feb 2016) says to assign RDD 999 for PD 01-03 requisitions "if the item is needed for equipment for which a CASREP has been submitted". It cites NAVSUP P-485 para 3028, and the excerpt is truncated. It also says "Priority designator 01 through 03 requisitions not meeting the above criteria assign RDD equal to 777 or N_/E_" [S-SNIP]. — [COMNAVSURFOR 4400.1A](https://www.mynavyexchange.com/assets/Static/NEXCOMEnterpriseInfo/shipstores/COMNAVSURFOR_4400.1A.pdf)
- Under UMMIPS (DoD-wide; this source is a Marine Corps message), "the use of Required Delivery Date (RDD) '999' is restricted to those units operating overseas or preparing to deploy within 30 days of the requisition date" [S-SNIP]. — [USMC UMMIPS adherence message](https://www.marines.mil/News/Messages/Messages-Display/Article/894054/adherence-to-the-uniform-material-movement-and-issue-prioritysystem-ummips/)
- An older Navy text applies 999 to NMCS/PMCS PD 01-04 requisitions for overseas forces and activities alerted for deployment [S-SNIP, DATED]. — [tpub MILSTRIP message requisition](https://navyaviation.tpub.com/12654/css/Milstrip-Message-Requisition-63.htm)
- NORS requisitions are submitted for a CASREP, and ANORS requisitions to prevent one (secondary). — [Brainscape P-485 Ch 3](https://www.brainscape.com/flashcards/p485-vol-1-chapter-3-material-procuremen-7741178/packs/12773405)
- **Correction:**
  - Keep `rdd = 999` only where the scenario justifies it: Kessler deploying within 30 days or operating overseas.
  - Otherwise use `N` (NMCS) or `E` (ANMCS) RDD codes, or `777`, for CONUS PD 01-03 CASREP requisitions.
  - Change the generator rule to "PD 01-03 with RDD 999 if deployed or deploying within 30 days, else N/E/777".
  - Tag the rule [DATED/S-SNIP].

**Claim: volume of 14.5 CASREPs per destroyer, Jan 2008 - Mar 2012 ("period basis to check"). CONFIRMED value; basis ambiguous.**
- GAO Table 4 is headed "January 2008 to March 2012". It gives destroyers 14.5, frigates 11.8, cruisers 18.0 and amphibious ships 22.3 "average casualty reports per ship". — [GAO-12-887](https://www.gao.gov/assets/650/648722.txt)
- Earlier project notes record GAO quarterly averages rising from 10.2 (surface combatants, 2008 Q1) to 17 (2012 Q1). — [GAO-12-887](https://www.gao.gov/assets/650/648722.txt)
- GAO-23-106440 found casualty reports rose on nearly every class from FY11 to FY21. — [Breaking Defense on GAO-23-106440](https://breakingdefense.com/2023/01/gao-finds-navy-ships-having-more-problems-less-steaming-time-over-past-decade/)

### Inferences
- If GAO's 14.5 is an average per ship per quarter, as the 10.2-17 quarterly series suggests, then a destroyer generated about 5 CASREPs a month in 2012. In that case "2-5 open CASREPs per DDG in a 30-day window" is plausible to slightly low for open counts. The generator should say which reading it assumes.
- The CASREP → JCN → requisition linkage in the mock is consistent with the MFOM Generator's APL/EIC/JCN linkage and with the rule that 2-Kilo remarks cite the CASREP DTG.

### Gaps
- NAVSUP P-485 para 3028 and DLM 4000.25-1 Appendix RDD text were not read directly, so the exact current 999 criteria are unconfirmed.
- I found no public source mapping CASREP category to UND or PD (for example, whether Cat 2 maps to UND B).
- The MFOM fact sheet date and the current status of MFOM 2.0 (whether it is still the CASREP tool in 2026) are unconfirmed.

## Q4. DRRS status and vocabulary in 2026 (spec 11 entirely; spec 03 §2 cap rule)

### Takeaway
Status in 2026:
- **DRRS-S is the Navy's authoritative readiness reporting system.** Navy units have reported in DRRS-S since 1 Oct 2019 (COMUSFLTFORCOMINST 3501.6, 2020).
- **OPNAVINST 3501.360B (9 Dec 2024)** says DRRS-S replaced DRRS-N as the program of record.
- MET ratings Y/Q/N, core assessments and SORTS C-levels are the current vocabulary.
- PESTO pillars and the MFOM→DRRS-N 0-100 index feed are documented only for the DRRS-N era. They should be tagged legacy or unverified.
- The Cat 3 → Q / Cat 4 → N cap rule appears in fleet-wide USFF guidance as well as the CVN brief, so it very likely applies to surface ships.
- The spec's "DRRS lags" pitch conflicts with that rule.

### Cited Findings
**Claim: "NTRP 1-03.5 (Feb 2016) describes DRRS-N as the Navy's capabilities-based system of record ..." [S-SNIP]. CONFIRMED as a 2016 statement, OUTDATED for 2026.**
- NTRP 1-03.5 is the DRRS-N Reporting Manual, February 2016 edition. — [NTRP 1-03.5 (2016)](https://elearning.sabresystems.com/drrsS/instructions/NTRP%201-03.5%20DRRS-N%20REPORTING%20MANUAL%20EDITION%20FEBRUARY%202016.pdf)
- OPNAVINST 3501.360B (N83, 9 Dec 2024) "emphasizes that the Defense Readiness Reporting System - Strategic (DRRS-S) is the Navy's authoritative system for readiness reporting", which "replaced DRRS-N as the Navy's program of record for readiness reporting" [S-SNIP; DONI blocked full fetch]. — [OPNAVINST 3501.360B](https://www.secnav.navy.mil/doni/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.360B.pdf)
- 3501.360B superseded OPNAVINST 3501.360A (17 Oct 2014), which had named DRRS-N the authoritative system. — [OPNAVINST 3501.360A](https://elearning.sabresystems.com/drrsS/instructions/OPNAVINST%203501.360A.pdf)
- OPNAVINST 3501.387D (2 Apr 2026) cites 3501.360B as a reference, which suggests 3501.360B was still current in 2026 [S-SNIP]. — [OPNAVINST 3501.387D](https://www.secnav.navy.mil/doni/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.387D%20.pdf)
- **Correction to 11 §1 and §6:** add OPNAVINST 3501.360B (9 Dec 2024) as the current Navy policy. Mark NTRP 1-03.5 (2016) [DATED], since it is a DRRS-N-era manual whose current status is unknown.

**Claim: "USFF Instruction 3501.6 (Jun 2020): since 1 Oct 2019, OSD-hosted DRRS-S is the Navy's primary readiness input tool, ashore DRRS-N retired, DRRS handles data up to SECRET". CONFIRMED [S-SNIP], with a naming fix.**
- The document's own header reads COMUSFLTFORCOMINST 3501.6, dated 14 June 2020. It says: "On 1 October 2019, Defense Readiness Reporting System-Strategic (DRRS-S) ... Previously used DRRS-Navy hosted ashore was retired." Other Navy material cites it as "USFFC/CPF 3501.6". — [COMUSFLTFORCOMINST 3501.6](https://elearning.sabresystems.com/drrsS/instructions/USFFINST%203501_6%2014June2020.pdf); [DRRS-S Squadron/Det course (Jan 2023)](https://elearning.sabresystems.com/drrsS/presentations/DRRS_S_Squadron_Det_Course_01Jan2023.pdf)
- **Correction:** cite it as "COMUSFLTFORCOMINST 3501.6 (14 Jun 2020)".

**Claim: "Best reading: DRRS-N survives as the reporting construct and vocabulary (NMETs, PESTO); DRRS-S is the input/display tool". PARTLY WRONG.**
- DRRS-N retirement is confirmed (above).
- DRRS-S "requires two assessments": a mission assessment (standards, METs and core) and a SORTS resources assessment [S-SNIP]. — [DRRS-S Squadron/Det course 2023](https://elearning.sabresystems.com/drrsS/presentations/DRRS_S_Squadron_Det_Course_01Jan2023.pdf)
- METs and cores are rated Yes, Qualified Yes or No. If fewer than 51% of METs are Y and the rest are Q, the core cannot be rated above Q [S-SNIP]. — [DRRS-S CVN SORTS brief (Jan 2023)](https://elearning.sabresystems.com/drrsS/presentations/DRRS-S%20CVN%20SORTS_01Jan2023.pdf)
- PESTO (Personnel, Equipment, Supply, Training, Ordnance, plus facilities for shore units) is documented in the DRRS-N manual. — [NTRP 1-03.5 (2016)](https://elearning.sabresystems.com/drrsS/instructions/NTRP%201-03.5%20DRRS-N%20REPORTING%20MANUAL%20EDITION%20FEBRUARY%202016.pdf)
- I found no 2023-2026 source showing PESTO pillars displayed in DRRS-S.
- **Correction:** "DRRS-N is retired. Navy units report in DRRS-S: MET/core Y/Q/N mission assessments plus SORTS resource C-levels. PESTO is the DRRS-N-era resource construct, kept here as a modeling convenience [DATED/PROP]."
- Verdicts:
  - Y/Q/N: **CONFIRMED**.
  - PESTO "Facilities in some documents": **CONFIRMED** for shore units in DRRS-N.
  - PESTO as a current DRRS-S display: **UNVERIFIABLE**.

**Claim: cadence "Monthly, or within 24 hours of a significant change [DATED] (GAO-12-887)". CONFIRMED for DRRS-N (2012).**
- GAO Table 3 says "Monthly/Within 24 hours of a significant change" and "DRRS-N data is normally reported monthly." — [GAO-12-887](https://www.gao.gov/assets/650/648722.txt)
- The current DRRS-S cadence was not re-verified this session. Keep the [DATED] tag.

**Claim: CASREP caps "(2023 carrier brief, surface may differ) Cat 4 → MET N, SORTS equipment C-3 or lower; Cat 3 → Q or lower, C-2 or lower". CONFIRMED [S-SNIP]; the surface caveat can probably be relaxed.**
- Search results attribute this wording to USFFC 3501.6 guidance and the Jan 2023 DRRS-S CVN SORTS brief [S-SNIP]:
  - "When a unit issues a category 4 CASREP, the MET or METs associated with that CASREP will be assessed N/Red, and SORTS equipment resource category will be assessed as C-3 or lower."
  - For category 3: "Q (Yellow) or lower, and the SORTS equipment category will be assessed as C-2 or lower."
  - "Even if no METs are degraded, the unit still needs to provide a DRRS-S comment if there are any impacts of CAT 3 and CAT 4 CASREPs."
  - "The unit first must determine if any METs are degraded and update their assessment."
  - Sources: [DRRS-S CVN SORTS brief 2023](https://elearning.sabresystems.com/drrsS/presentations/DRRS-S%20CVN%20SORTS_01Jan2023.pdf); [COMUSFLTFORCOMINST 3501.6](https://elearning.sabresystems.com/drrsS/instructions/USFFINST%203501_6%2014June2020.pdf)
- COMUSFLTFORCOMINST 3501.6 is a fleet-wide (USFF/CPF) instruction, not carrier-specific.
- **Correction:** "Cap rule per COMUSFLTFORCOMINST 3501.6 / DRRS-S training (2020-2023) [S-SNIP]; applies fleet-wide (attribution to the instruction is from search snippets)."

**Claim (11 §4): "Rating rule: N if Cat 4 or index < 60; Q if Cat 3, an open CASREP on a critical system in the area, or index < 80; else Y". Misrepresents the real process if left untagged.**
- Real MET ratings are commander's assessments, bounded by the CASREP caps. They are ceilings ("Q or lower", "C-3 or lower"), not computed values. — [DRRS-S CVN SORTS brief 2023](https://elearning.sabresystems.com/drrsS/presentations/DRRS-S%20CVN%20SORTS_01Jan2023.pdf)
- The MFOM color bands are 80-100 green, 60-79 yellow and 0-59 red. — [MFOM patent US20120215734A1](https://patents.google.com/patent/US20120215734A1/en)
- **Correction:** tag the index-to-Y/Q/N thresholds [PROP] and keep the CASREP caps as [S-SNIP]. Rename `band` value `AMBER` to `YELLOW`, matching the source's green/yellow/red and DRRS's "Q (Yellow)".

**Claim (11 §4): "Kessler AW: Y ... DRRS still says Y after the casualty; MissionTwin is the one that projects the drop (pitch point: DRRS lags)". WRONG as a characterization of real practice.**
- Per the cap rule, issuing a Cat 3 CASREP requires the unit to reassess. The associated MET goes to Q or lower and equipment to C-2 or lower. — [DRRS-S CVN SORTS brief 2023](https://elearning.sabresystems.com/drrsS/presentations/DRRS-S%20CVN%20SORTS_01Jan2023.pdf)
- DRRS reporting is due "within 24 hours of a significant change". — [GAO-12-887](https://www.gao.gov/assets/650/648722.txt)
- The baseline row itself (pre-casualty, as of 060000Z) is fine.
- **Correction:** change the pitch to "DRRS shows today's capped rating within about 24 h; MissionTwin projects when it recovers or worsens at future dates (day 9, day 21)". Do not say DRRS will still show Y after a Cat 3 casualty.

**Claim: "MFOM sends 0-100 warfare-area indices [S]". CONFIRMED for DRRS-N; UNVERIFIABLE for DRRS-S in 2026.**
- MFOM provides "near real-time material-based readiness reporting" to DRRS-N. NTA and warfare-area index values are integers from 0 to 100. — [MFOM patent](https://patents.google.com/patent/US20120215734A1/en); [navy.mil SWRMC/Boxer ARG snippet](https://www.navy.mil/Press-Office/Press-Releases/display-pressreleases/Article/2237938/swrmc-supports-boxer-amphibious-ready-group-deployment)
- A USFF message titled "Auto Calculated C Levels" (R 221217Z JAN 21) exists. Only the title was seen. — [USFF msg](https://elearning.sabresystems.com/drrsS/instructions/USFF_Auto%20Calculated%20C%20Levels_R%20221217Z%20JAN%2021.pdf)
- **Correction:** "MFOM fed 0-100 indices to DRRS-N [S]; whether and how MFOM feeds DRRS-S after 2019 is [UNV]".

**Claim: DRRS data classification ("SECRET-capable and lives on SIPR"). CONFIRMED.**
- "Even summary DRRS-N data is classified." — [GAO-12-887](https://www.gao.gov/assets/650/648722.txt)
- DRRS handles data up to SECRET. — [COMUSFLTFORCOMINST 3501.6, S-SNIP](https://elearning.sabresystems.com/drrsS/instructions/USFFINST%203501_6%2014June2020.pdf)

**Claim: "DoD DRRS being modernized, not replaced (DoDD 7730.65, May 2023); DRRS data still feed the semi-annual readiness report (CRS IF12240, Sep 2026)". CONFIRMED in earlier project research; not re-fetched this session.**
- [DoDD 7730.65](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodd/773065p.pdf); [CRS IF12240 (updated 2026-09-22)](https://www.everycrsreport.com/reports/IF12240.html)

**SORTS C-levels.** SORTS uses C-1 through C-5. The overall unit C-level is driven by the lowest measured resource area [S-SNIP]. — [USMC SORTS policy message](https://www.marines.mil/News/Messages/Messages-Display/Article/889780/status-of-resources-and-training-system-sorts-policy-guidance/); [CJCSI 3401.02B](https://www.jcs.mil/Portals/36/Documents/Doctrine/training/cjcsi3401_02b.pdf?ver=2017-12-29-171240-350)

### Inferences
- The file should be retitled from "DRRS-S input, DRRS-N construct" to "DRRS-S (Navy MET Y/Q/N + SORTS); DRRS-N retired 2019".
- Its PESTO columns can stay as a modeling device if tagged [DATED/PROP].
- The Varnell `Q` ratings driven by Cat 2 CASREPs are allowed, since the cap rule sets no ceiling for Cat 2 and the commander may rate lower. They should be described as commander's judgment, not as a rule.

### Gaps
- I could not read the full text of OPNAVINST 3501.360B or COMUSFLTFORCOMINST 3501.6. That leaves unknown:
  - the current DRRS-S cadence
  - whether a successor to NTRP 1-03.5 exists
  - whether PESTO survives in DRRS-S displays
  - the NMET ID format
- Whether USFF 3501.6 has been revised since June 2020 is unknown.

## Q5. ROC/POE: instruction numbers, mission-area abbreviations, DDG primary/secondary areas, readiness conditions and capability legend (spec 10; README §4 "Mission area")

### Takeaway
The general description of ROC/POE in spec 10 is right:
- class-specific OPNAVINST 3501.xxx documents
- primary and secondary mission areas
- capability by readiness condition
- manpower drivers

Four specifics are wrong:
- **OPNAVINST 3501.115F/G is the Naval Construction Force (Seabee) ROC/POE, not a ship ROC.** It should be removed.
- **The capability legend is F (Full) / L (Limited) with modifiers A (Augmentation) / E (Special Team).** There is no "M = Minimal".
- **The readiness conditions are I-V, not I-IV.** ROC tables have columns I, III, IV and V; Condition II has no column.
- **For a DDG, STW is primary, not secondary.**

AW (Air Warfare) and CCC are the current abbreviations. AMW means Amphibious Warfare, not air. The 1997 DDG-51 ROC used AAW/ASU/C2W, which became AW/SUW/IO by 2012.

### Cited Findings
**Claim: "class-specific OPNAVINST 3501.xxx instructions assign primary and secondary mission areas ... and the required capability by readiness condition; ROC/POE also drive manpower requirements [DATED]". CONFIRMED (primary source, 2012).**
- The CG 47 ROC/POE says: "Together, the ROC and POE establish tasking which produces a measurable workload to compute manpower requirements for ship manpower documents (SMD). Enclosure (2) will be used to support specific mission area M-ratings reported under reference (b) [NTTP 1-03.3]." Its parent is "OPNAVINST C3501.2K (NOTAL)". — [OPNAVINST 3501.160C, CG 47 class, 19 Sep 2012](https://webarchive.library.unt.edu/web/20130214013851/http://doni.daps.dla.mil/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.160C.pdf)
- Unclassified class ROC/POEs are still being issued in 2022-2025, for example:
  - 3501.199D (4 Mar 2022)
  - 3501.416, T-AO 205 (27 Oct 2023)
  - 3501.176E (8 Aug 2024)
  - 3501.420, T-ATS 6 (3 Jun 2025)
  - Source: [DONI 3501 listing, search results](https://www.secnav.navy.mil/doni/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.420.pdf)

**Claim: "OPNAVINST 3501.115F (2023) updated required readiness levels [S] (title-level)". WRONG.**
- OPNAVINST 3501.115G is dated 6 Feb 2023 and covers the **Naval Construction Force (NCF)**. It is "a complete rewrite that aligns the ROCs ... with new NCF force structure and updated readiness levels". 3501.115F (2018) is listed as inactive. — [GlobalSpec OPNAV 3501.115G](https://standards.globalspec.com/std/14590417/opnav-3501-115g); [GlobalSpec OPNAV 3501.115F](https://standards.globalspec.com/std/13083290/opnav-3501-115f); [DONI 3501.115G (N95, 6 Feb 2023), S-SNIP](https://www.secnav.navy.mil/doni/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.115G.pdf)
- **Correction:** delete the 3501.115F line. Cite instead:
  - the DDG-51 ROC/POE, OPNAVINST 3501.311 series. The last edition seen publicly is 3501.311A (30 Jun 1997); the current revision letter is not public in search results.
  - the CG 47 ROC/POE, OPNAVINST 3501.160C (2012), as the closest unclassified Aegis analog.

**DDG-51 ROC/POE number (key question). Partly answered.**
- OPNAVINST 3501.311A, "Required Operational Capabilities (ROC) and Projected Operational Environment (POE) for DDG-51 (Arleigh Burke) Class Guided Missile Destroyers", dated 30 June 1997, as reproduced in an NPS thesis. — [Richter, NPS thesis, Sep 2006](https://hdl.handle.net/10945/2616) ([PDF](https://calhoun.nps.edu/server/api/core/bitstreams/d4f83852-7c77-4194-9ed9-c588dbf07387/content))
- Another NPS thesis notes that warfare-area names were updated in a later DDG-51 ROC/POE [S-SNIP]. — [NPS Calhoun search result](https://pdf.core.ac.uk/corefilesystem/pdf/910/36738025.pdf)
- No public copy of a post-1997 DDG-51 ROC/POE was found.

**DDG-51 primary/secondary areas (1997 table, verbatim from the thesis figure).**
- Columns: `AAW AMW ASU ASW CCC C2W FSO INT MIW MOB MOS NCO STW`
- Values: `P P P P P P S S S P P S P`
- Primary: AAW, AMW, ASU, ASW, CCC, C2W, MOB, MOS, STW. Secondary: FSO, INT, MIW, NCO.
- The mission statement says the DDG-51 has "the additional tasks of performing strike warfare, theater ballistic missile defense and missions of state".
- Source: [Richter 2006, Fig. 1, citing OPNAVINST 3501.311A](https://calhoun.nps.edu/server/api/core/bitstreams/d4f83852-7c77-4194-9ed9-c588dbf07387/content)

**Current abbreviations, from the CG 47 ROC/POE (2012, primary).**
- Mission areas assigned: `AW AMW ASW CCC FHP FSO INT IO LOG MIW MOB MOS NCO STW SUW`.
- Legend:
  - "AW: Air Warfare"
  - "AMW: Amphibious Warfare"
  - "ASW: Anti-Submarine Warfare"
  - "CCC: Command Control and Communication"
  - "FHP: Force Health Protection"
  - "FSO: Fleet Ship Operation" (the ROC table section heading reads "FLEET SUPPORT OPERATIONS")
  - "INT: Intelligence Operation"
  - "IO: Information Operation"
  - "LOG: Logistic"
  - "MIW: Mine Warfare"
  - "MOB: Mobility"
  - "MOS: Mission Of State"
  - "NCO: Non-Combat Operation"
  - "NSW: Naval Special Warfare" (defined in the legend but not in the CG 47 assignment row)
  - "STW: Strike Warfare"
  - "SUW: Surface Warfare"
- P/S row as extracted: AW P, AMW P, ASW P, CCC P, FHP S, FSO P, INT S, IO P, LOG S, MIW S, MOB P, MOS P, NCO S, STW P, SUW P. The PDF text extraction may misalign columns, so check visually.
- Ballistic missile defense is a ROC under AW ("AW 1.10 Provide sea-based theater BMD..."), not a separate mission area.
- Source: [OPNAVINST 3501.160C](https://webarchive.library.unt.edu/web/20130214013851/http://doni.daps.dla.mil/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.160C.pdf)
- 2014 amphibious ROC/POEs also use "AW" for air warfare and "AMW" for amphibious warfare (LSD 41 class, 3501.30E, 25 Mar 2014; LHA 6 class, 3501.395, 12 Feb 2014) [S-SNIP]. — [OPNAVINST 3501.30E](https://www.secnav.navy.mil/doni/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.30E.pdf); [OPNAVINST 3501.395](https://www.secnav.navy.mil/doni/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.395.pdf)
- **Verdicts on the key question:**
  - `AW` is the current Air Warfare abbreviation: **CONFIRMED**. `AMW` is Amphibious Warfare, so "AMW not AW" for air is **WRONG**.
  - `CCC` is current, not `C3`: **CONFIRMED**.
  - `C2W` is **OUTDATED** (1997); by 2012 it is `IO`.
  - `AAW` and `ASU` are **OUTDATED** (1997); they are now `AW` and `SUW`.
  - `EW` appears as task content in some ROCs [S-SNIP], but is not a mission-area column in the CG 47 list: **UNVERIFIABLE** as a mission area.
  - Whether newer ROC/POEs use "IW" (information warfare): **UNVERIFIABLE**.

**Claim (10 §3.1): allowed `mission_area` values `AW, ASW, SUW, MOB, CCC, STW, NSW, FSO` ("S (AW/ASW/SUW) / UNV (others)").**
- All eight are real abbreviations, so the others can move from UNV to **CONFIRMED** using CG 47 3501.160C.
- The set is incomplete for a DDG. It omits AMW, MOS, IO (formerly C2W), INT, MIW and NCO, and LOG and FHP by CG 47 analogy.
- It includes NSW, which is not assigned to DDG-51 (1997) or CG 47 (2012).
- **Correction:** the allowed vocabulary should be `AW, AMW, ASW, SUW, STW, CCC, IO, INT, MIW, MOB, MOS, NCO, FSO, LOG, FHP`, keeping NSW only if a scenario needs it. The demo can still model a subset.

**Claim (10 §3.2, [PH] notional DDG content): `STW | S | 0.05`. WRONG; this misrepresents the real assignment.**
- STW is primary in DDG-51 (1997) and in CG 47 (2012). — [Richter 2006](https://calhoun.nps.edu/server/api/core/bitstreams/d4f83852-7c77-4194-9ed9-c588dbf07387/content); [OPNAVINST 3501.160C](https://webarchive.library.unt.edu/web/20130214013851/http://doni.daps.dla.mil/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.160C.pdf)
- **Correction:** set `STW = P`. If secondary rows are wanted for realism, use areas that really are secondary (INT, MIW, NCO, FSO). The weights stay [PH].

**Claim (10 §3.1): `readiness_condition` `I, II, III, IV` [UNV]. WRONG / incomplete.**
- The CG 47 ROC defines five conditions:
  - "Condition I: Battle Readiness"
  - "Condition II: Modified Battle Readiness". "...a condition II column is not portrayed in the table of ROCs."
  - "Condition III: Wartime/Increased Tension/Forward Deployed Cruising Readiness"
  - "Condition IV: Peacetime Cruising Readiness"
  - "Condition V: In port Readiness"
- The ROC table header is "CG 47 CLASS I III IV V".
- Source: [OPNAVINST 3501.160C](https://webarchive.library.unt.edu/web/20130214013851/http://doni.daps.dla.mil/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.160C.pdf)
- Names vary by class. The NCF ROC (3501.115G) uses "Peacetime Deployed Readiness" for IV and "Homeport Readiness" for V. 3501.382A uses "Readiness State" terminology [S-SNIP]. — [OPNAVINST 3501.115G](https://www.secnav.navy.mil/doni/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.115G.pdf); [OPNAVINST 3501.382A](https://www.secnav.navy.mil/doni/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.382A.pdf)
- **Correction:** the enum is `I, III, IV, V`, with II documented but no column, tagged [S]. Spec 10 §2's example "Condition III steaming vs Condition I" is consistent with this.

**Claim (10 §3.1): `required_capability` `F` full, `L` limited, `M` minimal [UNV legend]. WRONG (`M` does not exist).**
- The CG 47 ROC defines:
  - "'F' = 'Full.' The capability is to be fully achieved."
  - "'L' = 'Limited.' The capability is to be only partially realized ... A limiting statement specifying the limitation must support every 'L'."
  - Modifiers: "'A' = 'Augmentation'" (off-watch personnel) and "'E' = 'Special Team'".
- Example row: "AW 1.1 Provide area defense for a strike group (SG)", with symbols `F F L L` for conditions I/III/IV/V, the limiting statement "III(L) - One of two launchers manned...", and "IV, V(L) - Plan and train."
- Source: [OPNAVINST 3501.160C](https://webarchive.library.unt.edu/web/20130214013851/http://doni.daps.dla.mil/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.160C.pdf)
- Some versions use "P" for "Partial" as an alternative to "L" [S-SNIP]. — [DONI ROC search results (3501.382A / 3501.164E)](https://www.secnav.navy.mil/doni/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.164E.pdf)
- **Correction:**
  - `required_capability` enum `F`, `L`.
  - Optional `modifier` enum `A`, `E`, or empty.
  - Add a `limiting_statement` string, required when the capability is `L`.
  - Add a `roc_id` column using the real numbering style (`AW 1.1`) with synthetic text, tagged [S format] / [PH content].
  - The real grain is one row per ROC per condition, not one row per mission area per condition. Keep the mission-area grain if desired, but say it is an aggregation.

**Claim (10 §1; 03 §3): "Secondary-mission casualties cap at CASREP Cat 2 [DATED]". CONFIRMED [DATED].** — [tpub p.276](https://www.tpub.com/gunners/276.htm)

**Claim (10 §1): "Some ROC/POE content is classified". CONFIRMED in substance.** The parent instruction is "OPNAVINST C3501.2K (NOTAL)"; the "C" prefix denotes a classified directive. — [OPNAVINST 3501.160C](https://webarchive.library.unt.edu/web/20130214013851/http://doni.daps.dla.mil/Directives/03000%20Naval%20Operations%20and%20Readiness/03-500%20Training%20and%20Readiness%20Services/3501.160C.pdf)

### Inferences
- The best public, unclassified template for a notional DDG is the CG 47 ROC/POE (2012), an Aegis combatant with nearly the same mission-area set as DDG-51.
- A defensible notional DDG assignment would be the 1997 DDG-51 P/S pattern with 2012 names:
  - Primary: AW, AMW, ASW, SUW, STW, CCC, IO, MOB, MOS.
  - Secondary: FSO, INT, MIW, NCO.
  - This is [PH] content anchored on [S] patterns.
- Because ROC/POE feeds SORTS M-ratings under NTTP 1-03.3, the ROC table supports the SORTS side of readiness. It is not the source of DRRS MET lists. MissionTwin should not present ROC rows as NMETs.

### Gaps
- The current DDG-51 ROC/POE revision letter and date were not found. It may be unpublished on public DONI or classified.
- The full texts of 2014+ ROC/POEs (3501.30E, 3501.395) could not be fetched because DONI was blocked, so I could not check whether naming changed after 2014 (for example IO to IW, or whether EW became a mission area).
- The CG 47 P/S row comes from PDF text extraction, so column alignment should be checked against the PDF image.
