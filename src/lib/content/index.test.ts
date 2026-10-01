// src/lib/content/index.test.ts — içerik erişimcileri (§7.3.6, §7.4.3, §3.4.2). Veri: tests/fixtures/content.ts.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as F from '../../../tests/fixtures/content';
import {
  availableLocales,
  entryYears,
  getAdjacentProjects,
  getAreaBody,
  getAreaMode,
  getAreaPage,
  getAreaPageIds,
  getAreas,
  getCareerStartYear,
  getContact,
  getCv,
  getCvFile,
  getCvSummary,
  getHome,
  getHomeJourney,
  getPageBody,
  getProject,
  getProjects,
  getProjectSlugs,
  getRelatedProjects,
  getStageData,
  getTestimonials,
  getWorksFor,
  isLocaleEnabled,
  pageDates,
  pageLocales,
  projectYears,
  t,
  termLang,
  tList,
} from './index';

vi.mock('content-collections', () => import('../../../tests/fixtures/content'));

const BUILD_YEAR = new Date().getFullYear();

afterEach(() => F.resetFixture());

describe('t / tList (§7.4.4 kural 1)', () => {
  it('EN yoksa TR metni fallback işaretiyle döner', () => {
    expect(t({ tr: 'Merhaba' }, 'en')).toEqual({ text: 'Merhaba', lang: 'tr', fallback: true });
    expect(t({ tr: 'Merhaba', en: 'Hello' }, 'en')).toEqual({
      text: 'Hello',
      lang: 'en',
      fallback: false,
    });
    expect(t({ tr: 'Merhaba', en: 'Hello' }, 'tr')).toEqual({
      text: 'Merhaba',
      lang: 'tr',
      fallback: false,
    });
    expect(t(undefined, 'en')).toEqual({ text: '', lang: 'en', fallback: false });
  });

  it('liste alanları aynı kuralla', () => {
    expect(tList({ tr: ['a'] }, 'en')).toEqual({ items: ['a'], lang: 'tr', fallback: true });
    expect(tList({ tr: ['a'], en: ['b'] }, 'en')).toEqual({
      items: ['b'],
      lang: 'en',
      fallback: false,
    });
    expect(tList({ tr: ['a'], en: ['b'] }, 'tr')).toEqual({
      items: ['a'],
      lang: 'tr',
      fallback: false,
    });
    expect(tList(undefined, 'tr')).toEqual({ items: [], lang: 'tr', fallback: false });
  });

  it('termLang: TR ve EN aynıysa TR sayfada terim İngilizcedir (§3.8)', () => {
    const title = { tr: 'Mobile Developer | Flutter', en: 'Mobile Developer | Flutter' };
    expect(termLang(title, 'tr')).toBe('en');
    expect(termLang(title, 'en')).toBeUndefined();
    expect(termLang({ tr: 'Mobil Geliştirici', en: 'Mobile Developer' }, 'tr')).toBeUndefined();
    expect(termLang({ tr: 'Mobil Geliştirici' }, 'tr')).toBeUndefined();
  });
});

describe('availableLocales (§7.4.3 tablosu)', () => {
  it.each(['home', 'cv', 'projects', 'expertise', 'contact'] as const)(
    '%s: EN açıkken iki dil',
    (key) => {
      expect(availableLocales(key)).toEqual(['tr', 'en']);
    },
  );

  it('about / privacy: EN gövdesi yoksa yalnız TR', () => {
    expect(availableLocales('about')).toEqual(['tr', 'en']);
    F.allPageBodies.splice(
      F.allPageBodies.findIndex((b) => b.key === 'about' && b.locale === 'en'),
      1,
    );
    expect(availableLocales('about')).toEqual(['tr']);
    F.allPageBodies.forEach((b) => {
      if (b.key === 'privacy' && b.locale === 'en') b.draft = true;
    });
    expect(availableLocales('privacy')).toEqual(['tr']);
  });

  it('project: title.en ve summary.en birlikte yoksa ["tr"]; bilinmeyen slug []', () => {
    expect(availableLocales('project', 'cift-dilli')).toEqual(['tr', 'en']);
    expect(availableLocales('project', 'yalniz-tr')).toEqual(['tr']);
    expect(availableLocales('project', 'yok')).toEqual([]);
  });

  it('area: sayfa ve dil durumları; areaPages kapalıyken []', () => {
    expect(availableLocales('area', 'mobil')).toEqual(['tr', 'en']);
    expect(availableLocales('area', 'arastirma')).toEqual(['tr']);
    expect(availableLocales('area', 'web')).toEqual([]);
    expect(availableLocales('area', 'yok')).toEqual([]);
    F.site.features.areaPages = false;
    expect(availableLocales('area', 'mobil')).toEqual([]);
  });

  it('lab yalnız bayrakla ve yalnız TR', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_LAB', '');
    expect(availableLocales('lab')).toEqual([]);
    vi.stubEnv('NEXT_PUBLIC_ENABLE_LAB', '1');
    expect(availableLocales('lab')).toEqual(['tr']);
  });

  it('site.locales: ["tr"] → her sayfa yalnız TR, EN kapalı', () => {
    F.site.locales = ['tr'];
    expect(isLocaleEnabled('en')).toBe(false);
    expect(availableLocales('home')).toEqual(['tr']);
    expect(availableLocales('project', 'cift-dilli')).toEqual(['tr']);
    expect(pageLocales({ key: 'area', param: 'mobil' })).toEqual(['tr']);
    expect(getProjects('en')).toEqual([]);
    expect(getProject('cift-dilli', 'en')).toBeUndefined();
    expect(getCvFile('en')).toBeNull();
  });
});

