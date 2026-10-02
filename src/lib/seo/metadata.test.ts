// src/lib/seo/metadata.test.ts — §11.8.1: başlık kurgusu, kırpma, noindex, hreflang, ana sayfa başlığı, sayfa envanteri.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '@/i18n/dictionaries/en';
import * as F from '../../../tests/fixtures/content';
import {
  BRAND,
  buildRootMetadata,
  clampText,
  composeTitle,
  fullTitle,
  homeTitle,
  isPageIndexable,
  listEnPaths,
  listPages,
  pageLink,
  projectMetadata,
  areaMetadata,
  staticPageMetadata,
  TITLE_MAX,
} from './metadata';

vi.mock('content-collections', () => import('../../../tests/fixtures/content'));

const project = (slug: string) => F.allProjects.find((p) => p.slug === slug)!;
const area = (id: string) => F.allAreas.find((a) => a.id === id)!;

afterEach(() => F.resetFixture());

describe('başlık (§11.2.2)', () => {
  it('45 karakterlik sayfa kısmı şablona kalır; 46 → absolute ve ≤ 60', () => {
    expect(BRAND).toBe('Orçun Saatçi');
    const p45 = 'a'.repeat(45);
    const p46 = 'a'.repeat(46);
    expect(composeTitle(p45)).toBe(p45);
    const abs = composeTitle(p46);
    expect(abs).toEqual({ absolute: p46 });
    expect(fullTitle(p45)).toHaveLength(TITLE_MAX);
    const long = composeTitle('kelime '.repeat(12).trim());
    expect(typeof long === 'object' && long.absolute.length <= TITLE_MAX).toBe(true);
    expect(fullTitle('kelime '.repeat(12).trim()).length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it('clampText: sınır içi aynen; aşarsa kelime sınırında ve … ile', () => {
    expect(clampText('  kısa metin ', 20)).toBe('kısa metin');
    const out = clampText('bir iki üç dört beş altı yedi', 16);
    expect(out).toBe('bir iki üç dört…');
    expect(out.length).toBeLessThanOrEqual(16);
    expect(clampText('boşluksuzuzunbirkelime', 10)).toBe('boşluksuz…');
    expect(clampText('virgülle, bitiyor ve devam', 11)).toBe('virgülle…');
  });

  it('ana sayfa: "Ad — Unvan" 60’ı aşarsa yalnız ad', () => {
    expect(homeTitle('en')).toBe('Orçun Saatçi — Computer Engineer');
    F.person.jobTitle.tr = 'Bilgisayar Mühendisi ve Mobil Uygulama Geliştiricisi'; // 52 → 67 karakter
    expect(homeTitle('tr')).toBe(BRAND);
    expect(staticPageMetadata({ key: 'home' }, 'tr').title).toEqual({ absolute: BRAND });
  });
});

describe('sayfa metadata’sı (§11.2.4)', () => {
  it('çiftli sayfa: canonical + 3 hreflang (tr, en, x-default) ve og:locale:alternate', () => {
    const m = staticPageMetadata({ key: 'cv' }, 'en');
    expect(m.alternates).toEqual({
      canonical: 'https://www.orcunsaatci.com/en/cv',
      languages: {
        tr: 'https://www.orcunsaatci.com/cv',
        en: 'https://www.orcunsaatci.com/en/cv',
        'x-default': 'https://www.orcunsaatci.com/cv',
      },
    });
    expect(m.robots).toEqual({ index: true, follow: true });
    expect(m.openGraph).toMatchObject({
      locale: 'en_US',
      alternateLocale: ['tr_TR'],
      url: 'https://www.orcunsaatci.com/en/cv',
    });
    expect(m.description).toBe('CV description.');
    expect(m.title).toBe(en.meta.cv); // şablona kalan sayfa kısmı
  });

  it('tek dilli sayfa: hreflang yok, og:locale:alternate boş', () => {
    const m = projectMetadata(project('yalniz-tr'), 'tr');
    expect(m.alternates).toEqual({ canonical: 'https://www.orcunsaatci.com/projeler/yalniz-tr' });
    expect(m.openGraph?.alternateLocale).toEqual([]);
  });

  it('noindex sayfa: alternates yok, robots.index false (gizlilik, seo.noindex proje)', () => {
    for (const m of [
      staticPageMetadata({ key: 'privacy' }, 'tr'),
      projectMetadata(project('gizli'), 'en'),
    ]) {
      expect(m.alternates).toBeUndefined();
      expect(m.robots).toEqual({ index: false, follow: true });
      expect(m.openGraph?.alternateLocale).toEqual([]);
    }
    expect(isPageIndexable({ key: 'project', param: 'yok' })).toBe(false);
    expect(isPageIndexable({ key: 'area', param: 'yok' })).toBe(false);
  });

  it('EN’de TR yedeği meta’ya girmez: site.description.en kullanılır (§7.4.4 kural 6)', () => {
    F.site.seo.pages.projects.description = { tr: 'Yalnız TR.' };
    expect(staticPageMetadata({ key: 'projects' }, 'en').description).toBe(
      'Site description (EN).',
    );
    const m = projectMetadata(project('yalniz-tr'), 'tr');
    expect(m.description).toBe('Yalnız Türkçe proje.');
  });

  it('about: og profile; proje ve alan başlığı seo.title ile ezilebilir', () => {
    expect(staticPageMetadata({ key: 'about' }, 'tr').openGraph).toMatchObject({
      type: 'profile',
      firstName: 'Orçun',
      lastName: 'Saatçi',
    });
    project('cift-dilli').seo.title = { tr: 'Özel başlık' };
    expect(projectMetadata(project('cift-dilli'), 'tr').title).toBe('Özel başlık');
    const a = areaMetadata(area('mobil'), 'en');
    expect(a.title).toBe('Mobile');
    expect(a.alternates?.canonical).toBe('https://www.orcunsaatci.com/en/expertise/mobil');
  });

  it('kök metadata: metadataBase, şablon, açıklama', () => {
    const m = buildRootMetadata('en');
    expect(String(m.metadataBase)).toBe('https://www.orcunsaatci.com/');
    expect(m.title).toEqual({ default: BRAND, template: `%s — ${BRAND}` });
    expect(m.description).toBe('Home description.');
    expect(m.openGraph).toMatchObject({ locale: 'en_US', siteName: BRAND });
  });
});

describe('sayfa envanteri (§11.4.1)', () => {
  it('listPages: statik sayfalar, projeler, sayfalı alanlar; dil ve tarih bilgisiyle', () => {
    const pages = listPages();
    const keyOf = (p: (typeof pages)[number]) =>
      p.ref.param ? `${p.ref.key}:${p.ref.param}` : p.ref.key;
    expect(pages.map(keyOf)).toEqual([
      'home',
      'about',
      'cv',
      'projects',
      'expertise',
      'contact',
      'privacy',
      'project:cift-dilli',
      'project:yalniz-tr',
      'project:ikinci',
      'project:gizli',
      'area:mobil',
      'area:arastirma',
    ]);
    const byKey = new Map(pages.map((p) => [keyOf(p), p]));
    expect(byKey.get('privacy')?.indexable).toBe(false);
    expect(byKey.get('project:yalniz-tr')?.locales).toEqual(['tr']);
    expect(byKey.get('project:cift-dilli')?.lastModified).toBe('2025-06');
    F.site.features.areaPages = false;
    expect(listPages().some((p) => p.ref.key === 'area')).toBe(false);
  });

  it('listEnPaths ve pageLink: EN’de yoksa TR’ye düşer (" (TR)", hrefLang tr)', () => {
    expect(listEnPaths()).toContain('/en/projects/cift-dilli');
    expect(listEnPaths()).not.toContain('/en/projects/yalniz-tr');
    expect(pageLink({ key: 'project', param: 'yalniz-tr' }, 'en')).toEqual({
      href: '/projeler/yalniz-tr',
      hrefLang: 'tr',
      fallback: true,
    });
    expect(pageLink({ key: 'about' }, 'en')).toEqual({ href: '/en/about', fallback: false });
  });

  it('sayfa tarihleri içerikten gelir: new Date() yok (grep)', () => {
    expect(readFileSync('src/app/sitemap.ts', 'utf8')).not.toMatch(/new Date\(/);
    expect(readFileSync('src/lib/seo/metadata.ts', 'utf8')).not.toMatch(/new Date\(/);
  });
});
