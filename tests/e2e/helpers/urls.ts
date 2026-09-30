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

/**
 * Every page that answers 200: the sitemap plus NOINDEX_PATHS (§13.3.2). "Every route" loops use this;
 * it replaced the temporary M2 SHELL_PATHS list in M3 (§15.0.6).
 */
export async function pagePaths(request: APIRequestContext): Promise<string[]> {
  const paths = await sitemapPaths(request);
  for (const path of NOINDEX_PATHS) {
    if ((await request.get(path)).status() === 200) paths.push(path);
  }
  return paths;
}

export interface SitemapEntry {
  /** canonical URL exactly as in <loc> (production origin) */
  loc: string;
  path: string;
  /** xhtml:link alternates: hreflang → absolute URL (empty for single-language pages) */
  alternates: Record<string, string>;
}

/** Parses /sitemap.xml into <url> entries with their hreflang alternates (§11.4). */
export async function sitemapEntries(request: APIRequestContext): Promise<SitemapEntry[]> {
  const xml = await (await request.get('/sitemap.xml')).text();
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, block = '']) => {
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(block)?.[1] ?? '';
    const alternates: Record<string, string> = {};
    for (const [, lang = '', href = ''] of block.matchAll(
      /<xhtml:link[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"/g,
    ))
      alternates[lang] = href;
    return { loc, path: new URL(loc).pathname || '/', alternates };
  });
}

/** Production URL → local path (origin dropped) */
export const localPath = (url: string): string => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};
