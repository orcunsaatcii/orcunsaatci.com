// src/lib/content/index.ts — tipli içerik erişimcileri (§7.3.6, §3.4.2, U-04).
// View'lar, route dosyaları, sitemap, OG ve JSON-LD üreticileri içeriğe YALNIZCA buradan erişir.
// Fonksiyonlar senkron ve saftır; dönüş dizileri sıralı ve dile göre süzülmüştür. Intl biçimlendirmesi yapılmaz (§3.8).
import 'server-only';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  allAreaBodies,
  allAreas,
  allPageBodies,
  allProjects,
  contact,
  cvAwards,
  cvCertifications,
  cvEducation,
  cvExperience,
  cvLanguages,
  cvPublications,
  cvSkills,
  home,
  person,
  site,
  testimonials,
  type Area,
  type AreaBody,
  type Contact,
  type Home,
  type PageBody,
  type Person,
  type Project,
  type Site,
  type Testimonials,
} from 'content-collections';
import { getExperienceProfile } from '@/experience/profile';
import { fileRoutes, type Locale, type PageRef, type RouteKey } from '@/i18n/config';
import { bandOf, ringGeometry } from '@/lib/section-geometry';
import type { PresetName, StageData } from '@/stage/store';
import {
  byDateDesc,
  byPeriod,
  isVisible,
  pick,
  selectCv,
  selectHomeJourney,
  sortProjects,
  type CvSection,
  type CvSource,
  type ExperienceItem,
  type HomeJourney,
} from './cv';

/* ───────────── tipler (üretilen tiplerden türetilir; elle tip YASAK) ───────────── */

export type SiteDoc = Site;
export type PersonDoc = Person;
export type ContactDoc = Contact;
export type HomeDoc = Home;
export type AreaDoc = Area;
export type ProjectDoc = Project;
export type PageBodyDoc = PageBody;
export type AreaBodyDoc = AreaBody;
export type TestimonialDoc = Testimonials['items'][number];
export type ExperienceDoc = ExperienceItem;
export type { CvSection, HomeJourney };
export interface CvData {
  sections: CvSection[];
  updatedAt: string;
}

/** Kısa alanın dile göre değeri. fallback: EN istendi ama yalnızca TR vardı → view <span lang="tr"> ile sarar. */
export type Localized = { text: string; lang: Locale; fallback: boolean };

export function t(v: { tr: string; en?: string } | undefined, locale: Locale): Localized {
  if (!v) return { text: '', lang: locale, fallback: false };
  if (locale === 'en') {
    return v.en !== undefined
      ? { text: v.en, lang: 'en', fallback: false }
      : { text: v.tr, lang: 'tr', fallback: true };
  }
  return { text: v.tr, lang: 'tr', fallback: false };
}

export function tList(
  v: { tr: string[]; en?: string[] } | undefined,
  locale: Locale,
): { items: string[]; lang: Locale; fallback: boolean } {
  if (!v) return { items: [], lang: locale, fallback: false };
  if (locale === 'en') {
    return v.en !== undefined
      ? { items: v.en, lang: 'en', fallback: false }
      : { items: v.tr, lang: 'tr', fallback: true };
  }
  return { items: v.tr, lang: 'tr', fallback: false };
}

/** Build yılı (yalnız yıl hesabı; sayfa tarihlerinde new Date() YASAK, §3.4.2) */
const BUILD_YEAR = new Date().getFullYear();
const yearOf = (d: string) => Number(d.slice(0, 4));

/* ───────────── site / kişi / iletişim / ana sayfa ───────────── */

export function getSite(): SiteDoc {
  return site;
}

export function isLocaleEnabled(locale: Locale): boolean {
  return (site.locales as readonly Locale[]).includes(locale);
}

export function getPerson(): PersonDoc {
  return person;
}

export function getContact(): ContactDoc {
  return contact;
}

export function getHome(): HomeDoc {
  return home;
}

