// tests/e2e/content-visibility.spec.ts — JS'siz ve azaltılmış harekette içerik tamdır (§13.3.4; K-GEN-5, K-VAR-1,
// K-VAR-3, K-AREAS-1, K-WORK-5). Sayılar DOM'dan okunur (§13.1.1 #4).
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { waitForAnimations } from './helpers/axe';
import { pagePaths } from './helpers/urls';

test.describe('K-GEN-5 içerik görünürlüğü', { tag: ['@no-js', '@reduced-motion'] }, () => {
  test('(a) main’deki metin ve görseller görünür; (c) bölümlerde sticky yok', async ({
    page,
    request,
  }) => {
    for (const path of await pagePaths(request)) {
      await test.step(path, async () => {
        await page.goto(path);
        await waitForAnimations(page); // hero-in girişi CSS'tir ve JS'siz de biter
        const hidden = await page.evaluate(() => {
          const out: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>('main *')) {
            // görsel olarak gizli erişilebilir metin ve dekoratif öğeler kapsam dışıdır
            if (el.closest('.sr-only, [aria-hidden="true"], [hidden]')) continue;
            const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
            if (!text && el.tagName !== 'IMG') continue;
            if (el.getClientRects().length === 0) continue; // display: none (yanıtlı varyant, tema posteri)
            const cs = getComputedStyle(el);
            if (cs.opacity !== '1' || cs.visibility !== 'visible' || cs.clipPath !== 'none')
              out.push(
                `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ${cs.opacity}/${cs.visibility}/${cs.clipPath}`,
              );
          }
          return out;
        });
        expect.soft(hidden, `${path}: gizli içerik`).toEqual([]);
        const sticky = await page.evaluate(
          () =>
            [...document.querySelectorAll('[data-chapter] *')].filter(
              (el) => getComputedStyle(el).position === 'sticky',
            ).length,
        );
        expect.soft(sticky, `${path}: sticky`).toBe(0);
      });
    }
  });

  test('(b) ham HTML: H1, bölümler, alan ve öne çıkan proje başlıkları, mailto', async ({
    page,
    request,
  }) => {
    for (const [home, expertise] of [
      ['/', '/calisma-alanlari'],
      ['/en', '/en/expertise'],
    ] as const) {
      const html = await (await request.get(home)).text();
      expect(html).toMatch(/<h1[^>]*>[\s\S]*Orçun[\s\S]*Saatçi[\s\S]*<\/h1>/);
      expect(html.match(/data-chapter="/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
      expect(html).toContain('href="mailto:');
      await page.goto(expertise);
      const areas = await page.locator('main h2').allTextContents();
      expect(areas.length).toBeGreaterThan(0);
      for (const title of areas)
        expect.soft(html, `${home}: alan ${title}`).toContain(title.trim());
      await page.goto(home);
      const featured = await page.locator('[data-chapter="work"] article h3').allTextContents();
      expect(featured.length).toBeGreaterThanOrEqual(1);
      for (const title of featured)
        expect.soft(html, `${home}: proje ${title}`).toContain(title.trim());
    }
    for (const path of await pagePaths(request)) {
      const html = await (await request.get(path)).text();
      expect.soft(html, `${path}: mailto`).toContain('href="mailto:');
    }
  });

  test('(d) tüm alan açıklamaları görünür (liste modu); (e) hero, about ve contact posterleri', async ({
    page,
  }) => {
    for (const home of ['/', '/en']) {
      await page.goto(home);
      const descriptions = page.locator('[data-chapter="areas"] li p');
      const n = await descriptions.count();
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) await expect.soft(descriptions.nth(i)).toBeVisible();
      for (const anchor of ['hero-rest', 'about-cut', 'contact-ring']) {
        const posters = page.locator(`[data-stage-anchor="${anchor}"] img`);
        await expect.soft(posters.locator('visible=true'), `${home} ${anchor}`).toHaveCount(1);
      }
    }
  });
});

test.describe('§15.4.3 3D’siz yayınlanabilirlik', { tag: ['@reduced-motion'] }, () => {
  test('hiçbir sayfada canvas yok; içerik sayfaları stage ya da motion chunk’ı istemez', async ({
    page,
    request,
  }) => {
    // check-budgets.mjs'in gruplandırdığı dosyalar (M3'te stage grubunda yalnız M1'in lab chunk'ı vardır)
    const report = '.next/budgets.json';
    const groups = existsSync(report)
      ? (
          JSON.parse(readFileSync(report, 'utf8')) as {
            groups: Record<string, { files: string[] }>;
          }
        ).groups
      : {};
    const heavy = Object.values(groups)
      .flatMap((g) => g.files)
      .map((f) => f.replace(/^\.next\//, '/_next/'));
    const requested: string[] = [];
    page.on('request', (r) => requested.push(new URL(r.url()).pathname));
    for (const path of await pagePaths(request)) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect.soft(page.locator('canvas'), `${path}: canvas`).toHaveCount(0);
    }
    expect(requested.filter((p) => heavy.includes(p))).toEqual([]);
  });
});
