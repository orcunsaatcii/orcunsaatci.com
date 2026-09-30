// src/lib/content/cv.ts: saf; /cv view'u (getCv üzerinden) ve scripts/build-cv.tsx kullanır. server-only YASAK.
// Seçim, sıralama ve JSON Resume eşlemesi tek yerde durur; üç çıktı (sayfa, PDF, JSON) ayrışamaz (§7.6).
// tsx ile Node'da da çalışır: yalnız göreli import (§7.2.3).
import type {
  Area,
  Contact,
  CvAwards,
  CvCertifications,
  CvEducation,
  CvExperience,
  CvLanguages,
  CvPublications,
  CvSkills,
  Person,
  Project,
  Site,
  Testimonials,
} from 'content-collections';
import { pathOf, type Locale } from '../../i18n/config';
import en from '../../i18n/dictionaries/en';
import tr from '../../i18n/dictionaries/tr';

export type CvTarget = 'web' | 'pdf'; // JSON Resume, 'pdf' seçimini kullanır
export type CvSectionKey =
  | 'profile'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'education'
  | 'certifications'
  | 'awards'
  | 'publications'
  | 'languages';

export type ExperienceItem = CvExperience['items'][number];
export type EducationItem = CvEducation['items'][number];
export type CertificationItem = CvCertifications['items'][number];
export type AwardItem = CvAwards['items'][number];
export type PublicationItem = CvPublications['items'][number];
export type SkillItem = CvSkills['items'][number];
export type LanguageItem = CvLanguages['items'][number];
export type SkillCategory = SkillItem['category'];
type Text = { tr: string; en?: string };

/** build-cv.tsx: `{ ...C, projects: C.allProjects }`; view: getCv() aynı alanları verir. */
export interface CvSource {
  site: Site;
  person: Person;
  contact: Contact;
  cvExperience: CvExperience;
  cvEducation: CvEducation;
  cvCertifications: CvCertifications;
  cvAwards: CvAwards;
  cvPublications: CvPublications;
  cvSkills: CvSkills;
  cvLanguages: CvLanguages;
  testimonials: Testimonials;
  projects: readonly Project[];
  allAreas: readonly Area[];
}

export interface SkillGroup {
  category: SkillCategory;
  skills: SkillItem[];
}

export type CvSection =
  | { key: 'profile'; anchor: string; entries: [Text] }
  | { key: 'experience'; anchor: string; entries: ExperienceItem[] }
  | { key: 'projects'; anchor: string; entries: Project[] }
  | { key: 'skills'; anchor: string; entries: SkillGroup[] }
  | { key: 'education'; anchor: string; entries: EducationItem[] }
  | { key: 'certifications'; anchor: string; entries: CertificationItem[] }
  | { key: 'awards'; anchor: string; entries: AwardItem[] }
  | { key: 'publications'; anchor: string; entries: PublicationItem[] }
  | { key: 'languages'; anchor: string; entries: LanguageItem[] };

export const CV_ANCHORS: Record<Locale, Record<CvSectionKey, string>> = {
  tr: {
    profile: 'profil',
    experience: 'deneyim',
    projects: 'projeler',
    skills: 'yetkinlikler',
    education: 'egitim',
    certifications: 'sertifikalar',
    awards: 'oduller',
    publications: 'yayinlar',
    languages: 'diller',
  },
  en: {
    profile: 'profile',
    experience: 'experience',
    projects: 'projects',
    skills: 'skills',
    education: 'education',
    certifications: 'certifications',
    awards: 'awards',
    publications: 'publications',
    languages: 'languages',
  },
};

export const SKILL_CATEGORY_ORDER: readonly SkillCategory[] = [
  'core',
  'method',
  'tool',
  'domain',
  'soft',
];
const LANGUAGE_ORDER: readonly LanguageItem['level'][] = [
  'native',
  'c2',
  'c1',
  'b2',
  'b1',
  'a2',
  'a1',
];
/** Ana sayfa "Ödüller / Konuşmalar" listesine giren yayın türleri (§7.6.1) */
const TALK_TYPES: ReadonlySet<PublicationItem['type']> = new Set([
  'talk',
  'workshop',
  'podcast',
  'interview',
  'exhibition',
]);
const PUBLICATION_TYPES: ReadonlySet<PublicationItem['type']> = new Set([
  'article',
  'paper',
  'book',
  'chapter',
]);
const DICT = { tr, en } as const;

