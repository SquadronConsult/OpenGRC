const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE || 'local';
const IS_LOCAL_AUTH_MODE = AUTH_MODE !== 'multiuser';

export function getToken(): string | null {
  if (IS_LOCAL_AUTH_MODE) return null;
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('grc_token');
}

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const token = opts.token ?? getToken();
  const headers: HeadersInit = {
    ...(opts.body && typeof opts.body === 'string'
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(opts.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  const ct = res.headers.get('content-type');
  if (ct?.includes('application/json')) return res.json() as Promise<T>;
  return res.text() as Promise<T>;
}

export { API };
export { AUTH_MODE, IS_LOCAL_AUTH_MODE };
