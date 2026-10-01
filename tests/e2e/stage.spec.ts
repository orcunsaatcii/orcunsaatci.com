// tests/e2e/stage.spec.ts — kalıcı sahne (§5.12, §5.17, §5.19, §13.3.4): faz, tek canvas, crossfade, çapalar, bağlam
// kaybı, ışık taraması, idle drift, duraklatma, kare politikası, kademe tablosu ve tema bağlaması. Mutlu yol
// ?tier=high (masaüstü) / ?tier=medium (mobil) ile koşar; doğal yol ready ya da fallback kabul eder (V-41). Yükleme
// sırası ve chunk boyutları perf-budgets.spec.ts'tedir. Bekleme sayfa içinde yapılır (waitForTimeout YASAK).
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { initialQuality } from '../../src/stage/quality';
import { expect, test } from './fixtures';
import { scrollToSvh, settle } from './helpers/scroll';
import {
  pageDelay,
  readLive,
  readStage,
  waitForStagePhase,
  waitForStoneStill,
} from './helpers/stage';

const HIGH = '/?tier=high&debug';

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

/** Etkin temanın hero posterinin hesaplanmış opaklığı */
const heroPosterOpacity = (page: Page) =>
  page.evaluate(() => {
    const poster = [
      ...document.querySelectorAll<HTMLElement>('[data-stage-anchor="hero-rest"] .stage-poster'),
    ].find((p) => getComputedStyle(p).display !== 'none');
    return poster ? getComputedStyle(poster).opacity : null;
  });

/** Bölüm başı + 0.2 × bölüm yüksekliği (BODY dwell'i; §5.9.3) */
const chapterY = (page: Page, id: string) =>
  page.evaluate((chapter) => {
    const r = document.querySelector(`[data-chapter="${chapter}"]`)!.getBoundingClientRect();
    return r.top + window.scrollY + 0.2 * r.height;
  }, id);

async function scrollToY(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await settle(page);
  await waitForStoneStill(page);
}

/** Taş dairesinin 0.2–0.8 r halkasındaki ortalama renk, CIELAB (ekran görüntüsünden) */
async function stoneLab(page: Page): Promise<[number, number, number]> {
  const { stone } = await readLive(page);
  const clip = {
    x: Math.round(stone.cx - stone.r),
    y: Math.round(stone.cy - stone.r),
    width: Math.round(2 * stone.r),
    height: Math.round(2 * stone.r),
  };
  const { data, info } = await sharp(await page.screenshot({ clip }))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const d = Math.hypot(x - info.width / 2, y - info.height / 2) / (info.width / 2);
      if (d < 0.2 || d > 0.8) continue;
      const k = (y * info.width + x) * info.channels;
      for (const c of [0, 1, 2]) sum[c]! += data[k + c]!;
      n++;
    }
  }
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

