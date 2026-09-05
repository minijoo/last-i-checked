// Launches the headless Chromium used to scrape custom checks.
//
// @sparticuz/chromium's binary is built for Lambda's Amazon Linux — it does
// not run on macOS/Windows dev machines. So locally we launch playwright-core
// against a plain Chromium (installed once via `npx playwright install
// chromium`, which caches it where playwright-core already knows to look);
// on Vercel we launch it against @sparticuz/chromium's bundled binary. Both
// paths go through the same playwright-core API from here on.

import { chromium, type Browser } from "playwright-core";

export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const sparticuzChromium = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: sparticuzChromium.args,
      executablePath: await sparticuzChromium.executablePath(),
      headless: true,
    });
  }
  return chromium.launch({ headless: true });
}
