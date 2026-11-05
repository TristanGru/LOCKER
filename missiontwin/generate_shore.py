"""Synthetic shore installations (spec 21). Labeled mocks of Norfolk-area bases, real public regional hazard figures.

Installations use the same canonical file contract as ships, so one engine evaluates both. Only the base
names are real. Facility identities, work orders, failures, parts, staff and events are invented. Only hazard rates and tide windows come from
public data, read from data_sources/shore_public/public_hazard_snapshot.json. No public file describes an
installation's internals, and nothing here maps a base to real infrastructure.
"""
from __future__ import annotations

import csv
import json
import shutil
from datetime import timedelta

from . import BANNER
from .domain import COLUMNS, ROOT, parse_ts

SNAPSHOT = ROOT / 'data_sources' / 'shore_public' / 'public_hazard_snapshot.json'
OUTLINE = ROOT / 'data_sources' / 'shore_public' / 'norfolk_outline.json'
NSAHR_OUTLINE = ROOT / 'data_sources' / 'shore_public' / 'nsahr_outline.json'  # Lafayette River Annex, own local frame
AS_OF = '2026-11-04T06:00:00Z'
OUTAGE_AT = '2026-11-08T12:00:00Z'
OUTAGE_JCN = '99201SP120007'
OUTAGE_DOC = 'N9920163120001'
XFMR = '019998001'
SUPPORT_LEAD_DAYS = 2.0
TIDE_MARGIN_FEET = 1.4
TIDE_WINDOW_MULTIPLIER = 3.0

INSTALLATIONS = {
    'NSNORFOLK': {'name': 'NAVAL STATION NORFOLK (MOCK)', 'hull': 'NAV-201', 'uic': '99201', 'dodaac': 'N99201', 'kind': 'installation',
                 'role': 'Mock homeport for demonstration; every facility record is invented', 'depth': 'full', 'ofrp_phase': 'N/A'},
    'NSAHR': {'name': 'NSA HAMPTON ROADS (MOCK)', 'hull': 'NAV-202', 'uic': '99202', 'dodaac': 'N99202', 'kind': 'installation',
                 'role': 'Mock support activity for demonstration; every facility record is invented', 'depth': 'light', 'ofrp_phase': 'N/A'},
}
WATCHSTATIONS = {
    '5110': 'SHORE POWER HIGH-VOLTAGE ELECTRICIAN (SYNTH)',
    '5120': 'PORTAL CRANE OPERATOR (SYNTH)',
    '5130': 'FUEL PIER OPERATOR (SYNTH)',
    '5150': 'BASE ACCESS WATCH SUPERVISOR (SYNTH)',
}
PARTS = {
    XFMR: ('6120-01-999-8001', 'TRANSFORMER, PAD-MOUNT, PIER POWER'),
    '019998002': ('4320-01-999-8002', 'PUMP, POTABLE WATER BOOSTER'),
    '019998003': ('3810-01-999-8003', 'HOIST ASSEMBLY, PORTAL CRANE'),
    '019998004': ('4320-01-999-8004', 'PUMP, FUEL TRANSFER, PIER'),
    '019998005': ('5895-01-999-8005', 'CONTROLLER, ACCESS GATE'),
    '019998006': ('5945-01-999-8006', 'RELAY, PROTECTIVE, TRANSFORMER BANK'),
    '019998007': ('2530-01-999-8007', 'CONTROLLER, BRAKE, TRAILER'),
}
SHIP_BERTHS = {'KESSLER': 'SP12', 'VARNELL': 'SP10', 'ASHBY': 'SP11'}  # ship_positions.csv pier assignments


def _part(niin, installed, working):
    return {'niin': niin, 'name': PARTS[niin][1], 'installed_qty': installed, 'min_working': working}


def _comp(eic, name, critical, parts=()):
    return {'eic': eic, 'name': name, 'critical': critical, 'parts': list(parts)}


def _system(eic, name, critical, work_center, quals, components, weight):
    return {'eic': eic, 'name': name, 'critical': critical, 'work_center': work_center,
            'required_quals': [{'watchstation_code': w, 'k': k} for w, k in quals], 'components': components, 'weight': weight}


def _pier(number, weight):
    eic = f'SP{number}'
    return _system(eic, f'Pier {number} shore power', True, eic, [('5110', 2)], [
        _comp(f'{eic}-XFMR', f'Pier {number} transformer bank', True, [_part(XFMR, 2, 2)]),
        _comp(f'{eic}-VAULT', f'Pier {number} utility vault', True),
        _comp(f'{eic}-UTIL', f'Pier {number} utility feed (backup generation assumed)', False),
    ], weight)


def _area(code, name, units, systems):
    return {'mission_area': code, 'mission_area_name': name, 'units': units, 'tasks': [{
        'nta_id': f'CAP-{code}-01 (SYNTH)', 'name': name, 'functional_areas': [{'name': name, 'systems': systems}]}]}


