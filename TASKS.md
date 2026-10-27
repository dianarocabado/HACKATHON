# Heilbronn wirkt — task plan

GitHub Issues are the live board (labels: `agent-a`, `agent-b`, `human`). This file is the plan they are created from.
"Needs" = what must be merged first. Phases: 0 Setup (Tue 15:30–17:00) · 1 Foundations (Tue 17:00–23:00) ·
2 Core build (Wed 09:00–16:00) · 3 Integration (Wed 16:00–23:00) · 4 Pitch (Thu from 08:00, feature freeze 10:00).
Adjust times to the official schedule.

## Agent A — data and backend

| ID | Task | Phase | Needs |
| --- | --- | --- | --- |
| A0 | Scaffold repo (folders, Next.js in `web/`, `pipeline/requirements.txt`, `.env.example`, `.gitignore`), add `contracts/types.ts`, CLAUDE.md, TASKS.md | 0 | – |
| A1 | `pipeline/fetch_sensebox.py`: page through senseBox:home API (try a `datetime` filter), aggregate hourly per station → `stations.json`, `stations/{id}.json` | 1 | A0 |
| A2 | `pipeline/fetch_bike.py`: overtaking segments, danger zones, danger zones with PM → bike layer input | 1 | A0 |
| A3 | `pipeline/fetch_osm.py`: Heilbronn boundary, green areas, trees, bus stops, schools, kindergartens, care homes, playgrounds (Overpass, cached) | 1 | A0 |
| A4 | Parse heat-island walk data (format from mentors), map points to hexagons | 1 | H1 |
| A5 | `pipeline/build_layers.py`: H3 res-9 grid over Heilbronn, five layer scores, need score, plain-language facts → `layers.json` | 2 | A1–A4 |
| A6 | `pipeline/build_missions.py`: mission rules + Bright Sky dry days → `missions.json` | 2 | A5 |
| A7 | `npm run sync-data`: copy `data/processed/*` to `web/public/data/` | 1 | A0 |
| A8 | `web/lib/server/store.ts`: memory store + Supabase store; SQL for `reports`, `mission_states` | 1 | A0 |
| A9 | `web/lib/server/llm.ts`: transcript → `StructuredReport` (JSON schema), keyword fallback, test set of 15 German sentences incl. dialect | 1 | A0 |
| A10 | `web/lib/server/sensors.ts` + `GET /api/sensor-check`: nearest station, value, confirmed or not | 2 | A1 |
| A11 | API routes: reports (POST/GET), missions (GET, claim, support, done with baseline) | 2 | A8–A10 |
| A12 | Reports → missions: 3+ reports of one category in a hexagon without a mission create one | 3 | A11 |
| A13 | Impact evidence from real data (e.g. shaded vs. unshaded walk points) → `evidence.json` | 3 | A4 |
| A14 | Deploy to Vercel, Supabase project, environment variables | 2 | A8 |
| A15 | Demo seed: ~20 realistic reports (`seeded: true`) + reset script | 4 | A11 |

## Agent B — interface and voice

| ID | Task | Phase | Needs |
| --- | --- | --- | --- |
| B0 | `web/DESIGN.md` (colours, type, components, screen sketches) + `contracts/samples/*.json` with realistic Heilbronn coordinates + mock API client | 0 | A0 |
| B1 | Map page: MapLibre basemap, hexagon layer coloured by need, layer toggles, legend, "no data" pattern | 1 | B0 |
| B2 | Hexagon panel: facts in plain words ("Afternoons here average 33 °C, 2.1 °C above the city median") | 1 | B1 |
| B3 | Missions list (filters: topic, who, effort) + mission detail with "why this mission", claim, support | 2 | B0 |
| B4 | Report flow: big mic, live transcript (Web Speech API, de-DE), location from QR/GPS/map tap, typed fallback, result card with sensor check + thank-you | 2 | B0 |
| B5 | Big-screen mode `/screen`: full-screen map, new reports pulse in live, counters, QR code on screen | 3 | B1, A11 |
| B6 | `/qr`: printable QR posters for the demo places | 3 | H3 |
| B7 | Impact view: before/after chart, evidence card, "simulated" badge | 3 | A13 |
| B8 | Mobile polish, accessibility, German/English text | 4 | all B |
| B9 | Landing screen: the idea in one sentence + three steps | 4 | – |

## Humans

| ID | Task | When |
| --- | --- | --- |
| H1 | Ask mentors: heat-walk data format, LLM/speech API credits, schedule + pitch format, heavy-rain hazard map | Today |
| H2 | Sanity-check scores against known places, tune thresholds | Phase 2 |
| H3 | Pick 3 demo places near Open Space (bus stop, school, street), note coordinates | Phase 1 |
| H4 | Pitch + slides, rehearse 3×, record backup video | Phase 3–4 |
| H5 | Test voice on iPhone Safari + Android Chrome with real and dialect sentences | Phase 3 |
| H6 | Optional: senseBox button box ("Too hot here?") posting to `/api/reports` | Phase 3 |

Cut order if time runs short: H6, B7, A13, A12, English toggle.

## Mission rules (starting thresholds, tune in Phase 2)

| Mission | Created when |
| --- | --- |
| water_trees | 5+ days without rain and street trees in a hexagon with heat ≥ 0.5 (expires when it rains) |
| shade_bus_stop | heat ≥ 0.7 and a bus stop in the hexagon |
| green_schoolyard | heat ≥ 0.6 and a school or kindergarten |
| pollinator_gap | no green area within ~300 m in a residential area |
| unseal_10m2 | heat ≥ 0.6 and no green within 150 m |
| safer_bike_street | ≥ 30% of overtakings under 150 cm on a segment |
| host_sensor | no sensor within 500 m and sensitive places nearby |
| check_reports | 3+ voice reports in a hexagon with no sensor |

## Kickoff prompts

Agent A:
```
You are Agent A (data and backend) for Heilbronn wirkt. Read CLAUDE.md, TASKS.md and contracts/types.ts first.
Work only in your owned folders. Take open issues labelled agent-a in task-ID order, respecting the "Needs" column.
For each task: branch a/<ID>-<slug>, implement, run checks, open a PR with gh, merge when checks pass, close the issue.
Start with A0. After A0 is merged, create GitHub issues for every task in TASKS.md if they do not exist yet.
```

Agent B:
```
You are Agent B (interface and voice) for Heilbronn wirkt. Read CLAUDE.md, TASKS.md, contracts/types.ts and web/DESIGN.md first.
Work only in your owned folders. Take open issues labelled agent-b in task-ID order, respecting the "Needs" column.
Until Agent A's real data and APIs are merged, build against contracts/samples and a mock API client that returns the same types.
For each task: branch b/<ID>-<slug>, implement, run checks, open a PR with gh, merge when checks pass, close the issue.
```
