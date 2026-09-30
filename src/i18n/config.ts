// src/i18n/config.ts
import type { Metadata, Route } from 'next';

/* ───────── Diller ───────── */
export const locales = ['tr', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'tr';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

// Dil tablosu satır düzeniyle okunur.
// prettier-ignore
export const localeMeta = {
  tr: { htmlLang: 'tr', hreflang: 'tr', ogLocale: 'tr_TR', intl: 'tr-TR', name: 'Türkçe', short: 'TR' },
  en: { htmlLang: 'en', hreflang: 'en', ogLocale: 'en_US', intl: 'en-GB', name: 'English', short: 'EN' },
} as const satisfies Record<
  Locale,
  { htmlLang: string; hreflang: string; ogLocale: string; intl: string; name: string; short: string }
>;

/* ───────── Köken ───────── */
/** Kanonik köken; sonda '/' yok. NEXT_PUBLIC_ olduğu için build anında gömülür (§8.8). */
export const SITE_URL: string = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.orcunsaatci.com'
).replace(/\/+$/, '');

/** Mutlak URL. '/' → 'https://www.orcunsaatci.com/', '/en' → 'https://www.orcunsaatci.com/en'. Canonical, hreflang, sitemap ve JSON-LD yalnız bunu kullanır. */
export function absoluteUrl(path: string): string {
  if (!path.startsWith('/')) throw new Error(`absoluteUrl: path must start with "/": ${path}`);
  return `${SITE_URL}${path}`;
}

/* ───────── Route anahtarları ───────── */
export const staticRouteKeys = [
  'home',
  'about',
  'cv',
  'projects',
  'expertise',
  'contact',
  'privacy',
  'lab',
] as const;
export const dynamicRouteKeys = ['project', 'area'] as const;
export type StaticRouteKey = (typeof staticRouteKeys)[number];
export type DynamicRouteKey = (typeof dynamicRouteKeys)[number];
export type RouteKey = StaticRouteKey | DynamicRouteKey;

export type StaticPageRef = { key: StaticRouteKey; param?: undefined };
export type DynamicPageRef = { key: DynamicRouteKey; param: string };
export type PageRef = StaticPageRef | DynamicPageRef;

interface StaticRouteDef {
  readonly tr: Route;
  readonly en: Route | null; // null → bu route'un EN karşılığı yok
  readonly indexable: boolean; // route düzeyi; içerik düzeyi istisnalar: §11.3
  readonly parent: StaticRouteKey | null; // breadcrumb üst düğümü
}
interface DynamicRouteDef {
  readonly tr: (param: string) => Route;
  readonly en: (param: string) => Route;
  readonly indexable: boolean;
  readonly parent: StaticRouteKey;
  readonly pattern: { readonly tr: RegExp; readonly en: RegExp };
}

// Route tablosu §3.5'teki hizalı düzeniyle okunur.
// prettier-ignore
export const staticRoutes = {
  home:      { tr: '/' as Route,                 en: '/en' as Route,           indexable: true,  parent: null },
  about:     { tr: '/hakkimda' as Route,         en: '/en/about' as Route,     indexable: true,  parent: 'home' },
  cv:        { tr: '/cv' as Route,               en: '/en/cv' as Route,        indexable: true,  parent: 'home' },
  projects:  { tr: '/projeler' as Route,         en: '/en/projects' as Route,  indexable: true,  parent: 'home' },
  expertise: { tr: '/calisma-alanlari' as Route, en: '/en/expertise' as Route, indexable: true,  parent: 'home' },
  contact:   { tr: '/iletisim' as Route,         en: '/en/contact' as Route,   indexable: true,  parent: 'home' },
  privacy:   { tr: '/gizlilik' as Route,         en: '/en/privacy' as Route,   indexable: false, parent: 'home' },
  lab:       { tr: '/lab/stage' as Route,        en: null,                     indexable: false, parent: null },
} as const satisfies Record<StaticRouteKey, StaticRouteDef>;

