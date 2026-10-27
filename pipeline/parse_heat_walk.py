"""A4: Green City Summerschool heat walks (1–3 Sep 2026) → per-hexagon temperature anomaly.

Source: Green City Heilbronn / reedu public share "datensätze" (README: students walked with
senseBox loggers; Wed 2 Sep three groups at the same time: Wartberg, Neckar north, city centre).
datasets/alles.csv: timestamp (UTC), latitude, longitude, temperature, humidity, gps_speed, recording.

Method per reading:
  1. Drop the first 2 minutes of each recording (sensor warm-up) and standing points (speed < 0.2 m/s).
  2. Subtract the DWD Heilbronn hourly temperature (Bright Sky, linearly interpolated): removes the
     morning warming during the walks.
  3. Subtract that recording's median: removes each device's own offset (devices walking together on
     Tuesday differed by up to 1.4 °C).
  → "warmer/cooler than the rest of this walk at this time of day". Averaged per H3 res-9 cell
     (>= 30 readings, i.e. >= 30 s of walking).

Output: data/processed/heat_walk_h3.json  {h3: {anomalyC, n, recordings}}
Usage:  python -m pipeline.parse_heat_walk      (downloads alles.csv once into data/raw/greencity/)
"""

import csv
import json
import statistics
import sys
from bisect import bisect_left
from collections import defaultdict
from datetime import datetime, timedelta

import h3
import requests

from pipeline.common import BRIGHT_SKY_BASE, HTTP_TIMEOUT_S, PROCESSED_DIR, RAW_DIR

SHARE = "https://cloud.reedu.de/public.php/webdav/"
SHARE_TOKEN = "X9x2XE9a9xCxLm8"  # public share link, no password
WALK_DIR = RAW_DIR / "greencity"
WALK_FILE = WALK_DIR / "datasets" / "alles.csv"
WARMUP_S = 120
MIN_SPEED = 0.2
MIN_CELL_POINTS = 30
LAT, LNG = 49.1427, 9.2186


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def download():
    WALK_FILE.parent.mkdir(parents=True, exist_ok=True)
    for name in ("README.md", "datasets/alles.csv"):
        r = requests.get(SHARE + name, auth=(SHARE_TOKEN, ""), timeout=(HTTP_TIMEOUT_S, 120))
        r.raise_for_status()
        (WALK_DIR / name).write_bytes(r.content)


def load_walk():
    with open(WALK_FILE, encoding="utf-8") as fh:
        return [(ts(r["timestamp"]), float(r["latitude"]), float(r["longitude"]), float(r["temperature"]),
                 float(r["gps_speed"] or 0), r["recording"]) for r in csv.DictReader(fh)]


def fetch_reference(start, end):
    """Hourly DWD temperature for Heilbronn from Bright Sky: sorted [(datetime, °C)]."""
    r = requests.get(f"{BRIGHT_SKY_BASE}/weather", timeout=HTTP_TIMEOUT_S, params={
        "lat": LAT, "lon": LNG, "date": (start - timedelta(hours=1)).isoformat(),
        "last_date": (end + timedelta(hours=1)).isoformat()})
    r.raise_for_status()
    return sorted((ts(h["timestamp"]), h["temperature"]) for h in r.json()["weather"] if h["temperature"] is not None)


def interpolate(ref, t):
    times = [x[0] for x in ref]
    i = bisect_left(times, t)
    if i == 0:
        return ref[0][1]
    if i == len(ref):
        return ref[-1][1]
    (t0, v0), (t1, v1) = ref[i - 1], ref[i]
    return v0 + (v1 - v0) * (t - t0).total_seconds() / (t1 - t0).total_seconds()


def anomalies(rows, ref):
    """rows (t, lat, lng, temp, speed, recording) → [(lat, lng, anomaly, recording)]."""
    by_rec = defaultdict(list)
    for row in rows:
        by_rec[row[5]].append(row)
    out = []
    for rec, rs in by_rec.items():
        start = min(r[0] for r in rs)
        kept = [r for r in rs if (r[0] - start).total_seconds() >= WARMUP_S and r[4] >= MIN_SPEED]
        if not kept:
            continue
        detrended = [(r[1], r[2], r[3] - interpolate(ref, r[0])) for r in kept]
        median = statistics.median(d[2] for d in detrended)
        out += [(lat, lng, d - median, rec) for lat, lng, d in detrended]
    return out


def per_cell(points):
    cells = defaultdict(lambda: {"sum": 0.0, "n": 0, "recs": set()})
    for lat, lng, a, rec in points:
        c = cells[h3.latlng_to_cell(lat, lng, 9)]
        c["sum"] += a
        c["n"] += 1
        c["recs"].add(rec)
    return {cell: {"anomalyC": round(c["sum"] / c["n"], 2), "n": c["n"], "recordings": len(c["recs"])}
            for cell, c in sorted(cells.items()) if c["n"] >= MIN_CELL_POINTS}


def main():
    if not WALK_FILE.exists():
        download()
    rows = load_walk()
    ref = fetch_reference(min(r[0] for r in rows).date(), max(r[0] for r in rows).date())
    points = anomalies(rows, ref)
    cells = per_cell(points)
    (PROCESSED_DIR / "heat_walk_h3.json").write_text(json.dumps(cells, separators=(",", ":")), encoding="utf-8")
    values = sorted(c["anomalyC"] for c in cells.values())
    print(f"{len(rows):,} readings, {len(points):,} used from {len({p[3] for p in points})} recordings, "
          f"{len(cells)} cells, anomaly {values[0]:+.2f} .. {values[-1]:+.2f} °C", file=sys.stderr)


if __name__ == "__main__":
    main()
