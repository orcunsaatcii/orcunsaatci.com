// tests/e2e/visual.spec.ts — görsel regresyon (§13.4.2, K-GEN-10). Tabanlar YALNIZ CI'da, Linux'ta üretilir
// (ci.yml workflow_dispatch + update_snapshots); macOS tabanı commit etmek YASAK.
// M2: kabuk sayfaları (proje sayfası M3'te, başlık kırpıntıları reveal'larla birlikte M4'te eklenir).
import { expect, test } from './fixtures';

const PAGES = ['/', '/hakkimda', '/cv', '/projeler', '/iletisim', '/en'] as const;
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
        await expect(page).toHaveScreenshot({
          fullPage: true,
          mask: [page.locator('#scene-layer'), page.locator('[data-live-time]')],
        });
      });
    }
  }
});
