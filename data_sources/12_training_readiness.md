# 12 Training readiness: TORIS, NTIMS, TFOM

Tags: see `00_README.md` section 1.

## 1. The real systems

- Surface training values flow **TORIS → NTIMS → DRRS**, with **TFOM (Training Figure of Merit)** as the core training metric **[S]** (COMNAVSURFORINST 3502.1D, 2015; DRRS-S PXO brief, 2023).
- TORIS/TFOM records team and unit training events, not individual PQS (which is R-ADM, spec 07) **[UNV]** split.
- No public definition of TFOM's formula, nor of supply (SFOM) or ordnance (OFOM) figures of merit **[S]** (absence noted).
- Certifications lapse and need revalidation; an Aug 2026 Proceedings article argues for "flexible, weighted certifications" **[S]**.

## 2. Why MissionTwin uses it

- Training pillar of the day-0 baseline (spec 11).
- Team-level readiness: a mission can fail because a **watch team** (for example the CIC air defense team) has not completed required team training, even when every individual is qualified.

## 3. Mock file

### 3.1 `training_readiness.csv` **[PROP]**

Grain: one row per ship per mission area per training requirement.

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `ship_id` | str | `KESSLER` | | PH |
| `mission_area` | str | `AW` | spec 10 | S |
| `requirement_id` | str | `TRQ-AW-07 (SYNTH)` | | PH |
| `requirement_name` | str | `CIC air defense team trainer` | | PH |
| `team` | str | `CIC AIR DEFENSE TEAM 1` | | PH |
| `last_completed` | date | `2026-09-15` | | PROP |
| `periodicity_days` | int | `90` | | PROP |
| `expires` | date | `2026-12-14` | last_completed + periodicity | PROP |
| `tfom_value` | float | `0.86` | 0-1 | S concept / PROP scale |
| `as_of` | datetime | | | |
| `provenance` | str | | | |

## 4. Generator rules

- TFOM per mission area 0.75-0.95 for ships in Integrated/Sustainment phase, 0.5-0.8 in Basic **[PROP]**.
- A few requirements expire inside the horizon.

## 5. Demo scenario rows

- Kessler AW team trainer expires `2026-11-20` (after Mission A, before Mission B), a secondary domino for Mission B.

## 6. Sources

COMNAVSURFORINST 3502.1D; DRRS-S PXO brief (2023); USNI Proceedings (Aug 2026). Links in both reports.
