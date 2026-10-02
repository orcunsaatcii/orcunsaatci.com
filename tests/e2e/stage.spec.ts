// tests/e2e/stage.spec.ts — kalıcı sahne ve KOD paneli (§5.12, §5.17, §5.20, §13.3.4): faz, tek canvas, statik panel →
// canvas geçişi ve örtüşme, çapalar ve programlar (K-KOD-1/2), bağlam kaybı, hot reload (K-HERO-8), kendiliğinden hareket
// (süzülme, boşta durma, duraklatma; K-HERO-9/10), paralaks, kare politikası, kademe tablosu ve tema bağlaması. Mutlu yol
// ?tier=high (masaüstü) / ?tier=medium (mobil) ile koşar; doğal yol ready ya da fallback kabul eder (V-41). Yükleme
// sırası ve chunk boyutları perf-budgets.spec.ts'tedir. Bekleme sayfa içinde yapılır (waitForTimeout YASAK). Derin sayfa
// presetleri (M8): route başına preset (K-DEEP-1/10), okuma modu (K-DEEP-3), "Sonraki proje" (K-DEEP-4), filtre ve
// yüzen önizleme (K-DEEP-5); route geçişleri transitions.spec.ts'tedir.
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { initialQuality } from '../../src/stage/quality';
import { expect, test } from './fixtures';
import { scrollToSvh, settle } from './helpers/scroll';
import {
  pageDelay,
  readLive,
  readStage,
  waitForPanelStill,
  waitForStagePhase,
} from './helpers/stage';

const HIGH = '/?tier=high&debug';
const ASPECT = 56 / 48;

/** Sahnenin canvas'ını sayfada saklar; sameCanvas aynı DOM öğesi mi diye bakar (tek bağlam, D-18) */
const keepCanvas = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __e2eCanvas?: Element | null }).__e2eCanvas =
      document.querySelector('#scene-layer canvas');
  });
const sameCanvas = (page: Page) =>
  page.evaluate(() => {
    const kept = (window as unknown as { __e2eCanvas?: Element | null }).__e2eCanvas;
    return !!kept && document.querySelector('#scene-layer canvas') === kept;
  });

/** Hero çapasındaki statik panelin hesaplanmış opaklığı */
const heroPanelOpacity = (page: Page) =>
  page.evaluate(() => {
    const p = document.querySelector<HTMLElement>('[data-stage-anchor="hero-rest"] .kod-panel');
    return p ? getComputedStyle(p).opacity : null;
  });

