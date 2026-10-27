import path from "node:path";
import type { NextConfig } from "next";

// web/ imports ../contracts (types + samples), so bundle and trace from the repo root (issue #38).
const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // API routes read pipeline output with fs (e.g. lib/server/sensors.ts); ship it with the functions.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/api/**": ["./public/data/**/*.json", "../contracts/samples/missions.json"],
  },
  turbopack: {
    root: repoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
