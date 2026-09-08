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
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "development",
    ),
  },
  logLevel: "info",
});
