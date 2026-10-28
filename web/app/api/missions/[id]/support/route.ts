import { cookies } from "next/headers";
import { getAuth } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { supportMission } from "@/lib/server/missions";
import { recordActivity } from "@/lib/server/profile";
import { currentUser, isSecure } from "@/lib/server/session";

// POST /api/missions/:id/support -> MissionState (signed in: also logged to the profile)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  return handle(async () => {
    const { id } = await params;
    const state = await supportMission(id);
    await recordActivity(await currentUser(jar, getAuth(), isSecure(request)), "support", id);
    return Response.json(state);
  });
}
