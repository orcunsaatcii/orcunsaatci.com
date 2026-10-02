// tests/e2e/no-webgl.spec.ts — WebGL yok (--disable-webgl): static kademe, statik KOD panelleri ve 3D'siz DOM
// koreografisi (K-VAR-4, K-VAR-7, K-KOD-3, §13.3.4). Konsol hatası yokluğu (K-VAR-7) fikstürde denetlenir.
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
    test(`K-VAR-7 ${url}: fallback, static, canvas yok; statik paneller görünür`, async ({
      page,
    }) => {
      await page.goto(url);
      await waitForStagePhase(page, ['fallback']);
      const layer = page.locator('#scene-layer');
      await expect(layer).toHaveAttribute('data-tier', 'static');
      await expect(page.locator('canvas')).toHaveCount(0);
      const panel = page.locator('[data-stage-anchor="hero-rest"] .kod-panel');
      await expect(panel).toBeVisible();
      await expect(panel).toHaveCSS('opacity', '1');
      await expect(panel).toHaveAttribute('data-kod-program', 'hero');
    });
  }

  test('K-VAR-4 areas pini çalışır; statik panel etkin adımı izler; work silmeleri oynar', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForStagePhase(page, ['fallback']);
    // T ölçülür: gerçek about metni 140 svh'yi aşabilir
    const T = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-chapter="areas"]')!;
      return ((el.getBoundingClientRect().top + window.scrollY) / window.innerHeight) * 100;
    });
    const state = () =>
      page.evaluate(() => ({
        panel:
          document
            .querySelector('.areas-dial .kod-panel[data-active]')
            ?.getAttribute('data-kod-step') ?? null,
        desc:
          document.querySelector('[data-area-desc][data-active]')?.getAttribute('data-area-desc') ??
          null,
        visible: [...document.querySelectorAll('.areas-dial .kod-panel')].filter(
          (p) => getComputedStyle(p).visibility !== 'hidden',
        ).length,
      }));
    const seen = new Set<string>();
    for (let s = T + 40; s <= T + 200; s += 20) {
      await scrollToSvh(page, s);
      const st = await state();
      if (!(await page.locator('[data-areas-pinned]').count())) continue;
      expect.soft(st.panel, `s = ${Math.round(s)}: panel ↔ açıklama`).toBe(st.desc);
      expect.soft(st.visible, `s = ${Math.round(s)}: tek görünür panel`).toBe(1);
      if (st.panel) seen.add(st.panel);
    }
    expect(seen.size, 'panel adımla değişir').toBeGreaterThanOrEqual(2);
    // work: figür 2 makale 1'de kapalı, makale 2'de açık (SectionWipe clip-path'i)
    await scrollToArticle(page, 0);
    const shut = await clipOf(page, 1);
    await scrollToArticle(page, 1);
    await expect.poll(() => clipOf(page, 1)).not.toBe(shut);
  });
});
