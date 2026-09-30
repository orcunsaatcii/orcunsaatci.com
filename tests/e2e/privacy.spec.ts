// tests/e2e/privacy.spec.ts — çerezsizlik, gizlilik sayfası yapısı, analitik yokluğu (§12.3, §12.4, §12.6).
// Production GPC testleri M9'da (BASE_URL production) eklenir.
import { expect, test } from './fixtures';
import { pagePaths } from './helpers/urls';

test.describe('§12.4 gizlilik', { tag: ['@desktop-chromium', '@no-js'] }, () => {
  test('tüm URL’ler gezildikten sonra çerez yok; analitik isteği yok; her footer gizlilik bağlantılı', async ({
    page,
    context,
    request,
  }) => {
    const analytics: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (url.includes('/_vercel/') || url.includes('vercel-scripts.com')) analytics.push(url);
    });
    for (const path of await pagePaths(request)) {
      await test.step(path, async () => {
        await page.goto(path);
        const footerLinks = await page
          .locator('footer a')
          .evaluateAll((els) => els.map((a) => a.getAttribute('href')));
        expect
          .soft(
            footerLinks.some((h) => h === '/gizlilik' || h === '/en/privacy'),
            `${path}: gizlilik`,
          )
          .toBe(true);
      });
    }
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => document.cookie)).toBe('');
    expect(analytics).toEqual([]);
  });

  test('/gizlilik: iki h2 bu sırada, 7 başlık, 9 hak ve "Son güncelleme"; EN aynı yapıda', async ({
    page,
  }) => {
    for (const [path, first, second, updated] of [
      [
        '/gizlilik',
        'KVKK Aydınlatma Metni',
        'Gizlilik Politikası ve Çerez Bilgilendirmesi',
        'Son güncelleme',
      ],
      ['/en/privacy', null, null, 'Last updated'],
    ] as const) {
      await page.goto(path);
      const h2 = await page.locator('main h2').allTextContents();
      expect(h2).toHaveLength(2);
      if (first) expect(h2).toEqual([first, second]);
      await expect(page.locator('main')).toContainText(updated);
      // aydınlatma kısmı: 7 alt başlık ve m.11'in 9 hakkı (ilk h2 ile ikinci h2 arası)
      const section = await page.evaluate(() => {
        const [a, b] = [...document.querySelectorAll('main h2')];
        const h3: string[] = [];
        let items = 0;
        for (let el = a?.nextElementSibling; el && el !== b; el = el.nextElementSibling) {
          if (el.tagName === 'H3') h3.push(el.textContent ?? '');
          if (el.tagName === 'UL' || el.tagName === 'OL')
            items = Math.max(items, el.children.length);
        }
        return { h3: h3.length, items };
      });
      expect.soft(section.h3, `${path}: aydınlatma başlıkları`).toBe(7);
      expect.soft(section.items, `${path}: m.11 hakları`).toBe(9);
    }
  });

  test('iletişim sayfasında onay kutusu yok', async ({ page }) => {
    await page.goto('/iletisim');
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
  });
});
