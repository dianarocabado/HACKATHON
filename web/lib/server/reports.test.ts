import assert from "node:assert/strict";
import { test } from "node:test";
import type { Station } from "@contracts/types";
import { ApiError } from "./http.ts";
import { CITY_CENTRE, createReport, listReports, parseNewReport, type ReportDeps } from "./reports.ts";
import { MemoryStore } from "./store.ts";

const STATIONS: Station[] = [{
  id: "innenstadt", name: "Innenstadt", lat: 49.1425, lng: 9.222,
  lastSeen: "2026-10-28T13:00:00Z", latest: { temperatureC: 29.2, humidityPct: 40 },
}];
const deps = (): ReportDeps => ({
  store: new MemoryStore(), env: {}, stations: STATIONS, live: async () => null, now: Date.parse("2026-10-28T14:00:00Z"),
});

test("parseNewReport validates input", () => {
  assert.deepEqual(parseNewReport({ transcript: "  Zu heiß ", lat: "49.14", lng: 9.22, placeName: " Markt " }),
    { transcript: "Zu heiß", lat: 49.14, lng: 9.22, placeName: "Markt" });
  assert.deepEqual(parseNewReport({ transcript: "x" }), { transcript: "x" });
  for (const bad of [{}, { transcript: "" }, { transcript: "x".repeat(1001) }, { transcript: "x", lat: 49 },
    { transcript: "x", lat: 91, lng: 9 }, { transcript: "x", lat: "abc", lng: 9 }]) {
    assert.throws(() => parseNewReport(bad), (e: ApiError) => e.status === 400, JSON.stringify(bad).slice(0, 40));
  }
});

test("createReport structures, sensor-checks, locates and stores the report", async () => {
  const d = deps();
  const r = await createReport({ transcript: "An der Haltestelle ist es unerträglich heiß.", lat: 49.1426, lng: 9.2221 }, d);
  assert.match(r.id, /^r-[0-9a-f-]{36}$/);
  assert.equal(r.createdAt, "2026-10-28T14:00:00.000Z");
  assert.equal(r.category, "heat");
  assert.equal(r.suggestedMission, "shade_bus_stop");
  assert.equal(r.h3.length, 15);
  assert.deepEqual([r.sensorCheck.status, r.sensorCheck.value], ["confirmed", 29.2]);
  assert.deepEqual(await listReports(undefined, d), [r]);
});

test("createReport defaults to the city centre and uses placeName as hint", async () => {
  const r = await createReport({ transcript: "Überall liegt Müll.", placeName: "Marktplatz" }, deps());
  assert.deepEqual([r.lat, r.lng], [CITY_CENTRE.lat, CITY_CENTRE.lng]);
  assert.equal(r.placeHint, "Marktplatz");
  assert.equal(r.sensorCheck.status, "no_sensor");
});

test("listReports rejects a bad since", () => {
  assert.throws(() => listReports("yesterday", deps()), (e: ApiError) => e.status === 400);
});
