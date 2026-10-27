"""Generate contracts/samples/*.json (dev mock data matching contracts/types.ts)."""
import json, math, random, sys, os
from datetime import datetime, timedelta, timezone
import h3

OUT = sys.argv[1]
random.seed(42)
NOW = datetime(2026, 10, 27, 15, 0, tzinfo=timezone.utc)
iso = lambda d: d.strftime("%Y-%m-%dT%H:%M:%SZ")
CENTER = (49.1425, 9.2150)

# approximate coordinates of real Heilbronn places
PLACES = {
    "Marktplatz": (49.1420, 9.2190),
    "Hauptbahnhof": (49.1430, 9.2085),
    "Kiliansplatz": (49.1413, 9.2205),
    "Bildungscampus": (49.1485, 9.2170),
    "Neckarbogen": (49.1490, 9.2060),
    "Wertwiesenpark": (49.1330, 9.2120),
    "Pfühlpark": (49.1440, 9.2370),
    "Allee": (49.1440, 9.2220),
    "Böckingen": (49.1390, 9.1880),
    "Sontheim": (49.1250, 9.2050),
}
PARKS = [PLACES["Wertwiesenpark"], PLACES["Pfühlpark"], PLACES["Neckarbogen"]]

def dist_m(a, b):
    dy = (a[0] - b[0]) * 111_320
    dx = (a[1] - b[1]) * 111_320 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)

def cell(p): return h3.latlng_to_cell(p[0], p[1], 9)
def r2(x): return round(x, 2)

# ---------- stations ----------
STATIONS = [
    ("sb-markt", "senseBox Marktplatz", PLACES["Marktplatz"]),
    ("sb-bahnhof", "senseBox Bahnhofsvorstadt", (49.1438, 9.2100)),
    ("sb-campus", "senseBox Bildungscampus", PLACES["Bildungscampus"]),
    ("sb-wertwiesen", "senseBox Wertwiesen", PLACES["Wertwiesenpark"]),
    ("sb-boeckingen", "senseBox Böckingen", PLACES["Böckingen"]),
    ("sb-sontheim", "senseBox Sontheim", PLACES["Sontheim"]),
]

def hourly(st_id, center_heat):
    pts = []
    for i in range(48):
        t = NOW - timedelta(hours=47 - i)
        h = t.hour + 1  # CET
        temp = 9 + 6 * math.sin((h - 9) / 24 * 2 * math.pi) + center_heat * 2.5 + random.uniform(-0.4, 0.4)
        hum = 85 - 25 * math.sin((h - 9) / 24 * 2 * math.pi) + random.uniform(-3, 3)
        pm25 = 6 + 5 * random.random() + (4 if h in (8, 9, 18, 19) else 0)
        pts.append({"t": iso(t), "temperatureC": r2(temp), "humidityPct": r2(min(hum, 99)),
                    "pm25": r2(pm25), "pm10": r2(pm25 * 1.6)})
    return pts

stations, hourly_files = [], {}
for sid, name, p in STATIONS:
    heat = max(0, 1 - dist_m(p, CENTER) / 2500)
    pts = hourly(sid, heat)
    hourly_files[sid] = pts
    last = pts[-1]
    stations.append({"id": sid, "name": name, "lat": p[0], "lng": p[1], "lastSeen": last["t"],
                     "latest": {k: last[k] for k in ("temperatureC", "humidityPct", "pm25", "pm10")}})

