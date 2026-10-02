// src/lib/seo/jsonld.ts — sayfa başına tek @graph (§11.6). Görünür metinle aynı dil ve içerik.
// Google @id referanslarını sayfalar arası çözmez: her grafik referans verdiği düğümleri kendisi taşır.
import 'server-only';
import type {
  BreadcrumbList,
  CollectionPage,
  ContactPage,
  CreativeWork,
  DefinedTerm,
  Graph,
  ImageObject,
  ItemList,
  PersonLeaf,
  ProfilePage,
  ScholarlyArticle,
  Thing,
  WebPage,
  WebSite,
} from 'schema-dts';
import { absoluteUrl, pathOf, trail, type Locale, type PageRef } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import {
  getAreaPageIds,
  getAreas,
  getContact,
  getCv,
  getCvSummary,
  getHomeJourney,
  getPerson,
  getProject,
  getProjects,
  getSite,
  getWorksFor,
  pageDates,
  t,
  type ProjectDoc,
} from '@/lib/content';
import { BRAND, fullTitle, homeTitle } from './metadata';

const ROOT = absoluteUrl('/');

export const ids = {
  person: `${ROOT}#person`,
  website: `${ROOT}#website`,
  portrait: `${ROOT}#portrait`,
  webpage: (pageUrl: string) => `${pageUrl}#webpage`,
  breadcrumb: (pageUrl: string) => `${pageUrl}#breadcrumb`,
  list: (pageUrl: string) => `${pageUrl}#list`,
  work: (slug: string) => `${absoluteUrl(pathOf({ key: 'project', param: slug }, 'tr'))}#work`, // TR URL, dilden bağımsız
  area: (id: string) => `${absoluteUrl(pathOf({ key: 'expertise' }, 'tr') as string)}#${id}`,
};

/** '2025' → '2025-01-01T00:00:00+03:00'; '2025-07' → '2025-07-01T…'; '2025-07-10' → '2025-07-10T…' */
export function toIsoDateTime(partial: string): string {
  const [y, m = '01', d = '01'] = partial.split('-');
  return `${y}-${m}-${d}T00:00:00+03:00`;
}

const ref = (id: string) => ({ '@id': id });
const pageUrl = (r: PageRef, locale: Locale) => absoluteUrl(pathOf(r, locale) as string);

/* ───────────── ortak düğümler ───────────── */

function websiteShort(): WebSite {
  return { '@type': 'WebSite', '@id': ids.website, url: ROOT, name: BRAND };
}

function websiteFull(): WebSite {
  return {
    ...websiteShort(),
    alternateName: getPerson().asciiName,
    inLanguage: [...getSite().locales],
    publisher: ref(ids.person),
  };
}

function personShort(): PersonLeaf {
  return { '@type': 'Person', '@id': ids.person, name: BRAND, url: ROOT };
}

function portraitNode(): ImageObject | undefined {
  const img = getPerson().headshot;
  if (!img) return undefined;
  return {
    '@type': 'ImageObject',
    '@id': ids.portrait,
    url: absoluteUrl(img.src),
    width: { '@type': 'QuantitativeValue', value: img.width, unitCode: 'E37' },
    height: { '@type': 'QuantitativeValue', value: img.height, unitCode: 'E37' },
    caption: BRAND,
  };
}

/** Web'de görünen eğitim kurumları (tekil) */
function alumniOf(locale: Locale): string[] {
  const s = getCv(locale).sections.find((x) => x.key === 'education');
  return s && s.key === 'education' ? [...new Set(s.entries.map((e) => e.institution))] : [];
}

function personFull(locale: Locale): PersonLeaf {
  const person = getPerson();
  const contact = getContact();
  const worksFor = getWorksFor();
  const image = portraitNode();
  const knowsAbout = [
    ...person.knowsAbout.map((k) => t(k, locale).text),
    ...getAreas().map((a) => t(a.title, locale).text),
  ];
  const sameAs = contact.social.filter((s) => s.sameAs).map((s) => s.url);
  const alumni = alumniOf(locale);
  return {
    ...personShort(),
    alternateName: person.asciiName,
    givenName: person.givenName,
    familyName: person.familyName,
    jobTitle: t(person.jobTitle, locale).text,
    description: t(person.shortBio, locale).text,
    ...(image ? { image } : {}),
    email: contact.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: t(person.location.city, locale).text,
      addressCountry: person.location.countryCode,
    },
    ...(knowsAbout.length ? { knowsAbout } : {}),
    knowsLanguage: getHomeJourney(locale).languages.map((l) => l.code),
    ...(sameAs.length ? { sameAs } : {}),
    ...(worksFor ? { worksFor: { '@type': 'Organization', name: worksFor.organization } } : {}),
    ...(alumni.length
      ? { alumniOf: alumni.map((name) => ({ '@type': 'EducationalOrganization' as const, name })) }
      : {}),
  };
}

