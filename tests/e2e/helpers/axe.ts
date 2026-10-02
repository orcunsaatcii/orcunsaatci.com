// tests/e2e/helpers/axe.ts
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Önce MotionRoot'un reveal kurulumunu (load + boşluk → `.motion-ready`), sonra sonlu CSS/WAAPI animasyonlarını (ör.
 * hero-in girişi) bekler: kontrast ara karede ölçülmez. Kurulum axe koşusunun ortasına denk gelirse kurulan öğelerin
 * opaklık geçişi ara renk ölçtürüyordu (paralel işçilerde `/`: 70 color-contrast). `global-not-found` MotionRoot
 * taşımaz; JS'siz ve azaltılmış harekette `data-motion` "full" değildir.
 */
export async function waitForAnimations(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const html = document.documentElement;
      return (
        html.dataset.motion !== 'full' ||
        html.classList.contains('motion-ready') ||
        document.querySelector('[data-404="global"]') !== null
      );
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

export async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
  await waitForAnimations(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude('#scene-layer')
    // KOD statik panelleri sahnenin poster karşılığıdır: dekoratif (aria-hidden), asıl metin sayfadadır (§4 KOD)
    .exclude('.kod-panel')
    .analyze();
  if (violations.length > 0) {
    await test.info().attach(`axe-${label}.json`, {
      body: JSON.stringify(violations, null, 2),
      contentType: 'application/json',
    });
  }
  expect(
    violations.map((v) => `${v.id} (${v.nodes.length})`),
    `axe: ${label}`,
  ).toEqual([]);
}
