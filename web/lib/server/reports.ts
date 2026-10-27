// A11: create and list voice reports.
// POST: transcript -> StructuredReport (llm.ts) + sensor check (sensors.ts) + H3 cell -> store.
import { latLngToCell } from "h3-js";
import type { Report, Station } from "@contracts/types";
import { ApiError } from "./http.ts";
import { structureReport } from "./llm.ts";
import { checkSensor, type LiveReader } from "./sensors.ts";
import { getStore, type Store } from "./store.ts";

/** Marktplatz Heilbronn; used when a report arrives without a location. */
export const CITY_CENTRE = { lat: 49.1427, lng: 9.2186 };
const MAX_TRANSCRIPT = 1000;

export interface NewReport {
  transcript: string;
  lat?: number;
  lng?: number;
  placeName?: string;
}

export interface ReportDeps {
  store?: Store;
  env?: Record<string, string | undefined>;
  stations?: Station[];
  live?: LiveReader;
  now?: number;
}

export function parseNewReport(body: Record<string, unknown>): NewReport {
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript || transcript.length > MAX_TRANSCRIPT) {
    throw new ApiError(400, `transcript is required (max ${MAX_TRANSCRIPT} characters)`);
  }
  const report: NewReport = { transcript };
  if (body.lat !== undefined || body.lng !== undefined) {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new ApiError(400, "lat and lng must both be valid coordinates");
    }
    Object.assign(report, { lat, lng });
  }
  if (typeof body.placeName === "string" && body.placeName.trim()) report.placeName = body.placeName.trim().slice(0, 100);
  return report;
}

export async function createReport(input: NewReport, d: ReportDeps = {}): Promise<Report> {
  const lat = input.lat ?? CITY_CENTRE.lat;
  const lng = input.lng ?? CITY_CENTRE.lng;
  const { report: structured } = await structureReport(input.transcript, d.env);
  const sensorCheck = await checkSensor(
    { lat, lng, category: structured.category },
    { stations: d.stations, live: d.live, now: d.now },
  );
  const report: Report = {
    ...structured,
    id: `r-${crypto.randomUUID()}`,
    createdAt: new Date(d.now ?? Date.now()).toISOString(),
    transcript: input.transcript,
    lat,
    lng,
    h3: latLngToCell(lat, lng, 9),
    sensorCheck,
  };
  if (!report.placeHint && input.placeName) report.placeHint = input.placeName;
  return (d.store ?? getStore()).addReport(report);
}

export function listReports(since: string | null | undefined, d: ReportDeps = {}): Promise<Report[]> {
  if (since && Number.isNaN(Date.parse(since))) throw new ApiError(400, "since must be an ISO date");
  return (d.store ?? getStore()).listReports(since ?? undefined);
}