/** Görünür Breadcrumbs ile aynı adlar (§3.9.2); son öğe `item` taşımaz. */
function breadcrumb(r: PageRef, locale: Locale, title?: string): BreadcrumbList {
  const dict = getDictionary(locale);
  const chain = trail(r);
  const name = (x: PageRef): string => {
    if (x.key === 'home') return dict.breadcrumb.home;
    if (x.key === 'project' || x.key === 'area') return title ?? x.param;
    return dict.meta[x.key];
  };
  return {
    '@type': 'BreadcrumbList',
    '@id': ids.breadcrumb(pageUrl(r, locale)),
    itemListElement: chain.map((x, i) => ({
      '@type': 'ListItem' as const,
      position: i + 1,
      name: name(x),
      ...(i < chain.length - 1 ? { item: pageUrl(x, locale) } : {}),
    })),
  };
}

function datesOf(r: PageRef, published: 'datePublished' | 'dateCreated') {
  const d = pageDates(r);
  return {
    ...(d.published ? { [published]: toIsoDateTime(d.published) } : {}),
    ...(d.modified ? { dateModified: toIsoDateTime(d.modified) } : {}),
  };
}

function areaTerm(id: string, name: string, locale: Locale, withUrl: boolean): DefinedTerm {
  return {
    '@type': 'DefinedTerm',
    '@id': ids.area(id),
    name,
    ...(withUrl ? { url: pageUrl({ key: 'area', param: id }, locale) } : {}),
  };
}

/** Persona → iş düğümü tipi (§11.6.2, D-35, D-48) */
function workNode(p: ProjectDoc, locale: Locale): CreativeWork | ScholarlyArticle {
  const areas = getAreas();
  const titles = p.areas.map((id) => t(areas.find((a) => a.id === id)?.title, locale).text);
  const live = p.links.filter((l) => l.kind === 'live').map((l) => l.url);
  const base = {
    '@id': ids.work(p.slug),
    name: t(p.title, locale).text,
    description: t(p.summary, locale).text,
    image: absoluteUrl(p.cover.src),
    dateCreated: p.start, // toIsoDateTime'dan geçmez (§11.6.1)
    creator: ref(ids.person),
    about: p.areas.map((id, i) => areaTerm(id, titles[i] ?? id, locale, false)),
    keywords: titles,
    ...(live.length ? { sameAs: live } : {}),
  };
  return getSite().persona === 'researcher'
    ? { '@type': 'ScholarlyArticle', ...base }
    : { '@type': 'CreativeWork', ...base };
}

/* ───────────── sayfa → grafik (§11.6.2) ───────────── */

function graph(nodes: (Thing | undefined)[]): Graph {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter((n): n is Thing => n !== undefined),
  };
}