/** Çapadaki görünür statik panelin dikdörtgeni: canlı panel aynı kutuya yerleşir (§5.20.4) */
const staticRect = (page: Page, anchor: string) =>
  page.evaluate((id) => {
    const el = [
      ...document.querySelectorAll<HTMLElement>(`[data-stage-anchor="${id}"] .kod-panel`),
    ].find((p) => getComputedStyle(p).visibility !== 'hidden');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, anchor);

/** Bölüm başı + 0.2 × bölüm yüksekliği (BODY dwell'i; §5.9.3) */
const chapterY = (page: Page, id: string) =>
  page.evaluate((chapter) => {
    const r = document.querySelector(`[data-chapter="${chapter}"]`)!.getBoundingClientRect();
    return r.top + window.scrollY + 0.2 * r.height;
  }, id);

async function scrollToY(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await settle(page);
  await waitForPanelStill(page);
}

/** Panel dikdörtgeninin iç bölgesindeki (%20–80) ortalama renk, CIELAB (ekran görüntüsünden) */
async function panelLab(page: Page): Promise<[number, number, number]> {
  const { panel } = await readLive(page);
  const clip = {
    x: Math.round(panel.x + 0.2 * panel.w),
    y: Math.round(panel.y + 0.2 * panel.h),
    width: Math.round(0.6 * panel.w),
    height: Math.round(0.6 * panel.h),
  };
  const { data, info } = await sharp(await page.screenshot({ clip }))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  const n = info.width * info.height;
  for (let k = 0; k < data.length; k += info.channels)
    for (const c of [0, 1, 2]) sum[c]! += data[k + c]!;
  const lin = (v: number) => {
    const s = v / n / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin(sum[0]!), lin(sum[1]!), lin(sum[2]!)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const deltaE = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** 1 s boyunca çizilen kare sayısı */
const framesIn1s = async (page: Page) => {
  const f = (await readLive(page)).frames;
  await pageDelay(page, 1000);
  return (await readLive(page)).frames - f;
};

test.describe('§5.12 kalıcı sahne (masaüstü, ?tier=high)', { tag: ['@desktop-chromium'] }, () => {
  test('K-HERO-7 ready 20 s içinde; tek canvas; katman aria-hidden ve tıklanamaz; statik panel → canvas 600 ms, ready’de örtüşür (±2 px); hero CLS 0', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      type Shift = { t: number; v: number; src: string[] };
      const w = window as unknown as { __phases: [string, string][]; __shifts: Shift[] };
      w.__phases = [];
      w.__shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: { node?: Node | null }[];
        })[])
          if (!e.hadRecentInput)
            w.__shifts.push({
              t: e.startTime,
              v: e.value,
              src: (e.sources ?? []).map((s) => {
                const n = s.node as Element | null | undefined;
                return n?.nodeType === 1
                  ? `${n.localName}${n.id ? `#${n.id}` : ''}.${String(n.getAttribute('class') ?? '').split(' ')[0]}`
                  : String(n?.nodeName ?? '?');
              }),
            });
      }).observe({ type: 'layout-shift', buffered: true });
      // faz değiştiği anda hero statik panelinin opaklığı (init betiği <html>'den önce çalışır: belge gözlenir)
      new MutationObserver(() => {
        const phase = document.getElementById('scene-layer')?.dataset.phase;
        if (!phase || w.__phases.at(-1)?.[0] === phase) return;
        const panel = document.querySelector<HTMLElement>(
          '[data-stage-anchor="hero-rest"] .kod-panel',
        );
        w.__phases.push([phase, panel ? getComputedStyle(panel).opacity : 'yok']);
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-phase'] });
    });
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready'], 20_000);
    await expect(page.locator('canvas')).toHaveCount(1);
    const layer = page.locator('#scene-layer');
    await expect(layer).toHaveAttribute('aria-hidden', 'true');
    await expect(layer).toHaveCSS('pointer-events', 'none');
    await expect(layer).toHaveCSS('position', 'fixed');
    // crossfade: yükleme boyunca statik panel opak; ready anında 600 ms'lik geçiş başlar
    const phases = await page.evaluate(
      () => (window as unknown as { __phases: [string, string][] }).__phases,
    );
    expect(phases.find(([p]) => p === 'loading')?.[1]).toBe('1');
    expect(phases.find(([p]) => p === 'ready')?.[1]).toBe('1');
    const marks = await page.evaluate(() =>
      ['os:stage-compiled', 'os:stage-ready'].map(
        (n) => performance.getEntriesByName(n, 'mark')[0]?.startTime ?? -1,
      ),
    );
    expect(marks[0]).toBeGreaterThan(0);
    expect(marks[1]).toBeGreaterThanOrEqual(marks[0]!);
    const panel = page.locator('[data-stage-anchor="hero-rest"] .kod-panel');
    await expect(panel).toHaveCSS('transition-duration', '0.6s');
    await expect.poll(() => heroPanelOpacity(page)).toBe('0');
    // canlı panel statik panelin dikdörtgenindedir (eğim ve süzülme hariç düzen kutusu, §5.20.4)
    const live = (await readLive(page)).panel;
    const still = (await staticRect(page, 'hero-rest'))!;
    expect(live.visible).toBe(true);
    for (const k of ['x', 'y', 'w', 'h'] as const)
      expect.soft(Math.abs(live[k] - still[k]), `canlı ↔ statik ${k}`).toBeLessThanOrEqual(2);
    // Sahnenin katkısı: boot (os:stage-probe) ve crossfade sırasındaki kaymalar. İlk boyamadaki font değişimi sahneye
    // ait değildir; sayfanın tamamı P5'te (perf-smoke) ve LHCI'da ölçülür.
    const { shifts, probe } = await page.evaluate(() => ({
      shifts: (window as unknown as { __shifts: { t: number; v: number; src: string[] }[] })
        .__shifts,
      probe: performance.getEntriesByName('os:stage-probe', 'mark')[0]?.startTime ?? 0,
    }));
    const cls = shifts.filter((x) => x.t >= probe).reduce((n, x) => n + x.v, 0);
    expect(cls, `boot ve crossfade boyunca CLS: ${JSON.stringify(shifts)}`).toBe(0);
  });

  test('D-18 sona kaydırıp dönünce ve proje sayfasına gidip gelince aynı canvas; bağlam yeniden kurulmaz', async ({
    page,
  }) => {
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    await keepCanvas(page);
    await scrollToSvh(page, 5000);
    await scrollToSvh(page, 0);
    expect((await readStage(page)).phase).toBe('ready');
    expect(await sameCanvas(page), 'kaydırma sonrası aynı canvas').toBe(true);
    // ana sayfa → proje sayfası → geri (§5.19 "Mimari ve paketler")
    const link = page.locator('[data-chapter="work"] a[href^="/projeler/"]').first();
    const href = await link.getAttribute('href');
    await link.click();
    await page.waitForURL(`**${href}`);
    await expect(page.locator('#scene-layer canvas')).toHaveCount(1);
    expect(await sameCanvas(page), 'proje sayfasında aynı canvas').toBe(true);
    await page.goBack();
    await page.waitForURL(/\/\?tier=high/);
    await waitForStagePhase(page, ['ready']);
    expect(await sameCanvas(page), 'geri dönüşte aynı canvas').toBe(true);
    expect((await readLive(page)).canvasKey, 'yeni bağlam kurulmadı').toBe(0);
  });

  test('K-HERO-6 hero-rest k8–12; altı eyebrow satırının altıyla hizalı (±2 px), H1’e binmez; panel 56 : 48 sığar, ≥ 360 px; main.dart SSR’de, aria-hidden, satırlar blok', async ({
    page,
  }) => {
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    await waitForPanelStill(page);
    const geo = await page.evaluate(() => {
      const a = document.querySelector('[data-stage-anchor="hero-rest"]')!.getBoundingClientRect();
      const eyebrow = document.querySelector('[data-chapter="hero"] .type-eyebrow')!;
      const h1 = document.querySelector('[data-chapter="hero"] h1')!.getBoundingClientRect();
      const header = document.querySelector('body > header')!.getBoundingClientRect();
      return {
        left: a.left,
        right: a.right,
        top: a.top,
        bottom: a.bottom,
        width: a.width,
        height: a.height,
        eyebrow: eyebrow.getBoundingClientRect().bottom,
        h1: h1.top,
        header: header.bottom,
      };
    });
    // k8–12 = x 843–1376 (1440×900, §4.6.2); üst header + 16 px; alt eyebrow satırıyla aynı (H1'in üstünde 24 px)
    expect(Math.abs(geo.left - 843)).toBeLessThanOrEqual(2);
    expect(Math.abs(geo.right - 1376)).toBeLessThanOrEqual(2);
    expect(Math.abs(geo.bottom - geo.eyebrow), 'çapa altı ↔ eyebrow altı').toBeLessThanOrEqual(2);
    expect(geo.bottom, 'panel H1’e binmez').toBeLessThanOrEqual(geo.h1 - 20);
    expect(geo.top, 'header’ın altında').toBeGreaterThanOrEqual(geo.header);
    // panel çapaya 56 : 48 oranla sığar (contain) ve ortalanır
    const { panel } = await readLive(page);
    const w = Math.min(geo.width, geo.height * ASPECT);
    expect(Math.abs(panel.w - w), `panel genişliği ${panel.w}`).toBeLessThanOrEqual(2);
    expect(panel.w, 'okunabilirlik: Pw ≥ 360 px (§4.5.6)').toBeGreaterThanOrEqual(360);
    expect(Math.abs(panel.w / panel.h - ASPECT)).toBeLessThan(0.01);
    // K-KOD-2: statik panel SSR HTML'indedir (JS'siz ilk boyama)
    const ssr = await page.evaluate(async () => {
      const html = await (await fetch('/')).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const p = doc.querySelector('[data-stage-anchor="hero-rest"] .kod-panel');
      return p
        ? {
            program: p.getAttribute('data-kod-program'),
            hidden: p.getAttribute('aria-hidden'),
            rows: p.querySelectorAll('pre > .kod-row').length,
            text: p.textContent ?? '',
          }
        : null;
    });
    expect(ssr).toMatchObject({ program: 'hero', hidden: 'true', rows: 24 });
    expect(ssr!.text).toContain('main.dart');
    await expect(
      page.locator('[data-stage-anchor="hero-rest"] .kod-row').first(),
      'satır başına blok öğe (LCP önlemi)',
    ).toHaveCSS('display', 'block');
  });

  test('K-KOD-1 her bölüm ve adım kendi programını gösterir; canlı panel çapanın statik paneliyle aynı kutuda (±2 px); work’te sahne söner; V-45', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    const cases = [
      { chapter: 'about', anchor: 'about-cut', key: /^about:/ },
      { chapter: 'areas', anchor: 'areas-dial', key: /^area:\d+$/ },
      { chapter: 'journey', anchor: 'journey-core', key: /^journey:-?\d+$/ },
      { chapter: 'contact', anchor: 'contact-ring', key: /^contact$/ },
    ];
    for (const c of cases) {
      await test.step(c.chapter, async () => {
        await scrollToY(page, await chapterY(page, c.chapter));
        const l = await readLive(page);
        expect.soft(l.kod.key, `${c.chapter} program`).toMatch(c.key);
        expect.soft(l.panel.visible, `${c.chapter} görünür`).toBe(true);
        const still = await staticRect(page, c.anchor);
        expect(still, `${c.chapter} statik panel`).not.toBeNull();
        for (const k of ['x', 'y', 'w', 'h'] as const)
          expect.soft(Math.abs(l.panel[k] - still![k]), `${c.chapter} ${k}`).toBeLessThanOrEqual(2);
        // V-45: programatik window.scrollTo sonrası Lenis/director durumu senkron (±1 px)
        const [directorY, windowY] = [
          (await readStage(page)).scrollY,
          await page.evaluate(() => window.scrollY),
        ];
        expect.soft(Math.abs(directorY - windowY), 'V-45').toBeLessThanOrEqual(1);
      });
    }
    await test.step('work: sahne söner, kare çizilmez (K-WORK-6)', async () => {
      await page.evaluate(
        (top) => window.scrollTo({ top, behavior: 'instant' }),
        await chapterY(page, 'work'),
      );
      await settle(page);
      await expect
        .poll(() =>
          page.evaluate(() => getComputedStyle(document.getElementById('scene-layer')!).opacity),
        )
        .toBe('0');
      await expect.poll(() => framesIn1s(page), { intervals: [0] }).toBe(0);
    });
    await test.step('areas adımları: başlık adımın dwell’ine kaydırır, panel o alanın programına geçer', async () => {
      await scrollToY(page, await chapterY(page, 'areas'));
      const n = await page.locator('[data-area-step]').count();
      expect(n).toBeGreaterThanOrEqual(3);
      for (let k = n - 1; k >= 0; k--) {
        await page.locator('[data-area-step]').nth(k).click();
        await expect
          .poll(async () => (await readLive(page)).kod.key, { message: `adım ${k}`, timeout: 5000 })
          .toBe(`area:${k}`);
      }
    });
    await test.step('journey: etkin kayıt DOM ile aynı', async () => {
      const entries = page.locator('[data-journey-entry]');
      const n = await entries.count();
      for (let k = 0; k < n; k++) {
        await entries
          .nth(k)
          .evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await settle(page);
        const dom = await page.evaluate(() =>
          [...document.querySelectorAll('[data-journey-entry]')].findIndex((e) =>
            e.hasAttribute('data-active'),
          ),
        );
        if (dom < 0) continue; // etkinleşme çizgisinin dışında
        await expect
          .poll(async () => (await readLive(page)).kod.key, { message: `kayıt ${k}` })
          .toBe(`journey:${dom}`);
      }
    });
  });

  test('§5.17 loseContext → statik paneller aynı karede; restoreContext → ready; ikinci kayıp → static, canvas yok', async ({
    page,
  }) => {
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    await expect.poll(() => heroPanelOpacity(page)).toBe('0');
    const lost = await page.evaluate(async () => {
      const canvas = document.querySelector<HTMLCanvasElement>('#scene-layer canvas')!;
      const ext = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
      (window as unknown as { __ext: WEBGL_lose_context }).__ext = ext;
      // webglcontextlost eşzamansız gelir; "aynı kare" = olaydan sonraki ilk kare
      const fired = new Promise((resolve) =>
        canvas.addEventListener('webglcontextlost', resolve, { once: true }),
      );
      ext.loseContext();
      await fired;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const panel = document.querySelector<HTMLElement>(
        '[data-stage-anchor="hero-rest"] .kod-panel',
      )!;
      return {
        phase: document.getElementById('scene-layer')!.dataset.phase,
        opacity: getComputedStyle(panel).opacity,
      };
    });
    expect(lost).toEqual({ phase: 'poster', opacity: '1' });
    await page.evaluate(() =>
      (window as unknown as { __ext: WEBGL_lose_context }).__ext.restoreContext(),
    );
    await waitForStagePhase(page, ['ready']);
    expect((await readLive(page)).canvasKey, 'geri yüklemede yeni Scene').toBe(1);
    await page.evaluate(() =>
      document
        .querySelector<HTMLCanvasElement>('#scene-layer canvas')!
        .getContext('webgl2')!
        .getExtension('WEBGL_lose_context')!
        .loseContext(),
    );
    await expect(page.locator('#scene-layer')).toHaveAttribute('data-tier', 'static');
    await expect(page.locator('#scene-layer')).toHaveAttribute('data-phase', 'fallback');
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await heroPanelOpacity(page)).toBe('1');
  });

  test('K-HERO-8 hot reload oturumda bir kez; derin bağlantıda ve duraklatılmışken oynamaz', async ({
    page,
    context,
  }) => {
    const flag = (p: Page) => p.evaluate(() => window.sessionStorage.getItem('os-sweep'));
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    expect((await readLive(page)).kod.hot, 'ilk yükleme').toBe(true);
    expect(await flag(page)).toBe('1');
    // aynı sekmede yeniden yükleme: oturumda bir kez
    await page.reload();
    await waitForStagePhase(page, ['ready']);
    expect((await readLive(page)).kod.hot, 'ikinci yükleme').toBe(false);
    await page.goto('about:blank');
    // derin bağlantı: scrollY ≥ 0.2·innerHeight (yeni sekme = yeni oturum deposu)
    const deep = await context.newPage();
    await deep.goto(`${HIGH}#ben`);
    await waitForStagePhase(deep, ['ready'], 30_000);
    expect(await deep.evaluate(() => window.scrollY / window.innerHeight)).toBeGreaterThanOrEqual(
      0.2,
    );
    expect((await readLive(deep)).kod.hot, 'derin bağlantı').toBe(false);
    expect(await flag(deep)).toBeNull();
    await deep.close();
    // duraklatılmış: ready'den önce durdurulur
    const paused = await context.newPage();
    await paused.goto(HIGH);
    await paused.getByRole('button', { name: 'Animasyonu durdur' }).click();
    expect((await readStage(paused)).phase).not.toBe('ready');
    await waitForStagePhase(paused, ['ready'], 30_000);
    expect((await readLive(paused)).kod.hot, 'duraklatılmış').toBe(false);
    expect(await flag(paused)).toBeNull();
  });

  test('§5.20.7 ?tier=low|medium|high kademe tablosu (dpr, hareket); K-HERO-9 süzülme medium ve high’da var, low’da yok', async ({
    page,
  }) => {
    for (const tier of ['low', 'medium', 'high'] as const) {
      await test.step(tier, async () => {
        await page.goto(`/?tier=${tier}&debug`);
        await waitForStagePhase(page, ['ready']);
        expect((await readStage(page)).tier).toBe(tier);
        expect((await readLive(page)).quality).toEqual(initialQuality(tier, 1));
        const a = (await readLive(page)).kod.drift;
        if (tier === 'low') {
          await pageDelay(page, 1500);
          expect((await readLive(page)).kod.drift, 'low: süzülme yok').toBe(0);
        } else
          await expect
            .poll(async () => (await readLive(page)).kod.drift - a, {
              message: `${tier}: süzülme`,
              timeout: 6000,
            })
            .toBeGreaterThan(0.2);
      });
    }
  });

  test('K-HERO-9 kendiliğinden hareket son girdiden 20 s sonra durur (ince işaretçi); ardından kare çizilmez', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    await page.mouse.move(600, 300);
    await page.mouse.move(640, 320);
    const input = (await readLive(page)).lastInput;
    expect(input).toBeGreaterThan(0);
    // 20 s dolmadan hemen önce hâlâ süzülür
    await page.waitForFunction((t) => performance.now() > t + 18_500, input, { timeout: 40_000 });
    const a = await readLive(page);
    expect(a.kod.frozen, '20 s dolmadı').toBe(false);
    await pageDelay(page, 3000);
    // 20 s'de durur: donuk; 1 s boyunca kare çizilmez ve süzülme saati sabittir
    await expect
      .poll(() => framesIn1s(page), {
        message: 'demand döngüsü: kare yok',
        timeout: 30_000,
        intervals: [0],
      })
      .toBe(0);
    const b = await readLive(page);
    expect(b.kod.frozen).toBe(true);
    expect(b.kod.drift).toBeGreaterThan(a.kod.drift);
    await pageDelay(page, 1000);
    expect((await readLive(page)).kod.drift, 'süzülme durdu').toBe(b.kod.drift);
    // yeni girdi hareketi yeniden başlatır
    await page.mouse.move(700, 400);
    await expect.poll(async () => (await readLive(page)).kod.frozen).toBe(false);
  });

  test('§4.14 #1 paralaks: ince işaretçiye söner, pencereden çıkınca 0’a döner; low’da yok', async ({
    page,
  }) => {
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    const vp = page.viewportSize()!;
    await page.mouse.move(vp.width - 2, 2); // sağ üst: x → 1, y → 1
    await expect
      .poll(async () => (await readLive(page)).kod.parX, { timeout: 5000 })
      .toBeGreaterThan(0.9);
    expect((await readLive(page)).kod.parY).toBeGreaterThan(0.5);
    await page.mouse.move(vp.width / 2, vp.height + 50); // pencereden çıkış
    await page.evaluate(() =>
      document.dispatchEvent(new PointerEvent('pointerout', { relatedTarget: null })),
    );
    await expect
      .poll(async () => Math.abs((await readLive(page)).kod.parX), { timeout: 5000 })
      .toBeLessThan(0.01);
    await page.goto('/?tier=low&debug');
    await waitForStagePhase(page, ['ready']);
    await page.mouse.move(vp.width - 2, 2);
    await pageDelay(page, 800);
    expect((await readLive(page)).kod.parX, 'low: paralaks yok').toBe(0);
  });

  test('K-HERO-10, K-VAR-2 (sahne): duraklatma süzülmeyi durdurur, kaydırma köprüleri sürer; yeniden yüklemede sıfırlanır', async ({
    page,
  }) => {
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    await page.getByRole('button', { name: 'Animasyonu durdur' }).click();
    await expect(page.getByRole('button', { name: 'Animasyonu başlat' })).toBeVisible();
    await expect.poll(async () => (await readLive(page)).kod.frozen).toBe(true);
    const a = await readLive(page);
    await pageDelay(page, 1000);
    const b = await readLive(page);
    expect(b.paused).toBe(true);
    expect(b.kod.drift, 'süzülme durdu').toBe(a.kod.drift);
    await scrollToY(page, await chapterY(page, 'about'));
    expect((await readLive(page)).kod.key, 'kaydırma köprüsü sürer').toMatch(/^about:/);
    await page.reload();
    await waitForStagePhase(page, ['ready']);
    expect((await readLive(page)).paused, 'yeniden yüklemede sıfırlanır').toBe(false);
  });

  test('§5.19 --scene-opacity < 0.01 iken ve gizli sekmede 2 s boyunca kare çizilmez', async ({
    page,
  }) => {
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    // /gizlilik (preset none): katman opaklığı 0, döngü never; işaretçi girdisi kare istemez
    await scrollToSvh(page, 5000);
    await page.locator('a[href="/gizlilik"]').first().click();
    await page.waitForURL('**/gizlilik');
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.getElementById('scene-layer')!).opacity),
      )
      .toBe('0');
    // geçiş sırasında (cut) çizilen son kareler durulsun
    await expect
      .poll(
        async () => {
          const f = (await readLive(page)).frames;
          await pageDelay(page, 500);
          return (await readLive(page)).frames - f;
        },
        { timeout: 10_000, intervals: [0] },
      )
      .toBe(0);
    const f0 = (await readLive(page)).frames;
    await page.mouse.move(400, 300);
    await page.mouse.move(600, 500);
    await pageDelay(page, 2000);
    expect((await readLive(page)).frames, 'opaklık 0').toBe(f0);
    await page.goBack();
    await waitForStagePhase(page, ['ready']);
    // gizli sekme (Playwright sekmeyi gizleyemez: visibilityState öykünülür)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await pageDelay(page, 300);
    const f1 = (await readLive(page)).frames;
    await page.mouse.move(700, 400);
    await page.mouse.move(900, 500);
    await pageDelay(page, 2000);
    expect((await readLive(page)).frames, 'gizli sekme').toBe(f1);
  });

  test('§5.20.4 tema değişimi rol renklerini bir karede günceller: çalışma anında koyu = doğrudan koyu yükleme (ΔE < 2)', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000); // iki tam sahne boot'u: CI yazılım render'ında 60 s'yi aşabiliyor
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    const y = await chapterY(page, 'about');
    await scrollToY(page, y);
    await pageDelay(page, 2500); // adım çözülmesi biter
    const light = await panelLab(page);
    await page.evaluate(async () => {
      document.documentElement.dataset.theme = 'dark';
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const switched = await panelLab(page);
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
    });
    const direct = await ctx.newPage();
    await direct.goto(HIGH);
    await waitForStagePhase(direct, ['ready']);
    await scrollToY(direct, y);
    await pageDelay(direct, 2500);
    const dark = await panelLab(direct);
    await ctx.close();
    expect(deltaE(light, dark), 'temalar ayrışır').toBeGreaterThan(10);
    expect(deltaE(switched, dark), 'çalışma anında koyu ↔ doğrudan koyu').toBeLessThan(2);
  });
});

