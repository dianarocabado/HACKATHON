# data/

- `raw/` — cached API and Overpass downloads. Git-ignored; regenerate with the scripts in `pipeline/`.
- `processed/` — pipeline output (`stations.json`, `stations/{id}.json`, `layers.json`, `missions.json`,
  `evidence.json`). Committed. Copied to `web/public/data/` by `npm run sync-data` (A7).

Owner: Agent A.
