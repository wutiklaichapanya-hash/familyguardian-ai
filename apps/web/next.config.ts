import type { NextConfig } from 'next';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4100';
const isDev = process.env.NODE_ENV !== 'production';

// Conservative CSP. Next's inline bootstrap needs 'unsafe-inline' without a nonce setup;
// dev additionally needs 'unsafe-eval' and websocket HMR.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const AUTHENTICATED_ROUTES = [
  '/home', '/checkin', '/contacts', '/scam-check', '/guardian-pause', '/help', '/privacy', '/invite/accept',
  '/family', '/alerts/:id*', '/notifications', '/admin', '/billing',
];

const nextConfig: NextConfig = {
  transpilePackages: ['@fg/shared'],
  poweredByHeader: false,
  async rewrites() {
    // Same-origin proxy so the httpOnly session cookie is first-party.
    return [{ source: '/api/v1/:path*', destination: `${API_BASE_URL}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Personal data must never be cached by the browser, a proxy or a service worker.
        source: '/api/v1/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      // Signed-in pages (SR-14, shared devices): no document caching, so Back after sign-out does not
      // re-show a stored page. Data is fetched client-side with no-store; this covers the HTML shell too.
      ...AUTHENTICATED_ROUTES.map((source) => ({
        source,
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      })),
    ];
  },
};

export default nextConfig;
