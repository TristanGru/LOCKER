# 08 FLTMPS / NTMPS: NEC requirements and billets

Tags: see `00_README.md` section 1.

## 1. The real source

- **FLTMPS / NTMPS** (Fleet / Navy Training Management and Planning System) is the **"primary source" for NEC requirements** for the DRRS Personnel pillar **[S]** (COMNAVSURFORINST 3502.1D, DRRS-S PXO brief 2023). Also named as a source of R-ADM records **[S]** (Privacy Act notice).
- **NEC format.** Since October 2017 NECs are **four alphanumeric characters**: first character = community, next two = identifiers, fourth = remaining training blocks; legacy `2800` became `S000` **[S]** (Navy Times 2017).
- **Ship vs shore.** R-ADM data is reportedly not accepted by NSIPS **[S-SNIP]**, so the shore NEC/billet picture and the ship's roster can disagree.
- **Shore personnel systems.** NSIPS (and NSIPS Web Afloat, in use 2025 **[S]**), MyNavy HR. Not mocked separately.

## 2. Why MissionTwin pulls it

- **NEC gap**: billets requiring an NEC vs sailors aboard holding it.
- **PRD cliff**: several holders of a critical NEC leaving inside 90 days.
- **Drift detection**: NEC present in R-ADM roster but absent from FLTMPS (or vice versa).

## 3. Mock file

### 3.1 `nec_billets.csv` **[PROP]**

Grain: one row per billet (authorized position) per ship.

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `ship_id`, `uic` | | `KESSLER`, `99101` | | PH |
| `billet_id` | str | `B-CF-014` | | PROP |
| `billet_title` | str | `AEGIS RADAR TECHNICIAN` | | PH |
| `rate_required` | str | `FC2` | | S style |
| `nec_required` | str(4) | `F9A1` | 4-char | S fmt / PH value |
| `work_center` | str(4) | `CF01` | | |
| `fltmps_holder_member_id` | str | `M-0007` | empty if gapped (shore view) | PROP |
| `holder_prd` | date | `2026-11-10` | | PROP |
| `gap_start` | date | `2026-11-10` | billet becomes gapped | PROP |
| `inbound_member_id` | str | | relief, if any | PROP |
| `inbound_report_date` | date | | | PROP |
| `as_of` | datetime | | | |
| `provenance` | str | | | |

### 3.2 Placeholder NEC list **[PH]**

| NEC | Meaning (ours) |
|---|---|
| `F9A1` | Aegis SPY radar maintenance technician (synthetic) |
| `F9B2` | Aegis weapons system operator (synthetic) |
| `E9C1` | Combat systems LAN technician (synthetic) |
| `M9D1` | Gas turbine maintenance (synthetic) |

Real NEC codes for these roles exist (NAVPERS 18068) but were not retrieved; do not imply ours are real.

## 4. Generator rules

- Billets with `nec_required` must reference NECs that also appear in `roster.csv` `necs` for the matching holder (except seeded X8).
- 5-10% of billets gapped across the squadron **[PROP]**, consistent with fleet manning strain **[S]**.

## 5. Demo scenario rows

- Kessler billets `B-CF-014` (holder `M-0007`, PRD 2026-11-10, no inbound relief) and `B-CF-015` (holder `M-0011`).
- **X8:** Kessler billet `B-CF-016` shows `fltmps_holder_member_id` empty, while `roster.csv` shows `M-0019` holding `F9A1` and assigned to that work center.

## 6. Open questions

- Real NEC codes (NAVPERS 18068) and the FLTMPS report layout.

## 7. Sources

COMNAVSURFORINST 3502.1D; DRRS-S PXO brief (2023); Federal Register 2012-12045; Navy Times (Jul 2017 NEC overhaul); NAVPERS 15878N; NAVADMIN 184/25. Links in `reports/Navy SKED OMMS NG and RADM.md`.
