# Sample data

Fake but realistic data in the exact shapes of `contracts/types.ts`, so the UI can be built before the pipeline
and API exist. Everything here is invented: missions carry `simulated: true`, reports carry `seeded: true`.
Place names are real Heilbronn locations, coordinates are approximate, hexagons are real H3 res-9 cells.

| File | Type | Real counterpart |
| --- | --- | --- |
| `layers.json` | `LayersFile` (271 cells around the centre) | `web/public/data/layers.json` |
| `stations.json` | `Station[]` (6) | `web/public/data/stations.json` |
| `stations/{id}.json` | `HourlyPoint[]` (last 48 h) | `web/public/data/stations/{id}.json` |
| `missions.json` | `Mission[]` (one per type) | `web/public/data/missions.json` |
| `api/missions.json` | `MissionWithState[]` | `GET /api/missions` |
| `api/reports.json` | `Report[]` (incl. one dialect sentence) | `GET /api/reports` |

Regenerate (deterministic): `pip install h3 && python contracts/samples/generate.py contracts/samples`

Used by `web/lib/client/api.ts` when `NEXT_PUBLIC_USE_MOCK` is not `false`. That file imports
`@contracts/*`, so the Next.js scaffold (A0) needs a tsconfig path `"@contracts/*": ["../contracts/*"]`,
`resolveJsonModule`, and imports from outside `web/` allowed (`experimental.externalDir` or Turbopack `root: '..'`).
