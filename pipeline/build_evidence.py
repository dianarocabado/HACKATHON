"""A13: impact evidence from real data → evidence.json (EvidenceFile in contracts/types.ts).

Every item is computed from committed data; nothing is simulated. Inconclusive results are kept
(conclusive: false) instead of being dropped.

  uhi_night / uhi_afternoon  Innenstadt vs. THW (edge of town), identical summer hours, per-day means
  uhi_same_hardware          Innenstadt vs. GreenCity OpenSpace, both senseBox:home
  tropical_nights            nights with minimum >= 20 °C, same nights at both stations
  heat_walk_canopy           heat-walk readings near canopy green vs. sealed, per walk (A4 method)
  overtaking_under_150       share of all measured overtakings closer than 150 cm (senseBox:bike)
Intervals: 95 % bootstrap over days (stations) or walks (heat walk), 2,000 resamples, fixed seed.
Hours are UTC; summer local time is UTC+2.
"""

import json
import random
import statistics
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from shapely import STRtree
from shapely.geometry import Point, shape

from pipeline.build_layers import project, to_m
from pipeline.common import PROCESSED_DIR
from pipeline.parse_heat_walk import anomalies, fetch_reference, load_walk

INNENSTADT = "69bd6ceb867a8a00078d3c3f"
THW = "68db27a2ab896a0008a5109a"
OPENSPACE = "69b99dd4deee28000952cea8"
SUMMER = ("06", "07", "08")
AFTERNOON_UTC = range(12, 16)            # 14–17 local
NIGHT_UTC = (21, 22, 23, 0, 1, 2, 3)     # 23–05 local
CANOPY = {"wood", "forest", "park", "garden", "cemetery"}
STATION_SOURCE = "senseBox:home Heilbronn (openSenseMap via ATRAI), Juni–August 2026"


def load(name):
    return json.loads((PROCESSED_DIR / name).read_text(encoding="utf-8"))


def bootstrap_ci(values, seed=1, resamples=2000):
    rnd = random.Random(seed)
    means = sorted(statistics.mean(rnd.choices(values, k=len(values))) for _ in range(resamples))
    return [round(means[int(0.025 * resamples)], 2), round(means[int(0.975 * resamples) - 1], 2)]


def paired_daily_diffs(a, b, hours, months=SUMMER):
    """{t: °C} x2 → per-day mean of (a - b) over hours present at both stations."""
    days = defaultdict(list)
    for t, va in a.items():
        if t in b and t[5:7] in months and int(t[11:13]) in hours:
            days[t[:10]].append(va - b[t])
    return [statistics.mean(v) for _, v in sorted(days.items())]


def night_minima(series, months=SUMMER, min_hours=8):
    """Minimum temperature per night (18–06 UTC, keyed by the evening's date)."""
    nights = defaultdict(list)
    for t, v in series.items():
        dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
        if dt.hour >= 18:
            nights[dt.date()].append(v)
        elif dt.hour < 6:
            nights[dt.date() - timedelta(days=1)].append(v)
    return {d: min(v) for d, v in nights.items() if len(v) >= min_hours and f"{d.month:02d}" in months}


def fmt(x, digits=1):
    """German number without sign (the sentence says warmer/cooler)."""
    return f"{abs(x):.{digits}f}".replace(".", ",")


def warmer(x):
    return "wärmer" if x >= 0 else "kühler"


def fmt_en(x, digits=1):
    """English number without sign."""
    return f"{abs(x):.{digits}f}"


def warmer_en(x):
    return "warmer" if x >= 0 else "cooler"


STATION_SOURCE_EN = "senseBox:home Heilbronn (openSenseMap via ATRAI), June–August 2026"
THW_CAVEAT_EN = ("THW is a different weather station than the senseBox in the city centre; part of the difference "
                 "may come from the hardware.")


