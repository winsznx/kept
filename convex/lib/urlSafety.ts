export const MAX_URL_LENGTH = 2048;

export type UrlCheck = { ok: true; url: string; domain: string } | { ok: false; reason: string };

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback", "metadata.google.internal"]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet", ".corp"];

function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || /^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host);
}

/**
 * SSRF guard applied before any URL reaches Firecrawl (PRD 12.5, 20.5): http(s) only,
 * no credentials, no loopback/private/link-local/metadata hosts, no IP literals, a
 * public-looking dotted hostname, bounded length. Returns a normalized URL for dedupe.
 */
export function validatePublicUrl(raw: string): UrlCheck {
  const input = raw.trim();
  if (input.length === 0) return { ok: false, reason: "empty" };
  if (input.length > MAX_URL_LENGTH) return { ok: false, reason: "too_long" };
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return { ok: false, reason: "unparseable" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "scheme_not_allowed" };
  if (u.username || u.password) return { ok: false, reason: "credentials_not_allowed" };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return { ok: false, reason: "private_host" };
  if (isIpLiteral(host)) return { ok: false, reason: isPrivateIPv4(host) ? "private_host" : "ip_literal_not_allowed" };
  if (!host.includes(".") || !/^[a-z0-9.-]+$/.test(host)) return { ok: false, reason: "invalid_hostname" };
  if (u.port && u.port !== "80" && u.port !== "443") return { ok: false, reason: "port_not_allowed" };
  u.hash = "";
  u.hostname = host;
  return { ok: true, url: u.toString(), domain: host.replace(/^www\./, "") };
}

/** Registrable-domain match used for first-party classification (e.g. "t-mobile.com"). */
export function domainMatches(domain: string, providerDomains: readonly string[]): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return providerDomains.some((p) => {
    const q = p.toLowerCase().replace(/^www\./, "");
    return d === q || d.endsWith(`.${q}`);
  });
}
