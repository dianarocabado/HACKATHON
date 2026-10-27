from datetime import datetime, timedelta, timezone

import h3

from pipeline.parse_heat_walk import anomalies, interpolate, per_cell

T0 = datetime(2026, 9, 2, 8, 0, tzinfo=timezone.utc)
REF = [(T0, 20.0), (T0 + timedelta(hours=1), 22.0)]


def test_interpolate_and_clamp_to_ends():
    assert interpolate(REF, T0 + timedelta(minutes=30)) == 21.0
    assert interpolate(REF, T0 - timedelta(hours=1)) == 20.0
    assert interpolate(REF, T0 + timedelta(hours=3)) == 22.0


def test_anomalies_remove_warmup_standing_trend_and_device_offset():
    rows = []
    for i in range(0, 600):
        t = T0 + timedelta(seconds=i)
        # device reads 3 °C too warm; temperature follows the reference trend; second half is 1 °C warmer
        temp = interpolate(REF, t) + 3.0 + (1.0 if i >= 300 else 0.0)
        rows.append((t, 49.14, 9.22 if i < 300 else 9.25, temp, 1.0, "rec"))
    rows.append((T0 + timedelta(seconds=200), 49.14, 9.22, 99.0, 0.0, "rec"))  # standing: dropped
    pts = anomalies(rows, REF)
    assert len(pts) == 600 - 120  # warm-up dropped
    first = [a for lat, lng, a, _ in pts if lng == 9.22]
    second = [a for lat, lng, a, _ in pts if lng == 9.25]
    assert abs(sum(second) / len(second) - sum(first) / len(first) - 1.0) < 1e-6


def test_per_cell_needs_30_readings():
    pts = [(49.14, 9.22, 0.5, "a")] * 30 + [(49.20, 9.30, 2.0, "b")] * 29
    cells = per_cell(pts)
    assert cells == {h3.latlng_to_cell(49.14, 9.22, 9): {"anomalyC": 0.5, "n": 30, "recordings": 1}}
