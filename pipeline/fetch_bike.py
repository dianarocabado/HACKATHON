"""A2: fetch senseBox:bike (ATRAI) layers for Heilbronn → bike layer input for A5.

Collections (all returned at once with limit=0, checked 27 Oct 2026):
  overtaking_distance_heilbronn  ~1,400 LineStrings. "Overtaking Distance Counts" is a 5-bin histogram
                                 with 50 cm bins: 0-50, 50-100, 100-150, 150-200, 200+ (verified against
                                 the reported average), so the first three bins are below the 150 cm limit.
  danger_zones_heilbronn         ~7,100 points, "Risk Index Overtaking" 0..1
  danger_zones_PM_heilbronn      ~183,000 points, "Risk Index" 0..1 → aggregated per H3 res-9 cell
  bumpy_roads_heilbronn          ~9,600 LineStrings (checked 28 Oct 2026), "Normalized Roughness" 0..100
                                 (= 10 x "Roughness" 0..10) from the boxes' surface sensors, matched to OSM
                                 streets; "Number of Boxes" that rode it. Names arrive double-encoded (UTF-8
                                 read as Windows-1252) and are repaired.

Outputs (data/processed/):
  bike_segments.json   [{id, name, coords, avgCm, under150Pct, n, boxes}]
  danger_zones.json    [{lat, lng, risk}]
  danger_pm_hex.json   {h3: {risk, n}}
  bumpy_roads.json     [{id, name, coords, roughness, boxes}]
Raw responses are cached in data/raw/ (git-ignored); `--from-cache` skips the download.
"""

import argparse
import ast
import json
import sys
from collections import defaultdict

import h3
import requests

from pipeline.common import ATRAI_BASE, HTTP_TIMEOUT_S, PROCESSED_DIR, RAW_DIR

COLLECTIONS = ("overtaking_distance_heilbronn", "danger_zones_heilbronn", "danger_zones_PM_heilbronn",
               "bumpy_roads_heilbronn")
# The PM collection is ~37 MB; allow a longer read than the 8 s connect timeout (offline batch job).
TIMEOUT = (HTTP_TIMEOUT_S, 120)
H3_RES = 9
BINS_UNDER_150 = 3  # histogram bins 0-50, 50-100, 100-150 cm


def fetch(collection):
    url = f"{ATRAI_BASE}/collections/{collection}/items"
    r = requests.get(url, params={"f": "json", "limit": 0}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()["features"]


def parse_listish(value):
    """ATRAI stores some OSM fields as stringified Python lists, e.g. "['A', 'B']"."""
    if isinstance(value, str) and value.startswith("["):
        try:
            return ast.literal_eval(value)
        except (ValueError, SyntaxError):
            return value
    return value


def fix_mojibake(text):
    """'StraÃŸe' -> 'Straße' (UTF-8 bytes read as Windows-1252); text that is already fine is unchanged."""
    for codec in ("cp1252", "latin-1"):
        try:
            return text.encode(codec).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    return text


def segment_name(raw):
    name = parse_listish(raw)
    if isinstance(name, list):
        return " / ".join(dict.fromkeys(n for n in name if n))
    return name or None


def build_segments(features):
    out = []
    for f in features:
        p = f.get("properties") or {}
        geom = f.get("geometry") or {}
        if geom.get("type") != "LineString":
            continue
        try:
            counts = [int(c) for c in str(p.get("Overtaking Distance Counts", "")).split(",")]
        except ValueError:
            continue
        n = sum(counts)
        if not n:
            continue
        out.append({
            "id": p.get("id"),
            "name": segment_name(p.get("name")),
            "coords": [[round(x, 6), round(y, 6)] for x, y in geom["coordinates"]],
            "avgCm": round(p["Average Overtaking Distance cm"], 1),
            "under150Pct": round(100 * sum(counts[:BINS_UNDER_150]) / n, 1),
            "n": n,
            "boxes": p.get("Number of Boxes"),
        })
    return out


def build_danger_zones(features):
    out = []
    for f in features:
        p = f.get("properties") or {}
        risk = p.get("Risk Index Overtaking")
        if risk is None or p.get("lat") is None:
            continue
        out.append({"lat": round(p["lat"], 6), "lng": round(p["lng"], 6), "risk": round(risk, 3)})
    return out


def build_pm_hex(features):
    sums = defaultdict(lambda: [0.0, 0])
    for f in features:
        p = f.get("properties") or {}
        risk = p.get("Risk Index")
        if risk is None or p.get("lat") is None:
            continue
        cell = h3.latlng_to_cell(p["lat"], p["lng"], H3_RES)
        sums[cell][0] += risk
        sums[cell][1] += 1
    return {cell: {"risk": round(total / n, 3), "n": n} for cell, (total, n) in sorted(sums.items())}


def build_bumpy_roads(features):
    out = []
    for f in features:
        p = f.get("properties") or {}
        geom = f.get("geometry") or {}
        if geom.get("type") != "LineString" or p.get("Normalized Roughness") is None:
            continue
        name = segment_name(p.get("name"))
        out.append({
            "id": p.get("id"),
            "name": fix_mojibake(name) if name else None,
            "coords": [[round(x, 6), round(y, 6)] for x, y in geom["coordinates"]],
            "roughness": round(p["Normalized Roughness"], 1),
            "boxes": p.get("Number of Boxes") or 1,
        })
    return out


def load(collection, from_cache):
    cache = RAW_DIR / f"{collection}.json"
    if from_cache:
        return json.loads(cache.read_text(encoding="utf-8"))
    features = fetch(collection)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(features), encoding="utf-8")
    print(f"  {collection}: {len(features):,} features", file=sys.stderr)
    return features


def write(name, data):
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    (PROCESSED_DIR / name).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")),
                                      encoding="utf-8")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--from-cache", action="store_true", help="use data/raw instead of downloading")
    args = ap.parse_args(argv)

    overtaking, danger, danger_pm, bumpy = (load(c, args.from_cache) for c in COLLECTIONS)
    segments = build_segments(overtaking)
    zones = build_danger_zones(danger)
    pm_hex = build_pm_hex(danger_pm)
    roads = build_bumpy_roads(bumpy)
    write("bike_segments.json", segments)
    write("danger_zones.json", zones)
    write("danger_pm_hex.json", pm_hex)
    write("bumpy_roads.json", roads)
    print(f"wrote {len(segments)} segments, {len(zones)} danger zones, {len(pm_hex)} PM-risk hexagons, "
          f"{len(roads)} bumpy-road segments")


if __name__ == "__main__":
    main()
