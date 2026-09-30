// tests/e2e/motion-preferences.spec.ts — hareket tercihleri ve duraklatma (§10.2.4, §13.3.4; K-VAR-1/2/5).
// Ağ tarafı (motion chunk istenmez) PB-5'tedir (perf-budgets.spec.ts). Canlı canvas M5'te; burada canvas yoktur.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Motion runtime kuruldu ve reveal'lar hazır (load + boşluk) */
const motionReady = (page: Page) =>
  page.waitForFunction(
    () => document.documentElement.classList.contains('motion-ready'),
    undefined,
    {
      timeout: 20_000,
    },
  );

/** Bütün [data-reveal] öğelerinin hesaplanmış opaklığı 1 mi (display: none olanlar hariç) */
const hiddenReveals = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-reveal]')]
      .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).opacity !== '1')
      .map((el) => `${el.tagName} ${el.textContent?.trim().slice(0, 30)}`),
  );

test.describe('§10.2.4 azaltılmış hareket', { tag: ['@reduced-motion'] }, () => {
  test('K-VAR-1 data-motion=reduce: Lenis, .motion-ready ve canvas yok; reveal’lar opak; kadran etiketli', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-motion', 'reduce');
    await expect(html).not.toHaveClass(/\blenis\b/);
    await expect(html).not.toHaveClass(/motion-ready/);
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await hiddenReveals(page)).toEqual([]);
    expect(
      await page.evaluate(() => performance.getEntriesByName('os:motion-import', 'mark').length),
    ).toBe(0);
    // DialFigure role="img" ve aria-label tüm alan başlıklarını içerir (§4.8.9)
    const dial = page.locator('[data-chapter="areas"] svg[role="img"]');
    await expect(dial).toHaveCount(1);
    const label = (await dial.getAttribute('aria-label')) ?? '';
    const titles = await page.locator('[data-chapter="areas"] .area-name').allTextContents();
    expect(titles.length).toBeGreaterThanOrEqual(3);
    for (const title of titles) expect.soft(label).toContain(title.trim());
  });
});

test.describe('§10.2.4 MotionToggle ve PauseButton', { tag: ['@desktop-chromium'] }, () => {
  test('K-VAR-5 anahtar: os-motion yazılır, ≤ 1 s azaltılmış görünüm, bölüm korunur; geri alınır', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await motionReady(page);
    // görüntü alanının üstünde about (yüksekliği değişen areas'ın üstünde) varken
    await page.evaluate(() => {
      const about = document.querySelector<HTMLElement>('[data-chapter="about"]')!;
      window.scrollTo({ top: about.offsetTop + 40, behavior: 'instant' });
    });
    await page.waitForFunction(() => document.documentElement.classList.contains('lenis'));
    const topChapter = () =>
      page.evaluate(() => {
        const header = document.querySelector('body > header')!.getBoundingClientRect().bottom;
        return [...document.querySelectorAll<HTMLElement>('#main [data-chapter]')].find((c) => {
          const r = c.getBoundingClientRect();
          return r.top <= header + 1 && r.bottom > header + 1;
        })?.dataset.chapter;
      });
    const chapterBefore = await topChapter();
    const yBefore = await page.evaluate(() => window.scrollY);

    // ana sayfada görünür anahtar contact bölümündeki compact footer'dadır (§3.9.3)
    const toggle = page
      .locator('[data-chapter="contact"] footer')
      .getByRole('button', { name: 'Hareketi azalt' });
    await toggle.first().evaluate((b: HTMLButtonElement) => b.click()); // kaydırmadan tıkla
    await expect(toggle.first()).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('os-motion'))).toBe('reduce');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce', { timeout: 1000 });
    await expect(page.locator('html')).not.toHaveClass(/\blenis\b/, { timeout: 1000 });
    await expect(page.locator('html')).not.toHaveClass(/motion-ready/, { timeout: 1000 });
    expect(await hiddenReveals(page)).toEqual([]);
    expect(await topChapter()).toBe(chapterBefore);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - yBefore)).toBeLessThanOrEqual(2);
    expect(
      await page.evaluate(() => document.querySelectorAll('[style*="translate"]').length),
      'satır içi translate kalmaz (§5.19)',
    ).toBe(0);

    await toggle.first().evaluate((b: HTMLButtonElement) => b.click());
    await expect(toggle.first()).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await motionReady(page);
    expect(await topChapter()).toBe(chapterBefore);
    // görünen içerik yeniden gizlenmez
    const visibleHidden = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-reveal]')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight && getComputedStyle(el).opacity !== '1';
        })
        .map((el) => el.textContent?.trim().slice(0, 30)),
    );
    expect(visibleHidden).toEqual([]);
  });

  test('K-VAR-2 PauseButton: etiket değişir, aria-pressed yok, yerel saat 61 s değişmez', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-09-30T14:32:10+03:00') });
    await page.goto('/', { waitUntil: 'networkidle' });
    const pause = page.getByRole('button', { name: 'Animasyonu durdur' });
    await expect(pause).toBeVisible();
    const box = await pause.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await pause.click();
    const play = page.getByRole('button', { name: 'Animasyonu başlat' });
    await expect(play).toBeVisible();
    await expect(play).not.toHaveAttribute('aria-pressed', /.*/);
    const time = page.locator('[data-chapter="hero"] [data-live-time] time');
    await expect(time).not.toHaveText('');
    const before = await time.textContent();
    await page.clock.fastForward(61_000);
    await expect(time).toHaveText(before ?? '');
    await play.click();
    await expect(page.getByRole('button', { name: 'Animasyonu durdur' })).toBeVisible();
    await page.clock.fastForward(61_000);
    await expect(time).not.toHaveText(before ?? '');
  });

  test('oturum ortasında OS tercihi (kayıt yok) ≤ 1 s azaltılmış görünüm', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await motionReady(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce', { timeout: 1000 });
    await expect(page.locator('html')).not.toHaveClass(/motion-ready/, { timeout: 1000 });
    expect(await hiddenReveals(page)).toEqual([]);
    await expect(page.getByRole('button', { name: 'Animasyonu durdur' })).toHaveCount(0);
  });
});
