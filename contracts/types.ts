// contracts/types.ts — shared between Agent A and Agent B. Frozen after Phase 0.
// Only additive optional fields allowed afterwards (commit prefix `contract:`).

export type Category = 'heat' | 'air' | 'noise' | 'water' | 'biodiversity' | 'waste' | 'mobility' | 'other';
export type LayerId = 'heat' | 'air' | 'bike' | 'green' | 'risk' | 'felt';

// ---------- static files written by the pipeline (web/public/data/) ----------

export interface HexCell {
  h3: string;                                        // H3 index, resolution 9
  scores: Partial<Record<LayerId, number | null>>;   // 0..1, null = no data
  need: number;                                      // weighted total 0..1
  facts: {                                           // human-readable evidence
    tempAfternoonC?: number;
    pm25?: number;
    overtakeUnder150Pct?: number;
    distToGreenM?: number;
    sensitivePlaces?: number;
    trees?: number;
    busStops?: number;
    nearestStationId?: string;
    nearestStationDistM?: number;
    heatWalkAnomalyC?: number;                       // measured on the Green City heat walk (Sep 2026): °C vs. rest of the walk
  };
}

export interface LayersFile {                        // layers.json
  generatedAt: string;
  resolution: 9;
  weights: Record<LayerId, number>;
  cells: HexCell[];
}

export interface Station {                           // stations.json (array)
  id: string;
  name: string;
  lat: number;
  lng: number;
  lastSeen: string;
  latest: { temperatureC?: number; humidityPct?: number; pm25?: number; pm10?: number };
}

export interface HourlyPoint {                       // stations/{id}.json (array)
  t: string;
  temperatureC?: number;
  humidityPct?: number;
  pm25?: number;
  pm10?: number;
}

export interface EvidenceItem {                      // evidence.json items (A13), all from real data
  id: string;
  title: string;                                     // German, short
  finding: string;                                   // one plain German sentence with the number
  value: number;                                     // headline number
  unit: string;                                      // "°C", "Nächte", "%"
  ci95?: [number, number];                           // 95 % bootstrap interval, if computed
  n: number;                                         // sample size behind the value
  nLabel: string;                                    // what n counts, e.g. "Sommertage"
  conclusive: boolean;                               // false = no clear effect measurable
  compare?: { label: string; value: number }[];      // bars for a simple chart
  source: string;
  method: string;
  caveat?: string;
}

export interface EvidenceFile {                      // evidence.json
  generatedAt: string;
  items: EvidenceItem[];
}

// ---------- missions ----------

export type MissionType =
  | 'water_trees'
  | 'shade_bus_stop'
  | 'green_schoolyard'
  | 'pollinator_gap'
  | 'unseal_10m2'
  | 'safer_bike_street'
  | 'host_sensor'
  | 'check_reports';

export type MissionStatus = 'open' | 'claimed' | 'done' | 'verified';

export interface Mission {                           // missions.json (array) + missions created from reports
  id: string;
  type: MissionType;
  title: string;
  description: string;
  h3: string;
  lat: number;
  lng: number;
  placeName?: string;
  category: Category;
  urgency: 1 | 2 | 3;
  effort: 'hour' | 'afternoon' | 'project';
  suitedFor: ('resident' | 'school' | 'company' | 'club' | 'city')[];
  reason: { rule: string; evidence: Record<string, number | string> };
  expiresAt?: string;
  source: 'pipeline' | 'report';
  simulated?: boolean;
}

export interface ImpactResult {
  metric: 'temperatureC' | 'pm25';
  stationId: string;
  before: number;
  after?: number;
  cityBefore: number;
  cityAfter?: number;
  effect?: number;                                   // (after - before) - (cityAfter - cityBefore)
  simulated?: boolean;
}

export interface MissionState {                      // stored in the database
  missionId: string;
  status: MissionStatus;
  claimedBy?: string;
  supporters: number;
  doneAt?: string;
  impact?: ImpactResult;
}

export type MissionWithState = Mission & { state: MissionState };

// ---------- voice reports ----------

export interface StructuredReport {                  // what the LLM must return
  category: Category;
  summary: string;
  severity: 1 | 2 | 3;
  timeOfDay?: 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'unknown';
  placeHint?: string;
  suggestedMission?: MissionType | null;
  language: 'de' | 'en';
}

export interface SensorCheck {
  status: 'confirmed' | 'not_confirmed' | 'no_sensor';
  stationId?: string;
  value?: number;
  unit?: string;
  distM?: number;
}

export interface Report extends StructuredReport {
  id: string;
  createdAt: string;
  transcript: string;
  lat: number;
  lng: number;
  h3: string;
  sensorCheck: SensorCheck;
  seeded?: boolean;                                  // demo seed data
}

// ---------- API (owned by Agent A, called by Agent B) ----------
// POST /api/reports                 body: { transcript: string; lat?: number; lng?: number; placeName?: string } -> Report
// GET  /api/reports?since=<ISO>     -> Report[]
// GET  /api/missions                -> MissionWithState[]
// POST /api/missions/:id/claim      body: { name: string } -> MissionState
// POST /api/missions/:id/support    -> MissionState
// POST /api/missions/:id/done       -> MissionState (with baseline impact)
// GET  /api/sensor-check?lat=&lng=  -> SensorCheck
