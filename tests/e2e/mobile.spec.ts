// tests/e2e/mobile.spec.ts — mobil yerleşim, dokunma hedefleri ve mobil menü (§6.4.5, §10.3.4, §10.7; K-MOBILE-1/3).
// M2 kapsamı: yatay taşma, dokunma hedefleri, Lenis sınıfı, çapa sonrası konum ve menü odak sözleşmesi.
// Header gizleme (K-MOBILE-2) M4'ten, yatay modda taş (K-MOBILE-4) M6'dan itibaren eklenir (§15.3.1 #12).
import { expect, test } from './fixtures';
import { SHELL_PATHS } from './helpers/urls';

test.describe('K-MOBILE mobil kabuk', { tag: ['@pixel-7', '@iphone-15'] }, () => {
  test('K-MOBILE-1 her URL’de yatay taşma yok ve html.lenis-smooth yok', async ({ page }) => {
    for (const path of SHELL_PATHS) {
      await test.step(path, async () => {
        // WebKit, yarıda kesilen RSC ön-yüklemelerini sayfa hatası olarak raporlar: ağ durulunca geçilir
        await page.goto(path, { waitUntil: 'networkidle' });
        const { scrollWidth, innerWidth, lenis } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          lenis: document.documentElement.classList.contains('lenis-smooth'),
        }));
        expect.soft(scrollWidth, `${path} scrollWidth`).toBeLessThanOrEqual(innerWidth);
        expect.soft(lenis, `${path} lenis-smooth`).toBe(false);
      });
    }
  });

  test('§6.4.5 dokunma hedefleri ≥ 44 × 44 px (header, menü, footer)', async ({ page }) => {
    const measure = (selector: string) =>
      page.locator(selector).evaluateAll((els) =>
        els
          .filter((el) => el.getClientRects().length > 0 && !el.closest('p'))
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { el: `${el.tagName} "${el.textContent?.trim()}"`, w: r.width, h: r.height };
          }),
      );
    const check = (boxes: { el: string; w: number; h: number }[], where: string) => {
      expect(boxes.length, where).toBeGreaterThan(0);
      for (const b of boxes) {
        expect.soft(b.w, `${where}: ${b.el} genişlik`).toBeGreaterThanOrEqual(44);
        expect.soft(b.h, `${where}: ${b.el} yükseklik`).toBeGreaterThanOrEqual(44);
      }
    };

    await page.goto('/hakkimda');
    check(
      await measure('header a, header button, [data-site-footer] a, [data-site-footer] label'),
      'sayfa',
    );
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
    check(
      await measure('[role="dialog"] a, [role="dialog"] button, [role="dialog"] label'),
      'menü',
    );
  });

  test('§10.7 mobil menü: odak ilk bağlantıda, Tab döner, Esc kapatır, odak düğmeye döner', async ({
    page,
    browserName,
  }) => {
    // WebKit (Safari) Tab ile bağlantılara uğramaz; bağlantılar dahil gezinme Alt+Tab'dır
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
    await page.goto('/hakkimda');
    const openButton = page.getByRole('button', { name: 'Menüyü aç' });
    await openButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(openButton).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.locator('nav a').first()).toBeFocused();
    await expect(page.locator('#main')).toHaveJSProperty('inert', true);
    await expect(page.locator('body > header')).toHaveJSProperty('inert', true);
    await expect(page.locator('[data-site-footer]')).toHaveJSProperty('inert', true);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');

    // Tab ileri: odak hiçbir durakta menüden çıkmaz ve ilk bağlantıya döner
    const stops = await dialog
      .locator('a[href], button, input[type="radio"]:checked')
      .evaluateAll((els) => els.filter((el) => el.getClientRects().length > 0).length);
    for (let i = 0; i < stops; i++) {
      await page.keyboard.press(tab);
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await expect(dialog.locator('nav a').first()).toBeFocused();
    // Shift+Tab ilk bağlantıdan son durağa atlar
    await page.keyboard.press(`Shift+${tab}`);
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(openButton).toBeFocused();
    await expect(openButton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#main')).toHaveJSProperty('inert', false);
  });

  test('K-MOBILE-3 çapa gezinmesinden sonra hedefin üstü header’ın altında', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'İletişim' }).click();
    await expect(page).toHaveURL(/#iletisim$/);
    const [targetTop, headerBottom] = await page.evaluate(() => [
      document.getElementById('iletisim')!.getBoundingClientRect().top,
      document.querySelector('body > header')!.getBoundingClientRect().bottom,
    ]);
    expect(targetTop).toBeGreaterThanOrEqual(headerBottom - 1);
  });
});
