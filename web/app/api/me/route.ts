import { cookies } from "next/headers";
import { getAuth } from "@/lib/server/auth";
import { ApiError, handle } from "@/lib/server/http";
import { buildProfile } from "@/lib/server/profile";
import { ACCESS_COOKIE, clearSession, currentUser, isSecure } from "@/lib/server/session";
import { getStore } from "@/lib/server/store";

// GET /api/me -> Profile (401 without a session)
export async function GET(request: Request) {
  const jar = await cookies();
  return handle(async () => {
    const user = await currentUser(jar, getAuth(), isSecure(request));
    if (!user) throw new ApiError(401, "not_signed_in");
    return Response.json(await buildProfile(user));
  });
}

// DELETE /api/me -> { ok: true }: deletes the account and its activity; reports stay, unlinked.
export async function DELETE(request: Request) {
  const jar = await cookies();
  return handle(async () => {
    const auth = getAuth();
    const user = await currentUser(jar, auth, isSecure(request));
    if (!user) throw new ApiError(401, "not_signed_in");
    await getStore().clearActivity(user.id);
    const access = jar.get(ACCESS_COOKIE)?.value;
    if (access) await auth.signOut(access);
    await auth.deleteUser(user.id);
    clearSession(jar);
    return Response.json({ ok: true });
  });
}
