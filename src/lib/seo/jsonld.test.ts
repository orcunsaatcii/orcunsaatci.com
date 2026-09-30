// src/lib/seo/jsonld.test.ts — §11.6.4 doğrulamaları 1–8, her sayfa türü × dil için.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serializeJsonLd } from '@/components/seo/JsonLd';
import type { Locale, PageRef } from '@/i18n/config';
import en from '@/i18n/dictionaries/en';
import tr from '@/i18n/dictionaries/tr';
import * as F from '../../../tests/fixtures/content';
import { ids, jsonLdFor, toIsoDateTime } from './jsonld';

vi.mock('content-collections', () => import('../../../tests/fixtures/content'));

afterEach(() => F.resetFixture());

type Node = Record<string, unknown>;
const REFS: [PageRef, Locale[]][] = [
  [{ key: 'home' }, ['tr', 'en']],
  [{ key: 'about' }, ['tr', 'en']],
  [{ key: 'cv' }, ['tr', 'en']],
  [{ key: 'projects' }, ['tr', 'en']],
  [{ key: 'project', param: 'cift-dilli' }, ['tr', 'en']],
  [{ key: 'project', param: 'yalniz-tr' }, ['tr']],
  [{ key: 'expertise' }, ['tr', 'en']],
  [{ key: 'area', param: 'mobil' }, ['tr', 'en']],
  [{ key: 'contact' }, ['tr', 'en']],
  [{ key: 'privacy' }, ['tr', 'en']],
];
const CASES = REFS.flatMap(([ref, locales]) =>
  locales.map(
    (locale) => [`${ref.key}${ref.param ? `:${ref.param}` : ''} (${locale})`, ref, locale] as const,
  ),
);

function graphOf(ref: PageRef, locale: Locale): Node[] {
  const g = jsonLdFor(ref, locale) as { '@graph': Node[] } | null;
  expect(g).not.toBeNull();
  return g!['@graph'];
}

/** Grafikteki (iç içe dâhil) @id taşıyan tam düğümler ve yalnız {"@id"} referansları */
function walk(v: unknown, nodes: Set<string>, refs: string[]): void {
  if (Array.isArray(v)) return v.forEach((x) => walk(x, nodes, refs));
  if (typeof v !== 'object' || v === null) return;
  const o = v as Node;
  const keys = Object.keys(o);
  if (typeof o['@id'] === 'string') {
    if (keys.length === 1) refs.push(o['@id']);
    else nodes.add(o['@id']);
  }
  for (const k of keys) if (k !== '@id') walk(o[k], nodes, refs);
}

describe.each(CASES)('%s', (_, ref, locale) => {
  it('1–2: referanslar çözülür, her üst düğümde @type, üst @id tekil', () => {
    const graph = graphOf(ref, locale);
    const nodes = new Set<string>();
    const refs: string[] = [];
    walk(graph, nodes, refs);
    for (const r of refs) expect(nodes, `çözülmeyen referans ${r}`).toContain(r);
    for (const n of graph) expect(n['@type']).toBeTruthy();
    const top = graph.map((n) => n['@id']).filter(Boolean);
    expect(new Set(top).size).toBe(top.length);
  });

  it('3–4: #person ve #website; sayfa dili; breadcrumb adları görünür breadcrumb ile aynı', () => {
    const graph = graphOf(ref, locale);
    const byId = new Map(graph.map((n) => [n['@id'], n]));
    expect(byId.has('https://www.orcunsaatci.com/#person')).toBe(true);
    expect(byId.has('https://www.orcunsaatci.com/#website')).toBe(true);
    const page = graph.find((n) => typeof n.inLanguage === 'string');
    expect(page?.inLanguage).toBe(locale);
    const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList') as
      { itemListElement: { name: string; item?: string }[] } | undefined;
    if (ref.key === 'home' || ref.key === 'privacy') return void expect(crumbs).toBeUndefined();
    const dict = locale === 'tr' ? tr : en;
    const names = crumbs!.itemListElement.map((x) => x.name);
    expect(names[0]).toBe(dict.breadcrumb.home);
    expect(crumbs!.itemListElement.at(-1)?.item).toBeUndefined();
    if (ref.key === 'project') expect(names.slice(1, 2)).toEqual([dict.meta.projects]);
    if (ref.key === 'area') expect(names.slice(1, 2)).toEqual([dict.meta.expertise]);
    if (!ref.param) expect(names.at(-1)).toBe(dict.meta[ref.key as keyof typeof dict.meta]);
  });

  it('5: ticari tipler yok; 7: serializeJsonLd < içermez ve gidiş-dönüş eşit', () => {
    const g = jsonLdFor(ref, locale)!;
    const s = serializeJsonLd(g);
    for (const type of ['Offer', 'Service', 'AggregateRating', 'Review', 'SearchAction'])
      expect(s).not.toContain(`"@type":"${type}"`);
    expect(s).not.toContain('<');
    expect(JSON.parse(s)).toEqual(g);
  });
});