/** person.careerStartYear ?? en eski deneyim yılı (§7.3.3); çözülemezse build hatası (C07). */
export function getCareerStartYear(): number {
  if (person.careerStartYear !== undefined) return person.careerStartYear;
  const years = cvExperience.items.map((e) => yearOf(e.period.start));
  if (years.length === 0)
    throw new Error('getCareerStartYear: careerStartYear yok ve deneyim kaydı yok (C07)');
  return Math.min(...years);
}

/** Web'de görünen, end içermeyen ilk deneyim (JSON-LD worksFor, "Şu an"). */
export function getWorksFor(): ExperienceDoc | undefined {
  return cvExperience.items
    .filter((e) => isVisible(e.visibility, 'web') && e.period.end === undefined)
    .sort(byPeriod)[0];
}

/* ───────────── alanlar ───────────── */

/** order artan; dizideki indeks = dilim k (§5.10) */
export function getAreas(): AreaDoc[] {
  return [...allAreas].sort((a, b) => a.order - b.order);
}

/** 3 ≤ N ≤ 6 → 'dial' (D-37, §4.8) */
export function getAreaMode(): 'dial' | 'list' {
  const n = allAreas.length;
  return n >= 3 && n <= 6 ? 'dial' : 'list';
}

export function getAreaBody(id: string, locale: Locale): AreaBodyDoc | undefined {
  return allAreaBodies.find((b) => b.areaId === id && b.locale === locale && !b.draft);
}

/** features.areaPages && hasPage && pageLocales ∋ locale */
export function getAreaPageIds(locale: Locale): string[] {
  return getAreas()
    .filter((a) => availableLocales('area', a.id).includes(locale))
    .map((a) => a.id);
}

/** Bu dilde sayfası olan alan (getAreaPageIds ∋ id); aksi hâlde undefined */
export function getAreaPage(id: string, locale: Locale): AreaDoc | undefined {
  return getAreaPageIds(locale).includes(id) ? getAreas().find((a) => a.id === id) : undefined;
}

/* ───────────── projeler ───────────── */

/** §7.8.1 sırası; EN listesi yalnız EN başlık + özeti olan projeleri içerir (§7.4.4 kural 2). */
export function getProjects(
  locale: Locale,
  opts: { featured?: boolean; area?: string } = {},
): ProjectDoc[] {
  if (!isLocaleEnabled(locale)) return [];
  return sortProjects(
    allProjects.filter(
      (p) =>
        p.locales.includes(locale) &&
        (opts.featured === undefined || p.featured === opts.featured) &&
        (opts.area === undefined || p.areas.includes(opts.area)),
    ),
    locale,
  );
}

/** locale ∉ locales → undefined */
export function getProject(slug: string, locale: Locale): ProjectDoc | undefined {
  if (!isLocaleEnabled(locale)) return undefined;
  return allProjects.find((p) => p.slug === slug && p.locales.includes(locale));
}

export function getProjectSlugs(locale: Locale): string[] {
  return getProjects(locale).map((p) => p.slug);
}

/** Dile göre liste sırasında dairesel önceki/sonraki (§7.8.6); toplam < 2 ise undefined. */
export function getAdjacentProjects(
  slug: string,
  locale: Locale,
): { prev: ProjectDoc; next: ProjectDoc } | undefined {
  const list = getProjects(locale);
  const i = list.findIndex((p) => p.slug === slug);
  if (i < 0 || list.length < 2) return undefined;
  const n = list.length;
  return { prev: list[(i - 1 + n) % n] as ProjectDoc, next: list[(i + 1) % n] as ProjectDoc };
}

/** Aynı birincil alan, liste sırasıyla; kendisi ve "sonraki proje" hariç; en fazla `limit` (§7.8.6). */
export function getRelatedProjects(slug: string, locale: Locale, limit = 3): ProjectDoc[] {
  const self = getProject(slug, locale);
  if (!self) return [];
  const next = getAdjacentProjects(slug, locale)?.next.slug;
  return getProjects(locale)
    .filter((p) => p.slug !== slug && p.slug !== next && p.primaryArea === self.primaryArea)
    .slice(0, limit);
}

