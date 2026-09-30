// src/lib/seo/metadata.ts — metadata oluşturucuları ve sayfa envanteri (§11.2, §11.3, §11.4.1).
// Route dosyaları yalnız bunları çağırır.
import 'server-only';
import type { Metadata } from 'next';
import {
  absoluteUrl,
  alternates,
  localeMeta,
  locales,
  pathOf,
  resolveLink,
  staticRoutes,
  type Locale,
  type PageRef,
  type ResolvedLink,
  type StaticPageRef,
} from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import {
  getAreas,
  getPerson,
  getProjects,
  getSite,
  pageDates,
  pageLocales,
  t,
  type AreaDoc,
  type ProjectDoc,
} from '@/lib/content';

/** Marka = içerikteki ad (§7.1 kural 1: sahibe ait veri koda gömülmez). */
export const BRAND: string = getPerson().name;
export const TITLE_SEPARATOR = ' — '; // boşluklu em dash
export const TITLE_MAX = 60; // tam <title>, karakter (NFC, String.length)
export const DESCRIPTION_MAX = 160;
export const DESCRIPTION_MIN_RECOMMENDED = 120;

const SUFFIX_LENGTH = TITLE_SEPARATOR.length + BRAND.length;

/** Kelime sınırında kesip '…' ekler; sonuç ≤ max. */
export function clampText(s: string, max: number): string {
  const text = s.normalize('NFC').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = /\s/u.test(text.charAt(max - 1)) ? cut.length : cut.lastIndexOf(' '); // kesim kelime sonundaysa kelime kalır
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/u, '')}…`;
}

/** Sayfa kısmı + soneki 60'a sığıyorsa şablona bırakır, değilse absolute (§11.2.2). */
export function composeTitle(pagePart: string): string | { absolute: string } {
  const part = pagePart.normalize('NFC');
  return part.length + SUFFIX_LENGTH <= TITLE_MAX ? part : { absolute: clampText(part, TITLE_MAX) };
}

/** og:title için tam başlık */
export function fullTitle(pagePart: string): string {
  const composed = composeTitle(pagePart);
  return typeof composed === 'string' ? `${composed}${TITLE_SEPARATOR}${BRAND}` : composed.absolute;
}

/** Ana sayfa: "Ad — Unvan" 60'ı aşarsa yalnız ad (TR 67 → ad; EN 57 → unvanlı, §11.2.2) */
export function homeTitle(locale: Locale): string {
  const withTitle = `${BRAND}${TITLE_SEPARATOR}${t(getPerson().jobTitle, locale).text}`;
  return withTitle.length <= TITLE_MAX ? withTitle : BRAND;
}

/** §11.3 #7 */
export function isPageIndexable(ref: PageRef): boolean {
  if (ref.key === 'project') {
    const p = getProjects('tr').find((x) => x.slug === ref.param);
    return p ? !p.seo.noindex : false;
  }
  if (ref.key === 'area') {
    const a = getAreas().find((x) => x.id === ref.param);
    return a ? !a.seo.noindex : false;
  }
  return staticRoutes[ref.key].indexable;
}

/** Görünür metinle aynı dil: EN'de TR yedeği meta'ya girmez; o zaman site.description.en (§7.4.4 kural 6). */
function describe(v: { tr: string; en?: string } | undefined, locale: Locale): string {
  const own = t(v, locale);
  if (!own.fallback && own.text) return own.text;
  return t(getSite().description, locale).text;
}

type OgExtra = { type: 'website' } | { type: 'profile'; firstName: string; lastName: string };

interface PageInput {
  ref: PageRef;
  locale: Locale;
  pagePart: string;
  description: string;
  og: OgExtra;
}

function pageMetadata(i: PageInput): Metadata {
  const available = pageLocales(i.ref);
  const indexable = isPageIndexable(i.ref);
  const isHome = i.ref.key === 'home';
  const description = clampText(i.description, DESCRIPTION_MAX);
  return {
    title: isHome ? { absolute: homeTitle(i.locale) } : composeTitle(i.pagePart),
    description,
    alternates: indexable ? alternates(i.ref, i.locale, available) : undefined, // noindex → canonical/hreflang yok
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      siteName: BRAND,
      url: absoluteUrl(pathOf(i.ref, i.locale) as string),
      title: isHome ? homeTitle(i.locale) : fullTitle(i.pagePart),
      description,
      locale: localeMeta[i.locale].ogLocale,
      alternateLocale: indexable
        ? locales
            .filter((l) => l !== i.locale && available.includes(l))
            .map((l) => localeMeta[l].ogLocale)
        : [],
      ...i.og,
    },
  };
}

/** Kök layout'lar (§8.4.4, §11.2.1) */
export function buildRootMetadata(locale: Locale): Metadata {
  return {
    metadataBase: new URL(absoluteUrl('/')), // göreli OG/ikon URL'leri için ZORUNLU
    title: { default: BRAND, template: `%s${TITLE_SEPARATOR}${BRAND}` },
    description: clampText(describe(getSite().seo.pages.home.description, locale), DESCRIPTION_MAX),
    applicationName: BRAND,
    authors: [{ name: BRAND, url: absoluteUrl('/') }],
    creator: BRAND,
    openGraph: { type: 'website', siteName: BRAND, locale: localeMeta[locale].ogLocale },
    twitter: { card: 'summary_large_image' },
    // robots yazılmaz (SPEC-SAPMA §11.2.1): her sayfa oluşturucu kendi robots'unu yazar (pageMetadata); kökteki
    // index,follow yalnız 404 kabuklarında Next'in noindex'iyle çelişen ikinci etiket üretiyordu (V-21).
  };
}

/** home, about, cv, projects, expertise, contact, privacy */
export function staticPageMetadata(ref: StaticPageRef, locale: Locale): Metadata {
  if (ref.key === 'lab') throw new Error('staticPageMetadata: lab metadata’sı sayfada yazılır');
  const person = getPerson();
  const meta = getDictionary(locale).meta;
  const pagePart = ref.key === 'home' ? BRAND : meta[ref.key];
  const og: OgExtra =
    ref.key === 'about'
      ? { type: 'profile', firstName: person.givenName, lastName: person.familyName }
      : { type: 'website' };
  return pageMetadata({
    ref,
    locale,
    pagePart,
    description: describe(getSite().seo.pages[ref.key].description, locale),
    og,
  });
}

export function projectMetadata(p: ProjectDoc, locale: Locale): Metadata {
  return pageMetadata({
    ref: { key: 'project', param: p.slug },
    locale,
    pagePart: t(p.seo.title ?? p.title, locale).text,
    description: describe(p.seo.description ?? p.summary, locale),
    og: { type: 'website' }, // D-48: proje sayfası makale değildir
  });
}

export function areaMetadata(a: AreaDoc, locale: Locale): Metadata {
  return pageMetadata({
    ref: { key: 'area', param: a.id },
    locale,
    pagePart: t(a.seo.title ?? a.title, locale).text,
    description: describe(a.seo.description ?? a.summary, locale),
    og: { type: 'website' },
  });
}

/* ───────────── sayfa envanteri (§11.4.1) ───────────── */

export interface PageEntry {
  ref: PageRef;
  locales: readonly Locale[];
  indexable: boolean;
  lastModified?: string;
}

export function listPages(): PageEntry[] {
  const site = getSite();
  const refs: PageRef[] = [
    ...(['home', 'about', 'cv', 'projects', 'expertise', 'contact', 'privacy'] as const).map(
      (key) => ({ key }),
    ),
    ...getProjects('tr').map((p) => ({ key: 'project' as const, param: p.slug })),
    ...(site.features.areaPages
      ? getAreas()
          .filter((a) => a.hasPage)
          .map((a) => ({ key: 'area' as const, param: a.id }))
      : []),
  ];
  return refs.map((ref) => ({
    ref,
    locales: pageLocales(ref),
    indexable: isPageIndexable(ref),
    lastModified: pageDates(ref).modified,
  }));
}

/** Kök layout'lar için EN'de var olan tüm sayfa yolları (§3.6, §8.4.4) */
export function listEnPaths(): string[] {
  return listPages()
    .filter((p) => p.locales.includes('en'))
    .flatMap((p) => {
      const path = pathOf(p.ref, 'en');
      return path ? [path] : [];
    });
}

/** İç bağlantı: EN'de hedef yoksa TR'ye düşer (hrefLang 'tr', görünür " (TR)", §3.9) */
export function pageLink(ref: PageRef, locale: Locale): ResolvedLink {
  return resolveLink(ref, locale, new Set(listEnPaths()));
}
