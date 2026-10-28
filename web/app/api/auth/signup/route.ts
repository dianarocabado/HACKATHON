import { cookies } from "next/headers";
import { getAuth, parseCredentials } from "@/lib/server/auth";
import { handle, readBody } from "@/lib/server/http";
import { isSecure, setSession } from "@/lib/server/session";

// POST /api/auth/signup { email, password, name } -> UserProfile, sets the session cookies
export async function POST(request: Request) {
  const jar = await cookies();
  return handle(async () => {
    const { email, password, name } = parseCredentials(await readBody(request), true);
    const session = await getAuth().signUp(email, password, name!);
    setSession(jar, session, isSecure(request));
    return Response.json(session.user, { status: 201 });
  });
}
