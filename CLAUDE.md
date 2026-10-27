# Heilbronn wirkt — rules for Claude Code

## What we build
A web app that turns Heilbronn's real sensor data into local missions, lets people report problems by voice,
and shows whether help made a difference. Full guide: the team's "Heilbronn wirkt – Build Guide" doc.
Task plan: TASKS.md. Shared types: contracts/types.ts.

## Who you are
The human tells you at session start: Agent A (data and backend) or Agent B (interface and voice).

## Ownership — never edit outside your folders
- Agent A: pipeline/, data/, web/app/api/, web/lib/server/, web/scripts/
- Agent B: web/app/ (except api/), web/components/, web/lib/client/, web/styles/, web/DESIGN.md, contracts/samples/
- Shared and frozen after Phase 0: contracts/types.ts. Only additive optional fields, commit prefix `contract:`,
  and tell the humans. Never rename or remove a field.
- Need something in the other agent's folder? Open a GitHub issue with their label. Do not edit it yourself.

## Workflow
- Source of truth for tasks: GitHub Issues (labels agent-a, agent-b, human). TASKS.md is the plan.
- Before each task: `git checkout main && git pull`. One branch per task: a/<ID>-<slug> or b/<ID>-<slug>.
- Keep PRs small (under ~400 changed lines). Rebase on main before opening. Merge only if `npm run build` and lint pass
  (and `python -m pytest pipeline` for pipeline changes).
- Semantic commits: feat:, fix:, data:, contract:, chore:, docs:.
- Comment on the issue when you start and when you finish; close it in the PR ("Closes #12").

## Non-negotiables
- Every number on screen comes from data/processed or the API. Anything invented is marked `simulated: true`
  and shown with a "simulated" badge.
- Every external call (LLM, APIs, Supabase) has an 8-second timeout and a fallback. The demo must never hang.
- Never commit secrets (.env) or data/raw/.
- Code and comments in English. Interface German by default, English toggle.
- Do not add new dependencies without a reason in the PR description.

## Key data facts (verified 27 Oct 2026)
- senseBox:home Heilbronn: GET https://api.atrai.bike/collections/osem_home_data_heilbronn/items?f=json&limit=..&offset=..
  ~2.0 million point features at ~10 s intervals. Properties include boxId, boxName, createdAt, Temperature,
  "Rel. Humidity", Pressure, "Finedust PM1", "Finedust PM2.5", "Finedust PM4", "Finedust PM10".
  Aggregate to hourly per station before anything else. Check whether a `datetime` filter is supported.
- senseBox:bike (ATRAI): base https://api.atrai.bike, collections overtaking_distance_heilbronn (~1,300 LineStrings,
  "Average Overtaking Distance cm", histogram "Overtaking Distance Counts"), danger_zones_heilbronn (~6,500 points,
  "Risk Index" 0..1), danger_zones_PM_heilbronn. `limit=0` returns all. Verify exact field spellings in responses.
  Campaign: 2,281 rides, 5,205 km, 32 riders, Dec 2025 – Oct 2026.
- Legal minimum overtaking distance in towns: 150 cm. Humidity above 75% invalidates low-cost PM readings.
- Weather: Bright Sky (https://brightsky.dev/), DWD data, no key.
- OpenStreetMap via Overpass: cache once to data/raw, commit only processed output.

## Definition of done for a task
Builds, works with sample data and with real data if available, PR description says what changed and how to test,
issue closed.
