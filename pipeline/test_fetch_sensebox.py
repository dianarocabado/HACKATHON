from collections import defaultdict

from pipeline.fetch_sensebox import add_features, build_outputs, new_station


def feature(box="b1", ts="2026-09-10T11:57:19.903", temp=20.0, hum=50.0, pm25=5.0, pm10=8.0):
    return {"properties": {"boxId": box, "boxName": f"Box {box}", "createdAt": ts,
                           "latitude": 49.15, "longitude": 9.22, "Temperature": temp,
                           "Rel. Humidity": hum, "Finedust PM2.5": pm25, "Finedust PM10": pm10}}


def run(features):
    stations = defaultdict(new_station)
    add_features(stations, features)
    return build_outputs(stations)


def test_averages_readings_within_an_hour():
    _, series = run([feature(temp=20.0), feature(ts="2026-09-10T11:10:00", temp=22.0)])
    assert series["b1"] == [{"t": "2026-09-10T11:00:00Z", "temperatureC": 21.0,
                             "humidityPct": 50.0, "pm25": 5.0, "pm10": 8.0}]


def test_separate_hours_are_sorted():
    _, series = run([feature(ts="2026-09-10T13:00:00"), feature(ts="2026-09-10T12:00:00")])
    assert [p["t"] for p in series["b1"]] == ["2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z"]


def test_pm_dropped_when_humid_but_temperature_kept():
    _, series = run([feature(hum=80.0)])
    pt = series["b1"][0]
    assert "pm25" not in pt and "pm10" not in pt
    assert pt["temperatureC"] == 20.0


def test_out_of_range_and_missing_values_ignored():
    _, series = run([feature(temp=999.0, pm25=None)])
    pt = series["b1"][0]
    assert "temperatureC" not in pt and "pm25" not in pt and pt["pm10"] == 8.0


def test_station_uses_newest_metadata_and_latest_values():
    stations, _ = run([feature(ts="2026-09-10T11:00:00", temp=18.0),
                       feature(ts="2026-09-11T09:30:00", temp=25.0)])
    s = stations[0]
    assert s["id"] == "b1" and s["name"] == "Box b1"
    assert s["lastSeen"] == "2026-09-11T09:30:00Z"
    assert s["latest"]["temperatureC"] == 25.0


def test_rows_without_box_or_time_skipped():
    stations, _ = run([{"properties": {"Temperature": 20}}, {"properties": None}])
    assert stations == []
