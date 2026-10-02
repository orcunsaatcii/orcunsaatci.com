// tests/e2e/transitions.spec.ts — route geçişleri (§4.13.3, §5.15; D-32): K-DEEP-7 kesim çizgisi, K-DEEP-6 paylaşılan
// öğe morph'u (≤ 400 ms) ve panelin süzülmesi ya da kesmesi, final.md §13 #1'in otomatik kısmı (WebKit'te 5 tur). M7'den
// ertelendi (§15.8.3 SPEC-SAPMA). Canvas gerektirmeyenler ?tier=static ile koşar; panel kararı canlı sahneyi okur
// (?debug&tier=high). Süreler kare hızından bağımsız okunur: örnekler arası en büyük boşluk kadar pay verilir (CI'da
// SwiftShader ≈ 2 fps). Geri/ileri kesmesi choreography.spec.ts K-CHOREO-5'te, azaltılmış hareket motion-preferences'tadır.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { settle } from './helpers/scroll';
import { readLive, readStage, waitForPanelStill, waitForStagePhase } from './helpers/stage';

interface CutCall {
  path: string;
  frames: Keyframe[];
  duration: number;
}
interface VtAnim {
  pe: string;
  end: number;
}
interface StageSample {
  t: number;
  from: number;
  mix: number;
  cut: number;
  path: string;
}
type RecWindow = Window & { __cut: CutCall[]; __vt: VtAnim[]; __st: StageSample[] };

/** NavCutLine'ın WAAPI çağrıları: Element.animate yakalanır (anahtar kareler, süre, çağrıldığı yol) */
function recordCutLine() {
  const w = window as unknown as RecWindow;
  w.__cut = [];
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (this: Element, frames, options) {
    if (this.classList.contains('nav-cut-line'))
      w.__cut.push({
        path: location.pathname,
        frames: JSON.parse(JSON.stringify(frames)) as Keyframe[],
        duration: typeof options === 'number' ? options : Number(options?.duration ?? 0),
      });
    return animate.call(this, frames, options);
  };
}

/**
 * View transition animasyonları: document.startViewTransition sarılır, geçiş hazır olunca (pseudo-element ağacı ve
 * animasyonları kurulmuştur) pseudo-element ve bitiş anı (gecikme + süre) okunur. Kare taraması güvenilir değil:
 * Chromium'da animasyonlar en fazla bir rAF örneğinde görünüyor.
 */
function recordVt() {
  const w = window as unknown as RecWindow;
  w.__vt = [];
  const start = document.startViewTransition?.bind(document);
  if (!start) return;
  document.startViewTransition = ((arg?: Parameters<typeof start>[0]) => {
    const vt = start(arg);
    void vt.ready.then(
      () => {
        for (const a of document.getAnimations()) {
          const e = a.effect as KeyframeEffect | null;
          const pe = e?.pseudoElement ?? '';
          if (!e || !pe.includes('view-transition')) continue;
          const t = e.getTiming();
          w.__vt.push({ pe, end: Number(t.delay ?? 0) + Number(t.duration) });
        }
      },
      () => {},
    );
    return vt;
  }) as typeof document.startViewTransition;
}

/** Sahne hedefinin kare örnekleri (?debug): çapa çifti (anchorFrom −1 = route süzülmesi), köprü, kesme çarpanı */
function recordStage() {
  type W = RecWindow & { __stage?: { target: Record<string, number> } };
  const w = window as unknown as W;
  w.__st = [];
  const tick = () => {
    const s = w.__stage?.target;
    if (s)
      w.__st.push({
        t: performance.now(),
        from: s.anchorFrom ?? 0,
        mix: s.anchorMix ?? 0,
        cut: s.opacityCut ?? 1,
        path: location.pathname,
      });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const rec = <K extends keyof RecWindow>(page: Page, key: K) =>
  page.evaluate((k) => (window as unknown as RecWindow)[k], key) as Promise<RecWindow[K]>;
const clearStage = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as RecWindow).__st.length = 0;
  });
