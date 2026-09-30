// tests/e2e/perf-budgets.spec.ts — yükleme sırası ve lazy chunk boyutları, tarayıcıda (§9.4.3).
// M4: PB-2 (motion) ve PB-5 (azaltılmış hareket). PB-1, PB-3, PB-4, PB-6, PB-7 stage ile M5'te eklenir.
// `next start` gzip'ler: encodedBodySize gzip boyutudur. Bekleme sayfa içinde yapılır (waitForTimeout YASAK).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Herhangi bir route'un HTML'inin başlangıçta yüklediği chunk'lar (yerel/CI build'i). Next <Link> görünüm alanı
 * prefetch'i başka route'ların chunk'larını load sonrasında ister; bunlar lazy (motion/stage) chunk değildir.
 * SPEC-SAPMA: §9.4.3 PB-5 — "load'dan sonra başlayan betik yok" bu route chunk'larını hariç tutar (BASE_URL ile
 * dosyalar okunamazsa filtre boştur ve kural olduğu gibi uygulanır).
 */
function routeChunks(): Set<string> {
  const dir = '.next/server/app';
  const out = new Set<string>();
  if (!existsSync(dir)) return out;
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.html'))
        for (const m of readFileSync(p, 'utf8').matchAll(/\/_next\/static\/chunks\/[\w.-]+\.js/g))
          out.add(m[0]);
    }
  };
  walk(dir);
  return out;
}

const KB = 1024;
const MOTION_BUDGET = 60 * KB;

/**
 * §9.4.3 çekirdek ölçüm. Pencereler birleşimdir: iki pencerede başlayan bir istek bir kez sayılır (motion ve lenis
 * pencereleri çoğunlukla örtüşür); `exclude` route chunk'larıdır (Link prefetch'i aynı boşlukta başlar).
 */
function measure(page: Page, exclude: ReadonlySet<string> = new Set()) {
  return page.evaluate(
    (skip) => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const at = (n: string) => performance.getEntriesByName(n, 'mark')[0]?.startTime;
      const js = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(
        (e) =>
          (e.initiatorType === 'script' || e.name.endsWith('.js')) &&
          !skip.includes(new URL(e.name).pathname),
      );
      const inside = (e: PerformanceResourceTiming, from: number | undefined) =>
        from !== undefined && e.startTime >= from && e.startTime < from + 100;
      const load = nav.loadEventStart;
      const mi = at('os:motion-import');
      const li = at('os:lenis-import');
      return {
        load,
        motion: js
          .filter((e) => inside(e, mi) || inside(e, li))
          .reduce((n, e) => n + e.encodedBodySize, 0),
        afterLoad: js.filter((e) => e.startTime >= load).map((e) => new URL(e.name).pathname),
        marks: { mi, li, ready: at('os:motion-ready'), probe: at('os:stage-probe') },
      };
    },
    [...exclude],
  );
}

/** load'dan ms sonrasına kadar sayfa içinde bekler */
async function afterLoad(page: Page, ms: number) {
  await page.waitForFunction(
    (wait) => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return nav.loadEventEnd > 0 && performance.now() >= nav.loadEventEnd + wait;
    },
    ms,
    { timeout: ms + 20_000 },
  );
}

test.describe('§9.4.3 PB-2 motion sırası ve boyutu', { tag: ['@desktop-chromium'] }, () => {
  test('PB-2 os:motion-import ≥ loadEventStart; motion + lenis penceresi ≤ 60 KB', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForFunction(
      () =>
        performance.getEntriesByName('os:motion-ready', 'mark').length > 0 &&
        performance.getEntriesByName('os:lenis-import', 'mark').length > 0,
      undefined,
      { timeout: 20_000 },
    );
    await afterLoad(page, 500); // pencere içindeki isteklerin tamamlanması
    const m = await measure(page, process.env.BASE_URL ? new Set() : routeChunks());
    expect(m.marks.mi, 'os:motion-import').toBeDefined();
    expect(m.marks.mi!).toBeGreaterThanOrEqual(m.load);
    expect(m.marks.li!).toBeGreaterThanOrEqual(m.marks.mi!);
    expect(m.motion, 'motion grubu (gzip)').toBeGreaterThan(0);
    expect(m.motion, 'motion grubu (gzip)').toBeLessThanOrEqual(MOTION_BUDGET);
  });
});

test.describe('§9.4.3 PB-5 azaltılmış hareket', { tag: ['@reduced-motion'] }, () => {
  test('PB-5 load + 4 s: motion/stage işareti yok, load sonrası betik yok, canvas yok', async ({
    page,
  }) => {
    await page.goto('/');
    await afterLoad(page, 4000);
    const m = await measure(page);
    expect(m.marks.mi, 'os:motion-import').toBeUndefined();
    expect(m.marks.probe, 'os:stage-probe').toBeUndefined();
    const routes = process.env.BASE_URL ? new Set<string>() : routeChunks();
    expect(
      m.afterLoad.filter((p) => !routes.has(p)),
      'load sonrası betikler',
    ).toEqual([]);
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});
