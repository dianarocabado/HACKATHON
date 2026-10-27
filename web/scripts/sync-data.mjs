// A7: copy pipeline output (data/processed/*) to web/public/data/ so the app can fetch it statically.
// Runs automatically before `npm run dev` and `npm run build`.
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(webDir, "..", "data", "processed");
const dest = join(webDir, "public", "data");

if (!existsSync(src)) {
  console.warn(`sync-data: ${src} not found, skipping`);
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, {
  recursive: true,
  filter: (path) => !path.endsWith(".gitkeep"),
});

const files = readdirSync(dest, { recursive: true }).filter((f) => String(f).endsWith(".json"));
console.log(`sync-data: copied ${files.length} files to public/data`);
