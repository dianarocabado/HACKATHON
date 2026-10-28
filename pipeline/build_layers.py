"""A5: H3 res-9 grid over Heilbronn with layer scores, need score and facts → layers.json.

Inputs (data/processed/, from A1–A3): boundary.geojson, green_areas.geojson, osm_points.json,
stations.json + stations/*.json, bike_segments.json, danger_zones.json, danger_pm_hex.json, bumpy_roads.json.

Scores are 0..1 where higher = more need for action; null = no data.
  heat   land-cover proxy: building footprint share (OSM), built-up landuse share, minus green share,
         nudged by the nearest valid outdoor station's summer-afternoon anomaly. Farmland and parks
         score ~0, the dense centre ~1. In cells covered by the Green City heat walk (A4), half of the
         score comes from the measured anomaly (±1 °C ≙ 0..1).
  air    PM danger index from senseBox:bike rides in the cell (danger_zones_PM), else null.
  bike   mean of overtaking risk (danger zones) and share of overtakings under 150 cm (segments with n >= 5).
  green  lack of green: 1 - green share / 40 %, blended with distance to the nearest usable green area,
         scaled by how built-up the cell is.
  risk   bumpy paths: road-surface roughness measured by senseBox:bike (bumpy_roads.json, 0..100), mean per
         cell weighted by how many boxes rode each segment; 5 -> 0, 30 -> 1. Rough surfaces mean fall and
         accident risk on bikes, wheelchairs and strollers. Null where fewer than 10 box-samples. (No open
         heavy-rain hazard data exists for Heilbronn; the slot was planned for that.)
  felt   null: planned from voice reports; not shown in the app yet.
need = weighted mean of the non-null scores (weights renormalised per cell).
"""

import json
import math
import statistics
from collections import defaultdict
from datetime import datetime, timezone

import h3
from shapely import STRtree
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import transform

from pipeline.common import PROCESSED_DIR

RES = 9
WEIGHTS = {"heat": 0.35, "air": 0.15, "bike": 0.15, "green": 0.25, "risk": 0.10, "felt": 0.0}
# Green areas people can actually use for shade/cooling (not scrub verges or vineyards).
USABLE_GREEN = {"park", "garden", "forest", "wood", "recreation_ground", "village_green", "nature_reserve",
                "cemetery", "allotments", "meadow", "grass"}
MIN_USABLE_GREEN_M2 = 5000  # 0.5 ha
GREEN_FULL_SHARE = 0.4      # cells with >= 40 % green get green score 0
DENSE_BUILDING_SHARE = 0.35 # building footprint share of the inner city (Marktplatz cell)
GREEN_FAR_M = 300           # >= 300 m to usable green counts as fully lacking (WHO-style access)
STATION_MAX_DIST_M = 1000
MIN_DAILY_RANGE_C = 5.0     # indoor sensors barely swing between day and night
MIN_SEGMENT_N = 5
ROUGH_LOW, ROUGH_HIGH = 5, 30  # normalized roughness -> risk 0..1 (cell median ~12, 90th percentile ~20)
MIN_ROUGH_SAMPLES = 10         # box-samples (every 20 m, x boxes) needed for a risk score

# Local metric projection (good to <0.5 % over the city).
LAT0, LNG0 = 49.14, 9.22
M_PER_DEG_LAT = 111_132
M_PER_DEG_LNG = 111_320 * math.cos(math.radians(LAT0))


def to_m(x, y, z=None):
    return (x - LNG0) * M_PER_DEG_LNG, (y - LAT0) * M_PER_DEG_LAT


def project(geom):
    return transform(to_m, geom)


def load(name):
    return json.loads((PROCESSED_DIR / name).read_text(encoding="utf-8"))


def clamp(x):
    return max(0.0, min(1.0, x))


def cell_polygon(cell):
    return Polygon([(lng, lat) for lat, lng in h3.cell_to_boundary(cell)])


