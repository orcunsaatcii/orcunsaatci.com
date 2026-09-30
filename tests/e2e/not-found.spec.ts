// tests/e2e/not-found.spec.ts — 404 sayfaları (§3.7, §4.13.6; D-19, K-DEEP-2, K-DEEP-9).
// M2 kapsamı: durum kodu, noindex, data-404, H1, iç bağlantılar, canvas yokluğu ve saat ibreleri.
// mailto: bağlantısı (getContact) M3'te eklenir.
import { allowConsole, expect, test } from './fixtures';
import { NOT_FOUND_PATHS } from './helpers/urls';

const PATHS = [...NOT_FOUND_PATHS, '/calisma-alanlari/yok'] as const;

test.describe('D-19 404 sayfaları', { tag: ['@desktop-chromium', '@no-js'] }, () => {
  for (const path of PATHS) {
    test(`${path} → 404, noindex, data-404, bağlantılar`, async ({ page, javaScriptEnabled }) => {
      // 404 yanıtı tarayıcı konsoluna "Failed to load resource" yazar
      allowConsole('404');
      const res = await page.goto(path);
      expect(res?.status()).toBe(404);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('[data-404]')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Sayfa bulunamadı');
      for (const href of ['/', '/projeler', '/iletisim'])
        await expect(page.locator(`[data-404] a[href="${href}"]`)).toHaveCount(1);
      // JS yokken sayfa zamanlayıcısı çalışmaz; canvas zaten oluşamaz
      if (javaScriptEnabled)
        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 3000)));
      await expect(page.locator('canvas')).toHaveCount(0);
    });
  }

  test('/yok ve /en/yok global 404’tür', async ({ request }) => {
    for (const path of ['/yok', '/en/yok']) {
      const html = await (await request.get(path)).text();
      expect.soft(html, path).toContain('data-404="global"');
    }
  });
});

test.describe('K-DEEP-9 ClockFigure', { tag: ['@no-js'] }, () => {
  test('SSR HTML’inde ibre yok', async ({ request }) => {
    const html = await (await request.get('/yok')).text();
    expect(html).toContain('data-live-time');
    expect(html).not.toContain('data-hand');
  });
});

test.describe('K-DEEP-9 ClockFigure', { tag: ['@desktop-chromium'] }, () => {
  test('ibreler yerel saati gösterir (14:32, ±6°)', async ({ page }) => {
    allowConsole('404');
    await page.clock.install({ time: new Date('2026-01-01T14:32:00+03:00') });
    await page.goto('/yok');
    const angle = async (hand: 'hour' | 'minute') => {
      const t = await page.locator(`[data-hand="${hand}"]`).getAttribute('transform');
      return Number.parseFloat(/rotate\(([-\d.]+)/.exec(t ?? '')?.[1] ?? 'NaN');
    };
    await expect(page.locator('[data-hand]')).toHaveCount(2);
    expect(Math.abs((await angle('hour')) - (30 * 2 + 0.5 * 32))).toBeLessThanOrEqual(6);
    expect(Math.abs((await angle('minute')) - 6 * 32)).toBeLessThanOrEqual(6);
    await expect(page.locator('svg[data-live-time]')).toHaveAttribute(
      'aria-label',
      'Yerel saat 14:32',
    );
  });

  test('data-motion="reduce" iken yükleme anında donar', async ({ page }) => {
    allowConsole('404');
    await page.clock.install({ time: new Date('2026-01-01T14:32:00+03:00') });
    await page.addInitScript(() => localStorage.setItem('os-motion', 'reduce'));
    await page.goto('/yok');
    await expect(page.locator('[data-hand]')).toHaveCount(2);
    const label = page.locator('svg[data-live-time]');
    await expect(label).toHaveAttribute('aria-label', 'Yerel saat 14:32');
    await page.clock.runFor(3 * 60_000);
    await expect(label).toHaveAttribute('aria-label', 'Yerel saat 14:32');
  });

  test('dakika sınırında güncellenir', async ({ page }) => {
    allowConsole('404');
    await page.clock.install({ time: new Date('2026-01-01T14:32:30+03:00') });
    await page.goto('/yok');
    const label = page.locator('svg[data-live-time]');
    await expect(label).toHaveAttribute('aria-label', 'Yerel saat 14:32');
    await page.clock.runFor(31_000);
    await expect(label).toHaveAttribute('aria-label', 'Yerel saat 14:33');
  });
});
