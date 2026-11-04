# 03 CASREP: casualty report messages

Implementation: standardized sets are parsed for the engine, and the optional LLM extracts typed facts with source lines
and spans from the same messages, including AMPN/RMKS narratives. `squadron/casrep_expected_facts.json` provides the
synthetic evaluation oracle. See [DEV 2 setup and evaluation](../docs/DEV2.md).

Tags: see `00_README.md` section 1.

## 1. The real source

- **What it is.** A CASREP reports a casualty: a deficiency in mission-essential equipment that **cannot be corrected within 48 hours** and reduces mission capability **[S-SNIP]** (NETCINST 3040.1A, 2021). Governed by NTTP 1-03.1 (Operational Reports), **not retrieved**; current set order and parts-set layout are **[UNV]**.
- **Format.** A serialized, set-based formatted naval message, not a PDF **[DATED]**.
- **Ownership.** CASREP data is owned by Fleet Forces and Pacific Fleet; GAO pulled it from MFOM **[S]** (GAO-12-887).
- **Classification.** Individual-ship CASREPs are classified when they reveal warfighting capability; roll-ups above ship level are not **[S]**. Our data is synthetic and unclassified by construction.
- **Supply link.** NAVSUP treats CASREPs as "high-visibility, high-priority requisitions" **[S-SNIP]**. CASREP orders are NORS requisitions with **RDD 999** for C2/C3/C4 **[DATED]**.
- **Current drafting tool.** Not publicly named **[UNV]**.

## 2. Why MissionTwin pulls it

The CASREP stream is MissionTwin's **primary event stream**:
- New casualty = a node goes down; category sets how badly a mission degrades.
- ESTIMATE (ETR) = the stated repair date, the anchor of the repair-time distribution and the deterministic "planned case".
- UPDATE history = ETR slips, which tell the engine how optimistic ETRs are.
- CASCOR = labels: parts receipt dates, **supply-caused delay in hours**, man-hours **[DATED]**.
- Rating cap rule: **Cat 4 forces the associated mission task to N (and SORTS equipment C-3 or lower); Cat 3 forces Q or lower (C-2 or lower)** **[S-SNIP]** (2023 carrier DRRS-S brief; surface rules may differ).

## 3. How we believe it is structured

### Report types **[DATED]**
| Type | Purpose |
|---|---|
| `INITIAL` | First report. One casualty per report; only one open CASREP per equipment item. RMKS gives a 30-day availability window for receiving parts or assistance. |
| `UPDATE` | Sent when repair date, parts status or assistance needs change. Always repeats the CASUALTY and ESTIMATE sets. Must reference the INITIAL's DTG. |
| `CORRECT` (CASCOR) | Casualty corrected. Records parts receipt dates, supply delay in hours, man-hours. |
| `CANCEL` (CASCAN) | Cancelled, for example deferred to a scheduled availability. |

### Categories **[DATED]** (exact wording from a study source **[UNV]**)
| Cat | Meaning |
|---|---|
| 1 | Not used |
| 2 | Minor degradation of a primary mission, or degradation/loss of a secondary mission (secondary-mission casualties are capped at C2) |
| 3 | Major degradation of a primary mission |
| 4 | Loss of at least one primary mission |

### Sets **[DATED]** (names sourced; order and sub-fields **[UNV]**)
`MSGID` (first; serial 1-999 per unit), `CASUALTY` (equipment, description), `ESTIMATE` (ETR), `ASSIST` (outside help required, type), `PARTS` (parts requested, per-line), `AMPN` (amplifying text, including parts receipt), `RMKS` (30-day schedule window for receiving parts/help).

## 4. Mock files

### 4.1 `casrep_messages/<casrep_id>_<seq>_<type>.txt` **[PROP]**

The raw message text, the input the ingest parser and LLM extractor read. Example (synthetic; set layout is our proposal modeled on the sourced set names):

```
UNCLAS//SYNTHETIC EXERCISE//
FM USS KESSLER
TO COMNAVSURFLANT NORFOLK VA
INFO COMDESRON NINE NINE
      NAVSUP WSS MECHANICSBURG PA
BT
UNCLAS //N04790//
MSGID/CASREP/USS KESSLER/017/NOV//
CASUALTY/INITIAL/AN/SPY-1D(V) RADAR COOLING SYSTEM/CAT:3/EIC:SPY1D-CW//
EQUIP/PUMP, COOLING WATER, SPY-1D/APL:APL-PH-000123/JCN:99101CF010042//
ESTIMATE/ETR:121200Z NOV 26//
ASSIST/REQ:YES/TYPE:FTS/ORG:NSWC TECH REP//
PARTS/1/NSN:4320-01-999-0001/QTY:1/DOC:R991016308A001/PD:02/RDD:999//
AMPN/COOLING WATER PUMP SEIZED DURING LIGHT-OFF. SPY-1D DEGRADED TO
SINGLE ARRAY FACE OPERATION. AW MISSION MAJOR DEGRADATION.//
RMKS/1. SHIP AVAILABLE TO RECEIVE PARTS AND ASSIST NORFOLK 05-15 NOV.
2. UNDERWAY GROUP SAIL 16 NOV.//
BT
```

