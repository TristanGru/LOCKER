# 04 R-Supply and MILSTRIP supply status

Tags: see `00_README.md` section 1.

## 1. The real systems

- **R-Supply (Relational Supply)**, NTCSS: the afloat inventory and requisition system. Unit Level (small ships) and Force Level (big decks) variants were in active sustainment in 2025 **[S-SNIP]** (Navy solicitation N00244-25-Q-0017). Interfaces with NALCOMIS, OMMS-NG, MFOM and NMRO **[S-SNIP]**.
- **COSAL link.** NAVSEA calls the OMMS-NG/R-Supply database "the preferred and, most commonly used" channel for COSAL data **[S]** (PAFOS Ch. 6, Feb 2025). **Storeroom Items** = "allowed spares or repair parts carried in the ship's storeroom(s)" **[S]**.
- **NOSS / eCANNAB note.** NOSS is tracked as an ashore/future supply modernization context item, and eCANNAB is noted as a cannibalization workflow reference. This package does not assert either as a shipboard system of record.
- **MILSTRIP / DLMS** (DLM 4000.25): the DoD-wide standard R-Supply implements. Status codes live in **DLM 4000.25 Vol 2, Appendix AP7.16 (Change 18, Sep 2024)** **[S-SNIP]**. A secondary mirror lists 33 B-series, 33 C-series and 28 D-series codes **[S-SNIP]**.
- **No official R-Supply table or field names are public.**

## 2. Why MissionTwin pulls it

The most predictive parts signal is the **two-letter supply status code**, not anything inside R-Supply:
- `BA` with an ESD (estimated shipping date) = near-term arrival.
- `BB` = depends on a due-in.
- `BC`, `BV`, `BZ` = procurement tails.
- C-series = rejected; must be re-requisitioned.

Plus: priority designator, RDD 999 (CASREP), on-hand vs allowance (can the ship fix itself), and the donor's allowance (cross-deck cost).

## 3. How we believe it is structured

### Status codes **[S-SNIP]** (from AP7.16 via mirror)
| Code | Meaning | Delay regime (ours) **[PROP]** |
|---|---|---|
| `BA` | Being processed for shipment from stock; ESD when known (CCYYMMDD in DLMS) | `NEAR` |
| `BB` | Backordered against a due-in | `DUE_IN` |
| `BC` | Backordered, long delay expected | `LONG` |
| `BV` | On contract for direct vendor delivery | `PROCUREMENT` |
| `BZ` | Direct-delivery procurement in process | `PROCUREMENT` |
| `B3` | RDD unrealistic | `LONG` |
| `B5` | Follow-up received, working to improve ESD | carries prior regime |
| `CB`, `CG`, `CJ`, `CU` | Rejections | `REJECTED` |

### Priority and delivery **[DATED]** / **[S-SNIP]**
- Priority designator `01` (highest) to `15`. PD 01-03 = Issue Priority Group I **[DATED]**.
- CASREP orders are NORS requisitions; **RDD `999`** marks C2/C3/C4 CASREP requisitions **[DATED]**.
- Time Definite Delivery: Cat 1 = PD 01-03; Cat 2 if RDD is under 8 days out (CONUS) or under 21 days (OCONUS); default CONUS in-transit 5 days **[S-SNIP]** (ADC 1114).

### Unverified details **[UNV]**
14-character document number (DoDAAC + Julian date + serial); afloat DoDAAC = "R" + UIC; F/AD-by-urgency matrix; DIC AE_/AS_ transactions; COG and RIC mappings; SRI/OSI meanings.

## 4. Mock files

### 4.1 `requisition_status.csv` **[PROP]**

Grain: one row per requisition document number (latest status), plus `status_history` as a `;`-joined list.

