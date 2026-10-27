import type { LayerId } from "@contracts/types";

// Liveness check; also proves the @contracts alias resolves in the build.
const layers: LayerId[] = ["heat", "air", "bike", "green", "risk", "felt"];

export function GET() {
  return Response.json({ ok: true, layers });
}
