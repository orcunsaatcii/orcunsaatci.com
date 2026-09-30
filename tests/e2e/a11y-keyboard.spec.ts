// tests/e2e/a11y-keyboard.spec.ts — klavye (§10.3, §10.6). İlk Tab SkipLink; route sonrası odak h1; çapa sonrası
// sıralı odak bölümde; filtre aria-pressed + durum metni; ana sayfada 200 Tab boyunca tuzak ve görünmez durak yok.
// Menü tuzağı + Esc mobile.spec.ts'te; çapa sonrası h2 odağı scrollToChapter ile (M4), areas atlama/adım düğmeleri
// pin'le birlikte M4'te eklenir.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const tabKey = (page: Page) =>
  page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab';

test.describe('§10.3 klavye', { tag: ['@desktop-chromium', '@pixel-7', '@iphone-15'] }, () => {
  test('ilk Tab SkipLink; Enter odağı #main’e taşır', async ({ page }) => {
    await page.goto('/hakkimda', { waitUntil: 'networkidle' });
    await page.keyboard.press(tabKey(page));
    const skip = page.locator('a[href="#main"]').first();
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('client navigasyonundan sonra odak yeni sayfanın h1’inde', async ({ page }) => {
    await page.goto('/projeler', { waitUntil: 'networkidle' });
    const first = page.locator('main li[data-project] a').first();
    const href = await first.getAttribute('href');
    await first.click();
    await expect(page).toHaveURL((url) => url.pathname === href);
    await expect(page.locator('main h1')).toBeFocused();
  });

  test('filtre: aria-pressed ve role="status" metni değişir, URL paylaşılabilir', async ({
    page,
  }) => {
    await page.goto('/projeler', { waitUntil: 'networkidle' });
    const chips = page.locator('[role="group"] button');
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
    const status = page.getByRole('status').first();
    const before = await status.textContent();
    await chips.nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/\?alan=/);
    const after = await status.textContent();
    expect(after).not.toBeNull();
    if (before === after) expect(await page.locator('li[data-project][hidden]').count()).toBe(0);
    else expect(await page.locator('li[data-project][hidden]').count()).toBeGreaterThan(0);
  });
});

test.describe('§10.3 klavye: ana sayfa', { tag: ['@desktop-chromium'] }, () => {
  test('çapa sonrası sıralı odak hedef bölümden başlar', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator('body > header nav a[href="#yolculuk"]').click();
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(
      () => !!document.activeElement?.closest('#yolculuk, #yolculuk ~ *'),
    );
    expect(inside).toBe(true);
  });

  test('200 Tab: görünmez durak yok, tuzak yok (döngü SkipLink’e ya da body’ye döner)', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    let wrapped = false;
    for (let i = 0; i < 200; i++) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return { body: true, invisible: null, skip: false };
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const invisible =
          (r.width === 0 && r.height === 0) ||
          cs.visibility === 'hidden' ||
          Number(cs.opacity) === 0
            ? `${el.tagName} ${el.textContent?.trim().slice(0, 30)}`
            : null;
        return { body: false, invisible, skip: el.getAttribute('href') === '#main' };
      });
      expect.soft(stop.invisible, `durak ${i}`).toBeNull();
      if (i > 0 && (stop.body || stop.skip)) {
        wrapped = true;
        break;
      }
    }
    expect(wrapped, 'odak döngüsü başa döner').toBe(true);
  });
});
