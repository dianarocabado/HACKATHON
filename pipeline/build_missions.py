"""A6: mission rules over layers.json + Bright Sky dry days → missions.json.

Rules (TASKS.md, thresholds tuned on 27 Oct 2026 data; see RULES for the values):
  water_trees        >= 5 dry days (< 1 mm/day), >= 3 mapped trees and heat >= 0.5; expires at the next forecast rain
  shade_bus_stop     heat >= 0.7 and a bus stop in the cell
  green_schoolyard   heat >= 0.6 and a school or kindergarten in the cell
  pollinator_gap     mostly residential cell (>= 50 %) with no usable green within 300 m
  unseal_10m2        heat >= 0.6 and no usable green within 150 m
  safer_bike_street  segment with >= 10 measured overtakings and >= 60 % under 150 cm
                     (the planned 30 % flagged 214 of 223 measured segments)
  host_sensor        no active station within 500 m and >= 2 sensitive places in the cell
check_reports is created live from voice reports (A12), not here.
Each type keeps its MAX_PER_TYPE strongest candidates so the list stays readable.
"""

import json
import math
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

import h3
import requests
from shapely import STRtree
from shapely.geometry import LineString, shape

from pipeline.build_layers import cell_polygon, project, to_m
from pipeline.common import BRIGHT_SKY_BASE, HTTP_TIMEOUT_S, PROCESSED_DIR

LAT, LNG = 49.1427, 9.2186  # Marktplatz
MAX_PER_TYPE = 8
DRY_DAY_MM = 1.0
RULES = {
    "water_trees": {"dryDays": 5, "trees": 3, "heat": 0.5},
    "shade_bus_stop": {"heat": 0.7},
    "green_schoolyard": {"heat": 0.6},
    "pollinator_gap": {"residential": 0.5, "distToGreenM": 300},
    "unseal_10m2": {"heat": 0.6, "distToGreenM": 150},
    "safer_bike_street": {"n": 10, "under150Pct": 60},
    "host_sensor": {"stationDistM": 500, "sensitivePlaces": 2},
}


def load(name):
    return json.loads((PROCESSED_DIR / name).read_text(encoding="utf-8"))


# ---------- weather ----------

def daily_precipitation(weather):
    days = defaultdict(float)
    for hour in weather:
        days[hour["timestamp"][:10]] += hour.get("precipitation") or 0
    return dict(days)


def dry_spell(days, today):
    """(consecutive dry days up to and including yesterday, first forecast rain day from today or None)."""
    dry = 0
    d = today - timedelta(days=1)
    while d.isoformat() in days and days[d.isoformat()] < DRY_DAY_MM:
        dry += 1
        d -= timedelta(days=1)
    rain = next((d for d in sorted(days) if d >= today.isoformat() and days[d] >= DRY_DAY_MM), None)
    return dry, rain


def fetch_weather(today):
    """Hourly Bright Sky data for the last 21 days and the next 5. None if the API fails."""
    try:
        r = requests.get(f"{BRIGHT_SKY_BASE}/weather", timeout=HTTP_TIMEOUT_S, params={
            "lat": LAT, "lon": LNG, "tz": "Europe/Berlin",
            "date": (today - timedelta(days=21)).isoformat(), "last_date": (today + timedelta(days=5)).isoformat(),
        })
        r.raise_for_status()
        return r.json()["weather"]
    except (requests.RequestException, KeyError, ValueError) as e:
        print(f"Bright Sky unavailable, skipping water_trees: {e}", file=sys.stderr)
        return None


# ---------- helpers ----------

def mission(mtype, cell, lat, lng, score, title, description, evidence, **extra):
    """(Mission without urgency, ranking score). Urgency is set by rank within the type in build().
    `en` = (title, description, rule) in English; the main fields are German."""
    title_en, description_en, rule_en = extra.pop("en")
    m = {
        "id": f"{mtype}-{extra.pop('key', cell)}",
        "type": mtype, "title": title, "description": description,
        "h3": cell, "lat": round(lat, 6), "lng": round(lng, 6),
        "reason": {"rule": extra.pop("rule"), "evidence": evidence},
        "source": "pipeline",
        "en": {"title": title_en, "description": description_en, "rule": rule_en},
    }
    m.update(extra)
    return m, score


