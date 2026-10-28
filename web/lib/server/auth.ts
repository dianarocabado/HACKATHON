// Optional accounts (email + password). With Supabase configured, Supabase Auth holds the users and passwords;
// our server talks to its REST API (GoTrue) with the secret key. Accounts are created through the admin endpoint
// with the email marked confirmed, so sign-up needs no confirmation email (the free plan barely sends any).
// Without Supabase (local demo, tests), MemoryAuth keeps users in process memory with scrypt-hashed passwords.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { UserProfile } from "@contracts/types";
import { ApiError } from "./http.ts";

const TIMEOUT_MS = 8000;

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  user: UserProfile;
}

export interface Auth {
  readonly kind: "memory" | "supabase";
  signUp(email: string, password: string, name: string): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  /** The user for a valid access token, null if the token is invalid or expired. Throws if unreachable. */
  getUser(accessToken: string): Promise<UserProfile | null>;
  /** A fresh session, or null if the refresh token is no longer valid. */
  refresh(refreshToken: string): Promise<Session | null>;
  signOut(accessToken: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
}

export interface Credentials { email: string; password: string; name?: string }

/** Validates sign-up / login input; `requireName` for sign-up. */
export function parseCredentials(body: Record<string, unknown>, requireName: boolean): Credentials {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError(400, "invalid_email");
  if (password.length < 8 || password.length > 72) throw new ApiError(400, "invalid_password");
  if (!requireName) return { email, password };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 40) throw new ApiError(400, "invalid_name");
  return { email, password, name };
}

// ---------- Supabase Auth (GoTrue REST) ----------

interface GoTrueUser { id: string; email?: string; user_metadata?: { name?: unknown } }
interface GoTrueSession { access_token: string; refresh_token: string; expires_in: number; user: GoTrueUser }

const toProfile = (u: GoTrueUser): UserProfile => ({
  id: u.id,
  email: u.email ?? "",
  name: typeof u.user_metadata?.name === "string" ? u.user_metadata.name : (u.email ?? "").split("@")[0],
});

const toSession = (s: GoTrueSession): Session => ({
  accessToken: s.access_token, refreshToken: s.refresh_token, expiresIn: s.expires_in, user: toProfile(s.user),
});

export class SupabaseAuth implements Auth {
  readonly kind = "supabase" as const;
  private url: string;
  private key: string;
  private fetchImpl: typeof fetch;

  constructor(url: string, key: string, fetchImpl: typeof fetch = fetch) {
    this.url = url;
    this.key = key;
    this.fetchImpl = fetchImpl;
  }

  private call(path: string, init: RequestInit & { bearer?: string } = {}): Promise<Response> {
    const { bearer, ...rest } = init;
    return this.fetchImpl(`${this.url}/auth/v1/${path}`, {
      ...rest,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${bearer ?? this.key}`,
        "Content-Type": "application/json",
        ...rest.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  }

  async signUp(email: string, password: string, name: string) {
    const res = await this.call("admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } }),
    });
    if (res.status === 422 || res.status === 409) throw new ApiError(409, "email_taken");
    if (!res.ok) {
      console.error("auth: sign-up failed", res.status, await res.text().catch(() => ""));
      throw new ApiError(502, "auth_unavailable");
    }
    return this.signIn(email, password);
  }

  async signIn(email: string, password: string) {
    const res = await this.call("token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
    if (res.status === 400 || res.status === 401) throw new ApiError(401, "invalid_login");
    if (res.status === 429) throw new ApiError(429, "too_many_attempts");
    if (!res.ok) throw new ApiError(502, "auth_unavailable");
    return toSession((await res.json()) as GoTrueSession);
  }

  async getUser(accessToken: string) {
    const res = await this.call("user", { bearer: accessToken });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new Error(`auth: user lookup ${res.status}`);
    return toProfile((await res.json()) as GoTrueUser);
  }

  async refresh(refreshToken: string) {
    const res = await this.call("token?grant_type=refresh_token", {
      method: "POST", body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (res.status === 400 || res.status === 401) return null;
    if (!res.ok) throw new Error(`auth: refresh ${res.status}`);
    return toSession((await res.json()) as GoTrueSession);
  }

  async signOut(accessToken: string) {
    await this.call("logout?scope=local", { method: "POST", bearer: accessToken }).catch(() => undefined);
  }

  async deleteUser(id: string) {
    const res = await this.call(`admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new ApiError(502, "auth_unavailable");
  }
}

// ---------- in-memory (local demo and tests) ----------

const hash = (password: string, salt: Buffer) => scryptSync(password, salt, 32);

export class MemoryAuth implements Auth {
  readonly kind = "memory" as const;
  private users = new Map<string, UserProfile & { salt: Buffer; hash: Buffer }>(); // by email
  private access = new Map<string, { userId: string; exp: number }>();
  private refreshTokens = new Map<string, string>(); // token -> userId
  private now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  private issue(user: UserProfile): Session {
    const accessToken = randomBytes(24).toString("base64url");
    const refreshToken = randomBytes(24).toString("base64url");
    this.access.set(accessToken, { userId: user.id, exp: this.now() + 3600_000 });
    this.refreshTokens.set(refreshToken, user.id);
    return { accessToken, refreshToken, expiresIn: 3600, user: { id: user.id, email: user.email, name: user.name } };
  }

  private byId(id: string) {
    return [...this.users.values()].find((u) => u.id === id);
  }

  async signUp(email: string, password: string, name: string) {
    if (this.users.has(email)) throw new ApiError(409, "email_taken");
    const salt = randomBytes(16);
    const user = { id: randomUUID(), email, name, salt, hash: hash(password, salt) };
    this.users.set(email, user);
    return this.issue(user);
  }

  async signIn(email: string, password: string) {
    const user = this.users.get(email);
    if (!user || !timingSafeEqual(hash(password, user.salt), user.hash)) throw new ApiError(401, "invalid_login");
    return this.issue(user);
  }

  async getUser(accessToken: string) {
    const t = this.access.get(accessToken);
    if (!t || t.exp < this.now()) return null;
    const u = this.byId(t.userId);
    return u ? { id: u.id, email: u.email, name: u.name } : null;
  }

  async refresh(refreshToken: string) {
    const userId = this.refreshTokens.get(refreshToken);
    const user = userId ? this.byId(userId) : undefined;
    if (!user) return null;
    this.refreshTokens.delete(refreshToken); // rotate
    return this.issue(user);
  }

  async signOut(accessToken: string) {
    this.access.delete(accessToken);
  }

  async deleteUser(id: string) {
    const u = this.byId(id);
    if (u) this.users.delete(u.email);
  }
}

export function createAuth(env: Record<string, string | undefined> = process.env): Auth {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (env.STORE === "supabase" && url && key) return new SupabaseAuth(url.replace(/\/$/, ""), key);
  return new MemoryAuth();
}

const g = globalThis as typeof globalThis & { __hwAuth?: Auth };

export function getAuth(): Auth {
  g.__hwAuth ??= createAuth();
  return g.__hwAuth;
}
