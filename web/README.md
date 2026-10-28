# Heilbronn wirkt – web app

Live: **https://heilbronn-wirkt.vercel.app** (Vercel project `heilbronn-wirkt`, team `EU`).
Local demo without internet services: [scripts/DEMO.md](scripts/DEMO.md).

## Local development

```bash
cd web
npm install
npm run dev        # http://localhost:3000, copies data/processed to public/data first
npm test           # node --test
npm run lint && npx tsc --noEmit && npm run build
```

Settings go in `web/.env.local` (git-ignored); every variable is listed in [`../.env.example`](../.env.example).

## Production setup (#16)

| Part | Where | Notes |
| --- | --- | --- |
| Hosting | Vercel, Root Directory `web`, Node 24, functions in `fra1` ([vercel.json](vercel.json)) | Deployed from the repo root, so `../contracts` and `../data/processed` are included; [`.vercelignore`](../.vercelignore) keeps secrets and `data/raw` out. |
| Database | Supabase, region Frankfurt | Tables from [lib/server/supabase.sql](lib/server/supabase.sql), run once in the SQL editor. |
| Speech-to-text fallback | Groq Whisper (`STT_API_KEY`) | `GET /api/transcribe` returns `{"available":true}` when set. |

Environment variables (Vercel → Project → Settings → Environment Variables, Production):

| Name | Value |
| --- | --- |
| `STORE` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-id>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key (`sb_secret_…`) |
| `STT_API_KEY` | Groq API key (`gsk_…`) |
| `NEXT_PUBLIC_USE_MOCK` | `false` |
| `NEXT_PUBLIC_SITE_URL` | `https://heilbronn-wirkt.vercel.app` (used by the QR posters) |
| `DEMO_KEY` | any secret; protects `/api/demo/*` |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | optional; without them reports are structured by keywords |

`NEXT_PUBLIC_*` values are read at build time: redeploy after changing them.

### Redeploy

If the GitHub repo is connected to the Vercel project (Settings → Git), every merge to `main` deploys by itself.
Otherwise, from the repo root on a laptop logged in with `vercel login`:

```bash
vercel link --yes --scope eu-d572 --project heilbronn-wirkt   # once per laptop
vercel deploy --prod
```

### Setting variables from Windows PowerShell

Use `--value`. Piping (`"x" | vercel env add …`) appends a line break in PowerShell 5.1, which silently breaks the
value (e.g. `STORE=supabase\r` falls back to memory and `DEMO_KEY` stops matching).

```powershell
vercel env add STORE --environment production --value supabase --force --yes
```

### Demo data on the live site

```bash
# DEMO_KEY must match the value in Vercel
DEMO_KEY=… npm run demo:seed -- https://heilbronn-wirkt.vercel.app    # reset + 22 seeded reports
DEMO_KEY=… npm run demo:reset -- https://heilbronn-wirkt.vercel.app   # empty start
```

### Checks after a deploy

- `/api/health` → 200, `/api/transcribe` → `{"available":true}`
- POST a report, then GET `/api/reports` several times: it is always there (Supabase, not per-instance memory).
- `/qr` and `/screen` show QR codes with the vercel.app address.
- Testing Supabase by hand: send the secret key with a non-browser client (`curl`). Supabase answers 401 to secret
  keys from browser-like user agents, which includes PowerShell's `Invoke-WebRequest`.

### QR posters

Print from **https://heilbronn-wirkt.vercel.app/qr**. Posters printed earlier from a laptop address point to that laptop.
