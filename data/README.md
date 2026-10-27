# data/

- `raw/` — cached API and Overpass downloads. Git-ignored; regenerate with the scripts in `pipeline/`.
- `processed/` — pipeline output (`stations.json`, `stations/{id}.json`, `layers.json`, `missions.json`,
  `evidence.json`). Committed. Copied to `web/public/data/` (git-ignored) by `npm run sync-data`,
  which also runs automatically before `npm run dev` and `npm run build`. The app fetches `/data/<file>`.

Owner: Agent A.