/** §5.10 bandOf girdisi: start yılı → year (sürüyorsa build yılı) */
export function projectYears(p: Pick<ProjectDoc, 'start' | 'year'>): {
  start: number;
  end: number;
} {
  return { start: yearOf(p.start), end: p.year };
}

export function entryYears(e: { period: { start: string; end?: string } }): {
  start: number;
  end: number;
} {
  return { start: yearOf(e.period.start), end: e.period.end ? yearOf(e.period.end) : BUILD_YEAR };
}

/* ───────────── sayfalar, CV, referanslar ───────────── */

export function getPageBody(key: 'about' | 'privacy', locale: Locale): PageBodyDoc | undefined {
  return allPageBodies.find((b) => b.key === key && b.locale === locale && !b.draft);
}

function cvSource(): CvSource {
  return {
    site,
    person,
    contact,
    cvExperience,
    cvEducation,
    cvCertifications,
    cvAwards,
    cvPublications,
    cvSkills,
    cvLanguages,
    testimonials,
    projects: allProjects,
    allAreas,
  };
}

/** /cv bölümleri: cv.ts selectCv(…, 'web') (§7.6.1) */
export function getCv(locale: Locale): CvData {
  return { sections: selectCv(cvSource(), locale, 'web'), updatedAt: site.cv.updatedAt };
}

/** Ana sayfa journey seçimi (§7.6.1); metin yedeği görünümde t() ile yapılır. */
export function getHomeJourney(locale: Locale): HomeJourney {
  void locale;
  return selectHomeJourney(cvSource());
}

/** features.testimonials kapalıysa [] */
export function getTestimonials(
  locale: Locale,
  opts: { featured?: boolean } = {},
): TestimonialDoc[] {
  void locale;
  if (!site.features.testimonials) return [];
  return testimonials.items.filter(
    (x) => opts.featured === undefined || x.featured === opts.featured,
  );
}

const PAGE_RE = /\/Type\s*\/Page(?![s\w])/g;

/** build-cv çıktısından bayt ve sayfa sayısı (§7.6.6); dosya yoksa (dev'de build-cv çalışmadıysa) null. */
export function getCvFile(locale: Locale): { href: string; bytes: number; pages: number } | null {
  if (!isLocaleEnabled(locale)) return null;
  const href = fileRoutes.cvPdf[locale];
  const file = path.join(process.cwd(), 'public', href);
  try {
    const bytes = statSync(file).size;
    const pages = (readFileSync(file).toString('latin1').match(PAGE_RE) ?? []).length;
    return { href, bytes, pages };
  } catch {
    return null;
  }
}

/* ───────────── route ↔ içerik sözleşmesi (§7.4.3) ───────────── */

export function availableLocales(key: RouteKey, slug?: string): Locale[] {
  const en = isLocaleEnabled('en');
  const both = (enOk: boolean): Locale[] => (en && enOk ? ['tr', 'en'] : ['tr']);
  switch (key) {
    case 'home':
    case 'cv':
    case 'projects':
    case 'expertise':
    case 'contact':
      return both(true);
    case 'about':
      return both(getPageBody('about', 'en') !== undefined);
    case 'privacy':
      return both(getPageBody('privacy', 'en') !== undefined);
    case 'project': {
      const p = allProjects.find((x) => x.slug === slug);
      if (!p) return [];
      return both(p.locales.includes('en'));
    }
    case 'area': {
      const a = allAreas.find((x) => x.id === slug);
      if (!a || !site.features.areaPages || !a.hasPage || !a.pageLocales.includes('tr')) return [];
      return both(a.pageLocales.includes('en'));
    }
    case 'lab':
      return process.env.NEXT_PUBLIC_ENABLE_LAB === '1' ? ['tr'] : [];
  }
}

/** §3.4.1; = availableLocales(ref.key, ref.param) */
export function pageLocales(ref: PageRef): Locale[] {
  return availableLocales(ref.key, ref.param);
}