Rules:
- Header and DTG: the message DTG `041200Z NOV 26` is the CASREP's key. Filename: `DDG991-26-017_01_INITIAL.txt`.
- `UPDATE`, `CORRECT`, `CANCEL` messages reference the INITIAL DTG in a `REF/A/MSG/USS KESSLER/041200Z NOV 26//` line **[PROP]** form, **[DATED]** rule.
- `CORRECT` adds `AMPN/PARTS RECEIVED 101400Z NOV 26. SUPPLY DELAY 98 HRS. MANHOURS 22.//`.
- Every file carries the banner line.

### 4.2 `casreps.json` **[PROP]**

Structured view of the same messages (what the parser should produce; also used as a test oracle).

```json
{
  "_banner": "SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA",
  "casreps": [
    {
      "casrep_id": "DDG991-26-017",
      "ship_id": "KESSLER",
      "uic": "99101",
      "serial": "017",
      "initial_dtg": "041200Z NOV 26",
      "initial_time": "2026-11-04T12:00:00Z",
      "category": 3,
      "eic": "SPY1D-CW",
      "equipment": "PUMP, COOLING WATER, SPY-1D",
      "jcn": "99101CF010042",
      "mission_areas_affected": ["AW"],
      "assist": {"required": true, "type": "FTS", "org": "NSWC TECH REP"},
      "parts": [{"nsn": "4320-01-999-0001", "niin": "019990001", "qty": 1,
                 "doc_number": "R991016308A001", "pd": "02", "rdd": "999"}],
      "etr_history": [
        {"dtg": "041200Z NOV 26", "etr": "2026-11-12T12:00:00Z", "report_type": "INITIAL"},
        {"dtg": "051000Z NOV 26", "etr": "2026-11-22T12:00:00Z", "report_type": "UPDATE"}
      ],
      "state": "OPEN",
      "closed": null,
      "messages": ["casrep_messages/DDG991-26-017_01_INITIAL.txt",
                   "casrep_messages/DDG991-26-017_02_UPDATE.txt"],
      "provenance": "proposed"
    }
  ]
}
```

`closed` when corrected: `{"type": "CORRECT", "dtg": "...", "parts_received": "...", "supply_delay_hrs": 98, "man_hours": 22}`.

## 5. Generator rules

- Volume **[S]** calibration: destroyers averaged **14.5 CASREPs per ship** (Jan 2008-Mar 2012, GAO-12-887; period basis to check) and counts rose on nearly every class FY11-21 (GAO-23-106440). For a 30-day window, 2-5 open CASREPs per DDG is a reasonable synthetic level **[PROP]**.
- Category mix (no public source; **[PROP]**): Cat 2 60%, Cat 3 30%, Cat 4 10%.
- ETR slip behavior (no public source; **[PROP]**): ~40% of CASREPs get at least one UPDATE pushing ETR later; slip size from `delay_model_params.yaml`.
- One open CASREP per equipment item (enforce).
- Serial numbers increase monotonically per ship.
- Every CASREP with parts has matching requisitions in spec 04 with `rdd = 999` and PD 01-03.

## 6. Demo scenario and seeded inconsistencies

| casrep_id | Ship | Story |
|---|---|---|
| `DDG991-26-017` | Kessler | Day 0 INITIAL Cat 3 SPY cooling pump, ETR 12 NOV; day 1 UPDATE slips ETR to 22 NOV (part `BB`→`BC`, ESD 15 NOV + 5-day CONUS transit + ~2 days install). The core demo. |
| `DDG991-26-015` | Kessler | Older Cat 2 on a nav radar, CORRECT on day -3 (gives a closed example with supply delay hours) |
| `DDG992-26-008`, `DDG992-26-009` | Varnell | **X2:** two Cat 2 CASREPs (SQQ-89 sonar processing and a combat-system LAN segment) that trace to one ethernet switch NIIN `019990044` (Gridley pattern) |
| `DDG993-26-004` | Ashby | **X1:** Cat 2 CASREP whose DTG matches no JCN |

## 7. Open questions

- NTTP 1-03.1 current set order, PARTS set layout, initial-report deadline (24 hours **[UNV]**).
- Surface-ship version of the Cat-to-rating cap rule.
- Real casualty durations: **no public source**; stays an assumption.

## 8. Sources

NETCINST 3040.1A; tpub gunners 275-277; GAO-12-887; GAO-23-106440; DRRS-S CVN SORTS brief (2023); tpub NORS/RDD 999; DVIDS Gridley case. Links in `reports/MissionTwin additional data sources.md`.
