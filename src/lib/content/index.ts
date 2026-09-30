// src/lib/content/index.ts — içerik erişimcileri. M2 geçici hâli (§15.0.6): yalnız site.locales, ad ve EN yolları.
// M3'te §7.3.5'teki erişimcilerle (getSite, getPerson, getProjects, pageLocales, …) değiştirilir.
import 'server-only';
import { person, site } from 'content-collections';
import { staticRouteKeys, staticRoutes, type Locale } from '@/i18n/config';

export function getSite(): { locales: readonly Locale[] } {
  return { locales: site.locales };
}

export function getPerson(): { name: string } {
  return { name: person.name };
}

/**
 * EN'de var olan sayfa yolları (dil değiştirici ve resolveLink için, §3.6). Geçici (§15.3.1 #4): statik route'ların
 * EN yolları; M3'te kök layout'taki listPages() türetmesine bağlanır (§8.4.4).
 */
export function getEnPaths(): readonly string[] {
  if (!site.locales.includes('en')) return [];
  return staticRouteKeys.flatMap((key) => {
    const path = staticRoutes[key].en;
    return path === null ? [] : [path];
  });
}
