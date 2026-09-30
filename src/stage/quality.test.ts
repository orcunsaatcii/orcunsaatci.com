// src/stage/quality.test.ts — kademe tablosu (§5.11.1) ve kalite merdiveni (§5.11.4).
import { describe, expect, it } from 'vitest';
import { initialQuality, SEGMENTS, stepDown, stepUp, TIERS, type QualityState } from './quality';

/** SphereGeometry(1, W, H): (W + 1)(H + 1) vertex, kutuplarda tek üçgenli halkalarla 2·W·(H − 1) üçgen */
const vertices = ([w, h]: readonly [number, number]) => (w + 1) * (h + 1);
const triangles = ([w, h]: readonly [number, number]) => 2 * w * (h - 1);

describe('TIERS (§5.11.1)', () => {
  it('kademe değerleri tabloyla birebir aynıdır', () => {
    expect(TIERS).toEqual({
      high: {
        segments: 'high',
        octaves: 2,
        ghost: true,
        dprMax: 2,
        antialias: true,
        idle: true,
        pointer: true,
      },
      medium: {
        segments: 'medium',
        octaves: 1,
        ghost: false,
        dprMax: 1.5,
        antialias: false,
        idle: true,
        pointer: true,
      },
      low: {
        segments: 'low',
        octaves: 1,
        ghost: false,
        dprMax: 1,
        antialias: false,
        idle: false,
        pointer: false,
      },
    });
  });

  it('segment kafesleri §5.3.1 vertex ve üçgen sayılarını verir', () => {
    expect([vertices(SEGMENTS.high), triangles(SEGMENTS.high)]).toEqual([12_513, 24_320]);
    expect([vertices(SEGMENTS.medium), triangles(SEGMENTS.medium)]).toEqual([7_081, 13_632]);
    expect([vertices(SEGMENTS.low), triangles(SEGMENTS.low)]).toEqual([4_015, 7_632]);
  });

  it('yalnız high kademe ghost çizer ve 2 oktav kullanır', () => {
    expect(
      Object.entries(TIERS)
        .filter(([, t]) => t.ghost)
        .map(([k]) => k),
    ).toEqual(['high']);
    expect(
      Object.entries(TIERS)
        .filter(([, t]) => t.octaves === 2)
        .map(([k]) => k),
    ).toEqual(['high']);
  });
});

describe('kalite merdiveni (§5.11.4)', () => {
  const describeQ = (q: QualityState) =>
    `${q.dpr}/${q.ghost ? 'g' : '-'}/${q.octaves}/${q.segments}`;

  it('initialQuality: dpr = clamp(devicePixelRatio, 1, dprMax)', () => {
    expect(initialQuality('high', 3)).toEqual({
      dpr: 2,
      ghost: true,
      octaves: 2,
      segments: 'high',
    });
    expect(initialQuality('medium', 2)).toMatchObject({ dpr: 1.5, ghost: false, octaves: 1 });
    expect(initialQuality('low', 2.625).dpr).toBe(1);
    expect(initialQuality('high', 0.5).dpr).toBe(1);
    expect(initialQuality('high', Number.NaN).dpr).toBe(1);
  });

  it('high (DPR 2) stepDown dizisi: 1.75, 1.5, 1.25, 1, ghost kapalı, oktav 1, medium, low, null', () => {
    const seq: string[] = [];
    let q: QualityState | null = initialQuality('high', 2);
    const base = q;
    for (;;) {
      const next: QualityState | null = stepDown(q);
      if (!next) break;
      seq.push(describeQ(next));
      q = next;
    }
    expect(seq).toEqual([
      '1.75/g/2/high',
      '1.5/g/2/high',
      '1.25/g/2/high',
      '1/g/2/high',
      '1/-/2/high',
      '1/-/1/high',
      '1/-/1/medium',
      '1/-/1/low',
    ]);
    // stepUp diziyi base'i aşmadan tersine çevirir
    const up: string[] = [];
    for (;;) {
      const next: QualityState | null = stepUp(q, base);
      if (!next) break;
      up.push(describeQ(next));
      q = next;
    }
    expect(up).toEqual([...seq.slice(0, -1)].reverse().concat(describeQ(base)));
    expect(stepUp(base, base)).toBeNull();
  });

  it('kesirli dpr 1’de durur; medium base ghost/oktav açmaz', () => {
    expect(stepDown({ dpr: 1.1, ghost: false, octaves: 1, segments: 'medium' })?.dpr).toBe(1);
    const base = initialQuality('medium', 1);
    const low = { ...base, segments: 'low' as const };
    expect(stepUp(low, base)).toEqual(base);
    expect(stepUp(base, base)).toBeNull();
  });
});
