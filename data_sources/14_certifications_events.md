# 14 Certifications, events and missions (SFTRM / ATG)

Tags: see `00_README.md` section 1.

## 1. The real source

- **Leaving maintenance:** a TYCOM-led assessment called **READ-E 4**. USS Bulkeley's included six events: main reduction gear assessment, light-off assessment, crew certification, dock trials and fast cruise, navigation assessment, contractor sea trials **[S]**.
- **Basic Phase:** mission-area certifications. **USS Curtis Wilbur certified 18 mission areas in 18 weeks** **[S]**; USS John S. McCain was evaluated across 23 areas **[S]**. Ships can now certify early once they demonstrate proficiency **[S]**.
- **Integrated Phase:** Group Sail with SWATT, then **COMPTUEX**, "the definitive, final training" to judge deployment readiness **[S]**.
- **Lapse:** certifications expire and need revalidation (implied by Aug 2026 Proceedings) **[S]**.
- **Not found:** the current SFTRM (3502.7 series) text, the full DDG certification list, and any per-certification equipment or watch-team prerequisite matrix. **All prerequisites below are our inference from event names** **[PROP]**.

## 2. Why MissionTwin uses it

A "mission" in MissionTwin = a scheduled event with required systems, required watch teams and prerequisite events. This is where the forecast's target comes from: "Is Kessler ready for Mission A on 13 Nov?"

## 3. Mock files

### 3.1 `events_missions.json` **[PROP]**

```json
{
  "_banner": "SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA",
  "events": [
    {
      "event_id": "EVT-KESSLER-01",
      "label": "Mission A",
      "ship_id": "KESSLER",
      "name": "Group Sail / SWATT air defense serial",
      "ofrp_phase": "INTEGRATED",
      "start": "2026-11-13T12:00:00Z",
      "end": "2026-11-19T20:00:00Z",
      "mission_areas": ["AW", "MOB", "CCC"],
      "required_systems": [
        {"eic": "SPY1D", "min_status_score": 0.8},
        {"eic": "CIWS", "min_status_score": 0.6}
      ],
      "required_watch_teams": [{"watchstation_code": "4310", "k": 2}],
      "prerequisite_events": [],
      "prerequisite_certs": ["CERT-KESSLER-AW"],
      "consequence_if_missed": "Ship cannot complete SWATT AW serial; COMPTUEX entry at risk",
      "schedule_block_id": "SCH-KESSLER-07",
      "provenance": "proposed (prerequisites inferred from event name)"
    },
    {
      "event_id": "EVT-KESSLER-02",
      "label": "Mission B",
      "ship_id": "KESSLER",
      "name": "COMPTUEX",
      "start": "2026-11-25T12:00:00Z",
      "mission_areas": ["AW", "ASW", "SUW", "MOB", "CCC"],
      "prerequisite_events": ["EVT-KESSLER-01"],
      "provenance": "proposed"
    }
  ]
}
```

Also: `EVT-VARNELL-01` (Mission C, 18 Nov, Basic Phase ASW certification event; needs SQQ-89 and LAN), `EVT-ASHBY-01` (Mission D, 22 Nov, sustainment exercise).

### 3.2 `cert_status.csv` **[PROP]**

Grain: one row per ship per certification.

| Column | Type | Example | Tag |
|---|---|---|---|
| `ship_id` | str | `KESSLER` | PH |
| `cert_id` | str | `CERT-KESSLER-AW` | PROP |
| `cert_name` | str | `Basic Phase AW mission-area certification` | S concept |
| `mission_area` | str | `AW` | S |
| `status` | enum | `CERTIFIED` | `NOT_STARTED`, `IN_PROGRESS`, `CERTIFIED`, `EXPIRED` | PROP |
| `certified_date` | date | `2026-05-20` | PROP |
| `expires` | date | `2027-05-20` | PROP |
| `planned_start` | date | | for IN_PROGRESS / NOT_STARTED | PROP |
| `depends_on_avail_id` | str | | spec 15 | PROP |
| `as_of`, `provenance` | | | |

## 4. Generator rules

- READ-E 4 chain (for ships coming out of maintenance) **[S]** events in order: MRG assessment → light-off → crew cert → dock trials / fast cruise → nav assessment → sea trials. Then Basic Phase certs → Group Sail/SWATT → COMPTUEX.
- Every `required_systems.eic` must exist in the mission tree (spec 09); every `watchstation_code` in `quals.csv` (spec 07).

## 5. Demo scenario and seeded inconsistencies

- Mission A requires SPY-1D ≥ 0.8 and 2 of `4310`. Both fail on the current trajectory (pump; people from day 6).
- **X6:** Varnell `CERT-VARNELL-ASW` `planned_start 2026-11-07`, `depends_on_avail_id AV-VARNELL-26-02`, but that CMAV was extended to 11 Nov (spec 15), so the cert start date is invalid.

## 6. Sources

navy.mil (Bulkeley crew certification; Curtis Wilbur Basic Phase; Gonzalez COMPTUEX); CPF (McCain; early certification); DVIDS; USNI Proceedings (Aug 2026). Links in `reports/MissionTwin additional data sources.md`.
