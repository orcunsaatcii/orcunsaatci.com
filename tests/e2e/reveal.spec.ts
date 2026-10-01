// tests/e2e/reveal.spec.ts — hareket sisteminin kabul maddeleri (§4.18 K-GEN-2/6/7/8, K-AREAS-3/12; §5.19 "Scroll ve
// reveal"). Beklenen değerler DOM sayımlarından hesaplanır (§13.1.1 #4). Bekleme sayfa içindedir.
import type { Page } from '@playwright/test';
import { allowConsole, expect, test } from './fixtures';

const motionReady = (page: Page) =>
  page.waitForFunction(
    () => document.documentElement.classList.contains('motion-ready'),
    undefined,
    {
      timeout: 20_000,
    },
  );

test.describe('§5.19 scroll ve reveal', { tag: ['@desktop-chromium'] }, () => {
  test('K-GEN-2 bölüm yükseklikleri §4.5.2 formülleriyle (svh, en az; ±1)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const r = await page.evaluate(() => {
      const vh = window.innerHeight;
      const h = (id: string) =>
        (document.querySelector<HTMLElement>(`[data-chapter="${id}"]`)!.offsetHeight / vh) * 100;
      return {
        N: Number(document.querySelector<HTMLElement>('[data-chapter="areas"]')!.dataset.areasN),
        P: document.querySelectorAll('[data-work-article]').length,
        E: document.querySelectorAll('[data-journey-entry]').length,
        hero: h('hero'),
        about: h('about'),
        areas: h('areas'),
        work: h('work'),
        journey: h('journey'),
        contact: h('contact'),
      };
    });
    expect(r.hero).toBeCloseTo(100, 0);
    // §4.5.2: formüller yalnız min-height'tır; gerçek içerik daha uzunsa bölüm uzar (sahibin about metni 140 svh'yi aşar)
    expect(r.about).toBeGreaterThanOrEqual(140 - 1);
    expect(r.areas).toBeGreaterThanOrEqual(120 + 50 * r.N - 1);
    expect(r.work).toBeGreaterThanOrEqual(50 + 70 * r.P - 1);
    expect(r.journey).toBeGreaterThanOrEqual(70 + 35 * r.E - 1);
    expect(Math.abs(r.contact - 100)).toBeLessThanOrEqual(1);
  });

  test('K-GEN-6 .motion-ready load’dan önce yok; eklendiği anda görünen metin sönmez', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __atLoad?: boolean; __dimmed?: string[] };
      window.addEventListener('load', () => {
        w.__atLoad = document.documentElement.classList.contains('motion-ready');
      });
      // init betiği <html> oluşmadan çalışır: belge gözlenir, yalnız <html> sınıf değişimi dikkate alınır
      new MutationObserver(() => {
        const html = document.documentElement;
        if (!html?.classList.contains('motion-ready') || w.__dimmed) return;
        w.__dimmed = [...document.querySelectorAll<HTMLElement>('[data-reveal]')]
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.bottom > 0 && b.top < window.innerHeight && b.height > 0;
          })
          .filter((el) => getComputedStyle(el).opacity !== '1')
          .map((el) => el.textContent?.trim().slice(0, 30) ?? el.tagName);
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ['class'] });
    });
    await page.goto('/');
    await motionReady(page);
    const r = await page.evaluate(() => {
      const w = window as unknown as { __atLoad?: boolean; __dimmed?: string[] };
      return { atLoad: w.__atLoad, dimmed: w.__dimmed };
    });
    expect(r.atLoad).toBe(false);
    expect(r.dimmed).toEqual([]);
  });

  test('K-GEN-7 /#iletisim: H2 ve e-posta opak; K-GEN-8 kurulumdan 3 s sonra görünümde açılmamış öğe yok', async ({
    page,
  }) => {
    await page.goto('/#iletisim');
    const opaque = () =>
      page.evaluate(() =>
        ['#iletisim h2', '#iletisim a[href^="mailto:"]'].map(
          (s) => getComputedStyle(document.querySelector(s)!).opacity,
        ),
      );
    expect(await opaque()).toEqual(['1', '1']);
    await motionReady(page);
    expect(await opaque()).toEqual(['1', '1']);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForFunction(
      () => {
        const t = performance.getEntriesByName('os:motion-ready', 'mark')[0]?.startTime;
        return t !== undefined && performance.now() > t + 3200;
      },
      undefined,
      { timeout: 20_000 },
    );
    const pending = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-reveal][data-armed]:not(.is-revealed)')]
        .filter((el) => el.getBoundingClientRect().top < window.innerHeight)
        .map((el) => el.textContent?.trim().slice(0, 30)),
    );
    expect(pending).toEqual([]);
  });

  test('K-AREAS-3 / K-AREAS-12 motion paketi engelliyken adım durumu doğru (GSAP’siz dinleyici)', async ({
    page,
  }) => {
    // engellenen chunk'ın ağ hatası beklenir (motion paketi yüklenemedi senaryosu)
    allowConsole(
      'Failed to load resource|ChunkLoadError|Loading chunk|dynamically imported module',
    );
    // gsap içeren chunk'ı engelle: içerik incelenerek (dosya adları build'e göre değişir)
    await page.route('**/_next/static/chunks/*.js', async (route) => {
      const res = await route.fetch();
      const body = await res.text();
      if (body.includes('gsapVersions')) return route.abort();
      return route.fulfill({ response: res, body });
    });
    await page.goto('/#alanlar');
    const areas = page.locator('[data-chapter="areas"]');
    await expect(areas.locator('[data-area-step]').first()).toBeVisible(); // pin istemcide doğrulandı
    await expect(areas.locator('[data-areas-counter]')).toHaveText(/^01 \//);
    const n = Number(await areas.getAttribute('data-areas-n'));
    // adım k'nın dwell ortası: sA(k) + 32.5 svh (sA(k) = T_areas + 10 + 50k)
    for (let k = 0; k < n; k++) {
      await page.evaluate((i) => {
        const s = document.querySelector<HTMLElement>('[data-chapter="areas"]')!;
        const top = s.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: top + ((10 + 50 * i + 32.5) * window.innerHeight) / 100,
          behavior: 'instant',
        });
      }, k);
      const pad = (x: number) => String(x).padStart(2, '0');
      await expect(areas.locator('[data-areas-counter]')).toHaveText(`${pad(k + 1)} / ${pad(n)}`);
      await expect(areas.locator('[data-area-desc][data-active]')).toHaveAttribute(
        'data-area-desc',
        String(k),
      );
      await expect(areas.locator('[aria-current="step"][data-area-step]')).toHaveAttribute(
        'data-area-step',
        String(k),
      );
    }
    expect(
      await page.evaluate(() => performance.getEntriesByName('os:motion-ready', 'mark').length),
    ).toBe(0);
  });
});
