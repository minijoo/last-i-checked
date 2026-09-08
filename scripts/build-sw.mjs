// Bundles sw/index.ts (+ the lib code it imports: autocheck, autocheckTick,
// fetchers, store/Dexie) into public/sw.js. Run by the predev / prebuild npm
// hooks. See docs/autocheck.md, Phase B.

import { build } from "esbuild";

await build({
  entryPoints: ["sw/index.ts"],
  outfile: "public/sw.js",
  bundle: true,
  format: "iife",
  target: "es2022",
  platform: "browser",
  minify: process.env.NODE_ENV === "production",
  // Replace every process.env ref the bundled lib code touches with a literal —
  // the SW has no `process`, so a bare reference would throw at eval time.
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "development",
    ),
    "process.env.NEXT_PUBLIC_VERCEL_ENV": JSON.stringify(
      process.env.NEXT_PUBLIC_VERCEL_ENV ?? "",
    ),
    "process.env.NEXT_PUBLIC_DEV_TOOLS": JSON.stringify(
      process.env.NEXT_PUBLIC_DEV_TOOLS ?? "",
    ),
  },
  logLevel: "info",
});
