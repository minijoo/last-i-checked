// A tracked coin's key in the stocks stores: "TICKER-CMCID", e.g. "DRB-41909".
// Tickers aren't unique (CMC lists two "DRB"s, sixteen "BTC"s) and can clash
// with US stocks (SOL, ETH), so the CMC id rides along. Safe on both client
// and server.
//
// Coins tracked before the CMC switch were Alpaca pairs ("BTC/USD"); the db
// upgrade moves them to market "crypto" as-is, and they resolve by ticker.

export function cryptoKey(ticker: string, id: number): string {
  return `${ticker.trim().toUpperCase()}-${id}`;
}

/** { ticker, id } — id is null for a legacy "BTC/USD" key (resolve by ticker). */
export function parseCryptoKey(key: string): { ticker: string; id: number | null } {
  const m = /^(.+)-(\d+)$/.exec(key);
  if (m) return { ticker: m[1], id: Number(m[2]) };
  return { ticker: key.split("/")[0], id: null };
}

/** What to show for a tracked symbol: the ticker for crypto, the code otherwise. */
export function displaySymbol(symbol: string, market: string): string {
  return market === "crypto" ? parseCryptoKey(symbol).ticker : symbol;
}