/** scripts/cv-document.tsx için sözlük: ESM betik CJS'e derlenen sözlüğün default export'unu doğrudan alamaz (tsx birlikte çalışma) */
export function cvDictionary(locale: Locale): (typeof DICT)[Locale] {
  return DICT[locale];
}

/** Kısa alanın dile göre metni (EN yoksa TR). Görünüm katmanı yedeği `t()` ile işaretler (§7.4.4). */
export function pick(v: Text | undefined, locale: Locale): string {
  if (!v) return '';
  return locale === 'en' ? (v.en ?? v.tr) : v.tr;
}

/* ───────────── görünürlük ve sıralama ───────────── */

type Visibility = ExperienceItem['visibility'];
export function isVisible(visibility: Visibility, target: CvTarget): boolean {
  if (visibility === 'hidden') return false;
  if (visibility === 'web-and-pdf') return true;
  return target === 'web' ? visibility === 'web-only' : visibility === 'pdf-only';
}

/** Kısmi tarihi karşılaştırılabilir tam tarihe tamamlar: start → -01-01, end → -12-31 (§7.6.1). */
export function completeDate(d: string, edge: 'start' | 'end'): string {
  const [y, m, day] = d.split('-');
  const month = m ?? (edge === 'start' ? '01' : '12');
  const dd = day ?? (edge === 'start' ? '01' : '31');
  return `${y}-${month}-${dd}`;
}

type Periodic = { period: { start: string; end?: string } };
/** Önce sürenler (end yok), sonra end azalan, sonra start azalan. */
export function byPeriod(a: Periodic, b: Periodic): number {
  const ae = a.period.end;
  const be = b.period.end;
  if (!ae !== !be) return ae ? 1 : -1;
  if (ae && be) {
    const d = completeDate(be, 'end').localeCompare(completeDate(ae, 'end'));
    if (d !== 0) return d;
  }
  return completeDate(b.period.start, 'start').localeCompare(completeDate(a.period.start, 'start'));
}

/** date azalan */
export function byDateDesc(a: { date: string }, b: { date: string }): number {
  return completeDate(b.date, 'start').localeCompare(completeDate(a.date, 'start'));
}

export function groupSkills(items: readonly SkillItem[], locale: Locale): SkillGroup[] {
  const collator = new Intl.Collator(locale === 'tr' ? 'tr-TR' : 'en-GB');
  return SKILL_CATEGORY_ORDER.map((category) => ({
    category,
    skills: items
      .filter((s) => s.category === category)
      .sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          collator.compare(pick(a.name, locale), pick(b.name, locale)),
      ),
  })).filter((g) => g.skills.length > 0);
}

export function sortLanguages(items: readonly LanguageItem[]): LanguageItem[] {
  return [...items].sort(
    (a, b) => LANGUAGE_ORDER.indexOf(a.level) - LANGUAGE_ORDER.indexOf(b.level),
  );
}

/** §7.8.1 liste sırası: featured ↓, order ↑, year ↓, start ↓, başlık (Collator). */
export function sortProjects<
  T extends Pick<Project, 'featured' | 'order' | 'year' | 'start' | 'title'>,
>(items: readonly T[], locale: Locale): T[] {
  const collator = new Intl.Collator(locale === 'tr' ? 'tr-TR' : 'en-GB');
  return [...items].sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      a.order - b.order ||
      b.year - a.year ||
      b.start.localeCompare(a.start) ||
      collator.compare(pick(a.title, locale), pick(b.title, locale)),
  );
}

/* ───────────── seçim ───────────── */

