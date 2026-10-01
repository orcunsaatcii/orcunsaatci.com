// tests/e2e/navigation.spec.ts — geri/ileri ve bölüm çapaları (§5.13.4, §5.15.3; V-51, V-52). M7'de minimal kapsam
// (sahibin kararı, 2026-10-01): her ana sayfa bölümü için header çapasıyla atla → bölümdeki derin sayfa bağlantısına
// git → geri: kalınan yer ± 2 svh korunur; ileri: derin sayfa en üstte açılır. Geçiş animasyonlarının kendisi
// (transitions.spec.ts) M8'dedir. Sahne kesmesinin süreleri choreography.spec.ts K-CHOREO-5'tedir.
import { expect, test } from './fixtures';
import { settle } from './helpers/scroll';

const CHAPTERS = [
  ['about', 'ben'],
  ['areas', 'alanlar'],
  ['work', 'projeler'],
  ['journey', 'yolculuk'],
  ['contact', 'iletisim'],
] as const;

test.describe('§5.15.3 geri/ileri: bölüm çapaları', { tag: ['@desktop-chromium'] }, () => {
  for (const [chapter, anchor] of CHAPTERS) {
    test(`V-52 #${anchor}: derin sayfadan geri dönünce konum korunur, ileri en üstte`, async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
      await page.locator(`header a[href="#${anchor}"]`).first().click();
      await page.waitForFunction(
        (id) => {
          const el = document.getElementById(id);
          if (!el) return false;
          const pad =
            Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
          return Math.abs(el.getBoundingClientRect().top - pad) <= 2;
        },
        anchor,
        { timeout: 10_000 },
      );
      await settle(page);
      const before = await page.evaluate(() => window.scrollY);
      const vh = await page.evaluate(() => window.innerHeight);
      // bölümün içindeki son dahili (hash'siz) derin sayfa bağlantısı
      const link = page.locator(`[data-chapter="${chapter}"] a[href^="/"]:not([href*="#"])`).last();
      test.skip((await link.count()) === 0, `${chapter}: derin sayfa bağlantısı yok`);
      const href = await link.getAttribute('href');
      await link.scrollIntoViewIfNeeded();
      const at = await page.evaluate(() => window.scrollY);
      await link.click();
      await page.waitForURL((u) => u.pathname === href?.split('?')[0]);
      await settle(page);
      await page.goBack();
      await page.waitForURL((u) => u.pathname === '/');
      await settle(page);
      const back = await page.evaluate(() => window.scrollY);
      // bağlantı görünüme getirilirken kaydırma değişmiş olabilir: geri dönüş tıklamadaki konuma döner
      expect
        .soft(Math.abs(back - at), `geri: ${back} ≠ ${at} (çapa ${before})`)
        .toBeLessThanOrEqual(0.02 * vh);
      await page.goForward();
      await page.waitForURL((u) => u.pathname === href?.split('?')[0]);
      await settle(page);
      expect(await page.evaluate(() => window.scrollY), 'ileri: en üstte').toBeLessThanOrEqual(2);
    });
  }
});
