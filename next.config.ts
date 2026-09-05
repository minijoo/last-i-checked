import type { NextConfig } from "next";

// Both browser-launching routes need these two packages' non-JS assets
// (playwright-core's browsers.json, @sparticuz/chromium's bin/ directory
// holding the compressed Chromium binary) copied into the deployed function.
// Next's build-time file tracer (@vercel/nft) doesn't follow how either
// package locates these files at runtime, so without this they're silently
// dropped — works in `next build` and local dev, only fails in production
// ("Cannot find module '.../playwright-core/browsers.json'", or "@sparticuz/
// chromium/bin does not exist"). See docs/plan.md "Custom URL Checks —
// Technical Approach".
const BROWSER_ASSETS = [
  "./node_modules/playwright-core/**/*",
  "./node_modules/@sparticuz/chromium/**/*",
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/custom-check": BROWSER_ASSETS,
    "/api/custom-check/suggest-selector": BROWSER_ASSETS,
  },
};

export default nextConfig;
