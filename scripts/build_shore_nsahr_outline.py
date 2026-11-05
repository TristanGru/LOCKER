"""Build the checked-in NSA Hampton Roads (Lafayette River Annex) outline from public OpenStreetMap data.

    python scripts/build_shore_nsahr_outline.py --work <empty-working-dir>

Fetches only the annex's boundary polygon (the named military landuse way). It deliberately does not request
buildings, power, fuel or utility features: facility positions in the mock stay invented. The scene frame is
local to the annex (origin at its centre), with the same axes as the Norfolk outline: x grows south, z grows west,
10 m per unit. OSM data is (c) OpenStreetMap contributors, ODbL.
"""
from __future__ import annotations

import argparse
import json
import math
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'data_sources' / 'shore_public' / 'nsahr_outline.json'
MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
QUERY = '[out:json][timeout:60];way["landuse"="military"]["name"="Lafayette River Annex"](36.89,-76.32,36.91,-76.29);out tags geom;'
METERS_PER_UNIT = 10.0


def fetch(work: Path) -> dict:
    path = work / 'overpass_nsahr.json'
    if not path.exists():
        body = urllib.parse.urlencode({'data': QUERY}).encode()
        error = None
        for url in MIRRORS:
            try:
                request = urllib.request.Request(url, data=body, headers={'User-Agent': 'LOCKER-synthetic-exercise-data-builder'})
                with urllib.request.urlopen(request, timeout=120) as response:
                    path.write_bytes(response.read())
                    break
            except OSError as failure:
                error = failure
        else:
            raise SystemExit(f'All Overpass mirrors failed: {error}')
    return json.loads(path.read_text(encoding='utf-8'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', required=True, type=Path)
    args = parser.parse_args()
    args.work.mkdir(parents=True, exist_ok=True)
    ways = [e for e in fetch(args.work)['elements'] if e.get('geometry')]
    if len(ways) != 1:
        raise SystemExit(f'Expected one Lafayette River Annex way, got {len(ways)}')
    ring = ways[0]['geometry']
    ring = ring[:-1] if ring[0] == ring[-1] else ring
    lat0 = round((min(p['lat'] for p in ring) + max(p['lat'] for p in ring)) / 2, 5)
    lon0 = round((min(p['lon'] for p in ring) + max(p['lon'] for p in ring)) / 2, 5)

    def scene(p: dict) -> list[float]:
        north = (p['lat'] - lat0) * 111320
        east = (p['lon'] - lon0) * 111320 * math.cos(math.radians(lat0))
        return [round(-north / METERS_PER_UNIT, 2), round(-east / METERS_PER_UNIT, 2)]

    outline = {
        'attribution': '(c) OpenStreetMap contributors, ODbL', 'license_url': 'https://www.openstreetmap.org/copyright',
        'retrieved': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'query': QUERY, 'meters_per_unit': METERS_PER_UNIT,
        'note': 'The site boundary is from OSM. Everything inside it in the mock is invented.',
        'projection': {'lat0': lat0, 'lon0': lon0, 'north_origin': 0.0, 'east_origin': 0.0},
        'piers': [], 'shoreline': [], 'runways': [], 'aprons': [],
        'boundary': [scene(p) for p in ring],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(outline, indent=1) + '\n', encoding='utf-8', newline='')
    print(f'wrote {OUT}: boundary of {len(ring)} points about {lat0}, {lon0}')


if __name__ == '__main__':
    main()
