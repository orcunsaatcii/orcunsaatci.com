// tests/e2e/i18n.spec.ts — dil değiştirici ve çerezsiz geçiş (§3.6, §3.10).
// M2 kapsamı: kabuk sayfalarında eşdeğer yol, html[lang] ve boş çerez listesi. Tam §3.10 listesi M3'tedir.
import { pathOf, staticRouteKeys, staticRoutes } from '../../src/i18n/config';
import { expect, test } from './fixtures';

// lab yalnız TR'dir ve bayrak kapalıyken 404 döner
const PAIRED = staticRouteKeys.filter((key) => staticRoutes[key].en !== null);

test.describe('§3.10 dil değiştirici', { tag: ['@desktop-chromium'] }, () => {
  test('her kabuk sayfada eşdeğer yola gider; html[lang] değişir; çerez yok', async ({
    page,
    context,
  }) => {
    for (const key of PAIRED) {
      const tr = pathOf({ key }, 'tr')!;
      const en = pathOf({ key }, 'en')!;
      await test.step(`${tr} ↔ ${en}`, async () => {
        await page.goto(tr);
        // ana sayfada full footer gizlidir; görünür ilk dil grubu header'dadır (≥ md)
        const switcher = page.locator('[data-language-switcher]:visible').first();
        await switcher.getByRole('link', { name: /EN/ }).click();
        await expect(page).toHaveURL(new RegExp(`${en.replace(/\//g, '\\/')}$`));
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');

        await page
          .locator('[data-language-switcher]:visible')
          .first()
          .getByRole('link', { name: /TR/ })
          .click();
        await expect(page).toHaveURL(
          new RegExp(`${tr === '/' ? '/$' : tr.replace(/\//g, '\\/') + '$'}`),
        );
        await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
      });
    }
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => document.cookie)).toBe('');
  });
});
