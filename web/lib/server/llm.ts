// A9: voice transcript -> StructuredReport.
// Uses an OpenAI-compatible chat endpoint (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL) with a strict JSON schema.
// Falls back to keyword rules when no key is set, the call fails, takes over 8 s, or returns invalid JSON.
import type { Category, MissionType, StructuredReport } from "@contracts/types";

const TIMEOUT_MS = 8000;

const CATEGORIES: Category[] = ["heat", "air", "noise", "water", "biodiversity", "waste", "mobility", "other"];
const MISSIONS: MissionType[] = [
  "water_trees", "shade_bus_stop", "green_schoolyard", "pollinator_gap",
  "unseal_10m2", "safer_bike_street", "host_sensor", "check_reports",
];
const TIMES = ["morning", "midday", "afternoon", "evening", "night", "unknown"] as const;

export interface StructureResult {
  report: StructuredReport;
  via: "llm" | "keywords";
}

// ---------- keyword fallback ----------

// Lower-case stems, matched as substrings. Includes Swabian forms common around Heilbronn.
const CATEGORY_WORDS: Record<Exclude<Category, "other">, string[]> = {
  heat: ["heiß", "heiss", "hoiß", "hoaß", "hitze", "hitz", "schwitz", "warm", "brütend", "schatten", "schadde",
    "sonne", "hot", "heat", "shade", "sun"],
  air: ["luft", "abgas", "stinkt", "gestank", "gstank", "rauch", "staub", "feinstaub", "smog", "riecht",
    "air", "smell", "smoke", "fumes", "exhaust"],
  noise: ["lärm", "laut", "krach", "dröhn", "hupen", "noise", "loud"],
  water: ["wasser", "überschwemm", "überflut", "pfütze", "gully", "abfluss", "starkregen", "flood", "puddle", "drain"],
  biodiversity: ["biene", "insekt", "blume", "blüh", "wiese", "vogel", "vögel", "baum", "bäume", "vertrockn",
    "zubetoniert", "grün", "bee", "insect", "flower", "tree", "bird"],
  waste: ["müll", "abfall", "dreck", "scherbe", "kippe", "mülleimer", "sperrmüll", "litter", "trash", "rubbish", "garbage"],
  mobility: ["auto", "audo", "radweg", "fahrrad", "rädle", "radl", "überhol", "ampel", "zebrastreifen", "gehweg",
    "verkehr", "raser", "bike", "cycl", "car", "traffic", "crossing"],
};
// Stems that decide the category on their own (counted three times).
const STRONG_WORDS: Partial<Record<Category, string[]>> = {
  heat: ["heiß", "heiss", "hoiß", "hoaß", "hitze", "hot"],
  biodiversity: ["vertrockn", "biene"],
  mobility: ["überhol", "radweg", "rädle"],
  waste: ["müll", "scherbe"],
};

const HIGH_SEVERITY = ["sehr", "extrem", "unerträglich", "gefährlich", "gfährlich", "arg ", "saumäßig", "total",
  "dringend", "kaum aus", "kaum luft", "nicht schlafen", "jeden tag", "way too", "unbearable", "dangerous", "always"];
const LOW_SEVERITY = ["bissle", "bisschen", "etwas", "leicht", "manchmal", "a bit", "slightly", "sometimes"];

const TIME_WORDS: [StructuredReport["timeOfDay"], string[]][] = [
  ["afternoon", ["nachmittag", "afternoon"]],
  ["morning", ["morgen", "früh", "morning"]],
  ["midday", ["mittag", "midday", "noon"]],
  ["evening", ["abend", "evening"]],
  ["night", ["nacht", "nachts", "night"]],
];

