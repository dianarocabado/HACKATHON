// Client API for the UI. Same signatures for mock and real backend, switched by NEXT_PUBLIC_USE_MOCK.
// Mock mode serves contracts/samples so Agent B can build before Agent A's API is merged.
import type {
  LayersFile, Station, HourlyPoint, MissionWithState, MissionState, Report, SensorCheck,
} from '@contracts/types';
import sampleLayers from '@contracts/samples/layers.json';
import sampleStations from '@contracts/samples/stations.json';
import sampleMissions from '@contracts/samples/api/missions.json';
import sampleReports from '@contracts/samples/api/reports.json';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const TIMEOUT_MS = 8000;

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) =>
  http<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// ---------- mock state (in memory, resets on reload) ----------

const mock = {
  missions: structuredClone(sampleMissions) as MissionWithState[],
  reports: structuredClone(sampleReports) as Report[],
};

const delay = <T>(value: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(value), ms));

function mockState(id: string, change: (s: MissionState) => void): Promise<MissionState> {
  const m = mock.missions.find((x) => x.id === id);
  if (!m) return Promise.reject(new Error(`mission ${id} not found`));
  change(m.state);
  return delay({ ...m.state });
}

// Very rough keyword guess so the mock report flow feels real.
function mockReport(body: NewReport): Report {
  const t = body.transcript.toLowerCase();
  const category: Report['category'] =
    /hitze|heiß|heiss|schatten|hot|shade/.test(t) ? 'heat'
    : /luft|abgas|stinkt|staub|air/.test(t) ? 'air'
    : /rad|überhol|auto|bike/.test(t) ? 'mobility'
    : /müll|abfall|trash/.test(t) ? 'waste'
    : 'other';
  const lat = body.lat ?? 49.1425;
  const lng = body.lng ?? 9.215;
  return {
    id: `r-mock-${Date.now()}`,
    createdAt: new Date().toISOString(),
    transcript: body.transcript,
    lat, lng,
    h3: '891faa02ac7ffff',
    category,
    summary: body.transcript.slice(0, 80),
    severity: 2,
    timeOfDay: 'unknown',
    placeHint: body.placeName,
    suggestedMission: null,
    language: /\b(the|is|it's|very)\b/.test(t) ? 'en' : 'de',
    sensorCheck: category === 'heat'
      ? { status: 'confirmed', stationId: 'sb-markt', value: 31.4, unit: '°C', distM: 220 }
      : { status: 'no_sensor' },
    seeded: true,
  };
}

// ---------- public API ----------

export interface NewReport { transcript: string; lat?: number; lng?: number; placeName?: string }

export const api = {
  layers: (): Promise<LayersFile> =>
    USE_MOCK ? delay(sampleLayers as LayersFile) : http('/data/layers.json'),

  stations: (): Promise<Station[]> =>
    USE_MOCK ? delay(sampleStations as Station[]) : http('/data/stations.json'),

  stationHistory: async (id: string): Promise<HourlyPoint[]> => {
    if (!USE_MOCK) return http(`/data/stations/${id}.json`);
    const mod = await import(`@contracts/samples/stations/${id}.json`);
    return mod.default as HourlyPoint[];
  },

  missions: (): Promise<MissionWithState[]> =>
    USE_MOCK ? delay(structuredClone(mock.missions)) : http('/api/missions'),

  claimMission: (id: string, name: string): Promise<MissionState> =>
    USE_MOCK
      ? mockState(id, (s) => { s.status = 'claimed'; s.claimedBy = name; })
      : post(`/api/missions/${id}/claim`, { name }),

  supportMission: (id: string): Promise<MissionState> =>
    USE_MOCK ? mockState(id, (s) => { s.supporters += 1; }) : post(`/api/missions/${id}/support`),

  doneMission: (id: string): Promise<MissionState> =>
    USE_MOCK
      ? mockState(id, (s) => { s.status = 'done'; s.doneAt = new Date().toISOString(); })
      : post(`/api/missions/${id}/done`),

  reports: (since?: string): Promise<Report[]> => {
    if (!USE_MOCK) return http(`/api/reports${since ? `?since=${encodeURIComponent(since)}` : ''}`);
    return delay(mock.reports.filter((r) => !since || r.createdAt > since));
  },

  createReport: (body: NewReport): Promise<Report> => {
    if (!USE_MOCK) return post('/api/reports', body);
    const report = mockReport(body);
    mock.reports.push(report);
    return delay(report, 900);
  },

  sensorCheck: (lat: number, lng: number): Promise<SensorCheck> =>
    USE_MOCK
      ? delay({ status: 'confirmed', stationId: 'sb-markt', value: 31.4, unit: '°C', distM: 220 })
      : http(`/api/sensor-check?lat=${lat}&lng=${lng}`),
};
