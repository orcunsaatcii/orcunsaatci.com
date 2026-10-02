// tests/e2e/seo.spec.ts — §11.8.1: sitemap'teki her URL için metadata, canonical, hreflang, OG ve JSON-LD;
// noindex sayfalar, 404'ler, /files, robots.txt ve sitemap.xml. Sayfa listesi /sitemap.xml'den okunur.
import { matchRoute } from '../../src/i18n/config';
import { expect, test } from './fixtures';
import { localPath, NOINDEX_PATHS, sitemapEntries } from './helpers/urls';

const SITE = 'https://www.orcunsaatci.com';

type LdNode = Record<string, unknown>;

/** Sayfa anahtarı → grafikte bulunması gereken tipler (§11.6.2, §11.9) */
const PAGE_TYPES: Partial<Record<string, string[]>> = {
  about: ['ProfilePage', 'Person', 'BreadcrumbList'],
  projects: ['CollectionPage', 'ItemList', 'BreadcrumbList'],
  project: ['WebPage', 'CreativeWork', 'BreadcrumbList'],
  contact: ['ContactPage', 'BreadcrumbList'],
  cv: ['WebPage', 'Person', 'BreadcrumbList'],
};
/** Hiçbir grafikte bulunmaz: ticari tipler (§11.6.4 #5) ve D-48 proje yasakları */
const FORBIDDEN_TYPES = [
  'Offer',
  'Service',
  'AggregateRating',
  'Review',
  'SearchAction',
  'Article',
  'SoftwareSourceCode',
];

interface LdWalk {
  /** yalnız @id taşıyan nesneler ({ "@id": X } başvuruları) */
  refs: string[];
  /** @id'li düğümler (üst düzey ya da satır içi) */
  defs: string[];
  types: string[];
  keys: string[];
}

function walkLd(node: unknown, w: LdWalk): LdWalk {
  if (Array.isArray(node)) node.forEach((n) => walkLd(n, w));
  if (!node || typeof node !== 'object' || Array.isArray(node)) return w;
  const obj = node as LdNode;
  const own = Object.keys(obj);
  if (typeof obj['@id'] === 'string') (own.length === 1 ? w.refs : w.defs).push(obj['@id']);
  if (typeof obj['@type'] === 'string') w.types.push(obj['@type']);
  w.keys.push(...own);
  for (const v of Object.values(obj)) walkLd(v, w);
  return w;
}