describe('projeler (§7.8.1, §7.8.6)', () => {
  it('liste sırası: featured ↓, order ↑; EN listesinde yalnız EN sayfası olanlar', () => {
    expect(getProjectSlugs('tr')).toEqual(['cift-dilli', 'yalniz-tr', 'ikinci', 'gizli']);
    expect(getProjectSlugs('en')).toEqual(['cift-dilli', 'ikinci', 'gizli']);
    expect(getProjects('tr', { featured: true }).map((p) => p.slug)).toEqual([
      'cift-dilli',
      'yalniz-tr',
      'ikinci',
    ]);
    expect(getProjects('tr', { area: 'web' }).map((p) => p.slug)).toEqual(['yalniz-tr', 'gizli']);
  });

  it('getProject dile göre', () => {
    expect(getProject('yalniz-tr', 'tr')?.slug).toBe('yalniz-tr');
    expect(getProject('yalniz-tr', 'en')).toBeUndefined();
  });

  it('dairesel önceki/sonraki; tek projede undefined', () => {
    expect(getAdjacentProjects('cift-dilli', 'tr')).toMatchObject({
      prev: { slug: 'gizli' },
      next: { slug: 'yalniz-tr' },
    });
    expect(getAdjacentProjects('gizli', 'en')?.next.slug).toBe('cift-dilli');
    expect(getAdjacentProjects('yok', 'tr')).toBeUndefined();
    F.allProjects.splice(1);
    expect(getAdjacentProjects('cift-dilli', 'tr')).toBeUndefined();
  });

  it('benzer projeler: aynı birincil alan, kendisi ve sonraki hariç', () => {
    expect(getRelatedProjects('cift-dilli', 'tr').map((p) => p.slug)).toEqual(['ikinci']);
    expect(getRelatedProjects('ikinci', 'en').map((p) => p.slug)).toEqual(['cift-dilli']); // sonraki (gizli) hariç
    expect(getRelatedProjects('yok', 'tr')).toEqual([]);
  });

  it('yıl aralıkları (bandOf girdisi)', () => {
    expect(projectYears({ start: '2022-01', year: 2023 })).toEqual({ start: 2022, end: 2023 });
    expect(entryYears({ period: { start: '2019-05', end: '2022-12' } })).toEqual({
      start: 2019,
      end: 2022,
    });
    expect(entryYears({ period: { start: '2023-01' } })).toEqual({ start: 2023, end: BUILD_YEAR });
  });
});

describe('alanlar', () => {
  it('order sırası, kadran modu ve sayfa kimlikleri', () => {
    expect(getAreas().map((a) => a.id)).toEqual(['mobil', 'web', 'arastirma']);
    expect(getAreaMode()).toBe('dial');
    expect(getAreaPageIds('tr')).toEqual(['mobil', 'arastirma']);
    expect(getAreaPageIds('en')).toEqual(['mobil']);
    expect(getAreaPage('mobil', 'en')?.id).toBe('mobil');
    expect(getAreaPage('arastirma', 'en')).toBeUndefined();
    expect(getAreaBody('mobil', 'en')?.locale).toBe('en');
    F.allAreas.splice(2);
    expect(getAreaMode()).toBe('list');
  });
});

describe('kişi, CV ve referanslar', () => {
  it('kariyer başlangıcı: alan ya da en eski deneyim; ikisi de yoksa hata', () => {
    expect(getCareerStartYear()).toBe(2014);
    F.person.careerStartYear = undefined;
    expect(getCareerStartYear()).toBe(2014);
    F.cvExperience.items = [];
    expect(() => getCareerStartYear()).toThrow(/C07/);
  });

  it('worksFor: web’de görünen süren deneyim', () => {
    expect(getWorksFor()?.id).toBe('guncel');
    F.cvExperience.items = F.cvExperience.items.filter((e) => e.id !== 'guncel');
    expect(getWorksFor()).toBeUndefined();
  });

  it('getCv web seçimini ve güncelleme tarihini verir', () => {
    const cv = getCv('tr');
    expect(cv.updatedAt).toBe('2026-09');
    const exp = cv.sections.find((s) => s.key === 'experience');
    expect(exp?.entries.map((e) => (e as { id: string }).id)).toEqual(['guncel', 'eski']);
    expect(cv.sections.some((s) => s.key === 'projects')).toBe(false);
  });

  it('ana sayfa journey ve referanslar (bayrakla)', () => {
    const j = getHomeJourney('tr');
    expect(j.experience.map((e) => e.id)).toEqual(['guncel', 'eski']);
    expect(j.awardsTalks.map((x) => x.kind)).toEqual(['award', 'publication']);
    expect(getTestimonials('tr').map((x) => x.id)).toEqual(['referans']);
    expect(getTestimonials('tr', { featured: false })).toEqual([]);
    F.site.features.testimonials = false;
    expect(getTestimonials('tr')).toEqual([]);
  });

  it('CV özeti (JSON-LD): öne çıkan yetkinlikler, görünür sertifikalar ve ödüller', () => {
    expect(getCvSummary('en')).toEqual({
      skills: ['Kotlin'],
      credentials: [{ name: 'Certificate', issuer: 'Google', url: 'https://example.com/cert' }],
      awards: ['Award — Jüri, 2025'],
    });
  });

  it('getPageBody taslağı atlar; getHome/getContact fixture’ı döndürür', () => {
    expect(getPageBody('about', 'tr')?.updatedAt).toBe('2026-08');
    F.allPageBodies.forEach((b) => (b.draft = true));
    expect(getPageBody('about', 'tr')).toBeUndefined();
    expect(getHome().areas.statement.tr).toBe('Alanlar cümlesi.');
    expect(getContact().email).toBe('iletisim@orcunsaatci.com');
  });
});

