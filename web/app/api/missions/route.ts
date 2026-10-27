import { connection } from "next/server";
import { handle } from "@/lib/server/http";
import { listMissions } from "@/lib/server/missions";

// GET /api/missions -> MissionWithState[]
export async function GET() {
  // State changes per request: never prerender. Must stay outside handle(), which would swallow
  // the rejection Next uses to stop prerendering.
  await connection();
  return handle(async () => Response.json(await listMissions()));
}
