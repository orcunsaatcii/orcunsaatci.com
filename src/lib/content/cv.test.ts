// src/lib/content/cv.test.ts — CV seçimi, sıralama ve JSON Resume eşlemesi (§7.6.1, §7.6.5). Saf; fixture doğrudan verilir.
import jsonResume from '@jsonresume/schema';
import { afterEach, describe, expect, it } from 'vitest';
import * as F from '../../../tests/fixtures/content';
import {
  byDateDesc,
  byPeriod,
  completeDate,
  cvDictionary,
  groupSkills,
  isVisible,
  pick,
  selectCv,
  selectHomeJourney,
  sortLanguages,
  sortProjects,
  toJsonResume,
  type CvSource,
} from './cv';

const src = (): CvSource => ({ ...F, projects: F.allProjects });
const keys = (locale: 'tr' | 'en', target: 'web' | 'pdf') =>
  selectCv(src(), locale, target).map((s) => s.key);
const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);

afterEach(() => F.resetFixture());

describe('görünürlük ve tarihler', () => {
  it('görünürlük matrisi', () => {
    expect(isVisible('web-and-pdf', 'web')).toBe(true);
    expect(isVisible('web-only', 'web')).toBe(true);
    expect(isVisible('web-only', 'pdf')).toBe(false);
    expect(isVisible('pdf-only', 'pdf')).toBe(true);
    expect(isVisible('pdf-only', 'web')).toBe(false);
    expect(isVisible('hidden', 'pdf')).toBe(false);
  });

  it('kısmi tarih tamamlama ve sıralayıcılar', () => {
    expect(completeDate('2024', 'start')).toBe('2024-01-01');
    expect(completeDate('2024', 'end')).toBe('2024-12-31');
    expect(completeDate('2024-03', 'end')).toBe('2024-03-31');
    expect(completeDate('2024-03-15', 'start')).toBe('2024-03-15');
    const a = { period: { start: '2020' } };
    const b = { period: { start: '2018', end: '2021' } };
    const c = { period: { start: '2019', end: '2021' } };
    expect([b, c, a].sort(byPeriod)).toEqual([a, c, b]);
    expect([{ date: '2020' }, { date: '2024-02' }].sort(byDateDesc)).toEqual([
      { date: '2024-02' },
      { date: '2020' },
    ]);
  });

  it('pick: EN yoksa TR; tanımsız → boş', () => {
    expect(pick({ tr: 'a' }, 'en')).toBe('a');
    expect(pick({ tr: 'a', en: 'b' }, 'en')).toBe('b');
    expect(pick(undefined, 'tr')).toBe('');
  });
});

describe('selectCv (§7.6.1)', () => {
  it('bölüm sırası; web’de projeler yok, PDF’te var; boş bölümler çıkarılır', () => {
    expect(keys('tr', 'web')).toEqual([
      'profile',
      'experience',
      'skills',
      'education',
      'certifications',
      'awards',
      'publications',
      'languages',
    ]);
    expect(keys('tr', 'pdf')).toContain('projects');
    F.cvAwards.items = [];
    expect(keys('tr', 'web')).not.toContain('awards');
  });

  it('pdf-only yalnız PDF’te, web-only yalnız web’de', () => {
    const exp = (target: 'web' | 'pdf') => {
      const s = selectCv(src(), 'tr', target).find((x) => x.key === 'experience');
      return s?.key === 'experience' ? ids(s.entries) : [];
    };
    expect(exp('web')).toEqual(['guncel', 'eski']);
    expect(exp('pdf')).toEqual(['guncel', 'pdf']);
  });

  it('PDF projeleri: öne çıkan, dile göre, en çok 5', () => {
    const projects = (locale: 'tr' | 'en') => {
      const s = selectCv(src(), locale, 'pdf').find((x) => x.key === 'projects');
      return s?.key === 'projects' ? s.entries.map((p) => p.slug) : [];
    };
    expect(projects('tr')).toEqual(['cift-dilli', 'yalniz-tr', 'ikinci']);
    expect(projects('en')).toEqual(['cift-dilli', 'ikinci']);
  });

  it('publicationsPage açıkken yayınlar profilden hemen sonra; profil özeti site.cv.summary ?? shortBio', () => {
    F.site.features.publicationsPage = true;
    expect(keys('tr', 'web').slice(0, 3)).toEqual(['profile', 'publications', 'experience']);
    const profile = () => selectCv(src(), 'tr', 'web')[0];
    expect(profile()).toMatchObject({
      key: 'profile',
      anchor: 'profil',
      entries: [{ tr: 'Kısa biyografi.' }],
    });
    F.site.cv.summary = { tr: 'CV özeti.' };
    expect(profile()?.entries[0]).toEqual({ tr: 'CV özeti.' });
    expect(selectCv(src(), 'en', 'web')[0]?.anchor).toBe('profile');
  });
});