def pier_mounts(outline: dict) -> dict:
    return {f"pier_{p['name'].split()[1]}": [p['center'][0], 2.2, p['center'][1]] for p in outline['piers']
            if p['name'] in ('Pier 10', 'Pier 11', 'Pier 12')}


def shore_profile() -> dict:
    outline = json.loads(OUTLINE.read_text(encoding='utf-8'))
    nsahr = json.loads(NSAHR_OUTLINE.read_text(encoding='utf-8'))
    return {
        '_banner': BANNER, 'schema_version': 1, 'installations': INSTALLATIONS, 'watchstations': WATCHSTATIONS,
        'missions': [
            _area('PIER', 'Pier Power', ['NSNORFOLK'], [_pier(10, .3), _pier(11, .3), _pier(12, .4)]),
            _area('HDLG', 'Cargo and Fuel Handling', ['NSNORFOLK'], [
                _system('CRANE', 'Portal crane', True, 'CR01', [('5120', 1)], [
                    _comp('CRANE-HOIST', 'Crane hoist', True, [_part('019998003', 1, 1)]),
                    _comp('CRANE-WX', 'Crane wind lockout', True)], .5),
                _system('FUEL', 'Pier fueling system', True, 'FU01', [('5130', 1)], [
                    _comp('FUEL-PUMP', 'Fuel transfer pumps', True, [_part('019998004', 2, 1)])], .5)]),
            _area('BASE', 'Base Access and Utilities', ['NSNORFOLK'], [
                _system('GATE', 'Base access', True, 'SE01', [('5150', 1)], [
                    _comp('GATE-CTRL', 'Gate controllers', True, [_part('019998005', 2, 1)]),
                    _comp('GATE-ROAD', 'Primary access road', False),
                    _comp('GATE-SEC', 'Alternate access route', False)], .5),
                _system('WATER', 'Potable water', False, 'UT01', [], [
                    _comp('WATER-PUMP', 'Booster pumps', False, [_part('019998002', 2, 1)])], .5)]),
            _area('MOBL', 'Mobile Support', ['NSAHR'], [
                _system('MSUB', 'Mobile substation', True, 'MS01', [('5110', 1)], [
                    _comp('MSUB-XF', 'Mobile transformer', True, [_part(XFMR, 1, 1)]),
                    _comp('MSUB-TRL', 'Trailer and running gear', False)], .7),
                _system('LGATE', 'Activity access', False, 'SE02', [('5150', 1)], [
                    _comp('LGATE-CTRL', 'Gate controllers', False, [_part('019998005', 1, 1)]),
                    _comp('LGATE-ROAD', 'Primary access road', False)], .3)]),
        ],
        # Scene coordinates: x along the waterfront, y up, z toward the water. y is the top of the feature a pin marks.
        # Pier pins sit on public OSM footprints. Every other position is invented and is not a site plan.
        # msub and lgate are in the NSA Hampton Roads annex's own frame (nsahr_outline.json), inside its OSM boundary.
        'mounts': {**pier_mounts(outline), 'crane': [-72, 9, -24], 'fuel': [-40, 4, -18], 'gate': [-88, 4, -64], 'water': [-112, 11, -44],
                   'msub': [7, 2, -8.5], 'lgate': [13, 2, 7.5]},
        'layouts': {'NSNORFOLK': outline, 'NSAHR': nsahr},
        'system_mounts': {'SP10': ['pier_10'], 'SP11': ['pier_11'], 'SP12': ['pier_12'], 'CRANE': ['crane'], 'FUEL': ['fuel'],
                          'GATE': ['gate'], 'WATER': ['water'], 'MSUB': ['msub'], 'LGATE': ['lgate']},
        'provenance': 'proposed (base names are real; all capabilities, records and failures are invented for demonstration)',
    }


