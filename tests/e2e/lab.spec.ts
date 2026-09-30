// tests/e2e/lab.spec.ts — /lab/stage poster laboratuvarı (D-40, §5.16.2, §15.2.3).
// CI build'inde lab bayrağı yoktur: rota 404 döner. Çizim testleri yalnız yerelde, lab build'ine karşı koşar:
//   NEXT_PUBLIC_ENABLE_LAB=1 npm run build && NEXT_PUBLIC_ENABLE_LAB=1 npx playwright test tests/e2e/lab.spec.ts
import { KEYFRAME_KEYS } from '../../src/stage/keyframes';
import { expect, test } from './fixtures';

const LAB = process.env.NEXT_PUBLIC_ENABLE_LAB === '1';
const THEMES = ['light', 'dark'] as const;

test.describe('D-40 poster laboratuvarı', { tag: ['@desktop-chromium'] }, () => {
  test('D-40 lab bayrağı yokken /lab/stage 404 döner', async ({ request }) => {
    test.skip(LAB, 'lab build’inde rota açıktır');
    const res = await request.get('/lab/stage', { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });

  for (const key of KEYFRAME_KEYS) {
    for (const theme of THEMES) {
      test(`§5.19 /lab/stage ${key} ${theme} konsol hatasız çizilir`, async ({ page }) => {
        test.skip(!LAB, 'yalnız NEXT_PUBLIC_ENABLE_LAB=1 build’inde');
        await page.goto(`/lab/stage?key=${key}&theme=${theme}&size=800`);
        await expect(page.locator('#lab-canvas[data-ready]')).toBeAttached({ timeout: 60_000 });
        await expect(page.locator('#lab-canvas[data-error]')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
      });
    }
  }
});
