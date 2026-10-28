// A15: demo seed. ~20 realistic voice reports at real Heilbronn places, all `seeded: true`.
// They run through the normal pipeline (keyword/LLM structuring, live sensor check, H3), so the
// result looks exactly like real reports, except for the seeded flag the UI badges.
// Coordinates are approximate; times are spread over the last ~2 days.
import type { Report } from "@contracts/types";
import { createReport, type NewReport, type ReportDeps } from "./reports.ts";
import { getStore } from "./store.ts";

type DemoReport = NewReport & { lat: number; lng: number; minutesAgo: number };

export const DEMO_REPORTS: DemoReport[] = [
  // Allee: three noise reports in one hexagon -> A12 creates a (simulated) "Meldungen prüfen: Lärm" mission
  { transcript: "Nachts ist der Lärm an der Allee so laut, dass ich nicht schlafen kann.", lat: 49.1440, lng: 9.2220, placeName: "Allee", minutesAgo: 2600 },
  { transcript: "Hier ist es abends extrem laut, ständig Krach und Hupen.", lat: 49.1441, lng: 9.2221, placeName: "Allee", minutesAgo: 1500 },
  { transcript: "Do isch's jede Nacht so laut, mr ka net schlofa.", lat: 49.1439, lng: 9.2219, placeName: "Allee", minutesAgo: 90 },
  // Demo places (demo-places.md): one earlier report each, so the live report on stage is the second, not a duplicate
  { transcript: "An der Haltestelle Harmonie gibt es keinen Schatten, mittags ist es unerträglich heiß.", lat: 49.14229, lng: 9.22227, placeName: "Harmonie/Hafenmarktpassage", minutesAgo: 2400 },
  { transcript: "Auf dem Pausenhof vom Theodor-Heuss-Gymnasium wird es im Sommer brutal heiß, es gibt kaum Schatten.", lat: 49.14256, lng: 9.22696, placeName: "Theodor-Heuss-Gymnasium", minutesAgo: 1400 },
  { transcript: "Rund um die Haltestelle Etzelstraße wächst nichts, für Bienen und Schmetterlinge gibt es hier keine Blüten.", lat: 49.151351, lng: 9.21565, placeName: "Etzelstraße", minutesAgo: 800 },
  // Heat around the centre
  { transcript: "Bei dr Haltestell an dr Kilianskirch gibt's koin Schadde, des isch saumäßig hoiß.", lat: 49.1424, lng: 9.2196, placeName: "Kilianskirche", minutesAgo: 1900 },
  { transcript: "Auf dem Marktplatz staut sich nachmittags die Hitze, kein einziger Baum spendet Schatten.", lat: 49.1427, lng: 9.2186, placeName: "Marktplatz", minutesAgo: 1300 },
  { transcript: "Im Schulhof am Bildungscampus schwitzen die Kinder in der Pause, alles ist asphaltiert.", lat: 49.1481, lng: 9.2122, placeName: "Bildungscampus", minutesAgo: 1100 },
  { transcript: "It's way too hot at the playground near Wollhausplatz in the afternoon, no shade at all.", lat: 49.1405, lng: 9.2228, placeName: "Wollhausplatz", minutesAgo: 700 },
  // Air
  { transcript: "Morgens stinkt es an der Kreuzung am Hauptbahnhof nach Abgasen, man kriegt kaum Luft.", lat: 49.1430, lng: 9.2085, placeName: "Hauptbahnhof", minutesAgo: 2200 },
  { transcript: "Die Luft an der Weinsberger Straße riecht nach Rauch und Abgas.", lat: 49.1460, lng: 9.2300, placeName: "Weinsberger Straße", minutesAgo: 400 },
  // Mobility / cycling
  { transcript: "Die Autos überholen uns auf der Stuttgarter Straße viel zu knapp, das ist gefährlich.", lat: 49.1280, lng: 9.2170, placeName: "Stuttgarter Straße", minutesAgo: 2000 },
  { transcript: "Do fahret d' Audos wie die Wilde, mit'm Rädle isch des lebensgfährlich.", lat: 49.1385, lng: 9.1880, placeName: "Böckingen", minutesAgo: 900 },
  { transcript: "Am Zebrastreifen vor der Grundschule hält kaum ein Auto an.", lat: 49.1170, lng: 9.2050, placeName: "Sontheim", minutesAgo: 300 },
  // Water
  { transcript: "Nach dem Gewitter stand die Unterführung am Bahnhof komplett unter Wasser.", lat: 49.1436, lng: 9.2095, placeName: "Bahnhof", minutesAgo: 2500 },
  { transcript: "Dr Gully isch scho widder verstopft, d' Stroß stoht unter Wasser.", lat: 49.1520, lng: 9.2190, placeName: "Nordstadt", minutesAgo: 1700 },
  // Biodiversity
  { transcript: "Die jungen Bäume in der Südstraße sind total vertrocknet, die bräuchten dringend Wasser.", lat: 49.1340, lng: 9.2210, placeName: "Südstraße", minutesAgo: 1600 },
  { transcript: "Früher gab es hier viele Blumen und Bienen, jetzt ist alles zubetoniert.", lat: 49.1500, lng: 9.2050, placeName: "Neckarbogen", minutesAgo: 600 },
  // Waste
  { transcript: "An der Neckarmeile liegt überall Müll und Glasscherben rum.", lat: 49.1450, lng: 9.2120, placeName: "Neckarmeile", minutesAgo: 1200 },
  { transcript: "Im Park am Wertwiesen quellen die Mülleimer über.", lat: 49.1300, lng: 9.2100, placeName: "Wertwiesenpark", minutesAgo: 200 },
  // Other
  { transcript: "Die Sitzbank an der Haltestelle ist kaputt, ältere Leute können sich nicht hinsetzen.", lat: 49.1470, lng: 9.2250, placeName: "Haltestelle Ost", minutesAgo: 60 },
];

/** Clear all reports, mission states and profile activity (accounts themselves stay). */
export async function resetDemo(d: ReportDeps = {}): Promise<void> {
  const store = d.store ?? getStore();
  await Promise.all([store.clearReports(), store.clearMissionStates(), store.clearActivity()]);
}

/** Reset, then add the demo reports oldest first. */
export async function seedDemo(d: ReportDeps = {}): Promise<Report[]> {
  await resetDemo(d);
  const now = d.now ?? Date.now();
  const ordered = [...DEMO_REPORTS].sort((a, b) => b.minutesAgo - a.minutesAgo);
  const created: Report[] = [];
  for (const { minutesAgo, ...input } of ordered) {
    created.push(await createReport(input, { ...d, now: now - minutesAgo * 60_000 }, { seeded: true }));
  }
  return created;
}
