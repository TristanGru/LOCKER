"""Build the checked-in public hazard snapshot used by the shore exercise. Network is used only here.

    python scripts/build_shore_public_data.py --downloads <empty-working-dir>

The app and the synthetic generator read data_sources/shore_public/public_hazard_snapshot.json and never
touch the network. Requires pyarrow for the EIA parquet file (a build-time dependency only):
    pip install --target <dir> pyarrow    then set PYTHONPATH=<dir>

Regional and utility-wide figures describe the surrounding area. They are not measurements of any installation.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import statistics
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'data_sources' / 'shore_public' / 'public_hazard_snapshot.json'
STATION = '8638610'
BEGIN, END = '20261104', '20261204'
START_YEAR, END_YEAR = 2016, 2025
UTILITY_ID, UTILITY_STATE = 19876, 'VA'
COOPS = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
MDAPI = f'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/{STATION}'
STORM = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/'
PUDL = 'https://s3.us-west-2.amazonaws.com/pudl.catalyst.coop/stable/core_eia861__yearly_reliability.parquet'
CATEGORIES = {
    'coastal_flood': {'Coastal Flood', 'Storm Surge/Tide'},
    'high_wind': {'High Wind', 'Strong Wind', 'Tropical Storm', 'Hurricane'},
    'rain_flood': {'Flash Flood', 'Flood'},
}


def fetch(url: str, path: Path) -> Path:
    if not path.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'LOCKER-synthetic-exercise-data-builder'})
        with urllib.request.urlopen(request, timeout=180) as response:
            path.write_bytes(response.read())
    return path


def tides(folder: Path) -> dict:
    query = (f'{COOPS}?product=predictions&application=LOCKER_exercise&begin_date={BEGIN}&end_date={END}'
             f'&datum=MLLW&station={STATION}&time_zone=gmt&interval=hilo&units=english&format=json')
    predictions = json.loads(fetch(query, folder / 'tide_hilo.json').read_text())['predictions']
    floods = json.loads(fetch(f'{MDAPI}/floodlevels.json', folder / 'floodlevels.json').read_text())
    datums = json.loads(fetch(f'{MDAPI}/datums.json?units=english', folder / 'datums.json').read_text())
    mllw = next(d['value'] for d in datums['datums'] if d['name'] == 'MLLW')
    minor = round(floods['nws_minor'] - mllw, 2)
    highs = [{'time': p['t'].replace(' ', 'T') + ':00Z', 'feet_mllw': round(float(p['v']), 3),
              'margin_to_minor_flood_feet': round(minor - float(p['v']), 3)} for p in predictions if p['type'] == 'H']
    return {'station': STATION, 'station_name': 'Sewells Point, VA', 'source_url': query,
            'flood_levels_url': f'{MDAPI}/floodlevels.json', 'datums_url': f'{MDAPI}/datums.json?units=english',
            'nws_minor_flood_feet_station_datum': floods['nws_minor'], 'mllw_feet_station_datum': mllw,
            'nws_minor_flood_feet_mllw': minor, 'high_tides': highs}


def _parse(value: str) -> datetime:
    return datetime.strptime(value, '%d-%b-%y %H:%M:%S')


def storms(folder: Path) -> dict:
    listing = fetch(STORM, folder / 'storm_index.html').read_text(encoding='utf-8', errors='replace')
    days = {k: set() for k in CATEGORIES}
    durations = {k: [] for k in CATEGORIES}
    files = []
    for year in range(START_YEAR, END_YEAR + 1):
        name = re.search(rf'StormEvents_details-ftp_v1\.0_d{year}_c\d+\.csv\.gz', listing).group(0)
        files.append(name)
        with gzip.open(fetch(STORM + name, folder / name), 'rt', encoding='latin-1', newline='') as stream:
            for row in csv.DictReader(stream):
                if row['STATE'] != 'VIRGINIA' or 'NORFOLK' not in row['CZ_NAME'].upper():
                    continue
                for category, types in CATEGORIES.items():
                    if row['EVENT_TYPE'] in types:
                        begin, end = _parse(row['BEGIN_DATE_TIME']), _parse(row['END_DATE_TIME'])
                        days[category].add(begin.date().isoformat())
                        durations[category].append((end - begin).total_seconds() / 86400)
    span = (datetime(END_YEAR + 1, 1, 1) - datetime(START_YEAR, 1, 1)).days
    return {'source_url': STORM, 'files': files, 'filter': "STATE=VIRGINIA and CZ_NAME contains NORFOLK", 'span_days': span,
            'years': [START_YEAR, END_YEAR], 'note': 'Distinct event-days avoid counting a county and a forecast zone twice.',
            'categories': {k: {'event_types': sorted(CATEGORIES[k]), 'distinct_event_days': len(days[k]),
                               'rate_per_day': round(len(days[k]) / span, 6),
                               'median_duration_days': round(max(statistics.median(durations[k]), 1 / 24), 4)} for k in CATEGORIES}}


def grid(folder: Path) -> dict:
    import pyarrow.parquet as parquet
    rows = parquet.read_table(fetch(PUDL, folder / 'eia861_reliability.parquet')).to_pylist()
    picked = [r for r in rows if r['utility_id_eia'] == UTILITY_ID and r['state'] == UTILITY_STATE
              and r['saifi_w_major_event_days_customers'] is not None and r['caidi_w_major_event_days_minutes'] is not None]
    picked.sort(key=lambda r: r['report_date'], reverse=True)
    recent = picked[:5]
    if len(recent) < 5:
        raise ValueError('Expected five years of reliability reporting')
    saifi = statistics.mean(r['saifi_w_major_event_days_customers'] for r in recent)
    caidi = statistics.mean(r['caidi_w_major_event_days_minutes'] for r in recent)
    return {'source_url': PUDL, 'origin': 'EIA Form 861 via PUDL table core_eia861__yearly_reliability',
            'utility_name': recent[0]['utility_name_eia'], 'utility_id_eia': UTILITY_ID, 'state': UTILITY_STATE,
            'scope': 'Utility-wide customer averages with major event days; not a feeder or installation measurement',
            'years': [{'year': r['report_date'].year, 'saifi_with_major_events': r['saifi_w_major_event_days_customers'],
                       'caidi_minutes_with_major_events': r['caidi_w_major_event_days_minutes'], 'standard': r['standard']} for r in recent],
            'mean_saifi_per_year': round(saifi, 4), 'mean_caidi_minutes': round(caidi, 2),
            'rate_per_day': round(saifi / 365.25, 6), 'median_duration_days': round(caidi / 1440, 4)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--downloads', required=True, type=Path)
    args = parser.parse_args()
    args.downloads.mkdir(parents=True, exist_ok=True)
    snapshot = {
        '_banner': 'PUBLIC REGIONAL DATA FOR A SYNTHETIC EXERCISE - DOES NOT DESCRIBE ANY REAL INSTALLATION',
        'retrieved': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'tides': tides(args.downloads), 'storms': storms(args.downloads), 'grid': grid(args.downloads),
        'unavailable': [
            {'dataset': 'FEMA National Risk Index', 'url': 'https://hazards.fema.gov/nri/data-resources', 'reason': 'Automated download returned HTTP 403; not used'},
            {'dataset': 'EAGLE-I county outages', 'url': 'https://doi.ccs.ornl.gov/ui/doi/435', 'reason': 'Offered through Globus transfer only; EIA-861 used for grid reliability instead'},
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, indent=2) + '\n', encoding='utf-8', newline='')
    print(f'wrote {OUT}')


if __name__ == '__main__':
    main()
