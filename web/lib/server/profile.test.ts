import assert from "node:assert/strict";
import { test } from "node:test";
import type { Mission, Report, UserProfile } from "@contracts/types";
import { resetDemo } from "./demo.ts";
import { buildProfile, recordActivity } from "./profile.ts";
import { MemoryStore } from "./store.ts";

const NOW = Date.parse("2026-10-28T14:00:00Z");
const ana: UserProfile = { id: "u-ana", email: "ana@example.org", name: "Ana" };
const ben: UserProfile = { id: "u-ben", email: "ben@example.org", name: "Ben" };

const mission = (id: string): Mission => ({
  id, type: "shade_bus_stop", title: `Mission ${id}`, description: "", h3: "891faa02adbffff",
  lat: 49.1426, lng: 9.2221, category: "heat", urgency: 2, effort: "project", suitedFor: ["city"],
  reason: { rule: "r", evidence: {} }, source: "pipeline",
});

const report = (id: string, minutesAgo: number): Report => ({
  id, createdAt: new Date(NOW - minutesAgo * 60_000).toISOString(), transcript: "heiß", lat: 49.14, lng: 9.22,
  h3: "891faa02adbffff", category: "heat", summary: id, severity: 2, language: "de", sensorCheck: { status: "no_sensor" },
});

test("profile lists only the user's reports (newest first) and missions with what they did", async () => {
  const store = new MemoryStore();
  for (const r of [report("r1", 30), report("r2", 20), report("r3", 10)]) await store.addReport(r);
  const at = (min: number) => ({ store, now: NOW - min * 60_000 });
  await recordActivity(ana, "report", "r1", at(30));
  await recordActivity(ana, "report", "r3", at(10));
  await recordActivity(ben, "report", "r2", at(20));
  await recordActivity(ana, "claim", "m1", at(25));
  await recordActivity(ana, "done", "m1", at(5));
  await recordActivity(ana, "support", "m2", at(15));
  await recordActivity(ana, "support", "gone", at(1)); // mission no longer exists

  const p = await buildProfile(ana, { store, missions: [mission("m1"), mission("m2")], now: NOW });
  assert.deepEqual(p.reports.map((r) => r.id), ["r3", "r1"]);
  assert.deepEqual(p.missions.map((m) => [m.mission.id, m.actions]), [["m1", ["claim", "done"]], ["m2", ["support"]]]);
  assert.deepEqual(p.counts, { reports: 2, claimed: 1, supported: 1, done: 1 });
  assert.equal(p.user.name, "Ana");
});

test("signed-out actions log nothing; demo reset and account deletion clear activity", async () => {
  const store = new MemoryStore();
  await recordActivity(null, "report", "r1", { store });
  assert.deepEqual(await store.listActivity("u-ana"), []);

  await recordActivity(ana, "support", "m1", { store });
  await recordActivity(ben, "support", "m1", { store });
  await store.clearActivity(ana.id);
  assert.equal((await store.listActivity(ana.id)).length, 0);
  assert.equal((await store.listActivity(ben.id)).length, 1);
  await resetDemo({ store });
  assert.equal((await store.listActivity(ben.id)).length, 0);
});

test("a failing store never breaks the action being logged", async () => {
  const broken = { addActivity: async () => { throw new Error("db down"); } } as unknown as MemoryStore;
  await recordActivity(ana, "report", "r1", { store: broken });
});
