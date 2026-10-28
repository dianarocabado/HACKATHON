import h3
from shapely.geometry import mapping

from pipeline.build_layers import build, cell_polygon, station_profiles

LAT, LNG = 49.1427, 9.2186
CELL = h3.latlng_to_cell(LAT, LNG, 9)
NEIGHBOUR = [c for c in h3.grid_disk(CELL, 1) if c != CELL][0]


def fc(features):
    return {"type": "FeatureCollection", "features": features}


def feature(geom, **props):
    return {"type": "Feature", "properties": props, "geometry": mapping(geom)}


def history(day_range, summer=True, pm=5.0):
    """Hourly points over 3 days with the given daily temperature swing."""
    month = "07" if summer else "10"
    pts = []
    for day in ("01", "02", "03"):
        for hour in range(24):
            temp = 20 + day_range * (1 if 12 <= hour <= 15 else 0)
            pts.append({"t": f"2026-{month}-{day}T{hour:02d}:00:00Z", "temperatureC": temp, "pm25": pm})
    return pts


def data(**overrides):
    both = cell_polygon(CELL).union(cell_polygon(NEIGHBOUR)).buffer(0.0001)
    d = {
        "boundary": fc([feature(both, name="Heilbronn")]),
        "green": fc([feature(cell_polygon(NEIGHBOUR), kind="park")]),
        "built_up": fc([feature(cell_polygon(CELL), kind="residential")]),
        "buildings": {CELL: 0.35},
        "points": {"trees": [[LAT, LNG]], "bus_stops": [[LAT, LNG, "Rathaus"]], "schools": [[LAT, LNG, "Schule"]],
                   "kindergartens": [], "care_homes": [], "playgrounds": []},
        "stations": [{"id": "s1", "lat": LAT, "lng": LNG}],
        "history": {"s1": history(12) * 20},
        "segments": [{"coords": [[LNG - 0.001, LAT], [LNG + 0.001, LAT]], "n": 10, "under150Pct": 60.0}],
        "danger_zones": [{"lat": LAT, "lng": LNG, "risk": 0.8}],
        "danger_pm_hex": {CELL: {"risk": 0.4, "n": 5}},
        "heat_walk": {},
    }
    d.update(overrides)
    return d


def cells_by_id(layers):
    return {c["h3"]: c for c in layers["cells"]}


def test_built_up_cell_scores_high_park_cell_low():
    cells = cells_by_id(build(data()))
    city, park = cells[CELL], cells[NEIGHBOUR]
    assert city["scores"]["heat"] == 1.0
    assert park["scores"]["heat"] == 0.0 and park["scores"]["green"] == 0.0
    assert city["need"] > park["need"]


def test_scores_and_facts_from_all_sources():
    c = cells_by_id(build(data()))[CELL]
    assert c["scores"]["air"] == 0.4
    assert c["scores"]["bike"] == 0.7  # mean(0.8 danger risk, 60 % under 150 cm)
    assert c["scores"]["risk"] is None and c["scores"]["felt"] is None
    f = c["facts"]
    assert f["overtakeUnder150Pct"] == 60.0 and f["tempAfternoonC"] == 32.0 and f["pm25"] == 5.0
    assert f["trees"] == 1 and f["busStops"] == 1 and f["sensitivePlaces"] == 1
    assert f["nearestStationId"] == "s1" and f["nearestStationDistM"] < 100  # measured to the cell centre


def test_bumpy_paths_fill_risk_weighted_by_boxes():
    road = lambda r, boxes: {"coords": [[LNG - 0.0005, LAT], [LNG + 0.0005, LAT]], "roughness": r, "boxes": boxes}
    c = cells_by_id(build(data(bumpy_roads=[road(10.0, 1), road(20.0, 3)])))[CELL]
    assert c["facts"]["surfaceRoughness"] == 18          # (10 x 1 + 20 x 3) / 4 = 17.5 -> 18
    assert c["scores"]["risk"] == 0.5                    # (17.5 - 5) / 25
    # one box on a short stretch is too little data
    thin = cells_by_id(build(data(bumpy_roads=[{**road(30.0, 1), "coords": [[LNG, LAT], [LNG + 0.0001, LAT]]}])))
    assert thin[CELL]["scores"]["risk"] is None and "surfaceRoughness" not in thin[CELL]["facts"]


def test_need_ignores_null_scores():
    c = cells_by_id(build(data(danger_pm_hex={}, danger_zones=[], segments=[])))[CELL]
    assert c["scores"]["air"] is None and c["scores"]["bike"] is None
    # only heat (1.0) and green remain; need is their weighted mean
    w = {"heat": 0.35, "green": 0.25}
    expected = (w["heat"] * c["scores"]["heat"] + w["green"] * c["scores"]["green"]) / sum(w.values())
    assert abs(c["need"] - expected) < 0.002


def test_indoor_stations_are_ignored():
    stations = [{"id": "in", "lat": LAT, "lng": LNG}, {"id": "out", "lat": LAT, "lng": LNG}]
    profiles = station_profiles(stations, {"in": history(1) * 20, "out": history(10) * 20})
    assert [p["id"] for p in profiles] == ["out"]


def test_heat_walk_measurement_blends_into_heat():
    cells = cells_by_id(build(data(heat_walk={NEIGHBOUR: {"anomalyC": 1.0, "n": 50, "recordings": 2}})))
    park = cells[NEIGHBOUR]
    assert park["facts"]["heatWalkAnomalyC"] == 1.0
    assert park["scores"]["heat"] == 0.5  # 0.5 * proxy 0.0 + 0.5 * (0.5 + 1.0 / 2)
    assert "heatWalkAnomalyC" not in cells[CELL]["facts"]


def test_open_farmland_does_not_lack_green():
    c = cells_by_id(build(data(built_up=fc([]), buildings={}, green=fc([]))))[CELL]
    assert c["scores"]["heat"] == 0.0 and c["scores"]["green"] == 0.0
