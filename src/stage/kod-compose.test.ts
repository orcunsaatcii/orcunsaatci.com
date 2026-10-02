// src/stage/kod-compose.test.ts — KOD besteci: anlık yazım (snap), adım çözülmesi, köprü uçları ve saflığı, çerçeve
// hücreleri, sıfırlama (§5.20.5, §13.2.2, K-CHOREO-3).
import { describe, expect, it } from 'vitest';
import { chrome } from '@/lib/kod/programs';
import { KOD_COLS, KOD_ROWS, ROLE, SCRAMBLE, Screen } from '@/lib/kod/screen';
import { createKodBuffers, KOD_CELLS, KOD_INSTANCES, KodComposer } from './kod-compose';

/** Rol → renk; her rol ayırt edilebilir (karışık glif = mor) */
const PALETTE: number[][] = [
  [0.1, 0.1, 0.1], // ink
  [0.25, 0.25, 0.25], // muted
  [0.4, 0.4, 0.4], // subtle
  [1, 0, 0], // accent
  [0, 1, 0], // brass
  [0, 0, 1], // line
  [0.5, 0.5, 0], // panel
  [1, 0, 1], // scramble
];
function composer(): KodComposer {
  const c = new KodComposer();
  PALETTE.forEach((rgb, k) => (c.palette[k] = [...rgb]));
  return c;
}

/** Giden (A) ve gelen (B) program: çerçeve ortak, başlık ve sağ etiket farklı */
const A = new Screen();
chrome(A, 'a.dart', 'dart · utf-8', '1/2');
A.put(2, 1, 'const a = 1;', ROLE.ink, 1);
A.put(2, 5, 'üst satır A', ROLE.muted, 0.9);
A.put(2, 12, 'ortak satır', ROLE.ink, 1);
A.put(2, 20, 'alt satır A', ROLE.ink, 1);
const B = new Screen();
chrome(B, 'b.dart', 'dart · utf-8', '2/2');
B.put(2, 1, 'final b = 2;', ROLE.accent, 1);
B.put(2, 5, 'üst satır B', ROLE.brass, 0.8);
B.bg(2, 5, 20, 5, ROLE.accent, 0.17);
B.put(2, 12, 'ortak satır', ROLE.ink, 1);
B.put(2, 20, 'alt satır B', ROLE.ink, 1);

const cell = (x: number, y: number) => y * KOD_COLS + x;
const CHANGED = cell(12, 20); // 'A' → 'B' (satır 20: gecikme > 0.28 s)
const SAME = cell(2, 12); // 'o' her iki programda aynı
const U = 1 / 2.4;
const REST_Z = 0.015 * U;
const baseX = (i: number) => ((i % KOD_COLS) + 0.5) / KOD_COLS - 0.5;
const baseY = (i: number) => 0.5 - (Math.floor(i / KOD_COLS) + 0.5) / KOD_ROWS;

/** Çerçeve halkası: yalnız chrome'un kenar hücreleri (yapıcıdaki gibi) */
const RING = (() => {
  const s = new Screen();
  chrome(s, '', '', '');
  return Array.from({ length: KOD_CELLS }, (_, i) => {
    const c = i % KOD_COLS,
      r = Math.floor(i / KOD_COLS);
    return r === 0 || r === KOD_ROWS - 1 || c === 0 || c === KOD_COLS - 1 ? (s.g[i] ?? -1) : -1;
  });
})();
/** A ve B'de aynı kalan çerçeve hücresi (köprüde düşmez) */
const sharedRing = (i: number) => (RING[i] ?? -1) >= 0 && A.g[i] === RING[i] && B.g[i] === RING[i];

function inst(c: KodComposer, o: number) {
  const { pos, glyph, fg, bg } = c.out;
  const v = (a: Float32Array, k: number) => a[k] ?? Number.NaN;
  return {
    x: v(pos, o * 4),
    y: v(pos, o * 4 + 1),
    z: v(pos, o * 4 + 2),
    scale: v(pos, o * 4 + 3),
    g: v(glyph, o),
    rgb: [v(fg, o * 4), v(fg, o * 4 + 1), v(fg, o * 4 + 2)],
    a: v(fg, o * 4 + 3),
    bgRgb: [v(bg, o * 4), v(bg, o * 4 + 1), v(bg, o * 4 + 2)],
    ba: v(bg, o * 4 + 3),
  };
}
const near = (rgb: readonly number[], want: readonly number[] | undefined, eps = 1e-4) =>
  rgb.every((v, q) => Math.abs(v - (want?.[q] ?? Number.NaN)) < eps);