const SLUG = '([a-z0-9]+(?:-[a-z0-9]+)*)';

export const dynamicRoutes = {
  project: {
    tr: (slug: string) => `/projeler/${slug}` as Route,
    en: (slug: string) => `/en/projects/${slug}` as Route,
    indexable: true,
    parent: 'projects',
    pattern: { tr: new RegExp(`^/projeler/${SLUG}$`), en: new RegExp(`^/en/projects/${SLUG}$`) },
  },
  area: {
    tr: (id: string) => `/calisma-alanlari/${id}` as Route,
    en: (id: string) => `/en/expertise/${id}` as Route,
    indexable: true,
    parent: 'expertise',
    pattern: {
      tr: new RegExp(`^/calisma-alanlari/${SLUG}$`),
      en: new RegExp(`^/en/expertise/${SLUG}$`),
    },
  },
} as const satisfies Record<DynamicRouteKey, DynamicRouteDef>;

/* ───────── Sayfa olmayan yollar ───────── */
/** Build'de üretilen dosyalar; <a href download> ile bağlanır (<Link> değil). */
export const fileRoutes = {
  cvPdf: { tr: '/files/orcun-saatci-cv-tr.pdf', en: '/files/orcun-saatci-cv-en.pdf' },
  resume: { tr: '/files/resume.tr.json', en: '/files/resume.en.json' },
} as const satisfies Record<string, Record<Locale, `/files/${string}`>>;

export const metaRoutes = {
  sitemap: '/sitemap.xml',
  robots: '/robots.txt',
  manifest: '/manifest.webmanifest',
  icon: '/icon',
  appleIcon: '/apple-icon',
} as const;

/* ───────── Ana sayfa bölümleri (D-43) ───────── */
export const chapterIds = [
  'hero',
  'about',
  'areas',
  'work',
  'journey',
  'testimonials',
  'contact',
] as const;
export type ChapterId = (typeof chapterIds)[number];

export const chapterAnchors = {
  hero: { tr: 'giris', en: 'intro' },
  about: { tr: 'ben', en: 'me' },
  areas: { tr: 'alanlar', en: 'areas' },
  work: { tr: 'projeler', en: 'work' },
  journey: { tr: 'yolculuk', en: 'journey' },
  testimonials: { tr: 'referanslar', en: 'testimonials' },
  contact: { tr: 'iletisim', en: 'contact' },
} as const satisfies Record<ChapterId, Record<Locale, string>>;

/** Header sırası (D-41). Ana sayfada çapa, diğer sayfalarda derin sayfa. */
export const headerItems = [
  { chapter: 'about', route: 'about' },
  { chapter: 'areas', route: 'expertise' },
  { chapter: 'work', route: 'projects' },
  { chapter: 'journey', route: 'cv' },
  { chapter: 'contact', route: 'contact' },
] as const satisfies readonly { chapter: ChapterId; route: StaticRouteKey }[];

/* ───────── Yardımcılar ───────── */
export function isDynamicKey(key: RouteKey): key is DynamicRouteKey {
  return (dynamicRouteKeys as readonly string[]).includes(key);
}

/** Sayfanın verilen dildeki yolu. Route'un o dilde karşılığı yoksa null. İçerik varlığını KONTROL ETMEZ (bkz. pageLocales, §3.4.1). */
export function pathOf(ref: DynamicPageRef, locale: Locale): Route;
export function pathOf(ref: PageRef, locale: Locale): Route | null;
export function pathOf(ref: PageRef, locale: Locale): Route | null {
  if (ref.key === 'project' || ref.key === 'area') return dynamicRoutes[ref.key][locale](ref.param);
  return staticRoutes[ref.key][locale];
}