def station_profiles(stations, history):
    """Valid outdoor stations with summer-afternoon mean temperature and median PM2.5."""
    out = []
    for s in stations:
        days, afternoon, pm = defaultdict(list), [], []
        for p in history.get(s["id"], []):
            t = p["t"]
            if "temperatureC" in p:
                days[t[:10]].append(p["temperatureC"])
                # Jun–Aug, 12–15 UTC = 14–17 local summer time
                if t[5:7] in ("06", "07", "08") and 12 <= int(t[11:13]) <= 15:
                    afternoon.append(p["temperatureC"])
            if "pm25" in p:
                pm.append(p["pm25"])
        ranges = [max(v) - min(v) for v in days.values() if len(v) >= 18]
        outdoor = bool(ranges) and statistics.median(ranges) >= MIN_DAILY_RANGE_C
        if not outdoor:
            continue
        out.append({
            "id": s["id"], "point": project(Point(s["lng"], s["lat"])),
            "tempAfternoonC": round(statistics.mean(afternoon), 1) if len(afternoon) >= 50 else None,
            "pm25": round(statistics.median(pm), 1) if len(pm) >= 50 else None,
        })
    return out


def segment_cells(segments):
    """cell -> list of (under150Pct, n) for well-measured segments, sampling each line every 40 m."""
    by_cell = defaultdict(list)
    for seg in segments:
        if seg["n"] < MIN_SEGMENT_N or len(seg["coords"]) < 2:
            continue
        line = LineString(seg["coords"])
        steps = max(1, int(project(line).length / 40))
        cells = {h3.latlng_to_cell(p.y, p.x, RES) for p in (line.interpolate(i / steps, normalized=True)
                                                             for i in range(steps + 1))}
        for c in cells:
            by_cell[c].append((seg["under150Pct"], seg["n"]))
    return by_cell


def roughness_cells(roads):
    """cell -> mean normalized roughness, sampling each segment every 20 m, weighted by boxes."""
    sums = defaultdict(lambda: [0.0, 0])
    for road in roads:
        if len(road["coords"]) < 2:
            continue
        line = LineString(road["coords"])
        steps = max(1, int(project(line).length / 20))
        for i in range(steps + 1):
            p = line.interpolate(i / steps, normalized=True)
            s = sums[h3.latlng_to_cell(p.y, p.x, RES)]
            s[0] += road["roughness"] * road["boxes"]
            s[1] += road["boxes"]
    return {cell: total / n for cell, (total, n) in sums.items() if n >= MIN_ROUGH_SAMPLES}


