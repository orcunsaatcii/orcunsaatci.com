// tests/e2e/fixtures.ts — tüm spec'ler '@playwright/test' yerine buradan import eder
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use, testInfo) => {
      const problems: string[] = [];
      page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
      });
      await use();
      const allowed = testInfo.annotations
        .filter((a) => a.type === 'allow-console' && a.description !== undefined)
        .map((a) => new RegExp(a.description as string));
      expect(
        problems.filter((p) => !allowed.some((r) => r.test(p))),
        'konsol hataları',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Beklenen tek bir konsol hatasına izin verir (ör. 404 kaynağı). Gerekçe çağrının üstüne yorum olarak yazılır. */
export function allowConsole(pattern: string): void {
  test.info().annotations.push({ type: 'allow-console', description: pattern });
}
