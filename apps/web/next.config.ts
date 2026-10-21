import path from "node:path";
import type { NextConfig } from "next";

// The app lives in apps/web of a pnpm workspace; the lockfile and the hoisted packages sit at the repo root.
const repoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  cacheComponents: true,
  partialPrefetching: true,
  // The demo runs from `next dev`: keep the dev badge ("Cache disabled" after a hard reload) off the page.
  // Compile and runtime errors still show.
  devIndicators: false,
  // The dev server watches files by events, and in some folders it misses a file that was replaced on
  // disk: under OneDrive on Windows a pulled or tool-edited stylesheet kept being served stale until
  // a restart. Set NEXT_WATCH_POLL_MS (for example 1000) in .env.local to poll instead. Polling costs
  // CPU, so it is off unless asked for.
  watchOptions: process.env.NEXT_WATCH_POLL_MS
    ? { pollIntervalMs: Number(process.env.NEXT_WATCH_POLL_MS) }
    : undefined,
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
