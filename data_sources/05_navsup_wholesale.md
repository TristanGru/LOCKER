# 05 NAVSUP WSS, DLA, One Touch Support and program-office assets

Tags: see `00_README.md` section 1.

## 1. The real sources

- **NAVSUP Weapon Systems Support (WSS)** supports **almost 300 deployable ships** **[S-SNIP]** and treats CASREPs as "high-visibility, high-priority requisitions" **[S-SNIP]**.
- **One Touch Support (OTS)** via the **Global Distance Support Center (GDSC)**: "Stock Availability, Requisition Status" and a dedicated **"One Touch Support High Priority (CASREP) Requisition Status"** function, plus a Priority Material Office **[S-SNIP]**. Access requires a DoD PKI certificate registered in the NAVSUP Master Directory **[S-SNIP]** (NETC NROTC supply binder, Aug 2025). **No public OTS export layout.**
- **DLA** holds consumable wholesale stock (general knowledge) **[UNV]**.
- **Program-office assets.** In the April 2024 USS Gridley case, **7 CASREPs traced to one ethernet switch** for the AN/SQQ-89; the ISEA confirmed 6 were needed; WSS filled **5 from the shelf and 1 from program office IWS-5** **[S]** (DVIDS).
- NAVSUP dashboards are hosted on the Navy Data Platform / Advana **[S-SNIP]**.

## 2. Why MissionTwin pulls it

The Gridley case sets the **fix-search order** **[PROP, from S case]**:
1. Wholesale stock (WSS/DLA).
2. Program-office assets.
3. Sister ships (spec 06), only after 1 and 2.

It also says: **deduplicate CASREPs that share a root part** before ordering.

Wholesale data drives the "expedite" fix: if wholesale has stock, expediting shortens the delay regime; if not, expediting does little.

## 3. How we believe it is structured

No public layout. We model the minimum a fix ranker needs: per NIIN, where stock exists, how much, and how long it takes to reach a ship **[PROP]**.

## 4. Mock file

### 4.1 `wholesale_stock.csv` **[PROP]**

Grain: one row per NIIN per stock holder.

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `niin` | str(9) | `019990001` | | PH |
| `nsn` | str | `4320-01-999-0001` | | PH |
| `nomenclature` | str | `PUMP, CENTRIFUGAL, COOLING WATER` | | PH |
| `holder` | enum | `PROGRAM_OFFICE` | `NAVSUP_WSS`, `DLA`, `PROGRAM_OFFICE`, `VENDOR` | PROP |
| `holder_name` | str | `AEGIS PROGRAM OFFICE (SYNTH)` | | PH |
| `location` | str | `MECHANICSBURG PA` | | PH |
| `on_hand_qty` | int | `1` | | |
| `due_in_qty` | int | `2` | | |
| `due_in_date` | date | `2026-12-20` | | |
| `release_lead_days` | int | `3` | days to release to shipment | PROP |
| `transit_days_conus` | int | `5` | default from ADC 1114 | S-SNIP |
| `transit_days_oconus` | int | `10` | | PROP |
| `requires_engineering_validation` | bool | `true` | ISEA confirms need (Gridley) | S (case) / PROP field |
| `as_of` | datetime | | | |
| `provenance` | str | | | |

## 5. Generator rules

- Most mission-critical NIINs: WSS on hand 0-3. Program-office rows exist only for combat-system NIINs.
- Program-office release requires engineering validation (adds 1-3 days) **[PROP]**.
- Consumables (DLA) have short lead times, repairables (WSS) longer **[UNV]**.

## 6. Demo scenario rows

- NIIN `019990001` (SPY cooling pump): `NAVSUP_WSS` on hand **0**, due in 2 on `2026-12-20`; `PROGRAM_OFFICE` on hand **1**, release lead 3 days, engineering validation required. This is fix candidate 2.
- NIIN `019990044` (ethernet switch, Varnell X2): `NAVSUP_WSS` on hand 4 (dedup lesson: one order is enough).

## 7. Open questions

- Real OTS/GDSC status fields.
- Program-office asset release rules.
- Current customer wait times: **no public figure found**; stays an assumption.

## 8. Sources

DVIDS (WSS ~300 ships; Gridley case); NAVSUP GDSC page; NETC NROTC supply binder (Aug 2025); DLA ADC 1114. Links in `reports/MissionTwin additional data sources.md`.