/** /cv (web) ve PDF (pdf) bölümleri, §7.6.1 sırasıyla; boş bölümler çıkarılır. */
export function selectCv(src: CvSource, locale: Locale, target: CvTarget): CvSection[] {
  const A = CV_ANCHORS[locale];
  const vis = <T extends { visibility: Visibility }>(items: readonly T[]) =>
    items.filter((i) => isVisible(i.visibility, target));
  const summary = src.site.cv.summary ?? src.person.shortBio;

  const sections: CvSection[] = [
    { key: 'profile', anchor: A.profile, entries: [summary] },
    {
      key: 'experience',
      anchor: A.experience,
      entries: vis(src.cvExperience.items).sort(byPeriod),
    },
    {
      key: 'projects',
      anchor: A.projects,
      entries:
        target === 'pdf'
          ? sortProjects(
              src.projects.filter((p) => p.featured && p.locales.includes(locale)),
              locale,
            ).slice(0, 5)
          : [],
    },
    { key: 'skills', anchor: A.skills, entries: groupSkills(src.cvSkills.items, locale) },
    { key: 'education', anchor: A.education, entries: vis(src.cvEducation.items).sort(byPeriod) },
    {
      key: 'certifications',
      anchor: A.certifications,
      entries: vis(src.cvCertifications.items).sort(byDateDesc),
    },
    { key: 'awards', anchor: A.awards, entries: vis(src.cvAwards.items).sort(byDateDesc) },
    {
      key: 'publications',
      anchor: A.publications,
      entries: vis(src.cvPublications.items).sort(byDateDesc),
    },
    { key: 'languages', anchor: A.languages, entries: sortLanguages(src.cvLanguages.items) },
  ];

  // Araştırmacı personası: yayınlar Profil'in hemen arkasına (§7.6.1); v1'de ayrı sayfa üretilmez
  if (src.site.features.publicationsPage) {
    const i = sections.findIndex((s) => s.key === 'publications');
    const [pubs] = sections.splice(i, 1);
    if (pubs) sections.splice(1, 0, pubs);
  }
  return sections.filter((s) => s.entries.length > 0);
}

export interface HomeJourney {
  experience: ExperienceItem[];
  education: EducationItem[];
  awardsTalks: (
    { kind: 'award'; item: AwardItem } | { kind: 'publication'; item: PublicationItem }
  )[];
  languages: LanguageItem[];
}

/** Ana sayfa `journey` seçimi (§7.6.1): E ≤ 6, eğitim ≤ 2, ödül/konuşma ≤ 3, dil ≤ 6. */
export function selectHomeJourney(src: CvSource): HomeJourney {
  const onHome = <T extends { visibility: Visibility; showOnHome: boolean }>(items: readonly T[]) =>
    items.filter((i) => i.showOnHome && isVisible(i.visibility, 'web'));
  const awards = src.cvAwards.items
    .filter((a) => isVisible(a.visibility, 'web'))
    .map((item) => ({ kind: 'award' as const, item, featured: item.featured, date: item.date }));
  const talks = src.cvPublications.items
    .filter((p) => isVisible(p.visibility, 'web') && (TALK_TYPES.has(p.type) || p.featured))
    .map((item) => ({
      kind: 'publication' as const,
      item,
      featured: item.featured,
      date: item.date,
    }));
  const awardsTalks = [...awards, ...talks]
    .sort((a, b) => Number(b.featured) - Number(a.featured) || byDateDesc(a, b))
    .slice(0, 3)
    .map((x) =>
      x.kind === 'award' ? { kind: x.kind, item: x.item } : { kind: x.kind, item: x.item },
    );
  return {
    experience: onHome(src.cvExperience.items).sort(byPeriod).slice(0, 6),
    education: onHome(src.cvEducation.items).sort(byPeriod).slice(0, 2),
    awardsTalks,
    languages: sortLanguages(src.cvLanguages.items).slice(0, 6),
  };
}

/* ───────────── JSON Resume (§7.6.5) ───────────── */

const clean = <T extends Record<string, unknown>>(o: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)),
  ) as Partial<T>;

