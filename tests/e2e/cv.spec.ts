// tests/e2e/cv.spec.ts — CV sayfası, PDF ve JSON Resume (§7.6; D-13, K-VAR-6). Baskıda RingsFigure görünür (M4);
// ≥ 80rem taş çapası M5/M7'de bu dosyaya eklenir.
import { expect, test } from './fixtures';

test.describe('D-13 CV', { tag: ['@desktop-chromium', '@no-js'] }, () => {
  test('PDF bağlantıları download taşır; dosya bilgisi gerçek dosyadan', async ({ page }) => {
    for (const [path, pdf] of [
      ['/cv', '/files/orcun-saatci-cv-tr.pdf'],
      ['/en/cv', '/files/orcun-saatci-cv-en.pdf'],
    ] as const) {
      await page.goto(path);
      const links = page.locator(`a[href="${pdf}"]`);
      expect(await links.count()).toBeGreaterThan(0);
      for (const link of await links.all()) {
        await expect.soft(link).toHaveAttribute('download', '');
        await expect.soft(link).toHaveAttribute('type', 'application/pdf');
      }
      await expect(links.first()).toContainText(/PDF · \d+ (sayfa|pages?) · \d+ KB/);
    }
  });

  test('PDF 200 + application/pdf + noindex; JSON Resume ayrıştırılır', async ({ request }) => {
    for (const locale of ['tr', 'en']) {
      const pdf = await request.get(`/files/orcun-saatci-cv-${locale}.pdf`);
      expect(pdf.status()).toBe(200);
      expect(pdf.headers()['content-type']).toBe('application/pdf');
      expect(pdf.headers()['x-robots-tag']).toContain('noindex');
      const body = (await pdf.body()).toString('latin1');
      expect(body).toContain(`/Lang (${locale})`);
      const json = await request.get(`/files/resume.${locale}.json`);
      expect(json.status()).toBe(200);
      expect(json.headers()['x-robots-tag']).toContain('noindex');
      const resume = JSON.parse(await json.text()) as { basics: { name: string } };
      expect(resume.basics.name).toBe('Orçun Saatçi');
    }
  });

  test('bölüm sırası ve çapalar §7.6.1; boş bölüm yok; pdf-only kayıt sayfada yok', async ({
    page,
  }) => {
    await page.goto('/cv');
    const ids = await page.locator('main section[id]').evaluateAll((els) => els.map((el) => el.id));
    const order = [
      'profil',
      'deneyim',
      'yetkinlikler',
      'egitim',
      'sertifikalar',
      'oduller',
      'yayinlar',
      'diller',
    ];
    expect(ids).toEqual(order.filter((id) => ids.includes(id)));
    expect(ids.slice(0, 2)).toEqual(['profil', 'deneyim']);
    for (const id of ids)
      expect
        .soft(await page.locator(`#${id} .cv-entry, #${id} p, #${id} li`).count(), id)
        .toBeGreaterThan(0);
    const pdfText = await (await page.request.get('/files/resume.tr.json')).text();
    // pdf-only bir deneyim JSON Resume'da (PDF seçimi) var, sayfada yok
    const work = (JSON.parse(pdfText) as { work?: { name: string }[] }).work ?? [];
    const onPage = await page.locator('#deneyim').innerText();
    expect(work.some((w) => !onPage.includes(w.name))).toBe(true);
  });

  test('baskı: header, footer ve düğmeler gizli; açık tema zorlanır', async ({ page }) => {
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    await page.goto('/cv');
    await expect(page.locator('body > header')).toBeHidden();
    await expect(page.locator('footer[data-site-footer]')).toBeHidden();
    for (const el of await page.locator('[data-print="hide"]').all())
      await expect.soft(el).toBeHidden();
    const layer = page.locator('#scene-layer');
    if ((await layer.count()) > 0) await expect(layer).toBeHidden(); // StageRoot M5'te gelir
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toMatch(/rgb\(255, 255, 255\)|rgba\(0, 0, 0, 0\)/);
    // K-VAR-6: figürler basılır; ekranda cv-figure gizlidir
    await expect(page.locator('.cv-figure svg[role="img"]')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('.cv-figure')).toBeHidden();
  });
});
