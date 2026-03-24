import { isIPv4, isIPv6 } from 'net';
import * as dns from 'dns/promises';

const BLOCKED_HOSTNAMES = new Set(['localhost']);

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** RFC4193 unique local and link-local etc. */
function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice(7);
    if (isIPv4(v4)) return isPrivateOrReservedIpv4(v4);
  }
  return false;
}

function ipLooksBlocked(ip: string): boolean {
  if (isIPv4(ip)) return isPrivateOrReservedIpv4(ip);
  if (isIPv6(ip)) return isBlockedIpv6(ip);
  return true;
}

/**
 * Returns null if the URL is safe for server-side outbound fetch, else an error message.
 */
export async function validateWebhookUrl(raw: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return 'invalid URL';
  }
  if (u.username || u.password) return 'URL must not embed credentials';
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'only http(s) allowed';
  if (!u.hostname) return 'missing host';

  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return 'host not allowed';
  if (host.endsWith('.local') || host.endsWith('.localhost')) return 'host not allowed';

  if (isIPv4(host) || isIPv6(host)) {
    return ipLooksBlocked(host) ? 'resolved address not allowed' : null;
  }

  try {
    const lookup = await dns.lookup(host, { all: true, verbatim: true });
    if (lookup.length === 0) return 'host did not resolve';
    for (const { address } of lookup) {
      if (ipLooksBlocked(address)) {
        return 'resolved address not allowed';
      }
    }
  } catch {
    return 'DNS lookup failed';
  }

  return null;
}

export function webhookFetchTimeoutMs(): number {
  const n = parseInt(process.env.WEBHOOK_FETCH_TIMEOUT_MS || '10000', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 120_000) : 10_000;
}
