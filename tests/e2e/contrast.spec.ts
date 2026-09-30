// tests/e2e/contrast.spec.ts — sahne üstündeki metnin kontrastı (§5.18.2, §10.5, X8). YALNIZ RUN_CONTRAST=1 iken
// koşar (M5, M8, M10'da elle): RUN_CONTRAST=1 npx playwright test --project=desktop-chromium tests/e2e/contrast.spec.ts
// Her bölümde 10 kaydırma konumu × 2 tema × 3 genişlik; gövde metninde < 4.5, büyük metinde < 3.0 başarısızlıktır
// (eşikleri probeContrast uygular). Derin sayfalar M7'ye kadar 'none' preset'tedir: Taş yoksa denetlenecek öğe yoktur.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { settle } from './helpers/scroll';
import { waitForStagePhase, waitForStoneStill } from './helpers/stage';

const RUN = process.env.RUN_CONTRAST === '1';
const WIDTHS = [
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const DEEP = ['/hakkimda', '/projeler/ornek-proje-1', '/iletisim'] as const;

type Report = {
  checked: number;
  failures: { selector: string; text: string; ratio: number; threshold: number }[];
};

const probe = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __stage: { probeContrast(): Promise<Report> } }
    ).__stage.probeContrast(),
  );

/** Her bölümün başından sonuna 10 eşit aralıklı kaydırma konumu (belge y) */
const positions = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('#main [data-chapter]')].flatMap((c) => {
      const r = c.getBoundingClientRect();
      const top = r.top + window.scrollY;
      const span = Math.max(0, r.height - window.innerHeight);
      return Array.from({ length: 10 }, (_, i) => ({
        chapter: c.dataset.chapter ?? '?',
        y: Math.round(top + (span * i) / 9),
      }));
    }),
  );

test.describe('X8 kontrast probu', { tag: ['@desktop-chromium'] }, () => {
  test.skip(!RUN, 'yalnız RUN_CONTRAST=1 iken (elle, M5/M8/M10)');
  test.setTimeout(900_000);

  for (const url of ['/', ...DEEP]) {
    test(`§5.18.2 ${url}: gövde ≥ 4.5:1, büyük metin ≥ 3:1 (3 genişlik × 2 tema × 10 konum/bölüm)`, async ({
      browser,
    }) => {
      let checked = 0;
      for (const viewport of WIDTHS) {
        for (const colorScheme of ['light', 'dark'] as const) {
          const ctx = await browser.newContext({ viewport, colorScheme });
          const page = await ctx.newPage();
          await page.goto(`${url}?debug&tier=high`, { waitUntil: 'networkidle' });
          // 'none' preset'te (derin sayfalar M7'ye kadar) sahne boot etmez: STAGE_IDLE kapısından sonra da faz poster
          // kalır ve Taş yoktur
          await page.waitForFunction(() => {
            const nav = performance.getEntriesByType(
              'navigation',
            )[0] as PerformanceNavigationTiming;
            return nav.loadEventEnd > 0 && performance.now() > nav.loadEventEnd + 4000;
          });
          const booted = await page.evaluate(
            () => document.getElementById('scene-layer')?.dataset.phase !== 'poster',
          );
          const phase = booted
            ? await waitForStagePhase(page, ['ready', 'fallback'], 30_000)
            : 'poster';
          if (phase !== 'ready') {
            checked += (await probe(page)).checked;
            await ctx.close();
            continue;
          }
          for (const p of await positions(page)) {
            await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), p.y);
            await settle(page);
            await waitForStoneStill(page);
            const r = await probe(page);
            checked += r.checked;
            expect
              .soft(r.failures, `${url} ${viewport.width}px ${colorScheme} ${p.chapter} y=${p.y}`)
              .toEqual([]);
          }
          await ctx.close();
        }
      }
      test
        .info()
        .annotations.push({ type: 'X8', description: `${url}: ${checked} öğe denetlendi` });
    });
  }
});