def support_events(events: list) -> list:
    """One support event per ship event, plus the donor activity's own commitment."""
    labels = {'EVT-KESSLER-01': '01', 'EVT-KESSLER-02': '02', 'EVT-VARNELL-01': '03', 'EVT-ASHBY-01': '04'}
    out = []
    for ship_event in events:
        suffix = labels.get(ship_event['event_id'])
        if suffix is None:
            continue
        start = parse_ts(ship_event['start'])
        begin = start - timedelta(days=SUPPORT_LEAD_DAYS)
        pier = SHIP_BERTHS[ship_event['ship_id']]
        event_id = f'EVT-NSNORFOLK-{suffix}'
        out.append({'event_id': event_id, 'label': f"Support {ship_event['label']}", 'ship_id': 'NSNORFOLK',
                    'name': f"Pre-sail services for {ship_event['ship_id']}: {ship_event['name']}", 'ofrp_phase': 'N/A',
                    'start': begin.strftime('%Y-%m-%dT%H:%M:%SZ'), 'end': ship_event['start'],
                    'supports': ship_event['event_id'], 'lead_days': SUPPORT_LEAD_DAYS, 'mission_areas': ['PIER', 'HDLG', 'BASE'],
                    'required_systems': [{'eic': e, 'min_status_score': .6} for e in (pier, 'CRANE', 'FUEL', 'GATE', 'WATER')],
                    'required_watch_teams': [{'watchstation_code': '5110', 'k': 2}, {'watchstation_code': '5120', 'k': 1},
                                             {'watchstation_code': '5130', 'k': 1}],
                    'prerequisite_events': [], 'prerequisite_certs': ['CERT-NSNORFOLK-CRANE'], 'prerequisite_avail': '',
                    'consequence_if_missed': f"{ship_event['ship_id']} cannot complete pre-sail services for {ship_event['label']}",
                    'schedule_block_id': '', 'provenance': 'proposed'})
        ship_event['prerequisite_events'] = list(ship_event.get('prerequisite_events', [])) + [event_id]
    out.append({'event_id': 'EVT-NSAHR-01', 'label': 'Standby E', 'ship_id': 'NSAHR',
                'name': 'Mobile substation storm-readiness standby', 'ofrp_phase': 'N/A',
                'start': '2026-11-16T12:00:00Z', 'end': '2026-11-20T12:00:00Z', 'mission_areas': ['MOBL'],
                'required_systems': [{'eic': 'MSUB', 'min_status_score': .6}],
                'required_watch_teams': [{'watchstation_code': '5110', 'k': 1}], 'prerequisite_events': [], 'prerequisite_certs': [],
                'prerequisite_avail': '', 'consequence_if_missed': 'No mobile power reserve for the region during the standby window',
                'schedule_block_id': '', 'provenance': 'proposed'})
    return out


def hazard_rows(snapshot: dict) -> list:
    """Regional public rates become explicit, inspectable hazards. Rates describe the area, not a base."""
    storms, grid, tides = snapshot['storms']['categories'], snapshot['grid'], snapshot['tides']
    years = snapshot['storms']['years']
    rows = []

    def add(hazard_id, unit, eic, kind, title, derivation, source, score=0.0, rate=0.0, window='', p_trigger=1.0, median=.25, sigma=.5):
        rows.append({'hazard_id': hazard_id, 'ship_id': unit, 'eic': eic, 'hazard_kind': kind, 'rate_per_day': rate, 'window_start': window,
                     'p_trigger': p_trigger, 'median_down_days': median, 'sigma': sigma, 'score': score, 'title': title,
                     'derivation': derivation, 'public_source': source, 'as_of': AS_OF, 'provenance': 'sourced (regional rate); applied by assumption'})

    def storm(name):
        c = storms[name]
        return c['rate_per_day'], c['median_duration_days'], (f"{c['distinct_event_days']} {name.replace('_', ' ')} event-days in Norfolk-area "
                                                              f"Storm Events records {years[0]}-{years[1]}; effect on this facility is assumed")

    flood_rate, flood_days, flood_note = storm('coastal_flood')
    wind_rate, wind_days, wind_note = storm('high_wind')
    rain_rate, rain_days, rain_note = storm('rain_flood')
    grid_note = (f"{grid['utility_name']} EIA-861 five-year mean SAIFI {grid['mean_saifi_per_year']} and CAIDI {grid['mean_caidi_minutes']} min "
                 'with major events; utility-wide customer average, not a feeder or base measurement')
    for pier in (10, 11, 12):
        add('HZ-FLOOD', 'NSNORFOLK', f'SP{pier}-VAULT', 'RATE', 'Coastal flood risk: utility vault', flood_note, 'NOAA NCEI Storm Events', rate=flood_rate, median=flood_days)
        add('HZ-GRID', 'NSNORFOLK', f'SP{pier}-UTIL', 'RATE', 'Utility interruption risk: pier feed', grid_note, 'EIA Form 861 via PUDL', rate=grid['rate_per_day'], median=grid['median_duration_days'])
        for tide in tides['high_tides']:
            if tide['margin_to_minor_flood_feet'] > TIDE_MARGIN_FEET:
                continue
            start = parse_ts(tide['time']) - timedelta(hours=1.5)
            add(f"HZ-TIDE-{tide['time'][:13].replace('-', '')}", 'NSNORFOLK', f'SP{pier}-VAULT', 'WINDOW',
                f"Spring tide {tide['feet_mllw']:.2f} ft MLLW: {tide['margin_to_minor_flood_feet']:.2f} ft below minor flood",
                f"NOAA predicted high at Sewells Point; flood needs surge above the margin. Trigger is the regional coastal flood rate x {TIDE_WINDOW_MULTIPLIER:g} (assumed)",
                'NOAA CO-OPS tide predictions and flood levels', window=start.strftime('%Y-%m-%dT%H:%M:%SZ'),
                p_trigger=round(min(1.0, flood_rate * TIDE_WINDOW_MULTIPLIER), 6), median=flood_days)
    add('HZ-WIND', 'NSNORFOLK', 'CRANE-WX', 'RATE', 'High wind risk: crane lockout', wind_note, 'NOAA NCEI Storm Events', rate=wind_rate, median=wind_days)
    add('HZ-RAIN', 'NSNORFOLK', 'GATE-ROAD', 'RATE', 'Rain flood risk: primary access road', rain_note, 'NOAA NCEI Storm Events', rate=rain_rate, median=rain_days)
    add('HZ-RAIN', 'NSAHR', 'LGATE-ROAD', 'RATE', 'Rain flood risk: primary access road', rain_note, 'NOAA NCEI Storm Events', rate=rain_rate, median=rain_days)
    return rows


