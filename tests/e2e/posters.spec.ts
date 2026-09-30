// tests/e2e/posters.spec.ts — posterlerin ağ davranışı (D-31, B34, K-HERO-6, V-46, final.md §13 #3): açık ve koyu
// colorScheme'de her görünür poster için yalnız etkin temanın dosyası istenir; tema değişince diğer temanın her
// dosyası en çok bir kez istenir; hiçbir poster /_next/image'dan geçmez.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { scrollToSvh } from './helpers/scroll';

/** Poster isteklerini sırayla kaydeder: /stage/… ya da optimizer'dan geçen /_next/image?url=/stage/… */
function recordPosters(page: Page): string[] {
  const list: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/stage/')) list.push(u.pathname);
    else if (
      u.pathname.startsWith('/_next/image') &&
      u.searchParams.get('url')?.startsWith('/stage/')
    )
      list.push(u.pathname + u.search);
  });
  return list;
}

/** Sayfanın sonuna kadar 60 svh adımlarla iner: tembel posterlerin hepsi görünüm alanına girer */
async function visitAll(page: Page) {
  const end = await page.evaluate(
    () => (100 * document.documentElement.scrollHeight) / window.innerHeight,
  );
  for (let s = 0; s <= end; s += 60) await scrollToSvh(page, s);
  await scrollToSvh(page, end);
  await page.waitForLoadState('networkidle');
}

test.describe(
  'D-31 posterler',
  { tag: ['@desktop-chromium', '@iphone-15', '@no-webgl', '@desktop-firefox'] },
  () => {
    for (const theme of ['light', 'dark'] as const) {
      test(`V-46 ${theme}: yalnız etkin temanın posterleri; /_next/image yok; tema değişince diğer tema en çok bir kez`, async ({
        page,
        browserName,
      }) => {
        const other = theme === 'light' ? 'dark' : 'light';
        await page.emulateMedia({ colorScheme: theme });
        // Playwright Firefox'ta colorScheme öykünmesi head betiğinin matchMedia'sına yansımıyor (ölçüldü, tema açık
        // kalıyordu): tercih açıkça verilir
        if (browserName === 'firefox')
          await page.addInitScript((t) => window.localStorage.setItem('os-theme', t), theme);
        const requests = recordPosters(page);
        await page.goto('/', { waitUntil: 'networkidle' });
        await visitAll(page);
        expect(
          requests.filter((p) => p.startsWith('/_next/image')),
          'optimizer’dan geçen poster',
        ).toEqual([]);
        const posters = requests.filter((p) => p.startsWith('/stage/'));
        for (const key of ['k0', 'k1', 'k5'])
          expect(
            posters.some((p) => p.startsWith(`/stage/${key}-${theme}-`)),
            `${key}-${theme}`,
          ).toBe(true);
        expect(
          posters.filter((p) => p.includes(`-${other}-`)),
          'etkin olmayan tema',
        ).toEqual([]);
        // tema değişimi (footer'daki seçici): diğer temanın her dosyası en çok bir kez
        const label = other === 'dark' ? 'Koyu' : 'Açık';
        await page.locator('label', { hasText: label }).locator('visible=true').first().click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', other);
        await visitAll(page);
        await scrollToSvh(page, 0);
        await page.waitForLoadState('networkidle');
        const switched = requests.filter((p) => p.includes(`-${other}-`));
        expect(switched.length, 'diğer tema istendi').toBeGreaterThan(0);
        expect(switched.length, 'her dosya en çok bir kez').toBe(new Set(switched).size);
      });
    }
  },
);
