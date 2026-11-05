"""Fetch the public-domain USDA NAIP aerial photo for the Norfolk waterfront layout. Network is used only here.

    python scripts/build_shore_imagery.py

Writes web/public/shore/norfolk_naip.jpg plus norfolk_naip.json (the photo's extent in scene units), which the
Shore Overview drapes under the 3D layout as ground imagery. NAIP (USDA Farm Service Agency) is public domain;
it is served here through the USGS National Map. The photo is ground texture only: facility positions in the
mock stay invented (see scripts/build_shore_osm_outline.py).
"""
from __future__ import annotations

import argparse
import json
import math
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTLINE = ROOT / 'data_sources' / 'shore_public' / 'norfolk_outline.json'
OUT_DIR = ROOT / 'web' / 'public' / 'shore'
SERVICE = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage'
# Same projection as build_shore_osm_outline.py: equirectangular metres about (LAT0, LON0), then scene units.
LAT0, LON0 = 36.95, -76.33
NORTH_ORIGIN, EAST_ORIGIN = -400.0, 100.0
METERS_PER_UNIT = 10.0
MARGIN = 0.08  # extra ground around the traced layout so its edges sit on imagery


def to_latlon(x: float, z: float) -> tuple[float, float]:
    """Scene (x, z) -> (lat, lon); inverse of scene() in build_shore_osm_outline.py."""
    north = -x * METERS_PER_UNIT + NORTH_ORIGIN
    east = -z * METERS_PER_UNIT + EAST_ORIGIN
    return north / 111320 + LAT0, east / (111320 * math.cos(math.radians(LAT0))) + LON0


def to_scene(lat: float, lon: float) -> tuple[float, float]:
    """(lat, lon) -> scene (x, z); same formula as scene() in build_shore_osm_outline.py."""
    north = (lat - LAT0) * 111320
    east = (lon - LON0) * 111320 * math.cos(math.radians(LAT0))
    return round(-(north - NORTH_ORIGIN) / METERS_PER_UNIT, 3), round(-(east - EAST_ORIGIN) / METERS_PER_UNIT, 3)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--size', type=int, default=2400, help='image width/height in pixels (default 2400; larger requests can time out)')
    args = parser.parse_args()

    outline = json.loads(OUTLINE.read_text(encoding='utf-8'))
    pts = list(outline['shoreline'])
    for p in outline['piers']:
        pts += p['points']
    for r in outline['runways']:
        pts += r['points']
    for a in outline['aprons']:
        pts += a
    xs, zs = [p[0] for p in pts], [p[1] for p in pts]
    pad_x, pad_z = (max(xs) - min(xs)) * MARGIN, (max(zs) - min(zs)) * MARGIN
    x0, x1, z0, z1 = min(xs) - pad_x, max(xs) + pad_x, min(zs) - pad_z, max(zs) + pad_z
    # Also cover the land slab the viewer draws (BaseScene buildOutline: shoreline x +-60, inland to z = -560).
    shore_x = [p[0] for p in outline['shoreline']]
    x0, x1, z0 = min(x0, min(shore_x) - 60), max(x1, max(shore_x) + 60), min(z0, -560)
    # x grows south, z grows west: north edge is min x, east edge is min z.
    north, east = to_latlon(x0, z0)
    south, west = to_latlon(x1, z1)

    # Image shaped like the box (pixels are degrees in EPSG:4326), longest side = --size.
    span_lon, span_lat = east - west, north - south
    width = args.size if span_lon >= span_lat else round(args.size * span_lon / span_lat)
    height = args.size if span_lat >= span_lon else round(args.size * span_lat / span_lon)
    query = urllib.parse.urlencode({
        'bbox': f'{west},{south},{east},{north}', 'bboxSR': 4326, 'imageSR': 4326,
        'size': f'{width},{height}', 'format': 'jpg', 'compressionQuality': 82, 'f': 'json',
    })
    headers = {'User-Agent': 'LOCKER-synthetic-exercise-data-builder'}
    with urllib.request.urlopen(urllib.request.Request(f'{SERVICE}?{query}', headers=headers), timeout=180) as response:
        info = json.loads(response.read())
    if 'href' not in info:
        raise SystemExit(f'Unexpected response: {info}')
    with urllib.request.urlopen(urllib.request.Request(info['href'], headers=headers), timeout=180) as response:
        data = response.read()
    # Use the extent the server actually returned, so the photo lines up exactly with the scene.
    ext = info['extent']
    west, south, east, north = ext['xmin'], ext['ymin'], ext['xmax'], ext['ymax']
    x0, z0 = to_scene(north, east)
    x1, z1 = to_scene(south, west)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / 'norfolk_naip.jpg').write_bytes(data)
    meta = {
        'image': 'norfolk_naip.jpg',
        'source': 'USDA Farm Service Agency NAIP orthoimagery via USGS The National Map',
        'service': SERVICE,
        'license': 'Public domain (U.S. Government work)',
        'attribution': 'Imagery: USDA NAIP via USGS',
        'retrieved': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'bbox_wgs84': {'west': west, 'south': south, 'east': east, 'north': north},
        # Image top edge = north = scene x0, left edge = west = scene z1.
        'scene': {'x_north': x0, 'x_south': x1, 'z_east': z0, 'z_west': z1},
        'pixels': [info.get('width', width), info.get('height', height)],
        'note': 'Ground texture only. Facilities, failures and staff in the mock remain invented.',
    }
    (OUT_DIR / 'norfolk_naip.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')
    print(f'wrote {len(data) / 1e6:.1f} MB image covering {west:.4f},{south:.4f} to {east:.4f},{north:.4f}')


if __name__ == '__main__':
    main()
