import { handle } from "@/lib/server/http";
import { doneMission } from "@/lib/server/missions";

// POST /api/missions/:id/done -> MissionState (with baseline impact)
export function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => Response.json(await doneMission((await params).id)));
}