test.describe('§4.5.6 panel okunabilirliği', { tag: ['@desktop-chromium'] }, () => {
  test('masaüstünde (1024×768, 1440×900) her görünür statik panel ≥ 360 px (kısa masaüstünde hero ≥ 320); mobilde (390×844) ≥ 280 px', async ({
    page,
    request,
  }) => {
    const project = (await (await request.get('/projeler')).text()).match(
      /href="(\/projeler\/[^"#?]+)"/,
    )?.[1];
    const paths = [
      '/',
      project ?? '/projeler',
      '/projeler',
      '/calisma-alanlari',
      '/hakkimda',
      '/iletisim',
    ];
    /** Görünür statik panellerden min'den dar olanlar; hero kısa masaüstünde (yükseklik < 800) ≥ 320 px (iPad yatay) */
    const narrow = (min: number, heroMin = min) =>
      page.evaluate(
        ([m, h]) => {
          const out: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>('.stage-anchor .kod-panel')) {
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || el.getClientRects().length === 0) continue;
            const w = el.getBoundingClientRect().width;
            const limit = el.dataset.kodProgram === 'hero' ? h! : m!;
            if (w < limit - 1) out.push(`${el.dataset.kodProgram} ${Math.round(w)} px`);
          }
          return out;
        },
        [min, heroMin],
      );
    for (const vp of [
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(vp);
      for (const path of paths) {
        await page.goto(`${path}?tier=static`);
        expect
          .soft(await narrow(360, vp.height < 800 ? 320 : 360), `${vp.width}px ${path}`)
          .toEqual([]);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of paths) {
      await page.goto(`${path}?tier=static`);
      expect.soft(await narrow(280), `390px ${path}`).toEqual([]);
    }
  });
});

