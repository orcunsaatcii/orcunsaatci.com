// src/lib/kod/screen.test.ts — KOD ekran tamponu, glif kümesi ve statik panel koşuları (§5.20.2, §13.2.2).
import { describe, expect, it } from 'vitest';
import {
  DRAWN,
  FONT_SET,
  GLYPHS,
  glyphIndex,
  isDrawn,
  isSymbol,
  KOD_COLS,
  KOD_ROWS,
  RAMP,
  ROLE,
  ROLE_NAMES,
  SCRAMBLE,
  Screen,
  screenRuns,
  textLen,
  type Role,
  type Run,
} from './screen';

const idx = (s: Screen, x: number, y: number) => y * s.cols + x;
const glyphAt = (s: Screen, x: number, y: number) => GLYPHS[s.g[idx(s, x, y)] ?? 0];
const written = (s: Screen) => s.g.reduce((n, g, i) => n + (g || s.fa[i] ? 1 : 0), 0);
const filled = (s: Screen) => s.ba.reduce((n, a) => n + (a > 0 ? 1 : 0), 0);

/** Statik panelin hücre görünümü: görünmeyen glif boşluk, zeminsiz hücrenin zemin rolü ink (KodPanel sözleşmesi) */
interface CellView {
  ch: string;
  role: Role;
  alpha: number;
  bgRole: Role;
  bgAlpha: number;
}
const r2 = (x: number) => Math.round(x * 100) / 100;
function cellView(s: Screen, i: number): CellView {
  const ch = GLYPHS[s.g[i] ?? 0] ?? ' ';
  const visible = (s.fa[i] ?? 0) > 0.003 && ch !== ' ';
  const bgAlpha = r2(s.ba[i] ?? 0);
  return {
    ch: visible ? ch : ' ',
    role: (visible ? s.fr[i] : ROLE.ink) as Role,
    alpha: visible ? r2(s.fa[i] ?? 0) : 0,
    bgRole: (bgAlpha > 0 ? s.br[i] : ROLE.ink) as Role,
    bgAlpha,
  };
}
/** Koşuları hücrelere açar (her kod noktası bir hücre) */
function expandRuns(rows: Run[][]): CellView[][] {
  return rows.map((row) =>
    row.flatMap((r) =>
      [...r.text].map((ch) => ({
        ch,
        role: r.role,
        alpha: r.alpha,
        bgRole: r.bgRole,
        bgAlpha: r.bgAlpha,
      })),
    ),
  );
}

describe('glif kümesi (§5.20.3)', () => {
  it('her glif tekildir ve glyphIndex GLYPHS ile birebir eşlenir; 0 = boşluk', () => {
    expect(new Set(GLYPHS).size).toBe(GLYPHS.length);
    expect(GLYPHS.length).toBe([...FONT_SET].length + [...DRAWN].length);
    GLYPHS.forEach((c, k) => expect(glyphIndex(c)).toBe(k));
    expect(glyphIndex(' ')).toBe(0);
    for (const c of 'çğıİöşüÇĞÖŞÜ·…’—₺') expect(GLYPHS[glyphIndex(c)]).toBe(c);
  });

  it('kümede olmayan karakter "?" glifine düşer (çok kod noktalı dize de)', () => {
    const unknown = glyphIndex('?');
    expect(GLYPHS[unknown]).toBe('?');
    for (const c of ['😀', 'é', 'ß', '中', '\t', '', 'ab']) expect(glyphIndex(c)).toBe(unknown);
  });

  it('kutu çizgileri çizilir; tek işaretler hem çizilir hem semboldür; metin ikisi de değildir', () => {
    for (const c of '─│├└┌┐┘┤┬┴┼╭╮╰╯━┃') {
      expect(isDrawn(c)).toBe(true);
      expect(isSymbol(c)).toBe(false);
    }
    for (const c of '→←✓●○█░▸') {
      expect(isDrawn(c)).toBe(true);
      expect(isSymbol(c)).toBe(true);
    }
    for (const c of 'aZ0$#|-·…çİ') {
      expect(isDrawn(c)).toBe(false);
      expect(isSymbol(c)).toBe(false);
    }
  });

  it('SCRAMBLE ve RAMP bilinmeyen glife düşmez', () => {
    expect(SCRAMBLE.map((g) => GLYPHS[g]).join('')).toBe(
      'abcdefghijklmnopqrstuvwxyz0123456789{}[]()<>=+-*/;:_$#@&%?!',
    );
    expect(RAMP.map((g) => GLYPHS[g]).join('')).toBe(' .:-=+*#%@');
  });

  it('rol adları ROLE ile aynı sırada (k<n> sınıfları)', () => {
    expect(ROLE_NAMES).toHaveLength(Object.keys(ROLE).length);
    for (const [name, k] of Object.entries(ROLE)) expect(ROLE_NAMES[k]).toBe(name);
  });

  it('textLen kod noktası sayar', () => {
    expect(textLen('')).toBe(0);
    expect(textLen('İstanbul')).toBe(8);
    expect(textLen('a😀b')).toBe(3);
  });
});

