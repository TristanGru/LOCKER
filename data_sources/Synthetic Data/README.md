# Synthetic DDG Exercise Dataset

SYNTHETIC - FOR EXERCISE - NOT REAL NAVY DATA

## Scope and Ship Choice

Three fictional guided-missile destroyers use a **notional Arleigh Burke-style
Flight IIA** equipment model: Kessler (DDG-991), Varnell (DDG-992), and Ashby
(DDG-993). Each has 300 invented personnel records, including officers, chiefs,
and junior enlisted personnel. No names, movements, capabilities, or personnel
records were copied from an actual ship.

The future dashboard visual is **US Navy Combatant, DTMB 5415**. This is a generic
combatant visual reference, not an assertion that the hull is an exact Flight IIA
model or that the real DTMB design has this equipment. No hull dimensions,
performance characteristics, classified compartments, weapon capabilities, or
actual ship configuration are reproduced. The package does not include a mesh.

The five modeled mission areas are AW (Air Warfare), ASW (Anti-Submarine Warfare),
SUW (Surface Warfare), MOB (Mobility), and CCC (Command and Communications).
There are 15 top-level systems, one modeled component per system, and shared
part/asset identities where appropriate. Five mission areas are an exercise
scope restriction, not a claim that these are the only missions of a destroyer.

The source-like records follow the proposed contracts in the parent folder.
They resemble maintenance listings, supply extracts, personnel/qualification
tables, schedules, and local reports. They are **not authentic export schemas,
validated Navy code tables, or a complete representation of shipboard systems**.
Field names, minimum staffing counts, installed quantities, and event requirements
are illustrative. Reference code vocabulary does not make an operational value
real. All operational values are placeholders; schemas and rollups are proposed.

## Getting Started

Run from the repository root using uv:

```powershell
uv python install 3.13
uv run --python 3.13 "data_sources/Synthetic Data/generate.py"
uv run --python 3.13 "data_sources/Synthetic Data/generate.py" validate
```

The generator declares pinned dependencies in its inline script metadata; uv
creates an isolated script environment. No Flask app or system Python changes
are required. Generation overwrites the generated files in this folder. Keep
dashboard annotations and what-if changes outside these source files. Validation
does not regenerate data; it checks the existing package against its manifest.

The random seed is 20261104. PDF timestamps and IDs are deterministic as well.
Re-running with the same generator and dependency versions produces the same
generated file hashes. The manifest excludes itself, tooling, this README, and
the validation result. Generated datasets and test oracles have separate roles.

## Layout

| Location | Contents |
| --- | --- |
| KESSLER, VARNELL, ASHBY | Per-ship personnel, qualifications, billets, watchbills, jobs, requisitions, inventory, installed assets, PMS, schedule, certifications, training, and maintenance periods |
| Each ship's casrep_messages | Synthetic INITIAL, UPDATE, and CORRECT messages, linked to the structured casualty projection |
| Each ship's daily_reports | Six Eight O'Clock PDFs with text companions and one Plan of the Day PDF |
| Each ship's movrep and logreq | Invented planned-movement and delivery-window messages |
| squadron | Unit and part registries, mission tree, mission map, events, stock, locations, current material state, baseline reports, personnel orders, assumptions, catalog, and dictionary |
| validation | Expected anomalies, PDF extraction test expectations, and the generated validation report |
| manifest.json | Package inventory, row counts, byte sizes, and SHA-256 checksums |

Start dashboard ingestion with the squadron unit registry, mission tree, events,
system status, and visual system map. Then load the per-ship source records for
drill-downs. Use the data catalog to find sources and their extract timestamps.
The data dictionary documents every CSV column and the main JSON containers.

CSV line 1 is a comment banner; line 2 is the header. Use UTF-8, preserve IDs as
strings, parse booleans from true/false, treat empty cells as null, and split
semicolon lists only in documented list columns. JSON uses a top-level _banner.
YAML parameters include an evidence label. All dates/timestamps use UTC.

## Time and Playback

- Scenario start: 04 NOV 2026 at 0800Z, before Kessler's 1200Z casualty.
- Default data snapshot: 07 NOV 2026 at 1800Z, after the day-3 schedule change.
- Planned horizon: 04 NOV through 03 DEC 2026, inclusive (30 daily buckets).
- PMS history: six prior weeks; illustrative scheduled instances through week 4.
- known_at records when information became available; effective_at records when
  an order or event applies. as_of is the source extract timestamp, not the date
  on which every future planned activity happens.

These are latest-state exports with selected version histories, **not a complete
bitemporal database**. Casualty repair-estimate history, superseded schedule
blocks, personnel orders, and the scenario event ledger support the scripted
changes. An application must reconstruct earlier states from those histories;
filtering the current file by date alone does not recreate a historical snapshot.
Locations are synthetic planned port/area buckets, not tracked coordinates.