const ENGLISH_WORDS = /\b(the|is|it's|too|there|here|no|at|and|of|very|my)\b/g;
const GERMAN_WORDS = /\b(der|die|das|ist|isch|es|hier|do|und|nicht|kein|koin|bei|mit|sehr)\b/g;

const count = (text: string, words: string[]) => words.filter((w) => text.includes(w)).length;

function pickMission(text: string, category: Category): MissionType | null {
  if (category === "mobility" && /überhol|knapp|radweg|rädle|fahrrad|bike|cycl/.test(text)) return "safer_bike_street";
  if (/(bäume|baum|tree).*(trocken|vertrockn|wasser|gieß|water|dry)|(vertrockn|dry).*(bäume|baum|tree)/.test(text)) {
    return "water_trees";
  }
  if (/zubetoniert|versiegelt|asphalt|beton|concrete/.test(text)) {
    return category === "biodiversity" ? "pollinator_gap" : "unseal_10m2";
  }
  if (category === "heat") {
    if (/haltestell|bushalte|bus stop/.test(text)) return "shade_bus_stop";
    if (/schul|kindergarten|kita|school/.test(text)) return "green_schoolyard";
  }
  if (category === "biodiversity" && /biene|blume|blüh|insekt|bee|flower/.test(text)) return "pollinator_gap";
  return null;
}

const PLACE = /\b(?:an der|an dr|am|bei der|bei dr|beim|in der|auf der|vor der|near|at the)\s+((?:[A-ZÄÖÜ][\wäöüß.-]*\s?){1,3})/;

export function keywordReport(transcript: string): StructuredReport {
  const raw = transcript.trim();
  const text = ` ${raw.toLowerCase()} `;
  let category: Category = "other";
  let best = 0;
  for (const c of Object.keys(CATEGORY_WORDS) as (keyof typeof CATEGORY_WORDS)[]) {
    const score = count(text, CATEGORY_WORDS[c]) + 2 * count(text, STRONG_WORDS[c] ?? []);
    if (score > best) [category, best] = [c, score];
  }
  const severity = count(text, HIGH_SEVERITY) ? 3 : count(text, LOW_SEVERITY) ? 1 : 2;
  const timeOfDay = TIME_WORDS.find(([, words]) => count(text, words))?.[0] ?? "unknown";
  const english = (text.match(ENGLISH_WORDS) ?? []).length;
  const german = (text.match(GERMAN_WORDS) ?? []).length + (/[äöüß]/.test(text) ? 2 : 0);
  const firstSentence = raw.split(/(?<=[.!?])\s/)[0] ?? raw;
  const report: StructuredReport = {
    category,
    summary: firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}...` : firstSentence,
    severity,
    timeOfDay,
    suggestedMission: pickMission(text, category),
    language: english > german ? "en" : "de",
  };
  const place = raw.match(PLACE)?.[1]?.trim();
  if (place) report.placeHint = place;
  return report;
}

// ---------- LLM ----------

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["category", "summary", "severity", "timeOfDay", "placeHint", "suggestedMission", "language"],
  properties: {
    category: { type: "string", enum: CATEGORIES },
    summary: { type: "string", description: "One short sentence in the language of the transcript" },
    severity: { type: "integer", enum: [1, 2, 3], description: "1 minor, 2 noticeable, 3 severe or dangerous" },
    timeOfDay: { type: "string", enum: TIMES },
    placeHint: { type: ["string", "null"], description: "Place named in the transcript, if any" },
    suggestedMission: { type: ["string", "null"], enum: [...MISSIONS, null] },
    language: { type: "string", enum: ["de", "en"] },
  },
};

const SYSTEM_PROMPT = `You turn short spoken reports from residents of Heilbronn, Germany, into JSON.
Transcripts come from speech recognition and may be German, English or Swabian dialect, with recognition errors.
Categories: heat, air, noise, water (flooding, drains), biodiversity (trees, flowers, insects), waste, mobility (traffic, cycling, walking), other.
Suggested missions: water_trees (dry street trees), shade_bus_stop (hot bus stop), green_schoolyard (hot school or kindergarten),
pollinator_gap (no flowers/green), unseal_10m2 (sealed hot surface), safer_bike_street (close overtaking, unsafe cycling),
host_sensor, check_reports; null if none fits. Never invent places or facts that are not in the transcript.`;

/** Validate untrusted LLM output against the contract; returns null if anything is off. */
export function parseStructured(value: unknown): StructuredReport | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!CATEGORIES.includes(v.category as Category)) return null;
  if (typeof v.summary !== "string" || !v.summary.trim()) return null;
  if (![1, 2, 3].includes(v.severity as number)) return null;
  if (v.language !== "de" && v.language !== "en") return null;
  const report: StructuredReport = {
    category: v.category as Category,
    summary: v.summary.trim().slice(0, 200),
    severity: v.severity as 1 | 2 | 3,
    timeOfDay: TIMES.includes(v.timeOfDay as (typeof TIMES)[number]) ? (v.timeOfDay as StructuredReport["timeOfDay"]) : "unknown",
    suggestedMission: MISSIONS.includes(v.suggestedMission as MissionType) ? (v.suggestedMission as MissionType) : null,
    language: v.language,
  };
  if (typeof v.placeHint === "string" && v.placeHint.trim()) report.placeHint = v.placeHint.trim().slice(0, 100);
  return report;
}

async function llmReport(transcript: string, env: Record<string, string | undefined>): Promise<StructuredReport | null> {
  const base = (env.LLM_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_schema", json_schema: { name: "structured_report", strict: true, schema: SCHEMA } },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;
  return parseStructured(JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")));
}

export async function structureReport(
  transcript: string,
  env: Record<string, string | undefined> = process.env,
): Promise<StructureResult> {
  if (env.LLM_API_KEY && env.LLM_MODEL && transcript.trim()) {
    try {
      const report = await llmReport(transcript, env);
      if (report) return { report, via: "llm" };
      console.warn("llm: invalid structured output, using keyword fallback");
    } catch (err) {
      console.error("llm: request failed, using keyword fallback", err);
    }
  }
  return { report: keywordReport(transcript), via: "keywords" };
}
