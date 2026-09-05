// Suggests a CSS selector from a plain-language description of the value,
// for users who don't want to touch devtools. Claude never drives the
// browser: this route extracts a list of {index, text} candidates from the
// live page (deterministic, in-page JS — lib/extractCandidates.ts) and asks
// one Messages API call to pick the matching index. See docs/plan.md
// "AI-Assisted Selector Suggestion — Technical Approach".

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { extractCandidates } from "@/lib/extractCandidates";
import { launchBrowser } from "@/lib/launchBrowser";
import { assertPublicUrl } from "@/lib/ssrfGuard";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CANDIDATES = 200;
const NAV_TIMEOUT_MS = 20_000;

const NO_KEY =
  "ANTHROPIC_API_KEY not set. Add it to .env.local and restart the dev server.";

const SuggestionSchema = z.object({
  index: z.number().int().nullable(),
  confidence: z.enum(["high", "low"]),
});

interface RequestBody {
  url?: string;
  description?: string;
  valueType?: "number" | "text";
}

function fail(error: string): Response {
  return Response.json({ ok: false, error });
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail(NO_KEY);

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.");
  }

  const { url, description, valueType } = body;
  if (!url || !description || (valueType !== "number" && valueType !== "text")) {
    return fail("Missing url, description, or valueType.");
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
    const page = await browser.newPage();
    try {
      await page.goto(url, { timeout: NAV_TIMEOUT_MS, waitUntil: "domcontentloaded" });
      const title = await page.title();
      const candidates = await page.evaluate(extractCandidates, MAX_CANDIDATES);

      if (candidates.length === 0) {
        return fail("Couldn't find any readable text on that page.");
      }

      const client = new Anthropic({ apiKey });
      const response = await client.messages.parse({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        output_config: {
          format: zodOutputFormat(SuggestionSchema),
          effort: "low",
        },
        system:
          "You are matching a natural-language description of a value to the " +
          "single best entry in a numbered list of text snippets pulled from a " +
          "web page. Return the index of the one snippet whose text is the value " +
          "the user described, or null if nothing clearly matches. Prefer an " +
          "exact, specific match over a loosely related one. The user wants a " +
          `${valueType.toUpperCase()} value.`,
        messages: [
          {
            role: "user",
            content:
              `Page title: ${title}\n` +
              `Value the user is looking for: "${description}"\n\n` +
              "Candidates:\n" +
              candidates.map((c) => `${c.index}: ${c.text}`).join("\n"),
          },
        ],
      });

      const suggestion = response.parsed_output;
      if (!suggestion || suggestion.index === null) {
        return fail(
          "Couldn't confidently match that description to anything on the page. Try rephrasing, or use devtools.",
        );
      }
      const match = candidates[suggestion.index];
      if (!match) {
        return fail("The model returned an out-of-range match.");
      }

      // Defensive re-check: confirm the selector still resolves to exactly
      // one element on the still-open page before handing it back.
      const count = await page.locator(match.selector).count();
      if (count !== 1) {
        return fail("That selector no longer uniquely matches the page — try again.");
      }

      return Response.json({
        ok: true,
        selector: match.selector,
        matchedText: match.text,
        confidence: suggestion.confidence,
      });
    } finally {
      await page.close();
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Suggestion failed.");
  } finally {
    await browser.close();
  }
}
