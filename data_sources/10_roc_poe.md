# 10 ROC/POE: which missions a ship class owes

Tags: see `00_README.md` section 1.

## 1. The real source

- **ROC/POE** (Required Operational Capabilities / Projected Operational Environment): class-specific OPNAVINST 3501.xxx instructions assign **primary and secondary mission areas** (AW, ASW, SUW and so on) and the required capability by readiness condition; ROC/POE also drive manpower requirements **[DATED]** (archived 2013 DON 3501 series).
- OPNAVINST 3501.115F (2023) updated required readiness levels **[S]** (title-level).
- Some ROC/POE content is classified. Real table columns and the Full / Minimal / Limited capability legend are **[UNV]**.
- Secondary-mission casualties cap at CASREP Cat 2 **[DATED]** (spec 03), so primary vs secondary matters for severity.

## 2. Why MissionTwin uses it

- The top of the dependency graph: which mission areas a DDG owes.
- Primary vs secondary: sets mission weights and CASREP severity caps.
- Readiness condition: what capability is required when (for example Condition III steaming vs Condition I).

## 3. Mock file

### 3.1 `roc_poe_mission_map.csv` **[PROP]**

Grain: one row per mission area per readiness condition per ship class.

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `ship_class` | str | `DDG (notional)` | | PH |
| `mission_area` | str | `AW` | `AW`, `ASW`, `SUW`, `MOB`, `CCC`, `STW`, `NSW`, `FSO` | S (AW/ASW/SUW) / UNV (others) |
| `mission_area_name` | str | `Air Warfare` | | S/UNV |
| `primary_secondary` | enum | `P` | `P`, `S` | S concept |
| `readiness_condition` | str | `III` | `I`, `II`, `III`, `IV` | UNV |
| `required_capability` | enum | `F` | `F` full, `L` limited, `M` minimal | UNV legend |
| `weight` | float | `0.30` | sums to 1.0 per condition | PROP |
| `provenance` | str | `proposed` | | |

### 3.2 Notional DDG content **[PH]**

| mission_area | P/S | weight (Cond III) |
|---|---|---|
| AW | P | 0.30 |
| ASW | P | 0.20 |
| SUW | P | 0.20 |
| MOB | P | 0.15 |
| CCC | P | 0.10 |
| STW | S | 0.05 |

## 4. Generator rules

- `mission_area` values here are the only allowed `mission_area` values anywhere else (spec 09, 11, 14).
- Weights are placeholders; show them in the UI assumptions table.

## 5. Open questions

- Real DDG ROC/POE assignments and capability legend (OPNAVINST 3501.xxx for DDG-51; likely partly classified).

## 6. Sources

Archived DON 3501 series (2013 snapshot); GlobalSpec OPNAVINST 3501.115F; tpub CASREP category rules. Links in `reports/MissionTwin additional data sources.md`.
