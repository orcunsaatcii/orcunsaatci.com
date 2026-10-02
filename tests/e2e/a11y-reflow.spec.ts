// tests/e2e/a11y-reflow.spec.ts — yeniden akış, yakınlaştırma ve metin aralığı (§10.5.4; WCAG 1.4.4, 1.4.10,
// 1.4.12, 1.3.4). Sayfa listesi: sitemap + NOINDEX_PATHS (pagePaths).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { pagePaths } from './helpers/urls';

const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 640, height: 400 },
  { width: 844, height: 390 },
] as const;

const TEXT_SPACING = `
* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-bottom: 2em !important; }
`;

/**
 * Yerleşim ölçümü görsel yüklemesini beklemez: görseller width/height ile yer ayırır. `load` beklemek her görünüm
 * genişliğinde soğuk görsel optimizasyonunu (AVIF) tetikleyip tek testin 60 s bütçesini tüketiyordu (§13.1.1 #6).
 */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test.describe('§10.5.4 yeniden akış', { tag: ['@desktop-chromium'] }, () => {
  for (const vp of VIEWPORTS) {
    test(`1.4.10 ${vp.width}×${vp.height} her route’ta yatay taşma yok`, async ({
      page,
      request,
    }) => {
      await page.setViewportSize(vp);
      for (const path of await pagePaths(request)) {
        await test.step(path, async () => {
          await open(page, path);
          const [scrollWidth, innerWidth] = await page.evaluate(() => [
            document.documentElement.scrollWidth,
            window.innerWidth,
          ]);
          expect.soft(scrollWidth, path).toBeLessThanOrEqual(innerWidth);
        });
      }
    });
  }

  test('1.4.12 metin aralığı enjeksiyonunda kırpılan metin yok', async ({ page, request }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of await pagePaths(request)) {
      await test.step(path, async () => {
        await open(page, path);
        await page.addStyleTag({ content: TEXT_SPACING });
        const clipped = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('body *')]
            .filter((el) => {
              const cs = getComputedStyle(el);
              const hides = /hidden|clip/.test(cs.overflowX + cs.overflowY);
              const hasText = [...el.childNodes].some(
                (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
              );
              // görsel olarak gizli (sr-only) öğeler bilinçli olarak kırpılır
              const srOnly = cs.position === 'absolute' && el.clientWidth <= 1;
              // KOD paneli sabit ızgaralı dekoratif kod resmidir (aria-hidden); asıl metin sayfadadır
              const decorative = !!el.closest('[aria-hidden="true"]');
              return (
                hides && hasText && !srOnly && !decorative && el.scrollHeight > el.clientHeight + 1
              );
            })
            .map((el) => `${el.tagName}.${el.className}`),
        );
        expect.soft(clipped, path).toEqual([]);
      });
    }
  });
});
