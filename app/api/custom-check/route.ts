// Scrapes one custom check: loads `url` in a headless browser, waits for
// `selector` to appear (this doubles as the "wait for initial JS" step — no
// separate networkidle wait needed), and reads its text. Always returns the
// raw text as-is — number extraction is a separate, client-side step (see
// lib/customExtract.ts) run against that text, both for the add form's "Try
// Extract" preview and for every later fetch of a tracked number check. A
// Route Handler rather than a Server Action: Next.js dispatches Server
// Actions one at a time per client, which would serialize concurrent
// per-card fetches; a plain fetch() from the client runs independently. See
// docs/plan.md "Custom URL Checks — Technical Approach".

import { gotoResilient, launchBrowser, openScrapePage } from "@/lib/launchBrowser";
import { assertPublicUrl } from "@/lib/ssrfGuard";
import type { CustomScrapeResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const NAV_TIMEOUT_MS = 20_000;
const SELECTOR_TIMEOUT_MS = 15_000;

interface RequestBody {
  url?: string;
  selector?: string;
}

function fail(error: string, rawText = ""): Response {
  const body: CustomScrapeResult = { ok: false, rawText, error };
  return Response.json(body);
}

export async function POST(request: Request): Promise<Response> {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.");
  }

  const { url, selector } = body;
  if (!url || !selector) {
    return fail("Missing url or selector.");
  }

  const guard = await assertPublicUrl(url);
  if (!guard.ok) return fail(guard.error);

  let browser;
  try {
    browser = await launchBrowser();
  } catch (e) {
    return fail(
      e instanceof Error ? `Couldn't launch the browser: ${e.message}` : "Couldn't launch the browser.",
    );
  }

  try {
    const page = await openScrapePage(browser);
    try {
      await gotoResilient(page, url, NAV_TIMEOUT_MS);
      const el = await page.waitForSelector(selector, { timeout: SELECTOR_TIMEOUT_MS });
      const rawText = (await el.textContent()) ?? "";
      const result: CustomScrapeResult = { ok: true, rawText };
      return Response.json(result);
    } finally {
      await page.close();
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Fetch failed.");
  } finally {
    await browser.close();
  }
}