/** PartialDate; kaynaklar §3.4.2. new Date() YASAK. */
export function pageDates(ref: PageRef): { published?: string; modified?: string } {
  switch (ref.key) {
    case 'project': {
      const p = allProjects.find((x) => x.slug === ref.param);
      return p ? { published: p.publishedAt, modified: p.updatedAt ?? p.publishedAt } : {};
    }
    case 'cv':
      return { modified: site.cv.updatedAt };
    case 'about': {
      const body = getPageBody('about', 'tr');
      return body?.updatedAt ? { modified: body.updatedAt } : {};
    }
    default:
      return {};
  }
}

/** Yalnız /cv JSON-LD'si (§11.6.2) */
export function getCvSummary(locale: Locale): {
  skills: string[];
  credentials: { name: string; issuer: string; url?: string }[];
  awards: string[];
} {
  const skills = cvSkills.items.filter((s) => s.featured).map((s) => pick(s.name, locale));
  const credentials = cvCertifications.items
    .filter((c) => isVisible(c.visibility, 'web'))
    .sort(byDateDesc)
    .map((c) => ({
      name: pick(c.name, locale),
      issuer: c.issuer,
      ...(c.url ? { url: c.url } : {}),
    }));
  const awards = cvAwards.items
    .filter((a) => isVisible(a.visibility, 'web'))
    .sort(byDateDesc)
    .map((a) => `${pick(a.title, locale)} — ${a.awarder}, ${yearOf(a.date)}`);
  return { skills, credentials, awards };
}

/* ───────────── sahne verisi (§5.9.1) ───────────── */

/**
 * StagePreset / LabStage verisi. folio'da slug ZORUNLU; 'none' için data={null} verilir.
 * locale: ana sayfa listesi dile göre değişir (TR 4, EN 3 öne çıkan); varsayılan 'tr'.
 */
export function getStageData(
  preset: Exclude<PresetName, 'none'>,
  slug?: string,
  locale: Locale = 'tr',
): StageData {
  const g = ringGeometry(getCareerStartYear(), BUILD_YEAR);
  const areas = getAreas();
  const sectors = getAreaMode() === 'dial' ? areas.length : 0;
  const areaIndex = (id: string) => {
    const k = areas.findIndex((a) => a.id === id);
    return sectors > 0 && k >= 0 ? k : null;
  };
  const projectData = (p: ProjectDoc) => {
    const y = projectYears(p);
    return { slug: p.slug, area: areaIndex(p.primaryArea), band: bandOf(y.start, y.end, g) };
  };
  const entryBand = (e: { period: { start: string; end?: string } }) => {
    const y = entryYears(e);
    return { band: bandOf(y.start, y.end, g) };
  };
  const intensity = getExperienceProfile(getSite().persona).intensity; // areas dönüş easing'i (§5.9.4)
  const base = { rings: g.rings, sectors, intensity };

  switch (preset) {
    case 'home':
      return {
        ...base,
        projects: getProjects(locale, { featured: true }).map(projectData),
        entries: selectHomeJourney(cvSource()).experience.map(entryBand),
      };
    case 'folio': {
      if (!slug) throw new Error('getStageData("folio"): slug zorunlu');
      const self = getProject(slug, locale);
      if (!self) throw new Error(`getStageData("folio"): bilinmeyen proje "${slug}"`);
      const next = getAdjacentProjects(slug, locale)?.next;
      return { ...base, projects: [self, ...(next ? [next] : [])].map(projectData), entries: [] };
    }
    case 'plan-small':
      return {
        ...base,
        projects: getProjects(locale).map(projectData),
        entries: [],
        activeArea: slug ? areaIndex(slug) : null,
      };
    case 'cv-core': {
      // /cv'deki [data-cv-entry] DOM sırası (bölüm sırası, §7.6.1): girdi aktivasyon çizgileri bu sırayla eşleşir
      const entries: Array<{ band: readonly [number, number] | null }> = [];
      for (const s of selectCv(cvSource(), locale, 'web'))
        if (s.key === 'experience' || s.key === 'education')
          entries.push(...s.entries.map(entryBand));
      return { ...base, projects: [], entries };
    }
    case 'about-page':
    case 'contact-page':
      return { ...base, projects: [], entries: [] };
  }
}