| Column | Type | Example | Rule | Tag |
|---|---|---|---|---|
| `doc_number` | str(14) | `V9910163080001` | DoDAAC(6)+YDDD(4)+serial(4) | UNV |
| `ship_id` | str | `KESSLER` | | PROP |
| `dodaac` | str(6) | `V99101` | | UNV / PH |
| `jcn` | str(13) | `99101CF010042` | join to csmp | S fmt |
| `casrep_id` | str | `DDG991-26-017` | empty if not CASREP | PROP |
| `nsn` | str | `4320-01-999-0001` | | S fmt / PH |
| `niin` | str(9) | `019990001` | | PH |
| `nomenclature` | str | `PUMP, CENTRIFUGAL, COOLING WATER` | | PH |
| `qty` | int | `1` | | |
| `unit_of_issue` | str | `EA` | | S (common) |
| `priority_designator` | str(2) | `02` | 01-15 | DATED |
| `issue_priority_group` | int | `1` | 1 if PD 01-03, 2 if 04-08, 3 if 09-15 | DATED (IPG I) / UNV (II, III splits) |
| `rdd` | str | `999` | `999` for CASREP, else date | DATED |
| `nors` | bool | `true` | | DATED |
| `date_requisitioned` | date | `2026-11-04` | | |
| `status_code` | str(2) | `BC` | table above | S-SNIP |
| `status_date` | date | `2026-11-05` | | |
| `esd` | date | `2026-11-15` | estimated ship date; may be empty | S-SNIP |
| `delay_regime` | enum | `LONG` | derived from status_code | PROP |
| `status_history` | str | `2026-11-04T12:00:00Z BB 2026-11-05;2026-11-05T10:00:00Z BC 2026-11-15` | `;`-joined entries of `<Zulu time> <code> <ESD or ->` (build change: times and per-entry ESD let the scenario player replay what was known when) | PROP |
| `source_of_supply` | str | `NAVSUP WSS` | `NAVSUP WSS`, `DLA`, `VENDOR`, `PROGRAM OFFICE` | PROP |
| `tcn` | str | | transportation control number once shipped | S (concept) / PH |
| `expedite_flag` | bool | `true` | OTS/GDSC CASREP escalation | PROP |
| `system_of_record` | enum | `RSUPPLY` | `RSUPPLY` | PROP |
| `as_of` | datetime | `2026-11-05T06:00:00Z` | | |
| `provenance` | str | `proposed` | | |

### 4.2 `onboard_allowance_cosal.csv` **[PROP]**

Grain: one row per NIIN per ship (storeroom items, plus installed-equipment parts referenced by the mission tree).

| Column | Type | Example | Tag |
|---|---|---|---|
| `ship_id`, `uic` | | `VARNELL`, `99102` | PH |
| `niin`, `nsn`, `nomenclature` | | `019990001` | PH |
| `apl` | str | `APL-PH-000123` | PH |
| `item_type` | enum | `STOREROOM` / `INSTALLED` | S (storeroom items) / PROP |
| `allowance_qty` | int | `1` | S concept |
| `on_hand_qty` | int | `1` | |
| `due_in_qty` | int | `0` | |
| `sri_osi` | str | `SRI` | UNV |
| `cross_deck_eligible` | bool | `true` | PROP (storeroom only) |
| `last_inventory_date` | date | `2026-09-30` | PROP |
| `system_of_record` | enum | `RSUPPLY` | PROP |
| `as_of`, `provenance` | | | |

### 4.3 `status_code_reference.csv` **[S-SNIP codes, PROP regimes]**

`code, series, meaning, delay_regime, source, provenance`. One row per code in the table above (expand to the full AP7.16 list once verified).

## 5. Generator rules

- Status mix for open high-priority requisitions (placeholder, not a statistic) **[PROP]**: BA 30%, BB 30%, BV/BZ 15%, BC 10%, B5 5%, C-series 5%, other 5%.
- Every CASREP part line gets one requisition: PD 01-03, `rdd 999`, `nors true`.
- Non-CASREP job parts: PD 05-15, RDD a date.
- About 5-10% of `BA` rows have an ESD in the past with no newer status (realistic staleness; seeded **X3** on Ashby).
- `system_of_record`: shipboard rows use `RSUPPLY`; NOSS/eCANNAB are documented as modernization context, not asserted afloat sources.

## 6. Demo scenario rows

- **Kessler `V9910163080001`**: NIIN `019990001` cooling pump, PD `02`, RDD `999`, day 0 `BB` (ESD `2026-11-05`, which matches the INITIAL ETR of 12 NOV), day 1 `BC`, ESD `2026-12-15`, `expedite_flag true`.
- **Kessler COSAL:** NIIN `019990001` storeroom allowance 0, on hand 0 (cannot self-fix).
- **Varnell COSAL:** NIIN `019990001` storeroom allowance 1, on hand 1, `cross_deck_eligible true`. Cross-decking drops it below allowance (**X5**).
- **Varnell X2:** two requisitions on ethernet switch NIIN `019990044`, one per CASREP; only one is actually needed.
- **Ashby X3:** a `BA` row with ESD `2026-10-30` (already past) and no update.

## 7. Open questions

- Full AP7.16 code table from DLA (the primary file returned 403).
- Document-number format, DoDAAC convention, IPG II/III splits.
- NOSS afloat fielding and data model.

## 8. Sources

NAVSEA PAFOS Ch. 6 (Feb 2025); orangeslices N00244-25-Q-0017; ClearanceJobs R-Supply SME; Defense News (NOSS award); HigherGov P-1 line 2611; DLA DLM 4000.25 AP7.16; logtool.com mirror; DLA ADC 1049, ADC 1114; tpub requisition precedence and NORS. Links in `reports/MissionTwin additional data sources.md`.