describe('pageDates (§3.4.2; new Date() yok)', () => {
  it('proje, cv ve about kaynakları', () => {
    expect(pageDates({ key: 'project', param: 'cift-dilli' })).toEqual({
      published: '2025-01',
      modified: '2025-06',
    });
    expect(pageDates({ key: 'project', param: 'ikinci' })).toEqual({
      published: '2025-01',
      modified: '2025-01',
    });
    expect(pageDates({ key: 'project', param: 'yok' })).toEqual({});
    expect(pageDates({ key: 'cv' })).toEqual({ modified: '2026-09' });
    expect(pageDates({ key: 'about' })).toEqual({ modified: '2026-08' });
    expect(pageDates({ key: 'home' })).toEqual({});
    F.allPageBodies.forEach((b) => (b.updatedAt = undefined));
    expect(pageDates({ key: 'about' })).toEqual({});
  });
});

describe('getCvFile (§7.6.6)', () => {
  it('build-cv çıktısından bayt ve sayfa sayısı; dosya yoksa null', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cvfile-'));
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
    expect(getCvFile('tr')).toBeNull();
    mkdirSync(path.join(root, 'public/files'), { recursive: true });
    const pdf =
      '%PDF-1.4\n1 0 obj << /Type /Pages >>\n2 0 obj << /Type /Page >>\n3 0 obj << /Type /Page >>\n';
    writeFileSync(path.join(root, 'public/files/orcun-saatci-cv-tr.pdf'), pdf);
    expect(getCvFile('tr')).toEqual({
      href: '/files/orcun-saatci-cv-tr.pdf',
      bytes: pdf.length,
      pages: 2,
    });
    cwd.mockRestore();
  });
});

describe('getStageData (§5.9.1)', () => {
  it('home: halkalar, dilimler ve öne çıkan projelerin bantları', () => {
    const d = getStageData('home');
    expect(d.rings).toBe(Math.min(Math.max(BUILD_YEAR - 2014 + 1, 4), 24));
    expect(d.sectors).toBe(3);
    expect(d.projects.map((p) => p.slug)).toEqual(['cift-dilli', 'yalniz-tr', 'ikinci']);
    expect(d.projects[0]?.area).toBe(0);
    expect(d.projects[1]?.area).toBe(0); // birincil alan areas[0]
    expect(d.entries).toHaveLength(2);
    expect(getStageData('home', undefined, 'en').projects.map((p) => p.slug)).toEqual([
      'cift-dilli',
      'ikinci',
    ]);
  });

  it('folio: proje + sonraki; slug zorunlu', () => {
    expect(getStageData('folio', 'ikinci').projects.map((p) => p.slug)).toEqual([
      'ikinci',
      'gizli',
    ]);
    expect(() => getStageData('folio')).toThrow(/slug zorunlu/);
    expect(() => getStageData('folio', 'yok')).toThrow(/bilinmeyen proje/);
  });

  it('plan-small, cv-core, about-page, contact-page', () => {
    const plan = getStageData('plan-small', 'web');
    expect(plan.activeArea).toBe(1);
    expect(plan.projects).toHaveLength(4);
    expect(getStageData('plan-small').activeArea).toBeNull();
    expect(getStageData('cv-core').entries).toHaveLength(3); // web'de görünen deneyim + eğitim
    expect(getStageData('about-page')).toMatchObject({ projects: [], entries: [] });
    expect(getStageData('contact-page')).toMatchObject({ projects: [], entries: [] });
  });

  it('liste modunda (N > 6) dilim yok ve alan indeksi null', () => {
    for (let i = 0; i < 4; i++)
      F.allAreas.push({ ...F.allAreas[1]!, id: `ek-${i}`, order: 10 + i });
    const d = getStageData('home');
    expect(d.sectors).toBe(0);
    expect(d.projects.every((p) => p.area === null)).toBe(true);
  });
});
