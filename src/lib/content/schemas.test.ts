// @vitest-environment node
// src/lib/content/schemas.test.ts — §7.3.7'deki 12 durum.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as S from './schemas';

const seoPage = { description: { tr: 'Açıklama' } };
const minimalSite = {
  locales: ['tr'],
  title: { tr: 'Orçun Saatçi' },
  description: { tr: 'Açıklama' },
  cv: { updatedAt: '2026-09' },
  seo: {
    pages: {
      home: seoPage,
      about: seoPage,
      cv: seoPage,
      projects: seoPage,
      expertise: seoPage,
      contact: seoPage,
      privacy: seoPage,
    },
  },
};
const image = { src: '/media/projects/ornek/cover.jpg', alt: { tr: 'Kapak' } };
const minimalProject = {
  title: { tr: 'Proje' },
  summary: { tr: 'Özet' },
  start: '2024-03',
  role: { tr: 'Geliştirici' },
  areas: ['alan-1'],
  cover: image,
  publishedAt: '2025-07',
};

/** safeParse hatasının ilk bulgusu */
const firstIssue = (r: { success: boolean; error?: z.ZodError }) => r.error?.issues[0];

describe('§7.3.7 şemalar', () => {
  it('1 · SiteConfig locales: ["en"] reddedilir', () => {
    expect(S.SiteConfig.safeParse({ ...minimalSite, locales: ['en'] }).success).toBe(false);
  });

  it('2 · SiteConfig bilinmeyen anahtar → unrecognized_keys', () => {
    const r = S.SiteConfig.safeParse({ ...minimalSite, ordr: 1 });
    expect(r.success).toBe(false);
    expect(firstIssue(r)?.code).toBe('unrecognized_keys');
  });

  it('3 · asgari SiteConfig varsayılanları', () => {
    const s = S.SiteConfig.parse(minimalSite);
    expect(s.persona).toBe('engineer');
    expect(s.features).toEqual({
      areaPages: false,
      publicationsPage: false,
      contactForm: false,
      testimonials: false,
      portraitOnHome: true,
    });
    expect(s.cv.photo).toEqual({ tr: true, en: false });
    expect(s.crawlers.ai).toBe('allow');
  });

  it('4 · Slug', () => {
    for (const bad of ['çalışma', 'Proje', 'a--b'])
      expect(S.Slug.safeParse(bad).success).toBe(false);
    expect(S.Slug.safeParse('alan-1').success).toBe(true);
  });

  it('5 · PartialDate', () => {
    for (const ok of ['2024', '2024-03', '2024-03-15'])
      expect(S.PartialDate.safeParse(ok).success).toBe(true);
    for (const bad of ['2024-13', '24-03'])
      expect(S.PartialDate.safeParse(bad).success).toBe(false);
  });

  it('6 · DateRange end < start → path ["end"]', () => {
    const r = S.DateRange.safeParse({ start: '2024-03', end: '2023' });
    expect(r.success).toBe(false);
    expect(firstIssue(r)?.path).toEqual(['end']);
  });

  it('7 · ImageRef.src kuralı', () => {
    for (const src of [
      '/media/a/kapak.webp',
      '/media/a/kapak dosyası.jpg',
      '/media/a/Kapak.jpg',
      '/public/media/a/kapak.jpg',
      '/images/kapak.jpg',
    ])
      expect(S.ImageRef.safeParse({ src, alt: { tr: 'x' } }).success, src).toBe(false);
  });

  it('8 · HttpsUrl', () => {
    expect(S.HttpsUrl.safeParse('http://example.com').success).toBe(false);
    expect(S.HttpsUrl.safeParse('https://www.linkedin.com/in/{{X}}').success).toBe(true);
  });

  it('9 · SocialLink network: other ve label yok → ret', () => {
    expect(S.SocialLink.safeParse({ network: 'other', url: 'https://example.com' }).success).toBe(
      false,
    );
  });

  it('10 · Testimonial consent: false → ret', () => {
    const t = {
      id: 'referans-1',
      quote: { tr: 'Alıntı' },
      author: 'Ad Soyad',
      role: { tr: 'Rol' },
      consent: false,
      consentDate: '2026-09',
    };
    expect(S.Testimonial.safeParse(t).success).toBe(false);
  });

  it('11 · Project (D-48): asgari belge, bağlantı türü, sınırlar, tarih ve kaldırılmış alanlar', () => {
    const p = S.Project.parse(minimalProject);
    expect(p).toMatchObject({
      kind: 'client',
      status: 'done',
      featured: false,
      order: 100,
      facts: [],
      links: [],
      gallery: [],
      draft: false,
      seo: { noindex: false },
    });

    const link = (kind: string) => ({ kind, label: { tr: 'L' }, url: 'https://apps.apple.com/x' });
    expect(S.Project.safeParse({ ...minimalProject, links: [link('repo')] }).success).toBe(false);
    expect(
      S.Project.safeParse({
        ...minimalProject,
        links: Array.from({ length: 5 }, () => link('live')),
      }).success,
    ).toBe(false);
    expect(S.Project.safeParse({ ...minimalProject, start: '2024' }).success).toBe(false);

    const range = S.Project.safeParse({ ...minimalProject, start: '2024-03', end: '2023-12' });
    expect(range.success).toBe(false);
    expect(firstIssue(range)?.path).toEqual(['end']);

    for (const removed of [{ client: 'X' }, { metrics: [] }, { tldr: { tr: 'x' } }]) {
      const r = S.Project.safeParse({ ...minimalProject, ...removed });
      expect(r.success).toBe(false);
      expect(firstIssue(r)?.code).toBe('unrecognized_keys');
    }
  });

  it('12 · üst düzey şemaların JSON Schema çıktısı katıdır', () => {
    const topLevel = {
      site: S.SiteConfig,
      person: S.Person,
      contact: S.Contact,
      home: S.HomePage,
      area: S.Area,
      project: S.Project,
      experience: S.Items(S.Experience),
      education: S.Items(S.Education),
      certifications: S.Items(S.Certification),
      awards: S.Items(S.Award),
      publications: S.Items(S.Publication),
      skills: S.Items(S.Skill),
      languages: S.Items(S.Language),
      testimonials: S.Items(S.Testimonial),
    };
    for (const [name, schema] of Object.entries(topLevel)) {
      const json = z.toJSONSchema(schema, { io: 'input' }) as { additionalProperties?: unknown };
      expect(json.additionalProperties, name).toBe(false);
    }
  });
});
