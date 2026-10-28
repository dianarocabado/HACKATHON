import h3

from pipeline.fetch_bike import (build_bumpy_roads, build_danger_zones, build_pm_hex, build_segments,
                                 fix_mojibake, segment_name)


def segment(counts="0, 4, 7, 0, 0", avg=108.45, name="['Saarlandstraße', 'Peter-Bruckmann-Brücke']"):
    return {"geometry": {"type": "LineString", "coordinates": [[9.2021067, 49.1521243], [9.2022287, 49.1521142]]},
            "properties": {"id": 18, "name": name, "Overtaking Distance Counts": counts,
                           "Average Overtaking Distance cm": avg, "Number of Boxes": 1}}


def test_segment_under_150_share_uses_first_three_bins():
    [s] = build_segments([segment(counts="1, 2, 3, 4, 0")])
    assert s["n"] == 10 and s["under150Pct"] == 60.0


def test_segment_fields_rounded_and_named():
    [s] = build_segments([segment()])
    assert s["name"] == "Saarlandstraße / Peter-Bruckmann-Brücke"
    assert s["avgCm"] == 108.5 and s["coords"][0] == [9.202107, 49.152124]


def test_segment_without_overtakings_or_bad_histogram_skipped():
    assert build_segments([segment(counts="0, 0, 0, 0, 0"), segment(counts="n/a")]) == []


def test_segment_name_variants():
    assert segment_name("Allee") == "Allee"
    assert segment_name("['A', 'A', 'B']") == "A / B"
    assert segment_name(None) is None


def test_danger_zones():
    zones = build_danger_zones([{"properties": {"lat": 49.12027581, "lng": 9.18030141, "Risk Index Overtaking": 0.84075}},
                                {"properties": {"lat": 49.1, "lng": 9.2}}])
    assert zones == [{"lat": 49.120276, "lng": 9.180301, "risk": 0.841}]


def test_bumpy_roads_keep_roughness_and_repair_names():
    feats = [
        {"geometry": {"type": "LineString", "coordinates": [[9.2213487, 49.1495941], [9.2212358, 49.1495259]]},
         "properties": {"id": 6, "name": "SchaeuffelenstraÃŸe", "Normalized Roughness": 22.142857,
                        "Number of Boxes": 2}},
        {"geometry": {"type": "LineString", "coordinates": [[9.2, 49.1], [9.21, 49.1]]},
         "properties": {"id": 7, "name": "['NeckartalstraÃŸe', 'Neue StraÃŸe']",
                        "Normalized Roughness": 5, "Number of Boxes": None}},
        {"geometry": {"type": "Point", "coordinates": [9.2, 49.1]}, "properties": {"Normalized Roughness": 1}},
    ]
    a, b = build_bumpy_roads(feats)
    assert a == {"id": 6, "name": "Schaeuffelenstraße", "coords": [[9.221349, 49.149594], [9.221236, 49.149526]],
                 "roughness": 22.1, "boxes": 2}
    assert b["name"] == "Neckartalstraße / Neue Straße" and b["boxes"] == 1
    assert fix_mojibake("Allee") == "Allee" and fix_mojibake("Straße") == "Straße"


def test_pm_hex_averages_per_cell():
    pts = [{"properties": {"lat": 49.148798, "lng": 9.2172249, "Risk Index": r}} for r in (0.2, 0.4)]
    cell = h3.latlng_to_cell(49.148798, 9.2172249, 9)
    assert build_pm_hex(pts) == {cell: {"risk": 0.3, "n": 2}}
