/** @type {import('next').NextConfig} */
/** Server-side proxy target for `/api/*` rewrites (browser uses same-origin `/api`). */
const internalApi = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3000';

const nextConfig = {
  async rewrites() {
    const base = String(internalApi).replace(/\/$/, '');
    return [{ source: '/api/:path*', destination: `${base}/:path*` }];
  },
};

export default nextConfig;