def _person(n, unit, name, rate, wc, status='ONBOARD', start='', end='', provenance='placeholder'):
    uic = INSTALLATIONS[unit]['uic']
    return {'member_id': f'M-{n:04d}', 'ship_id': unit, 'uic': uic, 'display_name': name, 'rate': rate, 'rating': rate.rstrip('123'),
            'paygrade': {'1': 'E6', '2': 'E5', '3': 'E4'}.get(rate[-1], 'E7'), 'department': 'PUBLIC WORKS', 'division': wc, 'work_center': wc,
            'duty_section': str(n % 4 + 1), 'onboard_status': status, 'status_start': start, 'status_end': end, 'report_date': '2025-06-01',
            'prd': '2028-06-01', 'eaos': '2030-06-01', 'necs': '', 'as_of': AS_OF, 'provenance': provenance}


STAFF = {
    'NSNORFOLK': [(2001, 'UT1 Marlowe', 'UT1', 'SP12', '5110'), (2002, 'CE1 Tolliver', 'CE1', 'SP12', '5110'), (2003, 'CE2 Vandermeer', 'CE2', 'SP12', '5110'),
                 (2004, 'EO1 Pruitt', 'EO1', 'CR01', '5120'), (2005, 'EO2 Hollins', 'EO2', 'CR01', '5120'),
                 (2006, 'BM1 Ferreira', 'BM1', 'FU01', '5130'), (2007, 'BM2 Calloway', 'BM2', 'FU01', '5130'),
                 (2008, 'MA1 Whitcombe', 'MA1', 'SE01', '5150'), (2009, 'MA2 Sandoval', 'MA2', 'SE01', '5150')],
    'NSAHR': [(2101, 'CE1 Oyelaran', 'CE1', 'MS01', '5110'), (2102, 'CE2 Bellamy', 'CE2', 'MS01', '5110'), (2103, 'MA1 Rourke', 'MA1', 'SE02', '5150')],
}


def _catalog(gen, unit, file, real, steward, refresh, access, as_of, stale):
    gen.cat(unit, file, real, steward, refresh, access, as_of, stale)
    gen.catalog[-1]['spec'] = 'data_sources/21_shore_installations.md'


def _append_csv(path, name, rows):
    with path.open('a', encoding='utf-8', newline='') as stream:
        csv.DictWriter(stream, fieldnames=COLUMNS[name], lineterminator='\n').writerows(rows)