def station_items(history, names):
    items = []
    inn, thw, osp = history[INNENSTADT], history[THW], history[OPENSPACE]
    for key, hours, label, label_en in (("uhi_night", NIGHT_UTC, "nachts", "at night"),
                                        ("uhi_afternoon", AFTERNOON_UTC, "nachmittags", "in the afternoon")):
        d = paired_daily_diffs(inn, thw, hours)
        mean = round(statistics.mean(d), 2)
        night = key == "uhi_night"
        items.append({
            "id": key,
            "title": f"Innenstadt {label} wärmer",
            "finding": f"Im Sommer war es in der Innenstadt {label} im Schnitt {fmt(mean)} °C {warmer(mean)} als am "
                       f"Stadtrand (THW), zur selben Stunde gemessen.",
            "value": mean, "unit": "°C", "ci95": bootstrap_ci(d), "n": len(d),
            "nLabel": "Sommernächte" if key == "uhi_night" else "Sommertage", "conclusive": True,
            "compare": [{"label": names[INNENSTADT], "value": round(statistics.mean(
                            v for t, v in inn.items() if t in thw and t[5:7] in SUMMER and int(t[11:13]) in hours), 1)},
                        {"label": names[THW], "value": round(statistics.mean(
                            v for t, v in thw.items() if t in inn and t[5:7] in SUMMER and int(t[11:13]) in hours), 1)}],
            "source": STATION_SOURCE,
            "method": "Differenz zur selben Stunde, Tagesmittel, 95-%-Bootstrap über Tage",
            "caveat": "THW ist eine andere Wetterstation als die senseBox in der Innenstadt; ein Teil der "
                      "Differenz kann an der Hardware liegen.",
            "en": {
                "title": f"City centre warmer {label_en}",
                "finding": f"In summer the city centre was on average {fmt_en(mean)} °C {warmer_en(mean)} {label_en} "
                           f"than the edge of town (THW), measured at the same hour.",
                "unit": "°C", "nLabel": "summer nights" if night else "summer days",
                "source": STATION_SOURCE_EN,
                "method": "Difference at the same hour, daily means, 95 % bootstrap over days",
                "caveat": THW_CAVEAT_EN,
            },
        })

    d = paired_daily_diffs(inn, osp, AFTERNOON_UTC)
    mean = round(statistics.mean(d), 2)
    ci = bootstrap_ci(d)
    items.append({
        "id": "uhi_same_hardware",
        "title": "Innenstadt vs. OpenSpace (gleiche senseBox)",
        "finding": f"Mit baugleichen Sensoren war die Innenstadt an Sommernachmittagen {fmt(mean)} °C {warmer(mean)} "
                   f"als der OpenSpace.",
        "value": mean, "unit": "°C", "ci95": ci, "n": len(d), "nLabel": "Sommertage", "conclusive": ci[0] > 0,
        "source": STATION_SOURCE, "method": "wie oben, beide Stationen senseBox:home",
        "en": {
            "title": "City centre vs. OpenSpace (same senseBox)",
            "finding": f"With identical sensors, the city centre was {fmt_en(mean)} °C {warmer_en(mean)} than the "
                       f"OpenSpace on summer afternoons.",
            "unit": "°C", "nLabel": "summer days", "source": STATION_SOURCE_EN,
            "method": "as above, both stations senseBox:home",
        },
    })

    ni, nt = night_minima(inn), night_minima(thw)
    common = sorted(set(ni) & set(nt))
    ti, tt = sum(ni[d] >= 20 for d in common), sum(nt[d] >= 20 for d in common)
    items.append({
        "id": "tropical_nights",
        "title": "Tropennächte",
        "finding": f"In {len(common)} Sommernächten mit Daten an beiden Stationen fiel die Temperatur in der Innenstadt "
                   f"{ti}-mal nicht unter 20 °C, am Stadtrand nur {tt}-mal.",
        "value": ti, "unit": "Nächte", "n": len(common), "nLabel": "Sommernächte", "conclusive": ti > tt,
        "compare": [{"label": names[INNENSTADT], "value": ti}, {"label": names[THW], "value": tt}],
        "source": STATION_SOURCE, "method": "Nachtminimum 20–8 Uhr Ortszeit ≥ 20 °C, nur gemeinsame Nächte",
        "caveat": "Andere Hardware am Stadtrand (siehe oben).",
        "en": {
            "title": "Tropical nights",
            "finding": f"In {len(common)} summer nights with data at both stations, the temperature in the city centre "
                       f"stayed at or above 20 °C {ti} times, at the edge of town only {tt} times.",
            "unit": "nights", "nLabel": "summer nights", "source": STATION_SOURCE_EN,
            "method": "Night minimum 8 pm–8 am local time ≥ 20 °C, shared nights only",
            "caveat": "Different hardware at the edge of town (see above).",
        },
    })
    return items


