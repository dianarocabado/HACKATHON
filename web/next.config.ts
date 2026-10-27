import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // API routes read pipeline output with fs (e.g. lib/server/sensors.ts); ship it with the functions.
  outputFileTracingIncludes: {
    "/api/**": ["./public/data/**/*.json"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
