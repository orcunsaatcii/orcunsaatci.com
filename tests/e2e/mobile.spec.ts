// tests/e2e/mobile.spec.ts — mobil yerleşim, dokunma hedefleri ve mobil menü (§6.4.5, §10.3.4, §10.7; K-MOBILE-1/2/3).
// Yatay taşma, dokunma hedefleri, Lenis sınıfı, header gizle/göster (M4), çapa sonrası konum ve menü odak sözleşmesi
// (K-MICRO-10, açılış 500 ms). Dokunmatikte işaretçi efekti yok (K-MICRO-2/9). Yatay modda taş (K-MOBILE-4) M6'dan
// itibaren eklenir (§15.3.1 #12).
import { expect, test } from './fixtures';
import { pageDelay, readLive, waitForStagePhase } from './helpers/stage';
import { pagePaths } from './helpers/urls';

test.describe('K-MOBILE mobil kabuk', { tag: ['@pixel-7', '@iphone-15'] }, () => {
  test('K-MOBILE-1 her URL’de yatay taşma yok ve html.lenis-smooth yok', async ({
    page,
    request,
  }) => {
    for (const path of await pagePaths(request)) {
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
    // §4.14 #17: düğmeden daire clip-path, 500 ms
    const opening = await dialog.evaluate((d) =>
      d
        .getAnimations()
        .map((a) => a.effect as KeyframeEffect)
        .filter((e) => e.getKeyframes().some((k) => 'clipPath' in k))
        .map((e) => e.getTiming().duration),
    );
    expect(opening, 'menü açılışı 500 ms').toEqual([500]);
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

  test('K-MOBILE-2 header aşağı kaydırmada gizlenir, yukarıda döner; odak varken gizlenmez', async ({
    page,
  }) => {
    await page.goto('/hakkimda', { waitUntil: 'networkidle' });
    const header = page.locator('body > header');
    const headerTop = () => header.evaluate((h) => h.getBoundingClientRect().bottom);
    const scrollBy = async (dy: number) => {
      await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'instant' }), dy);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    };
    await scrollBy(400);
    await expect(header).toHaveAttribute('data-hidden', '');
    await expect.poll(headerTop).toBeLessThanOrEqual(1); // translateY(−100%), 240 ms
    await scrollBy(-40);
    await expect(header).not.toHaveAttribute('data-hidden');
    await expect.poll(headerTop).toBeGreaterThan(40);
    // odak header'dayken aşağı kaydırma gizlemez
    await header.getByRole('button', { name: 'Menüyü aç' }).focus();
    await scrollBy(400);
    await expect(header).not.toHaveAttribute('data-hidden');
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

test.describe(
  '§4.14.1 dokunmatikte işaretçi efekti yok',
  { tag: ['@pixel-7', '@iphone-15'] },
  () => {
    test('K-MICRO-2/9 dokunuşta panel paralaksı ve tepkisi yok; manyetik etiket kaymaz', async ({
      page,
    }) => {
      await page.goto('/?tier=medium&debug', { waitUntil: 'networkidle' });
      const phase = await waitForStagePhase(page, ['ready', 'fallback'], 30_000);
      await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
      // panelin ve hero başlığının üstüne dokunulur (bağlantı yok: gezinme olmaz)
      const anchor = (await page.locator('[data-stage-anchor="hero-rest"]').boundingBox())!;
      const h1 = (await page.locator('[data-chapter="hero"] h1').boundingBox())!;
      await page.touchscreen.tap(anchor.x + anchor.width * 0.7, anchor.y + anchor.height * 0.7);
      await page.touchscreen.tap(h1.x + h1.width / 2, h1.y + h1.height / 2);
      await pageDelay(page, 800);
      expect(page.url(), 'dokunuş gezinmedi').toMatch(/\/\?tier=medium&debug$/);
      if (phase === 'ready') {
        const l = await readLive(page);
        expect([l.kod.parX, l.kod.parY], 'paralaks yok').toEqual([0, 0]);
      }
      const moved = await page
        .locator('[data-magnetic], [data-magnetic] > *')
        .evaluateAll((els) => els.filter((el) => getComputedStyle(el).transform !== 'none').length);
      expect(moved, 'manyetik kayma yok').toBe(0);
    });
  },
);
