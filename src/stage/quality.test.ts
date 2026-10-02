// src/stage/quality.test.ts — KOD kademe tablosu (§5.20.7) ve kalite merdiveni (§5.11.4).
import { describe, expect, it } from 'vitest';
import { initialQuality, stepDown, stepUp, TIERS, type QualityState } from './quality';

describe('TIERS (§5.20.7)', () => {
  it('kademe değerleri tabloyla birebir aynıdır', () => {
    expect(TIERS).toEqual({
      high: { dprMax: 2, antialias: true, motion: true },
      medium: { dprMax: 1.5, antialias: false, motion: true },
      low: { dprMax: 1, antialias: false, motion: false },
    });
  });
});

describe('kalite merdiveni (§5.11.4)', () => {
  const describeQ = (q: QualityState) => `${q.dpr}/${q.motion ? 'm' : '-'}`;

  it('initialQuality: dpr = clamp(devicePixelRatio, 1, dprMax)', () => {
    expect(initialQuality('high', 3)).toEqual({ dpr: 2, motion: true });
    expect(initialQuality('medium', 2)).toEqual({ dpr: 1.5, motion: true });
    expect(initialQuality('low', 2.625)).toEqual({ dpr: 1, motion: false });
    expect(initialQuality('high', 0.5).dpr).toBe(1);
    expect(initialQuality('high', Number.NaN).dpr).toBe(1);
  });

  it('high (DPR 2) stepDown dizisi: 1.75, 1.5, 1.25, 1, hareket kapalı, null; stepUp tersine çevirir', () => {
    const seq: string[] = [];
    let q: QualityState = initialQuality('high', 2);
    const base = q;
    for (;;) {
      const next = stepDown(q);
      if (!next) break;
      seq.push(describeQ(next));
      q = next;
    }
    expect(seq).toEqual(['1.75/m', '1.5/m', '1.25/m', '1/m', '1/-']);
    const up: string[] = [];
    for (;;) {
      const next = stepUp(q, base);
      if (!next) break;
      up.push(describeQ(next));
      q = next;
    }
    expect(up).toEqual(['1/m', '1.25/m', '1.5/m', '1.75/m', '2/m']);
    expect(stepUp(base, base)).toBeNull();
  });

  it('kesirli dpr 1’de durur; low base hareketi açmaz', () => {
    expect(stepDown({ dpr: 1.1, motion: false })?.dpr).toBe(1);
    const base = initialQuality('low', 1);
    expect(stepDown(base)).toBeNull();
    expect(stepUp(base, base)).toBeNull();
  });
});
