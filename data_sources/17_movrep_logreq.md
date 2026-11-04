# 17 MOVREP and LOGREQ messages

Tags: see `00_README.md` section 1.

## 1. The real source

- **MOVREP** (movement report): numbered lines in Zulu time; sent 48-24 hours before departure; updates triggered by a 4-hour ETA change or being 100 NM off track; cancellation sent if the ship does not sail on time **[DATED]** (SWOS 72-7).
- **LOGREQ** (logistics request): requests port and at-sea services through NAVSUP Fleet Logistics Centers **[S]** (NAVSUP FLC Pearl Harbor). No current field layout found **[UNV]**.
- **OPSUM**: daily operational summary following an OPGEN base format that commanders modify **[DATED]**. Not mocked.

## 2. Why MissionTwin pulls it

The fix ranker needs **where a donor ship will be and when a part can physically arrive**. MOVREPs give track and ETAs; LOGREQs show when a ship expects deliveries in port.

## 3. Mock files

### 3.1 `movrep/<ship_id>_<dtg>.txt` **[PROP]** (line content modeled on DATED description)

```
UNCLAS//SYNTHETIC EXERCISE//
FM USS ASHBY
TO COMDESRON NINE NINE
BT
UNCLAS //N03120//
MSGID/MOVREP/USS ASHBY/004/NOV//
1. DEPART VACAPES OPAREA 091200Z NOV 26.
2. TRACK: VIA CHESAPEAKE BAY ENTRANCE.
3. ARRIVE NORFOLK VA 091800Z NOV 26.
4. SOA 15 KTS.//
BT
```

### 3.2 `logreq/<ship_id>_<dtg>.txt` **[PROP]**

```
UNCLAS//SYNTHETIC EXERCISE//
FM USS KESSLER
TO NAVSUP FLC NORFOLK VA
BT
MSGID/LOGREQ/USS KESSLER/003/NOV//
1. ARRIVAL: IN PORT NORFOLK PIER 12 THROUGH 121200Z NOV 26.
2. PRIORITY MATERIAL: CASREP 017 NIIN 019990001 QTY 1. DELIVER TO PIER 12.
3. SERVICES: SHORE POWER, POTABLE WATER.//
BT
```

Parsed values feed `ship_positions.csv` (spec 06) with `source movrep`.

## 4. Generator rules

- One MOVREP per transit in `schedule_30day.csv`; one LOGREQ per in-port period with open CASREP parts.
- DTGs in Zulu; consistent with schedule blocks.

## 5. Demo scenario rows

- Ashby MOVREP: returns to Norfolk 9 Nov (day 5), which makes Ashby's qualified FC available for cross-deck after day 5 (fix 3).
- Kessler LOGREQ: in port through 12 Nov (the delivery window for the pump before Mission A).

## 6. Sources

SWOS 72-7 (MOVREP), 72-9 (OPSUM); NAVSUP FLC Pearl Harbor Logistics Service Center. Links in `reports/MissionTwin additional data sources.md`.
