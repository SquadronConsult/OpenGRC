/**
 * Shared helper: obtain a JWT for smoke scripts (SEED_ADMIN_PASSWORD or API_TOKEN).
 * If the seeded admin must change password on first login, set SEED_ADMIN_NEXT_PASSWORD
 * (≥8 chars); the helper will rotate from SEED_ADMIN_PASSWORD to that value and return
 * the new token.
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
  let token = j.token;
  if (j.user?.mustChangePassword === true) {
    const nextPwd = process.env.SEED_ADMIN_NEXT_PASSWORD;
    if (!nextPwd || nextPwd.length < 8) {
      throw new Error(
        'Admin must change password on first login. For smoke scripts set SEED_ADMIN_NEXT_PASSWORD (≥8 chars), or use API_TOKEN',
      );
    }
    const r2 = await fetch(`${apiUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword: password, newPassword: nextPwd }),
    });
    if (!r2.ok) {
      const body = await r2.text();
      throw new Error(`change-password failed ${r2.status}: ${body}`);
    }
    const j2 = await r2.json();
    if (!j2.token) throw new Error('change-password response missing token');
    token = j2.token;
  }
  return token;
}