def nearest_stop_fn(points, max_m=400):
    """Name of the nearest named bus stop within max_m, for orienting missions without a named place."""
    stops = [(to_m(p[1], p[0]), p[2]) for p in points.get("bus_stops", []) if len(p) > 2]

    def nearest(lat, lng):
        x, y = to_m(lng, lat)
        best = min(stops, key=lambda s: math.hypot(s[0][0] - x, s[0][1] - y), default=None)
        if best and math.hypot(best[0][0] - x, best[0][1] - y) <= max_m:
            return best[1]
        return None
    return nearest


def points_by_cell(points):
    by = defaultdict(lambda: defaultdict(list))
    for cat, rows in points.items():
        for row in rows:
            by[h3.latlng_to_cell(row[0], row[1], 9)][cat].append(row)
    return by


def residential_shares(cells, residential):
    tree = STRtree([project(shape(f["geometry"])) for f in residential["features"]])
    shares = {}
    for c in cells:
        poly = project(cell_polygon(c))
        area = sum(poly.intersection(tree.geometries[i]).area for i in tree.query(poly, predicate="intersects"))
        shares[c] = area / poly.area
    return shares


def fmt(x, digits=1):
    return f"{x:.{digits}f}".replace(".", ",")


def fmt_en(x, digits=1):
    return f"{x:.{digits}f}"


MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def period(start, end):
    """('17.07.–31.08.2026', '17 Jul–31 Aug 2026') for two YYYY-MM-DD dates."""
    a, b = date.fromisoformat(start), date.fromisoformat(end)
    de_a = f"{a:%d.%m.}" if a.year == b.year else f"{a:%d.%m.%Y}"
    en_a = f"{a.day} {MONTHS_EN[a.month - 1]}" + ("" if a.year == b.year else f" {a.year}")
    return f"{de_a}–{b:%d.%m.%Y}", f"{en_a}–{b.day} {MONTHS_EN[b.month - 1]} {b.year}"


def temp_note(f, station_names):
    """Summer-afternoon temperature with its sensor, distance and period, or ('', '') without one."""
    if "tempAfternoonC" not in f:
        return "", ""
    name = station_names.get(f.get("nearestStationId"))
    dist = round(f["nearestStationDistM"] / 10) * 10
    when_de, when_en = period(f["tempFrom"], f["tempTo"])
    sensor_de = f"Sensor „{name}“, {dist} m entfernt" if name else f"Sensor {dist} m entfernt"
    sensor_en = f"sensor “{name}”, {dist} m away" if name else f"sensor {dist} m away"
    return (f", nachmittags im Sommer im Schnitt {fmt(f['tempAfternoonC'])} °C ({sensor_de}, {when_de})",
            f", summer afternoons average {fmt_en(f['tempAfternoonC'])} °C ({sensor_en}, {when_en})")


# ---------- rules ----------

