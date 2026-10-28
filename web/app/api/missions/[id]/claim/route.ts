import { cookies } from "next/headers";
import { getAuth } from "@/lib/server/auth";
import { handle, readBody } from "@/lib/server/http";
import { claimMission } from "@/lib/server/missions";
import { recordActivity } from "@/lib/server/profile";
import { currentUser, isSecure } from "@/lib/server/session";

// POST /api/missions/:id/claim { name } -> MissionState (signed in: also logged to the profile)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  return handle(async () => {
    const { id } = await params;
    const { name } = await readBody(request);
    const state = await claimMission(id, name);
    await recordActivity(await currentUser(jar, getAuth(), isSecure(request)), "claim", id);
    return Response.json(state);
  });
}
