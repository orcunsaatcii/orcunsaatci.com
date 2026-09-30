// src/app/sitemap.test.ts — §11.4: yalnız indekslenebilir ve var olan sayfa × dil; hreflang çiftleri; içerik tarihleri.
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as F from '../../tests/fixtures/content';
import sitemap from './sitemap';

vi.mock('content-collections', () => import('../../tests/fixtures/content'));

afterEach(() => F.resetFixture());

const S = 'https://www.orcunsaatci.com';
const urls = () => sitemap().map((e) => e.url);

describe('sitemap', () => {
  it('indekslenebilir sayfalar iki dilde; gizlilik ve noindex proje yok', () => {
    const u = urls();
    expect(u).toContain(S); // kök: sondaki "/" yok (Next canonical biçimi)
    expect(u).not.toContain(`${S}/`);
    for (const path of [
      '/en',
      '/hakkimda',
      '/en/about',
      '/cv',
      '/en/cv',
      '/projeler',
      '/calisma-alanlari',
      '/iletisim',
    ])
      expect(u).toContain(`${S}${path}`);
    for (const path of [
      '/gizlilik',
      '/en/privacy',
      '/projeler/gizli',
      '/en/projects/gizli',
      '/lab/stage',
    ])
      expect(u).not.toContain(`${S}${path}`);
  });

  it('çiftli sayfa: tr, en, x-default; tek dilli sayfa hreflang almaz', () => {
    const entries = sitemap();
    const pair = entries.find((e) => e.url === `${S}/en/projects/cift-dilli`);
    expect(pair?.alternates?.languages).toEqual({
      tr: `${S}/projeler/cift-dilli`,
      en: `${S}/en/projects/cift-dilli`,
      'x-default': `${S}/projeler/cift-dilli`,
    });
    const single = entries.find((e) => e.url === `${S}/projeler/yalniz-tr`);
    expect(single?.alternates).toBeUndefined();
    expect(urls()).not.toContain(`${S}/en/projects/yalniz-tr`);
  });

  it('alan sayfaları yalnız var oldukları dilde', () => {
    const u = urls();
    expect(u).toEqual(
      expect.arrayContaining([
        `${S}/calisma-alanlari/mobil`,
        `${S}/en/expertise/mobil`,
        `${S}/calisma-alanlari/arastirma`,
      ]),
    );
    expect(u).not.toContain(`${S}/en/expertise/arastirma`);
    expect(u).not.toContain(`${S}/calisma-alanlari/web`);
  });

  it('lastModified yalnız içerik tarihlerinden', () => {
    const at = (url: string) => sitemap().find((e) => e.url === `${S}${url}`)?.lastModified;
    expect(at('/projeler/cift-dilli')).toBe('2025-06');
    expect(at('/cv')).toBe('2026-09');
    expect(at('/hakkimda')).toBe('2026-08');
    expect(at('/')).toBeUndefined();
  });

  it('site.locales: ["tr"] → /en girdisi ve hreflang yok', () => {
    F.site.locales = ['tr'];
    const entries = sitemap();
    expect(entries.some((e) => e.url.startsWith(`${S}/en`))).toBe(false);
    expect(entries.every((e) => e.alternates === undefined)).toBe(true);
  });
});
