// Guards the custom-check scraper against SSRF: the server fetches whatever
// URL a user types in, so before navigating we resolve the hostname and
// reject anything pointing at a private, loopback, or link-local address —
// most importantly 169.254.169.254, the cloud metadata endpoint on
// Vercel/AWS/GCP. See docs/plan.md "Custom URL Checks — Technical Approach".

import { lookup } from "node:dns/promises";

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p))) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0) return true; // "this network"
  if (a === 10) return true; // RFC1918 private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 private
  if (a === 192 && b === 168) return true; // RFC1918 private
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr === "::1") return true; // loopback
  if (addr.startsWith("::ffff:")) {
    return isPrivateIPv4(addr.slice("::ffff:".length)); // IPv4-mapped
  }
  if (/^fe[89ab][0-9a-f]:/.test(addr)) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true; // fc00::/7 unique local
  return false;
}

export type SsrfCheck = { ok: true } | { ok: false; error: string };

/** Resolves the URL's hostname and rejects private/loopback/link-local targets. */
export async function assertPublicUrl(rawUrl: string): Promise<SsrfCheck> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Not a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http:// and https:// URLs are allowed." };
  }
  if (url.hostname.toLowerCase() === "localhost") {
    return { ok: false, error: "That host isn't allowed." };
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    return { ok: false, error: `Could not resolve "${url.hostname}".` };
  }
  for (const { address, family } of addresses) {
    const isPrivate = family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address);
    if (isPrivate) {
      return {
        ok: false,
        error: "That URL resolves to a private or internal address, which isn't allowed.",
      };
    }
  }
  return { ok: true };
}
