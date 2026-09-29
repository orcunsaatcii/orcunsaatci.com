// tests/e2e/helpers/urls.ts — page lists shared by specs (§13.3.2)
import type { APIRequestContext } from '@playwright/test';

/** Noindex pages that are not in the sitemap. Specs use only those that answer 200. */
export const NOINDEX_PATHS = ['/gizlilik', '/en/privacy'] as const;

/** URLs that must answer 404 (§3.7). */
export const NOT_FOUND_PATHS = [
  '/yok',
  '/en/yok',
  '/tr',
  '/en/projeler',
  '/projeler/yok',
  '/en/projects/yok',
] as const;

/** Reads /sitemap.xml and returns the unique path part of every <loc> (origin dropped). */
export async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const res = await request.get('/sitemap.xml');
  if (!res.ok()) throw new Error(`/sitemap.xml answered ${res.status()}`);
  const xml = await res.text();
  const paths = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => {
    const url = new URL(m[1] ?? '/');
    return url.pathname || '/';
  });
  return [...new Set(paths)];
}
