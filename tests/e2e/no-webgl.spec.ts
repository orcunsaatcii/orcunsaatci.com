// tests/e2e/no-webgl.spec.ts — WebGL yok (--disable-webgl): static kademe, posterler ve 3D'siz DOM koreografisi
// (K-VAR-4, K-VAR-7, §13.3.4). Konsol hatası yokluğu (K-VAR-7) fikstürde denetlenir.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { scrollToSvh, settle } from './helpers/scroll';
import { waitForStagePhase } from './helpers/stage';

/** Makale k'nın üstü görünüm alanının %10'unda (work-viewer.spec.ts ile aynı konum) */
async function scrollToArticle(page: Page, k: number) {
  await page.evaluate((i) => {
    const a = document.querySelectorAll('[data-chapter="work"] article[data-work-article]')[i]!;
    window.scrollTo({
      top: a.getBoundingClientRect().top + window.scrollY - 0.1 * window.innerHeight,
      behavior: 'instant',
    });
  }, k);
  await settle(page);
}

const clipOf = (page: Page, k: number) =>
  page.evaluate(
    (i) => getComputedStyle(document.querySelectorAll('[data-work-figure]')[i]!).clipPath,
    k,
  );

test.describe('WebGL yok: static kademe', { tag: ['@no-webgl'] }, () => {
  for (const url of ['/', '/?tier=high']) {
    test(`K-VAR-7 ${url}: fallback, static, canvas yok; posterler görünür`, async ({ page }) => {
      await page.goto(url);
      await waitForStagePhase(page, ['fallback']);
      const layer = page.locator('#scene-layer');
      await expect(layer).toHaveAttribute('data-tier', 'static');
      await expect(page.locator('canvas')).toHaveCount(0);
      const poster = page
        .locator('[data-stage-anchor="hero-rest"] .stage-poster')
        .locator('visible=true');
      await expect(poster).toHaveCount(1);
      await expect(poster).toHaveCSS('opacity', '1');
      await expect(poster.locator('img')).toHaveJSProperty('complete', true);
    });
  }

  test('K-VAR-4 areas pini DialFigure ile döner (s 300 → 320); work silmeleri oynar', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForStagePhase(page, ['fallback']);
    const rotor = () =>
      page.evaluate(
        () => getComputedStyle(document.querySelector('.areas-dial [data-dial-rotor]')!).transform,
      );
    await scrollToSvh(page, 300);
    await expect(page.locator('[data-areas-pinned]')).toHaveCount(1);
    await expect(page.locator('.areas-dial [data-dial-figure]')).toBeVisible();
    const before = await rotor();
    await scrollToSvh(page, 320);
    expect(await rotor(), 'kadran rotY track’iyle döner').not.toBe(before);
    // work: figür 2 makale 1'de kapalı, makale 2'de açık (SectionWipe clip-path'i)
    await scrollToArticle(page, 0);
    const shut = await clipOf(page, 1);
    await scrollToArticle(page, 1);
    await expect.poll(() => clipOf(page, 1)).not.toBe(shut);
  });
});
