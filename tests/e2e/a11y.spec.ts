// tests/e2e/a11y.spec.ts — axe (WCAG 2.2 AA etiketleri) 0 ihlal ve anlamsal yapı. Kapsam matrisi §13.4.1 (§10.6):
// sayfalar: sitemap + NOINDEX_PATHS (pagePaths) + ağaç 404'ü (/projeler/yok) + global-not-found (/yok, /en/yok);
// varyantlar: desktop-chromium ve pixel-7 varsayılan hareket; reduced-motion projesi ve pixel-7'de emulateMedia ile
// azaltılmış hareket; ek durumlar: mobil menü açık (pixel-7), filtre etkin, areas orta adım (desktop), forcedColors ve
// contrast: more (her route, desktop). v1.1 formu M9'da eklenir. Landmark ve başlık ağacı §10.4.1–§10.4.2.
import { allowConsole, expect, test } from './fixtures';
import { expectNoAxeViolations } from './helpers/axe';
import { settle } from './helpers/scroll';
import { pagePaths } from './helpers/urls';

const NOT_FOUND = ['/projeler/yok', '/yok', '/en/yok'] as const;

test.describe('§10.6 axe', { tag: ['@desktop-chromium', '@reduced-motion', '@pixel-7'] }, () => {
  test('her route 0 ihlal', async ({ page, request }) => {
    for (const path of await pagePaths(request)) {
      await test.step(path, async () => {
        await page.goto(path);
        await expectNoAxeViolations(page, path);
      });
    }
  });

  test('404 sayfaları (ağaç ve global) 0 ihlal', async ({ page }) => {
    allowConsole('404');
    for (const path of NOT_FOUND) {
      await page.goto(path);
      await expect(page.locator('[data-404]')).toHaveCount(1);
      await expectNoAxeViolations(page, path);
    }
  });

  test('filtre etkin', async ({ page }) => {
    await page.goto('/projeler');
    const chips = page.locator('[role="group"] button');
    if ((await chips.count()) > 1) await chips.nth(1).click(); // JS'siz çip yok (reduced-motion'da JS açık)
    await expectNoAxeViolations(page, 'filtre');
  });
});

test.describe('§10.6 axe: mobil', { tag: ['@pixel-7'] }, () => {
  test('menü açıkken 0 ihlal', async ({ page }) => {
    await page.goto('/hakkimda');
    await page.getByRole('button', { name: /menü/i }).click();
    await expectNoAxeViolations(page, 'menü');
  });

  test('azaltılmış hareket (emulateMedia): her route ve 404’ler 0 ihlal', async ({
    page,
    request,
  }) => {
    test.slow(); // her route + 404'ler (CI koşucusu yavaş)
    allowConsole('404');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const path of [...(await pagePaths(request)), ...NOT_FOUND]) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
        await expectNoAxeViolations(page, `${path} reduce`);
      });
    }
  });
});

test.describe('§10.6 axe: areas orta adım', { tag: ['@desktop-chromium'] }, () => {
  test('pin 2. adımın dwell ortasında (varsayılan içerikte s ≈ 330) 0 ihlal', async ({ page }) => {
    // sahne canvas'ı axe kapsamı dışındadır (#scene-layer); pin DOM'u kademeden bağımsızdır
    await page.goto('/?tier=static', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
    const areas = page.locator('[data-chapter="areas"]');
    await expect(areas.locator('[data-area-step]').first()).toBeVisible(); // pin modu
    // adım k'nın dwell ortası: sA(k) + 32.5 svh, sA(k) = T_areas + 10 + 50k (§4.8; reveal.spec ile aynı)
    await page.evaluate(() => {
      const s = document.querySelector<HTMLElement>('[data-chapter="areas"]')!;
      const top = s.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: top + ((10 + 50 + 32.5) * window.innerHeight) / 100,
        behavior: 'instant',
      });
    });
    await settle(page);
    await expect(areas.locator('[aria-current="step"][data-area-step]')).toHaveAttribute(
      'data-area-step',
      '1',
    );
    // görüntü alanındaki reveal tween'leri (GSAP, ≤ 700 ms; getAnimations'ta görünmez) bitene kadar
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter((el) => {
              const r = el.getBoundingClientRect();
              const o = getComputedStyle(el).opacity;
              return r.bottom > 0 && r.top < window.innerHeight && o !== '1' && o !== '0';
            }).length,
        ),
      )
      .toBe(0);
    await expectNoAxeViolations(page, 'areas orta adım');
  });
});

