// tests/e2e/perf-budgets.spec.ts — yükleme sırası ve lazy chunk boyutları, tarayıcıda (§9.4.3): PB-1 ilk JS, PB-2
// motion, PB-3 stage, PB-4 tam boot, PB-5 azaltılmış hareket, PB-6 static kademe, PB-7 WebGL yok; §9.7 işaret sırası.
// `next start` gzip'ler: encodedBodySize gzip boyutudur. Bekleme sayfa içinde yapılır (waitForTimeout YASAK).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Herhangi bir route'un HTML'inin başlangıçta yüklediği chunk'lar (yerel/CI build'i). Next <Link> görünüm alanı
 * prefetch'i başka route'ların chunk'larını load sonrasında ister; bunlar lazy (motion/stage) chunk değildir.
 * SPEC-SAPMA: §9.4.3 PB-5, PB-6, PB-7 — "load'dan / os:stage-tier'dan sonra başlayan betik yok" bu route
 * chunk'larını hariç tutar (BASE_URL ile dosyalar okunamazsa filtre boştur ve kural olduğu gibi uygulanır).
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
const STAGE_BUDGET = 300 * KB;
const FULL_BOOT_BUDGET = 550 * KB;
/** check-budgets.mjs ile aynı: yerel/CI build'inde analitik betikleri yoktur (D-44, §9.4.2) */
const ANALYTICS_RESERVE = 5 * KB;
const INITIAL_JS_BUDGET = process.env.BASE_URL ? 175 * KB : 175 * KB - ANALYTICS_RESERVE;

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

