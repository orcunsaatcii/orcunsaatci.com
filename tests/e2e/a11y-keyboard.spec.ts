// tests/e2e/a11y-keyboard.spec.ts — klavye (§10.3, §10.6). İlk Tab SkipLink; route sonrası odak h1 (view transition
// açıkken, ileri ve geri türüyle; §15.8.1 #7); çapa sonrası odak bölümün h2'sinde (scrollToChapter, §10.3.2); areas
// atlama bağlantısı ve adım düğmeleri (pin, §10.3.4); filtre aria-pressed + durum metni; ana sayfada 200 Tab boyunca
// tuzak ve görünmez durak yok. Mikro etkileşimlerin klavye eşdeğeri ve tavanları (K-MICRO-3/4/5). Menü: mobile.spec.ts.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { settle } from './helpers/scroll';
import { pageDelay } from './helpers/stage';

const tabKey = (page: Page) =>
  page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab';

/** document.startViewTransition çağrılarının türleri (React <Link transitionTypes>); API yoksa null */
function recordVtTypes() {
  const w = window as unknown as { __vtTypes: string[][] | null };
  w.__vtTypes = null;
  if (!('startViewTransition' in document)) return;
  const start = document.startViewTransition.bind(document);
  w.__vtTypes = [];
  document.startViewTransition = ((arg?: Parameters<typeof start>[0]) => {
    const types = arg && typeof arg === 'object' && 'types' in arg ? [...(arg.types ?? [])] : [];
    w.__vtTypes?.push(types);
    return start(arg);
  }) as typeof document.startViewTransition;
}

test.describe('§10.3 klavye', { tag: ['@desktop-chromium', '@pixel-7', '@iphone-15'] }, () => {
  test('ilk Tab SkipLink; Enter odağı #main’e taşır', async ({ page }) => {
    await page.goto('/hakkimda', { waitUntil: 'networkidle' });
    await page.keyboard.press(tabKey(page));
    const skip = page.locator('a[href="#main"]').first();
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('client navigasyonundan sonra odak yeni sayfanın h1’inde: view transition açıkken ileri ve geri', async ({
    page,
  }) => {
    await page.addInitScript(recordVtTypes);
    await page.goto('/projeler', { waitUntil: 'networkidle' });
    const first = page.locator('main li[data-project] a').first();
    const href = await first.getAttribute('href');
    await first.click();
    await expect(page).toHaveURL((url) => url.pathname === href);
    await expect(page.locator('main h1')).toBeFocused();
    await page.waitForLoadState('networkidle'); // yarıda kesilen görsel isteği bırakılmaz (a11y-focus notu)
    // geri: breadcrumb (nav-back)
    await page.locator('main nav[aria-label="Sayfa konumu"] a[href="/projeler"]').click();
    await expect(page).toHaveURL((url) => url.pathname === '/projeler');
    await expect(page.locator('main h1')).toBeFocused();
    const types = await page.evaluate(
      () => (window as unknown as { __vtTypes: string[][] | null }).__vtTypes,
    );
    // odak sözleşmesi geçişle birlikte koşar (D-32): iki gezinme de türlü view transition başlattı
    if (types !== null) expect(types).toEqual([['nav-forward'], ['nav-back']]);
    await page.waitForLoadState('networkidle');
  });

  test('filtre: aria-pressed ve role="status" metni değişir, URL paylaşılabilir', async ({
    page,
  }) => {
    await page.goto('/projeler', { waitUntil: 'networkidle' });
    const chips = page.locator('[role="group"] button');
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
    const status = page.getByRole('status').first();
    const before = await status.textContent();
    await chips.nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/\?alan=/);
    const after = await status.textContent();
    expect(after).not.toBeNull();
    if (before === after) expect(await page.locator('li[data-project][hidden]').count()).toBe(0);
    else expect(await page.locator('li[data-project][hidden]').count()).toBeGreaterThan(0);
  });
});

test.describe('§10.3 klavye: ana sayfa', { tag: ['@desktop-chromium'] }, () => {
  test('çapa sonrası odak bölümün h2’sinde; sıralı odak hedef bölümden devam eder', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
    await page.locator('body > header nav a[href="#yolculuk"]').click();
    await expect(page).toHaveURL(/#yolculuk$/);
    await expect(page.locator('#yolculuk h2')).toBeFocused({ timeout: 5000 });
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(
      () => !!document.activeElement?.closest('#yolculuk, #yolculuk ~ *'),
    );
    expect(inside).toBe(true);
  });

  test('areas: atlama bağlantısı ilk durak, #projeler’e gider; adım düğmeleri aria-current taşır', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
    const areas = page.locator('[data-chapter="areas"]');
    const steps = areas.locator('[data-area-step]');
    await expect(steps.first()).toBeVisible(); // pin istemcide doğrulandı
    const first = await areas.evaluate(
      (s) =>
        s.querySelector<HTMLElement>('a[href], button:not([disabled])')?.getAttribute('href') ?? '',
    );
    expect(first).toBe('#projeler');
    // adım düğmesi: Enter adıma kaydırır, adım etkin olur
    const last = steps.last();
    await last.focus();
    await page.keyboard.press('Enter');
    await expect(last).toHaveAttribute('aria-current', 'step', { timeout: 5000 });
    await expect(areas.locator('[aria-current="step"][data-area-step]')).toHaveCount(1);
    // K-AREAS-8: açıklamalar aria-hidden / inert değildir; etkin olmayana gelen odak onu anında (geçişsiz) görünür
    // kılar, odaklı öğe hiçbir an opacity: 0 kalmaz (§10.3.4)
    await expect(
      areas.locator('[data-area-desc][aria-hidden], [data-area-desc][inert]'),
    ).toHaveCount(0);
    const j = await areas
      .locator('[data-area-desc]:not([data-active])')
      .first()
      .getAttribute('data-area-desc');
    const desc = areas.locator(`[data-area-desc="${j}"]`);
    await desc.locator('a').first().focus();
    expect(await desc.evaluate((d) => getComputedStyle(d).opacity)).toBe('1');
    // atlama bağlantısı: sonraki bölümün h2'sine odak
    await areas.locator('a[data-skip-section]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#projeler$/);
    await expect(page.locator('#projeler h2')).toBeFocused({ timeout: 5000 });
  });

  test('200 Tab: görünmez durak yok, tuzak yok (döngü SkipLink’e ya da body’ye döner)', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    let wrapped = false;
    for (let i = 0; i < 200; i++) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return { body: true, invisible: null, skip: false };
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const invisible =
          (r.width === 0 && r.height === 0) ||
          cs.visibility === 'hidden' ||
          Number(cs.opacity) === 0
            ? `${el.tagName} ${el.textContent?.trim().slice(0, 30)}`
            : null;
        return { body: false, invisible, skip: el.getAttribute('href') === '#main' };
      });
      expect.soft(stop.invisible, `durak ${i}`).toBeNull();
      if (i > 0 && (stop.body || stop.skip)) {
        wrapped = true;
        break;
      }
    }
    expect(wrapped, 'odak döngüsü başa döner').toBe(true);
  });
});