def generate_shore(gen):
    """Called by Gen.run after the ship files exist; adds shore data without disturbing ship random draws."""
    snapshot = json.loads(SNAPSHOT.read_text(encoding='utf-8'))
    squadron = gen.out / 'squadron'
    gen.write_json(squadron / 'shore_profile.json', shore_profile())
    _catalog(gen, None, 'shore_profile.json', 'Installation capability model (proposed)', 'MissionTwin team', 'static', 'Ships inside the package', AS_OF, 3650)
    shutil.copyfile(SNAPSHOT, squadron / 'public_hazard_snapshot.json')
    _catalog(gen, None, 'public_hazard_snapshot.json', 'NOAA and EIA public regional data', 'MissionTwin team', 'on rebuild',
             'scripts/build_shore_public_data.py', AS_OF, 3650)
    events_path = squadron / 'events_missions.json'
    gen.events.extend(support_events(gen.events))
    gen.write_json(events_path, {'_banner': BANNER, 'events': gen.events})

    hazards = hazard_rows(snapshot)
    for unit, info in INSTALLATIONS.items():
        folder = gen.sdir(unit)
        people = STAFF[unit]
        gen.write_csv(folder, 'roster.csv', [_person(n, unit, name, rate, wc) for n, name, rate, wc, _ in people])
        gen.write_csv(folder, 'quals.csv', [{'member_id': f'M-{n:04d}', 'ship_id': unit, 'pqs_ref': f'SHORE-{ws}', 'watchstation_code': ws,
                                             'watchstation_name': WATCHSTATIONS[ws], 'qual_status': 'QUALIFIED', 'pct_complete': 100,
                                             'interim_date': '', 'final_date': '2026-01-15', 'requal_due': '2027-01-15', 'signed_by': 'M-2009',
                                             'as_of': AS_OF, 'provenance': 'placeholder'} for n, _, _, _, ws in people])
        gen.write_csv(folder, 'watchbill.csv', [{'date': '2026-11-04', 'ship_id': unit, 'watch_period': '0800-1600', 'condition': 'NORMAL',
                                                 'watchstation_code': ws, 'watchstation_name': WATCHSTATIONS[ws], 'section': '1',
                                                 'member_id': f'M-{n:04d}', 'as_of': AS_OF, 'provenance': 'placeholder'} for n, _, _, _, ws in people[:3]])
        gen.write_csv(folder, 'nec_billets.csv', [{'ship_id': unit, 'uic': info['uic'], 'billet_id': f'B-{unit[:2]}-{n}', 'billet_title': WATCHSTATIONS[ws],
                                                   'rate_required': rate, 'nec_required': 'S000', 'work_center': wc, 'fltmps_holder_member_id': f'M-{n:04d}',
                                                   'holder_prd': '2028-06-01', 'gap_start': '', 'inbound_member_id': '', 'inbound_report_date': '',
                                                   'as_of': AS_OF, 'provenance': 'placeholder'} for n, _, rate, wc, ws in people])
        gen.write_csv(folder, 'schedule_30day.csv', [{'ship_id': unit, 'block_id': f'SCH-{unit}-01', 'start_date': '2026-10-25', 'end_date': '2027-01-31',
                                                      'ofrp_phase': 'N/A', 'employment_code': 'INPORT', 'event_id': '', 'oparea_or_port': 'NORFOLK VA',
                                                      'status': 'PLANNED', 'source_msg_dtg': '', 'superseded_block_id': '', 'as_of': AS_OF, 'provenance': 'proposed'}])
        gen.write_csv(folder, 'availabilities.csv', [])
        gen.write_csv(folder, 'hazard_model.csv', [row for row in hazards if row['ship_id'] == unit])

    _harborpt_files(gen)
    _lafayette_files(gen)
    _shared_stock(gen)
    for unit in INSTALLATIONS:
        for file, real, stale in (('csmp.csv', 'Facility work orders (proposed canonical mapping)', 14), ('requisition_status.csv', 'Shore supply status (proposed)', 7),
                                  ('onboard_allowance_cosal.csv', 'Shore storeroom inventory (proposed)', 30), ('roster.csv', 'Shore staffing (proposed)', 30),
                                  ('quals.csv', 'Shore qualifications (proposed)', 30), ('watchbill.csv', 'Shore duty roster (proposed)', 30),
                                  ('nec_billets.csv', 'FLTMPS shore billets (proposed)', 30), ('readiness_baseline.csv', 'DRRS-S shore report (proposed)', 30),
                                  ('training_readiness.csv', 'Shore training records (proposed)', 30), ('schedule_30day.csv', 'Installation calendar (proposed)', 30),
                                  ('cert_status.csv', 'Facility certifications (proposed)', 30), ('availabilities.csv', 'Facility outage windows (proposed)', 30),
                                  ('sked_schedule.csv', 'Facility preventive maintenance (proposed)', 14), ('sked_loep.csv', 'Facility maintenance index (proposed)', 90),
                                  ('insurv_findings.csv', 'Facility condition inspections (proposed)', 3650), ('hazard_model.csv', 'Public regional hazard model', 3650)):
            _catalog(gen, unit, file, real, 'Installation public works (notional)', 'on change', 'No public feed; authorized export required', AS_OF, stale)


def _requisition(gen):
    return {'doc_number': OUTAGE_DOC, 'ship_id': 'NSNORFOLK', 'dodaac': 'N99201', 'jcn': OUTAGE_JCN, 'casrep_id': '', 'nsn': PARTS[XFMR][0], 'niin': XFMR,
            'nomenclature': PARTS[XFMR][1], 'qty': 1, 'unit_of_issue': 'EA', 'priority_designator': '02', 'issue_priority_group': '1', 'rdd': '999', 'nors': True,
            'date_requisitioned': '2026-11-08', 'status_code': 'BC', 'status_date': '2026-11-08', 'esd': '2026-12-15', 'delay_regime': 'LONG',
            'status_history': f'{OUTAGE_AT} BC 2026-12-15', 'source_of_supply': 'NAVSUP WSS', 'tcn': '', 'expedite_flag': False, 'system_of_record': 'NOSS (proposed)',
            'as_of': OUTAGE_AT, 'provenance': 'proposed'}


