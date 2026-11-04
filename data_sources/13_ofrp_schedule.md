# 13 OFRP employment schedule

Tags: see `00_README.md` section 1.

## 1. The real source

- **OFRP** (Optimized Fleet Response Plan): OPNAVINST 3000.15A and COMUSFLTFORCOM/COMPACFLTINST 3000.15B (Oct 2020) define phases **maintenance, basic, integrated/advanced, sustainment** **[S]**.
- **Cycle length.** Notional 36 months; "often ends up clocking in at 42 to 44 months," mostly late modernization **[S-SNIP]** (USNI News, Feb 2026, CSG-focused).
- **Process.** Schedules move through a **Fleet Forces quarterly schedule review** **[S]** (TYCOM scheduler job posting). Ship level **[DATED]** (SWOS material):
  - The Operations Officer owns the ship's schedule.
  - Long-range schedule rolls 18-24 months ahead, updated quarterly.
  - Quarterly scheduling conference locks underway inputs ~6 months ahead.
  - Employment codes include **RFS** (ready for sea), **UPK** (upkeep), **HOLUPK** (holiday leave and upkeep).
- **No public source names the current fleet scheduling IT system or its export format** **[UNV]**.
- For a 2-4 week horizon the schedule is mostly fixed; the risk is availabilities and certifications slipping inside it.

## 2. Why MissionTwin uses it

- The **deadline**: mission dates.
- Phase context (what kind of events are expected).
- Where the ship will be (feeds `ship_positions.csv`, spec 06).
- Schedule-change messages are events in the scenario player (the demo's "schedule shift").

## 3. Mock file

### 3.1 `schedule_30day.csv` **[PROP]**

Grain: one row per ship per schedule block (contiguous date range with one employment).

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `ship_id` | str | `KESSLER` | | PH |
| `block_id` | str | `SCH-KESSLER-07` | | PROP |
| `start_date`, `end_date` | date | `2026-11-13`, `2026-11-19` | inclusive | |
| `ofrp_phase` | enum | `INTEGRATED` | `MAINTENANCE`, `BASIC`, `INTEGRATED`, `SUSTAINMENT`, `DEPLOYED` | S |
| `employment_code` | str | `UNDERWAY` | `RFS`, `UPK`, `HOLUPK`, `UNDERWAY`, `INPORT`, `AVAIL` | S (RFS/UPK/HOLUPK, DATED) / PROP |
| `event_id` | str | `EVT-KESSLER-01` | join to spec 14; empty if none | PROP |
| `oparea_or_port` | str | `VACAPES OPAREA` | | PH (real area names OK) |
| `status` | enum | `FIRM` | `TENTATIVE`, `FIRM`, `CHANGED`, `CANCELLED` | PROP |
| `source_msg_dtg` | str | `071500Z NOV 26` | schedule-change message DTG | PROP |
| `superseded_block_id` | str | `SCH-KESSLER-05` | for changed blocks | PROP |
| `as_of` | datetime | | | |
| `provenance` | str | | | |

## 4. Generator rules

- Each ship's blocks tile its horizon with no gaps or overlaps (test).
- Schedule changes never edit a row; they add a new row with `status CHANGED` and `superseded_block_id` (history preserved; matches event-sourced engine).

## 5. Demo scenario rows

**Kessler** (INTEGRATED phase):
- Day 0-8: `INPORT NORFOLK VA` (`UPK`).
- Original plan: Group Sail/SWATT underway day 12-18.
- **Day 3 change** (`source_msg_dtg 071500Z NOV 26`): Group Sail moved **earlier to day 9-15** (13-19 Nov), `event_id EVT-KESSLER-01` = **Mission A**.
- Day 16-20: in port.
- Day 21 onward: COMPTUEX underway, `event_id EVT-KESSLER-02` = **Mission B** (25 Nov).

**Varnell** (BASIC phase): CMAV day -10 to day 7 (planned end day 4, extended to 11 Nov; see spec 15), in port to day 13, underway day 14-17 for **Mission C** (`EVT-VARNELL-01`, ASW certification event, 18 Nov).

**Ashby** (SUSTAINMENT): underway VACAPES day 0-5, in port day 6-17, underway day 18-24 for **Mission D** (`EVT-ASHBY-01`, 22 Nov).

## 6. Open questions

- Current fleet scheduling system and its export; real employment code list.

## 7. Sources

BUMEDINST 3000.1 (OFRP references); USNI News (Feb 2026); LCE TYCOM scheduler posting; SWOS 72-2, 72-4. Links in `reports/MissionTwin additional data sources.md`.
