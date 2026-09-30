// src/lib/section-geometry.test.ts — §5.10 ZORUNLU testleri ve sınır durumları (§13.2.2)
import { describe, expect, it } from 'vitest';
import {
  NO_BAND,
  RINGS_MAX,
  RINGS_MIN,
  arcFraction,
  arcPath,
  bandOf,
  capRadius,
  clockAngles,
  footprintRadius,
  polar,
  psiDeg,
  ringEdges,
  ringGeometry,
  ringOf,
  ringRadius,
  sectorOffsetDeg,
  sectorPath,
  superNorm,
  wrap180,
  wrapNear,
} from './section-geometry';

const CURRENT = 2026;
// çok kısa (gelecek yıl, aynı yıl, 2 yıl), normal ve çok uzun (40 yıl) kariyerler
const STARTS = [2027, 2026, 2025, 2023, 2014, 2003, 2002, 1987];
const geometries = STARTS.map((s) => ringGeometry(s, CURRENT));
const mod360 = (a: number) => ((a % 360) + 360) % 360;

describe('ringGeometry', () => {
  it('halka sayısını 4 ve 24 ile kırpar', () => {
    expect(ringGeometry(2026, 2026).rings).toBe(RINGS_MIN);
    expect(ringGeometry(2030, 2026).rings).toBe(RINGS_MIN);
    expect(ringGeometry(1987, 2026).rings).toBe(RINGS_MAX);
    expect(ringGeometry(2014, 2026)).toEqual({
      careerStartYear: 2014,
      currentYear: 2026,
      years: 13,
      rings: 13,
      span: 13,
    });
  });

  it('span = max(years, rings)', () => {
    for (const g of geometries) expect(g.span).toBe(Math.max(g.years, g.rings));
  });
});

describe('ringOf', () => {
  it('bu yıl her zaman dış halkadadır', () => {
    for (const g of geometries) expect(ringOf(CURRENT, g)).toBe(g.rings - 1);
  });

  it('4 ≤ years ≤ 24 iken kariyer başlangıcı çekirdektedir', () => {
    for (let years = 4; years <= 24; years++) {
      const g = ringGeometry(CURRENT - years + 1, CURRENT);
      expect(ringOf(g.careerStartYear, g)).toBe(0);
    }
  });

  it('yıla göre monoton artandır ve [0, rings − 1] içinde kalır', () => {
    for (const g of geometries) {
      let prev = -Infinity;
      for (let y = g.careerStartYear - 3; y <= CURRENT + 1; y++) {
        const r = ringOf(y, g);
        expect(r).toBeGreaterThanOrEqual(prev);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(g.rings - 1);
        prev = r;
      }
    }
  });
});

describe('bandOf', () => {
  const g = ringGeometry(2014, CURRENT);

  it('sıralı sonuç verir', () => {
    expect(bandOf(2020, 2016, g)).toEqual([ringOf(2016, g), ringOf(2020, g)]);
    for (const [s, e] of [
      [2014, 2016],
      [2024, 2018],
      [2026, 2026],
    ] as const) {
      const [a, b] = bandOf(s, e, g);
      expect(a).toBeLessThanOrEqual(b);
    }
  });

  it('bitişi olmayan kayıt bu yıla kadar uzanır', () => {
    expect(bandOf(2024, null, g)).toEqual([ringOf(2024, g), g.rings - 1]);
    expect(bandOf(2024, undefined, g)).toEqual(bandOf(2024, CURRENT, g));
  });

  it('NO_BAND halka dışındadır', () => {
    expect(NO_BAND[0]).toBeLessThan(0);
    expect(NO_BAND[1]).toBeLessThan(0);
  });
});

describe('dilimler ve ψ', () => {
  it('her N ∈ 3..6 ve k için dilim merkezi ψₖ ile saat 9 yönüne gelir', () => {
    for (let n = 3; n <= 6; n++) {
      for (let k = 0; k < n; k++) {
        const a = sectorOffsetDeg(n) + ((k + 0.5) * 360) / n + psiDeg(k, n);
        expect(mod360(a)).toBeCloseTo(180, 9);
      }
    }
  });

  it('sınır durumları: 1–2 ve 7+ alan için eşitlik yine tutar (liste modu yalnız sunumu değiştirir)', () => {
    for (const n of [1, 2, 7, 8, 12]) {
      for (let k = 0; k < n; k++) {
        const a = sectorOffsetDeg(n) + ((k + 0.5) * 360) / n + psiDeg(k, n);
        expect(mod360(a)).toBeCloseTo(180, 9);
      }
    }
  });

  it('N = 4 için ψ = 45, −45, −135, −225 (§5.7.7)', () => {
    expect([0, 1, 2, 3].map((k) => psiDeg(k, 4))).toEqual([45, -45, -135, -225]);
    expect(sectorOffsetDeg(4)).toBe(90);
  });
});

describe('açı yardımcıları', () => {
  it('wrapNear sonucu ref’e en fazla 180° uzaktır ve eşdeğer açıdır', () => {
    for (let angle = -720; angle <= 720; angle += 37) {
      for (let ref = -400; ref <= 400; ref += 29) {
        const w = wrapNear(angle, ref);
        expect(Math.abs(w - ref)).toBeLessThanOrEqual(180);
        expect(mod360(w - angle)).toBeCloseTo(0, 9);
      }
    }
    expect(wrapNear(45, -225)).toBe(-315);
  });

  it('wrap180 [−180, 180] aralığına indirger', () => {
    expect(wrap180(190)).toBe(-170);
    expect(wrap180(-190)).toBe(170);
    expect(wrap180(45)).toBe(45);
  });
});