test.describe('§10.5 forcedColors ve contrast: more', { tag: ['@desktop-chromium'] }, () => {
  for (const media of [{ forcedColors: 'active' }, { contrast: 'more' }] as const) {
    test(`${Object.keys(media)[0]}: her route ve 404 0 ihlal`, async ({ page, request }) => {
      test.slow(); // her route + 404'ler (CI koşucusu yavaş)
      allowConsole('404');
      await page.emulateMedia(media);
      for (const path of [...(await pagePaths(request)), '/projeler/yok', '/yok']) {
        await test.step(path, async () => {
          await page.goto(path);
          await expectNoAxeViolations(page, `${path} ${JSON.stringify(media)}`);
        });
      }
    });
  }
});

test.describe('§10.4 landmark ve başlık ağacı', { tag: ['@desktop-chromium'] }, () => {
  test('her sayfada tek main, tek banner ve tek h1; başlık seviyesi atlanmaz; role="alert" yok', async ({
    page,
    request,
  }) => {
    test.slow(); // her route + 404'ler (CI koşucusu yavaş)
    allowConsole('404');
    for (const path of [...(await pagePaths(request)), ...NOT_FOUND]) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect.soft(page.getByRole('main'), 'main').toHaveCount(1);
        // global-not-found'da site header'ı yoktur (§3.7): banner yalnız orada 0'dır
        const global = (await page.locator('[data-404="global"]').count()) > 0;
        await expect.soft(page.getByRole('banner'), 'banner').toHaveCount(global ? 0 : 1);
        await expect.soft(page.getByRole('heading', { level: 1 }), 'h1').toHaveCount(1);
        // role="alert" yalnız v1.1 form gönderim hatasında (§10.4.5). querySelectorAll gölge DOM'a inmez: Next'in
        // duyurucusu (next-route-announcer, V-53) sayılmaz; Playwright'ın CSS motoru inerdi
        const alerts = await page.evaluate(
          () => document.querySelectorAll('[role="alert"]').length,
        );
        expect.soft(alerts, 'role=alert').toBe(0);
        const levels = await page.evaluate(() =>
          [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
            .filter((h) => !h.closest('[aria-hidden="true"], [hidden]'))
            .map((h) => Number(h.tagName[1])),
        );
        expect.soft(levels[0], 'ilk başlık h1').toBe(1);
        const skips = levels.flatMap((l, i) =>
          i > 0 && l > levels[i - 1]! + 1 ? [`h${levels[i - 1]} → h${l}`] : [],
        );
        expect.soft(skips, 'seviye atlaması').toEqual([]);
      });
    }
  });

  test('ana sayfa başlık ağacı §10.4.2 ile eşleşir; bölümler h2’leriyle etiketli', async ({
    page,
  }) => {
    for (const home of ['/', '/en']) {
      await test.step(home, async () => {
        await page.goto(home);
        const tree = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('#main [data-chapter]')].map((c) => {
            const hs = [...c.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(
              (h) => !h.closest('[aria-hidden="true"]'),
            );
            return {
              chapter: c.dataset.chapter ?? '',
              tags: hs.map((h) => h.tagName),
              labelledBy: c.getAttribute('aria-labelledby'),
              firstId: hs[0]?.id ?? null,
              areas: Number(c.dataset.areasN ?? 0),
              articles: c.querySelectorAll('[data-work-article]').length,
            };
          }),
        );
        const h1 = await page.getByRole('heading', { level: 1 }).textContent();
        expect(h1).toMatch(/Orçun/);
        for (const c of tree) {
          // bölüm başlığı (hero'da h1, diğerlerinde h2) bölümün erişilebilir adıdır (§10.4.1)
          expect.soft(c.labelledBy, `${c.chapter} aria-labelledby`).toBe(c.firstId);
          const [head, ...rest] = c.tags;
          expect.soft(head, `${c.chapter} başlığı`).toBe(c.chapter === 'hero' ? 'H1' : 'H2');
          expect
            .soft(
              rest.filter((t) => t !== 'H3'),
              `${c.chapter} alt başlıkları h3`,
            )
            .toEqual([]);
          if (c.chapter === 'areas') expect.soft(rest.length, 'areas h3 × N').toBe(c.areas);
          if (c.chapter === 'work') expect.soft(rest.length, 'work h3 × P').toBe(c.articles);
          if (c.chapter === 'journey') expect.soft(rest.length, 'journey h3').toBeGreaterThan(0);
          if (['hero', 'about', 'contact'].includes(c.chapter))
            expect.soft(rest, `${c.chapter} alt başlık yok`).toEqual([]);
        }
      });
    }
  });
});