test.describe('V-41 doğal yol', { tag: ['@desktop-chromium'] }, () => {
  test('V-41 sorgusuz /: faz ready ya da fallback; seçilen kademe rapora yazılır', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    const phase = await waitForStagePhase(page, ['ready', 'fallback'], 30_000);
    const tier = await page.locator('#scene-layer').getAttribute('data-tier');
    testInfo.annotations.push({ type: 'V-41', description: `phase=${phase} tier=${tier}` });
    // CI'da GitHub ek açıklaması olur (github reporter test çıktısını basar): V-41 sonucu PR'a yazılır
    console.log(`::notice title=V-41 doğal yol::phase=${phase} tier=${tier}`);
    expect(['ready', 'fallback']).toContain(phase);
  });
});

test.describe('mobil sahne', { tag: ['@pixel-7', '@iphone-15'] }, () => {
  test('?tier=medium 30 s içinde ready ya da fallback; tier high değil (V-43)', async ({
    page,
  }, testInfo) => {
    await page.goto('/?tier=medium');
    const phase = await waitForStagePhase(page, ['ready', 'fallback'], 30_000);
    const tier = await page.locator('#scene-layer').getAttribute('data-tier');
    testInfo.annotations.push({ type: 'V-43', description: `phase=${phase} tier=${tier}` });
    console.log(`::notice title=V-43 ${testInfo.project.name}::phase=${phase} tier=${tier}`);
    expect(tier).not.toBe('high');
    await expect(page.locator('canvas')).toHaveCount(phase === 'ready' ? 1 : 0);
  });
});

