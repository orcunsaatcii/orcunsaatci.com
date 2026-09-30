// tests/e2e/perf-smoke.spec.ts — performans duman testleri (§9.1 P3, P5, P8; D-33, D-34, K-GEN-6, §13.3.4): tam
// kaydırmada CLS, LCP öğesi, load anında .motion-ready yokluğu ve etkileşim süreleri. Production'a karşı da koşar
// (BASE_URL, §14.7). Bekleme sayfa içinde yapılır (waitForTimeout YASAK).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const CLS_BUDGET = 0.05; // P5
const EVENT_BUDGET_MS = 100; // P8

type Probe = {
  __cls: number;
  __lcp: string | null;
  __motionReadyAtLoad: boolean | null;
  __events: { name: string; duration: number; interactionId: number }[];
};

/** init betiği: girdisiz layout-shift toplamı, son LCP öğesi, load anında .motion-ready, event girdileri */
const observe = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as Probe;
    w.__cls = 0;
    w.__lcp = null;
    w.__motionReadyAtLoad = null;
    w.__events = [];
    type Shift = PerformanceEntry & { value: number; hadRecentInput: boolean };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Shift[]) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1) as
        (PerformanceEntry & { element?: Element }) | undefined;
      if (last?.element) w.__lcp = last.element.tagName;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    type EventEntry = PerformanceEntry & { interactionId?: number };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as EventEntry[])
        w.__events.push({
          name: e.name,
          duration: e.duration,
          interactionId: e.interactionId ?? 0,
        });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
    window.addEventListener('load', () => {
      w.__motionReadyAtLoad = document.documentElement.classList.contains('motion-ready');
    });
  });

const probe = <K extends keyof Probe>(page: Page, key: K) =>
  page.evaluate((k) => (window as unknown as Probe)[k], key) as Promise<Probe[K]>;

/** 5 svh / 100 ms ile en üstten en alta ve geri (P5) */
const fullScroll = (page: Page) =>
  page.evaluate(async () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const step = 0.05 * window.innerHeight;
    const run = async (from: number, to: number) => {
      const dir = to >= from ? 1 : -1;
      for (let y = from; dir > 0 ? y < to : y > to; y += dir * step) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      window.scrollTo({ top: to, behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 300));
    };
    await run(0, max);
    await run(max, 0);
  });

test.describe('§9.1 performans duman testleri', { tag: ['@desktop-chromium'] }, () => {
  for (const url of ['/', '/?tier=medium']) {
    test(`P5 ${url}: betikli tam kaydırma dahil CLS ≤ 0.05`, async ({ page }) => {
      test.setTimeout(150_000);
      await observe(page);
      await page.goto(url, { waitUntil: 'networkidle' });
      await fullScroll(page);
      expect(await probe(page, '__cls')).toBeLessThanOrEqual(CLS_BUDGET);
    });
  }

  test('P3 /: son LCP öğesi H1; K-GEN-6 load anında .motion-ready yok', async ({ page }) => {
    await observe(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
    // LCP girdileri ilk etkileşime kadar yayımlanır: etkileşim yapılmadan okunur
    expect(await probe(page, '__lcp')).toBe('H1');
    expect(await probe(page, '__motionReadyAtLoad')).toBe(false);
  });

  // ?tier=static: SwiftShader'ın CPU'da çizdiği WebGL karesi gerçek GPU maliyetini temsil etmez; CI'da doğal yol da
  // sahnesiz ölçer (V-41). Stage kare maliyeti gerçek cihazda izlenir (§9.6).
  test('P8 menü, Kopyala, tema, MotionToggle ve filtre etkileşimleri ≤ 100 ms (4× CPU kısıtı)', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await observe(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    /** Sayfa durulduktan sonra bir etkileşimin (interactionId > 0: INP olayları) en uzun event süresi */
    const measure = async (act: () => Promise<void>) => {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            // uzun görev kalmayana dek: art arda iki boşta geri çağrısı
            const idle = (n: number) =>
              requestIdleCallback(() => (n > 1 ? resolve() : idle(n + 1)), { timeout: 3000 });
            idle(0);
          }),
      );
      await page.evaluate(() => {
        (window as unknown as Probe).__events = [];
      });
      await act();
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 200))),
          ),
      );
      const events = (await probe(page, '__events')).filter((e) => e.interactionId > 0);
      return Math.max(0, ...events.map((e) => e.duration));
    };
    /** Aynı etkileşim birkaç kez ölçülür; paralel işçilerin CPU gürültüsüne karşı medyan bütçeyle karşılaştırılır */
    const median = async (label: string, acts: (() => Promise<void>)[]) => {
      const d: number[] = [];
      for (const act of acts) d.push(await measure(act));
      const sorted = [...d].sort((a, b) => a - b);
      const mid = sorted[Math.floor(sorted.length / 2)]!;
      expect.soft(mid, `${label}: ${d.join(', ')} ms`).toBeLessThanOrEqual(EVENT_BUDGET_MS);
    };

    await page.goto('/?tier=static', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
    const contact = page.locator('[data-chapter="contact"]');
    await contact.scrollIntoViewIfNeeded();
    const copy = () =>
      contact
        .getByRole('button', { name: /kopyala/i })
        .first()
        .click();
    await median('Kopyala', [copy, copy, copy]);
    const theme = (name: string) => () =>
      page.locator('label', { hasText: name }).locator('visible=true').first().click();
    await median('tema', [theme('Koyu'), theme('Açık'), theme('Koyu'), theme('Açık')]);
    const motion = () => contact.locator('button[aria-pressed]').last().click();
    await median('MotionToggle', [motion, motion, motion, motion]);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?tier=static', { waitUntil: 'networkidle' });
    const open = () => page.getByRole('button', { name: 'Menüyü aç' }).click();
    const close = () => page.getByRole('button', { name: 'Menüyü kapat' }).click();
    await median('menü', [open, close, open, close]);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/projeler', { waitUntil: 'networkidle' });
    const chips = page.getByRole('group', { name: 'Alana göre filtrele' }).getByRole('button');
    const chip = (k: number) => () => chips.nth(k).click();
    await median('filtre', [chip(1), chip(0), chip(1), chip(0)]);
  });
});
