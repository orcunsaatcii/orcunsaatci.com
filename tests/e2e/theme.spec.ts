// tests/e2e/theme.spec.ts — head script, tema tercihi ve tasarım sistemi kabulleri
// (§6.3.5, §6.12, §8.4, §8.9; D-20, D-21, D-38, D-39).
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { palettes } from '../../src/design/tokens';
import { headScript, STORAGE_KEYS } from '../../src/lib/head-script';
import { allowConsole, expect, test } from './fixtures';
import { waitForAnimations } from './helpers/axe';
import { pagePaths } from './helpers/urls';

const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};
const DARK_CANVAS = rgb(palettes.mekanizma.dark.canvas);

interface DclState {
  js: boolean;
  themePref: string | null;
  theme: string | null;
  motion: string | null;
  bg: string;
}

/** DOMContentLoaded anındaki <html> durumunu window.__dcl'e yazar (addInitScript, sayfa betiklerinden önce). */
async function recordDcl(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        const d = document.documentElement;
        (window as unknown as { __dcl: DclState }).__dcl = {
          js: d.classList.contains('js'),
          themePref: d.getAttribute('data-theme-pref'),
          theme: d.getAttribute('data-theme'),
          motion: d.getAttribute('data-motion'),
          // canvas rengi kök öğededir (globals.css html { background-color }); body saydamdır (SPEC-SAPMA §8.4.3)
          bg: getComputedStyle(d).backgroundColor,
        };
      },
      { once: true },
    );
  });
}
const readDcl = (page: Page) =>
  page.evaluate(() => (window as unknown as { __dcl: DclState }).__dcl);

test.describe('D-39 head script', { tag: ['@desktop-chromium'] }, () => {
  // SPEC-SAPMA §8.9: React 19 async chunk betiklerini <head>'in başına taşır; head script <head>'deki ilk
  // senkron (src/async/defer/nomodule/module olmayan) betiktir ve body ayrıştırılmadan önce çalışır.
  test('§8.4.3 satır içi, async/defer yok, <head>deki ilk senkron betik', async ({ request }) => {
    for (const path of ['/', '/en', '/hakkimda', '/yok']) {
      const html = await (await request.get(path)).text();
      const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
      const sync = [...head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(
        ([, attrs = '']) => !/\b(src|async|defer|nomodule)\b|type="module"/i.test(attrs),
      );
      expect.soft(sync[0]?.[2], `${path}: ilk senkron betik`).toBe(headScript);
      expect.soft(sync[0]?.[1]?.trim(), `${path}: öznitelik yok`).toBe('');
    }
  });
});

test.describe('§8.9 flaş yok', { tag: ['@desktop-chromium', '@iphone-15'] }, () => {
  test('os-theme=dark + OS açık: DOMContentLoaded anında koyu tema ve koyu canvas', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript((key) => localStorage.setItem(key, 'dark'), STORAGE_KEYS.theme);
    await recordDcl(page);
    await page.goto('/');
    const dcl = await readDcl(page);
    expect(dcl.theme).toBe('dark');
    expect(dcl.themePref).toBe('dark');
    expect(dcl.bg).toBe(DARK_CANVAS);
  });

  test('os-motion=reduce: DOMContentLoaded anında data-motion="reduce"', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'reduce'), STORAGE_KEYS.motion);
    await recordDcl(page);
    await page.goto('/hakkimda');
    expect((await readDcl(page)).motion).toBe('reduce');
  });

  test('D-39 nitelikleri DOMContentLoaded anında vardır', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
    await recordDcl(page);
    await page.goto('/en');
    expect(await readDcl(page)).toMatchObject({
      js: true,
      themePref: 'system',
      theme: 'dark',
      motion: 'full',
    });
  });
});

