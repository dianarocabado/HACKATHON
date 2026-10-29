# HN Reacts

**Heilbronn's sensor data, turned into missions neighbours can actually do.**

Live app: **https://heilbronn-wirkt.vercel.app** (works on any phone, no install, German and English)

Built at the TUM Green City Hackathon in Heilbronn, October 2026.

## What it does

People notice heat, unsafe traffic and missing green space every day but have nowhere to say it. Meanwhile the
city's sensor data sits in dashboards. HN Reacts connects the two:

- **Map:** Heilbronn as 1,011 hexagons, scored for heat, air quality, cycling safety, green space and bumpy paths.
  Tap an area to read plain sentences about it, each with its source (sensor, distance and measurement period).
- **Missions:** 48 concrete tasks generated from the data by transparent rules: shade a bus stop, green a
  schoolyard, plant a flower patch for bees, unseal 10 m², make a street safer for cycling, put up a sensor. People
  can take a mission on, support it or mark it done.
- **Voice reports:** say what's wrong (German, English or dialect). The app turns it into a structured report and
  checks it against the nearest senseBox. Three reports of the same problem in one area become a new mission.
- **Impact:** findings from the data, e.g. on summer nights the city centre was 3.3 °C warmer than the edge of town,
  and 80 % of 4,721 measured overtakings were closer than the legal 1.5 m.
- **Optional profile:** keep track of your reports and missions. Everything works without an account.

Every number on screen comes from open data; anything simulated for the demo is labelled as such.

## How it works

```
open data ──► pipeline/ (Python) ──► data/processed/*.json ──► web/ (Next.js) ◄──► Supabase
```

| Folder | Contents |
| --- | --- |
| [`pipeline/`](pipeline/) | Python scripts that fetch the open data and build the hexagon grid (`build_layers.py`), the missions (`build_missions.py`) and the Impact findings (`build_evidence.py`). |
| [`data/processed/`](data/processed/) | The pipeline's output, used by the app. |
| [`web/`](web/) | Next.js app: map (MapLibre + H3), missions, voice reports (browser speech recognition or Whisper, then an LLM with a keyword fallback), sensor check, accounts. |
| [`contracts/types.ts`](contracts/types.ts) | Data shapes shared by the pipeline and the app. |

## Run it locally

Requirements: Python 3.11+, Node.js 20+.

```bash
# Web app (uses the data already in data/processed/)
cd web
npm install
cp ../.env.example .env.local   # optional: add keys; without them the app runs offline with an in-memory store
npm run dev                     # http://localhost:3000
```

Rebuild the data (optional):

```bash
python -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt   # Windows: .venv\Scripts\pip
python -m pipeline.fetch_sensebox
python -m pipeline.fetch_bike
python -m pipeline.fetch_osm
python -m pipeline.parse_heat_walk
python -m pipeline.build_layers
python -m pipeline.build_missions
python -m pipeline.build_evidence
```

Tests: `python -m pytest pipeline` and, in `web/`, `npm test`. Deployment notes: [web/README.md](web/README.md).

## Data sources

- [openSenseMap](https://opensensemap.org) / senseBox:home stations in Heilbronn
- senseBox:bike rides (overtaking distance, danger zones, road roughness) via the [ATRAI API](https://api.atrai.bike)
- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the
  [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/)
- Weather: Deutscher Wetterdienst (DWD) via [Bright Sky](https://brightsky.dev)
- Heat-walk measurements provided by the Green City Hackathon

The data keeps the license of its source; the MIT license below covers the code.

## Team

Diana, Jonas, Sila

## License

[MIT](LICENSE)