/** View'lar bunu çağırır: <JsonLd graph={jsonLdFor(ref, locale)} />. */
export function jsonLdFor(r: PageRef, locale: Locale): Graph | null {
  const url = pageUrl(r, locale);
  const dict = getDictionary(locale);
  const site = getSite();
  const describe = (v: { tr: string; en?: string }) => t(v, locale).text;
  const page = {
    '@id': ids.webpage(url),
    url,
    inLanguage: locale,
    isPartOf: ref(ids.website),
  };

  switch (r.key) {
    case 'home': {
      const portrait = site.features.portraitOnHome && getPerson().headshot;
      const webpage: WebPage = {
        '@type': 'WebPage',
        ...page,
        name: homeTitle(locale),
        description: describe(site.seo.pages.home.description),
        about: ref(ids.person),
        ...(portrait ? { primaryImageOfPage: ref(ids.portrait) } : {}),
      };
      return graph([websiteFull(), personFull(locale), webpage]);
    }
    case 'about': {
      const profile: ProfilePage = {
        '@type': 'ProfilePage',
        ...page,
        name: fullTitle(dict.meta.about),
        description: describe(site.seo.pages.about.description),
        ...datesOf(r, 'dateCreated'),
        mainEntity: ref(ids.person),
        breadcrumb: ref(ids.breadcrumb(url)),
      };
      return graph([websiteShort(), profile, personFull(locale), breadcrumb(r, locale)]);
    }
    case 'cv': {
      const summary = getCvSummary(locale);
      const person = getPerson();
      const cvPerson: PersonLeaf = {
        ...personFull(locale),
        hasOccupation: {
          '@type': 'Occupation',
          name: t(person.jobTitle, locale).text,
          ...(summary.skills.length ? { skills: summary.skills } : {}),
        },
        ...(summary.credentials.length
          ? {
              hasCredential: summary.credentials.map((c) => ({
                '@type': 'EducationalOccupationalCredential' as const,
                name: c.name,
                credentialCategory: 'certificate',
                recognizedBy: { '@type': 'Organization' as const, name: c.issuer },
                ...(c.url ? { url: c.url } : {}),
              })),
            }
          : {}),
        ...(summary.awards.length ? { award: summary.awards } : {}),
      };
      const webpage: WebPage = {
        '@type': 'WebPage',
        ...page,
        name: fullTitle(dict.meta.cv),
        description: describe(site.seo.pages.cv.description),
        ...datesOf(r, 'dateCreated'),
        about: ref(ids.person),
        mainEntity: ref(ids.person),
        breadcrumb: ref(ids.breadcrumb(url)),
      };
      return graph([websiteShort(), webpage, cvPerson, breadcrumb(r, locale)]);
    }
    case 'projects': {
      const list = getProjects(locale).filter((p) => !p.seo.noindex);
      const collection: CollectionPage = {
        '@type': 'CollectionPage',
        ...page,
        name: fullTitle(dict.meta.projects),
        description: describe(site.seo.pages.projects.description),
        about: ref(ids.person),
        mainEntity: ref(ids.list(url)),
        breadcrumb: ref(ids.breadcrumb(url)),
      };
      const itemList: ItemList = {
        '@type': 'ItemList',
        '@id': ids.list(url),
        numberOfItems: list.length,
        itemListElement: list.map((p, i) => ({
          '@type': 'ListItem' as const,
          position: i + 1,
          url: pageUrl({ key: 'project', param: p.slug }, locale),
          name: t(p.title, locale).text,
        })),
      };
      return graph([websiteShort(), collection, itemList, personShort(), breadcrumb(r, locale)]);
    }
    case 'project': {
      const p = getProject(r.param, locale);
      if (!p) return null;
      const title = t(p.title, locale).text;
      const webpage: WebPage = {
        '@type': 'WebPage',
        ...page,
        name: fullTitle(title),
        description: t(p.summary, locale).text,
        ...datesOf(r, 'datePublished'),
        mainEntity: ref(ids.work(p.slug)),
        breadcrumb: ref(ids.breadcrumb(url)),
      };
      return graph([
        websiteShort(),
        personShort(),
        webpage,
        workNode(p, locale),
        breadcrumb(r, locale, title),
      ]);
    }
    case 'expertise': {
      const withPage = new Set(getAreaPageIds(locale));
      const collection: CollectionPage = {
        '@type': 'CollectionPage',
        ...page,
        name: fullTitle(dict.meta.expertise),
        description: describe(site.seo.pages.expertise.description),
        about: ref(ids.person),
        mainEntity: ref(ids.list(url)),
        breadcrumb: ref(ids.breadcrumb(url)),
      };
      const itemList: ItemList = {
        '@type': 'ItemList',
        '@id': ids.list(url),
        numberOfItems: getAreas().length,
        itemListElement: getAreas().map((a, i) => ({
          '@type': 'ListItem' as const,
          position: i + 1,
          item: {
            ...areaTerm(a.id, t(a.title, locale).text, locale, withPage.has(a.id)),
            description: t(a.summary, locale).text,
          },
        })),
      };
      return graph([websiteShort(), collection, itemList, personShort(), breadcrumb(r, locale)]);
    }
    case 'area': {
      const area = getAreas().find((a) => a.id === r.param);
      if (!area) return null;
      const title = t(area.title, locale).text;
      const projects = getProjects(locale, { area: area.id }).filter((p) => !p.seo.noindex);
      const collection: CollectionPage = {
        '@type': 'CollectionPage',
        ...page,
        name: fullTitle(title),
        description: t(area.summary, locale).text,
        about: ref(ids.area(area.id)),
        mainEntity: ref(ids.list(url)),
        breadcrumb: ref(ids.breadcrumb(url)),
      };
      const itemList: ItemList = {
        '@type': 'ItemList',
        '@id': ids.list(url),
        numberOfItems: projects.length,
        itemListElement: projects.map((p, i) => ({
          '@type': 'ListItem' as const,
          position: i + 1,
          url: pageUrl({ key: 'project', param: p.slug }, locale),
          name: t(p.title, locale).text,
        })),
      };
      return graph([
        websiteShort(),
        collection,
        { ...areaTerm(area.id, title, locale, true), description: t(area.summary, locale).text },
        itemList,
        personShort(),
        breadcrumb(r, locale, title),
      ]);
    }
    case 'contact': {
      const email = getContact().email;
      const contactPage: ContactPage = {
        '@type': 'ContactPage',
        ...page,
        name: fullTitle(dict.meta.contact),
        description: describe(site.seo.pages.contact.description),
        mainEntity: ref(ids.person),
        breadcrumb: ref(ids.breadcrumb(url)),
      };
      const person: PersonLeaf = {
        ...personShort(),
        email,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'professional inquiries',
          email,
          availableLanguage: site.locales.map((l) => (l === 'tr' ? 'Turkish' : 'English')),
        },
      };
      return graph([websiteShort(), contactPage, person, breadcrumb(r, locale)]);
    }
    case 'privacy': {
      const webpage: WebPage = {
        '@type': 'WebPage',
        ...page,
        name: fullTitle(dict.meta.privacy),
        description: describe(site.seo.pages.privacy.description),
      };
      return graph([websiteShort(), webpage, personShort()]);
    }
  }
}