/** Stage ölçümü (PB-1, PB-3, PB-4, PB-6): pencereler §9.4.3 çekirdeğiyle aynı; `exclude` route chunk'larıdır */
function measureStage(page: Page, exclude: ReadonlySet<string> = new Set()) {
  return page.evaluate(
    (skip) => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const at = (n: string) => performance.getEntriesByName(n, 'mark')[0]?.startTime;
      const js = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(
        (e) => e.initiatorType === 'script' || e.name.endsWith('.js'),
      );
      const size = (list: PerformanceResourceTiming[]) =>
        list.reduce((n, e) => n + e.encodedBodySize, 0);
      const load = nav.loadEventStart;
      const si = at('os:stage-import');
      const ready = at('os:stage-ready');
      const tier = at('os:stage-tier');
      const path = (e: PerformanceResourceTiming) => new URL(e.name).pathname;
      return {
        load,
        beforeLoad: size(js.filter((e) => e.startTime < load)),
        stage:
          si === undefined
            ? 0
            : size(js.filter((e) => e.startTime >= si && e.startTime < si + 100)),
        /** V-44: pencereden sonra başlayan betikler (içerik testte denetlenir) */
        lateAfterImport:
          si === undefined ? [] : js.filter((e) => e.startTime >= si + 100).map((e) => e.name),
        totalAtReady: ready === undefined ? 0 : size(js.filter((e) => e.startTime <= ready)),
        afterTier:
          tier === undefined
            ? []
            : js.filter((e) => e.startTime >= tier && !skip.includes(path(e))).map(path),
        marks: {
          hydrated: at('os:hydrated'),
          mi: at('os:motion-import'),
          li: at('os:lenis-import'),
          motionReady: at('os:motion-ready'),
          probe: at('os:stage-probe'),
          tier,
          si,
          compiled: at('os:stage-compiled'),
          ready,
        },
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

test.describe('§9.4.3 PB-1 ilk JS', { tag: ['@desktop-chromium'] }, () => {
  for (const url of ['/', '/projeler', '/en']) {
    test(`PB-1 ${url}: load'dan önce başlayan betikler ≤ 175 KB − ANALYTICS_RESERVE (production'da 175 KB)`, async ({
      page,
    }) => {
      await page.goto(url);
      await afterLoad(page, 0);
      const m = await measureStage(page);
      expect(m.beforeLoad, 'ilk JS (gzip)').toBeGreaterThan(0);
      expect(m.beforeLoad, 'ilk JS (gzip)').toBeLessThanOrEqual(INITIAL_JS_BUDGET);
    });
  }
});

test.describe(
  '§9.4.3 PB-3, PB-4 stage sırası, boyutu ve tam boot',
  { tag: ['@desktop-chromium'] },
  () => {
    test('PB-3 os:stage-probe ≥ load + 1000; stage penceresi ≤ 300 KB; ready 20 s içinde (V-44); PB-4 ready anında toplam ≤ 550 KB; §9.7 işaret sırası', async ({
      page,
    }) => {
      await page.goto('/?tier=medium');
      await page.waitForFunction(
        () => performance.getEntriesByName('os:stage-ready', 'mark').length > 0,
        undefined,
        { timeout: 20_000 },
      );
      const m = await measureStage(page);
      expect(m.marks.probe, 'os:stage-probe').toBeDefined();
      expect(m.marks.probe!, 'load + 1 s + idle').toBeGreaterThanOrEqual(m.load + 1000);
      expect(m.stage, 'stage grubu (gzip)').toBeGreaterThan(0);
      expect(m.stage, 'stage grubu (gzip)').toBeLessThanOrEqual(STAGE_BUDGET);
      // V-44: three/R3F'nin bütün chunk'ları [os:stage-import, +100 ms] penceresinde başlar
      for (const url of m.lateAfterImport) {
        const body = await (await page.request.get(url)).text();
        expect
          .soft(body.includes('WebGLRenderer'), `pencere dışında three chunk'ı: ${url}`)
          .toBe(false);
      }
      expect(m.totalAtReady, 'PB-4 tam boot (gzip)').toBeLessThanOrEqual(FULL_BOOT_BUDGET);
      // §9.7: 9 işaret doğru sırada; motion → yoklama → stage (§9.2.4 kural 2)
      const k = m.marks;
      const order = [k.hydrated, k.mi, k.probe, k.tier, k.si, k.compiled, k.ready];
      expect(
        order.every((v) => v !== undefined),
        JSON.stringify(k),
      ).toBe(true);
      for (let i = 1; i < order.length; i++)
        expect(order[i]!, `sıra ${i}: ${JSON.stringify(k)}`).toBeGreaterThanOrEqual(order[i - 1]!);
      expect(k.li!).toBeGreaterThanOrEqual(k.mi!);
      expect(k.motionReady!).toBeGreaterThanOrEqual(k.mi!);
      expect(k.mi!, 'lazy chunk load öncesi istenmez').toBeGreaterThanOrEqual(m.load);
    });
  },
);

/** PB-6/PB-7: tier işareti var, stage import yok; tier'dan sonra (route chunk'ları hariç) betik başlamaz */
async function expectStatic(page: Page) {
  await page.waitForFunction(
    () => performance.getEntriesByName('os:stage-tier', 'mark').length > 0,
    undefined,
    { timeout: 20_000 },
  );
  await afterLoad(page, 3000); // tier'dan sonra olası geç istekler için pay
  const m = await measureStage(page, process.env.BASE_URL ? new Set() : routeChunks());
  expect(m.marks.tier, 'os:stage-tier').toBeDefined();
  expect(m.marks.si, 'os:stage-import').toBeUndefined();
  expect(m.afterTier, 'os:stage-tier sonrası betikler').toEqual([]);
  await expect(page.locator('canvas')).toHaveCount(0);
}

test.describe('§9.4.3 PB-6 static kademe', { tag: ['@desktop-chromium'] }, () => {
  test('PB-6 ?tier=static: os:stage-tier var, os:stage-import yok; sonrasında betik yok', async ({
    page,
  }) => {
    await page.goto('/?tier=static');
    await expectStatic(page);
  });
});

test.describe('§9.4.3 PB-7 WebGL yok', { tag: ['@no-webgl'] }, () => {
  test('PB-7 /: PB-6 ile aynı; konsol hatası yok', async ({ page }) => {
    await page.goto('/');
    await expectStatic(page);
  });
});