/** PNG IHDR'den genişlik × yükseklik */
const pngSize = (buf: Buffer) => `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;

test.describe('§11.9 SEO', { tag: ['@desktop-chromium', '@no-js'] }, () => {
  test('sitemap’teki her URL: başlık, açıklama, canonical, hreflang, OG, JSON-LD', async ({
    page,
    request,
  }) => {
    const entries = await sitemapEntries(request);
    expect(entries.length).toBeGreaterThan(10);
    const images = new Set<string>();
    for (const entry of entries) {
      await test.step(entry.path, async () => {
        const res = await page.goto(entry.path);
        expect.soft(res?.status(), 'status').toBe(200);
        const lang = entry.path === '/en' || entry.path.startsWith('/en/') ? 'en' : 'tr';
        await expect.soft(page.locator('html')).toHaveAttribute('lang', lang);
        const head = await page.evaluate(() => {
          const attr = (sel: string, a = 'content') =>
            document.head.querySelector(sel)?.getAttribute(a) ?? null;
          return {
            titles: [...document.querySelectorAll('title')].map((t) => t.textContent ?? ''),
            description: attr('meta[name="description"]'),
            canonical: attr('link[rel="canonical"]', 'href'),
            robots: attr('meta[name="robots"]'),
            hreflang: Object.fromEntries(
              [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [
                l.getAttribute('hreflang'),
                l.getAttribute('href'),
              ]),
            ),
            og: Object.fromEntries(
              [...document.head.querySelectorAll('meta[property^="og:"]')].map((m) => [
                m.getAttribute('property'),
                m.getAttribute('content'),
              ]),
            ),
            ogAlternate: [
              ...document.head.querySelectorAll('meta[property="og:locale:alternate"]'),
            ].map((m) => m.getAttribute('content')),
            ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
              (s) => s.textContent ?? '',
            ),
          };
        });
        // 2–3
        expect.soft(head.titles, 'tek <title>').toHaveLength(1);
        expect.soft(head.titles[0]?.length ?? 0, 'title ≤ 60').toBeLessThanOrEqual(60);
        expect.soft(head.description?.length ?? 0, 'description 1–160').toBeGreaterThan(0);
        expect.soft(head.description?.length ?? 999, 'description ≤ 160').toBeLessThanOrEqual(160);
        if ((head.description?.length ?? 0) < 120)
          test
            .info()
            .annotations.push({ type: 'warning', description: `${entry.path}: description < 120` });
        // 4–5
        expect.soft(head.canonical, 'canonical').toBe(entry.loc);
        expect.soft(head.robots ?? '', 'robots').not.toContain('noindex');
        expect.soft(head.hreflang, 'hreflang = sitemap').toEqual(entry.alternates);
        if (Object.keys(entry.alternates).length > 0) {
          expect
            .soft(Object.keys(entry.alternates).sort(), 'hreflang tr, en, x-default')
            .toEqual(['en', 'tr', 'x-default']);
          expect.soft(entry.alternates['x-default'], 'x-default → TR').toBe(entry.alternates.tr);
        } else expect.soft(head.ogAlternate, 'tek dilli: og:locale:alternate yok').toEqual([]);
        // 6
        expect.soft(head.og['og:url'], 'og:url').toBe(entry.loc);
        for (const key of ['og:title', 'og:description', 'og:locale', 'og:image'])
          expect.soft(head.og[key], key).toBeTruthy();
        expect.soft(head.og['og:image:width'], 'og:image:width').toBe('1200');
        expect.soft(head.og['og:image:height'], 'og:image:height').toBe('630');
        if (head.og['og:image']) images.add(head.og['og:image']);
        // 7
        expect.soft(head.ld, 'tek ld+json').toHaveLength(1);
        const graph = (JSON.parse(head.ld[0] ?? '{}') as { '@graph'?: Record<string, unknown>[] })[
          '@graph'
        ];
        const ids = (graph ?? []).map((n) => n['@id']);
        expect.soft(ids, '#person').toContain(`${SITE}/#person`);
        expect.soft(ids, '#website').toContain(`${SITE}/#website`);
        const pageNode = (graph ?? []).find((n) => typeof n.inLanguage === 'string');
        expect.soft(pageNode?.inLanguage, 'inLanguage').toBe(lang);
        // gerçek içerikle (birim testleri fixture'la koşar, §11.6.4): @id başvuruları grafikte çözülür, sayfa tipleri
        // §11.6.2'deki gibidir, yasak tipler ve sourceOrganization yoktur
        const { refs, defs, types, keys } = walkLd(graph ?? [], {
          refs: [],
          defs: [],
          types: [],
          keys: [],
        });
        const unresolved = refs.filter((r) => !defs.includes(r));
        expect.soft(unresolved, '@id başvuruları çözülür').toEqual([]);
        const key = matchRoute(entry.path)?.ref.key ?? '?';
        for (const t of PAGE_TYPES[key] ?? []) expect.soft(types, `${key}: ${t}`).toContain(t);
        expect
          .soft(
            types.filter((t) => FORBIDDEN_TYPES.includes(t)),
            'yasak tipler',
          )
          .toEqual([]);
        expect.soft(keys, 'sourceOrganization yok (D-48)').not.toContain('sourceOrganization');
      });
    }
    for (const url of images) {
      await test.step(`og:image ${localPath(url)}`, async () => {
        const res = await request.get(localPath(url));
        expect.soft(res.status()).toBe(200);
        expect.soft(res.headers()['content-type']).toBe('image/png');
        const body = await res.body();
        expect.soft(body.length).toBeLessThanOrEqual(5 * 1024 * 1024);
        expect.soft(pngSize(body), '1200×630').toBe('1200x630');
      });
    }
  });

  test('gizlilik: noindex, follow; canonical ve hreflang yok; sitemap’te yok', async ({
    page,
    request,
  }) => {
    const inSitemap = (await sitemapEntries(request)).map((e) => e.path);
    for (const path of NOINDEX_PATHS) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, follow',
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
      expect(inSitemap).not.toContain(path);
    }
  });

  test('/files, robots.txt, sitemap.xml', async ({ request }) => {
    const pdf = await request.get('/files/orcun-saatci-cv-tr.pdf');
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['x-robots-tag']).toContain('noindex');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /'); // yerel build: VERCEL_ENV yok (D-28)
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()['content-type']).toContain('xml');
    expect(await sitemap.text()).toContain('xmlns:xhtml');
  });
});