# ---------- layers ----------
WEIGHTS = {"heat": 0.3, "air": 0.2, "bike": 0.15, "green": 0.2, "risk": 0.15, "felt": 0.0}
cells = []
for c in sorted(h3.grid_disk(cell(CENTER), 9)):
    lat, lng = h3.cell_to_latlng(c)
    d_center = dist_m((lat, lng), CENTER)
    d_green = min(dist_m((lat, lng), p) for p in PARKS)
    heat = min(1, max(0, 1 - d_center / 2200 - (0.3 if d_green < 250 else 0) + random.uniform(-0.1, 0.1)))
    air = min(1, max(0, 0.7 - d_center / 3500 + random.uniform(-0.15, 0.15)))
    green = min(1, max(0, d_green / 1200))
    bike = None if random.random() < 0.35 else r2(random.uniform(0.1, 0.9))
    sensitive = random.choice([0, 0, 0, 1, 1, 2, 3])
    risk = min(1, 0.25 * sensitive + 0.3 * heat)
    near = min(stations, key=lambda s: dist_m((lat, lng), (s["lat"], s["lng"])))
    near_d = dist_m((lat, lng), (near["lat"], near["lng"]))
    scores = {"heat": r2(heat), "air": r2(air) if near_d < 1500 else None, "bike": bike,
              "green": r2(green), "risk": r2(risk), "felt": None}
    num = sum(WEIGHTS[k] * v for k, v in scores.items() if v is not None)
    den = sum(WEIGHTS[k] for k, v in scores.items() if v is not None)
    facts = {"tempAfternoonC": r2(27 + 7 * heat), "distToGreenM": round(d_green),
             "sensitivePlaces": sensitive, "trees": random.randint(0, 40),
             "busStops": random.choice([0, 0, 1, 1, 2]),
             "nearestStationId": near["id"], "nearestStationDistM": round(near_d)}
    if scores["air"] is not None: facts["pm25"] = r2(5 + 10 * air)
    if bike is not None: facts["overtakeUnder150Pct"] = round(bike * 60)
    cells.append({"h3": c, "scores": scores, "need": r2(num / den), "facts": facts})
layers = {"generatedAt": iso(NOW), "resolution": 9, "weights": WEIGHTS, "cells": cells}

# ---------- missions ----------
def mission(i, mtype, place, title, desc, cat, urg, effort, suited, rule, ev, **kw):
    p = PLACES[place]
    return {"id": f"m-{i:03d}", "type": mtype, "title": title, "description": desc, "h3": cell(p),
            "lat": p[0], "lng": p[1], "placeName": place, "category": cat, "urgency": urg,
            "effort": effort, "suitedFor": suited, "reason": {"rule": rule, "evidence": ev},
            "source": "pipeline", "simulated": True, **kw}

missions = [
    mission(1, "water_trees", "Allee", "Bäume an der Allee gießen",
            "Seit 6 Tagen kein Regen. Die Straßenbäume an der Allee brauchen je 50–100 Liter.",
            "heat", 3, "hour", ["resident", "club"], "5+ dry days, street trees, heat ≥ 0.5",
            {"dryDays": 6, "trees": 24, "heat": 0.78}, expiresAt=iso(NOW + timedelta(days=2))),
    mission(2, "shade_bus_stop", "Hauptbahnhof", "Schatten für die Haltestelle am Hauptbahnhof",
            "Nachmittags im Schnitt 33,4 °C. Ein Sonnensegel oder Baum würde Wartenden helfen.",
            "heat", 2, "project", ["company", "city"], "heat ≥ 0.7 and bus stop",
            {"heat": 0.86, "tempAfternoonC": 33.4, "busStops": 2}),
    mission(3, "green_schoolyard", "Bildungscampus", "Schulhof begrünen",
            "Versiegelter Hof, 32,1 °C am Nachmittag. Hochbeete und Kletterpflanzen kühlen.",
            "heat", 2, "project", ["school", "club", "company"], "heat ≥ 0.6 and school",
            {"heat": 0.69, "sensitivePlaces": 2}),
    mission(4, "pollinator_gap", "Böckingen", "Blühstreifen in Böckingen",
            "Keine Grünfläche im Umkreis von 420 m. Ein Blühstreifen schließt die Lücke für Insekten.",
            "biodiversity", 1, "afternoon", ["resident", "club"], "no green within ~300 m",
            {"distToGreenM": 420}),
    mission(5, "unseal_10m2", "Kiliansplatz", "10 m² entsiegeln am Kiliansplatz",
            "Pflaster raus, Beet rein: 10 m² weniger Hitze und mehr Versickerung.",
            "heat", 2, "afternoon", ["company", "city"], "heat ≥ 0.6 and no green within 150 m",
            {"heat": 0.81, "distToGreenM": 640}),
    mission(6, "safer_bike_street", "Marktplatz", "Sicherer Radweg an der Kaiserstraße",
            "41 % der Überholvorgänge unter 150 cm. Markierung oder Tempo 30 prüfen.",
            "mobility", 3, "project", ["city"], "≥ 30% overtakings under 150 cm",
            {"overtakeUnder150Pct": 41, "rides": 312}),
    mission(7, "host_sensor", "Sontheim", "Sensor in Sontheim aufhängen",
            "Kein Sensor im Umkreis von 500 m, aber 3 Kitas. Eine senseBox liefert Daten.",
            "air", 1, "hour", ["resident", "school"], "no sensor within 500 m and sensitive places",
            {"nearestStationDistM": 760, "sensitivePlaces": 3}),
    mission(8, "check_reports", "Pfühlpark", "Meldungen am Pfühlpark prüfen",
            "4 Hitze-Meldungen, aber kein Sensor. Mit Thermometer nachmessen.",
            "heat", 1, "hour", ["resident"], "3+ reports, no sensor", {"reports": 4},
            source="report"),
]

