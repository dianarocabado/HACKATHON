import { cookies } from "next/headers";
import { getAuth } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { ACCESS_COOKIE, clearSession } from "@/lib/server/session";

// POST /api/auth/logout -> { ok: true }, clears the session cookies
export async function POST() {
  const jar = await cookies();
  return handle(async () => {
    const access = jar.get(ACCESS_COOKIE)?.value;
    if (access) await getAuth().signOut(access);
    clearSession(jar);
    return Response.json({ ok: true });
  });
}
