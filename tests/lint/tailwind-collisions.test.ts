// tests/lint/tailwind-collisions.test.ts — Tailwind v4 sınıf çakışması koruması (SPEC-SAPMA §6.4).
// `--spacing-block` token'ı mantıksal boyut yardımcısıyla birleşir: `inline-block` sınıfı display'e ek olarak
// `inline-size: var(--spacing-block)` (48–96 px) üretir ve öğeyi o genişliğe kilitler. Görünüm `[display:inline-block]`.
// Ayrıca §6.12'nin grep maddeleri: bileşenlerde renk literali yok, `cursor: none` yok, `tailwind.config.*` yok.
// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(tsx?|css)$/.test(name)) yield p;
  }
}

describe('Tailwind sınıf çakışmaları', () => {
  it('src altında `inline-block` sınıfı yok (spacing token `block` ile çakışır)', () => {
    const offenders: string[] = [];
    for (const f of files('src')) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/(?<![\w[:-])inline-block(?![\w-])/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line))
            offenders.push(`${f}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});

describe('§6.12 tasarım sistemi grep’leri', () => {
  const offending = (re: RegExp, skip: (f: string) => boolean = () => false) =>
    [...files('src')]
      .filter((f) => !skip(f))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .flatMap((line, i) => (re.test(line) ? [`${f}:${i + 1}`] : [])),
      );

  it('renk literali yalnız tokens.ts ve globals.css’te (testler hariç)', () => {
    const allowed = (f: string) =>
      /\.test\.tsx?$/.test(f) ||
      f === path.join('src', 'design', 'tokens.ts') ||
      f === path.join('src', 'app', 'globals.css');
    expect(offending(/#[0-9A-Fa-f]{6}\b/, allowed)).toEqual([]);
  });

  it('yerel imleç gizlenmez: `cursor: none` / `cursor-none` yok', () => {
    expect(offending(/cursor:\s*none|\bcursor-none\b/)).toEqual([]);
  });

  it('depoda tailwind.config.* yok (Tailwind v4 CSS yapılandırması)', () => {
    expect(readdirSync('.').filter((n) => n.startsWith('tailwind.config.'))).toEqual([]);
  });
});
