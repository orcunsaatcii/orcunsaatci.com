// tests/e2e/a11y.spec.ts — axe (WCAG 2.2 AA etiketleri) 0 ihlal; kapsam §10.6 / §13.4.1:
// her route × {varsayılan, reduced-motion} × {desktop-chromium, pixel-7}; ek durumlar: menü açık, filtre etkin,
// ağaç 404'ü, global-not-found, forcedColors ve contrast: more. Areas orta adımı M4'te, v1.1 formu M9'da eklenir.
import { allowConsole, expect, test } from './fixtures';
import { expectNoAxeViolations } from './helpers/axe';
import { pagePaths } from './helpers/urls';

test.describe('§10.6 axe', { tag: ['@desktop-chromium', '@reduced-motion', '@pixel-7'] }, () => {
  test('her route 0 ihlal', async ({ page, request }) => {
    for (const path of await pagePaths(request)) {
      await test.step(path, async () => {
        await page.goto(path);
        await expectNoAxeViolations(page, path);
      });
    }
  });

  test('404 sayfaları (ağaç ve global) 0 ihlal', async ({ page }) => {
    allowConsole('404');
    for (const path of ['/projeler/yok', '/yok', '/en/yok']) {
      await page.goto(path);
      await expect(page.locator('[data-404]')).toHaveCount(1);
      await expectNoAxeViolations(page, path);
    }
  });

  test('filtre etkin', async ({ page }) => {
    await page.goto('/projeler');
    const chips = page.locator('[role="group"] button');
    if ((await chips.count()) > 1) await chips.nth(1).click(); // JS'siz çip yok (reduced-motion'da JS açık)
    await expectNoAxeViolations(page, 'filtre');
  });
});

test.describe('§10.6 axe: mobil menü açık', { tag: ['@pixel-7'] }, () => {
  test('menü açıkken 0 ihlal', async ({ page }) => {
    await page.goto('/hakkimda');
    await page.getByRole('button', { name: /menü/i }).click();
    await expectNoAxeViolations(page, 'menü');
  });
});

test.describe('§10.7 forcedColors ve contrast: more', { tag: ['@desktop-chromium'] }, () => {
  for (const media of [{ forcedColors: 'active' }, { contrast: 'more' }] as const) {
    test(`${Object.keys(media)[0]}: ana sayfa, proje ve iletişim 0 ihlal`, async ({
      page,
      request,
    }) => {
      await page.emulateMedia(media);
      const project = (await pagePaths(request)).find((p) => p.startsWith('/projeler/'))!;
      for (const path of ['/', project, '/iletisim']) {
        await page.goto(path);
        await expectNoAxeViolations(page, `${path} ${JSON.stringify(media)}`);
      }
    });
  }
});
