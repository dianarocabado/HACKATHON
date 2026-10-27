import { handle } from "@/lib/server/http";
import { supportMission } from "@/lib/server/missions";

// POST /api/missions/:id/support -> MissionState
export function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => Response.json(await supportMission((await params).id)));
}
