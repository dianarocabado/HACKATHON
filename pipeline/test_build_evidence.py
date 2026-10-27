from datetime import date

from pipeline.build_evidence import (INNENSTADT, OPENSPACE, THW, bootstrap_ci, build, night_minima,
                                     overtaking_item, paired_daily_diffs)


def series(base, days=("2026-07-01", "2026-07-02", "2026-07-03"), night_offset=0.0):
    """Hourly values: base by day, base + 5 at 12–15 UTC; night hours get night_offset."""
    out = {}
    for d in days:
        for h in range(24):
            v = base + (5 if 12 <= h <= 15 else 0) + (night_offset if h >= 21 or h <= 3 else 0)
            out[f"{d}T{h:02d}:00:00Z"] = v
    return out


def test_paired_daily_diffs_only_uses_shared_summer_hours():
    a, b = series(22, night_offset=3), series(20)
    b.pop("2026-07-01T13:00:00Z")
    a["2026-10-01T13:00:00Z"] = 99  # not summer
    assert paired_daily_diffs(a, b, range(12, 16)) == [2.0, 2.0, 2.0]
    assert paired_daily_diffs(a, b, (21, 22, 23, 0, 1, 2, 3)) == [5.0, 5.0, 5.0]


def test_night_minima_keyed_by_evening_and_across_month_end():
    s = {"2026-06-30T20:00:00Z": 24.0, "2026-06-30T22:00:00Z": 22.0, "2026-07-01T02:00:00Z": 19.5,
         "2026-07-01T05:00:00Z": 21.0, "2026-07-01T12:00:00Z": 30.0}
    assert night_minima(s, min_hours=4) == {date(2026, 6, 30): 19.5}
    assert night_minima(s, min_hours=5) == {}


def test_bootstrap_ci_is_deterministic_and_brackets_mean():
    values = [1.0, 2.0, 3.0, 4.0, 5.0]
    ci = bootstrap_ci(values)
    assert ci == bootstrap_ci(values) and ci[0] <= 3.0 <= ci[1]


def test_overtaking_item_weights_by_segment_counts():
    item = overtaking_item([{"under150Pct": 100.0, "n": 30}, {"under150Pct": 0.0, "n": 10}])
    assert item["value"] == 75.0 and item["n"] == 40
    assert item["finding"].startswith("75 % von 40 ")


def test_build_station_items():
    history = {INNENSTADT: series(22, night_offset=3), THW: series(20), OPENSPACE: series(21)}
    names = {INNENSTADT: "Innenstadt", THW: "THW", OPENSPACE: "OpenSpace"}
    ev = build(history, names, [{"under150Pct": 50.0, "n": 2}], None)
    items = {i["id"]: i for i in ev["items"]}
    assert items["uhi_afternoon"]["value"] == 2.0 and items["uhi_night"]["value"] == 5.0
    assert "2,0 °C wärmer" in items["uhi_afternoon"]["finding"]
    assert items["uhi_same_hardware"]["value"] == 1.0
    assert set(items) == {"uhi_night", "uhi_afternoon", "uhi_same_hardware", "tropical_nights", "overtaking_under_150"}
    assert all({"id", "title", "finding", "value", "unit", "n", "nLabel", "conclusive", "source", "method"} <= set(i)
               for i in ev["items"])
