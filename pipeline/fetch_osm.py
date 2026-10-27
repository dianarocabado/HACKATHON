"""A3: OpenStreetMap features for Heilbronn from a Geofabrik extract.

Overpass was unreachable from the hackathon network (27 Oct 2026), so we read the Geofabrik
Regierungsbezirk Stuttgart extract (~210 MB .osm.pbf, cached in data/raw/) with pyosmium.

Outputs (data/processed/):
  boundary.geojson     Heilbronn city boundary (admin_level 6, "Heilbronn")
  osm_points.json      {trees, bus_stops, schools, kindergartens, care_homes, playgrounds}: [[lat, lng, name?], ...]
  green_areas.geojson  parks, woods, meadows, allotments, cemeteries, ... (kind property)
  residential.geojson  landuse=residential (for pollinator_gap)
  built_up.geojson     built-up landuse: residential, commercial, industrial, retail, railway, ... (kind)
  buildings_h3.json    {h3 res-9 cell: building footprint share 0..1} (heat proxy for A5; footprints
                       themselves are too large to commit)
All features are clipped to the city boundary; polygons are simplified (~3 m) and rounded to 5 decimals.

Usage:
  python -m pipeline.fetch_osm            # downloads the extract if missing
  python -m pipeline.fetch_osm --pbf path/to/file.osm.pbf
"""

import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import h3
import osmium
import requests
import shapely
from shapely import wkb
from shapely.geometry import Point
from shapely.prepared import prep

from pipeline.common import HTTP_TIMEOUT_S, PROCESSED_DIR, RAW_DIR

PBF_URL = "https://download.geofabrik.de/europe/germany/baden-wuerttemberg/stuttgart-regbez-latest.osm.pbf"
PBF_FILE = RAW_DIR / "stuttgart-regbez-latest.osm.pbf"
# Generous box around the city; exact clipping uses the boundary polygon.
BBOX = (9.05, 49.05, 9.36, 49.25)  # min lng, min lat, max lng, max lat
SIMPLIFY_DEG = 0.00003  # ~3 m
PRECISION_DEG = 0.00001  # output grid, ~1 m
KEYS = ("natural", "highway", "amenity", "leisure", "landuse", "boundary", "social_facility", "building")
H3_RES = 9
BUILT_UP = {"residential", "commercial", "industrial", "retail", "railway", "construction", "garages"}

GREEN = {
    "leisure": {"park", "garden", "nature_reserve"},
    "landuse": {"grass", "meadow", "forest", "recreation_ground", "village_green", "allotments", "cemetery",
                "orchard", "vineyard"},
    "natural": {"wood", "scrub", "grassland", "heath"},
}


def point_category(tags):
    """Map OSM tags to one of the point categories, or None."""
    amenity = tags.get("amenity")
    if tags.get("natural") == "tree":
        return "trees"
    if tags.get("highway") == "bus_stop":
        return "bus_stops"
    if amenity == "school":
        return "schools"
    if amenity == "kindergarten":
        return "kindergartens"
    if amenity == "nursing_home" or tags.get("social_facility") in ("nursing_home", "assisted_living"):
        return "care_homes"
    if tags.get("leisure") == "playground":
        return "playgrounds"
    return None


def green_kind(tags):
    for key, values in GREEN.items():
        if tags.get(key) in values:
            return tags[key]
    return None


def is_city_boundary(tags):
    return (tags.get("boundary") == "administrative" and tags.get("admin_level") == "6"
            and tags.get("name") == "Heilbronn")


def in_bbox(lng, lat):
    return BBOX[0] <= lng <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]


def download(path):
    print(f"downloading {PBF_URL} ...", file=sys.stderr)
    path.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(PBF_URL, stream=True, timeout=(HTTP_TIMEOUT_S, 120),
                      headers={"User-Agent": "HeilbronnWirkt/0.1 (hackathon)"}) as r:
        r.raise_for_status()
        with open(path, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)


def area_m2(geom):
    """Approximate area of a lng/lat geometry in m²."""
    lat = geom.centroid.y
    return geom.area * 111_132 * 111_320 * math.cos(math.radians(lat))


