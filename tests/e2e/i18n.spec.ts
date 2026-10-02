// tests/e2e/i18n.spec.ts — §3.10 dil ve route kabul maddeleri. Sayfa listesi ve çiftler /sitemap.xml'den okunur.
// 404 listesi not-found.spec.ts'te, site.locales: ['tr'] build'i M3 PR'ında elle doğrulanır (§15.4.3).
import {
  chapterAnchors,
  chapterIds,
  pathOf,
  staticRouteKeys,
  staticRoutes,
} from '../../src/i18n/config';
import en from '../../src/i18n/dictionaries/en';
import tr from '../../src/i18n/dictionaries/tr';
import { expect, test } from './fixtures';
import { localPath, sitemapEntries } from './helpers/urls';

const PAIRED = staticRouteKeys.filter((key) => staticRoutes[key].en !== null);
const isEn = (path: string) => path === '/en' || path.startsWith('/en/');

/** TR sözlükte, aynı anahtarın EN değerinden farklı olan (çevrilmiş) dize yaprakları. Dil değiştiricinin özadı
 * (lang.switchTo: "English" / "Türkçe") kendi dilindedir ve kapsam dışıdır. */
function translated(trNode: unknown, enNode: unknown, path = ''): string[] {
  if (typeof trNode === 'string')
    return trNode !== enNode &&
      path !== 'lang.switchTo' &&
      trNode.length >= 4 &&
      !/[{}]/.test(trNode)
      ? [trNode]
      : [];
  if (trNode && typeof trNode === 'object')
    return Object.entries(trNode).flatMap(([k, v]) =>
      translated(
        v,
        (enNode as Record<string, unknown> | undefined)?.[k],
        path ? `${path}.${k}` : k,
      ),
    );
  return [];
}

