import { resetDemo, seedDemo } from "@/lib/server/demo";
import { ApiError, handle } from "@/lib/server/http";

// POST /api/demo/seed  -> { reports: number }   (resets first)
// POST /api/demo/reset -> { reports: 0 }
// If DEMO_KEY is set, the request needs header `x-demo-key: <DEMO_KEY>`.
export function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  return handle(async () => {
    const key = process.env.DEMO_KEY;
    if (key && request.headers.get("x-demo-key") !== key) throw new ApiError(403, "wrong demo key");
    const { action } = await params;
    if (action === "seed") return Response.json({ reports: (await seedDemo()).length });
    if (action === "reset") {
      await resetDemo();
      return Response.json({ reports: 0 });
    }
    throw new ApiError(404, `unknown demo action: ${action}`);
  });
}