def _job(jcn, eic, noun, wc, jsn, discovered, status, state, docs, remarks, as_of, unit='NSNORFOLK', verifier='M-2001'):
    info = INSTALLATIONS[unit]
    return {'jcn': jcn, 'ship_id': unit, 'uic': info['uic'], 'work_center': wc, 'jsn': jsn, 'eic': eic, 'apl': '', 'equipment_noun': noun, 'location': info['name'],
            'date_discovered': discovered, 'when_discovered_code': 'A', 'status_code': status, 'job_state': state, 'deferral_reason_code': '', 'date_deferred': '', 'priority': '2',
            'type_avail': 4, 'est_man_hours': 40, 'casrep_dtg': '', 'casrep_id': '', 'req_doc_numbers': docs, 'remarks': remarks, 'lead_wc': wc, 'verifier': verifier,
            'co_deferral_signed': False, 'system_of_record': 'Facility work order system (proposed)', 'as_of': as_of, 'provenance': 'proposed'}


def _standing_requisition(unit, doc, jcn, niin, requested, history):
    """An open facility requisition that predates the feed. history: (time, status, esd), oldest first."""
    t, code, esd = history[-1]
    return {'doc_number': doc, 'ship_id': unit, 'dodaac': INSTALLATIONS[unit]['dodaac'], 'jcn': jcn, 'casrep_id': '', 'nsn': PARTS[niin][0], 'niin': niin,
            'nomenclature': PARTS[niin][1], 'qty': 1, 'unit_of_issue': 'EA', 'priority_designator': '03', 'issue_priority_group': '1', 'rdd': '999', 'nors': True,
            'date_requisitioned': requested, 'status_code': code, 'status_date': t[:10], 'esd': esd, 'delay_regime': {'BA': 'NEAR', 'BB': 'DUE_IN'}[code],
            'status_history': ';'.join(f'{a} {b} {c}' for a, b, c in history), 'source_of_supply': 'NAVSUP WSS', 'tcn': '', 'expedite_flag': False,
            'system_of_record': 'NOSS (proposed)', 'as_of': t, 'provenance': 'proposed'}


# Starting conditions: facility casualties already open before the feed starts (spec 21). Values are fixed, not drawn.
RELAY_JCN, RELAY_DOC = '99201SP110004', 'N9920163060002'
BRAKE_JCN, BRAKE_DOC = '99202MS010002', 'N9920263070001'


def _stock(unit, niin, allowance, on_hand, eligible):
    return {'ship_id': unit, 'uic': INSTALLATIONS[unit]['uic'], 'niin': niin, 'nsn': PARTS[niin][0], 'nomenclature': PARTS[niin][1], 'apl': '', 'item_type': 'STOREROOM',
            'allowance_qty': allowance, 'on_hand_qty': on_hand, 'due_in_qty': 0, 'sri_osi': 'OSI', 'cross_deck_eligible': eligible, 'last_inventory_date': '2026-09-30',
            'system_of_record': 'NOSS (proposed)', 'as_of': AS_OF, 'provenance': 'placeholder'}


def _sked(unit, wc, equipment, eic, mrc, week, status):
    info = INSTALLATIONS[unit]
    return {'ship_id': unit, 'uic': info['uic'], 'hull': info['hull'], 'tycom': 'CNIC (notional)', 'force_rev': '1-27', 'work_center': wc, 'mip': f'PM-{wc}', 'equipment_desc': equipment, 'eic': eic,
            'egl_location': 'WATERFRONT', 'mrc': mrc, 'periodicity': 'M', 'man_hours': 4, 'rate': 'CE2', 'min_skill_level': '2', 'sched_week_start': week, 'assigned_to': 'M-2003',
            'status': status, 'status_date': week, 'recorded_by_pin': 'M-2001', 'spot_check_score': '', 'iem_flag': False, 'situational_trigger': '', 'notes': '', 'as_of': AS_OF, 'provenance': 'placeholder'}


def _baseline(unit, area, index, limiting=''):
    band = 'GREEN' if index >= 80 else 'YELLOW' if index >= 60 else 'RED'
    return {'ship_id': unit, 'as_of': AS_OF, 'mission_area': area, 'nmet_id': f'CAP-{area}-01 (SYNTH)', 'rating': 'Y' if index >= 80 else 'Q', 'mfom_index': index, 'band': band,
            'p_score': 90, 'e_score': index, 's_score': 88, 't_score': 86, 'o_score': 92, 'limiting_factor': limiting, 'provenance': 'proposed (facilities are reported through E and limiting factor)'}


