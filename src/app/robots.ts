// src/app/robots.ts
import type { MetadataRoute } from 'next';
import { SITE_URL, metaRoutes } from '@/i18n/config';

export default function robots(): MetadataRoute.Robots {
  const indexable =
    process.env.VERCEL_ENV === 'production' && process.env.SITE_INDEXABLE === 'true';
  if (!indexable) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/lab'] }],
    sitemap: `${SITE_URL}${metaRoutes.sitemap}`,
  };
}
