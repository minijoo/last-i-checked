// The list of currencies Frankfurter supports (dropdown options). It changes
// roughly never, so let the browser hold it for a day.

import { fetchCurrencies } from "@/lib/providers/currency";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const result = await fetchCurrencies();
  return Response.json(result, {
    headers: result.ok ? { "Cache-Control": "public, max-age=86400" } : {},
  });
}
