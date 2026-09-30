// src/stage/quality.test.ts — kademe tablosu (§5.11.1). stepDown/stepUp testleri M5'te eklenir.
import { describe, expect, it } from 'vitest';
import { SEGMENTS, TIERS } from './quality';

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
