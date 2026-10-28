import { cookies } from "next/headers";
import { getAuth, parseCredentials } from "@/lib/server/auth";
import { handle, readBody } from "@/lib/server/http";
import { isSecure, setSession } from "@/lib/server/session";

// POST /api/auth/login { email, password } -> UserProfile, sets the session cookies
export async function POST(request: Request) {
  const jar = await cookies();
  return handle(async () => {
    const { email, password } = parseCredentials(await readBody(request), false);
    const session = await getAuth().signIn(email, password);
    setSession(jar, session, isSecure(request));
    return Response.json(session.user);
  });
}
