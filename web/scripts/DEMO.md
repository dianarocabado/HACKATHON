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
   npm run demo:seed    # resets, then adds 20 seeded reports (~2 s)
   ```
4. Between rehearsals: `npm run demo:seed` again (it resets first), or `npm run demo:reset` for an empty start.

## What the seed contains
- 20 voice reports at real Heilbronn places, in German, Swabian and English, spread over the last ~2 days. All carry `seeded: true`.
- They go through the normal pipeline: keyword/LLM structuring, a **live** sensor check against openSenseMap, and H3. Sensor results reflect today's real values.
- Three noise reports at the Allee form a cluster, so the "Meldungen prüfen: Lärm" mission (A12) appears. It is `simulated: true` because it depends on seeded reports.

## Notes
- Memory data is lost when the server stops. Run `npm run demo:seed` after every restart.
- Phones on the same Wi-Fi can open `http://<laptop-ip>:3000`. Browsers only allow the microphone on `https` or `localhost`, so test voice on the laptop itself or use the typed fallback.
- If `DEMO_KEY` is set on the server, set the same `DEMO_KEY` in the terminal before `npm run demo:seed`.
