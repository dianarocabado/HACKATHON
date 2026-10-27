from shapely.geometry import Polygon, shape

from pipeline.fetch_osm import clip_points, clip_polygons, green_kind, is_city_boundary, point_category

SQUARE = Polygon([(9.0, 49.0), (9.1, 49.0), (9.1, 49.1), (9.0, 49.1)])


def test_point_categories():
    assert point_category({"natural": "tree"}) == "trees"
    assert point_category({"highway": "bus_stop", "name": "Rathaus"}) == "bus_stops"
    assert point_category({"amenity": "kindergarten"}) == "kindergartens"
    assert point_category({"amenity": "social_facility", "social_facility": "assisted_living"}) == "care_homes"
    assert point_category({"leisure": "playground"}) == "playgrounds"
    assert point_category({"amenity": "cafe"}) is None


def test_green_kind_and_boundary():
    assert green_kind({"leisure": "park"}) == "park"
    assert green_kind({"landuse": "allotments"}) == "allotments"
    assert green_kind({"landuse": "industrial"}) is None
    assert is_city_boundary({"boundary": "administrative", "admin_level": "6", "name": "Heilbronn"})
    assert not is_city_boundary({"boundary": "administrative", "admin_level": "6", "name": "Landkreis Heilbronn"})


def test_clip_points_keeps_inside_and_drops_tree_names():
    points = {"trees": [(9.05, 49.05, "Eiche")], "schools": [(9.05, 49.05, "Grundschule"), (9.5, 49.5, "Outside")]}
    assert clip_points(points, SQUARE) == {"trees": [[49.05, 9.05]], "schools": [[49.05, 9.05, "Grundschule"]]}


def test_clip_polygons_clips_to_boundary_and_stays_valid():
    half_outside = Polygon([(9.05, 49.05), (9.2, 49.05), (9.2, 49.08), (9.05, 49.08)])
    far_away = Polygon([(10, 50), (10.1, 50), (10.1, 50.1)])
    fc = clip_polygons([({"kind": "park"}, half_outside), ({"kind": "wood"}, far_away)], SQUARE)
    assert len(fc["features"]) == 1
    geom = shape(fc["features"][0]["geometry"])
    assert geom.is_valid and geom.bounds[2] <= 9.1 + 1e-9
    assert fc["features"][0]["properties"] == {"kind": "park"}
