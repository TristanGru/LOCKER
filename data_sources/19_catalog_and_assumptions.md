# 19 Data catalog and the assumptions ledger

Tags: see `00_README.md` section 1.

## 1. The real source

- **Jupiter** (Navy's instance of Advana, launched Apr 2020) has a Warfighting area covering readiness, maintenance and operations data **[S]**. Task Force Hopper chose it as the surface force's single data catalog; it **lists datasets with their points of contact** rather than hosting all of them **[DATED]**.
- The Jan 2026 DoW AI strategy requires federated data catalogs **[secondary]**.
- MissionTwin's mock `data_catalog.json` imitates that pattern: one entry per dataset with steward, marking and refresh.

The **assumptions ledger** (`delay_model_params.yaml`) is ours. It holds every number the engine uses that is not computed from data, each tagged sourced or assumed. This is what the UI's editable assumptions table reads.

## 2. Mock files

### 2.1 `data_catalog.json` **[PROP]**

```json
{
  "_banner": "SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA",
  "datasets": [
    {
      "file": "csmp.csv",
      "spec": "data_sources/02_omms_ng_csmp.md",
      "real_system": "OMMS-NG / AWN",
      "system_of_record": "OMMS-NG",
      "steward": "TYCOM N43 (notional)",
      "marking": "CUI when real; NOTIONAL here",
      "refresh": "daily",
      "fielded_access_path": "NTCSS replication via L-IDE to Jupiter (inferred)",
      "as_of": "2026-11-04T06:00:00Z",
      "staleness_threshold_days": 5
    }
  ]
}
```

One entry per mock file. The UI's source panel reads `real_system`, `steward`, `as_of` and `staleness_threshold_days`.

### 2.2 `delay_model_params.yaml` **[PROP]**

Every value is labeled. Placeholders from the research are **not statistics**.

```yaml
_banner: "SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA"
scenario_now: "2026-11-04T08:00:00Z"
seed: 20261104
runs: 10000
bands: {green: 0.80, amber: 0.60}                  # sourced: MFOM patent
status_score_map: {"0": 1.0, "1": 0.8, "3": 0.6, "2": 0.0}   # sourced: MFOM patent
casualty_threshold_hours: 48                         # sourced (snippet): NETCINST 3040.1A
casrep_rating_cap: {cat4: N, cat3: Q}                # sourced (snippet): carrier DRRS-S brief
staleness_threshold_days: 5                          # assumed

part_arrival_days_by_regime:                         # assumed (placeholder medians from research notes)
  NEAR:        {dist: lognormal, median_conus: 5,  median_oconus: 15,  sigma: 0.4}
  DUE_IN:      {dist: lognormal, median: 45,  sigma: 0.5}
  LONG:        {dist: lognormal, median: 90,  sigma: 0.6}
  PROCUREMENT: {dist: lognormal, median: 135, sigma: 0.7, tail_beyond_days: 365}
  REJECTED:    {action: re_requisition, add_days: 3}
transit_days_conus_default: 5                        # sourced (snippet): ADC 1114
program_office_release_days: {min: 2, max: 5}        # assumed
expedite_effect: {regime_shift: "one regime faster if wholesale on hand > 0, else none"}  # assumed

cross_deck_days:                                     # assumed
  same_port: 1
  in_company: {min: 1, max: 3}
  different_ports_conus: {min: 2, max: 5}

repair_after_part_days: {dist: triangular, min: 1, mode: 2, max: 4}   # assumed
etr_slip: {p_slip: 0.4, slip_days: {dist: lognormal, median: 4, sigma: 0.6}}   # assumed (no public data)
casrep_category_mix: {cat2: 0.6, cat3: 0.3, cat4: 0.1}                # assumed (no public data)

availability_slip:                                   # informed by GAO overrun rates (~70% late 2014-18)
  p_late: 0.7
  extension_days_cmav: {dist: lognormal, median: 3, sigma: 0.5}

cannibalization_note: "Any cannibalization rate is a lower bound (GAO-02-86: data understated up to 50%)"
```

### 2.3 Build change: machine-readable tags

YAML comments are lost when the file is parsed, so the generated ledger stores every key as
`{value: ..., tag: sourced|assumed, source: "..."}` (for example `transit_days_conus_default: {value: 5, tag: sourced, source: "DLA ADC 1114 (snippet)"}`).
The single source of defaults is `DEFAULT_PARAMS` in `missiontwin/domain.py`. Keys added during the build, all `assumed` unless noted:
`ranking_runs` (2000), `engineering_validation_days` (1-3), `cannibalize_extra_days` (1-2, informed by GAO double-work finding),
`background_failure_rate_per_unit_day` (0.001), `lost_pms_hazard_multiplier` (2.0), `training_refresh_success` (0.9),
`etr_slip` now `{p_slip, median, sigma}`, `availability_slip` now `{p_late, median, sigma}`.
Edits made in the UI are scenario changes (event-sourced), never writes to this file.

## 3. Rules

- The engine reads only this file for assumptions. No magic numbers in code.
- Every key that is `assumed` shows `ASSUMED` in the UI; every `sourced` key shows its source.
- Changing a value re-runs the forecast (the "change one assumption live" demo moment).

## 4. Calibration anchors (from the research)

| Parameter | Public figure | Use |
|---|---|---|
| CASREP volume | DDG 14.5 per ship (GAO-12-887, 2008-12) | sanity-check generator volume |
| Availability overrun | ~70% late (GAO-20-86) | `availability_slip.p_late` |
| Delivery standards | TDD Cat 2 under 8/21 days; 5-day CONUS transit (ADC 1114) | transit defaults |
| Duplicate CASREPs | 7 CASREPs, 1 root part (Gridley) | dedup rule |
| Manning | 84,379 needed vs 70,705 at sea (Nov 2023) | thin qual margins |

**No public source** for CASREP duration, ETR slip rate, category mix, customer wait time or cannibalization approval latency. These stay `assumed`.

## 5. Sources

WARU "What is Jupiter?"; FedScoop (Task Force Hopper, 2022); Holland & Knight (DoW AI strategy); plus all calibration sources in `reports/MissionTwin additional data sources.md`.
