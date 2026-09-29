// next.config.ts
import type { NextConfig } from 'next';
import { withContentCollections } from '@content-collections/next';
import { securityHeaders } from './src/lib/security-headers'; // içerik: §12.5

/** Kanonik köken; src/i18n/config.ts içindeki SITE_URL ile aynı ifade (§3.5). */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.orcunsaatci.com').replace(
  /\/+$/,
  '',
);
/** Vercel proje alanı. Proje adı farklıysa §14.2'de oluşan gerçek alan yazılır. */
const VERCEL_APP_HOST = 'orcunsaatci.vercel.app';
/** Lansman sonrası: production + indeksleme açık (D-09, D-28). */
const LAUNCHED = process.env.VERCEL_ENV === 'production' && process.env.SITE_INDEXABLE === 'true';
/** Yayından sonra değişen slug'lar için kalıcı (308) yönlendirmeler (§11.7). Boş başlar. */
const slugRedirects: Array<{ source: string; destination: string; permanent: true }> = [];

const DAY = 86_400;
const SHORT_CACHE = `public, max-age=${DAY}, stale-while-revalidate=${7 * DAY}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true, // Option D ile prototipte doğrulandı; hesaplanan href'ler `as Route` ile tiplenir (§3.5)
  experimental: {
    globalNotFound: true, // D-19; 16.3'te hâlâ deneysel
  },
  images: {
    formats: ['image/avif', 'image/webp'], // D-31
    qualities: [75],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2560],
    imageSizes: [64, 128, 256, 384],
    minimumCacheTTL: 2_678_400, // 31 gün
    localPatterns: [
      { pathname: '/media/**', search: '' },
      { pathname: '/_next/static/media/**', search: '' },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders }, // §12.5
      { source: '/files/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }, // D-13, §11.4.4
      { source: '/stage/:file*', headers: [{ key: 'Cache-Control', value: SHORT_CACHE }] }, // posterler (§9.3.2)
      { source: '/detect-gpu/:file*', headers: [{ key: 'Cache-Control', value: SHORT_CACHE }] },
    ];
  },
  async redirects() {
    const hostRedirect =
      LAUNCHED && new URL(SITE_URL).host !== VERCEL_APP_HOST
        ? [
            {
              source: '/:path*',
              has: [{ type: 'host' as const, value: VERCEL_APP_HOST.replace(/\./g, '\\.') }],
              destination: `${SITE_URL}/:path*`,
              permanent: true, // 308
            },
          ]
        : [];
    return [...slugRedirects, ...hostRedirect];
  },
};

export default withContentCollections(nextConfig);