## Main Connected Story

1. Kessler's cooling pump fails at 1200Z on 04 NOV. The casualty, corrective job,
   part, and requisition join through the initial DTG, JCN, and document number.
2. On 05 NOV, supply moves from BB to BC, with shipping estimated for 15 NOV;
   the reported repair estimate moves to 22 NOV. Shipping is not onboard receipt.
3. A 05 NOV report says technical assistance **may** slip to 12 NOV. This is
   tentative evidence; it does not replace the structured 09 NOV confirmed date.
4. Orders learned on 06 NOV remove two of three radar-qualified members from
   10 NOV. One permanent transfer and one temporary-duty interval are distinct
   from the projected rotation date in the deliberately stale roster.
5. On 07 NOV, Mission A moves from 16 NOV to 13 NOV. Only one of the required two
   qualified personnel remains available for that event's entire interval.
6. Varnell holds one spare pump, but transferring it drops inventory below its
   allowance. Ashby has a qualified support candidate, M-0412, whose temporary
   support must end before Ashby's own event. Neither action is approved.
7. Kessler's training requirement expires on 20 NOV, before Mission B on 25 NOV.

Action candidates are **inputs to future what-if calculations**, not recommendations
or precomputed readiness improvements. Approval, transfer, assistance, installation,
and verification must still be evaluated. The minimum qualified headcount does
not establish a sustainable full three-section watch rotation; unfilled planned
watch assignments are explicit and should not be hidden.

## Joins and Interpretation

Use ship_id/uic for units; ship_id plus initial CASREP DTG for casualty/job links;
JCN and requisition document number for maintenance/supply; NIIN for parts;
EIC for systems/components; member_id plus watchstation_code for qualifications;
and event_id/cert_id/requirement_id for event prerequisites.

The two Varnell casualties share a physical asset and root part. Installed asset
identity prevents counting that switch twice. Shared NIIN alone is not evidence
that every associated order can be canceled. Review the requirement first.
Squadron stock is derived from ship inventory; it is not a second inventory source.

The material index is a transparent exercise calculation: system weights within
each mission sum to one; component job status uses the repository's historical
score map; a critical zero caps the mission index at 59. The independently
expected Kessler AW values are 100 before the casualty and 40 at the default
snapshot. These are **indices, not probabilities**. Invented reported Y/Q/N is
kept separate, and no current official surface-ship rating rule is asserted.
Unmodeled PESTO pillar values are blank rather than fabricated precision.

Personnel and qualification data cover all 900 invented members, but specialized
qualifications cover only the modeled systems. Background jobs are preservation
or service work that does not automatically degrade operability. PMS contains
representative instances, not every check a real ship would perform. An absent
corrective job for a lost check is a review signal, not proof of a reporting violation.

## Deliberate Data-Quality Cases

| ID | Expected Review Signal |
| --- | --- |
| X1 | Ashby casualty has no matching corrective job |
| X2 | Two Varnell casualties trace to one shared network-switch asset |
| X3 | Ashby BA order has a past shipping estimate |
| X4 | Tentative technical-assistance change exists only in report narrative |
| X5 | Pump transfer would leave Varnell below spare allowance |
| X6 | Extended maintenance completion conflicts with Varnell certification start |
| X7 | Lost Kessler CIWS PMS has no matching corrective job |
| X8 | Kessler shipboard NEC record disagrees with shore billet holder |
| X9 | One Kessler watch assignment uses an in-progress qualification |
| X10 | Kessler roster extract is older than the assumed freshness threshold |

Expected anomalies and extraction fixtures are **test oracles only**. Do not load
them as independently observed facts or use them to impersonate PDF extraction.
The validation report records which cases were actually detected in the data.

## Reconciliations and Limits

This package intentionally differs from inconsistent examples in the source notes:

- The baseline precedes the day-0 casualty; the current snapshot includes it.
- Ashby's return is normalized to 09 NOV at 0000Z across schedule and messages.
- Varnell's certification start is 09 NOV, valid after the original 08 NOV finish
  but invalid after the extension to 11 NOV. This isolates X6 to the extension.
- Exactly five mission areas are included; STW and other areas are outside scope.
- New personnel orders are a separate feed, rather than retroactively adding them
  to an extract marked 21 days old.
- Dates use synthetic EXERCISE PORT A / EXERCISE AREA A labels, with no real tracks.
- The requested folder replaces the parent spec's proposed data/synthetic path.

The generator validates joins, identifiers, schedule coverage, PDF evidence spans,
known scenario outcomes, markings, and checksums. It does not certify official Navy
schema fidelity, policy compliance, model accuracy, or public-release approval.
No actual Navy data, secrets, SSNs, medical details, or real personal names are
included. Synthetic banners are not a security classification decision. Obtain
appropriate review before a public showcase, especially after adding other data.