/** a ile b örnekleri (dahil) ve komşuları arasındaki en büyük örnek boşluğu (ms): kare hızı payı */
const gapAround = (s: StageSample[], a: StageSample, b: StageSample) => {
  const i0 = Math.max(1, s.indexOf(a));
  const i1 = Math.min(s.length - 1, s.indexOf(b) + 1);
  let m = 0;
  for (let i = i0; i <= i1; i++) m = Math.max(m, (s[i]?.t ?? 0) - (s[i - 1]?.t ?? 0));
  return m;
};
const sceneOpacity = (page: Page) =>
  page.evaluate(() =>
    Number.parseFloat(getComputedStyle(document.getElementById('scene-layer')!).opacity),
  );
/** Çapadaki görünür statik panelin dikdörtgeni: canlı panel aynı kutuya oturur (§5.20.4) */
const staticRect = (page: Page, anchor: string) =>
  page.evaluate((id) => {
    const el = [
      ...document.querySelectorAll<HTMLElement>(`[data-stage-anchor="${id}"] .kod-panel`),
    ].find((p) => getComputedStyle(p).visibility !== 'hidden' && p.getClientRects().length > 0);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, anchor);

test.describe('§4.13.3 route geçişleri', { tag: ['@desktop-chromium', '@iphone-15'] }, () => {
  test('K-DEEP-7 kesim çizgisi: tıklamada 300 ms’de scaleX 0 → 0.7; yeni route’ta 1’e gider ve 160 ms’de söner', async ({
    page,
  }) => {
    await page.addInitScript(recordCutLine);
    await page.goto('/projeler?tier=static', { waitUntil: 'networkidle' });
    const link = page.locator('main li[data-project] a').first();
    const href = (await link.getAttribute('href')) ?? '';
    await link.click();
    await page.waitForURL((u) => u.pathname === href);
    const line = page.locator('body > header .nav-cut-line');
    await expect.poll(() => line.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    const calls = await rec(page, '__cut');
    expect(calls.map((c) => c.path)).toEqual(['/projeler', href]);
    const [grow, finish] = calls as [CutCall, CutCall];
    expect(grow.duration, 'büyüme 300 ms').toBe(300);
    expect(grow.frames.map((f) => f.transform)).toEqual(['scaleX(0)', 'scaleX(0.7)']);
    expect(finish.frames[0]?.transform, 'yeni route: 0.7’den').toBe('scaleX(0.7)');
    const full = finish.frames.find((f) => f.transform === 'scaleX(1)' && Number(f.opacity) === 1);
    const last = finish.frames.at(-1);
    expect(full, 'çizgi scaleX 1’e varır').toBeDefined();
    expect([last?.transform, Number(last?.opacity)], 'sonunda tam ve sönük').toEqual([
      'scaleX(1)',
      0,
    ]);
    expect(Math.round(finish.duration * (1 - Number(full?.offset ?? 0))), 'sönme 160 ms').toBe(160);
    await page.waitForLoadState('networkidle');
  });

  test('K-DEEP-6 ana sayfa → proje: kapak ve başlık paylaşılan öğe olarak morph eder (≤ 400 ms); header hareket etmez', async ({
    page,
  }, info) => {
    await page.addInitScript(recordVt);
    await page.goto('/?tier=static', { waitUntil: 'networkidle' });
    const supported = await page.evaluate(() => 'startViewTransition' in document);
    test.skip(!supported, `${info.project.name}: View Transitions API yok`);
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
    // kaynak: work'teki 2. makale ve (görüntüleyicide) onun açık figürü; bağlantı görünümdeyken önceden yüklenir
    const article = page.locator('[data-work-article]').nth(1);
    await article.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await settle(page);
    // başlığın satır reveal'ı bitip özgün DOM geri gelmeli: SplitText satırları (blok) adlandırılmış satır içi <span>'ı
    // parçalar ve Chromium parçalı öğeyi yakalamaz (başlık morph etmez, yalnız girer)
    await expect(article.locator('h3.is-revealed')).toHaveCount(1);
    await expect(article.locator('.split-line')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    const link = article.locator('a[href^="/projeler/"]');
    const href = (await link.getAttribute('href')) ?? '';
    const slug = href.split('/').at(-1) ?? '';
    await link.click();
    await page.waitForURL((u) => u.pathname === href);
    await expect(page.locator('main h1')).toBeFocused();
    await page.waitForLoadState('networkidle');
    const vt = await rec(page, '__vt');
    info.annotations.push({ type: 'K-DEEP-6 VT', description: JSON.stringify(vt) });
    for (const name of [`project-cover-${slug}`, `project-title-${slug}`]) {
      const group = vt.filter((a) => a.pe === `::view-transition-group(${name})`);
      expect.soft(group.length, `${name}: morph grubu animasyonu`).toBeGreaterThan(0);
      for (const a of group) expect.soft(a.end, `${name} süresi`).toBe(400);
    }
    expect
      .soft(Math.max(...vt.map((a) => a.end)), 'geçişin tamamı ≤ 400 ms')
      .toBeLessThanOrEqual(400);
    expect
      .soft(
        vt.filter((a) => a.pe.includes('(site-header)')),
        'header animasyonsuz',
      )
      .toEqual([]);
    expect
      .soft(
        vt.filter((a) => a.pe.includes('(scene)')),
        'sahne katmanı animasyonsuz',
      )
      .toEqual([]);
  });
});

test.describe('§5.15.3 panel: süzülme ya da kesme (?debug)', { tag: ['@desktop-chromium'] }, () => {
  test('K-DEEP-6 panel iki tarafta görünürken ≈ 700 ms süzülür (kesmesiz); eski sayfada gizliyse keser ve 300 ms’de belirir', async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await page.addInitScript(recordStage);
    await page.goto('/?debug&tier=high');
    await waitForStagePhase(page, ['ready'], 30_000);
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
    await page.evaluate(() =>
      document
        .querySelector<HTMLElement>('[data-stage-debug]')
        ?.style.setProperty('display', 'none'),
    );

    // süzülme: ana sayfa about (about.dart görünür) → /hakkimda (çapa ilk görünümde)
    const more = page.locator('[data-chapter="about"] a[href="/hakkimda"]');
    await more.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await settle(page);
    await waitForPanelStill(page);
    expect((await readLive(page)).panel.visible, 'about’ta panel görünür').toBe(true);
    expect(await sceneOpacity(page)).toBeGreaterThan(0.01);
    await page.waitForLoadState('networkidle');
    await clearStage(page);
    await more.click();
    await page.waitForURL((u) => u.pathname === '/hakkimda');
    await expect
      .poll(
        async () => {
          const s = await rec(page, '__st');
          return s.some((r) => r.from === -1) && s.at(-1)?.from !== -1;
        },
        { message: 'süzülme başlar ve biter', timeout: 15_000 },
      )
      .toBe(true);
    await settle(page);
    await waitForPanelStill(page);
    let s = await rec(page, '__st');
    const glide = s.filter((r) => r.from === -1);
    const dur = (glide.at(-1)?.t ?? 0) - (glide[0]?.t ?? 0);
    const gap = gapAround(s, glide[0]!, glide.at(-1)!);
    info.annotations.push({
      type: 'K-DEEP-6 süzülme (ms)',
      description: `${dur} (kare boşluğu ${gap})`,
    });
    expect
      .soft(Math.abs(dur - 700), `süzülme ${dur} ms (kare boşluğu ${gap} ms)`)
      .toBeLessThanOrEqual(2 * gap + 20);
    expect
      .soft(Math.min(...s.map((r) => r.cut)), 'süzülmede kesme yok')
      .toBeGreaterThanOrEqual(0.99);
    const live = await readLive(page);
    const still = await staticRect(page, 'page-folio');
    expect(still, '/hakkimda statik paneli').not.toBeNull();
    for (const k of ['x', 'y', 'w', 'h'] as const)
      expect.soft(Math.abs(live.panel[k] - still![k]), `varış ${k}`).toBeLessThanOrEqual(2);
    expect.soft(live.kod.key, 'about-page programı').toMatch(/^about:/);
    await page.waitForLoadState('networkidle');

    // kesme: ana sayfa work (sahne sönük, K-WORK-6) → proje sayfası (çapa ilk görünümde)
    await page.goto('/?debug&tier=high');
    await waitForStagePhase(page, ['ready'], 30_000);
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
    const article = page.locator('[data-work-article]').nth(1);
    await article.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await settle(page);
    await expect
      .poll(() => sceneOpacity(page), { message: 'work’te sahne sönük' })
      .toBeLessThanOrEqual(0.01);
    await page.waitForLoadState('networkidle');
    await clearStage(page);
    const link = article.locator('a[href^="/projeler/"]');
    const href = (await link.getAttribute('href')) ?? '';
    await link.click();
    await page.waitForURL((u) => u.pathname === href);
    await expect
      .poll(
        async () => {
          const st = await rec(page, '__st');
          return st.some((r) => r.cut <= 0.01) && (st.at(-1)?.cut ?? 0) >= 0.999;
        },
        { message: 'kesme biter', timeout: 15_000 },
      )
      .toBe(true);
    s = await rec(page, '__st');
    const lastZero = s.filter((r) => r.cut <= 0.01).at(-1)!;
    const back = s.find((r) => r.t > lastZero.t && r.cut >= 0.99)!;
    const g2 = gapAround(s, lastZero, back);
    info.annotations.push({
      type: 'K-DEEP-6 kesme belirmesi (ms)',
      description: `${back.t - lastZero.t} (kare boşluğu ${g2})`,
    });
    expect.soft(s.filter((r) => r.from === -1).length, 'gizli eski karede süzülme yok').toBe(0);
    expect.soft(back.t - lastZero.t, 'belirme ≤ 300 ms').toBeLessThanOrEqual(300 + g2 + 20);
    expect.soft((await readStage(page)).preset).toBe('folio');
    expect.soft(await sceneOpacity(page), 'proje sayfasında panel görünür').toBeGreaterThan(0.99);
    await page.waitForLoadState('networkidle');
  });
});

test.describe('final.md §13 #1 WebKit dayanıklılığı', { tag: ['@iphone-15'] }, () => {
  test('5 tur ana sayfa → proje → ana sayfa: faz ready, tek canvas, bağlam yeniden kurulmaz, konsol hatası yok', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto('/?tier=medium&debug', { waitUntil: 'networkidle' });
    await waitForStagePhase(page, ['ready'], 30_000);
    const work = page.locator('[data-work-article] a[href^="/projeler/"]');
    for (let i = 0; i < 5; i++) {
      await test.step(`tur ${i + 1}`, async () => {
        const link = work.nth(i % (await work.count()));
        const href = (await link.getAttribute('href')) ?? '';
        await link.scrollIntoViewIfNeeded();
        await page.waitForLoadState('networkidle');
        await link.click();
        await page.waitForURL((u) => u.pathname === href);
        await expect(page.locator('main h1')).toBeFocused();
        // ağ durulunca ayrılınır: yarıda kesilen /_next/image isteği next start'ta URL'yi kilitler (a11y-focus notu)
        await page.waitForLoadState('networkidle');
        await page.locator('body > header a[href="/"]').first().click();
        await page.waitForURL((u) => u.pathname === '/');
        await page.waitForLoadState('networkidle');
        expect((await readStage(page)).phase).toBe('ready');
      });
    }
    await expect(page.locator('#scene-layer canvas')).toHaveCount(1);
    const live = await readLive(page);
    expect(live.canvasKey, 'bağlam yeniden kurulmadı').toBe(0);
    expect(live.contextLosses, 'bağlam kaybı yok').toBe(0);
  });
});
