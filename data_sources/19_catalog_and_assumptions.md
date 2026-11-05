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
      "staleness_threshold_days": 5,
      "usage": "modeled",
      "explanation": "Material impairments and first linked requisition; not a multi-part repair scheduler"
    }
  ]
}
```

One entry per mock file. The UI's source panel reads `real_system`, `steward`, `as_of` and `staleness_threshold_days`.
`usage` (modeled, partial, review_only, comparison, context_only, not_modeled) and `explanation` state how the forecast
uses the source; the app shows them as written and never assumes a coverage level for a file.

### 2.2 `delay_model_params.yaml` **[PROP]**

Every value is labeled. Placeholders from the research are **not statistics**.

```yaml
_banner: "SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA"
scenario_now: "2026-11-04T08:00:00Z"
seed: 20261104
runs: 10000
bands: {green: 0.80, yellow: 0.60}                 # sourced: MFOM patent
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
program_office_release_days: {min: 2, max: 5}        # assumed; fallback when a wholesale record states no release_lead_days
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
The generator writes the synthetic values from `DEFAULT_PARAMS` in `missiontwin/synthetic_spec.py`; the running system reads
only this file (there is no fallback in code, and `validation.py` lists the keys the engine requires). Keys added during the build, all `assumed` unless noted:
`ranking_runs` (2000), `engineering_validation_days` (1-3), `cannibalize_extra_days` (1-2, informed by GAO double-work finding),
`background_failure_rate_per_unit_day` (0.001), `lost_pms_hazard_multiplier` (2.0), `training_refresh_success` (0.9),
`etr_slip` now `{p_slip, median, sigma}`, `availability_slip` now `{p_late, median, sigma}`,
`casrep_category_score` (CAT 2 0.6, CAT 3/4 0.0), `casrep_no_etr_days` (30), `unknown_status_regime` (DUE_IN),
`expedite_regime_step` (one regime faster), `redundancy_loss_score` (0.6), `system_capable_score` (0.6), and `fix_search`
(minimum gain 1 point, gate treated as met at 0.995, casualty probability 0.02, ISIC shift options 4 and 7 days, search sizes).
`editable_ranges` (no `value`) lists the assumptions a user may edit and their bounds.
Edits made in the UI are scenario changes (event-sourced), never writes to this file.

### 2.4 `dataset_profile.json` **[PROP]**

Who the units are and how they are drawn and supplied: `ships` (name, hull, UIC, DODAAC, role), `watchstations`,
`scenario_now` (day 0), `local_time` (homeport UTC offset and label), `inport_employment_codes` (schedule codes meaning
pierside), `supply_holders` (which holders count as wholesale stock, which a fix may pull from directly, and the release lead
when a stock record states none), `visual_model`, `mounts`, `system_mounts` and `component_mounts` (where each system sits
on the illustrative ship). Installations come from `shore_profile.json`. The supply status code to delay regime mapping is
`status_code_reference.csv` (`CARRIES_PRIOR` keeps the previous status's regime). A dataset without this file is rejected.

## 3. Rules

- The engine reads only this file for assumptions. No magic numbers in code.
- Runtime code names no unit, system, part, watchstation or event; `tests/test_data_only.py` enforces it and adds a ship in
  data alone to prove it appears everywhere, with its own CO sign-in.
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
