import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryAuth, SupabaseAuth, parseCredentials } from "./auth.ts";
import { ApiError } from "./http.ts";

const status = (fn: () => unknown) => {
  try { fn(); } catch (e) { return (e as ApiError).message; }
  return "ok";
};

test("credentials are validated and the email normalised", () => {
  assert.deepEqual(parseCredentials({ email: " Ana@Example.org ", password: "longenough", name: " Ana " }, true),
    { email: "ana@example.org", password: "longenough", name: "Ana" });
  assert.equal(status(() => parseCredentials({ email: "nope", password: "longenough" }, false)), "invalid_email");
  assert.equal(status(() => parseCredentials({ email: "a@b.de", password: "short" }, false)), "invalid_password");
  assert.equal(status(() => parseCredentials({ email: "a@b.de", password: "longenough" }, true)), "invalid_name");
  assert.deepEqual(parseCredentials({ email: "a@b.de", password: "longenough" }, false), { email: "a@b.de", password: "longenough" });
});

test("memory auth: sign up, sign in, wrong password, duplicate email, refresh rotates, delete", async () => {
  const auth = new MemoryAuth();
  const s = await auth.signUp("a@b.de", "longenough", "Ana");
  assert.equal((await auth.getUser(s.accessToken))?.name, "Ana");
  await assert.rejects(auth.signUp("a@b.de", "other-pass", "X"), /email_taken/);
  await assert.rejects(auth.signIn("a@b.de", "wrong-pass"), /invalid_login/);
  const again = await auth.signIn("a@b.de", "longenough");
  assert.equal(again.user.id, s.user.id);
  const fresh = await auth.refresh(again.refreshToken);
  assert.ok(fresh && fresh.accessToken !== again.accessToken);
  assert.equal(await auth.refresh(again.refreshToken), null); // used once
  await auth.deleteUser(s.user.id);
  assert.equal(await auth.getUser(fresh!.accessToken), null);
  await assert.rejects(auth.signIn("a@b.de", "longenough"), /invalid_login/);
});

test("memory auth: access tokens expire after an hour", async () => {
  let now = 0;
  const auth = new MemoryAuth(() => now);
  const s = await auth.signUp("a@b.de", "longenough", "Ana");
  now = 3600_001;
  assert.equal(await auth.getUser(s.accessToken), null);
});

test("supabase auth: admin sign-up with confirmed email, then password grant; errors mapped", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const session = { access_token: "at", refresh_token: "rt", expires_in: 3600, user: { id: "u1", email: "a@b.de", user_metadata: { name: "Ana" } } };
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith("/admin/users")) return new Response("{}", { status: 200 });
    if (url.includes("grant_type=password")) {
      const { password } = JSON.parse(String(init.body));
      return password === "longenough" ? Response.json(session) : new Response("{}", { status: 400 });
    }
    if (url.endsWith("/user")) return (init.headers as Record<string, string>).Authorization === "Bearer at"
      ? Response.json(session.user) : new Response("{}", { status: 401 });
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  const auth = new SupabaseAuth("https://x.supabase.co", "sb_secret_k", fake);

  const s = await auth.signUp("a@b.de", "longenough", "Ana");
  assert.deepEqual(s.user, { id: "u1", email: "a@b.de", name: "Ana" });
  const created = JSON.parse(String(calls[0].init.body));
  assert.equal(created.email_confirm, true);
  assert.deepEqual(created.user_metadata, { name: "Ana" });
  assert.equal((calls[0].init.headers as Record<string, string>).apikey, "sb_secret_k");

  await assert.rejects(auth.signIn("a@b.de", "wrong-pass"), /invalid_login/);
  assert.equal((await auth.getUser("at"))?.email, "a@b.de");
  assert.equal(await auth.getUser("expired"), null);

  const taken = new SupabaseAuth("https://x", "k", (async () => new Response("{}", { status: 422 })) as typeof fetch);
  await assert.rejects(taken.signUp("a@b.de", "longenough", "Ana"), /email_taken/);
});