test.describe('K-DEEP-2', { tag: ['@desktop-chromium', '@pixel-7', '@iphone-15'] }, () => {
  test('K-DEEP-2 /gizlilik’e doğrudan gelişte 5 s sonra canvas yok', async ({ page }) => {
    await page.goto('/gizlilik');
    await page.waitForFunction(
      () => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return nav.loadEventEnd > 0 && performance.now() > nav.loadEventEnd + 5000;
      },
      undefined,
      { timeout: 30_000 },
    );
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('#scene-layer')).toHaveAttribute('data-phase', 'poster');
  });
});

/** ?debug kancası yüklendi (debug modülü dinamik import edilir) */
const debugReady = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as { __stage?: unknown }).__stage);
const layerOpacity = (page: Page) =>
  page.evaluate(() =>
    Number.parseFloat(getComputedStyle(document.getElementById('scene-layer')!).opacity),
  );

test.describe('§4.13 derin sayfa presetleri', { tag: ['@desktop-chromium'] }, () => {
  test('K-DEEP-1 her route’un preset’i §4.13.2 ile aynı; K-DEEP-10 /cv’de çapa yok (preset none)', async ({
    page,
  }) => {
    await page.goto('/projeler?debug&tier=static', { waitUntil: 'networkidle' });
    const project = (await page.locator('main li[data-project] a').first().getAttribute('href'))!;
    const cases = [
      ['/', 'home'],
      ['/projeler', 'plan-small'],
      [project, 'folio'],
      ['/calisma-alanlari', 'plan-small'],
      ['/hakkimda', 'about-page'],
      ['/iletisim', 'contact-page'],
      ['/cv', 'none'],
      ['/gizlilik', 'none'],
      ['/en', 'home'],
      ['/en/about', 'about-page'],
    ] as const;
    for (const [path, preset] of cases) {
      await test.step(path, async () => {
        await page.goto(`${path}?debug&tier=static`, { waitUntil: 'networkidle' });
        await debugReady(page);
        await expect
          .poll(async () => (await readStage(page)).preset, { message: path })
          .toBe(preset);
        if (preset === 'none')
          await expect(page.locator('[data-stage-anchor]'), `${path}: çapa yok`).toHaveCount(0);
      });
    }
  });

  test('K-DEEP-3 okuma modu: page-folio bloğu çıkınca --scene-opacity 300 ms’de 0; sonraki kaydırmada kare çizilmez', async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    // süre: director kademeden bağımsızdır; statik kademede kare zamanlaması kesindir (CI SwiftShader ≈ 2 fps)
    await page.goto('/hakkimda?debug&tier=static', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
    await debugReady(page);
    await settle(page);
    expect(await layerOpacity(page), 'başlık yanında panel görünür').toBeGreaterThan(0.99);
    // --scene-opacity yazımları (kare başına): ilk düşüşten 0'a kadar ≤ 300 ms; pay = yazımlar arası en büyük boşluk
    const t = await page.evaluate(
      () =>
        new Promise<{ first: number; zero: number; gap: number }>((resolve) => {
          type L = { live: { layout: { reading?: number } | null } };
          const layer = document.getElementById('scene-layer')!;
          const reading = (window as unknown as { __stage: L }).__stage.live.layout?.reading ?? 0;
          const val = () => Number.parseFloat(layer.style.getPropertyValue('--scene-opacity'));
          const writes: number[] = [];
          const t0 = performance.now();
          new MutationObserver(() => {
            const at = performance.now() - t0;
            if (val() < 0.999) writes.push(at);
            if (val() <= 0.01) {
              const gap = Math.max(0, ...writes.slice(1).map((w, i) => w - (writes[i] ?? w)));
              resolve({ first: writes[0] ?? at, zero: at, gap });
            }
          }).observe(layer, { attributes: true, attributeFilter: ['style'] });
          window.scrollTo({ top: reading + 0.05 * window.innerHeight, behavior: 'instant' });
        }),
    );
    info.annotations.push({ type: 'K-DEEP-3 sönme (ms)', description: JSON.stringify(t) });
    expect(t.zero - t.first, `sönme ≤ 300 ms (kare boşluğu ${t.gap} ms)`).toBeLessThanOrEqual(
      300 + t.gap,
    );

    // kare: canlı sahne, sönük katmanda kaydırma kare istemez (loop never)
    await page.goto('/hakkimda?debug&tier=high');
    await waitForStagePhase(page, ['ready']);
    await settle(page);
    const reading = await page.evaluate(
      () =>
        (window as unknown as { __stage: { live: { layout: { reading?: number } | null } } })
          .__stage.live.layout?.reading ?? 0,
    );
    await page.evaluate((y) => window.scrollTo({ top: y + 20, behavior: 'instant' }), reading);
    await expect.poll(() => layerOpacity(page), { message: 'okuma modu' }).toBe(0);
    await expect.poll(async () => (await readStage(page)).loop).toBe('never');
    const f0 = (await readLive(page)).frames;
    for (const dy of [200, 400, 600]) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), reading + dy);
      await settle(page);
    }
    expect((await readLive(page)).frames - f0, 'okurken kare yok').toBe(0);
  });

  test('K-DEEP-4 "Sonraki proje" bloğu görününce panel o çapada belirir ve next: <slug> programını gösterir', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto('/projeler?tier=static', { waitUntil: 'networkidle' });
    const project = (await page.locator('main li[data-project] a').first().getAttribute('href'))!;
    await page.goto(`${project}?debug&tier=high`);
    await waitForStagePhase(page, ['ready']);
    const next = page.locator('section[aria-labelledby="next-title"]');
    const slug = ((await next.locator('a').first().getAttribute('href')) ?? '').split('/').at(-1);
    await next.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await settle(page);
    await expect
      .poll(async () => (await readLive(page)).kod.key, {
        message: 'next programı',
        timeout: 15_000,
      })
      .toBe(`next:${slug}`);
    await expect.poll(() => layerOpacity(page), { message: 'panel belirir' }).toBeGreaterThan(0.99);
    await waitForPanelStill(page);
    const live = await readLive(page);
    const still = await next.evaluate((el) => {
      const r = el.querySelector('[data-stage-anchor] .kod-panel')!.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    for (const k of ['x', 'y', 'w', 'h'] as const)
      expect.soft(Math.abs(live.panel[k] - still[k]), `slot 1 ${k}`).toBeLessThanOrEqual(2);
  });

  test('K-DEEP-5 /projeler filtre çipi panelde ls projects/ --area=<id> açar; yüzen önizleme §4.14.5', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto('/projeler?debug&tier=high');
    await waitForStagePhase(page, ['ready']);
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
    await expect.poll(async () => (await readLive(page)).kod.key).toBe('list:');
    const chips = page.getByRole('group', { name: 'Alana göre filtrele' }).getByRole('button');
    await chips.nth(1).click();
    await expect(page).toHaveURL(/[?&]alan=/);
    const area = new URL(page.url()).searchParams.get('alan');
    await expect
      .poll(async () => (await readLive(page)).kod.key, { message: 'filtreli liste' })
      .toBe(`list:${area}`);
    await chips.first().click();
    await expect.poll(async () => (await readLive(page)).kod.key).toBe('list:');

    // yüzen önizleme: işaretçide başlığın sağında, clamp(240px, 22vw, 360px); klavyede satırın sağ ucunda
    const row = page.locator('main li[data-project]').first();
    const preview = page.locator('.floating-preview');
    await row.hover();
    await expect(preview).toHaveAttribute('data-open', '');
    await expect(preview).toHaveAttribute('aria-hidden', 'true');
    await expect(preview.locator('img[data-on]')).toHaveAttribute('alt', '');
    await pageDelay(page, 700); // giriş (400 ms) ve takip (0.5 s) biter
    const geo = () =>
      row.evaluate((li) => {
        const p = document.querySelector('.floating-preview')!.getBoundingClientRect();
        const r = li.getBoundingClientRect();
        const h = li.querySelector('h2')!.getBoundingClientRect();
        return {
          p: { l: p.left, r: p.right, w: p.width },
          row: r.right,
          title: h.right,
          vw: innerWidth,
        };
      });
    let g = await geo();
    expect
      .soft(Math.abs(g.p.w - Math.min(360, Math.max(240, 0.22 * g.vw))), 'genişlik')
      .toBeLessThanOrEqual(1);
    expect.soft(g.p.l, 'başlığın üstüne binmez').toBeGreaterThanOrEqual(g.title);
    expect.soft(g.p.r, 'görüntü alanında').toBeLessThanOrEqual(g.vw);
    await page.mouse.move(4, 4);
    await chips.last().focus();
    await page.keyboard.press('Tab');
    await expect(row.locator('a').first()).toBeFocused();
    await expect(preview).toHaveAttribute('data-open', '');
    await pageDelay(page, 700); // giriş ölçeği (0.96 → 1, 400 ms) biter
    g = await geo();
    expect.soft(Math.abs(g.p.r - g.row), 'klavye: satırın sağ ucuna sabit').toBeLessThanOrEqual(1);
    await page.waitForLoadState('networkidle');
  });
});
