// tests/e2e/a11y-focus.spec.ts — odak görünürlüğü ve örtülmeme (§10.3.3; WCAG 2.4.7, 2.4.11).
// Sayfa listesi: sitemap + NOINDEX_PATHS (pagePaths).
import { expect, test } from './fixtures';
import { pagePaths } from './helpers/urls';

interface Stop {
  label: string;
  ring: boolean;
  covered: string | null;
  repeat: boolean;
}

/** Odaklı öğenin halkasını ve örtülüp örtülmediğini okur (page.evaluate'e verilir; dış kapsama başvurmaz). */
function readStop(): Stop | null {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  // aynı metin ve adresli iki bağlantı (header ve footer) ayrı duraklardır: öğe kimliğiyle izlenir
  const w = window as unknown as { __focusSeen?: WeakSet<Element> };
  w.__focusSeen ??= new WeakSet();
  const repeat = w.__focusSeen.has(el);
  w.__focusSeen.add(el);
  // ThemeToggle: halka ve vuruş kutusu radyonun etiketindedir (:has(:focus-visible)).
  // ProjectCard / ProjectRow: gerilmiş bağlantının halkası [data-focus-ring] kapsayıcıdadır (M3).
  const box = (el.closest('label, [data-focus-ring]') ?? el) as HTMLElement;
  const cs = getComputedStyle(box);
  const ring = cs.outlineStyle !== 'none' && Number.parseFloat(cs.outlineWidth) >= 2;
  box.scrollIntoView({ block: 'nearest' });
  // iki satıra sarılan bağlantıda sınır kutusunun merkezi satır arası boşluğa düşer: ilk satır parçası
  const r = box.getClientRects()[0] ?? box.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const covered = hit && !box.contains(hit) ? `${hit.tagName}.${hit.className}` : null;
  const label = `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 40)}" ${el.getAttribute('href') ?? ''}`;
  return { label, ring, covered, repeat };
}

test.describe(
  '§10.3.3 odak halkası ve örtülmeme',
  { tag: ['@desktop-chromium', '@pixel-7'] },
  () => {
    test('her Tab durağında ≥ 2 px halka; öğe sabit katmanca örtülmez', async ({
      page,
      request,
    }) => {
      for (const path of await pagePaths(request)) {
        await test.step(path, async () => {
          await page.goto(path);
          const limit =
            (await page.evaluate(
              () =>
                document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')
                  .length,
            )) + 2;
          let visited = 0;
          for (let i = 0; i < limit; i++) {
            await page.keyboard.press('Tab');
            const stop = await page.evaluate(readStop);
            if (stop === null) break; // sayfa sonu: odak body'ye döndü
            if (stop.repeat) break; // döngü başa döndü
            visited++;
            expect.soft(stop.ring, `${path}: ${stop.label} halka`).toBe(true);
            expect.soft(stop.covered, `${path}: ${stop.label} örtülmüş`).toBeNull();
          }
          expect(visited, `${path}: en az bir Tab durağı`).toBeGreaterThan(0);
          expect(visited, `${path}: sonsuz döngü yok`).toBeLessThanOrEqual(limit);
          // Tab sayfayı sona kaydırır ve tembel galeri görselleri yüklenmeye başlar. Yarıda kesilen /_next/image isteği
          // `next start`'ta (Next 16.3.7) o URL'yi sunucu yeniden başlayana dek kilitliyor (iç istek istemcinin soketiyle
          // yapılıyor): sonraki testlerin görselleri hiç gelmiyordu (PR #15 CI, visual.spec). Ağ durulunca ayrılınır.
          await page.waitForLoadState('networkidle');
        });
      }
    });
  },
);

test.describe(
  '§10.5 odak halkası: forcedColors ve contrast: more',
  { tag: ['@desktop-chromium'] },
  () => {
    for (const media of [{ forcedColors: 'active' }, { contrast: 'more' }] as const) {
      test(`${Object.keys(media)[0]}: her Tab durağında ≥ 2 px halka (outline; box-shadow YASAK)`, async ({
        page,
      }) => {
        await page.emulateMedia(media);
        // /projeler: header, dil, filtre çipleri, proje satırları ([data-focus-ring]) ve footer denetimleri
        await page.goto('/projeler');
        let visited = 0;
        for (let i = 0; i < 60; i++) {
          await page.keyboard.press('Tab');
          const stop = await page.evaluate(readStop);
          if (stop === null || stop.repeat) break;
          visited++;
          expect.soft(stop.ring, `${stop.label} halka`).toBe(true);
        }
        expect(visited, 'Tab durakları').toBeGreaterThan(10);
      });
    }
  },
);

test.describe(
  '§10.5.4 1.4.4: 640 × 400 (1280 × 800’ün %200’ü)',
  { tag: ['@desktop-chromium'] },
  () => {
    test('her Tab durağı erişilebilir: halkalı ve sabit katmanca örtülmez', async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 400 });
      for (const path of ['/', '/projeler', '/iletisim']) {
        await test.step(path, async () => {
          await page.goto(path);
          let visited = 0;
          for (let i = 0; i < 150; i++) {
            await page.keyboard.press('Tab');
            const stop = await page.evaluate(readStop);
            if (stop === null || stop.repeat) break;
            visited++;
            expect.soft(stop.ring, `${path}: ${stop.label} halka`).toBe(true);
            expect.soft(stop.covered, `${path}: ${stop.label} örtülmüş`).toBeNull();
          }
          expect(visited, `${path}: Tab durakları`).toBeGreaterThan(5);
          await page.waitForLoadState('networkidle'); // tembel görseller (yukarıdaki not)
        });
      }
    });
  },
);
