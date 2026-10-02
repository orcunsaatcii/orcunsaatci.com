// tests/e2e/contact.spec.ts — iletişim v1 (§12.1, §12.6; B24, K-CONTACT-1/2/8; toast K-MICRO-8). v1.1 form grubu M9'da
// eklenir.
import { allowConsole, expect, test } from './fixtures';
import { NOT_FOUND_PATHS, pagePaths } from './helpers/urls';

const CONTACT_TARGETS = /^(\/iletisim|\/en\/contact|#iletisim|#contact)$/;
// §12.1.5: iletişim yüzeylerinde ticari dil yok (D-30)
const COMMERCIAL =
  /₺|\bTL\b|fiyat|ücret|paket|indirim|satın al|rezervasyon|randevu al|price|pricing|package|discount|book a call|hire me/iu;

test.describe('§12.1.2 iletişime ulaşılabilirlik', { tag: ['@all'] }, () => {
  test('her sayfada iletişim bağlantısı ve görünür mailto:', async ({ page, request }) => {
    const paths = [...(await pagePaths(request)), ...NOT_FOUND_PATHS];
    allowConsole('404'); // 404 örnekleri "Failed to load resource" yazar
    for (const path of paths) {
      await test.step(path, async () => {
        await page.goto(path, { waitUntil: 'networkidle' });
        const hrefs = await page
          .locator('body > header a, [data-404] a, [data-chapter="hero"] a')
          .evaluateAll((els) => els.map((a) => a.getAttribute('href') ?? ''));
        expect
          .soft(
            hrefs.some((h) => CONTACT_TARGETS.test(h)),
            `${path}: iletişim bağlantısı`,
          )
          .toBe(true);
        await expect
          .soft(page.locator('a[href^="mailto:"]:visible').first(), `${path}: mailto`)
          .toBeVisible();
      });
    }
  });
});

test.describe('§12.1 iletişim sayfası', { tag: ['@desktop-chromium'] }, () => {
  test('tüm mailto adresleri aynı ve metin adresin kendisi; ticari dil yok; form yok', async ({
    page,
  }) => {
    for (const path of ['/iletisim', '/en/contact']) {
      await page.goto(path);
      const links = await page
        .locator('a[href^="mailto:"]')
        .evaluateAll((els) =>
          els.map((a) => ({ href: a.getAttribute('href'), text: a.textContent?.trim() })),
        );
      expect(links.length).toBeGreaterThan(0);
      const email = links[0]!.href!.replace('mailto:', '');
      for (const l of links) {
        expect.soft(l.href).toBe(`mailto:${email}`);
        expect.soft(l.text).toBe(email);
      }
      const text = await page.locator('main').innerText();
      expect.soft(text.match(COMMERCIAL)?.[0] ?? null, `${path}: ticari dil`).toBeNull();
      await expect(page.locator('form textarea[name="message"]')).toHaveCount(0);
      await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
    }
  });

  test('B24 Kopyala: pano e-postayı alır, "Kopyalandı" 2 s, role="status" toast', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/iletisim');
    const email = (await page
      .locator('main a[href^="mailto:"]')
      .first()
      .getAttribute('href'))!.replace('mailto:', '');
    const button = page
      .locator('main')
      .getByRole('button', { name: /kopyala/i })
      .first();
    await button.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(email);
    await expect(button).toContainText('Kopyalandı');
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: /kopyalandı/i })
        .first(),
    ).toBeVisible();
    await expect(button).not.toContainText('Kopyalandı', { timeout: 4000 });
  });

  test('K-MICRO-8 toast role="status", 4 s görünür kalır ve odaklanmış öğenin üstüne binmez', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 390, height: 844 }); // toast neredeyse tam genişlik
    await page.goto('/iletisim?tier=static', { waitUntil: 'networkidle' });
    const button = page
      .locator('main')
      .getByRole('button', { name: /kopyala/i })
      .first();
    // düğme toast'ın çıkacağı alt kenarda; klavyeyle basılır, odak düğmede kalır
    await button.evaluate((b) => {
      const r = b.getBoundingClientRect();
      window.scrollBy({ top: r.bottom - (window.innerHeight - 24), behavior: 'instant' });
    });
    await button.focus();
    // görünür kalma süresi sayfada ölçülür: kartın eklenişinden kalkışına (çıkış 160 ms dahil)
    await page.evaluate(() => {
      const w = window as unknown as { __toast: number[] };
      w.__toast = [];
      new MutationObserver((list) => {
        for (const m of list)
          if ((m.target as Element).matches('[role="status"][data-edge]'))
            w.__toast.push(performance.now());
      }).observe(document.body, { subtree: true, childList: true });
    });
    await page.keyboard.press('Enter');
    // sayfada iki Kopyala vardır (iletişim ve footer), her biri kendi bölgesiyle
    const region = page.locator('[role="status"][data-edge]').filter({ hasText: /kopyalandı/i });
    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(button).toBeFocused();
    const [b, c] = await Promise.all([button.boundingBox(), region.locator('> *').boundingBox()]);
    const overlap =
      b!.x < c!.x + c!.width &&
      c!.x < b!.x + b!.width &&
      b!.y < c!.y + c!.height &&
      c!.y < b!.y + b!.height;
    expect(overlap, `toast ${JSON.stringify(c)} odaklı düğmeye ${JSON.stringify(b)} biner`).toBe(
      false,
    );
    await expect(region.locator('> *')).toHaveCount(0, { timeout: 6000 });
    const [shown = 0, gone = 0] = await page.evaluate(
      () => (window as unknown as { __toast: number[] }).__toast,
    );
    expect(gone - shown, `görünür ${Math.round(gone - shown)} ms`).toBeGreaterThanOrEqual(4000);
    expect(gone - shown).toBeLessThanOrEqual(4000 + 160 + 500);
  });

  test('Pano API’si yokken adres seçilir ve yedek toast görünür', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    });
    await page.goto('/iletisim');
    const email = (await page
      .locator('main a[href^="mailto:"]')
      .first()
      .getAttribute('href'))!.replace('mailto:', '');
    await page
      .locator('main')
      .getByRole('button', { name: /kopyala/i })
      .first()
      .click();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(email);
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: /seçildi|selected|kopyalanamadı/i })
        .first(),
    ).toBeVisible();
  });
});

test.describe('§12.1.4 JS’siz Kopyala', { tag: ['@no-js'] }, () => {
  test('düğme görünmez; mailto görünür', async ({ page }) => {
    await page.goto('/iletisim');
    await expect(page.getByRole('button', { name: /kopyala/i })).toHaveCount(0);
    await expect(page.locator('main a[href^="mailto:"]').first()).toBeVisible();
  });
});
