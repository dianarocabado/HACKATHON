import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Report } from "@contracts/types";
import { createStore, MemoryStore, SupabaseStore } from "./store.ts";

function report(id: string, createdAt: string): Report {
  return {
    id, createdAt, transcript: "Hier ist es zu heiß", lat: 49.14, lng: 9.22, h3: "891f8d0a6cbffff",
    category: "heat", summary: "Too hot", severity: 2, language: "de", sensorCheck: { status: "no_sensor" },
  };
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("memory store filters reports by since and sorts oldest first", async () => {
  const s = new MemoryStore();
  await s.addReport(report("b", "2026-10-28T10:00:00Z"));
  await s.addReport(report("a", "2026-10-28T09:00:00Z"));
  assert.deepEqual((await s.listReports()).map((r) => r.id), ["a", "b"]);
  assert.deepEqual((await s.listReports("2026-10-28T09:30:00Z")).map((r) => r.id), ["b"]);
  await s.clearReports();
  assert.equal((await s.listReports()).length, 0);
});

test("memory store returns open state for untouched missions and saves updates", async () => {
  const s = new MemoryStore();
  assert.deepEqual(await s.getMissionState("m1"), { missionId: "m1", status: "open", supporters: 0 });
  await s.saveMissionState({ missionId: "m1", status: "claimed", claimedBy: "Klasse 7b", supporters: 3 });
  assert.equal((await s.getMissionState("m1")).status, "claimed");
  assert.equal((await s.listMissionStates()).length, 1);
});

test("createStore picks memory unless supabase is configured", () => {
  assert.equal(createStore({}).kind, "memory");
  assert.equal(createStore({ STORE: "supabase" }).kind, "memory");
  const env = { STORE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "k" };
  assert.equal(createStore(env).kind, "supabase");
});

test("supabase store sends rows to the REST API", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(init.method === "POST" ? "" : JSON.stringify([{ data: report("a", "2026-10-28T09:00:00Z") }]));
  }) as typeof fetch;
  const s = new SupabaseStore("https://x.supabase.co", "key");
  await s.addReport(report("a", "2026-10-28T09:00:00Z"));
  const listed = await s.listReports("2026-10-28T08:00:00Z");
  assert.equal(listed[0].id, "a");
  assert.equal(calls[0].url, "https://x.supabase.co/rest/v1/reports");
  assert.equal(JSON.parse(String(calls[0].init.body)).data.id, "a");
  assert.match(calls[1].url, /created_at=gt\.2026-10-28T08%3A00%3A00Z/);
  assert.equal((calls[0].init.headers as Record<string, string>).apikey, "key");
});

test("supabase store falls back to memory when the API fails", async () => {
  globalThis.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch;
  const origError = console.error;
  console.error = () => {};
  try {
    const s = new SupabaseStore("https://x.supabase.co", "key");
    await s.addReport(report("a", "2026-10-28T09:00:00Z"));
    assert.deepEqual((await s.listReports()).map((r) => r.id), ["a"]);
    assert.equal((await s.getMissionState("m9")).status, "open");
  } finally {
    console.error = origError;
  }
});