def build(data, today, weather_days):
    cells = data["layers"]["cells"]
    pts = points_by_cell(data["points"])
    res_share = residential_shares([c["h3"] for c in cells], data["residential"])
    candidates = defaultdict(list)

    dry, rain_day = dry_spell(weather_days, today) if weather_days is not None else (None, None)

    for c in cells:
        cell, s, f = c["h3"], c["scores"], c["facts"]
        lat, lng = h3.cell_to_latlng(cell)
        heat = s.get("heat") or 0
        here = pts.get(cell, {})
        temp = ({"tempAfternoonC": f["tempAfternoonC"], "nearestStationDistM": f["nearestStationDistM"]}
                if "tempAfternoonC" in f else {})
        temp_de, temp_en = temp_note(f, data.get("station_names", {}))

        r = RULES["water_trees"]
        if dry is not None and dry >= r["dryDays"] and f.get("trees", 0) >= r["trees"] and heat >= r["heat"]:
            extra = {"expiresAt": f"{rain_day}T06:00:00Z"} if rain_day else {}
            candidates["water_trees"].append(mission(
                "water_trees", cell, lat, lng, heat,
                "Straßenbäume gießen",
                f"Seit {dry} Tagen kein nennenswerter Regen. Hier stehen {f['trees']} kartierte Bäume; "
                "jeder Baum braucht jetzt 50–100 Liter Wasser.",
                {"dryDays": dry, "trees": f["trees"], "heat": heat},
                rule="5+ Tage ohne Regen, Straßenbäume, Hitzewert ≥ 0,5",
                en=("Water the street trees",
                    f"No real rain for {dry} days. {f['trees']} mapped trees stand here; "
                    "each tree now needs 50–100 litres of water.",
                    "5+ days without rain, street trees, heat score ≥ 0.5"),
                category="biodiversity", effort="hour", suitedFor=["resident", "club", "school"], **extra))

        if heat >= RULES["shade_bus_stop"]["heat"] and here.get("bus_stops"):
            stop = next((p for p in here["bus_stops"] if len(p) > 2), here["bus_stops"][0])
            name = stop[2] if len(stop) > 2 else None
            candidates["shade_bus_stop"].append(mission(
                "shade_bus_stop", cell, stop[0], stop[1], heat,
                f"Schatten für die Haltestelle {name}" if name else "Schatten für eine Haltestelle",
                f"Die Umgebung ist stark versiegelt (Hitzewert {fmt(heat, 2)})"
                + temp_de + ". Ein Sonnensegel, ein Baum oder ein begrüntes Dach hilft Wartenden.",
                {"heat": heat, "busStops": len(here["bus_stops"]), **temp},
                rule="Hitzewert ≥ 0,7 und Bushaltestelle",
                en=(f"Shade for the {name} bus stop" if name else "Shade for a bus stop",
                    f"The area is heavily sealed (heat score {fmt_en(heat, 2)})"
                    + temp_en + ". A sun sail, a tree or a green roof helps people waiting.",
                    "Heat score ≥ 0.7 and a bus stop"),
                category="heat", effort="project", suitedFor=["company", "city", "club"],
                **({"placeName": name} if name else {})))

        schools = here.get("schools", []) + here.get("kindergartens", [])
        if heat >= RULES["green_schoolyard"]["heat"] and schools:
            place = next((p for p in schools if len(p) > 2), schools[0])
            name = place[2] if len(place) > 2 else None
            candidates["green_schoolyard"].append(mission(
                "green_schoolyard", cell, place[0], place[1], heat,
                f"Schulhof begrünen: {name}" if name else "Schulhof begrünen",
                f"Schule oder Kita in einem heißen, versiegelten Bereich (Hitzewert {fmt(heat, 2)}){temp_de}. "
                "Bäume, Hochbeete und entsiegelte Flächen kühlen den Hof und laden zum Lernen draußen ein.",
                {"heat": heat, "schools": len(schools), **temp},
                rule="Hitzewert ≥ 0,6 und Schule oder Kita",
                en=(f"Green the schoolyard: {name}" if name else "Green the schoolyard",
                    f"A school or nursery in a hot, sealed area (heat score {fmt_en(heat, 2)}){temp_en}. "
                    "Trees, raised beds and unsealed ground cool the yard and invite learning outdoors.",
                    "Heat score ≥ 0.6 and a school or nursery"),
                category="heat", effort="project", suitedFor=["school", "company", "city"],
                **({"placeName": name} if name else {})))

        dist = f.get("distToGreenM")
        r = RULES["pollinator_gap"]
        if res_share[cell] >= r["residential"] and dist is not None and dist >= r["distToGreenM"]:
            candidates["pollinator_gap"].append(mission(
                "pollinator_gap", cell, lat, lng, s.get("green") or 0,
                "Blühinsel für Bienen anlegen",
                f"Wohngebiet ohne nutzbare Grünfläche in {dist} m Umkreis. Schon ein Balkonkasten oder "
                "ein Baumscheiben-Beet mit heimischen Blühpflanzen schließt die Lücke für Insekten.",
                {"distToGreenM": dist, "residentialPct": round(100 * res_share[cell])},
                rule="Wohngebiet, keine Grünfläche im Umkreis von 300 m",
                en=("Plant a flower patch for bees",
                    f"Residential area without a usable green space within {dist} m. Even a balcony box or a bed "
                    "around a street tree with native flowering plants closes the gap for insects.",
                    "Residential area, no green space within 300 m"),
                category="biodiversity", effort="afternoon", suitedFor=["resident", "school", "club"]))

        r = RULES["unseal_10m2"]
        if heat >= r["heat"] and dist is not None and dist >= r["distToGreenM"]:
            candidates["unseal_10m2"].append(mission(
                "unseal_10m2", cell, lat, lng, heat,
                "10 m² entsiegeln",
                f"Stark versiegelt (Hitzewert {fmt(heat, 2)}), nächste nutzbare Grünfläche {dist} m entfernt. "
                "Pflaster raus, Beet rein: 10 m² auf einem Hof oder Parkplatz kühlen und lassen Regen versickern.",
                {"heat": heat, "distToGreenM": dist},
                rule="Hitzewert ≥ 0,6 und keine Grünfläche im Umkreis von 150 m",
                en=("Unseal 10 m²",
                    f"Heavily sealed (heat score {fmt_en(heat, 2)}), nearest usable green space {dist} m away. "
                    "Paving out, plants in: 10 m² in a yard or car park cools the area and lets rain soak away.",
                    "Heat score ≥ 0.6 and no green space within 150 m"),
                category="heat", effort="afternoon", suitedFor=["resident", "company", "club"]))

        r = RULES["host_sensor"]
        station_dist = data["station_dist"](lat, lng)
        if station_dist > r["stationDistM"] and f.get("sensitivePlaces", 0) >= r["sensitivePlaces"]:
            candidates["host_sensor"].append(mission(
                "host_sensor", cell, lat, lng, c["need"],
                "senseBox aufhängen",
                f"Hier gibt es {f['sensitivePlaces']} empfindliche Orte (Schulen, Kitas, Pflegeheime, Spielplätze), "
                f"aber die nächste Messstation ist {fmt(station_dist / 1000)} km entfernt. "
                "Eine senseBox am Fenster liefert echte Werte für die Nachbarschaft.",
                {"sensitivePlaces": f["sensitivePlaces"], "stationDistM": round(station_dist), "need": c["need"]},
                rule="keine Messstation im Umkreis von 500 m, mindestens 2 empfindliche Orte",
                en=("Put up a senseBox",
                    f"There are {f['sensitivePlaces']} sensitive places here (schools, nurseries, care homes, "
                    f"playgrounds), but the nearest measuring station is {fmt_en(station_dist / 1000)} km away. "
                    "A senseBox at a window delivers real values for the neighbourhood.",
                    "No measuring station within 500 m, at least 2 sensitive places"),
                category="other", effort="hour", suitedFor=["resident", "school", "company"]))

    r = RULES["safer_bike_street"]
    best_per_street = {}
    for seg in data["segments"]:
        if seg["n"] < r["n"] or seg["under150Pct"] < r["under150Pct"]:
            continue
        key = seg["name"] or f"seg{seg['id']}"
        score = seg["under150Pct"] / 100 + min(seg["n"], 50) / 10_000  # ties: more measurements first
        if key not in best_per_street or score > best_per_street[key][0]:
            best_per_street[key] = (score, seg)
    for score, seg in best_per_street.values():
        mid = LineString(seg["coords"]).interpolate(0.5, normalized=True)
        cell = h3.latlng_to_cell(mid.y, mid.x, 9)
        name = seg["name"]
        candidates["safer_bike_street"].append(mission(
            "safer_bike_street", cell, mid.y, mid.x, score,
            f"Sicherer Radfahren: {name}" if name else "Sicherer Radfahren auf diesem Abschnitt",
            f"{fmt(seg['under150Pct'], 0)} % von {seg['n']} gemessenen Überholvorgängen waren enger als die "
            f"erlaubten 150 cm (Schnitt {fmt(seg['avgCm'], 0)} cm). Markierung, Tempo 30 oder ein Hinweisschild "
            "können hier helfen.",
            {"under150Pct": seg["under150Pct"], "overtakings": seg["n"], "avgCm": seg["avgCm"]},
            rule="≥ 10 gemessene Überholvorgänge, ≥ 60 % unter 150 cm",
            en=(f"Safer cycling: {name}" if name else "Safer cycling on this stretch",
                f"{fmt_en(seg['under150Pct'], 0)}% of {seg['n']} measured overtakings were closer than the legal "
                f"150 cm (average {fmt_en(seg['avgCm'], 0)} cm). Road markings, a 30 km/h limit or a sign "
                "could help here.",
                "≥ 10 measured overtakings, ≥ 60% closer than 150 cm"),
            key=f"seg{seg['id']}", category="mobility", effort="project", suitedFor=["city", "resident", "club"],
            **({"placeName": name} if name else {})))

    nearest_stop = nearest_stop_fn(data["points"])
    missions = []
    for mtype in RULES:
        ranked = [m for m, _ in sorted(candidates[mtype], key=lambda ms: (-ms[1], ms[0]["id"]))[:MAX_PER_TYPE]]
        for i, m in enumerate(ranked):
            # The proxy scores saturate in the centre, so urgency is relative: top third 3, then 2, then 1.
            m["urgency"] = 3 - min(2, 3 * i // max(len(ranked), 1))
            if "placeName" not in m and (stop := nearest_stop(m["lat"], m["lng"])):
                m["placeName"] = f"Nähe Haltestelle {stop}"
                m["en"]["placeName"] = f"Near bus stop {stop}"
        missions += ranked
    return missions, {"dryDays": dry, "nextRain": rain_day,
                      "candidates": {k: len(v) for k, v in candidates.items()}}


def station_distance_fn(stations):
    """Distance (m) to the nearest station that reported in the 14 days before the newest one."""
    newest = max(s["lastSeen"] for s in stations)
    cutoff = (datetime.fromisoformat(newest.replace("Z", "+00:00")) - timedelta(days=14)).isoformat()
    active = [to_m(s["lng"], s["lat"]) for s in stations
              if datetime.fromisoformat(s["lastSeen"].replace("Z", "+00:00")).isoformat() >= cutoff]

    def dist(lat, lng):
        x, y = to_m(lng, lat)
        return min((math.hypot(x - ax, y - ay) for ax, ay in active), default=math.inf)
    return dist


def main():
    today = datetime.now(timezone.utc).astimezone().date()
    weather = fetch_weather(today)
    stations = load("stations.json")
    data = {
        "layers": load("layers.json"),
        "points": load("osm_points.json"),
        "residential": load("residential.geojson"),
        "segments": load("bike_segments.json"),
        "station_dist": station_distance_fn(stations),
        "station_names": {s["id"]: s["name"] for s in stations},
    }
    missions, info = build(data, today, daily_precipitation(weather) if weather is not None else None)
    (PROCESSED_DIR / "missions.json").write_text(json.dumps(missions, ensure_ascii=False, indent=1), encoding="utf-8")
    counts = Counter(m["type"] for m in missions)
    print(f"wrote {len(missions)} missions {dict(counts)} | dry days {info['dryDays']}, next rain {info['nextRain']} "
          f"| candidates {info['candidates']}")


if __name__ == "__main__":
    main()