describe('6: proje grafiği (D-48)', () => {
  it('CreativeWork; Article/SoftwareSourceCode/sourceOrganization yok; dateCreated = start; sameAs yalnız live', () => {
    const graph = graphOf({ key: 'project', param: 'cift-dilli' }, 'en');
    const s = JSON.stringify(graph);
    expect(s).not.toMatch(/"Article"|SoftwareSourceCode|sourceOrganization/);
    const work = graph.find((n) => n['@id'] === ids.work('cift-dilli'))!;
    expect(work['@type']).toBe('CreativeWork');
    expect(work.dateCreated).toBe('2024-03');
    expect(work.sameAs).toEqual(['https://apps.apple.com/app/id1']);
    expect(ids.work('cift-dilli')).toBe('https://www.orcunsaatci.com/projeler/cift-dilli#work');
    const page = graph.find((n) => n['@type'] === 'WebPage')!;
    expect(page).toMatchObject({
      datePublished: '2025-01-01T00:00:00+03:00',
      dateModified: '2025-06-01T00:00:00+03:00',
    });
  });

  it('researcher personası → ScholarlyArticle; bilinmeyen proje/alan ve lab → null', () => {
    F.site.persona = 'researcher';
    const graph = graphOf({ key: 'project', param: 'ikinci' }, 'tr');
    expect(graph.find((n) => n['@id'] === ids.work('ikinci'))?.['@type']).toBe('ScholarlyArticle');
    expect(jsonLdFor({ key: 'project', param: 'yalniz-tr' }, 'en')).toBeNull();
    expect(jsonLdFor({ key: 'area', param: 'yok' }, 'tr')).toBeNull();
    expect(jsonLdFor({ key: 'lab' }, 'tr')).toBeNull();
  });
});

describe('sayfa türleri (§11.6.2)', () => {
  it('about ProfilePage; projects CollectionPage + ItemList (noindex hariç); contact ContactPage + ContactPoint', () => {
    expect(graphOf({ key: 'about' }, 'tr').some((n) => n['@type'] === 'ProfilePage')).toBe(true);
    const projects = graphOf({ key: 'projects' }, 'tr');
    const list = projects.find((n) => n['@type'] === 'ItemList') as {
      numberOfItems: number;
      itemListElement: { url: string }[];
    };
    expect(list.numberOfItems).toBe(3);
    expect(list.itemListElement.map((x) => x.url)).not.toContain(
      'https://www.orcunsaatci.com/projeler/gizli',
    );
    const contact = graphOf({ key: 'contact' }, 'en');
    expect(contact.some((n) => n['@type'] === 'ContactPage')).toBe(true);
    expect(contact.find((n) => n['@type'] === 'Person')).toMatchObject({
      email: 'iletisim@orcunsaatci.com',
      contactPoint: { '@type': 'ContactPoint', availableLanguage: ['Turkish', 'English'] },
    });
  });

  it('cv: Person hasOccupation, hasCredential, award; alumniOf ve worksFor', () => {
    const person = graphOf({ key: 'cv' }, 'en').find((n) => n['@type'] === 'Person')!;
    expect(person).toMatchObject({
      jobTitle: 'Computer Engineer',
      hasOccupation: { '@type': 'Occupation', name: 'Computer Engineer', skills: ['Kotlin'] },
      award: ['Award — Jüri, 2025'],
      worksFor: { '@type': 'Organization', name: 'Acme' },
      alumniOf: [{ '@type': 'EducationalOrganization', name: 'Test Üniversitesi' }],
      sameAs: ['https://www.linkedin.com/in/test', 'https://github.com/test'],
      image: { '@id': ids.portrait, width: { value: 1200, unitCode: 'E37' } },
    });
    expect((person.hasCredential as unknown[]).length).toBe(1);
  });

  it('home: portre varsa primaryImageOfPage; yoksa yok ve kişi düğümü sade', () => {
    const page = () => graphOf({ key: 'home' }, 'tr').find((n) => n['@type'] === 'WebPage')!;
    expect(page().primaryImageOfPage).toEqual({ '@id': ids.portrait });
    F.person.headshot = undefined;
    F.cvEducation.items = [];
    F.contact.social = [];
    expect(page().primaryImageOfPage).toBeUndefined();
    const person = graphOf({ key: 'cv' }, 'tr').find((n) => n['@type'] === 'Person')!;
    expect(person.image).toBeUndefined();
    expect(person.alumniOf).toBeUndefined();
    expect(person.sameAs).toBeUndefined();
  });

  it('expertise: sayfası olan alan terimi url taşır', () => {
    const list = graphOf({ key: 'expertise' }, 'en').find((n) => n['@type'] === 'ItemList') as {
      itemListElement: { item: { '@id': string; url?: string } }[];
    };
    const urls = list.itemListElement.map((x) => x.item.url);
    expect(urls).toEqual(['https://www.orcunsaatci.com/en/expertise/mobil', undefined, undefined]);
    expect(list.itemListElement[0]?.item['@id']).toBe(
      'https://www.orcunsaatci.com/calisma-alanlari#mobil',
    );
  });
});

describe('8: toIsoDateTime', () => {
  it.each([
    ['2025', '2025-01-01T00:00:00+03:00'],
    ['2025-07', '2025-07-01T00:00:00+03:00'],
    ['2025-07-10', '2025-07-10T00:00:00+03:00'],
  ])('%s → %s', (input, out) => expect(toIsoDateTime(input)).toBe(out));
});
