/**
 * Shared helper: obtain a JWT for smoke scripts (SEED_ADMIN_PASSWORD or API_TOKEN).
 */
export async function loginBearer(apiUrl = process.env.API_URL || 'http://localhost:3000') {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@localhost';
  const password = process.env.SEED_ADMIN_PASSWORD;
  const tokenFromEnv = process.env.API_TOKEN;
  if (tokenFromEnv) return tokenFromEnv;
  if (!password || password.length < 8) {
    throw new Error(
      'Set SEED_ADMIN_PASSWORD (min 8 chars) for seeded admin login, or API_TOKEN with a valid JWT',
    );
  }
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`login failed ${res.status}: ${body}`);
  }
  const j = await res.json();
  if (!j.token) throw new Error('login response missing token');
  return j.token;
}
