import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // playwright-core reads browsers.json (and a few other package-root files)
  // at runtime via a path Next's static tracer (@vercel/nft) doesn't follow,
  // so it's silently dropped from the Vercel function bundle without this —
  // surfaces in prod as "Cannot find module '.../playwright-core/browsers.json'".
  // See docs/plan.md "Custom URL Checks — Technical Approach".
  outputFileTracingIncludes: {
    "/api/custom-check": ["./node_modules/playwright-core/**/*"],
    "/api/custom-check/suggest-selector": ["./node_modules/playwright-core/**/*"],
  },
};

export default nextConfig;