def build(data):
    boundary = shape(data["boundary"]["features"][0]["geometry"])
    cells = sorted(h3.geo_to_cells(boundary.__geo_interface__, RES))

    greens = [(f["properties"]["kind"], project(shape(f["geometry"]))) for f in data["green"]["features"]]
    green_tree = STRtree([g for _, g in greens])
    built_tree = STRtree([project(shape(f["geometry"])) for f in data["built_up"]["features"]])
    buildings = data["buildings"]
    usable = [g for k, g in greens if k in USABLE_GREEN and g.area >= MIN_USABLE_GREEN_M2]
    usable_tree = STRtree(usable)

    points = defaultdict(lambda: defaultdict(int))
    for cat, rows in data["points"].items():
        for row in rows:
            points[h3.latlng_to_cell(row[0], row[1], RES)][cat] += 1

    stations = station_profiles(data["stations"], data["history"])
    temps = [s["tempAfternoonC"] for s in stations if s["tempAfternoonC"] is not None]
    city_temp = statistics.median(temps) if temps else None

    zones = defaultdict(list)
    for z in data["danger_zones"]:
        zones[h3.latlng_to_cell(z["lat"], z["lng"], RES)].append(z["risk"])
    seg_cells = segment_cells(data["segments"])
    pm_hex = data["danger_pm_hex"]
    rough = roughness_cells(data.get("bumpy_roads", []))

    out = []
    for cell in cells:
        poly = project(cell_polygon(cell))
        centre = poly.centroid
        green_area = sum(poly.intersection(green_tree.geometries[i]).area
                         for i in green_tree.query(poly, predicate="intersects"))
        green_share = clamp(green_area / poly.area)
        built_share = clamp(sum(poly.intersection(built_tree.geometries[i]).area
                                for i in built_tree.query(poly, predicate="intersects")) / poly.area)
        building_share = buildings.get(cell, 0.0)
        nearest = usable_tree.nearest(centre)
        dist_green = round(centre.distance(usable[nearest])) if nearest is not None else None

        facts, scores = {}, {}
        station = min(stations, key=lambda s: s["point"].distance(centre)) if stations else None
        station_dist = station["point"].distance(centre) if station else math.inf
        if station and station_dist <= STATION_MAX_DIST_M:
            facts["nearestStationId"] = station["id"]
            facts["nearestStationDistM"] = round(station_dist)
            if station["tempAfternoonC"] is not None:
                facts["tempAfternoonC"] = station["tempAfternoonC"]
            if station["pm25"] is not None:
                facts["pm25"] = station["pm25"]

        heat = (0.6 * clamp(building_share / DENSE_BUILDING_SHARE) + 0.4 * built_share
                - 0.4 * green_share)
        if "tempAfternoonC" in facts and city_temp is not None:
            heat += 0.1 * (facts["tempAfternoonC"] - city_temp)  # +/- 0.1 per °C vs. city median
        walk = data["heat_walk"].get(cell)
        if walk:
            facts["heatWalkAnomalyC"] = walk["anomalyC"]
            heat = 0.5 * clamp(heat) + 0.5 * clamp(0.5 + walk["anomalyC"] / 2)
        scores["heat"] = round(clamp(heat), 3)

        pm = pm_hex.get(cell)
        scores["air"] = round(pm["risk"], 3) if pm and pm["n"] >= 3 else None

        parts = []
        if zones.get(cell):
            parts.append(statistics.mean(zones[cell]))
        if seg_cells.get(cell):
            n = sum(k for _, k in seg_cells[cell])
            under = sum(p * k for p, k in seg_cells[cell]) / n
            facts["overtakeUnder150Pct"] = round(under, 1)
            parts.append(under / 100)
        scores["bike"] = round(statistics.mean(parts), 3) if parts else None

        lack = 1 - green_share / GREEN_FULL_SHARE
        far = dist_green / GREEN_FAR_M if dist_green is not None else 1
        # Missing parks only matter where people live and work; open farmland is not "lacking green".
        urban = clamp(max(built_share, building_share / DENSE_BUILDING_SHARE))
        scores["green"] = round(clamp(0.6 * clamp(lack) + 0.4 * clamp(far)) * urban, 3)
        if cell in rough:
            facts["surfaceRoughness"] = round(rough[cell])
            scores["risk"] = round(clamp((rough[cell] - ROUGH_LOW) / (ROUGH_HIGH - ROUGH_LOW)), 3)
        else:
            scores["risk"] = None
        scores["felt"] = None

        if dist_green is not None:
            facts["distToGreenM"] = dist_green
        p = points.get(cell, {})
        sensitive = sum(p.get(k, 0) for k in ("schools", "kindergartens", "care_homes", "playgrounds"))
        if sensitive:
            facts["sensitivePlaces"] = sensitive
        if p.get("trees"):
            facts["trees"] = p["trees"]
        if p.get("bus_stops"):
            facts["busStops"] = p["bus_stops"]

        used = {k: v for k, v in scores.items() if v is not None and WEIGHTS[k] > 0}
        total_w = sum(WEIGHTS[k] for k in used)
        need = sum(WEIGHTS[k] * v for k, v in used.items()) / total_w if total_w else 0
        out.append({"h3": cell, "scores": scores, "need": round(need, 3), "facts": facts})

    return {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "resolution": RES,
        "weights": WEIGHTS,
        "cells": out,
    }


def load_inputs():
    stations = load("stations.json")
    return {
        "boundary": load("boundary.geojson"),
        "green": load("green_areas.geojson"),
        "built_up": load("built_up.geojson"),
        "buildings": load("buildings_h3.json"),
        "points": load("osm_points.json"),
        "stations": stations,
        "history": {s["id"]: load(f"stations/{s['id']}.json") for s in stations},
        "segments": load("bike_segments.json"),
        "danger_zones": load("danger_zones.json"),
        "danger_pm_hex": load("danger_pm_hex.json"),
        "bumpy_roads": load("bumpy_roads.json"),
        "heat_walk": load("heat_walk_h3.json") if (PROCESSED_DIR / "heat_walk_h3.json").exists() else {},
    }


def main():
    inputs = load_inputs()
    layers = build(inputs)
    (PROCESSED_DIR / "layers.json").write_text(json.dumps(layers, separators=(",", ":")), encoding="utf-8")
    # Shared with the API (impact baseline) so both use the same indoor-sensor rule.
    outdoor = sorted(p["id"] for p in station_profiles(inputs["stations"], inputs["history"]))
    (PROCESSED_DIR / "outdoor_stations.json").write_text(json.dumps(outdoor, indent=1), encoding="utf-8")
    cells = layers["cells"]
    coverage = {k: sum(c["scores"][k] is not None for c in cells) for k in WEIGHTS}
    print(f"wrote {len(cells)} cells; non-null scores: {coverage}")


if __name__ == "__main__":
    main()
