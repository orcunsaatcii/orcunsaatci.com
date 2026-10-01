// tests/e2e/helpers/scroll.ts — scroll helpers measured in svh (§13.3.2)
import type { Page } from '@playwright/test';

/** Scrolls instantly to s svh (s × innerHeight / 100), then waits until everything settles. */
export async function scrollToSvh(page: Page, s: number): Promise<void> {
  await page.evaluate((svh) => {
    window.scrollTo({ top: (svh * window.innerHeight) / 100, behavior: 'instant' });
  }, s);
  await settle(page);
}

/** Waits until scrollY (and the debug stage values, if present) stop changing for quietMs and at least 3 frames. */
export async function settle(page: Page, quietMs = 300): Promise<void> {
  await page.waitForFunction(
    (quiet) =>
      new Promise<boolean>((resolve) => {
        const read = () => {
          const stage = (window as unknown as { __stage?: { target: unknown } }).__stage;
          // GSAP tween'leri hedefe döngüsel `_gsap` alanı ekler: iç alanlar atlanır
          return JSON.stringify([window.scrollY, stage ? stage.target : null], (k, v: unknown) =>
            k.startsWith('_') ? undefined : v,
          );
        };
        let last = read();
        let since = performance.now();
        // unchanged frames: at a slow frame rate (CI SwiftShader ≈ 2 fps) a running tween can stay still between two
        // frames for longer than quietMs, so at least 3 unchanged frames are also required
        let still = 0;
        const tick = () => {
          const now = read();
          if (now !== last) {
            last = now;
            since = performance.now();
            still = 0;
          } else still++;
          if (performance.now() - since >= quiet && still >= 3) resolve(true);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    quietMs,
  );
}

/**
 * Scrolls from `from` to `to` svh in 1 svh steps every 100 ms (10 svh/s, reading speed).
 * The pacing runs inside the page: page.waitForTimeout is forbidden (§13.1.1 #6).
 */
export async function readingScroll(page: Page, from: number, to: number): Promise<void> {
  await page.evaluate(
    async ({ start, end }) => {
      const step = start <= end ? 1 : -1;
      for (let s = start; step > 0 ? s <= end : s >= end; s += step) {
        window.scrollTo({ top: (s * window.innerHeight) / 100, behavior: 'instant' });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    },
    { start: from, end: to },
  );
}
