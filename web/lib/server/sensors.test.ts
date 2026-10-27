import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Station } from "@contracts/types";
import { checkSensor, distanceM, nearestStation, readLive } from "./sensors.ts";

const NOW = Date.parse("2026-10-28T14:00:00Z");
const station = (id: string, lat: number, lng: number, latest: Station["latest"], lastSeen = "2026-10-28T13:00:00Z"): Station =>
  ({ id, name: id, lat, lng, lastSeen, latest });
// Innenstadt and experimenta are ~550 m apart; THW is ~2 km north.
const STATIONS = [
  station("innenstadt", 49.1425, 9.222, { temperatureC: 27.4, humidityPct: 40, pm25: 18 }),
  station("experimenta", 49.1445, 9.2148, { temperatureC: 21, humidityPct: 82, pm25: 30 }),
  station("thw", 49.1623, 9.2191, { temperatureC: 20 }, "2026-10-01T00:00:00Z"),
];
const noLive = async () => null;

test("distance and nearest station", () => {
  assert.ok(Math.abs(distanceM(49.1425, 9.222, 49.1445, 9.2148) - 566) < 10);
  assert.equal(nearestStation(49.1426, 9.2221, STATIONS)?.station.id, "innenstadt");
  assert.equal(nearestStation(0, 0, []), null);
});

test("heat confirmed from pipeline value when live is unavailable", async () => {
  const r = await checkSensor({ lat: 49.1426, lng: 9.2221, category: "heat" }, { stations: STATIONS, live: noLive, now: NOW });
  assert.deepEqual(r, { status: "confirmed", stationId: "innenstadt", distM: 13, unit: "°C", value: 27.4 });
});

test("live reading wins over pipeline value", async () => {
  const live = async () => ({ temperatureC: 19.96, at: "2026-10-28T13:55:00Z" });
  const r = await checkSensor({ lat: 49.1426, lng: 9.2221 }, { stations: STATIONS, live, now: NOW });
  assert.equal(r.status, "not_confirmed");
  assert.equal(r.value, 20);
});

test("air ignores PM when humidity is above 75 %", async () => {
  const humid = await checkSensor({ lat: 49.1445, lng: 9.2148, category: "air" }, { stations: STATIONS, live: noLive, now: NOW });
  assert.equal(humid.status, "no_sensor");
  assert.equal(humid.stationId, "experimenta");
  const dry = await checkSensor({ lat: 49.1426, lng: 9.2221, category: "air" }, { stations: STATIONS, live: noLive, now: NOW });
  assert.deepEqual([dry.status, dry.value, dry.unit], ["confirmed", 18, "µg/m³"]);
});

test("no_sensor when too far, stale, or category has no sensor", async () => {
  const deps = { stations: STATIONS, live: noLive, now: NOW };
  assert.deepEqual(await checkSensor({ lat: 49.2, lng: 9.3 }, deps), { status: "no_sensor" });
  assert.equal((await checkSensor({ lat: 49.1623, lng: 9.2191 }, deps)).status, "no_sensor"); // THW stale
  assert.deepEqual(await checkSensor({ lat: 49.1426, lng: 9.2221, category: "noise" }, deps), { status: "no_sensor" });
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("readLive maps openSenseMap sensor titles and drops old readings", async () => {
  const recent = new Date(Date.now() - 60_000).toISOString();
  globalThis.fetch = (async () => Response.json({
    sensors: [
      { title: "Temperatur", lastMeasurement: { value: "21.35", createdAt: recent } },
      { title: "rel. Luftfeuchte", lastMeasurement: { value: "48.3", createdAt: recent } },
      { title: "PM2.5", lastMeasurement: { value: "4.1", createdAt: "2020-01-01T00:00:00Z" } },
      { title: "Luftdruck", lastMeasurement: { value: "991", createdAt: recent } },
    ],
  })) as typeof fetch;
  assert.deepEqual(await readLive("box"), { temperatureC: 21.35, humidityPct: 48.3, at: recent });
});

test("readLive returns null on HTTP error or network failure", async () => {
  globalThis.fetch = (async () => new Response("", { status: 404 })) as typeof fetch;
  assert.equal(await readLive("box"), null);
  const origError = console.error;
  console.error = () => {};
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  try {
    assert.equal(await readLive("box"), null);
  } finally {
    console.error = origError;
  }
});
