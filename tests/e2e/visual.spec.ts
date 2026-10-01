// tests/e2e/visual.spec.ts — görsel regresyon (§13.4.2, K-GEN-10). Tabanlar YALNIZ CI'da, Linux'ta üretilir
// (ci.yml workflow_dispatch + update_snapshots); macOS tabanı commit etmek YASAK.
// İçerikli sayfalar ve bir proje sayfası; başlık kırpıntısı ve maske testi (§6.12, M4) desktop-chromium'dadır.
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { expect, test } from './fixtures';

const MASK_TEXT = 'İletişim Özgeçmiş ÇALIŞMA Ğ';

/**
 * SplitText 3.15 çıktısının aynısı: satır `.split-line`, maske `.split-line-mask` (overflow: clip; dolgu 0.2em,
 * globals.css). `from` = satırın yPercent'i (130 = reveal öncesi, 0 = sonrası). Tek satır: nowrap. Başlığın 0.4em
 * iç boşluğu satır kutusundan taşan aksanları ekran görüntüsüne dahil eder.
 */
async function maskedHeading(page: Page, from: number | null) {
  await page.evaluate(
    ({ text, y }) => {
      document.getElementById('mask-test')?.remove();
      const h = document.createElement('h2');
      h.id = 'mask-test';
      h.className = 'type-h2';
      h.style.cssText =
        'position:fixed;left:40px;top:160px;z-index:100;max-width:none;white-space:nowrap;margin:0;padding:0.4em;background:var(--color-canvas)';
      if (y === null) h.textContent = text;
      else
        h.innerHTML = `<div class="split-line-mask" style="overflow:clip;display:block"><div class="split-line" style="display:block;transform:translateY(${y}%)">${text}</div></div>`;
      document.body.append(h);
    },
    { text: MASK_TEXT, y: from },
  );
  return page.locator('#mask-test');
}

/** Görüntüdeki farklı renkli piksel sayısı (kenar yumuşatma için eşik 24) */
async function inkPixels(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const [r0, g0, b0] = [data[0]!, data[1]!, data[2]!];
  let ink = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const d = Math.abs(data[i]! - r0) + Math.abs(data[i + 1]! - g0) + Math.abs(data[i + 2]! - b0);
    if (d > 24) ink++;
  }
  return ink;
}

const PAGES = [
  '/',
  '/hakkimda',
  '/cv',
  '/projeler',
  '/projeler/bilsoft-on-muhasebe-e-fatura',
  '/iletisim',
  '/en',
] as const;
const THEMES = ['light', 'dark'] as const;

test.use({ reducedMotion: 'reduce' });

test.describe('K-GEN-10 görsel regresyon', { tag: ['@reduced-motion', '@pixel-7'] }, () => {
  for (const path of PAGES) {
    for (const theme of THEMES) {
      test(`${path} ${theme}`, async ({ page }) => {
        await page.clock.install({ time: new Date('2026-01-01T09:00:00+03:00') });
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        // SPEC-SAPMA §13.4.2 (M5): #scene-layer §5.12.5'ten beri tam ekran fixed kutudur; tamamı maskelenirse tam sayfa
        // görüntüsünün ilk ekranı kapanır. Yalnız canvas maskelenir (azaltılmış harekette canvas yoktur, posterler dahil)
        await expect(page).toHaveScreenshot({
          fullPage: true,
          mask: [page.locator('#scene-layer canvas'), page.locator('[data-live-time]')],
        });
      });
    }
  }
});

test.describe('§6.12 maske testi ve başlık kırpıntısı', { tag: ['@desktop-chromium'] }, () => {
  test('K-GEN-10 "İletişim Özgeçmiş ÇALIŞMA Ğ": %130 ötelemede maskede mürekkep yok; açılmış hâl aksanları tam gösterir', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const before = await maskedHeading(page, 130);
    const mask = before.locator('.split-line-mask');
    expect(await inkPixels(await mask.screenshot()), 'reveal öncesi maskede mürekkep').toBe(0);
    // açılmış satır, bölünmemiş başlıkla piksel düzeyinde aynıdır (İ noktası, Ğ breve'i, Ç/Ş çengeli kırpılmaz)
    const plain = await (await maskedHeading(page, null)).screenshot();
    const revealed = await (await maskedHeading(page, 0)).screenshot();
    const a = await sharp(plain).raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(revealed).raw().toBuffer({ resolveWithObject: true });
    expect(b.info.width).toBe(a.info.width);
    expect(b.info.height).toBe(a.info.height);
    let diff = 0;
    for (let i = 0; i < a.data.length; i++) if (Math.abs(a.data[i]! - b.data[i]!) > 8) diff++;
    expect(diff, 'açılmış hâl ile bölünmemiş başlık farkı').toBe(0);
    await expect(await maskedHeading(page, 0)).toHaveScreenshot('mask-heading.png');
  });
});
