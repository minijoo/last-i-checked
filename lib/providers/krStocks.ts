// Korean market provider — data.go.kr's Financial Services Commission stock
// price feed (GetStockSecuritiesInfoService_V2). Pure fetch+parse, takes the
// service key explicitly. End-of-day data: `clpr` is the latest close, in KRW.

import type { Result, StockQuote } from "@/lib/types";

const ENDPOINT =
  "https://apis.data.go.kr/1160100/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2";

interface KrItem {
  basDt?: string; // "YYYYMMDD" trading day
  srtnCd?: string; // 6-char short code, e.g. "005930"
  itmsNm?: string; // company name
  clpr?: string; // closing price
}

interface KrResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: { item?: KrItem[] | KrItem } | "" };
  };
  // Gateway-level failures (bad key, quota) come back in this shape instead.
  OpenAPI_ServiceResponse?: { cmmMsgHeader?: { errMsg?: string } };
}

async function fetchOne(
  code: string,
  serviceKey: string,
): Promise<Result<{ quote: StockQuote | null }>> {
  const params = new URLSearchParams({
    serviceKey,
    resultType: "json",
    pageNo: "1",
    // likeSrtnCd is a prefix match that returns one row per trading day; a
    // few rows is enough to find the newest day for the exact code.
    numOfRows: "5",
    likeSrtnCd: code,
  });
  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, error: `data.go.kr responded ${res.status} ${res.statusText}` };
    }
    const json = (await res.json()) as KrResponse;
    const gatewayErr = json.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg;
    if (gatewayErr) return { ok: false, error: `data.go.kr: ${gatewayErr}` };
    const header = json.response?.header;
    if (header?.resultCode !== "00") {
      return { ok: false, error: `data.go.kr: ${header?.resultMsg ?? "unexpected response"}` };
    }
    const items = json.response?.body?.items;
    const raw = items ? items.item : undefined;
    const rows = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
      (r) => r.srtnCd === code,
    );
    const latest = rows.reduce<KrItem | undefined>(
      (best, r) => (!best || (r.basDt ?? "") > (best.basDt ?? "") ? r : best),
      undefined,
    );
    const price = Number(latest?.clpr);
    if (!latest || !Number.isFinite(price)) return { ok: true, quote: null };
    return {
      ok: true,
      quote: { symbol: code, market: "kr", price, name: latest.itmsNm },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error contacting data.go.kr",
    };
  }
}

/** One request per code (the API has no bulk lookup); codes with no rows are
 *  simply absent from `quotes`, like Alpaca's snapshots. */
export async function fetchKrQuotes(
  codes: string[],
  serviceKey: string,
): Promise<Result<{ quotes: StockQuote[] }>> {
  const uniq = [
    ...new Set(codes.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];
  const results = await Promise.all(uniq.map((c) => fetchOne(c, serviceKey)));
  const quotes: StockQuote[] = [];
  for (const r of results) {
    if (!r.ok) return r;
    if (r.quote) quotes.push(r.quote);
  }
  return { ok: true, quotes };
}