const hidden = (c: KodComposer, o: number) => inst(c, o).a === 0 && inst(c, o).ba === 0;
const visibleCount = (c: KodComposer) =>
  Array.from({ length: KOD_INSTANCES }, (_, o) => o).filter((o) => !hidden(c, o)).length;
const isScramble = (c: KodComposer, o: number) => {
  const k = inst(c, o);
  return Math.abs(k.a - 0.85) < 1e-6 && near(k.rgb, PALETTE[ROLE.scramble]);
};

/** B katmanında S'nin son karesinden görünür biçimde sapan hücreler (boşluk glifinin saydamlığı görünmez) */
function mismatches(c: KodComposer, S: Screen): number[] {
  const bad: number[] = [];
  for (let i = 0; i < KOD_CELLS; i++) {
    const k = inst(c, KOD_CELLS + i);
    const g = S.g[i] ?? 0,
      fa = S.fa[i] ?? 0,
      ba = S.ba[i] ?? 0;
    const fgOk =
      g === 0 || fa === 0
        ? k.a === 0 || k.g === 0
        : k.g === g && k.a === fa && near(k.rgb, PALETTE[S.fr[i] ?? 0]);
    const bgOk = k.ba === ba && (ba === 0 || near(k.bgRgb, PALETTE[S.br[i] ?? 0]));
    if (!fgOk || !bgOk) bad.push(i);
  }
  return bad;
}

/** A gösteriliyor (snap), sonra B'ye adım değişimi t = 10'da */
function stepped(): KodComposer {
  const c = composer();
  c.keyChange('a', 0, true);
  c.narrative(A, 0, false);
  c.keyChange('b', 10);
  return c;
}

describe('KodComposer: tamponlar', () => {
  it('2 katman × 56 × 24 örnek; SETTLE = en uzun ilk-kare gecikmesi + parlama payı', () => {
    expect(KOD_CELLS).toBe(56 * 24);
    expect(KOD_INSTANCES).toBe(2 * KOD_CELLS);
    const b = createKodBuffers();
    expect([b.pos.length, b.glyph.length, b.fg.length, b.bg.length]).toEqual([
      4 * KOD_INSTANCES,
      KOD_INSTANCES,
      4 * KOD_INSTANCES,
      4 * KOD_INSTANCES,
    ]);
    expect(KodComposer.SETTLE).toBeCloseTo(1.5 * (0.04 + 0.62 + 0.12 + 0.22) + 0.6, 9);
    const out = createKodBuffers();
    expect(new KodComposer(out).out).toBe(out);
  });
});

