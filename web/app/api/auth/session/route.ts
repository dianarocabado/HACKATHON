import { cookies } from "next/headers";
import { getAuth } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { currentUser, isSecure } from "@/lib/server/session";

// GET /api/auth/session -> { user: UserProfile | null }
export async function GET(request: Request) {
  // Reading cookies makes this per-request; it stays outside handle(), which would swallow prerender bail-outs.
  const jar = await cookies();
  return handle(async () => Response.json({ user: await currentUser(jar, getAuth(), isSecure(request)) }));
}
