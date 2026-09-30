// src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { absoluteUrl, defaultLocale, localeMeta, pathOf, SITE_URL } from '@/i18n/config';
import { listPages } from '@/lib/seo/metadata';

/**
 * Next metadata'sı kök URL'yi sondaki "/" olmadan yazar (canonical, hreflang, og:url); sitemap aynı dizeyi kullanır,
 * çünkü §11.8.1 #4 birebir dize eşitliği ister (SPEC-SAPMA §11.4.2).
 */
const pageUrl = (path: string) => (path === '/' ? SITE_URL : absoluteUrl(path));

export default function sitemap(): MetadataRoute.Sitemap {
  return listPages()
    .filter((page) => page.indexable)
    .flatMap((page) => {
      const urls = page.locales.flatMap((l) => {
        const p = pathOf(page.ref, l);
        return p === null ? [] : [[l, pageUrl(p)] as const];
      });
      const languages: Partial<Record<'tr' | 'en' | 'x-default', string>> = {};
      for (const [l, u] of urls) languages[localeMeta[l].hreflang] = u;
      const xDefault = urls.find(([l]) => l === defaultLocale)?.[1];
      if (xDefault) languages['x-default'] = xDefault;
      const hasPair = urls.length > 1; // tek dilde var olan sayfa hreflang almaz (D-11)
      return urls.map(([, url]) => ({
        url,
        ...(page.lastModified ? { lastModified: page.lastModified } : {}),
        ...(hasPair ? { alternates: { languages } } : {}),
      }));
    });
}
