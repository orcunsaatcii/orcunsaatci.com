// src/design/tokens.test.ts — tokens.ts ↔ globals.css paritesi + kontrast alt sınırları (product.md §6.10.4)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getExperienceProfile } from '@/experience/profile';
import {
  cssVarOf,
  motion,
  palettes,
  toCss,
  zIndex,
  type Hex,
  type Rgba,
  type ThemeColors,
} from './tokens';

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
// eslint-disable-next-line no-restricted-properties -- CSS bildirimleri ASCII'dir; dile duyarlı dönüşüm gerekmez
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

// "tokens:<ad>:start" ile "tokens:<ad>:end" yorum işaretleri arasındaki özel özellik bildirimleri
function region(name: string): Map<string, string> {
  const m = css.match(
    new RegExp(`/\\* tokens:${name}:start \\*/([\\s\\S]*?)/\\* tokens:${name}:end \\*/`),
  );
  if (!m?.[1]) throw new Error(`globals.css: tokens:${name} işareti yok`);
  const out = new Map<string, string>();
  for (const d of m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(d[1]!, norm(d[2]!));
  return out;
}
/** Dosyadaki ilk bildirim (kullanım "var(--x)" eşleşmez, çünkü ardından ":" gelmez) */
const decl = (name: string) => norm(css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1] ?? '');

const keys = Object.keys(cssVarOf) as (keyof ThemeColors)[];
// Geçici (§15.0.6): etkin persona M3'te getSite().persona'dan okunur (§8.4.4 ile aynı ifade); M2'de engineer.
const active = palettes[getExperienceProfile('engineer').palette];

describe('tokens.ts ↔ globals.css paritesi', () => {
  const lightDark = new Map([...region('colors'), ...region('scene')]);
  const fbLight = region('fallback-light');
  const fbDark = region('fallback-dark');

  it.each(keys)('%s', (key) => {
    const l = norm(toCss(active.light[key]));
    const d = norm(toCss(active.dark[key]));
    expect(lightDark.get(cssVarOf[key])).toBe(`light-dark(${l}, ${d})`);
    expect(fbLight.get(cssVarOf[key])).toBe(l);
    expect(fbDark.get(cssVarOf[key])).toBe(d);
  });

  it('işaretli bölgelerde fazladan bildirim yok', () => {
    expect(lightDark.size).toBe(keys.length);
    expect(fbLight.size).toBe(keys.length);
    expect(fbDark.size).toBe(keys.length);
  });

  it('hareket ve katman değerleri', () => {
    const easeName = {
      standard: 'standard',
      out: 'out',
      outExpo: 'out-expo',
      inOut: 'in-out',
      in: 'in',
      tick: 'tick',
    } as const;
    for (const [k, ms] of Object.entries(motion.dur)) expect(decl(`--dur-${k}`)).toBe(`${ms}ms`);
    for (const [k, p] of Object.entries(motion.ease)) {
      expect(decl(`--ease-${easeName[k as keyof typeof easeName]}`)).toBe(
        `cubic-bezier(${p.join(', ')})`,
      );
    }
    for (const [k, v] of Object.entries(zIndex)) expect(decl(`--z-${k}`)).toBe(String(v));
    expect(decl('--stagger-line')).toBe(`${motion.stagger.line}ms`);
    expect(decl('--stagger-item')).toBe(`${motion.stagger.item}ms`);
    expect(decl('--rise-hero')).toBe(`${motion.distance.heroRise}px`);
    expect(decl('--rise-block')).toBe(`${motion.distance.blockRise}px`);
    expect(decl('--rise-card')).toBe(`${motion.distance.cardRise}px`);
    expect(decl('--lift-hover')).toBe(`${motion.distance.hoverLift}px`);
    expect(decl('--reveal-line-from')).toBe(`${motion.distance.revealLineFromYPercent}%`);
  });
});

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex: Hex): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => lin(v / 255)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: Hex, b: Hex): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
const asHex = (v: Hex | Rgba): Hex => {
  if (typeof v !== 'string') throw new Error('rgba token kontrast çiftinde kullanılamaz');
  return v;
};

type K = keyof ThemeColors;
/** §6.3.3 hedefleri; raised üstünde ink-subtle ve line-strong kuralla yasak olduğu için yoktur (§6.3.4) */
// prettier-ignore
const MIN: ReadonlyArray<readonly [K, K, number]> = [
  ['ink', 'canvas', 4.5], ['ink', 'surface', 4.5], ['ink', 'raised', 4.5],
  ['inkMuted', 'canvas', 4.5], ['inkMuted', 'surface', 4.5], ['inkMuted', 'raised', 4.5],
  ['inkSubtle', 'canvas', 4.5], ['inkSubtle', 'surface', 4.5],
  ['accent', 'canvas', 4.5], ['accent', 'surface', 4.5], ['accent', 'raised', 4.5],
  ['accentHover', 'canvas', 4.5], ['accentHover', 'surface', 4.5],
  ['onAccent', 'accent', 4.5], ['onAccent', 'accentHover', 4.5],
  ['focus', 'canvas', 3], ['focus', 'surface', 3], ['focus', 'raised', 3],
  ['lineStrong', 'canvas', 3], ['lineStrong', 'surface', 3],
  ['brass', 'canvas', 3],
  ['success', 'canvas', 4.5], ['success', 'surface', 4.5],
  ['danger', 'canvas', 4.5], ['danger', 'surface', 4.5],
  ['ink', 'selection', 4.5], ['canvas', 'ink', 4.5],
];

describe('kontrast alt sınırları: tüm paletler × temalar', () => {
  for (const [paletteName, pair] of Object.entries(palettes)) {
    for (const [theme, c] of Object.entries(pair)) {
      it.each(MIN)(`${paletteName}.${theme}: %s / %s ≥ %s`, (fg, bg, min) => {
        expect(contrast(asHex(c[fg]), asHex(c[bg]))).toBeGreaterThanOrEqual(min);
      });
    }
  }
});

describe('§4.14.1 YASAK imleç (D-16)', () => {
  it('K-MICRO-1 kaynakta cursor: none / özel imleç yok', () => {
    const files = (readdirSync(join(process.cwd(), 'src'), { recursive: true }) as string[])
      .filter((f) => /\.(css|tsx?)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) =>
        /cursor\s*:\s*none|cursor-none|cursor-\[none\]|CustomCursor/.test(
          readFileSync(join(process.cwd(), 'src', f), 'utf8'),
        ),
      );
    expect(files).toEqual([]);
  });
});
