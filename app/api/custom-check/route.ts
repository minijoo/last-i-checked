// Scrapes one custom check: loads `url` in a headless browser, waits for
// `selector` to appear (this doubles as the "wait for initial JS" step — no
// separate networkidle wait needed), and reads its text. A Route Handler
// rather than a Server Action: Next.js dispatches Server Actions one at a
// time per client, which would serialize concurrent per-card fetches; a
// plain fetch() from the client runs independently. See docs/plan.md
// "Custom URL Checks — Technical Approach".

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
  valueType?: "number" | "text";
}

function parseValue(
  rawText: string,
  valueType: "number" | "text",
): { value: number | string | null; error?: string } {
  const trimmed = rawText.trim();
  if (valueType === "text") return { value: trimmed };
  const cleaned = trimmed.replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) {
    return { value: null, error: `Couldn't parse a number from "${trimmed}".` };
  }
  return { value: n };
}

function fail(error: string, rawText = ""): Response {
  const body: CustomScrapeResult = { ok: false, rawText, value: null, error };
  return Response.json(body);
}

export async function POST(request: Request): Promise<Response> {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.");
  }

  const { url, selector, valueType } = body;
  if (!url || !selector || (valueType !== "number" && valueType !== "text")) {
    return fail("Missing url, selector, or valueType.");
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
      const parsed = parseValue(rawText, valueType);
      if (parsed.error) return fail(parsed.error, rawText);
      const result: CustomScrapeResult = { ok: true, rawText, value: parsed.value };
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
