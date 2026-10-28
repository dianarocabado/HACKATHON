import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "./http.ts";
import { extensionFor, sttAvailable, transcribe } from "./stt.ts";

const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm;codecs=opus" });

test("no key means not available and a 503", async () => {
  assert.equal(sttAvailable({}), false);
  await assert.rejects(transcribe(audio, "de", {}), (e) => e instanceof ApiError && e.status === 503);
});

test("sends the audio to the provider and returns trimmed text", async () => {
  let seen: { url: string; auth: string | null; form: FormData } | undefined;
  const fake = (async (url: string, init: RequestInit) => {
    seen = { url, auth: new Headers(init.headers).get("authorization"), form: init.body as FormData };
    return Response.json({ text: "  An der Haltestelle ist es heiß. " });
  }) as unknown as typeof fetch;
  const text = await transcribe(audio, "de", { STT_API_KEY: "k" }, fake);
  assert.equal(text, "An der Haltestelle ist es heiß.");
  assert.equal(seen?.url, "https://api.groq.com/openai/v1/audio/transcriptions");
  assert.equal(seen?.auth, "Bearer k");
  assert.equal(seen?.form.get("language"), "de");
  assert.equal((seen?.form.get("file") as File).name, "speech.webm");
});

test("provider errors and network failures become clear API errors", async () => {
  const failing = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(transcribe(audio, "de", { STT_API_KEY: "k" }, failing), (e) => e instanceof ApiError && e.status === 502);
  const offline = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  await assert.rejects(transcribe(audio, "de", { STT_API_KEY: "k" }, offline), (e) => e instanceof ApiError && e.status === 504);
});

test("file extension follows the recorder mime type (Safari records mp4)", () => {
  assert.equal(extensionFor("audio/mp4"), "m4a");
  assert.equal(extensionFor("audio/webm;codecs=opus"), "webm");
});