describe('Screen (§5.20.2)', () => {
  it('ana ızgara 56 × 24; tüm diziler hücre sayısı uzunluğunda ve boş başlar', () => {
    const s = new Screen();
    expect([s.cols, s.rows]).toEqual([KOD_COLS, KOD_ROWS]);
    expect([KOD_COLS, KOD_ROWS]).toEqual([56, 24]);
    for (const a of [s.g, s.fr, s.fa, s.br, s.ba, s.fx]) {
      expect(a).toHaveLength(56 * 24);
      expect(a.every((v) => v === 0)).toBe(true);
    }
  });

  it('put glif, rol, saydamlık ve efekti yazar; sonraki sütunu döner', () => {
    const s = new Screen();
    expect(s.put(2, 3, 'Ağ', ROLE.accent, 0.5, 1)).toBe(4);
    expect(glyphAt(s, 2, 3)).toBe('A');
    expect(glyphAt(s, 3, 3)).toBe('ğ');
    const i = idx(s, 2, 3);
    expect([s.fr[i], s.fa[i], s.fx[i]]).toEqual([ROLE.accent, 0.5, 1]);
    // varsayılanlar: ink, tam opak, efektsiz
    expect(s.put(0, 0, 'x')).toBe(1);
    expect([s.fr[0], s.fa[0], s.fx[0]]).toEqual([ROLE.ink, 1, 0]);
    // kod noktası: astral karakter tek hücredir ve "?" olarak yazılır
    expect(s.put(10, 10, '😀z')).toBe(12);
    expect([glyphAt(s, 10, 10), glyphAt(s, 11, 10)]).toEqual(['?', 'z']);
  });

  it('put ızgara dışını kırpar, alt satıra taşmaz; dönüş değeri kırpmadan bağımsızdır', () => {
    const s = new Screen();
    expect(s.put(54, 0, 'abcd')).toBe(58);
    expect([glyphAt(s, 54, 0), glyphAt(s, 55, 0)]).toEqual(['a', 'b']);
    expect([glyphAt(s, 0, 1), glyphAt(s, 1, 1)]).toEqual([' ', ' ']);
    expect(written(s)).toBe(2);

    expect(s.put(-2, 5, 'abcd')).toBe(2);
    expect([glyphAt(s, 0, 5), glyphAt(s, 1, 5)]).toEqual(['c', 'd']);
    expect(written(s)).toBe(4);

    const t = new Screen();
    expect(t.put(0, -1, 'üst')).toBe(3);
    expect(t.put(0, KOD_ROWS, 'alt')).toBe(3);
    expect(t.put(KOD_COLS, 4, 'sağ')).toBe(KOD_COLS + 3);
    expect(written(t)).toBe(0);
    expect(t.fa.every((a) => a === 0)).toBe(true);
  });

  it('bg dikdörtgeni uçlar dahil doldurur, kırpar; glif katmanına dokunmaz', () => {
    const s = new Screen();
    s.bg(-3, -2, 1, 1, ROLE.brass, 0.4);
    expect(filled(s)).toBe(4);
    expect(s.br[idx(s, 1, 1)]).toBe(ROLE.brass);
    expect(s.ba[idx(s, 1, 1)]).toBeCloseTo(0.4, 6);
    s.bg(54, 22, 99, 99, ROLE.accent, 0.2);
    expect(filled(s)).toBe(8);
    expect(s.br[idx(s, 55, 23)]).toBe(ROLE.accent);
    s.bg(10, 10, 9, 9, ROLE.accent, 1); // boş dikdörtgen
    expect(filled(s)).toBe(8);
    expect(written(s)).toBe(0);
  });

  it('clear tüm katmanları sıfırlar; özel boyutlu ekran kendi sınırını kullanır', () => {
    const s = new Screen();
    s.put(3, 3, 'abc', ROLE.muted, 0.7, 1);
    s.bg(0, 0, 55, 23, ROLE.panel, 1);
    s.clear();
    for (const a of [s.g, s.fr, s.fa, s.br, s.ba, s.fx]) expect(a.every((v) => v === 0)).toBe(true);

    const small = new Screen(4, 2);
    expect(small.g).toHaveLength(8);
    expect(small.put(2, 1, 'xyz')).toBe(5);
    expect(written(small)).toBe(2);
    expect([glyphAt(small, 2, 1), glyphAt(small, 3, 1)]).toEqual(['x', 'y']);
  });
});

