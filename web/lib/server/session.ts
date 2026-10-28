// Session cookies for optional accounts. Tokens live in HttpOnly cookies (page scripts cannot read them),
// SameSite=Lax, Secure on https. A short-lived access token plus a 30-day refresh token.
import type { UserProfile } from "@contracts/types";
import type { Auth, Session } from "./auth.ts";

export const ACCESS_COOKIE = "hw_at";
export const REFRESH_COOKIE = "hw_rt";
const REFRESH_MAX_AGE_S = 30 * 24 * 3600;

/** The part of Next's `cookies()` store we use; a plain fake in tests. */
export interface CookieJar {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: Record<string, unknown>): unknown;
  delete(name: string): unknown;
}

const options = (secure: boolean, maxAge: number) => ({ httpOnly: true, sameSite: "lax", secure, path: "/", maxAge });

export function setSession(jar: CookieJar, s: Session, secure: boolean) {
  jar.set(ACCESS_COOKIE, s.accessToken, options(secure, s.expiresIn));
  jar.set(REFRESH_COOKIE, s.refreshToken, options(secure, REFRESH_MAX_AGE_S));
}

export function clearSession(jar: CookieJar) {
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

/**
 * The signed-in user, or null. Refreshes an expired access token and stores the new cookies.
 * If the auth service is unreachable the visitor is treated as signed out for this request,
 * but the cookies are kept so the session survives the outage.
 */
export async function currentUser(jar: CookieJar, auth: Auth, secure: boolean): Promise<UserProfile | null> {
  try {
    const access = jar.get(ACCESS_COOKIE)?.value;
    if (access) {
      const user = await auth.getUser(access);
      if (user) return user;
    }
    const refresh = jar.get(REFRESH_COOKIE)?.value;
    if (!refresh) return null;
    const next = await auth.refresh(refresh);
    if (!next) {
      clearSession(jar);
      return null;
    }
    setSession(jar, next, secure);
    return next.user;
  } catch (err) {
    console.error("session: auth unreachable", err);
    return null;
  }
}

/** Cookies only travel over https in production; local http (npm start, LAN) still works. */
export const isSecure = (request: Request) =>
  new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
