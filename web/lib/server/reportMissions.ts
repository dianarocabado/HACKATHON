// A12: voice reports -> missions.
// 3+ recent reports of one category in a hexagon that has no mission of that category yet become a
// mission. Missions are derived from the stored reports on every request (stable id per hexagon and
// category), so they need no table of their own; their state lives in mission_states like any other.
import type { Category, Mission, MissionType, Report } from "@contracts/types";

export const MIN_REPORTS = 3;
/** Only reports from this window count. */
export const REPORT_WINDOW_MS = 14 * 24 * 3600_000;

const LABEL: Record<Category, string> = {
  heat: "Hitze", air: "schlechte Luft", noise: "Lärm", water: "Wasser/Überflutung",
  biodiversity: "fehlendes Grün", waste: "Müll", mobility: "Gefahr im Verkehr", other: "ein Problem",
};

const TITLE: Record<MissionType, string> = {
  water_trees: "Straßenbäume gießen",
  shade_bus_stop: "Schatten für die Haltestelle",
  green_schoolyard: "Schulhof begrünen",
  pollinator_gap: "Blühinsel für Bienen anlegen",
  unseal_10m2: "10 m² entsiegeln",
  safer_bike_street: "Sicherer Radfahren",
  host_sensor: "senseBox aufhängen",
  check_reports: "Meldungen prüfen",
};

const EFFORT: Record<MissionType, Mission["effort"]> = {
  water_trees: "hour", shade_bus_stop: "project", green_schoolyard: "project", pollinator_gap: "afternoon",
  unseal_10m2: "afternoon", safer_bike_street: "project", host_sensor: "hour", check_reports: "hour",
};

const SUITED: Record<MissionType, Mission["suitedFor"]> = {
  water_trees: ["resident", "club", "school"], shade_bus_stop: ["company", "city", "club"],
  green_schoolyard: ["school", "company", "city"], pollinator_gap: ["resident", "school", "club"],
  unseal_10m2: ["resident", "company", "club"], safer_bike_street: ["city", "resident", "club"],
  host_sensor: ["resident", "school", "company"], check_reports: ["resident", "school", "city"],
};

function mostCommon<T>(values: (T | null | undefined)[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function missionsFromReports(reports: Report[], existing: Mission[], now: number): Mission[] {
  const covered = new Set(existing.map((m) => `${m.h3}|${m.category}`));
  const groups = new Map<string, Report[]>();
  for (const r of reports) {
    if (now - Date.parse(r.createdAt) > REPORT_WINDOW_MS) continue;
    const key = `${r.h3}|${r.category}`;
    if (covered.has(key)) continue;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const missions: Mission[] = [];
  for (const group of groups.values()) {
    if (group.length < MIN_REPORTS) continue;
    const { h3, category } = group[0];
    const unchecked = group.every((r) => r.sensorCheck.status === "no_sensor");
    const type: MissionType = unchecked ? "check_reports" : mostCommon(group.map((r) => r.suggestedMission)) ?? "check_reports";
    const latest = group.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    const severity = mean(group.map((r) => r.severity));
    const confirmed = group.filter((r) => r.sensorCheck.status === "confirmed").length;
    const real = group.filter((r) => !r.seeded).length;
    const placeName = mostCommon(group.map((r) => r.placeHint));

    const quote = latest.summary.replace(/[.!?…\s]+$/, "");
    const what = `${group.length} Menschen haben hier ${LABEL[category]} gemeldet, zuletzt: „${quote}“`;
    const next = type === "check_reports"
      ? "Kein Sensor in der Nähe kann das bestätigen. Messt nach, macht Fotos oder hängt eine senseBox auf."
      : confirmed
        ? `${confirmed} Meldung${confirmed > 1 ? "en wurden" : " wurde"} vom nächsten Sensor bestätigt.`
        : "Packt es gemeinsam an.";

    const mission: Mission = {
      id: `report-${category}-${h3}`,
      type,
      title: type === "check_reports" ? `${TITLE[type]}: ${LABEL[category]}` : TITLE[type],
      description: `${what}. ${next}`,
      h3,
      lat: Math.round(mean(group.map((r) => r.lat)) * 1e6) / 1e6,
      lng: Math.round(mean(group.map((r) => r.lng)) * 1e6) / 1e6,
      category,
      urgency: group.length >= 6 || severity >= 2.5 ? 3 : group.length >= 4 ? 2 : 1,
      effort: EFFORT[type],
      suitedFor: SUITED[type],
      reason: {
        rule: "3+ Meldungen derselben Kategorie in einem Bereich ohne passende Mission",
        evidence: { reports: group.length, avgSeverity: Math.round(severity * 10) / 10, confirmedBySensor: confirmed },
      },
      source: "report",
    };
    if (placeName) mission.placeName = placeName;
    // Demo seed reports are invented; a mission that needs them to reach the threshold is too.
    if (real < MIN_REPORTS) mission.simulated = true;
    missions.push(mission);
  }
  return missions.sort((a, b) => a.id.localeCompare(b.id));
}