describe('screenRuns: statik panel koşuları (§4.16.3, K-KOD-2)', () => {
  const firstRow = (s: Screen) => screenRuns(s)[0] ?? [];

  it('aynı stilli komşular birleşir; rol ya da saydamlık değişince yeni koşu başlar', () => {
    const s = new Screen();
    s.put(0, 0, 'ab', ROLE.ink, 1);
    s.put(2, 0, 'cd', ROLE.ink, 1);
    s.put(4, 0, 'ef', ROLE.muted, 1);
    s.put(6, 0, 'gh', ROLE.muted, 0.5);
    s.put(8, 0, 'i', ROLE.muted, 0.501); // iki ondalığa yuvarlanır → 0.5
    const row = firstRow(s);
    expect(row.map((r) => [r.text, r.role, r.alpha])).toEqual([
      ['abcd', ROLE.ink, 1],
      ['ef', ROLE.muted, 1],
      ['ghi', ROLE.muted, 0.5],
      [' '.repeat(KOD_COLS - 9), ROLE.ink, 0],
    ]);
  });

  it('görünmeyen glif (saydamlık ≤ 0.003 ya da boşluk) ink/0 boşluk olur ve çevresiyle birleşir', () => {
    const s = new Screen();
    s.put(0, 0, 'x', ROLE.accent, 0.002);
    s.put(1, 0, ' ', ROLE.brass, 1);
    s.put(2, 0, 'y', ROLE.accent, 1);
    const row = firstRow(s);
    expect(row[0]).toMatchObject({ text: '  ', role: ROLE.ink, alpha: 0, drawn: false });
    expect(row[1]).toMatchObject({ text: 'y', role: ROLE.accent, alpha: 1 });
  });

  it('semboller (→ ✓ ● …) her zaman ayrı koşudur; komşu aynı stil olsa da birleşmez', () => {
    const s = new Screen();
    s.put(0, 0, 'a●●b✓→', ROLE.accent, 1);
    const row = firstRow(s);
    expect(row.slice(0, 6).map((r) => [r.text, r.symbol, r.drawn])).toEqual([
      ['a', false, false],
      ['●', true, false],
      ['●', true, false],
      ['b', false, false],
      ['✓', true, false],
      ['→', true, false],
    ]);
  });

  it('kutu çizgisi koşuları drawn işaretlidir; aynı stildeki metinle birleşmez', () => {
    const s = new Screen();
    s.put(0, 0, '╭──╮', ROLE.muted, 0.75);
    s.put(4, 0, 'ab', ROLE.muted, 0.75);
    s.put(6, 0, '│', ROLE.muted, 0.75);
    const row = firstRow(s);
    expect(row.slice(0, 3).map((r) => [r.text, r.drawn, r.symbol])).toEqual([
      ['╭──╮', true, false],
      ['ab', false, false],
      ['│', true, false],
    ]);
  });

  it('zemin rolü ve saydamlığı koşuyu böler; saydamlığı 0 olan zeminin rolü ink sayılır', () => {
    const s = new Screen();
    s.put(0, 0, 'ab', ROLE.ink, 1);
    s.bg(0, 0, 3, 0, ROLE.accent, 0.07);
    s.bg(4, 0, 5, 0, ROLE.brass, 0); // görünmez zemin
    const row = firstRow(s);
    expect(row.map((r) => [r.text.length, r.bgRole, r.bgAlpha])).toEqual([
      [2, ROLE.accent, 0.07],
      [2, ROLE.accent, 0.07],
      [KOD_COLS - 4, ROLE.ink, 0],
    ]);
  });

  it('her satır 56 hücreyi kapsar ve koşular tamponu hücre hücre yeniden üretir', () => {
    const s = new Screen();
    s.put(0, 0, `╭${'─'.repeat(54)}╮`, ROLE.muted, 0.75);
    s.put(3, 0, '●', ROLE.accent, 0.9);
    s.put(5, 2, "const ada = 'İzmir';", ROLE.ink, 0.8, 1);
    s.put(7, 2, ' ', ROLE.accent, 1);
    s.put(30, 2, '✓ ok → ░█', ROLE.brass, 1);
    s.put(2, 5, 'x', ROLE.subtle, 0.001);
    s.bg(4, 2, 54, 3, ROLE.accent, 0.17);
    s.bg(9, 2, 9, 2, ROLE.accent, 0.9);
    s.put(0, 23, `╰${'─'.repeat(54)}╯`, ROLE.muted, 0.75);
    const rows = screenRuns(s);
    expect(rows).toHaveLength(KOD_ROWS);
    const cells = expandRuns(rows);
    for (let y = 0; y < s.rows; y++) {
      expect(cells[y]).toHaveLength(KOD_COLS);
      for (let x = 0; x < s.cols; x++) expect(cells[y]?.[x]).toEqual(cellView(s, idx(s, x, y)));
    }
  });
});