describe('capRadius ve superNorm', () => {
  const engineer = [1, 0.8, 1] as const;
  const neutral = [1, 0.86, 1] as const;

  it('capRadius(0) = radii.x ve capRadius(±radii.y) = 0', () => {
    for (const [radii, n2] of [
      [engineer, 5],
      [neutral, 2.2],
      [[0.8, 1.4, 0.8], 8],
    ] as const) {
      expect(capRadius(0, radii, n2)).toBeCloseTo(radii[0], 12);
      expect(capRadius(radii[1], radii, n2)).toBe(0);
      expect(capRadius(-radii[1], radii, n2)).toBe(0);
      expect(capRadius(radii[1] + 0.1, radii, n2)).toBe(0);
    }
  });

  it('kesit yarıçapı yüzeyin süperkuadrik denklemini sağlar', () => {
    const cut = 0.35;
    const r = capRadius(cut, engineer, 5);
    // (|x|^n2)^(n2/n2) + |y/ry|^n2 = 1 → superNorm(r, 0) üsten bağımsız olarak r'dir
    expect(r ** 5 + Math.abs(cut / 0.8) ** 5).toBeCloseTo(1, 12);
    expect(superNorm(r, 0, 5)).toBeCloseTo(r, 12);
  });

  it('superNorm: n = 2 Öklid normudur', () => {
    expect(superNorm(3, 4, 2)).toBeCloseTo(5, 12);
  });

  it('footprintRadius: ayak izinin en uzak noktası (45°) süperelips üzerindedir', () => {
    expect(footprintRadius(engineer, 5)).toBeCloseTo(1.2311, 4);
    expect(footprintRadius(neutral, 2.2)).toBeCloseTo(1.032, 3);
    expect(footprintRadius(engineer, 2)).toBeCloseTo(1, 12);
    expect(footprintRadius([0.8, 1.4, 0.8], 1.5)).toBe(0.8);
    for (const n of [2, 2.2, 5, 6, 8]) {
      const r = footprintRadius([1, 1, 1], n);
      const c = r / Math.SQRT2; // 45° noktası (c, c)
      expect(superNorm(c, c, n)).toBeCloseTo(1, 12);
    }
  });
});

describe('arcFraction', () => {
  it('1 Ocak ≈ 1/365, 31 Aralık = 1', () => {
    expect(arcFraction(new Date(2026, 0, 1))).toBeCloseTo(1 / 365, 12);
    expect(arcFraction(new Date(2026, 11, 31))).toBe(1);
  });

  it('artık yılda 366 gün sayar ve gün içi saatten etkilenmez', () => {
    expect(arcFraction(new Date(2028, 11, 31))).toBe(1);
    expect(arcFraction(new Date(2028, 1, 29, 23, 59))).toBeCloseTo(60 / 366, 12);
    expect(arcFraction(new Date(2026, 2, 29, 12))).toBeCloseTo(88 / 365, 12);
  });
});

describe('ringEdges', () => {
  it('0 ile başlar, 1 ile biter, monoton artar ve uzunluğu ağırlık + 1’dir', () => {
    for (const weights of [[1], [3, 1, 2], [0, 2, 0, 5], Array.from({ length: 30 }, () => 1)]) {
      const e = ringEdges(weights);
      expect(e[0]).toBe(0);
      expect(e.at(-1)).toBe(1);
      expect(e.length).toBe(Math.min(weights.length, RINGS_MAX) + 1);
      for (let i = 1; i < e.length; i++) expect(e[i]).toBeGreaterThanOrEqual(e[i - 1] ?? 0);
    }
  });

  it('ağırlıklar orantılıdır; toplam 0 ise eşit genişlik', () => {
    expect(ringEdges([1, 3])).toEqual([0, 0.25, 1]);
    expect(ringEdges([0, 0])).toEqual([0, 0.5, 1]);
    expect(ringEdges([])).toEqual([0, 1]);
  });
});

describe('SVG yardımcıları', () => {
  it('ringRadius ve polar', () => {
    expect(ringRadius(12, 13, 130)).toBe(130);
    expect(ringRadius(0, 4, 100)).toBe(25);
    const [x, y] = polar(100, 100, 50, 90);
    expect(x).toBeCloseTo(100, 9);
    expect(y).toBeCloseTo(50, 9);
  });

  it('sectorPath merkezden başlar, arcPath 0’da boş döner', () => {
    expect(sectorPath(0, 4, 100, 120, 120).startsWith('M120 120L')).toBe(true);
    expect(arcPath(0, 100, 90, 120, 120)).toBe('');
    expect(arcPath(0.25, 100, 90, 120, 120)).toMatch(/^M120 20A100 100 0 0 1 220 120L/);
    expect(arcPath(0.75, 100, 0, 120, 120)).toContain('A100 100 0 1 1');
  });

  it('clockAngles: 14:32 → akrep 76°, yelkovan 192°', () => {
    expect(clockAngles(new Date(2026, 8, 30, 14, 32))).toEqual({ hourDeg: 76, minuteDeg: 192 });
    expect(clockAngles(new Date(2026, 8, 30, 0, 0))).toEqual({ hourDeg: 0, minuteDeg: 0 });
  });
});
