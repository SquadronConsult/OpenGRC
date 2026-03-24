/**
 * API client: supports Bearer token (sessionStorage) and httpOnly cookies (same-origin /api proxy).
 * Set NEXT_PUBLIC_API_URL to a full URL (e.g. http://localhost:3000) for split dev servers,
 * or leave unset / set to "proxy" to use Next.js rewrites to `/api/*`.
 */
const STORAGE_KEY = 'grc_access_token';

function normalizeBase(url: string): string {
  return url.replace(/\/$/, '');
}

/** Browser: public API path or absolute URL. Server: internal API URL for SSR fetches. */
export function getApiBase(): string {
  const v = process.env.NEXT_PUBLIC_API_URL;
  if (!v || v === 'proxy') {
    if (typeof window !== 'undefined') {
      return '/api';
    }
    return normalizeBase(process.env.INTERNAL_API_URL || 'http://127.0.0.1:3000');
  }
  return normalizeBase(v);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.href = `/login?next=${next}`;
}

/** Matches paginated list responses from hardened list endpoints. */
export type PaginatedList<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

/** Normalize list endpoints that return either a plain array or `{ items, ... }`. */
export function listItems<T>(r: T[] | PaginatedList<T>): T[] {
  return Array.isArray(r) ? r : r.items;
}

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string | null; skipAuthRedirect?: boolean } = {},
): Promise<T> {
  const base = getApiBase();
  const token = opts.token ?? getToken();
  const headers: HeadersInit = {
    ...(opts.body && typeof opts.body === 'string'
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(opts.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers,
    credentials: 'include',
  });
  if (res.status === 401 && !opts.skipAuthRedirect) {
    clearAuthToken();
    redirectToLogin();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  const ct = res.headers.get('content-type');
  if (ct?.includes('application/json')) return res.json() as Promise<T>;
  return res.text() as Promise<T>;
}

export async function logout(): Promise<void> {
  try {
    await api<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      skipAuthRedirect: true,
    });
  } catch {
    /* ignore */
  }
  clearAuthToken();
}
