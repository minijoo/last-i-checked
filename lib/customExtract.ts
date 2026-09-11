// Turns the raw text a custom check's selector matched into a number, per a
// user-chosen rule. The scrape route (app/api/custom-check) never parses
// numbers itself — it always hands back rawText — so this is the one place
// that does, shared by the add-form's "Try Extract" preview and every later
// fetch of a tracked number check (lib/fetchers.ts), which keeps a check's
// extraction rule applied consistently over its whole history.

export type NumberExtractMethod =
  | "asis"
  | "first"
  | "second"
  | "third"
  | "fourth"
  | "regex";

export const EXTRACT_METHOD_LABEL: Record<NumberExtractMethod, string> = {
  asis: "As-is",
  first: "First number",
  second: "Second number",
  third: "Third number",
  fourth: "Fourth number",
  regex: "Regex",
};

export const EXTRACT_METHODS = Object.keys(
  EXTRACT_METHOD_LABEL,
) as NumberExtractMethod[];

// One "number occurrence" in free text: an optional sign, digits (optionally
// thousands-grouped with commas), optionally a decimal fraction. Each match is
// one occurrence — "1,300" is the one number, not four digits.
const NUMBER_TOKEN = /-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;

const ORDINAL_INDEX: Partial<Record<NumberExtractMethod, number>> = {
  first: 0,
  second: 1,
  third: 2,
  fourth: 3,
};

export interface ExtractResult {
  value: number | null;
  error?: string;
}

function toNumber(token: string): number | null {
  const n = parseFloat(token.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Extracts a number from scraped text per `method`. `regexPattern` is only
 *  read when `method === "regex"`. Pure and synchronous — no fetch involved,
 *  since it always runs against text a scrape already returned. */
export function extractNumber(
  rawText: string,
  method: NumberExtractMethod,
  regexPattern?: string,
): ExtractResult {
  const text = rawText.trim();

  if (method === "asis") {
    // The original (and still the default) behavior: strip everything but
    // digits, ".", and "-", then parse whatever's left.
    const n = toNumber(text.replace(/[^0-9.-]/g, ""));
    return n === null
      ? { value: null, error: `Couldn't parse a number from "${text}".` }
      : { value: n };
  }

  if (method === "regex") {
    const pattern = (regexPattern ?? "").trim();
    if (!pattern) return { value: null, error: "Enter a regex pattern." };
    let re: RegExp;
    try {
      re = new RegExp(pattern);
    } catch (e) {
      return {
        value: null,
        error: e instanceof Error ? `Invalid regex: ${e.message}` : "Invalid regex.",
      };
    }
    const m = re.exec(text);
    if (!m) return { value: null, error: `Regex didn't match "${text}".` };
    // Prefer a capture group when the pattern has one, else the whole match.
    const matchText = m[1] ?? m[0];
    const n = toNumber(matchText);
    return n === null
      ? { value: null, error: `Regex matched "${matchText}", which isn't a number.` }
      : { value: n };
  }

  const idx = ORDINAL_INDEX[method];
  if (idx === undefined) return { value: null, error: "Unknown extraction method." };
  const token = [...text.matchAll(NUMBER_TOKEN)][idx]?.[0];
  if (!token) {
    return {
      value: null,
      error: `Couldn't find a ${EXTRACT_METHOD_LABEL[method].toLowerCase()} in "${text}".`,
    };
  }
  const n = toNumber(token);
  return n === null
    ? { value: null, error: `"${token}" isn't a number.` }
    : { value: n };
}
