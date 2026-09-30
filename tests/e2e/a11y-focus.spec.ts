// tests/e2e/a11y-focus.spec.ts — odak görünürlüğü ve örtülmeme (§10.3.3; WCAG 2.4.7, 2.4.11).
// M2: kabuk sayfaları; M3'te sitemapPaths(request) + NOINDEX_PATHS.
import { expect, test } from './fixtures';
import { SHELL_PATHS } from './helpers/urls';

interface Stop {
  label: string;
  ring: boolean;
  covered: string | null;
  repeat: boolean;
}

test.describe(
  '§10.3.3 odak halkası ve örtülmeme',
  { tag: ['@desktop-chromium', '@pixel-7'] },
  () => {
    test('her Tab durağında ≥ 2 px halka; öğe sabit katmanca örtülmez', async ({ page }) => {
      for (const path of SHELL_PATHS) {
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
            const stop = await page.evaluate((): Stop | null => {
              const el = document.activeElement;
              if (!el || el === document.body) return null;
              // aynı metin ve adresli iki bağlantı (header ve footer) ayrı duraklardır: öğe kimliğiyle izlenir
              const w = window as unknown as { __focusSeen?: WeakSet<Element> };
              w.__focusSeen ??= new WeakSet();
              const repeat = w.__focusSeen.has(el);
              w.__focusSeen.add(el);
              // ThemeToggle: halka ve vuruş kutusu radyonun etiketindedir (:has(:focus-visible))
              const box = (el.closest('label') ?? el) as HTMLElement;
              const cs = getComputedStyle(box);
              const ring = cs.outlineStyle !== 'none' && Number.parseFloat(cs.outlineWidth) >= 2;
              box.scrollIntoView({ block: 'nearest' });
              const r = box.getBoundingClientRect();
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              const covered = hit && !box.contains(hit) ? `${hit.tagName}.${hit.className}` : null;
              const label = `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 40)}" ${el.getAttribute('href') ?? ''}`;
              return { label, ring, covered, repeat };
            });
            if (stop === null) break; // sayfa sonu: odak body'ye döndü
            if (stop.repeat) break; // döngü başa döndü
            visited++;
            expect.soft(stop.ring, `${path}: ${stop.label} halka`).toBe(true);
            expect.soft(stop.covered, `${path}: ${stop.label} örtülmüş`).toBeNull();
          }
          expect(visited, `${path}: en az bir Tab durağı`).toBeGreaterThan(0);
          expect(visited, `${path}: sonsuz döngü yok`).toBeLessThanOrEqual(limit);
        });
      }
    });
  },
);