test.describe('§3.10 dil ve route’lar', { tag: ['@desktop-chromium'] }, () => {
  test('route tablosu: her TR ve EN statik URL 200', async ({ request }) => {
    for (const key of PAIRED) {
      for (const locale of ['tr', 'en'] as const) {
        const path = pathOf({ key }, locale)!;
        expect.soft((await request.get(path)).status(), path).toBe(200);
      }
    }
  });

  test('proje dil kuralı: yalnız TR proje EN’de 404, sitemap ve hreflang’de EN yok, dil değiştirici /en’e düşer', async ({
    page,
    request,
  }) => {
    const entries = await sitemapEntries(request);
    const projects = entries.filter((e) => e.path.startsWith('/projeler/'));
    const paired = projects.find((e) => e.alternates.en);
    const single = projects.find((e) => !e.alternates.en);
    expect(paired, 'çift dilli proje').toBeTruthy();
    expect((await request.get(localPath(paired!.alternates.en!))).status()).toBe(200);
    // sahibin içeriğinde yalnız TR proje yoksa kuralın bu yarısı birim testlerindedir (fixture)
    test.skip(!single, 'yalnız TR proje yok: tüm projeler çift dilli');
    const slug = single!.path.split('/').pop();
    expect((await request.get(`/en/projects/${slug}`)).status()).toBe(404);
    expect(entries.map((e) => e.path)).not.toContain(`/en/projects/${slug}`);

    await page.goto(single!.path);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
    const enLink = page
      .locator('[data-language-switcher]:visible')
      .first()
      .getByRole('link', { name: /EN/ });
    await expect(enLink).toHaveAttribute('href', '/en');
    await expect(enLink).toHaveAttribute('data-fallback', 'home');
    const note = await enLink.getAttribute('aria-describedby');
    expect(note).toBeTruthy();
    await expect(page.locator(`[id="${note}"]`)).toHaveCount(1);
  });

  test('dil değiştirici: çifti olan her sayfada karşılığa gider; html[lang] değişir; çerez yok', async ({
    page,
    context,
    request,
  }) => {
    const entries = (await sitemapEntries(request)).filter((e) => e.alternates.en && !isEn(e.path));
    for (const entry of entries) {
      await test.step(entry.path, async () => {
        await page.goto(entry.path);
        const target = localPath(entry.alternates.en!);
        await page
          .locator('[data-language-switcher]:visible')
          .first()
          .getByRole('link', { name: /EN/ })
          .click();
        await expect(page).toHaveURL((url) => url.pathname === target);
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await page
          .locator('[data-language-switcher]:visible')
          .first()
          .getByRole('link', { name: /TR/ })
          .click();
        await expect(page).toHaveURL((url) => url.pathname === entry.path);
        await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
      });
    }
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => document.cookie)).toBe('');
  });

  test('Accept-Language: en ile / → 200, TR içerik, yönlendirme yok', async ({ request }) => {
    const res = await request.get('/', {
      headers: { 'accept-language': 'en-US,en;q=0.9' },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/<html[^>]*lang="tr"/);
  });

  test('ana sayfa: bölümler sırayla, data-chapter ve §3.3 kimlikleri; çapa bağlantısı başlığı header altında açar', async ({
    page,
  }) => {
    for (const locale of ['tr', 'en'] as const) {
      await page.goto(locale === 'tr' ? '/' : '/en');
      const chapters = await page
        .locator('[data-chapter]')
        .evaluateAll((els) =>
          els.map((el) => ({ chapter: el.getAttribute('data-chapter'), id: el.id })),
        );
      const expected = chapterIds.filter((c) => chapters.some((x) => x.chapter === c));
      expect(chapters.map((c) => c.chapter)).toEqual(expected);
      expect(chapters.length).toBeGreaterThanOrEqual(6);
      for (const c of chapters)
        expect.soft(c.id).toBe(chapterAnchors[c.chapter as (typeof chapterIds)[number]][locale]);
    }
    for (const url of ['/#projeler', '/en#work']) {
      await page.goto(url);
      const [headingTop, headerBottom] = await page.evaluate((hash) => {
        const h2 = document.querySelector(`${hash} h2`)!.getBoundingClientRect();
        const header =
          document.querySelector('body > header, [data-site-header]') ??
          document.querySelector('header');
        return [h2.top, header!.getBoundingClientRect().bottom];
      }, new URL(url, 'http://x').hash);
      expect.soft(headingTop, url).toBeGreaterThanOrEqual(headerBottom - 1);
      expect.soft(headingTop, url).toBeLessThan(900 / 2);
    }
  });

  test('header: ana sayfada 5 çapa, diğer sayfalarda 5 derin URL; CTA’lar gerçek URL (SSR dahil)', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const homeLinks = await page
      .locator('body > header nav a')
      .evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    expect(homeLinks).toHaveLength(5);
    expect(homeLinks.every((h) => h?.startsWith('#'))).toBe(true);
    await page.goto('/hakkimda');
    const deepLinks = await page
      .locator('body > header nav a')
      .evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    expect(deepLinks).toEqual(['/hakkimda', '/calisma-alanlari', '/projeler', '/cv', '/iletisim']);
    for (const home of ['/', '/en']) {
      const html = await (await request.get(home)).text();
      const hero = /data-chapter="hero"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
      const ctas = [...hero.matchAll(/<a[^>]*href="([^"]+)"/g)].map((m) => m[1]);
      expect.soft(ctas.length, `${home} CTA`).toBeGreaterThanOrEqual(2);
      for (const href of ctas) expect.soft(href, `${home} CTA`).toMatch(/^\//);
    }
  });

  test('EN sayfalar: "SAATCİ" ve TR sözlük metinleri yalnız [lang="tr"] içinde; iç bağlantılar 200', async ({
    page,
    request,
  }) => {
    const trStrings = translated(tr, en);
    const enPaths = (await sitemapEntries(request)).map((e) => e.path).filter(isEn);
    enPaths.push('/en/privacy');
    const links = new Set<string>();
    for (const path of enPaths) {
      await test.step(path, async () => {
        await page.goto(path);
        const found = await page.evaluate((trList) => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const out: string[] = [];
          const set = new Set(trList);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const text = n.textContent?.trim() ?? '';
            if (!text) continue;
            const el = n.parentElement!;
            if (el.closest('script, style, [hidden], template')) continue;
            // KOD panelleri dekoratif kod resmidir (aria-hidden, translate="no"); okunan metin sayfadadır
            if (el.closest('[aria-hidden="true"]')) continue;
            if (el.closest('[lang]')?.getAttribute('lang') === 'tr') continue;
            if (text.includes('SAATCİ') || set.has(text)) out.push(text.slice(0, 60));
          }
          return out;
        }, trStrings);
        expect.soft(found, `${path}: [lang="tr"] dışında TR metin`).toEqual([]);
        for (const href of await page
          .locator('a[href^="/"]')
          .evaluateAll((els) => els.map((a) => a.getAttribute('href')!)))
          links.add(href.split('#')[0]!);
      });
    }
    for (const href of links) {
      if (!href) continue;
      expect.soft((await request.get(href)).status(), href).toBe(200);
    }
  });

  test('breadcrumb metinleri JSON-LD BreadcrumbList adlarıyla aynı', async ({ page, request }) => {
    const deep = (await sitemapEntries(request))
      .map((e) => e.path)
      .filter((p) => p !== '/' && p !== '/en');
    for (const path of deep) {
      await test.step(path, async () => {
        await page.goto(path);
        const visible = (await page.locator('main nav ol li').allTextContents()).map((t) =>
          t.replace('/', '').trim(),
        );
        const ld = JSON.parse(
          (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
        ) as { '@graph': { '@type': string; itemListElement?: { name: string }[] }[] };
        const crumbs = ld['@graph'].find((n) => n['@type'] === 'BreadcrumbList');
        expect
          .soft(
            crumbs?.itemListElement?.map((i) => i.name),
            path,
          )
          .toEqual(visible);
      });
    }
  });
});