test.describe(
  '§4.14.1 mikro etkileşimler: klavye eşdeğeri ve tavanlar',
  { tag: ['@desktop-chromium'] },
  () => {
    test('K-MICRO-4 manyetik yalnız 4 öğede: işaretçide etiket kayar (≤ 14 px), tıklama kutusu sabit; K-MICRO-3 klavye odağında kayma yok', async ({
      page,
    }) => {
      await page.goto('/?tier=static', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
      // iki hero CTA, Kopyala, e-posta (§4.14.3); ana sayfada gizli tam footer'ın Kopyala'sı sayılmaz
      await expect(page.locator('[data-magnetic]').locator('visible=true')).toHaveCount(4);
      const outer = page.locator('[data-chapter="hero"] [data-magnetic]').first();
      const host = outer.locator('xpath=ancestor::*[self::a or self::button][1]');
      await pageSettle(page); // hero reveal'ları biter: kutu ölçümü kaymaz
      const box = (await host.boundingBox())!;
      await page.mouse.move(box.x + box.width + 12, box.y + box.height + 12, { steps: 4 }); // etkinleşme alanı
      const total = () =>
        outer.evaluate((o) => {
          const m = (el: Element) => new DOMMatrix(getComputedStyle(el).transform);
          const [a, b] = [m(o), m(o.firstElementChild!)];
          return Math.max(Math.abs(a.m41 + b.m41), Math.abs(a.m42 + b.m42)); // eksen başına ±14 px
        });
      await expect.poll(total, { message: 'etiket işaretçiye doğru kayar' }).toBeGreaterThan(4);
      await page.mouse.move(box.x + box.width + 20, box.y + box.height + 20, { steps: 2 });
      await pageSettle(page);
      expect(await total(), 'toplam kayma ≤ 14 px').toBeLessThanOrEqual(14.01);
      const during = (await host.boundingBox())!;
      for (const k of ['x', 'y', 'width', 'height'] as const)
        expect(Math.abs(during[k] - box[k]), `tıklama kutusu yerinde (${k})`).toBeLessThanOrEqual(
          0.5,
        );
      // işaretçi uzaklaşınca döner; klavye odağı hiçbir öğeyi oynatmaz
      await page.mouse.move(box.x + box.width + 300, box.y - 300, { steps: 4 }); // pencere içinde
      await expect.poll(total, { message: 'alan dışında 0.6 s’de döner' }).toBeLessThan(0.01);
      await host.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(host).toBeFocused();
      await pageSettle(page);
      expect(await total(), 'klavye odağında kayma yok').toBe(0);
    });

    test('K-MICRO-3 proje satırının hover efekti :focus-visible ile de; K-MICRO-5 kayma ≤ 12 px, etkileşim süreleri ≤ 600 ms; K-MICRO-1 imleç', async ({
      page,
    }) => {
      await page.goto('/projeler', { waitUntil: 'networkidle' });
      const row = page.locator('main li[data-project]').first();
      const link = row.locator('a').first();
      // başlık bloğunun DOM kayması (translate): durağan konuma göre
      const left = () => row.evaluate((li) => li.querySelector('h2')!.getBoundingClientRect().left);
      const rest = await left();
      const titleShift = async () => Math.round(((await left()) - rest) * 100) / 100;
      // §4.14 #21: başlık 8 px içeri (≤ 12 px tavanı, K-MICRO-5)
      await row.hover();
      await expect.poll(titleShift, { message: 'hover: başlık 8 px içeri' }).toBe(8);
      await page.mouse.move(4, 4);
      await expect.poll(titleShift).toBe(0);
      // klavye: son filtre çipinden Tab ilk satıra gelir
      await page.locator('[role="group"] button').last().focus();
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      await expect.poll(titleShift, { message: ':focus-visible aynı kaymayı verir' }).toBe(8);

      // K-MICRO-5: etkileşimli öğelerin ve içlerinin geçiş/animasyon süreleri (gecikme dahil) ≤ 600 ms. Reveal'lar ve
      // dekoratif paneller mikro etkileşim değildir (§6.5.2).
      for (const path of ['/projeler', '/?tier=static']) {
        if (path !== '/projeler') await page.goto(path, { waitUntil: 'networkidle' });
        const slow = await page.evaluate(() => {
          const sec = (v: string) =>
            v
              .split(',')
              .map((x) => (x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000));
          const longest = (dur: string, delay: string) => {
            const d = sec(dur);
            const l = sec(delay);
            return Math.max(...d.map((x, i) => x + (l[i % l.length] ?? 0)));
          };
          const sel =
            'a, button, label, [data-focus-ring], a *, button *, label *, [data-focus-ring] *';
          return [...document.querySelectorAll<HTMLElement>(sel)]
            .filter((el) => !el.matches('[data-reveal]') && !el.closest('.kod-panel'))
            .map((el) => {
              const cs = getComputedStyle(el);
              const ms = Math.max(
                longest(cs.transitionDuration, cs.transitionDelay),
                cs.animationName === 'none' ? 0 : longest(cs.animationDuration, cs.animationDelay),
              );
              return { el: `${el.tagName}.${el.getAttribute('class') ?? ''}`.slice(0, 80), ms };
            })
            .filter((x) => x.ms > 600);
        });
        expect.soft(slow, `${path}: > 600 ms mikro etkileşim`).toEqual([]);
        // K-MICRO-1 (hesaplanmış stil): hiçbir öğe imleci gizlemez
        const hidden = await page.evaluate(
          () =>
            [...document.querySelectorAll('*')].filter(
              (el) => getComputedStyle(el).cursor === 'none',
            ).length,
        );
        expect.soft(hidden, `${path}: cursor: none`).toBe(0);
      }
    });
  },
);

/** Mikro etkileşim tween'leri (≤ 0.6 s) ve sayfa kaydırması durulur */
async function pageSettle(page: Page): Promise<void> {
  await pageDelay(page, 700);
  await settle(page);
}
