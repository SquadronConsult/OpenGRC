/** Keys whose values are replaced when returning connector config to clients. */
const SECRET_KEYS = new Set([
  'token',
  'githubtoken',
  'apitoken',
  'apikey',
  'api_token',
  'clientsecret',
  'client_secret',
  'password',
  'webhookurl',
  'webhook_url',
  'secret',
  'privatekey',
  'authorization',
]);

/** Same rules as redaction — used when encrypting secret fields at rest. */
export function isSecretConfigKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_]/g, '');
  return SECRET_KEYS.has(k) || k.includes('secret') || k.includes('token') || k.includes('password');
}

function redactValue(key: string, v: unknown): unknown {
  if (isSecretConfigKey(key)) {
    if (typeof v === 'string' && v.length > 0) return '***redacted***';
    return '***redacted***';
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return redactObject(v as Record<string, unknown>);
  }
  if (Array.isArray(v)) {
    return v.map((x, i) => redactValue(String(i), x));
  }
  return v;
}

export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    out[key] = redactValue(key, val);
  }
  return out;
}

export function parseConfigJson(raw: string): Record<string, unknown> {
  try {
    const p = JSON.parse(raw || '{}');
    return typeof p === 'object' && p && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
