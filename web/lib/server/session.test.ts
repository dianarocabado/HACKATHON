import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryAuth, type Auth } from "./auth.ts";
import { ACCESS_COOKIE, REFRESH_COOKIE, currentUser, setSession, type CookieJar } from "./session.ts";

class Jar implements CookieJar {
  values = new Map<string, string>();
  options = new Map<string, Record<string, unknown>>();
  get(name: string) { const v = this.values.get(name); return v === undefined ? undefined : { value: v }; }
  set(name: string, value: string, options: Record<string, unknown>) { this.values.set(name, value); this.options.set(name, options); }
  delete(name: string) { this.values.delete(name); }
}

test("no cookies: signed out", async () => {
  assert.equal(await currentUser(new Jar(), new MemoryAuth(), true), null);
});

test("session cookies are HttpOnly, Lax, Secure on https; valid access token gives the user", async () => {
  const auth = new MemoryAuth();
  const jar = new Jar();
  setSession(jar, await auth.signUp("a@b.de", "longenough", "Ana"), true);
  assert.deepEqual(jar.options.get(ACCESS_COOKIE), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 3600 });
  assert.equal(jar.options.get(REFRESH_COOKIE)?.maxAge, 30 * 24 * 3600);
  assert.equal((await currentUser(jar, auth, true))?.name, "Ana");
});

test("expired access token is refreshed and the new cookies are stored", async () => {
  let now = 0;
  const auth = new MemoryAuth(() => now);
  const jar = new Jar();
  setSession(jar, await auth.signUp("a@b.de", "longenough", "Ana"), false);
  const oldAccess = jar.get(ACCESS_COOKIE)!.value;
  now = 2 * 3600_000;
  assert.equal((await currentUser(jar, auth, false))?.email, "a@b.de");
  assert.notEqual(jar.get(ACCESS_COOKIE)!.value, oldAccess);
});

test("invalid refresh token clears the cookies; unreachable auth keeps them", async () => {
  const jar = new Jar();
  jar.set(ACCESS_COOKIE, "bad", {});
  jar.set(REFRESH_COOKIE, "bad", {});
  assert.equal(await currentUser(jar, new MemoryAuth(), true), null);
  assert.equal(jar.get(REFRESH_COOKIE), undefined);

  const down = { getUser: async () => { throw new Error("offline"); } } as unknown as Auth;
  const kept = new Jar();
  kept.set(ACCESS_COOKIE, "at", {});
  kept.set(REFRESH_COOKIE, "rt", {});
  assert.equal(await currentUser(kept, down, true), null);
  assert.equal(kept.get(REFRESH_COOKIE)?.value, "rt");
});
