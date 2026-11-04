# 09 MFOM / AWN: the mission-to-equipment readiness tree

Tags: see `00_README.md` section 1.

## 1. The real system

- **MFOM** (Maintenance Figure of Merit), per its patent (US20120215734A1, ~2012) **[S]**:
  - Hierarchy: **warfare mission → Navy Tasks → functional area → system → component → part**.
  - Equipment scored **0.0-1.0**. Parents roll up by **weighted average**, or a **modified average when a "critical" child exists**.
  - "The Ship's 3M System and CASREPS are the only reporting systems that directly feed" equipment status into MFOM.
  - 2-Kilo equipment status maps to scores: **status 0 = 1.0, 1 = 0.8, 3 = 0.6, 2 = 0**.
  - A **"Time Accelerator"** weights repairs by weeks to the next deployment.
  - Sends **0-100 warfare-area indices to DRRS**, banded **80-100 green, 60-79 yellow, 0-59 red**.
- **AWN** (the OMMS-NG replacement) is MFOM's shipboard segment **[DATED]**.
- **Program.** VSolvit holds the MFOM recompete supporting NIWC Atlantic **[S]**. IOC October 2007 **[DATED]**. Current scoring may differ from the patent.

## 2. Why MissionTwin uses it

This is the closest public analog to MissionTwin's dependency graph, so we **model our graph on MFOM's shape** and borrow its sourced constants (status-to-score map, 80/60 bands). MissionTwin's contribution is the **forward projection over time** with probabilities, plus people (k-of-n quals) and parts as explicit dependencies.

The bands match the design doc's readiness bands (green >= 80%, yellow 60-80%, red < 60%).

## 3. Mock file

### 3.1 `mission_equipment_tree.json` **[PROP]** (shape sourced from MFOM)

One tree per ship class (DDG, notional), with per-ship overrides (installed quantities). Excerpt:

```json
{
  "_banner": "SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA",
  "ship_class": "DDG (notional Flight IIA)",
  "scoring": {
    "status_score_map": {"0": 1.0, "1": 0.8, "3": 0.6, "2": 0.0},
    "bands": {"green": 0.80, "yellow": 0.60},
    "rollup": "weighted_average_with_critical_child",
    "provenance": "sourced (MFOM patent ~2012)"
  },
  "missions": [
    {
      "mission_area": "AW",
      "tasks": [
        {
          "nta_id": "NTA-AW-01 (SYNTH)",
          "name": "Conduct air defense",
          "functional_areas": [
            {
              "name": "Air search and track",
              "systems": [
                {
                  "eic": "SPY1D",
                  "name": "AN/SPY-1D(V) radar",
                  "critical": true,
                  "weight": 0.5,
                  "required_quals": [{"watchstation_code": "4310", "k": 2}],
                  "components": [
                    {"eic": "SPY1D-CW", "name": "Radar cooling water system", "critical": true,
                     "parts": [{"niin": "019990001", "name": "Cooling water pump", "installed_qty": 2,
                                "min_working": 2}]},
                    {"eic": "SPY1D-ARR", "name": "Array faces", "critical": true, "parts": []}
                  ]
                },
                {"eic": "CIWS", "name": "CIWS", "critical": false, "weight": 0.2,
                 "required_quals": [{"watchstation_code": "4320", "k": 1}], "components": []}
              ]
            }
          ]
        }
      ]
    },
    {"mission_area": "ASW", "tasks": ["... SQQ-89 (LAN switch NIIN 019990044), helo deck ..."]},
    {"mission_area": "SUW", "tasks": ["..."]},
    {"mission_area": "MOB", "tasks": ["... propulsion, steering, navigation ..."]},
    {"mission_area": "CCC", "tasks": ["... comms, combat-system LAN ..."]}
  ],
  "provenance": "proposed (structure from MFOM patent; contents placeholder)"
}
```

Field rules:
- `critical: true` children use the critical-child roll-up: if a critical child scores 0, the parent is capped (we cap at 0.59, i.e. red) **[PROP]**.
- `required_quals.k` = minimum qualified people aboard for the system to count as available **[PROP]**.
- `parts.min_working` = minimum working units (both pumps needed = no redundancy; that is why one pump failure is Cat 3) **[PROP]**.
- NTA IDs are placeholders; real Navy Tactical Task numbering was not retrieved **[UNV]**.
- Mission areas come from ROC/POE (spec 10). AW, ASW, SUW sourced **[S]**; MOB, CCC **[UNV]**.

## 4. Generator rules

- One class tree; each ship file overrides `installed_qty` only if different.
- Every `eic` referenced in `csmp.csv`, `casreps.json` and `sked_schedule.csv` must exist in the tree.
- Every `niin` in the tree that appears in the demo must exist in `onboard_allowance_cosal.csv` for all three ships (even with zero quantity).

## 5. Demo scenario

- SPY-1D cooling water system needs both pumps (`min_working 2`). One pump down = component degraded = SPY-1D critical child degraded = AW task red.
- SPY-1D also needs 2 of `4310` qualified (spec 07). From day 6 Kessler has 1.
- So AW fails on two independent dominoes (part and people), which is the story.

## 6. Open questions

- Current MFOM scoring and weights (patent is ~2012).
- Real NTA numbering and DDG system breakdown.

## 7. Sources

MFOM patent US20120215734A1; GlobalSecurity/NNS 2010 (AWN); VSolvit MFOM recompete; USFFC MFOM brief (archived). Links in `reports/MissionTwin additional data sources.md`.
