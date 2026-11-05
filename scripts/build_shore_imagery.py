"""Fetch the public-domain USDA NAIP aerial photo under a shore layout. Network is used only here.

    python scripts/build_shore_imagery.py                 # Naval Station Norfolk waterfront
    python scripts/build_shore_imagery.py --site nsahr    # NSA Hampton Roads, Lafayette River Annex

Writes web/public/shore/<site>_naip.jpg plus <site>_naip.json (the photo's extent in scene units), which the
Shore Overview drapes under the 3D layout as ground imagery. NAIP (USDA Farm Service Agency) is public domain;
it is served here through the USGS National Map. The photo is ground texture only: facility positions in the
mock stay invented (see scripts/build_shore_osm_outline.py and scripts/build_shore_nsahr_outline.py).
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
SHORE = ROOT / 'data_sources' / 'shore_public'
OUT_DIR = ROOT / 'web' / 'public' / 'shore'
SERVICE = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage'
# Norfolk's projection, same as build_shore_osm_outline.py: equirectangular metres about (LAT0, LON0), then scene
# units. Outlines that carry their own 'projection' block (the NSA Hampton Roads annex) use that instead.
NORFOLK_PROJECTION = {'lat0': 36.95, 'lon0': -76.33, 'north_origin': -400.0, 'east_origin': 100.0}
METERS_PER_UNIT = 10.0
SITES = {
    'norfolk': {'outline': 'norfolk_outline.json', 'margin': 0.08, 'pad_units': 0.0, 'size': 2400},
    # A small compound: a fixed 300 m of surroundings on every side keeps the river and Hampton Blvd in frame.
    'nsahr': {'outline': 'nsahr_outline.json', 'margin': 0.0, 'pad_units': 30.0, 'size': 2000},
}


class Projection:
    def __init__(self, p: dict):
        self.lat0, self.lon0, self.n0, self.e0 = p['lat0'], p['lon0'], p['north_origin'], p['east_origin']

    def to_latlon(self, x: float, z: float) -> tuple[float, float]:
        """Scene (x, z) -> (lat, lon); x grows south, z grows west."""
        north = -x * METERS_PER_UNIT + self.n0
        east = -z * METERS_PER_UNIT + self.e0
        return north / 111320 + self.lat0, east / (111320 * math.cos(math.radians(self.lat0))) + self.lon0

    def to_scene(self, lat: float, lon: float) -> tuple[float, float]:
        north = (lat - self.lat0) * 111320
        east = (lon - self.lon0) * 111320 * math.cos(math.radians(self.lat0))
        return round(-(north - self.n0) / METERS_PER_UNIT, 3), round(-(east - self.e0) / METERS_PER_UNIT, 3)


def footprint(outline: dict) -> list:
    pts = list(outline['shoreline']) + list(outline.get('boundary', []))
    for p in outline['piers']:
        pts += p['points']
    for r in outline['runways']:
        pts += r['points']
    for a in outline['aprons']:
        pts += a
    return pts


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--site', choices=sorted(SITES), default='norfolk')
    parser.add_argument('--size', type=int, help='image width/height in pixels (larger requests can time out)')
    args = parser.parse_args()
    site = SITES[args.site]
    size = args.size or site['size']

    outline = json.loads((SHORE / site['outline']).read_text(encoding='utf-8'))
    proj = Projection(outline.get('projection', NORFOLK_PROJECTION))
    pts = footprint(outline)
    xs, zs = [p[0] for p in pts], [p[1] for p in pts]
    pad_x = (max(xs) - min(xs)) * site['margin'] + site['pad_units']
    pad_z = (max(zs) - min(zs)) * site['margin'] + site['pad_units']
    x0, x1, z0, z1 = min(xs) - pad_x, max(xs) + pad_x, min(zs) - pad_z, max(zs) + pad_z
    if outline['shoreline']:
        # Also cover the land slab the viewer draws (BaseScene buildOutline: shoreline x +-60, inland to z = -560).
        shore_x = [p[0] for p in outline['shoreline']]
        x0, x1, z0 = min(x0, min(shore_x) - 60), max(x1, max(shore_x) + 60), min(z0, -560)
    # x grows south, z grows west: north edge is min x, east edge is min z.
    north, east = proj.to_latlon(x0, z0)
    south, west = proj.to_latlon(x1, z1)

    # Image shaped like the box (pixels are degrees in EPSG:4326), longest side = size.
    span_lon, span_lat = east - west, north - south
    width = size if span_lon >= span_lat else round(size * span_lon / span_lat)
    height = size if span_lat >= span_lon else round(size * span_lat / span_lon)
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
    x0, z0 = proj.to_scene(north, east)
    x1, z1 = proj.to_scene(south, west)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    image = f'{args.site}_naip.jpg'
    (OUT_DIR / image).write_bytes(data)
    meta = {
        'image': image,
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
    (OUT_DIR / f'{args.site}_naip.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')
    print(f'wrote {len(data) / 1e6:.1f} MB image covering {west:.4f},{south:.4f} to {east:.4f},{north:.4f}')


if __name__ == '__main__':
    main()
