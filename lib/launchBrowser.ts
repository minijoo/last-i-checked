// Launches the headless Chromium used to scrape custom checks.
//
// @sparticuz/chromium's binary is built for Lambda's Amazon Linux — it does
// not run on macOS/Windows dev machines. So locally we launch playwright-core
// against a plain Chromium (installed once via `npx playwright install
// chromium`, which caches it where playwright-core already knows to look);
// on Vercel we launch it against @sparticuz/chromium's bundled binary. Both
// paths go through the same playwright-core API from here on.

import { chromium, type Browser, type Page } from "playwright-core";

// Extra launch flags used on both the local and Vercel paths:
// - --disable-http2: some sites' edges (Akamai/Cloudflare-style) send Chromium's
//   strict HTTP/2 parser frames it rejects, or kill the h2 connection for
//   headless clients — surfaces as `net::ERR_HTTP2_PROTOCOL_ERROR` on goto().
//   Forcing HTTP/1.1 (which every server also speaks) sidesteps it.
// - --disable-blink-features=AutomationControlled: drops the `navigator.webdriver`
//   automation flag, one of the cheaper bot signals.
const EXTRA_ARGS = [
  "--disable-http2",
  "--disable-blink-features=AutomationControlled",
];

// A plain desktop-Chrome UA. Headless shell reports "HeadlessChrome/…", which
// bot-mitigation edges often refuse or tarpit. Linux to match the deployed
// runtime (@sparticuz/chromium on Amazon Linux).
export const SCRAPE_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const sparticuzChromium = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: [...sparticuzChromium.args, ...EXTRA_ARGS],
      executablePath: await sparticuzChromium.executablePath(),
      headless: true,
    });
  }
  return chromium.launch({ headless: true, args: EXTRA_ARGS });
}

/** A page in a context that looks like a normal browser (real UA + locale). */
export async function openScrapePage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    userAgent: SCRAPE_USER_AGENT,
    locale: "en-US",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  return context.newPage();
}

const RETRYABLE_NAV_ERROR =
  /ERR_HTTP2_PROTOCOL_ERROR|ERR_QUIC_PROTOCOL_ERROR|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_NETWORK_CHANGED|ERR_ABORTED|ERR_TIMED_OUT/;

/** page.goto with one retry on transient transport errors (protocol resets,
 *  connection drops) that frequently succeed on a second attempt. `waitUntil`
 *  "commit" (the default) returns as soon as the navigation commits — pair it
 *  with a wait for the value's selector; use "domcontentloaded" when the caller
 *  needs the parsed DOM right after (e.g. selector suggestion). */
export async function gotoResilient(
  page: Page,
  url: string,
  timeoutMs: number,
  waitUntil: "commit" | "domcontentloaded" | "load" = "commit",
): Promise<void> {
  const opts = { timeout: timeoutMs, waitUntil };
  try {
    await page.goto(url, opts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!RETRYABLE_NAV_ERROR.test(msg)) throw e;
    await page.waitForTimeout(600);
    await page.goto(url, opts);
  }
}
