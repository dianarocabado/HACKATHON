"""A1: fetch senseBox:home Heilbronn readings and aggregate them hourly per station.

The ATRAI API ignores `datetime`, `boxId` and `properties` filters (checked 27 Oct 2026),
so we page through the whole collection (~2.0M rows) and aggregate on the fly.

Outputs (data/processed/):
  stations.json        Station[]     (contracts/types.ts)
  stations/{id}.json   HourlyPoint[]
Cache (data/raw/, git-ignored):
  sensebox_hourly.json  per-station hourly sums, so `--from-cache` rebuilds without downloading.

Usage:
  python -m pipeline.fetch_sensebox               # full download (~2 min, ~1.4 GB transfer)
  python -m pipeline.fetch_sensebox --max-pages 2 # quick partial run
  python -m pipeline.fetch_sensebox --from-cache
"""

import argparse
import json
import sys
import time
from collections import defaultdict

import requests

from pipeline.common import ATRAI_BASE, HTTP_TIMEOUT_S, PROCESSED_DIR, RAW_DIR

ITEMS_URL = f"{ATRAI_BASE}/collections/osem_home_data_heilbronn/items"
PAGE_SIZE = 50_000
# Pages are ~35 MB, so allow a longer read than the 8 s connect timeout. Batch job, not the demo path.
TIMEOUT = (HTTP_TIMEOUT_S, 90)
CACHE_FILE = RAW_DIR / "sensebox_hourly.json"

# Output metric -> source property, with plausible value ranges (outside = sensor glitch).
METRICS = {
    "temperatureC": ("Temperature", -30, 55),
    "humidityPct": ("Rel. Humidity", 0, 100),
    "pm25": ("Finedust PM2.5", 0, 1000),
    "pm10": ("Finedust PM10", 0, 1000),
}
PM_METRICS = ("pm25", "pm10")
# Low-cost PM sensors over-read in humid air; drop PM readings above this humidity (CLAUDE.md).
PM_MAX_HUMIDITY = 75


def new_station():
    return {"name": "", "lat": None, "lng": None, "lastSeen": "",
            "hours": defaultdict(lambda: {m: [0.0, 0] for m in METRICS})}


def add_features(stations, features):
    """Fold raw GeoJSON features into per-station hourly [sum, count] buckets."""
    for f in features:
        p = f.get("properties") or {}
        box, ts = p.get("boxId"), p.get("createdAt")
        if not box or not ts:
            continue
        s = stations[box]
        if ts > s["lastSeen"]:
            s["lastSeen"] = ts
            s["name"] = p.get("boxName") or box
            s["lat"], s["lng"] = p.get("latitude"), p.get("longitude")
        humidity = p.get("Rel. Humidity")
        too_humid = humidity is not None and humidity > PM_MAX_HUMIDITY
        bucket = s["hours"][ts[:13]]  # "YYYY-MM-DDTHH"
        for metric, (prop, lo, hi) in METRICS.items():
            v = p.get(prop)
            if v is None or not lo <= v <= hi or (metric in PM_METRICS and too_humid):
                continue
            bucket[metric][0] += v
            bucket[metric][1] += 1


def hourly_points(hours):
    """Turn {hour: {metric: [sum, count]}} into a sorted HourlyPoint list."""
    points = []
    for hour in sorted(hours):
        pt = {"t": f"{hour}:00:00Z"}
        for metric, (total, n) in hours[hour].items():
            if n:
                pt[metric] = round(total / n, 2)
        if len(pt) > 1:
            points.append(pt)
    return points


def build_outputs(stations):
    """Return (stations.json list, {id: HourlyPoint[]}) per contracts/types.ts."""
    station_list, series = [], {}
    for box, s in sorted(stations.items()):
        points = hourly_points(s["hours"])
        if not points or s["lat"] is None:
            continue
        latest = {}
        for pt in reversed(points):  # newest known value per metric
            for metric in METRICS:
                if metric not in latest and metric in pt:
                    latest[metric] = pt[metric]
        station_list.append({"id": box, "name": s["name"], "lat": s["lat"], "lng": s["lng"],
                             "lastSeen": s["lastSeen"][:19] + "Z", "latest": latest})
        series[box] = points
    return station_list, series


def fetch_all(stations, max_pages=None):
    session = requests.Session()
    offset, page, total = 0, 0, None
    while total is None or offset < total:
        if max_pages is not None and page >= max_pages:
            break
        for attempt in range(3):
            try:
                r = session.get(ITEMS_URL, params={"f": "json", "limit": PAGE_SIZE, "offset": offset},
                                timeout=TIMEOUT)
                r.raise_for_status()
                data = r.json()
                break
            except (requests.RequestException, ValueError) as e:
                if attempt == 2:
                    raise
                print(f"  retry offset {offset}: {e}", file=sys.stderr)
                time.sleep(2 * (attempt + 1))
        total = data.get("numberMatched", 0)
        features = data.get("features", [])
        if not features:
            break
        add_features(stations, features)
        offset += len(features)
        page += 1
        print(f"  page {page}: {offset:,}/{total:,} rows, {len(stations)} stations")


def save_cache(stations):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    plain = {box: {**s, "hours": dict(s["hours"])} for box, s in stations.items()}
    CACHE_FILE.write_text(json.dumps(plain), encoding="utf-8")


def load_cache():
    stations = defaultdict(new_station)
    for box, s in json.loads(CACHE_FILE.read_text(encoding="utf-8")).items():
        stations[box].update({k: v for k, v in s.items() if k != "hours"})
        stations[box]["hours"].update(s["hours"])
    return stations


def write_outputs(station_list, series):
    out_dir = PROCESSED_DIR / "stations"
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.json"):
        old.unlink()
    (PROCESSED_DIR / "stations.json").write_text(json.dumps(station_list, indent=1), encoding="utf-8")
    for box, points in series.items():
        (out_dir / f"{box}.json").write_text(json.dumps(points, separators=(",", ":")), encoding="utf-8")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--from-cache", action="store_true", help="rebuild outputs from data/raw cache")
    ap.add_argument("--max-pages", type=int, help="stop after N pages (for testing)")
    args = ap.parse_args(argv)

    if args.from_cache:
        stations = load_cache()
    else:
        stations = defaultdict(new_station)
        fetch_all(stations, args.max_pages)
        save_cache(stations)
    station_list, series = build_outputs(stations)
    write_outputs(station_list, series)
    n_points = sum(len(p) for p in series.values())
    print(f"wrote {len(station_list)} stations, {n_points:,} hourly points to {PROCESSED_DIR}")


if __name__ == "__main__":
    main()
