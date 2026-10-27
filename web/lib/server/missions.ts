// A11: missions with their stored state, plus claim / support / done.
// Missions come from public/data/missions.json (A6). Until that exists, the sample missions from
// contracts/samples are served instead, all marked `simulated: true`.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  HourlyPoint, ImpactResult, Mission, MissionState, MissionWithState, Station,
} from "@contracts/types";
import { ApiError } from "./http.ts";
import { loadStations, MAX_DIST_M, nearestStation } from "./sensors.ts";
import { getStore, type Store } from "./store.ts";

/** Baseline window for impact: the last 7 days of station data. */
const BASELINE_MS = 7 * 24 * 3600_000;

export interface MissionDeps {
  store?: Store;
  missions?: Mission[];
  stations?: Station[];
  history?: (stationId: string) => Promise<HourlyPoint[]>;
  now?: number;
}

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T;

let missionsCache: Promise<Mission[]> | null = null;

export function loadMissions(): Promise<Mission[]> {
  missionsCache ??= readJson<Mission[]>(join(process.cwd(), "public", "data", "missions.json"))
    .catch(async () => {
      console.warn("missions: public/data/missions.json missing, serving simulated sample missions");
      const samples = await readJson<Mission[]>(join(process.cwd(), "..", "contracts", "samples", "missions.json"));
      return samples.map((m) => ({ ...m, simulated: true }));
    })
    .catch((err) => {
      console.error("missions: no mission data available", err);
      missionsCache = null;
      return [];
    });
  return missionsCache;
}

export async function loadHistory(stationId: string): Promise<HourlyPoint[]> {
  if (!/^[\w-]+$/.test(stationId)) return [];
  try {
    return await readJson<HourlyPoint[]>(join(process.cwd(), "public", "data", "stations", `${stationId}.json`));
  } catch {
    return [];
  }
}

const deps = (d: MissionDeps) => ({
  store: d.store ?? getStore(),
  missions: d.missions ? Promise.resolve(d.missions) : loadMissions(),
  now: d.now ?? Date.now(),
});

/** All current (not expired) missions with their state. */
export async function listMissions(d: MissionDeps = {}): Promise<MissionWithState[]> {
  const { store, missions, now } = deps(d);
  const [all, states] = await Promise.all([missions, store.listMissionStates()]);
  const byId = new Map(states.map((s) => [s.missionId, s]));
  return all
    .filter((m) => !m.expiresAt || Date.parse(m.expiresAt) > now)
    .map((m) => ({ ...m, state: byId.get(m.id) ?? { missionId: m.id, status: "open", supporters: 0 } }));
}

async function findMission(id: string, d: MissionDeps) {
  const { store, missions } = deps(d);
  const mission = (await missions).find((m) => m.id === id);
  if (!mission) throw new ApiError(404, `mission ${id} not found`);
  return { mission, state: await store.getMissionState(id), store };
}

export async function claimMission(id: string, name: unknown, d: MissionDeps = {}): Promise<MissionState> {
  const who = typeof name === "string" ? name.trim() : "";
  if (!who || who.length > 60) throw new ApiError(400, "name is required (max 60 characters)");
  const { state, store } = await findMission(id, d);
  if (state.status !== "open") throw new ApiError(409, `mission is already ${state.status}`);
  return store.saveMissionState({ ...state, status: "claimed", claimedBy: who });
}

export async function supportMission(id: string, d: MissionDeps = {}): Promise<MissionState> {
  const { state, store } = await findMission(id, d);
  return store.saveMissionState({ ...state, supporters: state.supporters + 1 });
}

export async function doneMission(id: string, d: MissionDeps = {}): Promise<MissionState> {
  const { mission, state, store } = await findMission(id, d);
  if (state.status === "done" || state.status === "verified") throw new ApiError(409, `mission is already ${state.status}`);
  const next: MissionState = { ...state, status: "done", doneAt: new Date(deps(d).now).toISOString() };
  const impact = await baselineImpact(mission, d);
  if (impact) next.impact = impact;
  return store.saveMissionState(next);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * "Before" half of the impact measurement: 7-day mean at the nearest station vs. the mean over all
 * stations in the same window. `after` / `effect` are filled in later (B7/A13).
 */
export async function baselineImpact(mission: Mission, d: MissionDeps = {}): Promise<ImpactResult | undefined> {
  const metric = mission.category === "air" ? "pm25"
    : ["heat", "biodiversity", "water"].includes(mission.category) ? "temperatureC" : null;
  if (!metric) return undefined;
  const stations = d.stations ?? (await loadStations());
  const nearest = nearestStation(mission.lat, mission.lng, stations);
  if (!nearest || nearest.distM > MAX_DIST_M) return undefined;

  const end = Math.max(...stations.map((s) => Date.parse(s.lastSeen)));
  const history = d.history ?? loadHistory;
  const means = new Map<string, number>();
  await Promise.all(stations.map(async (s) => {
    const values = (await history(s.id))
      .filter((p) => Date.parse(p.t) > end - BASELINE_MS && p[metric] !== undefined)
      .map((p) => p[metric] as number);
    const m = mean(values);
    if (m !== undefined) means.set(s.id, m);
  }));

  const before = means.get(nearest.station.id);
  const cityBefore = mean([...means.values()]);
  if (before === undefined || cityBefore === undefined) return undefined;
  const impact: ImpactResult = {
    metric, stationId: nearest.station.id, before: round2(before), cityBefore: round2(cityBefore),
  };
  if (mission.simulated) impact.simulated = true;
  return impact;
}