def _harborpt_files(gen):
    folder = gen.sdir('NSNORFOLK')
    gen.write_csv(folder, 'csmp.csv', [
        _job('99201UT010003', 'WATER-PUMP', 'Booster pump bearing noise', 'UT01', '0003', '2026-10-20', '1', 'DEFERRED', '', 'Deferred to next maintenance window', AS_OF),
        _job(RELAY_JCN, 'SP11-XFMR', 'Pier 11 transformer bank protective relay', 'SP11', '0004', '2026-11-02', '2', 'OPEN_AWAITING_PARTS', RELAY_DOC,
             'Relay failed its trip test; bank stays de-energized until a replacement relay is installed and tested', AS_OF),
        _job(OUTAGE_JCN, 'SP12-XFMR', 'Pier 12 transformer failure', 'SP12', '0007', '2026-11-08', '2', 'OPEN_AWAITING_PARTS', OUTAGE_DOC,
             'Bank cannot carry pier load; replacement transformer required', OUTAGE_AT)])
    gen.write_csv(folder, 'requisition_status.csv', [
        _standing_requisition('NSNORFOLK', RELAY_DOC, RELAY_JCN, '019998006', '2026-11-02',
                              [('2026-11-02T14:00:00Z', 'BA', '2026-11-06'), ('2026-11-03T16:00:00Z', 'BB', '2026-11-09')]),
        _requisition(gen)])
    gen.write_csv(folder, 'onboard_allowance_cosal.csv', [_stock('NSNORFOLK', '019998002', 1, 1, False), _stock('NSNORFOLK', '019998005', 1, 1, False), _stock('NSNORFOLK', XFMR, 1, 0, False)])
    gen.write_csv(folder, 'sked_schedule.csv', [_sked('NSNORFOLK', 'CR01', 'Portal crane hoist', 'CRANE-HOIST', 'CR-M1', '2026-10-19', 'LOST'),
                                                _sked('NSNORFOLK', 'SP12', 'Pier 12 transformer bank', 'SP12-XFMR', 'SP-M1', '2026-10-26', 'ACCOMPLISHED')])
    gen.write_csv(folder, 'sked_loep.csv', [{'ship_id': 'NSNORFOLK', 'uic': '99201', 'hull': 'NAV-201', 'tycom': 'CNIC (notional)', 'force_rev': '1-27', 'report_date': '2026-10-01',
                                             'work_center': wc, 'mip': f'PM-{wc}', 'equipment_desc': name, 'eic': eic, 'provenance': 'placeholder'}
                                            for wc, name, eic in (('CR01', 'Portal crane hoist', 'CRANE-HOIST'), ('SP12', 'Pier 12 transformer bank', 'SP12-XFMR'))])
    gen.write_csv(folder, 'readiness_baseline.csv', [_baseline('NSNORFOLK', 'PIER', 92), _baseline('NSNORFOLK', 'HDLG', 88, 'Crane hoist PM missed'), _baseline('NSNORFOLK', 'BASE', 90)])
    gen.write_csv(folder, 'training_readiness.csv', [
        {'ship_id': 'NSNORFOLK', 'mission_area': 'HDLG', 'requirement_id': 'TR-HP-CRANE', 'requirement_name': 'Crane rigging safety refresher', 'team': 'Crane crew', 'last_completed': '2025-11-21',
         'periodicity_days': 365, 'expires': '2026-11-21', 'scheduled_refresh': '2026-11-18', 'tfom_value': 84, 'as_of': AS_OF, 'provenance': 'placeholder'},
        {'ship_id': 'NSNORFOLK', 'mission_area': 'PIER', 'requirement_id': 'TR-HP-HV', 'requirement_name': 'High-voltage switching qualification', 'team': 'Shore power crew', 'last_completed': '2026-05-12',
         'periodicity_days': 365, 'expires': '2027-05-12', 'scheduled_refresh': '', 'tfom_value': 91, 'as_of': AS_OF, 'provenance': 'placeholder'}])
    gen.write_csv(folder, 'cert_status.csv', [{'ship_id': 'NSNORFOLK', 'cert_id': 'CERT-NSNORFOLK-CRANE', 'cert_name': 'Portal crane load certification', 'mission_area': 'HDLG', 'status': 'CERTIFIED',
                                               'certified_date': '2026-03-10', 'expires': '2027-03-10', 'planned_start': '', 'depends_on_avail_id': '', 'as_of': AS_OF, 'provenance': 'placeholder'}])
    gen.write_csv(folder, 'insurv_findings.csv', [{'ship_id': 'NSNORFOLK', 'inspection_date': '2026-02-11', 'inspection_type': 'Facility condition (proposed)', 'eic': 'SP12-VAULT', 'finding_severity': 'MINOR',
                                                   'finding_summary': 'Vault sump pump near end of service life (synthetic)', 'corrected': False, 'as_of': AS_OF, 'provenance': 'placeholder'}])