test.describe('§5.12 kalıcı sahne (masaüstü, ?tier=high)', { tag: ['@desktop-chromium'] }, () => {
  test('K-HERO-7 ready 20 s içinde; tek canvas; katman aria-hidden ve tıklanamaz; crossfade 600 ms ilk derlenmiş kareden sonra; hero CLS 0', async ({
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
      // faz değiştiği anda etkin hero posterinin opaklığı (init betiği <html>'den önce çalışır: belge gözlenir)
      new MutationObserver(() => {
        const phase = document.getElementById('scene-layer')?.dataset.phase;
        if (!phase || w.__phases.at(-1)?.[0] === phase) return;
        const poster = [
          ...document.querySelectorAll<HTMLElement>(
            '[data-stage-anchor="hero-rest"] .stage-poster',
          ),
        ].find((p) => getComputedStyle(p).display !== 'none');
        w.__phases.push([phase, poster ? getComputedStyle(poster).opacity : 'yok']);
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-phase'] });
    });
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready'], 20_000);
    await expect(page.locator('canvas')).toHaveCount(1);
    const layer = page.locator('#scene-layer');
    await expect(layer).toHaveAttribute('aria-hidden', 'true');
    await expect(layer).toHaveCSS('pointer-events', 'none');
    await expect(layer).toHaveCSS('position', 'fixed');
    // crossfade: yükleme boyunca poster opak; ready anında 600 ms'lik geçiş başlar
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
    const poster = page
      .locator('[data-stage-anchor="hero-rest"] .stage-poster')
      .locator('visible=true')
      .first();
    await expect(poster).toHaveCSS('transition-duration', '0.6s');
    await expect.poll(() => heroPosterOpacity(page)).toBe('0');
    // Sahnenin katkısı: boot (os:stage-probe) ve crossfade sırasındaki kaymalar. İlk boyamadaki font değişimi sahneye
    // ait değildir; sayfanın tamamı P5'te (perf-smoke) ve LHCI'da ölçülür.
    const { shifts, probe } = await page.evaluate(() => ({
      shifts: (window as unknown as { __shifts: { t: number; v: number; src: string[] }[] })
        .__shifts,
      probe: performance.getEntriesByName('os:stage-probe', 'mark')[0]?.startTime ?? 0,
    }));
    const stageShifts = shifts.filter((x) => x.t >= probe);
    const cls = stageShifts.reduce((n, x) => n + x.v, 0);
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
    await expect(page.locator('canvas')).toHaveCount(1);
    expect(await sameCanvas(page), 'proje sayfasında aynı canvas').toBe(true);
    await page.goBack();
    await page.waitForURL(/\/\?tier=high/);
    await waitForStagePhase(page, ['ready']);
    expect(await sameCanvas(page), 'geri dönüşte aynı canvas').toBe(true);
    expect((await readLive(page)).canvasKey, 'yeni bağlam kurulmadı').toBe(0);
  });

  test('K-HERO-6 hero-rest k8–12; alt kenarı H1 büyük harf çizgisinde (±4 px); D = 362 ± 4; poster nitelikleri', async ({
    page,
  }) => {
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    await waitForStoneStill(page);
    const geo = await page.evaluate(() => {
      const a = document.querySelector('[data-stage-anchor="hero-rest"]')!.getBoundingClientRect();
      const h1 = document.querySelector<HTMLElement>('[data-chapter="hero"] h1')!;
      const span = (css: string) => {
        const el = document.createElement('span');
        el.style.cssText = css;
        return el;
      };
      // taban çizgisi: sıfır yükseklikli inline-block; büyük harf yüksekliği: 1cap
      const base = span('display:inline-block;width:0;height:0;vertical-align:baseline');
      const cap = span('position:absolute;height:1cap');
      h1.prepend(base);
      h1.append(cap);
      const capLine = base.getBoundingClientRect().top - cap.getBoundingClientRect().height;
      base.remove();
      cap.remove();
      return { left: a.left, right: a.right, bottom: a.bottom, capLine };
    });
    // k8–12 = x 843–1376 (1440×900, §4.6.2)
    expect(Math.abs(geo.left - 843)).toBeLessThanOrEqual(2);
    expect(Math.abs(geo.right - 1376)).toBeLessThanOrEqual(2);
    expect(
      Math.abs(geo.bottom - geo.capLine),
      'çapa altı ↔ H1 büyük harf çizgisi',
    ).toBeLessThanOrEqual(4);
    const { stone } = await readLive(page);
    expect(Math.abs(2 * stone.r - 362), 'D').toBeLessThanOrEqual(4);
    const imgs = page.locator('.stage-poster img');
    expect(await imgs.count()).toBeGreaterThan(0);
    for (const img of await imgs.all()) {
      await expect(img).toHaveAttribute('alt', '');
      await expect(img).toHaveAttribute('width', /^\d+$/);
      await expect(img).toHaveAttribute('height', /^\d+$/);
      await expect(img).toHaveAttribute('loading', 'lazy');
      await expect(img).toHaveAttribute('fetchpriority', 'low');
    }
  });

  test('§5.19 çapa: K2 (1054, 481), K3 (1221, 702), K4 (1110, 450) ± 2 px; D tablo değerinin ± %2’si; V-45 Lenis kaydırma senkron', async ({
    page,
  }) => {
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    const cases = [
      { chapter: 'areas', cx: 1054, cy: 481, D: 515 },
      { chapter: 'work', cx: 1221, cy: 702, D: 207 },
      { chapter: 'journey', cx: 1110, cy: 450, D: 426 },
    ];
    for (const c of cases) {
      await test.step(c.chapter, async () => {
        await scrollToY(page, await chapterY(page, c.chapter));
        const { stone } = await readLive(page);
        expect
          .soft(Math.abs(stone.cx - c.cx), `${c.chapter} cx ${stone.cx}`)
          .toBeLessThanOrEqual(2);
        expect
          .soft(Math.abs(stone.cy - c.cy), `${c.chapter} cy ${stone.cy}`)
          .toBeLessThanOrEqual(2);
        expect
          .soft(Math.abs(2 * stone.r - c.D) / c.D, `${c.chapter} D ${2 * stone.r}`)
          .toBeLessThanOrEqual(0.02);
        // V-45: programatik window.scrollTo sonrası Lenis/director durumu senkron (±1 px)
        const [directorY, windowY] = [
          (await readStage(page)).scrollY,
          await page.evaluate(() => window.scrollY),
        ];
        expect.soft(Math.abs(directorY - windowY), 'V-45').toBeLessThanOrEqual(1);
      });
    }
  });

  test('§5.17 loseContext → posterler aynı karede; restoreContext → ready; ikinci kayıp → static, canvas yok', async ({
    page,
  }) => {
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    await expect.poll(() => heroPosterOpacity(page)).toBe('0');
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
      const poster = [
        ...document.querySelectorAll<HTMLElement>('[data-stage-anchor="hero-rest"] .stage-poster'),
      ].find((p) => getComputedStyle(p).display !== 'none')!;
      return {
        phase: document.getElementById('scene-layer')!.dataset.phase,
        opacity: getComputedStyle(poster).opacity,
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
    expect(await heroPosterOpacity(page)).toBe('1');
  });

  test('K-HERO-8 ışık taraması oturumda bir kez; derin bağlantıda ve duraklatılmışken oynamaz', async ({
    page,
    context,
  }) => {
    const sweepFlag = (p: Page) => p.evaluate(() => window.sessionStorage.getItem('os-sweep'));
    /** ready'den sonra 1.5 s boyunca |sweepAz|'ın en büyüğü (stageTarget) */
    const maxSweep = (p: Page) =>
      p.evaluate(async () => {
        type Stage = { target: { sweepAz: number } };
        let max = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < 1500) {
          max = Math.max(
            max,
            Math.abs((window as unknown as { __stage: Stage }).__stage.target.sweepAz),
          );
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        return max;
      });
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    await expect.poll(() => sweepFlag(page)).toBe('1');
    // aynı sekmede yeniden yükleme: oturumda bir kez
    await page.reload();
    await waitForStagePhase(page, ['ready']);
    expect(await maxSweep(page), 'ikinci yüklemede tarama').toBe(0);
    await page.goto('about:blank'); // idle drift'i süren sahne yazılım render'ında CPU'yu paylaşmasın
    // derin bağlantı: scrollY ≥ 0.2·innerHeight (yeni sekme = yeni oturum deposu)
    const deep = await context.newPage();
    await deep.goto(`${HIGH}#ben`);
    await waitForStagePhase(deep, ['ready'], 30_000);
    expect(await deep.evaluate(() => window.scrollY / window.innerHeight)).toBeGreaterThanOrEqual(
      0.2,
    );
    expect(await maxSweep(deep), 'derin bağlantıda tarama').toBe(0);
    expect(await sweepFlag(deep)).toBeNull();
    await deep.close();
    // duraklatılmış: ready'den önce durdurulur
    const paused = await context.newPage();
    await paused.goto(HIGH);
    await paused.getByRole('button', { name: 'Animasyonu durdur' }).click();
    expect((await readStage(paused)).phase).not.toBe('ready');
    await waitForStagePhase(paused, ['ready'], 30_000);
    expect(await maxSweep(paused), 'duraklatılmışken tarama').toBe(0);
    expect(await sweepFlag(paused)).toBeNull();
  });

  test('§5.19 ?tier=low|medium|high kademe tablosu (segment, oktav, ghost, dpr); K-HERO-9 idle drift medium ve high’da var, low’da yok; s = 100’de rotY 30 ± 1°', async ({
    page,
  }) => {
    for (const tier of ['low', 'medium', 'high'] as const) {
      await test.step(tier, async () => {
        await page.goto(`/?tier=${tier}&debug`);
        await waitForStagePhase(page, ['ready']);
        const a = await readLive(page);
        expect((await readStage(page)).tier).toBe(tier);
        expect(a.quality).toEqual(initialQuality(tier, 1));
        if (tier === 'low') {
          await pageDelay(page, 1500);
          expect((await readLive(page)).idleAngle, 'low: idle yok').toBe(0);
        } else {
          // idleS yumuşak açılır (SMOOTH_IDLE); SwiftShader'da dt 1/30 s'ye kırpıldığından hız < 2°/s
          await expect
            .poll(async () => Math.abs((await readLive(page)).idleAngle - a.idleAngle), {
              message: `${tier}: idle`,
              timeout: 6000,
            })
            .toBeGreaterThan(0.5);
        }
      });
    }
    // high: s = 100'de (K1b, hero dışında idle 0'a döner) rotY 30 ± 1°
    await scrollToSvh(page, 100);
    await expect
      .poll(async () => Math.abs((await readLive(page)).rotY - 30), { timeout: 10_000 })
      .toBeLessThanOrEqual(1);
  });

  test('K-HERO-9 idle drift son girdiden 20 s sonra durur (ince işaretçi); ardından kare çizilmez', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    await page.mouse.move(600, 300);
    await page.mouse.move(640, 320);
    const input = (await readLive(page)).lastInput;
    expect(input).toBeGreaterThan(0);
    // 20 s dolmadan hemen önce hâlâ döner
    await page.waitForFunction((t) => performance.now() > t + 18_500, input, { timeout: 40_000 });
    const a = await readLive(page);
    await pageDelay(page, 1000);
    // yavaş yazılım render'ında (CI ≈ 2 fps) açı birikimi kırpılmış dt ile çok yavaştır; duruştan sonra açı tam sabittir
    expect(
      Math.abs((await readLive(page)).idleAngle - a.idleAngle),
      '20 s dolmadan döner',
    ).toBeGreaterThan(0);
    // 20 s'de durur: hız zarfı gerçek süreyle söner (≈ 3 s); 1 s boyunca kare çizilmeyene kadar beklenir, açı sabittir.
    await expect
      .poll(
        async () => {
          const f = (await readLive(page)).frames;
          await pageDelay(page, 1000);
          return (await readLive(page)).frames - f;
        },
        { message: 'demand döngüsü: kare yok', timeout: 30_000, intervals: [0] },
      )
      .toBe(0);
    const b = await readLive(page);
    await pageDelay(page, 1000);
    expect((await readLive(page)).idleAngle, 'drift durdu').toBe(b.idleAngle);
  });

  test('§5.9.6 yakınlık eğimi: işaretçi Taş merkezine 1.5·r içindeyken ≤ 6°, kesik Taşta nefes; dışarıda 0', async ({
    page,
  }) => {
    test.setTimeout(120_000); // CI yazılım render'ında boot + damping dönüşü (≈ 15 s)
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    // about BODY: Taş kesik (cut < 1)
    await scrollToY(page, await chapterY(page, 'about'));
    const { stone } = await readLive(page);
    type Tilt = { x: number; y: number; breath: number };
    const tilt = () =>
      page.evaluate(
        () => (window as unknown as { __stage: { live: { tilt: Tilt } } }).__stage.live.tilt,
      );
    // sağ alt çeyrek, 0.6·r: nx = ny = 0.4 → hedef 2.4°
    await page.mouse.move(stone.cx + 0.6 * stone.r, stone.cy + 0.6 * stone.r);
    await expect.poll(async () => (await tilt()).y, { timeout: 10_000 }).toBeGreaterThan(1);
    const t = await tilt();
    expect(t.y).toBeLessThanOrEqual(6);
    expect(t.x).toBeGreaterThan(1);
    expect(t.x).toBeLessThanOrEqual(6);
    expect(t.breath).toBeLessThan(0);
    // 1.5·r dışında sıfıra döner. Damping adımı kare başına 1/30 s'ye kırpılır: CI'da (SwiftShader ≈ 2 fps) 10 s gerçek
    // zaman ≈ 0.7 s sönüm eder, dönüş ≈ 15 s sürer
    await page.mouse.move(stone.cx - 2 * stone.r - 40, stone.cy);
    await expect
      .poll(async () => Math.abs((await tilt()).y), { timeout: 40_000 })
      .toBeLessThan(0.05);
    expect(Math.abs((await tilt()).breath)).toBeLessThan(0.002);
  });

  test('K-HERO-10, K-VAR-2 (sahne): duraklatma idle drift’i durdurur, kaydırma scrub’ı sürer; yeniden yüklemede sıfırlanır', async ({
    page,
  }) => {
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    await page.getByRole('button', { name: 'Animasyonu durdur' }).click();
    await expect(page.getByRole('button', { name: 'Animasyonu başlat' })).toBeVisible();
    const a = await readLive(page);
    await pageDelay(page, 1000);
    const b = await readLive(page);
    expect(b.paused).toBe(true);
    expect(Math.abs(b.idleAngle - a.idleAngle), 'drift durdu').toBeLessThan(0.05);
    await scrollToSvh(page, 30);
    await expect
      .poll(async () => (await readLive(page)).rotYScroll, { timeout: 5000 })
      .toBeGreaterThan(b.rotYScroll + 1);
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

  // SPEC-SAPMA: §5.19 — "kapak rengi --color-surface ile ΔE < 2" rings desenine göredir; engineer personası geode
  // desenini kullanır (M1, issue #5) ve bant tonları capBase'i ringLine'a %15–70 karıştırır. Tema bağlaması bu yüzden
  // "çalışma anında tema değişimi = o temada doğrudan yükleme" olarak ölçülür.
  test('§5.6.6 tema değişimi uniform’ları bir karede günceller: çalışma anında koyu = doğrudan koyu yükleme (ΔE < 2)', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000); // iki tam sahne boot'u: CI yazılım render'ında 60 s'yi aşabiliyor
    await page.goto(HIGH);
    await waitForStagePhase(page, ['ready']);
    const y = await chapterY(page, 'journey');
    await scrollToY(page, y);
    const light = await stoneLab(page);
    await page.evaluate(async () => {
      document.documentElement.dataset.theme = 'dark';
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const switched = await stoneLab(page);
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
    });
    const direct = await ctx.newPage();
    await direct.goto(HIGH);
    await waitForStagePhase(direct, ['ready']);
    await scrollToY(direct, y);
    const dark = await stoneLab(direct);
    await ctx.close();
    expect(deltaE(light, dark), 'temalar ayrışır').toBeGreaterThan(10);
    expect(deltaE(switched, dark), 'çalışma anında koyu ↔ doğrudan koyu').toBeLessThan(2);
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
