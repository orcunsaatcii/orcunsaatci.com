// tests/e2e/not-found.spec.ts — 404 sayfaları (§3.7, §4.13.6; D-19, K-DEEP-2, K-DEEP-9).
// Durum kodu, noindex, data-404, H1, iç bağlantılar, mailto:, canvas yokluğu ve KOD hata çıktısı paneli; ağaç
// 404'ünde "Son projeler" (§15.4.1 #10).
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
      await expect(page.locator('[data-404] a[href^="mailto:"]').first()).toBeVisible();
      // JS yokken sayfa zamanlayıcısı çalışmaz; canvas zaten oluşamaz
      if (javaScriptEnabled)
        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 3000)));
      await expect(page.locator('canvas')).toHaveCount(0);
    });
  }

  test('ağaç 404’ü (V-23) "Son projeler" listeler', async ({ request }) => {
    // notFound() çağıran ağaç sayfası: EN'de sayfası olmayan TR projesi (dynamicParams=false dışı yol, §3.7)
    const html = await (await request.get('/projeler/yok')).text();
    const tree = html.includes('data-404="tree"');
    test.info().annotations.push({ type: 'V-23', description: tree ? 'tree' : 'global' });
    if (tree) expect(html).toMatch(/Son projeler/);
  });

  test('/yok ve /en/yok global 404’tür', async ({ request }) => {
    for (const path of ['/yok', '/en/yok']) {
      const html = await (await request.get(path)).text();
      expect.soft(html, path).toContain('data-404="global"');
    }
  });
});

test.describe('K-DEEP-9 KOD hata çıktısı', { tag: ['@desktop-chromium', '@no-js'] }, () => {
  test('404 paneli statik HTML’dir: dekoratif, hata çıktısı ve önerilen yollar; JS gerekmez', async ({
    page,
  }) => {
    allowConsole('404');
    for (const path of ['/yok', '/en/yok', '/projeler/yok']) {
      await test.step(path, async () => {
        await page.goto(path);
        const panel = page.locator('[data-404] .kod-panel');
        await expect(panel).toHaveCount(1);
        await expect(panel).toHaveAttribute('aria-hidden', 'true');
        await expect(panel).toHaveAttribute('data-kod-program', /^notfound:/);
        await expect(panel).toBeVisible();
        await expect(panel).toContainText('Error: 404');
        // önerilen yollar sayfadaki bağlantılarla aynı (panel bağlantı değildir; gerçek bağlantılar metindedir)
        for (const href of await page
          .locator('[data-404] a[href^="/"]')
          .evaluateAll((els) => els.map((a) => a.getAttribute('href')!))
          .then((h) => h.slice(0, 3)))
          await expect(panel).toContainText(href);
        await expect(panel.locator('a, button')).toHaveCount(0);
      });
    }
  });
});
