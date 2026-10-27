import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_REPORTS, resetDemo, seedDemo } from "./demo.ts";
import { listMissions } from "./missions.ts";
import { MemoryStore } from "./store.ts";

const NOW = Date.parse("2026-10-29T09:00:00Z");
const deps = (store = new MemoryStore()) => ({ store, env: {}, stations: [], live: async () => null, now: NOW });

test("seed creates every demo report, seeded, oldest first, within 2 days", async () => {
  const d = deps();
  const reports = await seedDemo(d);
  assert.equal(reports.length, DEMO_REPORTS.length);
  assert.ok(reports.length >= 20);
  assert.ok(reports.every((r) => r.seeded === true));
  const stored = await d.store.listReports();
  assert.equal(stored.length, reports.length);
  assert.ok(Date.parse(stored[0].createdAt) >= NOW - 2 * 24 * 3600_000);
  assert.ok(stored.every((r, i) => i === 0 || r.createdAt >= stored[i - 1].createdAt));
  const categories = new Set(reports.map((r) => r.category));
  for (const c of ["heat", "air", "noise", "water", "biodiversity", "waste", "mobility"]) assert.ok(categories.has(c as never), c);
});

test("the Allee cluster produces one simulated report mission", async () => {
  const d = deps();
  await seedDemo(d);
  const fromReports = (await listMissions({ ...d, missions: [], outdoorIds: null })).filter((m) => m.source === "report");
  assert.deepEqual(fromReports.map((m) => [m.category, m.simulated]), [["noise", true]]);
});

test("seeding twice does not duplicate; reset clears reports and mission states", async () => {
  const d = deps();
  await seedDemo(d);
  await seedDemo(d);
  assert.equal((await d.store.listReports()).length, DEMO_REPORTS.length);
  await d.store.saveMissionState({ missionId: "m1", status: "claimed", supporters: 2 });
  await resetDemo(d);
  assert.equal((await d.store.listReports()).length, 0);
  assert.equal((await d.store.listMissionStates()).length, 0);
});