states = {
    "m-001": {"status": "claimed", "claimedBy": "Gartenverein Allee", "supporters": 7},
    "m-003": {"status": "done", "claimedBy": "Klasse 7b", "supporters": 12, "doneAt": iso(NOW - timedelta(days=5)),
              "impact": {"metric": "temperatureC", "stationId": "sb-campus", "before": 31.8, "after": 30.6,
                         "cityBefore": 30.1, "cityAfter": 29.9, "effect": -1.0, "simulated": True}},
    "m-006": {"status": "open", "supporters": 23},
}
missions_with_state = [{**m, "state": {"missionId": m["id"], "status": "open", "supporters": 0,
                                       **states.get(m["id"], {})}} for m in missions]

# ---------- reports ----------
REPORTS = [
    ("Am Hauptbahnhof an der Haltestelle ist es mittags unerträglich heiß, kein Schatten.", "Hauptbahnhof",
     "heat", "Kein Schatten an der Haltestelle, mittags sehr heiß.", 3, "midday", "shade_bus_stop", "de",
     {"status": "confirmed", "stationId": "sb-bahnhof", "value": 33.1, "unit": "°C", "distM": 140}),
    ("Do isch's heit arg stickig, die Luft am Marktplatz stinkt nach Abgas.", "Marktplatz",
     "air", "Stickige Luft und Abgasgeruch am Marktplatz.", 2, "afternoon", None, "de",
     {"status": "not_confirmed", "stationId": "sb-markt", "value": 8.4, "unit": "µg/m³", "distM": 60}),
    ("Autos überholen auf der Allee viel zu knapp, ich hab Angst mit dem Rad.", "Allee",
     "mobility", "Zu knappes Überholen von Radfahrenden auf der Allee.", 3, "morning", "safer_bike_street", "de",
     {"status": "no_sensor"}),
    ("The trees in the park look really dry, leaves are already brown.", "Pfühlpark",
     "heat", "Trees in the park look dry with brown leaves.", 2, "afternoon", "water_trees", "en",
     {"status": "no_sensor"}),
    ("Am Neckarufer liegt überall Müll nach dem Wochenende.", "Neckarbogen",
     "waste", "Viel Müll am Neckarufer nach dem Wochenende.", 1, "morning", None, "de",
     {"status": "no_sensor"}),
    ("Im Schulhof gibt's null Schatten, die Kinder sitzen in der Pause in der Sonne.", "Bildungscampus",
     "heat", "Kein Schatten im Schulhof während der Pause.", 2, "midday", "green_schoolyard", "de",
     {"status": "confirmed", "stationId": "sb-campus", "value": 31.2, "unit": "°C", "distM": 90}),
]
reports = []
for i, (tr, place, cat, summ, sev, tod, sm, lang, sc) in enumerate(REPORTS):
    p = PLACES[place]
    lat, lng = p[0] + random.uniform(-0.0006, 0.0006), p[1] + random.uniform(-0.0006, 0.0006)
    reports.append({"id": f"r-{i + 1:03d}", "createdAt": iso(NOW - timedelta(minutes=37 * (len(REPORTS) - i))),
                    "transcript": tr, "lat": round(lat, 5), "lng": round(lng, 5), "h3": cell((lat, lng)),
                    "category": cat, "summary": summ, "severity": sev, "timeOfDay": tod, "placeHint": place,
                    "suggestedMission": sm, "language": lang, "sensorCheck": sc, "seeded": True})

# ---------- write ----------
def dump(name, obj):
    path = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1 if name == "layers.json" else 2)
        f.write("\n")

dump("layers.json", layers)
dump("stations.json", stations)
for sid, pts in hourly_files.items():
    dump(f"stations/{sid}.json", pts)
dump("missions.json", missions)
dump("api/missions.json", missions_with_state)
dump("api/reports.json", reports)
print(len(cells), "cells,", len(missions), "missions,", len(reports), "reports")
