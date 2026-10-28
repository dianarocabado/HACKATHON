// Server speech-to-text for browsers without the Web Speech API (iPhone Chrome, in-app browsers, Firefox).
// OpenAI-compatible /audio/transcriptions endpoint, Groq Whisper by default (STT_API_KEY, STT_BASE_URL, STT_MODEL).
// The audio is forwarded once and never stored.
import { ApiError } from "./http.ts";

const TIMEOUT_MS = 8000;
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "whisper-large-v3-turbo";
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

type Env = Record<string, string | undefined>;

export const sttAvailable = (env: Env = process.env) => Boolean(env.STT_API_KEY);

/** Audio file extension Whisper understands, from the browser's MediaRecorder mime type. */
export function extensionFor(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

export async function transcribe(
  audio: Blob,
  lang: "de" | "en" = "de",
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!sttAvailable(env)) throw new ApiError(503, "stt_not_configured");
  if (audio.size === 0) throw new ApiError(400, "empty audio");
  if (audio.size > MAX_AUDIO_BYTES) throw new ApiError(413, "audio too large");

  const form = new FormData();
  form.append("file", audio, `speech.${extensionFor(audio.type)}`);
  form.append("model", env.STT_MODEL || DEFAULT_MODEL);
  form.append("language", lang);
  form.append("response_format", "json");

  let res: Response;
  try {
    res = await fetchImpl(`${(env.STT_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "")}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.STT_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error("stt: request failed", err);
    throw new ApiError(504, "stt_unreachable");
  }
  if (!res.ok) {
    console.error("stt: provider error", res.status, await res.text().catch(() => ""));
    throw new ApiError(502, "stt_failed");
  }
  const body = (await res.json()) as { text?: unknown };
  return typeof body.text === "string" ? body.text.trim() : "";
}
