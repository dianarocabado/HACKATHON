import { handle, readBody } from "@/lib/server/http";
import { claimMission } from "@/lib/server/missions";

// POST /api/missions/:id/claim { name } -> MissionState
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const { name } = await readBody(request);
    return Response.json(await claimMission(id, name));
  });
}