def heat_walk_item():
    rows = load_walk()
    ref = fetch_reference(min(r[0] for r in rows).date(), max(r[0] for r in rows).date())
    pts = anomalies(rows, ref)
    canopy = [project(shape(f["geometry"])) for f in load("green_areas.geojson")["features"]
              if f["properties"]["kind"] in CANOPY]
    tree, cache = STRtree(canopy), {}

    def share(x, y):
        key = (round(x / 10), round(y / 10))
        if key not in cache:
            buf = Point(x, y).buffer(50, 16)
            cache[key] = min(1.0, sum(buf.intersection(tree.geometries[i]).area
                                      for i in tree.query(buf, predicate="intersects")) / buf.area)
        return cache[key]

    walks = defaultdict(lambda: ([], []))
    for lat, lng, a, rec in pts:
        g = share(*to_m(lng, lat))
        if g >= 0.2:
            walks[rec][0].append(a)
        elif g < 0.05:
            walks[rec][1].append(a)
    diffs = [statistics.mean(x) - statistics.mean(y) for x, y in walks.values() if len(x) >= 60 and len(y) >= 60]
    mean, ci = round(statistics.mean(diffs), 2), bootstrap_ci(diffs)
    conclusive = ci[1] < 0 or ci[0] > 0
    return {
        "id": "heat_walk_canopy",
        "title": "Hitzespaziergang: Schatten-Grün vs. versiegelt",
        "finding": (f"Auf den Hitzespaziergängen im September (vormittags) war es neben Wald, Parks und Friedhöfen "
                    f"im Schnitt {fmt(mean)} °C {warmer(mean)} als auf versiegelten Strecken – ein klarer Kühleffekt "
                    f"war zu dieser Tageszeit nicht messbar.") if not conclusive else
                   (f"Auf den Hitzespaziergängen war es neben Wald, Parks und Friedhöfen im Schnitt {fmt(mean)} °C "
                    f"{warmer(mean)} als auf versiegelten Strecken."),
        "value": mean, "unit": "°C", "ci95": ci, "n": len(diffs), "nLabel": "Spaziergänge",
        "conclusive": conclusive,
        "source": "Green City Heilbronn Summerschool, Hitzespaziergänge 1.–3. September 2026",
        "method": "Abweichung vom Rest des Spaziergangs (A4); Grünanteil Wald/Park/Garten/Friedhof im 50-m-Radius "
                  "≥ 20 % vs. < 5 %; Vergleich innerhalb jedes Spaziergangs, 95-%-Bootstrap über Spaziergänge",
        "caveat": "Messungen zwischen 10:30 und 14 Uhr; Hitzeinseln sind nachmittags und nachts am stärksten. "
                  "Nächster Spaziergang am späten Nachmittag.",
        "en": {
            "title": "Heat walk: shady green vs. sealed",
            "finding": (f"On the heat walks in September (mornings), it was on average {fmt_en(mean)} °C "
                        f"{warmer_en(mean)} next to woods, parks and cemeteries than on sealed stretches – no clear "
                        f"cooling effect was measurable at that time of day.") if not conclusive else
                       (f"On the heat walks it was on average {fmt_en(mean)} °C {warmer_en(mean)} next to woods, "
                        f"parks and cemeteries than on sealed stretches."),
            "unit": "°C", "nLabel": "walks",
            "source": "Green City Heilbronn Summer School, heat walks 1–3 September 2026",
            "method": "Deviation from the rest of the walk (A4); share of wood/park/garden/cemetery green within 50 m "
                      "≥ 20 % vs. < 5 %; compared within each walk, 95 % bootstrap over walks",
            "caveat": "Measured between 10:30 am and 2 pm; heat islands are strongest in the afternoon and at night. "
                      "Next walk: late afternoon.",
        },
    }


def overtaking_item(segments):
    under = sum(s["under150Pct"] / 100 * s["n"] for s in segments)
    total = sum(s["n"] for s in segments)
    pct = round(100 * under / total, 1)
    return {
        "id": "overtaking_under_150",
        "title": "Zu enges Überholen",
        "finding": f"{pct:.0f} % von {total:,} gemessenen Überholvorgängen waren enger als die erlaubten 150 cm."
                   .replace(",", "."),
        "value": pct, "unit": "%", "n": total, "nLabel": "Überholvorgänge", "conclusive": True,
        "source": "senseBox:bike Heilbronn (ATRAI), Dez 2025 – Okt 2026",
        "method": "Summe der Histogramme aller Straßenabschnitte, Klassen 0–150 cm",
        "caveat": "Gemessen auf den Strecken der Teilnehmenden, nicht flächendeckend.",
        "en": {
            "title": "Overtaking too closely",
            "finding": f"{pct:.0f}% of {total:,} measured overtakings were closer than the legal 150 cm.",
            "unit": "%", "nLabel": "overtakings",
            "source": "senseBox:bike Heilbronn (ATRAI), Dec 2025 – Oct 2026",
            "method": "Sum of the histograms of all street segments, bins 0–150 cm",
            "caveat": "Measured on the participants' routes, not citywide.",
        },
    }


def build(history, names, segments, walk_item):
    items = station_items(history, names)
    if walk_item:
        items.append(walk_item)
    items.append(overtaking_item(segments))
    return {"generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "items": items}


def main():
    stations = load("stations.json")
    names = {s["id"]: s["name"] for s in stations}
    history = {i: {p["t"]: p["temperatureC"] for p in load(f"stations/{i}.json") if "temperatureC" in p}
               for i in (INNENSTADT, THW, OPENSPACE)}
    evidence = build(history, names, load("bike_segments.json"), heat_walk_item())
    (PROCESSED_DIR / "evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=1), encoding="utf-8")
    for item in evidence["items"]:
        ci = f" [{item['ci95'][0]:+.2f}, {item['ci95'][1]:+.2f}]" if "ci95" in item else ""
        print(f"{item['id']:22} {item['value']}{ci} {item['unit']} (n={item['n']}, conclusive={item['conclusive']})")


if __name__ == "__main__":
    main()