test.describe('§6.3.5 ThemeToggle', { tag: ['@desktop-chromium'] }, () => {
  test('Koyu seçimi saklanır ve yeniden yüklemede kalır; Sistem OS tercihini izler', async ({
    page,
  }) => {
    const html = page.locator('html');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/hakkimda');
    const toggle = page.locator('[data-site-footer="full"] fieldset');

    await toggle.getByText('Koyu', { exact: true }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(html).toHaveAttribute('data-theme-pref', 'dark');
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEYS.theme)).toBe('dark');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(toggle.getByRole('radio', { name: 'Koyu' })).toBeChecked();

    await toggle.getByText('Açık', { exact: true }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    await toggle.getByText('Sistem', { exact: true }).click();
    await expect(html).toHaveAttribute('data-theme-pref', 'system');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('D-38 Storage.getItem hata fırlatırken sayfa hatasız render edilir', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error('depolama kapalı');
      };
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/hakkimda');
    await expect(page.locator('html')).toHaveAttribute('data-theme-pref', 'system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('D-39 JS yok', { tag: ['@no-js'] }, () => {
  test('html js sınıfını taşımaz; tema seçici gizli, içerik görünür', async ({ page }) => {
    await page.goto('/hakkimda');
    expect(await page.locator('html').getAttribute('class')).not.toMatch(/(^|\s)js(\s|$)/);
    await expect(page.locator('[data-site-footer="full"] fieldset')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('§6.12 tasarım sistemi', { tag: ['@desktop-chromium'] }, () => {
  test('D-21 tam 2 font preload; Google Fonts isteği yok', async ({ page, request }) => {
    const html = await (await request.get('/')).text();
    const preloads = html.match(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g) ?? [];
    expect(preloads).toHaveLength(2);
    for (const tag of preloads) expect(tag).toContain('type="font/woff2"');

    const hosts: string[] = [];
    page.on('request', (r) => hosts.push(new URL(r.url()).host));
    await page.goto('/');
    await page.goto('/hakkimda');
    expect(hosts.filter((h) => /fonts\.(googleapis|gstatic)\.com$/.test(h))).toEqual([]);
  });

  test('ss03 gövdede; hero <h1> ss01 + font-stretch 125%', async ({ page }) => {
    await page.goto('/');
    expect(
      await page.evaluate(() => getComputedStyle(document.body).fontFeatureSettings),
    ).toContain('ss03');
    const h1 = await page.locator('h1.type-display').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { features: cs.fontFeatureSettings, stretch: cs.fontStretch };
    });
    expect(h1.features).toContain('ss01');
    expect(h1.stretch).toBe('125%');
  });

  test('forced-colors: .link-inline altı çizili', async ({ page }) => {
    // 404 sayfası: yanıt durumu konsola "Failed to load resource" yazar
    allowConsole('404');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/yok');
    const links = page.locator('.link-inline');
    expect(await links.count()).toBeGreaterThan(0);
    for (const deco of await links.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).textDecorationLine),
    ))
      expect(deco).toBe('underline');
  });

  test('prefers-contrast: more altında ink-muted = ink', async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' });
    await page.goto('/hakkimda');
    const [muted, ink] = await page.evaluate(() => {
      const probe = (cls: string) => {
        const el = document.createElement('span');
        el.className = cls;
        document.body.append(el);
        const c = getComputedStyle(el).color;
        el.remove();
        return c;
      };
      return [probe('text-ink-muted'), probe('text-ink')];
    });
    expect(muted).toBe(ink);
  });

  test('baskıda #scene-layer yok', async ({ page }) => {
    await page.emulateMedia({ media: 'print' });
    await page.goto('/');
    const layer = page.locator('#scene-layer');
    if ((await layer.count()) > 0) await expect(layer).toHaveCSS('display', 'none'); // StageRoot M5'te gelir
  });

  test('header ve footer denetimlerinin vuruş kutuları ≥ 44 × 44 px', async ({ page }) => {
    await page.goto('/hakkimda');
    const boxes = await page
      .locator(
        'header a, header button, [data-site-footer] a, [data-site-footer] button, [data-site-footer] label',
      )
      .evaluateAll((els) =>
        els
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { el: `${el.tagName} "${el.textContent?.trim()}"`, w: r.width, h: r.height };
          }),
      );
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) {
      expect.soft(b.w, `${b.el} genişlik`).toBeGreaterThanOrEqual(44);
      expect.soft(b.h, `${b.el} yükseklik`).toBeGreaterThanOrEqual(44);
    }
  });

  test('filtre çipleri ≥ 44 × 44 px; areas adım düğmeleri ≥ 2.5.8 AA tabanı (24 px)', async ({
    page,
  }) => {
    const boxes = (selector: string) =>
      page.locator(selector).evaluateAll((els) =>
        els
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { el: `${el.tagName} "${el.textContent?.trim()}"`, w: r.width, h: r.height };
          }),
      );
    await page.goto('/projeler');
    const chips = await boxes('main [role="group"] button');
    expect(chips.length, 'filtre çipleri').toBeGreaterThan(1);
    for (const b of chips) {
      expect.soft(b.w, `${b.el} genişlik`).toBeGreaterThanOrEqual(44);
      expect.soft(b.h, `${b.el} yükseklik`).toBeGreaterThanOrEqual(44);
    }
    // §6.12 notu (M8): adım düğmeleri 1440 × 900'de 30 px yüksekliğindedir; 44 px pin'i liste moduna iter (sığma
    // payı 0). Açık madde; burada WCAG 2.5.8 AA tabanı korunur.
    await page.goto('/?tier=static');
    await expect(page.locator('[data-area-step]').first()).toBeVisible(); // pin modu (istemci)
    const steps = await boxes('[data-area-step]');
    expect(steps.length, 'adım düğmeleri').toBeGreaterThanOrEqual(3);
    for (const b of steps) {
      expect.soft(b.w, `${b.el} genişlik`).toBeGreaterThanOrEqual(44);
      expect.soft(b.h, `${b.el} yükseklik`).toBeGreaterThanOrEqual(24);
    }
  });

  test('hero <h1>: ilk karede opak ve animasyonsuz; 360 px’te iki, 1440 px’te tek satır', async ({
    page,
  }) => {
    const measure = () =>
      page.locator('h1.type-display').evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          opacity: cs.opacity,
          animation: cs.animationName,
          lines: Math.round(el.getBoundingClientRect().height / Number.parseFloat(cs.lineHeight)),
          fits: el.scrollWidth <= el.clientWidth,
        };
      });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    expect(await measure()).toMatchObject({ opacity: '1', animation: 'none', lines: 2 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    expect(await measure()).toMatchObject({
      opacity: '1',
      animation: 'none',
      lines: 1,
      fits: true,
    });
  });

  test('data-motion="reduce" altında 500 ms sonra çalışan animasyon yok', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'reduce'), STORAGE_KEYS.motion);
    await page.goto('/');
    const running = await page.evaluate(
      () =>
        new Promise<number>((resolve) =>
          setTimeout(
            () => resolve(document.getAnimations().filter((a) => a.playState === 'running').length),
            500,
          ),
        ),
    );
    expect(running).toBe(0);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`axe color-contrast: ${theme} temada tüm route’larda 0 ihlal`, async ({
      page,
      request,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      for (const path of await pagePaths(request)) {
        await test.step(path, async () => {
          await page.goto(path);
          await waitForAnimations(page); // hero-in giriş animasyonu ara renk ölçtürür
          const { violations } = await new AxeBuilder({ page })
            .withRules(['color-contrast'])
            .exclude('#scene-layer')
            .exclude('.kod-panel') // dekoratif kod resmi (aria-hidden; WCAG 1.4.3 "pure decoration")
            .analyze();
          expect
            .soft(
              violations.flatMap((v) => v.nodes.map((n) => n.target.join(' '))),
              `${path} (${theme})`,
            )
            .toEqual([]);
        });
      }
    });
  }
});
