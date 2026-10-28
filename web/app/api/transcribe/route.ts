import { ApiError, handle } from "@/lib/server/http";
import { sttAvailable, transcribe } from "@/lib/server/stt";

// GET /api/transcribe -> { available: boolean }  (lets the client decide before asking for the mic)
export function GET() {
  return Response.json({ available: sttAvailable() });
}

// POST /api/transcribe  multipart: audio=<file>, lang=de|en  -> { text }
export function POST(request: Request) {
  return handle(async () => {
    const form = await request.formData().catch(() => {
      throw new ApiError(400, "multipart body with an audio file is required");
    });
    const audio = form.get("audio");
    if (!(audio instanceof Blob)) throw new ApiError(400, "audio file is required");
    const lang = form.get("lang") === "en" ? "en" : "de";
    return Response.json({ text: await transcribe(audio, lang) });
  });
}