export function toJsonResume(
  src: CvSource,
  locale: Locale,
  siteUrl: string,
): Record<string, unknown> {
  const dict = DICT[locale];
  const p = (v: Text | undefined) => (v ? pick(v, locale) : undefined);
  const list = (v: { tr: string[]; en?: string[] } | undefined) =>
    v ? (locale === 'en' ? (v.en ?? v.tr) : v.tr) : undefined;
  const pdf = <T extends { visibility: Visibility }>(items: readonly T[]) =>
    items.filter((i) => isVisible(i.visibility, 'pdf'));
  const home = pathOf({ key: 'home' }, locale);
  const photo = src.person.headshot ?? src.person.portrait;
  const areaTitle = new Map(src.allAreas.map((a) => [a.id, pick(a.title, locale)]));
  const experience = pdf(src.cvExperience.items).sort(byPeriod);

  const job = (e: ExperienceItem) =>
    clean({
      position: p(e.role),
      url: e.organizationUrl,
      location: p(e.location),
      startDate: e.period.start,
      endDate: e.period.end,
      summary: p(e.summary),
      highlights: list(e.highlights),
    });

  return clean({
    basics: clean({
      name: src.person.name,
      label: p(src.person.jobTitle),
      image: photo ? `${siteUrl}${photo.src}` : undefined,
      email: src.contact.email,
      phone: src.contact.phone,
      url: `${siteUrl}${home}`,
      summary: p(src.site.cv.summary ?? src.person.shortBio),
      location: { city: p(src.person.location.city), countryCode: src.person.location.countryCode },
      profiles: src.contact.social.map((s) =>
        clean({
          network: s.label ? p(s.label) : dict.social[s.network],
          username: s.handle,
          url: s.url,
        }),
      ),
    }),
    work: experience
      .filter((e) => e.employmentType !== 'volunteer')
      .map((e) => ({ name: e.organization, ...job(e) })),
    volunteer: experience
      .filter((e) => e.employmentType === 'volunteer')
      .map((e) => ({ organization: e.organization, ...job(e) })),
    education: pdf(src.cvEducation.items)
      .sort(byPeriod)
      .map((e) =>
        clean({
          institution: e.institution,
          url: e.institutionUrl,
          area: p(e.field),
          studyType: p(e.degree),
          startDate: e.period.start,
          endDate: e.period.end,
          score: e.grade,
          courses: e.courses.map((c) => pick(c, locale)),
        }),
      ),
    certificates: pdf(src.cvCertifications.items)
      .sort(byDateDesc)
      .map((c) => clean({ name: p(c.name), date: c.date, issuer: c.issuer, url: c.url })),
    awards: pdf(src.cvAwards.items)
      .sort(byDateDesc)
      .map((a) =>
        clean({ title: p(a.title), date: a.date, awarder: a.awarder, summary: p(a.summary) }),
      ),
    publications: pdf(src.cvPublications.items)
      .filter((x) => PUBLICATION_TYPES.has(x.type))
      .sort(byDateDesc)
      .map((x) =>
        clean({
          name: p(x.title),
          publisher: x.venue,
          releaseDate: x.date,
          url: x.url,
          summary: p(x.summary),
        }),
      ),
    projects: [
      ...sortProjects(src.projects, locale).map((pr) =>
        clean({
          name: p(pr.title),
          description: p(pr.summary),
          keywords: pr.areas.flatMap((a) => (areaTitle.has(a) ? [areaTitle.get(a) as string] : [])),
          startDate: pr.start,
          endDate: pr.end,
          url: pr.locales.includes(locale)
            ? `${siteUrl}${pathOf({ key: 'project', param: pr.slug }, locale)}`
            : undefined,
          roles: [p(pr.role) as string],
          type: pr.kind,
        }),
      ),
      ...pdf(src.cvPublications.items)
        .filter((x) => TALK_TYPES.has(x.type))
        .sort(byDateDesc)
        .map((x) =>
          clean({
            name: p(x.title),
            description: p(x.summary),
            startDate: x.date,
            url: x.url,
            entity: x.venue,
            type: x.type,
          }),
        ),
    ],
    skills: groupSkills(src.cvSkills.items, locale).map((g) => ({
      name: dict.cv.skillCategories[g.category],
      keywords: g.skills.map((s) => pick(s.name, locale)),
    })),
    languages: sortLanguages(src.cvLanguages.items).map((l) => ({
      language: pick(l.name, locale),
      fluency: dict.cv.languageLevels[l.level],
    })),
    references: src.site.features.testimonials
      ? src.testimonials.items.map((t) => ({
          name: `${t.author}, ${pick(t.role, locale)}`,
          reference: pick(t.quote, locale),
        }))
      : undefined,
    meta: {
      canonical: `${siteUrl}/files/resume.${locale}.json`,
      lastModified: src.site.cv.updatedAt,
    },
  });
}
