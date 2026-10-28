import assert from "node:assert/strict";
import { test } from "node:test";
import type { Mission, Report } from "@contracts/types";
import { claimMission, listMissions } from "./missions.ts";
import { missionsFromReports } from "./reportMissions.ts";
import { MemoryStore } from "./store.ts";

const NOW = Date.parse("2026-10-28T14:00:00Z");
const H3 = "891faa02a13ffff";
let n = 0;

function report(extra: Partial<Report> = {}): Report {
  n += 1;
  return {
    id: `r${n}`, createdAt: "2026-10-28T10:00:00Z", transcript: "zu heiß", lat: 49.1426, lng: 9.2221, h3: H3,
    category: "heat", summary: `Meldung ${n}`, severity: 2, language: "de", placeHint: "Kilianskirche",
    suggestedMission: "shade_bus_stop", sensorCheck: { status: "confirmed", value: 29, unit: "°C" }, ...extra,
  };
}

const pipelineMission = (extra: Partial<Mission> = {}): Mission => ({
  id: "p1", type: "unseal_10m2", title: "", description: "", h3: H3, lat: 49.14, lng: 9.22, category: "heat",
  urgency: 2, effort: "afternoon", suitedFor: ["resident"], reason: { rule: "", evidence: {} }, source: "pipeline",
  ...extra,
});

test("three reports of one category create one report mission", () => {
  const [m, ...rest] = missionsFromReports([report(), report(), report({ severity: 3 })], [], NOW);
  assert.equal(rest.length, 0);
  assert.equal(m.id, `report-heat-${H3}`);
  assert.equal(m.type, "shade_bus_stop");
  assert.equal(m.title, "Schatten für die Haltestelle");
  assert.equal(m.source, "report");
  assert.equal(m.placeName, "Kilianskirche");
  assert.equal(m.simulated, undefined);
  assert.deepEqual(m.reason.evidence, { reports: 3, avgSeverity: 2.3, confirmedBySensor: 3 });
  assert.match(m.description, /^3 Menschen haben hier Hitze gemeldet, zuletzt: „Meldung \d+“\. 3 Meldungen wurden/);
  assert.equal(m.en?.title, "Shade for the bus stop");
  assert.match(m.en?.description ?? "", /^3 people reported heat here, most recently: “Meldung \d+”\. 3 reports were confirmed/);
  assert.equal(m.en?.rule, "3+ reports of the same category in an area without a matching mission");
});

test("two reports, other categories or old reports are not enough", () => {
  assert.deepEqual(missionsFromReports([report(), report()], [], NOW), []);
  assert.deepEqual(missionsFromReports([report(), report(), report({ category: "air" })], [], NOW), []);
  const old = report({ createdAt: "2026-10-01T10:00:00Z" });
  assert.deepEqual(missionsFromReports([report(), report(), old], [], NOW), []);
});

test("an existing mission of the same category in the hexagon blocks it", () => {
  const reports = [report(), report(), report()];
  assert.deepEqual(missionsFromReports(reports, [pipelineMission()], NOW), []);
  assert.equal(missionsFromReports(reports, [pipelineMission({ category: "air" })], NOW).length, 1);
});

test("reports no sensor could check become check_reports", () => {
  const unchecked = { sensorCheck: { status: "no_sensor" as const }, category: "noise" as const, suggestedMission: null };
  const [m] = missionsFromReports([report(unchecked), report(unchecked), report(unchecked)], [], NOW);
  assert.equal(m.type, "check_reports");
  assert.equal(m.title, "Meldungen prüfen: Lärm");
  assert.equal(m.en?.title, "Check reports: noise");
  assert.match(m.en?.description ?? "", /No nearby sensor can confirm this\./);
  assert.equal(m.effort, "hour");
});

test("missions that need seeded reports are simulated", () => {
  const [m] = missionsFromReports([report(), report(), report({ seeded: true })], [], NOW);
  assert.equal(m.simulated, true);
});

test("quoted summary does not double the final punctuation", () => {
  const late = { createdAt: "2026-10-28T12:00:00Z", summary: "Zu laut hier!" };
  const [m] = missionsFromReports([report(), report(), report(late)], [], NOW);
  assert.match(m.description, /zuletzt: „Zu laut hier“\. /);
});

test("report missions are listed and claimable through the mission API", async () => {
  const store = new MemoryStore();
  for (const r of [report({ createdAt: "2026-10-28T09:00:00Z" }), report(), report()]) await store.addReport(r);
  const d = { store, missions: [], now: NOW, stations: [], outdoorIds: null };
  const list = await listMissions(d);
  assert.deepEqual(list.map((m) => [m.id, m.state.status]), [[`report-heat-${H3}`, "open"]]);
  const state = await claimMission(`report-heat-${H3}`, "Nachbarschaft", d);
  assert.equal(state.status, "claimed");
});