/** Sorgu ve hash atılır; kök dışındaki sondaki '/' kaldırılır. */
export function normalizePath(pathname: string): string {
  const p = pathname.split(/[?#]/, 1)[0] ?? '/';
  return p.length > 1 ? p.replace(/\/+$/, '') : '/';
}

/** Kök-göreli yolu route haritasında çözer. Eşleşme yoksa null. Asla string replace kullanılmaz. */
export function matchRoute(pathname: string): { ref: PageRef; locale: Locale } | null {
  const clean = normalizePath(pathname);
  for (const key of staticRouteKeys) {
    for (const locale of locales) {
      if (staticRoutes[key][locale] === clean) return { ref: { key }, locale };
    }
  }
  for (const key of dynamicRouteKeys) {
    for (const locale of locales) {
      const param = dynamicRoutes[key].pattern[locale].exec(clean)?.[1];
      if (param) return { ref: { key, param }, locale };
    }
  }
  return null;
}

type HreflangKey = 'tr' | 'en' | 'x-default';

/**
 * Canonical + hreflang. `available` = bu sayfanın GERÇEKTEN var olduğu diller (pageLocales(ref)).
 * Tek dilde varsa yalnız canonical döner. İki dilde varsa tr, en ve x-default (→ TR) döner.
 */
export function alternates(
  ref: PageRef,
  locale: Locale,
  available: readonly Locale[],
): NonNullable<Metadata['alternates']> {
  const self = pathOf(ref, locale);
  if (self === null || !available.includes(locale)) {
    throw new Error(`alternates: "${ref.key}" does not exist in "${locale}"`);
  }
  const pairs = locales.flatMap((l) => {
    const p = available.includes(l) ? pathOf(ref, l) : null;
    return p === null ? [] : [[l, absoluteUrl(p)] as const];
  });
  if (pairs.length < 2) return { canonical: absoluteUrl(self) };
  const languages: Partial<Record<HreflangKey, string>> = {};
  for (const [l, url] of pairs) languages[localeMeta[l].hreflang] = url;
  const xDefault = pairs.find(([l]) => l === defaultLocale)?.[1];
  if (xDefault) languages['x-default'] = xDefault;
  return { canonical: absoluteUrl(self), languages };
}

export interface ResolvedLink {
  href: Route;
  hrefLang?: 'tr';
  fallback: boolean;
}

/** İç bağlantı: EN ağacında hedef EN'de yoksa TR hedefe düşer (hrefLang 'tr'; görünür etikete " (TR)" eklenir, §3.9). */
export function resolveLink(
  ref: PageRef,
  locale: Locale,
  enPaths: ReadonlySet<string>,
): ResolvedLink {
  const own = pathOf(ref, locale);
  if (own !== null && (locale === 'tr' || enPaths.has(own))) return { href: own, fallback: false };
  const tr = pathOf(ref, 'tr');
  if (tr === null) throw new Error(`resolveLink: "${ref.key}" has no TR path`);
  return { href: tr, hrefLang: 'tr', fallback: true };
}

export interface Equivalent {
  href: Route;
  exact: boolean;
}

/**
 * Dil değiştirici hedefi. `enPaths`: EN'de var olan tüm sayfa yolları (kök layout'ta listPages()'ten üretilir, §3.6).
 * TR her zaman vardır. Karşılık yoksa hedef dilin ana sayfası döner, exact=false.
 */
export function equivalentPath(
  pathname: string,
  to: Locale,
  enPaths: ReadonlySet<string>,
): Equivalent {
  const home = staticRoutes.home[to];
  const match = matchRoute(pathname);
  const target = match ? pathOf(match.ref, to) : null;
  if (target === null) return { href: home, exact: false };
  if (to === 'en' && !enPaths.has(target)) return { href: home, exact: false };
  return { href: target, exact: true };
}

/** Breadcrumb zinciri: kökten sayfaya; son öğe sayfanın kendisi. */
export function trail(ref: PageRef): PageRef[] {
  const chain: PageRef[] = [ref];
  let parent: StaticRouteKey | null = isDynamicKey(ref.key)
    ? dynamicRoutes[ref.key].parent
    : staticRoutes[ref.key].parent;
  while (parent !== null) {
    chain.unshift({ key: parent });
    parent = staticRoutes[parent].parent;
  }
  return chain;
}
