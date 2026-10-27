import assert from "node:assert/strict";
import { test } from "node:test";
import type { HourlyPoint, Mission, Station } from "@contracts/types";
import { ApiError } from "./http.ts";
import { baselineImpact, claimMission, doneMission, listMissions, supportMission, type MissionDeps } from "./missions.ts";
import { MemoryStore } from "./store.ts";

const NOW = Date.parse("2026-10-28T14:00:00Z");

const mission = (id: string, extra: Partial<Mission> = {}): Mission => ({
  id, type: "shade_bus_stop", title: "Schatten", description: "", h3: "891faa02adbffff",
  lat: 49.1426, lng: 9.2221, category: "heat", urgency: 2, effort: "project", suitedFor: ["city"],
  reason: { rule: "heat >= 0.7 and bus stop", evidence: { heat: 0.8 } }, source: "pipeline", ...extra,
});

const STATIONS: Station[] = [
  { id: "innenstadt", name: "Innenstadt", lat: 49.1425, lng: 9.222, lastSeen: "2026-10-27T23:00:00Z", latest: {} },
  { id: "thw", name: "THW", lat: 49.1623, lng: 9.2191, lastSeen: "2026-10-27T23:00:00Z", latest: {} },
];
const HISTORY: Record<string, HourlyPoint[]> = {
  innenstadt: [
    { t: "2026-10-10T12:00:00Z", temperatureC: 40 }, // outside the 7-day window
    { t: "2026-10-26T12:00:00Z", temperatureC: 22 },
    { t: "2026-10-27T12:00:00Z", temperatureC: 24 },
  ],
  thw: [{ t: "2026-10-27T12:00:00Z", temperatureC: 18 }],
};

function setup(missions: Mission[] = [mission("m1"), mission("m2", { category: "mobility" })]): MissionDeps {
  return {
    store: new MemoryStore(), missions, stations: STATIONS, outdoorIds: null, now: NOW,
    history: async (id) => HISTORY[id] ?? [],
  };
}

test("listMissions joins state and drops expired missions", async () => {
  const d = setup([mission("m1"), mission("old", { expiresAt: "2026-10-01T00:00:00Z" })]);
  await supportMission("m1", d);
  const list = await listMissions(d);
  assert.deepEqual(list.map((m) => [m.id, m.state.supporters, m.state.status]), [["m1", 1, "open"]]);
});

test("claim requires a name, works once, then 409", async () => {
  const d = setup();
  await assert.rejects(claimMission("m1", "  ", d), (e: ApiError) => e.status === 400);
  const s = await claimMission("m1", " Klasse 7b ", d);
  assert.deepEqual([s.status, s.claimedBy], ["claimed", "Klasse 7b"]);
  await assert.rejects(claimMission("m1", "Other", d), (e: ApiError) => e.status === 409);
});

test("unknown mission is 404", async () => {
  await assert.rejects(supportMission("nope", setup()), (e: ApiError) => e.status === 404);
});

test("support increments without changing status", async () => {
  const d = setup();
  await claimMission("m1", "Verein", d);
  await supportMission("m1", d);
  const s = await supportMission("m1", d);
  assert.deepEqual([s.supporters, s.status, s.claimedBy], [2, "claimed", "Verein"]);
});

test("done stores the 7-day baseline and cannot repeat", async () => {
  const d = setup();
  const s = await doneMission("m1", d);
  assert.equal(s.status, "done");
  assert.equal(s.doneAt, "2026-10-28T14:00:00.000Z");
  // nearest = innenstadt: mean(22, 24) = 23; city = mean(23, 18) = 20.5
  assert.deepEqual(s.impact, { metric: "temperatureC", stationId: "innenstadt", before: 23, cityBefore: 20.5 });
  await assert.rejects(doneMission("m1", d), (e: ApiError) => e.status === 409);
});

test("baseline is skipped for categories without a sensor and far-away missions", async () => {
  const d = setup();
  assert.equal(await baselineImpact(mission("x", { category: "mobility" }), d), undefined);
  assert.equal(await baselineImpact(mission("x", { lat: 49.3, lng: 9.5 }), d), undefined);
  const s = await doneMission("m2", d);
  assert.equal(s.impact, undefined);
});

test("baseline ignores stations that failed the outdoor check", async () => {
  // innenstadt treated as indoor: nearest valid station is thw (~2.2 km) -> too far, no baseline
  assert.equal(await baselineImpact(mission("x"), { ...setup(), outdoorIds: ["thw"] }), undefined);
  // thw treated as indoor: city mean is innenstadt alone
  const impact = await baselineImpact(mission("x"), { ...setup(), outdoorIds: ["innenstadt"] });
  assert.deepEqual([impact?.before, impact?.cityBefore], [23, 23]);
});

test("baseline of a simulated mission is marked simulated", async () => {
  const impact = await baselineImpact(mission("s", { simulated: true }), setup());
  assert.equal(impact?.simulated, true);
});