def read_pbf(path):
    """One pass over the extract.
    Returns (boundary, raw points, green [(kind, geom)], built-up [(kind, geom)], building m² per H3 cell)."""
    factory = osmium.geom.WKBFactory()
    boundary = None
    points = {k: [] for k in ("trees", "bus_stops", "schools", "kindergartens", "care_homes", "playgrounds")}
    green, built = [], []
    building_m2 = defaultdict(float)

    processor = (osmium.FileProcessor(str(path))
                 .with_locations()
                 .with_areas()
                 .with_filter(osmium.filter.KeyFilter(*KEYS)))
    for obj in processor:
        tags = obj.tags
        if obj.is_node():
            lng, lat = obj.location.lon, obj.location.lat
            cat = point_category(tags)
            if cat and in_bbox(lng, lat):
                points[cat].append((lng, lat, tags.get("name")))
        elif obj.is_area():
            if is_city_boundary(tags):
                boundary = wkb.loads(factory.create_multipolygon(obj), hex=True)
                continue
            cat, kind = point_category(tags), green_kind(tags)
            built_kind = tags.get("landuse") if tags.get("landuse") in BUILT_UP else None
            is_building = "building" in tags and tags.get("building") != "no"
            if not (cat or kind or built_kind or is_building):
                continue
            try:
                geom = wkb.loads(factory.create_multipolygon(obj), hex=True)
            except RuntimeError:  # broken multipolygon in OSM
                continue
            c = geom.representative_point()
            if not in_bbox(c.x, c.y):
                continue
            if is_building:
                building_m2[h3.latlng_to_cell(c.y, c.x, H3_RES)] += area_m2(geom)
            if cat and cat != "trees":
                points[cat].append((c.x, c.y, tags.get("name")))
            if kind:
                green.append((kind, geom))
            if built_kind:
                built.append((built_kind, geom))
    return boundary, points, green, built, building_m2


def building_shares(building_m2):
    return {cell: round(min(1.0, m2 / h3.cell_area(cell, "m^2")), 3) for cell, m2 in sorted(building_m2.items())}


def clip_points(points, boundary):
    inside = prep(boundary)
    out = {}
    for cat, items in points.items():
        rows = []
        for lng, lat, name in items:
            if inside.contains(Point(lng, lat)):
                rows.append([round(lat, 6), round(lng, 6)] + ([name] if name and cat != "trees" else []))
        out[cat] = sorted(rows)
    return out


def polygons_only(geom):
    if geom.geom_type == "Polygon":
        return [geom]
    if geom.geom_type in ("MultiPolygon", "GeometryCollection"):
        return [p for g in geom.geoms for p in polygons_only(g)]
    return []


def rounded(geom):
    """GeoJSON MultiPolygon on a 1e-5° (~1 m) grid. set_precision keeps the result valid; plain
    rounding of coordinates can create self-intersections."""
    snapped = shapely.set_precision(geom, PRECISION_DEG)

    def r(coords):
        return [[round(x, 5), round(y, 5)] for x, y in coords]

    polys = [p for p in polygons_only(snapped) if not p.is_empty]
    return {"type": "MultiPolygon",
            "coordinates": [[r(p.exterior.coords)] + [r(i.coords) for i in p.interiors] for p in polys]}


def clip_polygons(items, boundary):
    """[(props, geom)] -> GeoJSON features clipped to the boundary and simplified."""
    inside = prep(boundary)
    features = []
    for props, geom in items:
        if not inside.intersects(geom):
            continue
        g = geom.intersection(boundary).simplify(SIMPLIFY_DEG, preserve_topology=True)
        geometry = rounded(g)
        if geometry["coordinates"]:
            features.append({"type": "Feature", "properties": props, "geometry": geometry})
    return {"type": "FeatureCollection", "features": features}


def write(name, data):
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    (PROCESSED_DIR / name).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--pbf", help="use this .osm.pbf instead of the cached Geofabrik extract")
    args = ap.parse_args(argv)

    path = Path(args.pbf) if args.pbf else PBF_FILE
    if not path.exists():
        download(path)
    boundary, points, green, built, building_m2 = read_pbf(path)
    if boundary is None:
        sys.exit("Heilbronn boundary (admin_level 6) not found in the extract")

    write("boundary.geojson", {"type": "FeatureCollection", "features": [{
        "type": "Feature", "properties": {"name": "Heilbronn"},
        "geometry": rounded(boundary.simplify(SIMPLIFY_DEG, preserve_topology=True))}]})
    clipped = clip_points(points, boundary)
    write("osm_points.json", clipped)
    greens = clip_polygons([({"kind": k}, g) for k, g in green], boundary)
    write("green_areas.geojson", greens)
    built_fc = clip_polygons([({"kind": k}, g) for k, g in built], boundary)
    write("built_up.geojson", built_fc)
    res = {"type": "FeatureCollection",
           "features": [{**f, "properties": {}} for f in built_fc["features"] if f["properties"]["kind"] == "residential"]}
    write("residential.geojson", res)
    shares = building_shares(building_m2)
    write("buildings_h3.json", shares)

    counts = ", ".join(f"{k} {len(v)}" for k, v in clipped.items())
    print(f"boundary {area_m2(boundary) / 1e6:.0f} km² | {counts} | green areas {len(greens['features'])} | "
          f"built-up {len(built_fc['features'])} (residential {len(res['features'])}) | "
          f"building cells {len(shares)}")


if __name__ == "__main__":
    main()
