# 16 Daily shipboard reports: Eight O'Clock Reports and Plan of the Day

Tags: see `00_README.md` section 1.

## 1. The real source

- **Eight O'Clock Reports** are "daily equipment status reports" to the CO through the XO, and are "usually locally generated forms"; format varies by command **[S]** (tpub ET).
- **Plan of the Day (POD)**: issued by the XO; sets the next day's sequence of events **[S]**.
- **Night orders, schedule of events (SOE)**: local; an SOE has event, time, description and remarks columns with spaced event numbers **[DATED]**.
- **No system of record.** These are shipboard documents, mostly free text. That is why MissionTwin needs a document-ingest path and LLM extraction.

## 2. Why MissionTwin pulls it

Daily reports carry status **that is not yet in any structured system**: a hedged tech-assist date, a part "expected Thursday", a sailor on emergency leave, a workaround in place. The LLM extracts these as facts, each with a verbatim source span; the engine only uses facts whose span is verified in the document, and everything else goes to NEEDS REVIEW.

## 3. How we believe it is structured

Locally formatted, so we design one plausible format **[PROP]**: one PDF per ship per day, sections by department, each a short paragraph or bullet list, referencing CASREPs by number and equipment by common name.

## 4. Mock files

### 4.1 `daily_status_<ship_id>_<yyyymmdd>.pdf` **[PROP]**

Generated with ReportLab. Banner header and footer on every page. One page, sometimes two.

Template:
```
SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA
USS KESSLER (DDG-991)          EIGHT O'CLOCK REPORT          05 NOV 2026
From: Executive Officer   To: Commanding Officer

OPERATIONS
 - Group Sail planning conference 0900 Thursday. No change to underway date received.
COMBAT SYSTEMS (LT Brandt)
 - SPY-1D: single array face ops since 0412 on the 4th. CASREP 017 (CAT 3) submitted.
 - Cooling pump NIIN 01-999-0001 on order, supply now showing long delay. FC1 Ramos
   believes the NSWC tech rep visit may slip to 12 NOV due to travel.
 - CIWS: PMS check last week not completed (lost). Will reschedule.
ENGINEERING (LCDR Osei)
 - All GTMs up. No. 2 SSDG lube oil leak, contained, 2-Kilo submitted.
SUPPLY
 - Expedite requested on CASREP 017 pump via OTS.
NAVIGATION / ADMIN / MEDICAL / TRAINING / SAFETY
 - FC2 Lin departs TAD for school 10 NOV.
 - CIC air defense team trainer due before COMPTUEX.

SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA
```

Rules:
- Names are invented. Rates match `roster.csv` where a person is referenced (`FC1 Ramos` = `M-0007`, `FC2 Lin` = `M-0011`).
- Each fact a parser should find must appear as one sentence (spans must be verifiable).
- Some facts duplicate structured data (consistency checks); some do not exist anywhere else (seeded new information); some contradict structured data (contradiction checks).

### 4.2 `pod_<ship_id>_<yyyymmdd>.pdf` **[PROP]** (optional)

SOE table: `event_no, time, event, location, responsible, remarks` with spaced event numbers (10, 20, 30) **[DATED]** style.

### 4.3 Expected extraction (test oracle) `daily_status_expected_facts.json` **[PROP]**

For each PDF, the facts the extractor should return, with their exact span text, so extraction can be regression-tested.

## 5. Generator rules

- One PDF per ship per day from day -3 to day 2 (6 days × 3 ships) for the demo.
- Use hedged language ("believes", "may slip", "expected") for at least one fact per report.

## 6. Demo scenario and seeded inconsistencies

- **X4:** Kessler 05 NOV: "the NSWC tech rep visit may slip to 12 NOV". No structured file reflects this. The extractor should create a fact (assist ETA 12 NOV, low confidence), and the UI should flag it as new information.
- **Contradiction:** the CIWS lost-PMS line matches spec 01, but there is no 2-Kilo (X7).
- **Contradiction (build change):** "FC1 Ramos detaches 10 NOV on PRD orders." and "FC2 Lin departs TAD to school 10 NOV, returns 24 NOV." appear in the 05 NOV report, while the stale `roster.csv` still shows both `ONBOARD`. The newer verified fact overrides the stale roster in the engine; the UI shows the disagreement.
- Roster staleness (X10) is visible because the PDF is newer than `roster.csv` `as_of`.
- **Timing (build change):** each report carries `As of: <DTG>` in its header, set to the next day at 0100Z (2000 local). That DTG is when MissionTwin could have known the content, which is how the scenario player releases reports.
- Hedged facts ("may slip") are `UNCONFIRMED`: shown and flagged, but they feed the forecast only after the captain confirms them.

## 7. Sources

tpub ET (Eight O'Clock Reports); tpub navy advancement (POD); SWOS 72-9 (OPSUM). Links in `reports/MissionTwin additional data sources.md`.
