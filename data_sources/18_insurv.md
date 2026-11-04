# 18 INSURV material inspections (optional)

Tags: see `00_README.md` section 1.

## 1. The real source

- **INSURV** (Board of Inspection and Survey) inspects each ship roughly every **48-60 months** **[S]** (GAO-12-887) and publishes a **releasable annual report** **[S]** (INSURV FY2023).
- Ship-level results go through USFF; per-ship details are not public **[UNV]**.

## 2. Why MissionTwin might use it

A slow prior on material condition: a ship with poor INSURV findings on a system has a higher baseline failure rate. **Optional**: build only if time allows; it does not affect the 2-4 week demo story.

## 3. Mock file

### 3.1 `insurv_findings.csv` **[PROP]**

`ship_id, inspection_date, inspection_type (MI, FTA), eic, finding_severity (MAJOR, MINOR), finding_summary, corrected (bool), as_of, provenance`

## 4. Generator rules

- One inspection per ship, 1-4 years old; 5-20 findings; severity and EICs from the mission tree.

## 5. Sources

GAO-12-887; INSURV FY2023 annual report (releasable). Links in `reports/MissionTwin additional data sources.md`.
