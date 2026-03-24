/** Routes that skip the authenticated-session loading gate (still may use token if present). */
export function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/login')) return true;
  return false;
}
