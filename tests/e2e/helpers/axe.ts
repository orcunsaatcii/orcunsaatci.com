// tests/e2e/helpers/axe.ts
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Sonlu CSS/WAAPI animasyonları (ör. hero-in girişi) bitene kadar bekler: kontrast ara karede ölçülmez. */
export async function waitForAnimations(page: Page): Promise<void> {
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