describe('gruplama ve sıralama', () => {
  it('yetkinlikler kategori sırasıyla, grup içinde featured önce', () => {
    const groups = groupSkills(F.cvSkills.items, 'tr');
    expect(groups.map((g) => g.category)).toEqual(['core', 'tool']);
    expect(ids(groups[0]!.skills)).toEqual(['kotlin', 'swift']);
    expect(groupSkills(F.cvSkills.items, 'en')[0]?.skills[0]?.id).toBe('kotlin');
  });

  it('diller: native önce, sonra seviye azalan', () => {
    expect(sortLanguages(F.cvLanguages.items).map((l) => l.code)).toEqual(['tr', 'en']);
  });

  it('projeler: featured ↓, order ↑, year ↓, start ↓, başlık', () => {
    const base = F.allProjects[2]!;
    const mk = (slug: string, o: Partial<typeof base>) => ({ ...base, slug, ...o });
    const sorted = sortProjects(
      [
        mk('d', { featured: false }),
        mk('c', { order: 5, year: 2020 }),
        mk('b', { order: 5, year: 2022 }),
        mk('a2', { order: 5, year: 2022, start: '2022-06', title: { tr: 'Zeta' } }),
        mk('a1', { order: 5, year: 2022, start: '2022-06', title: { tr: 'Alfa' } }),
      ],
      'tr',
    );
    expect(sorted.map((p) => p.slug)).toEqual(['a1', 'a2', 'b', 'c', 'd']);
  });
});

describe('selectHomeJourney (§7.6.1)', () => {
  it('deneyim ≤ 6, eğitim ≤ 2, ödül/konuşma ≤ 3 (featured önce), diller', () => {
    for (let i = 0; i < 8; i++) {
      F.cvExperience.items.push({
        ...F.cvExperience.items[1]!,
        id: `ek-${i}`,
        period: { start: `201${i}`, end: `201${i}` },
      });
    }
    F.cvPublications.items.push(
      { ...F.cvPublications.items[0]!, id: 'atolye', type: 'workshop', date: '2026-01' },
      { ...F.cvPublications.items[1]!, id: 'one-cikan', featured: true, date: '2020' },
    );
    const j = selectHomeJourney(src());
    expect(j.experience).toHaveLength(6);
    expect(j.experience[0]?.id).toBe('guncel');
    expect(j.education).toHaveLength(1);
    expect(j.awardsTalks.map((x) => x.item.id)).toEqual(['odul', 'one-cikan', 'atolye']);
    expect(j.languages.map((l) => l.code)).toEqual(['tr', 'en']);
  });
});

describe('toJsonResume (§7.6.5)', () => {
  const validate = (json: unknown) =>
    new Promise<unknown>((ok) => jsonResume.validate(json, (err) => ok(err)));

  it.each(['tr', 'en'] as const)('%s: @jsonresume/schema ile geçerli', async (locale) => {
    const resume = toJsonResume(src(), locale, 'https://www.orcunsaatci.com');
    expect(await validate(resume)).toBeFalsy();
  });

  it('eşleme: PDF seçimi, gönüllü ayrımı, konuşmalar projelerde, alan başlıkları anahtar kelime', () => {
    F.cvExperience.items[0]!.employmentType = 'volunteer';
    const r = toJsonResume(src(), 'en', 'https://www.orcunsaatci.com') as Record<string, never[]>;
    const basics = r.basics as unknown as Record<string, unknown>;
    expect(basics).toMatchObject({
      name: 'Orçun Saatçi',
      label: 'Computer Engineer',
      url: 'https://www.orcunsaatci.com/en',
      image: 'https://www.orcunsaatci.com/media/test/headshot.jpg',
      location: { city: 'Istanbul', countryCode: 'TR' },
    });
    expect((basics.profiles as { network: string }[]).map((p) => p.network)).toEqual([
      'LinkedIn',
      'GitHub',
      'X',
    ]);
    expect(r.volunteer).toHaveLength(1);
    expect((r.work as { name: string }[]).map((w) => w.name)).toEqual(['Gamma']); // web-only 'eski' PDF'te yok
    expect((r.publications as { name: string }[]).map((p) => p.name)).toEqual(['Article']);
    const projects = r.projects as {
      name: string;
      keywords?: string[];
      url?: string;
      type: string;
    }[];
    expect(projects.map((p) => p.name)).toEqual([
      'Bilingual',
      'Title only',
      'Second',
      'Hidden',
      'Talk',
    ]);
    expect(projects[0]).toMatchObject({
      keywords: ['Mobile'],
      url: 'https://www.orcunsaatci.com/en/projects/cift-dilli',
    });
    expect(projects[1]?.url).toBeUndefined(); // EN sayfası yok
    expect(projects[4]?.type).toBe('talk');
    expect(r.certificates).toHaveLength(1); // hidden kayıt yok
    expect(r.languages).toEqual([
      { language: 'Turkish', fluency: 'Native' },
      { language: 'English', fluency: 'C1 Advanced' },
    ]);
  });

  it('boş alanlar atılır; fotoğraf yoksa image yok', () => {
    F.person.headshot = undefined;
    F.cvAwards.items = [];
    const r = toJsonResume(src(), 'tr', 'https://www.orcunsaatci.com');
    expect((r.basics as Record<string, unknown>).image).toBeUndefined();
    expect(r.awards).toBeUndefined();
  });

  it('cvDictionary dile göre sözlük döndürür', () => {
    expect(cvDictionary('tr').cv.title).toBe('Özgeçmiş');
    expect(cvDictionary('en').cv.sections.profile).toBe('Profile');
  });
});
