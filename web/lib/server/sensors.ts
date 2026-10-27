// A10: check a report against the nearest senseBox station.
// Value source: live openSenseMap reading (8 s timeout), else the station's latest value from
// public/data/stations.json (pipeline output, A1).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Category, SensorCheck, Station } from "@contracts/types";

const TIMEOUT_MS = 8000;
const OSEM_BOX_URL = "https://api.opensensemap.org/boxes/";
/** Reports farther than this from any station get `no_sensor`. */
export const MAX_DIST_M = 1500;
/** Live readings older than this are ignored in favour of the pipeline value. */
const LIVE_MAX_AGE_MS = 3 * 3600_000;
/** Pipeline values older than this (relative to now) are too stale to confirm anything. */
const FILE_MAX_AGE_MS = 3 * 24 * 3600_000;
/** Low-cost PM sensors over-read in humid air (CLAUDE.md). */
const PM_MAX_HUMIDITY = 75;

type Metric = "temperatureC" | "pm25";
// Which reading confirms which report category. Thresholds: 25 °C is a "Sommertag" (DWD),
// 15 µg/m³ PM2.5 is the WHO 24-hour guideline.
const RULES: Partial<Record<Category, { metric: Metric; unit: string; threshold: number }>> = {
  heat: { metric: "temperatureC", unit: "°C", threshold: 25 },
  air: { metric: "pm25", unit: "µg/m³", threshold: 15 },
};

export type Reading = Station["latest"] & { at?: string };
export type LiveReader = (stationId: string) => Promise<Reading | null>;

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

export function nearestStation(lat: number, lng: number, stations: Station[]) {
  let best: { station: Station; distM: number } | null = null;
  for (const station of stations) {
    const distM = distanceM(lat, lng, station.lat, station.lng);
    if (!best || distM < best.distM) best = { station, distM };
  }
  return best;
}

let stationsCache: Promise<Station[]> | null = null;

export function loadStations(): Promise<Station[]> {
  stationsCache ??= readFile(join(process.cwd(), "public", "data", "stations.json"), "utf8")
    .then((text) => JSON.parse(text) as Station[])
    .catch((err) => {
      console.error("sensors: stations.json unavailable", err);
      stationsCache = null;
      return [];
    });
  return stationsCache;
}

const SENSOR_TITLES: [keyof Station["latest"], RegExp][] = [
  ["temperatureC", /temp/i],
  ["humidityPct", /feucht|humid/i],
  ["pm25", /pm\s?2[.,]5/i],
  ["pm10", /pm\s?10/i],
];

/** Latest values for a box from the openSenseMap API, or null on any failure. */
export const readLive: LiveReader = async (stationId) => {
  try {
    const res = await fetch(`${OSEM_BOX_URL}${encodeURIComponent(stationId)}?format=json`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const box = await res.json();
    const reading: Reading = {};
    for (const sensor of box.sensors ?? []) {
      const value = Number(sensor.lastMeasurement?.value);
      const at: string | undefined = sensor.lastMeasurement?.createdAt;
      const match = SENSOR_TITLES.find(([, re]) => re.test(sensor.title ?? ""));
      if (!match || !Number.isFinite(value) || !at || Date.now() - Date.parse(at) > LIVE_MAX_AGE_MS) continue;
      reading[match[0]] ??= value;
      if (!reading.at || at > reading.at) reading.at = at;
    }
    return reading.at ? reading : null;
  } catch (err) {
    console.error(`sensors: live reading for ${stationId} failed`, err);
    return null;
  }
};

function valueFor(metric: Metric, reading: Reading | null | undefined): number | undefined {
  if (!reading) return undefined;
  if (metric === "pm25" && (reading.humidityPct ?? 0) > PM_MAX_HUMIDITY) return undefined;
  return reading[metric];
}

export async function checkSensor(
  input: { lat: number; lng: number; category?: Category },
  deps: { stations?: Station[]; live?: LiveReader; now?: number } = {},
): Promise<SensorCheck> {
  const rule = RULES[input.category ?? "heat"];
  const nearest = nearestStation(input.lat, input.lng, deps.stations ?? (await loadStations()));
  if (!rule || !nearest || nearest.distM > MAX_DIST_M) return { status: "no_sensor" };

  const { station, distM } = nearest;
  const now = deps.now ?? Date.now();
  let value = valueFor(rule.metric, await (deps.live ?? readLive)(station.id));
  if (value === undefined && now - Date.parse(station.lastSeen) <= FILE_MAX_AGE_MS) {
    value = valueFor(rule.metric, station.latest);
  }
  const base = { stationId: station.id, distM: Math.round(distM), unit: rule.unit };
  if (value === undefined) return { status: "no_sensor", ...base };
  return {
    status: value >= rule.threshold ? "confirmed" : "not_confirmed",
    ...base,
    value: Math.round(value * 10) / 10,
  };
}
