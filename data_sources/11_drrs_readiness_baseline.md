# 11 DRRS (DRRS-S input, DRRS-N construct): today's readiness ratings

Tags: see `00_README.md` section 1.

## 1. The real system

- **Naming is contested in the sources.**
  - NTRP 1-03.5 (Feb 2016) describes **DRRS-N** as the Navy's capabilities-based system of record: units rate **Navy Mission Essential Tasks (NMETs) Yes, Qualified Yes or No (Y/Q/N)** and show **PESTO** resource pillars (Personnel, Equipment, Supply, Training, Ordnance; Facilities in some documents) **[S-SNIP]**.
  - USFF Instruction 3501.6 (Jun 2020): **since 1 Oct 2019, OSD-hosted DRRS-S is the Navy's primary readiness input tool**, ashore DRRS-N retired, DRRS handles data **up to SECRET** **[S-SNIP, DATED]**.
  - Best reading: DRRS-N survives as the reporting construct and vocabulary (NMETs, PESTO); DRRS-S is the input/display tool.
- **Cadence.** Monthly, or within 24 hours of a significant change **[DATED]** (GAO-12-887).
- **CASREP caps** (2023 carrier brief, surface may differ) **[S-SNIP]**: Cat 4 → MET `N`, SORTS equipment C-3 or lower; Cat 3 → `Q` or lower, C-2 or lower.
- **Inputs.** MFOM sends 0-100 warfare-area indices **[S]**; training pillar TORIS → NTIMS → DRRS with TFOM **[S]**; personnel pillar NEC requirements from FLTMPS/NTMPS **[S]**.
- **Status, Nov 2026.** DoD DRRS being modernized, not replaced (DoDD 7730.65, May 2023); DRRS data still feed the semi-annual readiness report to Congress (CRS IF12240, Sep 2026) **[S]**.

## 2. Why MissionTwin uses it

DRRS shows **today's** Y/Q/N. MissionTwin projects **Y/Q/N per mission at future dates** (for example day 9, day 21). The baseline file is day 0; the forecast must agree with it at day 0, which is a built-in sanity check.

**Classification caution.** Real DRRS data is SECRET-capable and lives on SIPR. A fielded IL5 tool should not ingest it; our mock is a synthetic, unclassified stand-in **[PROP]** (see spec 20).

## 3. Mock file

### 3.1 `readiness_baseline.csv` **[PROP]**

Grain: one row per ship per mission area at day 0.

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `ship_id` | str | `KESSLER` | | PH |
| `as_of` | datetime | `2026-11-04T08:00:00Z` | scenario now | |
| `mission_area` | str | `AW` | from spec 10 | S |
| `nmet_id` | str | `NMET-AW-01 (SYNTH)` | | PH |
| `rating` | enum | `Q` | `Y`, `Q`, `N` | S |
| `mfom_index` | int | `58` | 0-100 | S scale |
| `band` | enum | `RED` | GREEN ≥ 80, AMBER 60-79, RED < 60 | S bands |
| `p_score`, `e_score`, `s_score`, `t_score`, `o_score` | int | `85` | PESTO pillar scores, 0-100 | S pillars / PROP scale |
| `limiting_factor` | str | `CASREP DDG991-26-017 CAT 3` | | PROP |
| `provenance` | str | `proposed` | | |

Rules:
- `rating` must respect the CASREP cap rule against open CASREPs at day 0.
- `mfom_index` should equal the engine's day-0 computed score within rounding (test oracle).

## 4. Demo scenario rows

- Kessler AW: `Q` (Cat 3 CASREP caps at Q), `mfom_index 58`, `RED`, limiting factor the pump CASREP.
- Kessler ASW, SUW, MOB, CCC: `Y`, 82-95.
- Varnell ASW: `Q` (X2 CASREPs, Cat 2) ~74 AMBER; others `Y`.
- Ashby: all `Y` except CCC `Q` (X1 CASREP).

## 5. Open questions

- Surface-ship CASREP cap rule; current DRRS-S field names; NMET numbering.

## 6. Sources

NTRP 1-03.5 (2016); USFFINST 3501.6 (2020); GAO-12-887; DRRS-S CVN SORTS brief (2023); DoDD 7730.65; CRS IF12240; MFOM patent; COMNAVSURFORINST 3502.1D. Links in `reports/MissionTwin additional data sources.md`.
