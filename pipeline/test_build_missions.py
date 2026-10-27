from datetime import date

import h3
from shapely.geometry import mapping

from pipeline.build_layers import cell_polygon
from pipeline.build_missions import build, daily_precipitation, dry_spell

LAT, LNG = 49.1427, 9.2186
CELL = h3.latlng_to_cell(LAT, LNG, 9)
TODAY = date(2026, 7, 20)


def test_daily_precipitation_and_dry_spell():
    weather = [{"timestamp": "2026-07-14T10:00:00+02:00", "precipitation": 3.0},
               {"timestamp": "2026-07-15T10:00:00+02:00", "precipitation": 0.4},
               {"timestamp": "2026-07-15T11:00:00+02:00", "precipitation": 0.4}]
    days = daily_precipitation(weather)
    assert days == {"2026-07-14": 3.0, "2026-07-15": 0.8}
    days.update({d: 0.0 for d in ("2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19", "2026-07-20")})
    days["2026-07-22"] = 5.0
    assert dry_spell(days, TODAY) == (5, "2026-07-22")  # 15..19 dry (0.8 mm < 1 mm), rain on the 22nd
    assert dry_spell({"2026-07-19": 2.0}, TODAY) == (0, None)


def layer_cell(heat=1.0, **facts):
    return {"h3": CELL, "scores": {"heat": heat, "green": 0.9}, "need": 0.9,
            "facts": {"distToGreenM": 400, "trees": 4, "sensitivePlaces": 3, **facts}}


def data(cells, segments=()):
    return {
        "layers": {"cells": cells},
        "points": {"bus_stops": [[LAT, LNG, "Rathaus"]], "schools": [[LAT, LNG, "Dammschule"]],
                   "kindergartens": [], "trees": []},
        "residential": {"type": "FeatureCollection",
                        "features": [{"type": "Feature", "properties": {}, "geometry": mapping(cell_polygon(CELL))}]},
        "segments": list(segments),
        "station_dist": lambda lat, lng: 2000.0,
    }


def by_type(missions):
    return {m["type"]: m for m in missions}


def test_hot_dense_cell_triggers_all_cell_rules():
    dry_days = {f"2026-07-{d:02d}": 0.0 for d in range(10, 20)}
    missions, info = build(data([layer_cell()]), TODAY, dry_days)
    m = by_type(missions)
    assert set(m) == {"water_trees", "shade_bus_stop", "green_schoolyard", "pollinator_gap", "unseal_10m2", "host_sensor"}
    assert m["shade_bus_stop"]["title"] == "Schatten für die Haltestelle Rathaus"
    assert m["shade_bus_stop"]["placeName"] == "Rathaus"
    assert m["green_schoolyard"]["placeName"] == "Dammschule"
    assert m["water_trees"]["reason"]["evidence"]["dryDays"] == 10
    assert m["host_sensor"]["reason"]["evidence"]["stationDistM"] == 2000
    assert m["unseal_10m2"]["placeName"] == "Nähe Haltestelle Rathaus"
    assert all(x["source"] == "pipeline" and "simulated" not in x and x["urgency"] == 3 for x in missions)
    assert info["dryDays"] == 10


def test_cool_cell_without_weather_triggers_nothing_hot():
    missions, info = build(data([layer_cell(heat=0.3, distToGreenM=50, sensitivePlaces=1)]), TODAY, None)
    assert missions == [] and info["dryDays"] is None


def test_bike_rule_and_ranking():
    def seg(i, under, n, name=None):
        return {"id": i, "name": name, "coords": [[LNG, LAT], [LNG + 0.002, LAT]], "avgCm": 90.0,
                "under150Pct": under, "n": n}
    segments = [seg(1, 100, 10, "A-Str"), seg(2, 100, 40, "A-Str"), seg(3, 59, 50, "B-Str"),
                seg(4, 90, 9, "C-Str"), seg(5, 80, 12, "D-Str")]
    missions, _ = build(data([], segments), TODAY, None)
    bike = [m for m in missions if m["type"] == "safer_bike_street"]
    assert [m["id"] for m in bike] == ["safer_bike_street-seg2", "safer_bike_street-seg5"]  # one per street
    assert [m["urgency"] for m in bike] == [3, 2]
    assert bike[0]["reason"]["evidence"]["overtakings"] == 40