def _lafayette_files(gen):
    folder = gen.sdir('NSAHR')
    gen.write_csv(folder, 'csmp.csv', [
        _job(BRAKE_JCN, 'MSUB-TRL', 'Mobile substation trailer brake controller', 'MS01', '0002', '2026-11-03', '2', 'OPEN_AWAITING_PARTS', BRAKE_DOC,
             'Brake controller failed road inspection; the trailer cannot be towed to a site until the controller is replaced', AS_OF, unit='NSAHR', verifier='M-2101')])
    gen.write_csv(folder, 'requisition_status.csv', [
        _standing_requisition('NSAHR', BRAKE_DOC, BRAKE_JCN, '019998007', '2026-11-03', [('2026-11-03T15:00:00Z', 'BB', '2026-11-07')])])
    gen.write_csv(folder, 'onboard_allowance_cosal.csv', [_stock('NSAHR', XFMR, 1, 1, True), _stock('NSAHR', '019998005', 1, 1, False)])
    gen.write_csv(folder, 'sked_schedule.csv', [_sked('NSAHR', 'MS01', 'Mobile transformer', 'MSUB-XF', 'MS-M1', '2026-10-26', 'ACCOMPLISHED') | {'assigned_to': 'M-2102', 'recorded_by_pin': 'M-2101'}])
    gen.write_csv(folder, 'sked_loep.csv', [{'ship_id': 'NSAHR', 'uic': '99202', 'hull': 'NAV-202', 'tycom': 'CNIC (notional)', 'force_rev': '1-27', 'report_date': '2026-10-01',
                                             'work_center': 'MS01', 'mip': 'PM-MS01', 'equipment_desc': 'Mobile transformer', 'eic': 'MSUB-XF', 'provenance': 'placeholder'}])
    gen.write_csv(folder, 'readiness_baseline.csv', [_baseline('NSAHR', 'MOBL', 94)])
    gen.write_csv(folder, 'training_readiness.csv', [{'ship_id': 'NSAHR', 'mission_area': 'MOBL', 'requirement_id': 'TR-LB-HV', 'requirement_name': 'High-voltage switching qualification', 'team': 'Mobile power crew',
                                                      'last_completed': '2026-04-02', 'periodicity_days': 365, 'expires': '2027-04-02', 'scheduled_refresh': '', 'tfom_value': 90, 'as_of': AS_OF, 'provenance': 'placeholder'}])
    gen.write_csv(folder, 'cert_status.csv', [])
    gen.write_csv(folder, 'insurv_findings.csv', [])


def _shared_stock(gen):
    squadron = gen.out / 'squadron'
    _append_csv(squadron / 'wholesale_stock.csv', 'wholesale_stock.csv', [
        {'niin': XFMR, 'nsn': PARTS[XFMR][0], 'nomenclature': PARTS[XFMR][1], 'holder': 'NAVSUP_WSS', 'holder_name': 'NAVSUP WSS', 'location': 'MECHANICSBURG PA', 'on_hand_qty': 0, 'due_in_qty': 1,
         'due_in_date': '2026-12-10', 'release_lead_days': 1, 'transit_days_conus': 5, 'transit_days_oconus': 15, 'requires_engineering_validation': 'false', 'as_of': AS_OF, 'provenance': 'placeholder'},
        {'niin': XFMR, 'nsn': PARTS[XFMR][0], 'nomenclature': PARTS[XFMR][1], 'holder': 'PROGRAM_OFFICE', 'holder_name': 'Facilities engineering reserve (notional)', 'location': 'PORT HUENEME CA', 'on_hand_qty': 1, 'due_in_qty': 0,
         'due_in_date': '', 'release_lead_days': 3, 'transit_days_conus': 6, 'transit_days_oconus': 15, 'requires_engineering_validation': 'true', 'as_of': AS_OF, 'provenance': 'placeholder'},
        *({'niin': niin, 'nsn': PARTS[niin][0], 'nomenclature': PARTS[niin][1], 'holder': 'NAVSUP_WSS', 'holder_name': 'NAVSUP WSS', 'location': 'MECHANICSBURG PA', 'on_hand_qty': 1,
           'due_in_qty': 2, 'due_in_date': due, 'release_lead_days': 1, 'transit_days_conus': 5, 'transit_days_oconus': 15, 'requires_engineering_validation': 'false',
           'as_of': AS_OF, 'provenance': 'placeholder'} for niin, due in (('019998006', '2026-11-12'), ('019998007', '2026-11-10')))])
    _append_csv(squadron / 'fleet_onboard_stock.csv', 'fleet_onboard_stock.csv', [
        {'niin': XFMR, 'ship_id': 'NSAHR', 'uic': '99202', 'storeroom_on_hand': 1, 'storeroom_allowance': 1, 'installed_qty': 1, 'installed_system_eic': 'MSUB-XF', 'cross_deck_eligible': 'true',
         'cannibalize_eligible': 'true', 'donor_cost_note': 'Pulling the installed unit takes the regional mobile substation out of service', 'as_of': AS_OF, 'provenance': 'placeholder'}])