describe('KodComposer.narrative: adım değişimi (§5.20.5)', () => {
  it('snap (kesme, geri yükleme, ilk kare): B katmanı son kareyi hemen yazar, A katmanı gizli', () => {
    const c = composer();
    expect(c.key).toBe('');
    expect(c.keyChange('b', 5, true)).toBe(true);
    expect(c.key).toBe('b');
    c.narrative(B, 5, false);
    expect(mismatches(c, B)).toEqual([]);
    for (let i = 0; i < KOD_CELLS; i++) expect(hidden(c, i)).toBe(true);
    for (const i of [0, CHANGED, SAME, KOD_CELLS - 1]) {
      const k = inst(c, KOD_CELLS + i);
      expect([k.x, k.y, k.z, k.scale]).toEqual([
        expect.closeTo(baseX(i), 6),
        expect.closeTo(baseY(i), 6),
        expect.closeTo(REST_Z, 6),
        1,
      ]);
    }
    // ilk olmayan snap da anında
    const d = stepped();
    expect(d.keyChange('a2', 20, true)).toBe(true);
    d.narrative(A, 20, false);
    expect(mismatches(d, A)).toEqual([]);
  });

  it('aynı anahtar değişim sayılmaz', () => {
    const c = stepped();
    const t0 = c.tChange;
    expect(c.keyChange('b', 99)).toBe(false);
    expect(c.tChange).toBe(t0);
  });

  it('değişen hücre gecikmesine dek eski glifi tutar, ≈ 0.28 s karışık glif gösterir, accent parlamasıyla (≈ 0.3 s) oturur', () => {
    const c = stepped();
    expect(c.tChange).toBe(10);
    c.narrative(B, 10, false);
    expect(inst(c, KOD_CELLS + CHANGED).g).toBe(A.g[CHANGED]); // t = tChange: hâlâ eski glif

    const dt = 0.002;
    const phases: string[] = [];
    let flashStart: number[] | null = null;
    for (let k = 0; k * dt <= KodComposer.SETTLE; k++) {
      c.narrative(B, 10 + k * dt, false);
      const o = KOD_CELLS + CHANGED,
        s = inst(c, o);
      let p: string;
      if (s.g === B.g[CHANGED] && s.a === B.fa[CHANGED])
        p = near(s.rgb, PALETTE[ROLE.ink]) ? 'son' : 'parlama';
      else if (s.g === A.g[CHANGED] && s.a === A.fa[CHANGED] && near(s.rgb, PALETTE[ROLE.ink]))
        p = 'eski';
      else if (isScramble(c, o) && SCRAMBLE.includes(s.g) && s.z > REST_Z) p = 'karışık';
      else p = `? ${JSON.stringify(s)}`;
      if (p === 'parlama' && !flashStart) flashStart = s.rgb;
      phases.push(p);
      // değişmeyen hücre hiç kıpırdamaz
      const u = inst(c, KOD_CELLS + SAME);
      expect([u.g, u.a, near(u.rgb, PALETTE[ROLE.ink])]).toEqual([B.g[SAME], B.fa[SAME], true]);
    }
    expect(phases.filter((p, k) => p !== phases[k - 1])).toEqual([
      'eski',
      'karışık',
      'parlama',
      'son',
    ]);
    const span = (p: string) => phases.filter((q) => q === p).length * dt;
    expect(span('karışık')).toBeCloseTo(0.28, 2);
    expect(Math.abs(span('parlama') - 0.3)).toBeLessThan(0.01);
    expect(near(flashStart ?? [], PALETTE[ROLE.accent], 0.05)).toBe(true); // parlama accent'ten başlar
  });

  it('yalnız rengi değişen hücre 0.35 s’de geçer, karışık glif göstermez', () => {
    const recolored = new Screen();
    recolored.g.set(A.g);
    recolored.fr.set(A.fr);
    recolored.fa.set(A.fa);
    recolored.put(2, 12, 'ortak satır', ROLE.brass, 1);
    const c = composer();
    c.keyChange('a', 0, true);
    c.narrative(A, 0, false);
    c.keyChange('a+', 10);
    const at = (el: number) => {
      c.narrative(recolored, 10 + el, false);
      return inst(c, KOD_CELLS + SAME);
    };
    expect(near(at(0).rgb, PALETTE[ROLE.ink])).toBe(true);
    const mid = at(0.175);
    expect(mid.rgb[1]).toBeGreaterThan(0.2);
    expect(mid.rgb[1]).toBeLessThan(0.9);
    expect(near(at(0.35).rgb, PALETTE[ROLE.brass])).toBe(true);
    for (let el = 0; el < 0.5; el += 0.01) {
      const k = at(el);
      expect([k.g, k.a, isScramble(c, KOD_CELLS + SAME)]).toEqual([A.g[SAME], 1, false]);
    }
  });

  it('vurgu (fx) açılan satır aynı glifle de yeniden çözülür (journey:active)', () => {
    const lit = new Screen();
    for (const k of ['g', 'fr', 'fa', 'br', 'ba'] as const) lit[k].set(A[k]);
    lit.put(2, 12, 'ortak satır', ROLE.ink, 1, 1);
    const c = composer();
    c.keyChange('a', 0, true);
    c.narrative(A, 0, false);
    c.keyChange('a:aktif', 10);
    let litScrambled = false,
      otherScrambled = false;
    for (let el = 0; el <= KodComposer.SETTLE; el += 0.01) {
      c.narrative(lit, 10 + el, false);
      litScrambled ||= isScramble(c, KOD_CELLS + SAME);
      otherScrambled ||= isScramble(c, KOD_CELLS + cell(2, 20));
    }
    expect([litScrambled, otherScrambled]).toEqual([true, false]);
    expect(mismatches(c, lit)).toEqual([]);
  });

  it('SETTLE sonunda her hücre son karededir (dinlenmede karışık glif yok, §4.1.5); reduce çözülmeyi atlar', () => {
    const c = stepped();
    c.narrative(B, c.tChange + KodComposer.SETTLE, false);
    expect(mismatches(c, B)).toEqual([]);
    const first = composer();
    first.keyChange('b', 0); // ilk, snap'siz: 0.3 s ön gecikme ve 1.5× gecikme
    first.narrative(B, first.tChange + KodComposer.SETTLE, false);
    expect(mismatches(first, B)).toEqual([]);
    const reduced = stepped();
    reduced.narrative(B, reduced.tChange, true);
    expect(mismatches(reduced, B)).toEqual([]);
  });

  it('anlık görüntü görünen katmandan alınır: köprü karesinden adıma geçişte eski glif A’nın', () => {
    const c = composer();
    c.keyChange('köprü', 0, true);
    c.bridge(A, B, 0, 0, false); // A katmanı görünür
    c.keyChange('b', 1);
    c.narrative(B, 1, false);
    const k = inst(c, KOD_CELLS + CHANGED);
    expect([k.g, k.a]).toEqual([A.g[CHANGED], A.fa[CHANGED]]);
  });
});

