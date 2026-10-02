// tests/e2e/work-viewer.spec.ts — work görüntüleyicisi: aynı grid alanında üst üste sticky figürler (§4.9.3, K-WORK-1,
// K-WORK-10, V-38). Çapraz tarayıcı projeleri yalnız PW_CROSS=1 iken vardır (§13.3.7). Geometri beklentisi ızgara
// formülünden hesaplanır (k7–12, top 14 svh); fark ≤ 2 px. Ekran görüntüsü tabanı yalnız desktop-chromium'dadır.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { settle } from './helpers/scroll';

/**
 * Makale k'nın üst kenarı görüntü alanının %10'unda (etkin: < %55; görüntüleyici sticky: ızgara üstü < 14 svh; sonraki
 * makale %80'de, etkin değil) olacak şekilde kaydırır ve silmenin oturmasını bekler.
 */
async function scrollToArticle(page: Page, k: number) {
  await page.evaluate((i) => {
    const a = document.querySelectorAll<HTMLElement>('[data-work-article]')[i]!;
    const top = a.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top - 0.1 * window.innerHeight, behavior: 'instant' });
  }, k);
  await settle(page);
  // SectionWipe bitince satır içi clip-path temizlenir
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>('[data-work-figure]')].every(
      (f) => !f.style.clipPath,
    ),
  );
}

test.describe(
  'K-WORK-10 görüntüleyici',
  { tag: ['@desktop-chromium', '@desktop-webkit', '@desktop-firefox'] },
  () => {
    test('figürler tek görüntüleyicide üst üste; tam olarak biri açık; geometri formüle uyar', async ({
      page,
      browserName,
    }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
      const count = await page.locator('[data-work-figure]').count();
      expect(count).toBeGreaterThanOrEqual(3);
      for (let k = 0; k < count; k++) {
        await test.step(`makale ${k + 1}`, async () => {
          await scrollToArticle(page, k);
          const geo = await page.evaluate(() => {
            const grid = document.querySelector<HTMLElement>('.work-grid')!;
            const g = Number.parseFloat(getComputedStyle(grid).columnGap);
            const gr = grid.getBoundingClientRect();
            const col = (gr.width - 11 * g) / 12;
            const figures = [...document.querySelectorAll<HTMLElement>('[data-work-figure]')];
            return {
              expected: {
                left: gr.left + 6 * (col + g),
                width: 6 * col + 5 * g,
                top: 0.14 * window.innerHeight,
              },
              boxes: figures.map((f) => {
                const r = f.getBoundingClientRect();
                return { left: r.left, width: r.width, top: r.top };
              }),
              open: figures.map((f) => {
                const c = getComputedStyle(f).clipPath;
                return c === 'none' || /^inset\(0(px)?\)$/.test(c);
              }),
            };
          });
          for (const [i, b] of geo.boxes.entries()) {
            expect
              .soft(Math.abs(b.left - geo.expected.left), `figür ${i} sol`)
              .toBeLessThanOrEqual(2);
            expect
              .soft(Math.abs(b.width - geo.expected.width), `figür ${i} genişlik`)
              .toBeLessThanOrEqual(2);
            expect
              .soft(Math.abs(b.top - geo.expected.top), `figür ${i} üst`)
              .toBeLessThanOrEqual(2);
          }
          expect(geo.open.filter(Boolean).length, 'açık figür sayısı').toBe(1);
          expect(geo.open[k], `figür ${k + 1} açık`).toBe(true);
        });
      }
      if (browserName === 'chromium') {
        await scrollToArticle(page, 1);
        // KOD derleme efekti (AsciiCompile) bitince canvas kalkar: görüntü gerçek kapaktır
        await expect(page.locator('canvas.ascii-compile')).toHaveCount(0, { timeout: 5000 });
        const viewer = page.locator('[data-work-figure]').nth(1);
        await expect(viewer).toHaveScreenshot('work-viewer.png');
      }
    });
  },
);
