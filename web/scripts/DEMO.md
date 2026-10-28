# Running the demo locally

No Vercel or Supabase: the app runs on one laptop with the in-memory store.

1. `web/.env.local` (git-ignored):
   ```
   STORE=memory
   NEXT_PUBLIC_USE_MOCK=false
   ```
   `NEXT_PUBLIC_USE_MOCK=false` is read at build time, so rebuild after changing it.
2. Build and start (the build copies `data/processed` into `public/data` first):
   ```
   cd web
   npm install
   npm run build
   npm start            # http://localhost:3000
   ```
3. In a second terminal, load the demo reports:
   ```
   npm run demo:seed    # resets, then adds 22 seeded reports (~2 s)
   ```
4. Between rehearsals: `npm run demo:seed` again (it resets first), or `npm run demo:reset` for an empty start.

## What the seed contains
- 22 voice reports at real Heilbronn places, in German, Swabian and English, spread over the last ~2 days. All carry `seeded: true`.
- Each of the three demo places in `demo-places.md` (Etzelstraße, Harmonie, Theodor-Heuss-Gymnasium) has exactly one earlier report at its exact coordinates. The live report on stage is the second in that hexagon, so it does not trigger a report mission by surprise. Real senseBoxes are within 80 m of all three places (OpenSpace, Innenstadt, Schulgarten), so the sensor check can answer live.
- They go through the normal pipeline: keyword/LLM structuring, a **live** sensor check against openSenseMap, and H3. Sensor results reflect today's real values.
- Three noise reports at the Allee form a cluster, so the "Meldungen prüfen: Lärm" mission (A12) appears. It is `simulated: true` because it depends on seeded reports.

## QR posters (`/qr`)
The posters encode `<address>/report?lat=…&lng=…&place=…`. The address is `NEXT_PUBLIC_SITE_URL` if set, otherwise whatever address `/qr` was opened with. Never print from `http://localhost:3000`, because phones can't reach it.
- **Local demo (no deployment):** open `/qr` via the laptop's Wi-Fi address, e.g. `http://192.168.0.186:3000/qr` (`npm start` prints it as "Network"), then print. Phones on the same Wi-Fi open the report page; the microphone needs `https`, so they use the typed fallback. The IP can change after a restart or on another network (e.g. the venue's), so print on the network you present on.
- **Deployed (A14):** set `NEXT_PUBLIC_SITE_URL=https://<project>.vercel.app` in Vercel, redeploy (it's read at build time), open `/qr` on the live site and print.

## Deploying to Vercel (A14, optional)
1. Vercel → Add New → Project → import `dianarocabado/HACKATHON`. Root Directory: `web` (leave "include files outside the root directory" on; the app reads `contracts/` and `data/processed/`).
2. Environment variables: `NEXT_PUBLIC_USE_MOCK=false`, `STORE=memory` (or `supabase` with the three Supabase keys), optional `LLM_*`, `DEMO_KEY`.
3. Deploy, then set `NEXT_PUBLIC_SITE_URL` to the live URL and redeploy.
4. Seed: `npm run demo:seed -- https://<project>.vercel.app` (with `DEMO_KEY` set in the terminal if it's set on Vercel).

With `STORE=memory` on Vercel, each serverless instance has its own memory: reports can vanish between requests or after a cold start. That's fine for a quick look; for the live demo use Supabase (`web/lib/server/supabase.sql`) or the local laptop setup above.

## Notes
- Memory data is lost when the server stops. Run `npm run demo:seed` after every restart.
- Phones on the same Wi-Fi can open `http://<laptop-ip>:3000`. Browsers only allow the microphone on `https` or `localhost`, so test voice on the laptop itself or use the typed fallback.
- If `DEMO_KEY` is set on the server, set the same `DEMO_KEY` in the terminal before `npm run demo:seed`.