describe('KodComposer.bridge: köprü (§5.20.5, K-CHOREO-3)', () => {
  it('bt = 0: A katmanı A’yı yerinde gösterir, B katmanı gizli; ortak çerçeve B katmanında', () => {
    const c = composer();
    c.bridge(A, B, 0, 0, false);
    const bad: string[] = [];
    for (let i = 0; i < KOD_CELLS; i++) {
      const a = inst(c, i),
        b = inst(c, KOD_CELLS + i);
      if (sharedRing(i)) {
        if (!hidden(c, i) || b.g !== RING[i] || b.a !== B.fa[i]) bad.push(`çerçeve ${i}`);
        continue;
      }
      if (!hidden(c, KOD_CELLS + i)) bad.push(`B görünür ${i}`);
      if (!(A.g[i] || (A.ba[i] ?? 0) > 0)) {
        if (!hidden(c, i)) bad.push(`A boş hücre görünür ${i}`);
        continue;
      }
      const ok =
        a.g === A.g[i] &&
        a.a === A.fa[i] &&
        a.ba === A.ba[i] &&
        near(a.rgb, PALETTE[A.fr[i] ?? 0]) &&
        Math.abs(a.x - baseX(i)) < 1e-6 &&
        Math.abs(a.y - baseY(i)) < 1e-6 &&
        Math.abs(a.z - REST_Z) < 1e-6;
      if (!ok) bad.push(`A ${i}`);
    }
    expect(bad).toEqual([]);
  });

  it('bt = 1: A katmanı tamamen gizli, B katmanı B’nin gliflerini tam saydamlıkla yerinde gösterir', () => {
    const c = composer();
    c.bridge(A, B, 1, 3, false);
    const bad: string[] = [];
    for (let i = 0; i < KOD_CELLS; i++) {
      if (!hidden(c, i)) bad.push(`A görünür ${i}`);
      const b = inst(c, KOD_CELLS + i);
      if (sharedRing(i)) {
        if (b.g !== RING[i] || b.a !== B.fa[i]) bad.push(`çerçeve ${i}`);
        continue;
      }
      if (!(B.g[i] || (B.ba[i] ?? 0) > 0)) {
        if (!hidden(c, KOD_CELLS + i)) bad.push(`B boş hücre görünür ${i}`);
        continue;
      }
      const ok =
        b.g === B.g[i] &&
        b.a === B.fa[i] &&
        Math.abs(b.x - baseX(i)) < 1e-6 &&
        Math.abs(b.y - baseY(i)) < 1e-6;
      if (!ok) bad.push(`B ${i}`);
    }
    expect(bad).toEqual([]);
    // azaltılmış harekette uç tam son karedir (renk ve zemin dahil)
    const r = composer();
    r.bridge(A, B, 1, 3, true);
    expect(mismatches(r, B)).toEqual([]);
  });

  it('azaltılmış hareket: köprü 0.5’te kesmedir', () => {
    const c = composer();
    c.bridge(A, B, 0.49, 0, true);
    expect(inst(c, CHANGED).g).toBe(A.g[CHANGED]);
    expect(hidden(c, KOD_CELLS + CHANGED)).toBe(true);
    c.bridge(A, B, 0.5, 0, true);
    expect(hidden(c, CHANGED)).toBe(true);
    expect(mismatches(c, B)).toEqual([]);
  });

  it('A sütun sütun düşer (aynı sütun birlikte); B yukarıdan aşağı çözülür', () => {
    const c = composer();
    c.bridge(A, B, 0.2, 0, false);
    const falling = new Map<number, Set<boolean>>();
    for (let i = 0; i < KOD_CELLS; i++) {
      if (sharedRing(i) || !A.g[i] || hidden(c, i)) continue;
      // düşüş y'yi azaltır; float32'de çok küçük düşüş ayırt edilemez, o hücre atlanır
      const dy = inst(c, i).y - Math.fround(baseY(i));
      if (dy > -1e-6 && Math.abs(dy) > 1e-7) continue;
      const col = i % KOD_COLS;
      const set = falling.get(col) ?? new Set<boolean>();
      set.add(dy <= -1e-6);
      falling.set(col, set);
    }
    for (const [col, set] of falling) expect(set.size, `sütun ${col}`).toBe(1);
    const states = [...falling.values()].map((s) => [...s][0]);
    expect(states).toContain(true);
    expect(states).toContain(false);

    c.bridge(A, B, 0.5, 0, false);
    for (let i = 0; i < KOD_CELLS; i++) {
      if (sharedRing(i) || !B.g[i]) continue;
      const r = Math.floor(i / KOD_COLS);
      if (r <= 9) expect(inst(c, KOD_CELLS + i).a, `satır ${r}`).toBeGreaterThan(0);
      if (r >= 17) expect(hidden(c, KOD_CELLS + i), `satır ${r}`).toBe(true);
    }
  });

  it('çerçeve hücreleri A ve B’de aynıysa düşmez: her bt’de yerinde, B’nin rengiyle', () => {
    const shared = Array.from({ length: KOD_CELLS }, (_, i) => i).filter(sharedRing);
    expect(shared.length).toBeGreaterThan(2 * (KOD_ROWS - 2)); // en az yan kenarlar
    expect(sharedRing(cell(11, 0))).toBe(false); // başlıklar farklı: düşer
    const c = composer();
    for (const bt of [0, 0.2, 0.5, 0.8, 1]) {
      c.bridge(A, B, bt, 7, false);
      for (const i of shared) {
        const b = inst(c, KOD_CELLS + i);
        expect(hidden(c, i)).toBe(true);
        expect([b.g, b.a, b.ba, b.scale]).toEqual([RING[i], B.fa[i], 0, 1]);
        expect(near(b.rgb, PALETTE[B.fr[i] ?? 0])).toBe(true);
        expect([b.x, b.y, b.z]).toEqual([
          expect.closeTo(baseX(i), 6),
          expect.closeTo(baseY(i), 6),
          expect.closeTo(REST_Z, 6),
        ]);
      }
    }
  });

  it('köprü anchorMix’in saf fonksiyonudur: ileri-geri kaydırma aynı kareyi verir (K-CHOREO-3)', () => {
    const scrubbed = composer();
    for (const bt of [0.1, 0.4, 0.7, 0.95, 0.6, 0.3]) scrubbed.bridge(A, B, bt, 4, false);
    const direct = composer();
    direct.bridge(A, B, 0.3, 4, false);
    const bad: number[] = [];
    for (let o = 0; o < KOD_INSTANCES; o++) {
      const s = inst(scrubbed, o),
        d = inst(direct, o);
      if (s.a !== d.a || s.ba !== d.ba) bad.push(o);
      else if (
        (s.a > 0 || s.ba > 0) &&
        JSON.stringify([s.x, s.y, s.z, s.g, s.rgb, s.bgRgb]) !==
          JSON.stringify([d.x, d.y, d.z, d.g, d.rgb, d.bgRgb])
      )
        bad.push(o);
    }
    expect(bad).toEqual([]);
  });
});

