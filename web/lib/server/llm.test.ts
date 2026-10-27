import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Category, MissionType, StructuredReport } from "@contracts/types";
import { keywordReport, parseStructured, structureReport } from "./llm.ts";

// A9 test set: 15 sentences incl. Swabian dialect and English. Used for the keyword fallback here
// and as a manual check set for the LLM (`structureReport` with LLM_API_KEY set).
type Case = [string, Category, Partial<StructuredReport> & { suggestedMission?: MissionType | null }];
export const CASES: Case[] = [
  ["An der Bushaltestelle am Hauptbahnhof ist es nachmittags unerträglich heiß, es gibt keinen Schatten.",
    "heat", { suggestedMission: "shade_bus_stop", severity: 3, timeOfDay: "afternoon" }],
  ["Bei uns im Schulhof gibt es keinen einzigen Baum, die Kinder schwitzen in der Pause.",
    "heat", { suggestedMission: "green_schoolyard" }],
  ["Die jungen Bäume in der Südstraße sind total vertrocknet, die bräuchten dringend Wasser.",
    "biodiversity", { suggestedMission: "water_trees", severity: 3, placeHint: "Südstraße" }],
  ["Morgens stinkt es an der Kreuzung nach Abgasen, man kriegt kaum Luft.",
    "air", { timeOfDay: "morning", severity: 3 }],
  ["Nachts ist der Lärm von der Allee so laut, dass ich nicht schlafen kann.", "noise", { timeOfDay: "night" }],
  ["Nach dem Gewitter stand die ganze Unterführung unter Wasser.", "water", {}],
  ["Im Park liegt überall Müll und Glasscherben rum.", "waste", {}],
  ["Die Autos überholen uns auf dem Radweg viel zu knapp, das ist gefährlich.",
    "mobility", { suggestedMission: "safer_bike_street", severity: 3 }],
  ["Früher gab es hier viele Blumen und Bienen, jetzt ist alles zubetoniert.",
    "biodiversity", { suggestedMission: "pollinator_gap" }],
  ["Do isch's heit Mittag arg hoiß, mr hält's fei kaum aus.", "heat", { timeOfDay: "midday", severity: 3 }],
  ["Bei dr Haltestell an dr Kilianskirch gibt's koin Schadde, des isch saumäßig hoiß.",
    "heat", { suggestedMission: "shade_bus_stop", severity: 3, language: "de" }],
  ["Dr Gully isch scho widder verstopft, d' Stroß stoht unter Wasser.", "water", {}],
  ["Do fahret d' Audos wie die Wilde, mit'm Rädle isch des lebensgfährlich.",
    "mobility", { suggestedMission: "safer_bike_street", severity: 3 }],
  ["It's way too hot at the playground in the afternoon, no shade at all.",
    "heat", { language: "en", timeOfDay: "afternoon", severity: 3 }],
  ["Die Luft riecht hier komisch, irgendwie nach Rauch.", "air", { language: "de" }],
];

for (const [sentence, category, expected] of CASES) {
  test(`keywords: ${sentence.slice(0, 50)}`, () => {
    const r = keywordReport(sentence);
    assert.equal(r.category, category);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(r[key as keyof StructuredReport], value, key);
    }
    assert.ok(r.summary.length > 0 && [1, 2, 3].includes(r.severity));
  });
}

test("keywords: unrelated text is 'other' with no mission", () => {
  const r = keywordReport("Ich wollte nur Hallo sagen.");
  assert.equal(r.category, "other");
  assert.equal(r.suggestedMission, null);
});

test("parseStructured rejects invalid output and cleans optional fields", () => {
  assert.equal(parseStructured({ category: "fire", summary: "x", severity: 2, language: "de" }), null);
  assert.equal(parseStructured("nope"), null);
  const r = parseStructured({
    category: "heat", summary: " Zu heiß ", severity: 3, language: "de",
    timeOfDay: "teatime", suggestedMission: "build_rocket", placeHint: null,
  });
  assert.deepEqual(r, { category: "heat", summary: "Zu heiß", severity: 3, timeOfDay: "unknown", suggestedMission: null, language: "de" });
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const ENV = { LLM_API_KEY: "k", LLM_MODEL: "m", LLM_BASE_URL: "https://llm.test/v1" };
const quiet = async <T>(fn: () => Promise<T>) => {
  const [e, w] = [console.error, console.warn];
  console.error = console.warn = () => {};
  try {
    return await fn();
  } finally {
    [console.error, console.warn] = [e, w];
  }
};

test("structureReport uses the LLM answer when valid", async () => {
  let body: { model: string; response_format: { type: string } } | undefined;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    assert.equal(url, "https://llm.test/v1/chat/completions");
    body = JSON.parse(String(init.body));
    const content = JSON.stringify({ category: "noise", summary: "Laute Baustelle", severity: 2, timeOfDay: "morning",
      placeHint: "Allee", suggestedMission: null, language: "de" });
    return Response.json({ choices: [{ message: { content } }] });
  }) as typeof fetch;
  const { report, via } = await structureReport("Baustelle an der Allee ab 6 Uhr", ENV);
  assert.equal(via, "llm");
  assert.equal(report.category, "noise");
  assert.equal(body?.model, "m");
  assert.equal(body?.response_format.type, "json_schema");
});

test("structureReport falls back to keywords on HTTP error or invalid JSON", async () => {
  globalThis.fetch = (async () => new Response("rate limited", { status: 429 })) as typeof fetch;
  const a = await quiet(() => structureReport("Hier ist es so heiß", ENV));
  assert.deepEqual([a.via, a.report.category], ["keywords", "heat"]);

  globalThis.fetch = (async () => Response.json({ choices: [{ message: { content: "{\"category\":\"??\"}" } }] })) as typeof fetch;
  const b = await quiet(() => structureReport("Überall Müll", ENV));
  assert.deepEqual([b.via, b.report.category], ["keywords", "waste"]);
});

test("structureReport skips the LLM without a key", async () => {
  globalThis.fetch = (async () => assert.fail("should not call fetch")) as typeof fetch;
  assert.equal((await structureReport("Hier ist es so heiß", {})).via, "keywords");
});
