// tests/e2e/navigation.spec.ts — geri/ileri ve bölüm çapaları (§5.13.4, §5.15.3; V-51, V-52). M7'de minimal kapsam
// (sahibin kararı, 2026-10-01): her ana sayfa bölümü için header çapasıyla atla → bölümdeki derin sayfa bağlantısına
// git → geri: kalınan yer ± 2 svh korunur; ileri: derin sayfa en üstte açılır. Geçiş animasyonlarının kendisi
// (transitions.spec.ts) M8'dedir. Sahne kesmesinin süreleri choreography.spec.ts K-CHOREO-5'tedir. Header göstergeleri
// (M8): halka (K-MICRO-6) ve etkin nav öğesi / noktası (K-MICRO-7).
import { expect, test } from './fixtures';
import { settle } from './helpers/scroll';

const CHAPTERS = [
  ['about', 'ben'],
  ['areas', 'alanlar'],
  ['work', 'projeler'],
  ['journey', 'yolculuk'],
  ['contact', 'iletisim'],
] as const;

test.describe('§5.15.3 geri/ileri: bölüm çapaları', { tag: ['@desktop-chromium'] }, () => {
  for (const [chapter, anchor] of CHAPTERS) {
    test(`V-52 #${anchor}: derin sayfadan geri dönünce konum korunur, ileri en üstte`, async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
      await page.locator(`header a[href="#${anchor}"]`).first().click();
      await page.waitForFunction(
        (id) => {
          const el = document.getElementById(id);
          if (!el) return false;
          const pad =
            Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
          return Math.abs(el.getBoundingClientRect().top - pad) <= 2;
        },
        anchor,
        { timeout: 10_000 },
      );
      await settle(page);
      const before = await page.evaluate(() => window.scrollY);
      const vh = await page.evaluate(() => window.innerHeight);
      // bölümün içindeki son dahili (hash'siz) derin sayfa bağlantısı
      const link = page.locator(`[data-chapter="${chapter}"] a[href^="/"]:not([href*="#"])`).last();
      test.skip((await link.count()) === 0, `${chapter}: derin sayfa bağlantısı yok`);
      const href = await link.getAttribute('href');
      await link.scrollIntoViewIfNeeded();
      const at = await page.evaluate(() => window.scrollY);
      await link.click();
      await page.waitForURL((u) => u.pathname === href?.split('?')[0]);
      await settle(page);
      await page.goBack();
      await page.waitForURL((u) => u.pathname === '/');
      await settle(page);
      const back = await page.evaluate(() => window.scrollY);
      // bağlantı görünüme getirilirken kaydırma değişmiş olabilir: geri dönüş tıklamadaki konuma döner
      expect
        .soft(Math.abs(back - at), `geri: ${back} ≠ ${at} (çapa ${before})`)
        .toBeLessThanOrEqual(0.02 * vh);
      await page.goForward();
      await page.waitForURL((u) => u.pathname === href?.split('?')[0]);
      await settle(page);
      expect(await page.evaluate(() => window.scrollY), 'ileri: en üstte').toBeLessThanOrEqual(2);
    });
  }
});

test.describe('§4.14.4 halka ve §4.14 #11 etkin nav', { tag: ['@desktop-chromium'] }, () => {
  test('K-MICRO-6 halka aria-hidden; yay 360°·ilerleme ±1°, çentikler bölüm başlarında ±1°, derin sayfada çentik yok; K-MICRO-7 aria-current ve nokta', async ({
    page,
  }) => {
    await page.goto('/?tier=static', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
    const ring = page.locator('body > header svg.halka-indicator').locator('visible=true');
    await expect(ring).toHaveAttribute('aria-hidden', 'true');
    const nav = page.locator('body > header nav ul.nav-dot');
    await nav.locator('a[href="#yolculuk"]').click();
    await expect(page).toHaveURL(/#yolculuk$/);
    await settle(page);
    /** halkanın açıları (saat 12'den saat yönünde, derece) ve beklenenler (§4.14.4 tanımı) */
    const angles = () =>
      ring.evaluate((el) => {
        const svg = el as unknown as SVGSVGElement;
        const deg = (x: number, y: number) => ((Math.atan2(y, x) * 180) / Math.PI + 450) % 360;
        const c = svg.viewBox.baseVal.width / 2;
        const [, arc, ...rest] = [...svg.querySelectorAll('circle')];
        const tip = rest.at(-1)!;
        const R = arc!.r.baseVal.value;
        const off = Number(arc!.getAttribute('stroke-dashoffset'));
        const max = document.documentElement.scrollHeight - window.innerHeight;
        return {
          arc: 360 * (1 - off / (2 * Math.PI * R)),
          tip: deg(tip.cx.baseVal.value - c, tip.cy.baseVal.value - c),
          want: (360 * window.scrollY) / max,
          ticks: [...svg.querySelectorAll('line')].map((l) =>
            deg(
              (l.x1.baseVal.value + l.x2.baseVal.value) / 2 - c,
              (l.y1.baseVal.value + l.y2.baseVal.value) / 2 - c,
            ),
          ),
          starts: [...document.querySelectorAll<HTMLElement>('#main [data-chapter]')]
            .filter((el) => el.dataset.chapter !== 'hero')
            .map((el) => (360 * (el.getBoundingClientRect().top + window.scrollY)) / max),
        };
      });
    const a = await angles();
    expect.soft(Math.abs(a.arc - a.want), `yay ${a.arc}° ≠ ${a.want}°`).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(a.tip - a.want), `uç ${a.tip}° ≠ ${a.want}°`).toBeLessThanOrEqual(1);
    expect(a.ticks.length, 'her bölüm başında bir çentik').toBe(a.starts.length);
    a.ticks.forEach((t, i) =>
      expect.soft(Math.abs(t - (a.starts[i] ?? 0)), `çentik ${i}`).toBeLessThanOrEqual(1),
    );

    // K-MICRO-7: scroll-spy tek öğeye aria-current="true" yazar; nokta o öğenin altına kayar (400 ms)
    await expect(nav.locator('a[aria-current]')).toHaveCount(1);
    await expect(nav.locator('a[href="#yolculuk"]')).toHaveAttribute('aria-current', 'true');
    const dot = () =>
      nav.evaluate((ul) => {
        const a = ul.querySelector('[aria-current]')!.getBoundingClientRect();
        const cs = getComputedStyle(ul, '::after');
        const x =
          ul.getBoundingClientRect().left +
          Number.parseFloat(cs.left) +
          Number.parseFloat(cs.translate) +
          Number.parseFloat(cs.width) / 2;
        return { off: Math.abs(x - (a.left + a.width / 2)), opacity: cs.opacity };
      });
    await expect
      .poll(async () => (await dot()).off, { message: 'nokta etkin öğenin ortasında' })
      .toBeLessThanOrEqual(1);
    expect((await dot()).opacity).toBe('1');

    // route sayfası: aria-current="page"; derin sayfada halka yalnız ilerleme gösterir ([SABİT] #15)
    await page.goto('/projeler', { waitUntil: 'networkidle' });
    await expect(nav.locator('a[aria-current]')).toHaveCount(1);
    await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute('href', '/projeler');
    await expect(ring.locator('line')).toHaveCount(0);
  });
});