describe('KodComposer.reset / hideAll', () => {
  const top = new Screen();
  chrome(top, 'x', '', '');
  top.put(2, 1, 'yalnız üst satır', ROLE.ink, 1);
  const bottom = new Screen();
  chrome(bottom, 'y', '', '');
  bottom.put(2, 21, 'alt satır '.repeat(5), ROLE.ink, 1);
  bottom.put(2, 22, 'en alt satır '.repeat(4), ROLE.muted, 1);

  it('hideAll her örneği gizler', () => {
    const c = composer();
    c.keyChange('b', 0, true);
    c.narrative(B, 0, false);
    expect(visibleCount(c)).toBeGreaterThan(0);
    c.hideAll();
    expect(visibleCount(c)).toBe(0);
  });

  it('reset: her şeyi gizler; sonraki değişim ilk değişimdir (0.3 s ön gecikme, 1.5× yavaş çözülme)', () => {
    const c = composer();
    c.keyChange('x', 0, true);
    c.narrative(top, 0, false);
    c.reset();
    expect(visibleCount(c)).toBe(0);
    expect(c.key).toBe('');
    expect(c.keyChange('x', 10)).toBe(true); // aynı anahtar yeniden değişim sayılır
    expect(c.tChange).toBeCloseTo(10.3, 9);

    const first = composer();
    first.keyChange('x', 0, true);
    first.narrative(top, 0, false);
    first.reset();
    first.keyChange('y', 10);
    first.narrative(bottom, first.tChange + 1.31, false);
    const later = composer();
    later.keyChange('x', 0, true);
    later.narrative(top, 0, false);
    later.keyChange('y', 10);
    later.narrative(bottom, later.tChange + 1.31, false);
    expect(later.tChange).toBe(10);
    expect(mismatches(later, bottom)).toEqual([]); // ilk olmayan değişim ≤ 1.3 s'de biter
    expect(mismatches(first, bottom).length).toBeGreaterThan(0); // ilk değişim hâlâ çözülüyor
    first.narrative(bottom, first.tChange + KodComposer.SETTLE, false);
    expect(mismatches(first, bottom)).toEqual([]);
  });

  const filled = Array.from({ length: KOD_CELLS }, (_, i) => i).filter(
    (i) => (B.g[i] ?? 0) > 0 && (B.fa[i] ?? 0) > 0,
  );

  // HATA (kod-compose.ts keyChange/narrative): hot reload (ilk, snap'siz değişim; KodRig `snap = !hot`) çıkış
  // tamponundan anlık görüntü alır; tampon boş olduğundan dolu hücreler gecikmelerine dek SAYDAMLIK 0 ile çizilir
  // (main.dart ile: t = 0'da 415/415 dolu hücre görünmez, t = 1 s'de hâlâ 60). §5.20.5: "her hücre gecikmesine kadar
  // kendi glifini tutar … Ekran hiçbir an boşalmaz"; §4.6.5: "ilk kare statik panelle hizalıdır".
  it('HATA: hot reload ekranı boşaltmaz; dolu hücreler gecikmesine dek kendi glifini tutar', () => {
    const c = composer();
    c.keyChange('hero', 0);
    const blank: string[] = [];
    for (let t = 0; t <= c.tChange + KodComposer.SETTLE; t += 0.02) {
      c.narrative(B, t, false);
      for (const i of filled) if (!(inst(c, KOD_CELLS + i).a > 0)) blank.push(`t=${t.toFixed(2)}`);
    }
    expect([...new Set(blank)]).toEqual([]);
    const c0 = composer();
    c0.keyChange('hero', 0);
    c0.narrative(B, 0, false);
    expect(filled.filter((i) => inst(c0, KOD_CELLS + i).g !== B.g[i])).toEqual([]);
  });

  // HATA (kod-compose.ts reset): reset yalnız saydamlıkları sıfırlar, glif tamponu kalır. Aynı programa dönüşte
  // (debug "hot reload'u oynat": composer.reset() + forceHot) anlık görüntü eski glifleri bulur, hiçbir hücre
  // "değişmiş" sayılmaz: çözülme oynamaz, panel 0.3 s boş kalıp 0.35 s'de belirir.
  it('HATA: reset sonrası aynı programa dönüş hot reload’u yeniden oynatır (hücreler çözülür)', () => {
    const c = composer();
    c.keyChange('hero', 0, true);
    c.narrative(B, 0, false);
    c.reset();
    c.keyChange('hero', 10);
    let scrambled = 0;
    for (let t = 10; t <= c.tChange + KodComposer.SETTLE; t += 0.01) {
      c.narrative(B, t, false);
      for (const i of filled) if (isScramble(c, KOD_CELLS + i)) scrambled++;
    }
    expect(scrambled).toBeGreaterThan(0);
  });
});
