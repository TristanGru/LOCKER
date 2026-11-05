"""Build the checked-in Norfolk waterfront outline from public OpenStreetMap data. Network is used only here.

    python scripts/build_shore_osm_outline.py --work <empty-working-dir>

Queries named piers, runways and aprons only. It deliberately does not request buildings, power, fuel or
utility features: facility positions in the mock stay invented. OSM data is (c) OpenStreetMap contributors, ODbL.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'data_sources' / 'shore_public' / 'norfolk_outline.json'
MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
QUERY = ('[out:json][timeout:60];(way["man_made"="pier"](36.925,-76.345,36.975,-76.295);'
         'way["aeroway"~"runway|apron"](36.925,-76.345,36.975,-76.295););out tags geom;')
LAT0, LON0 = 36.95, -76.33
NORTH_ORIGIN, EAST_ORIGIN = -400.0, 100.0
METERS_PER_UNIT = 10.0
RUNWAY_WIDTH_UNITS = 4.5
PIER_NAME = re.compile(r'^Pier \d+$')
# OSM has no coastline way along this waterfront, so the shore is approximated through pier roots plus these
# rough (east, north) metre anchors beyond the pier row.
SOUTH_ANCHOR, NORTH_ANCHORS = (60.0, -2700.0), [(700.0, 1500.0), (1600.0, 1950.0), (2943.0, 2200.0)]


def fetch(work: Path) -> dict:
    path = work / 'overpass.json'
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


def metres(point: dict) -> tuple[float, float]:
    return (point['lon'] - LON0) * 111320 * math.cos(math.radians(LAT0)), (point['lat'] - LAT0) * 111320


def scene(east: float, north: float) -> list[float]:
    """x runs south along the waterfront and z west toward the water, keeping the scene right-handed."""
    return [round(-(north - NORTH_ORIGIN) / METERS_PER_UNIT, 2), round(-(east - EAST_ORIGIN) / METERS_PER_UNIT, 2)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', required=True, type=Path)
    args = parser.parse_args()
    args.work.mkdir(parents=True, exist_ok=True)
    document = fetch(args.work)
    piers, roots, runways, aprons = [], [], [], []
    for element in document['elements']:
        tags = element.get('tags', {})
        points = [metres(p) for p in element.get('geometry', [])]
        if not points:
            continue
        if tags.get('man_made') == 'pier' and PIER_NAME.match(tags.get('name', '')):
            ring = points[:-1] if points[0] == points[-1] else points
            root = max(ring, key=lambda p: p[0])
            roots.append(root)
            outline = [scene(*p) for p in ring]
            longest = max(((outline[i], outline[(i + 1) % len(outline)]) for i in range(len(outline))), key=lambda e: math.dist(*e))
            center = [round(sum(p[i] for p in outline) / len(outline), 2) for i in (0, 1)]
            piers.append({'name': tags['name'], 'points': outline, 'center': center,
                          'axis': round(math.atan2(longest[1][1] - longest[0][1], longest[1][0] - longest[0][0]), 4)})
        elif tags.get('aeroway') == 'runway':
            runways.append({'ref': tags.get('ref', ''), 'points': [scene(*p) for p in points], 'width': RUNWAY_WIDTH_UNITS})
        elif tags.get('aeroway') == 'apron':
            aprons.append([scene(*p) for p in points])
    piers.sort(key=lambda p: int(p['name'].split()[1]))
    roots.sort(key=lambda p: p[1])
    shoreline = [scene(*p) for p in [SOUTH_ANCHOR, *roots, *NORTH_ANCHORS]]
    if len(piers) < 10 or not any(p['name'] == 'Pier 12' for p in piers):
        raise SystemExit('Expected the named pier row in the OSM response')
    outline = {
        'attribution': '(c) OpenStreetMap contributors, ODbL', 'license_url': 'https://www.openstreetmap.org/copyright',
        'retrieved': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'query': QUERY, 'meters_per_unit': METERS_PER_UNIT,
        'note': 'Pier and runway footprints are from OSM. The shoreline is approximated through pier roots. Everything else in the mock is invented.',
        'piers': piers, 'shoreline': shoreline, 'runways': runways, 'aprons': aprons,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(outline, indent=1) + '\n', encoding='utf-8', newline='')
    print(f'wrote {OUT}: {len(piers)} piers, {len(runways)} runways, {len(aprons)} aprons')


if __name__ == '__main__':
    main()
