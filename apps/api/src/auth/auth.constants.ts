export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'grc_session';
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Sentinel stored as `password_hash` for legacy single-user rows that must not
 * authenticate until a real password is set (compare in AuthService.login).
 */
export const LEGACY_DISABLED_PASSWORD_PLACEHOLDER =
  'single-user-local-auth-disabled';
