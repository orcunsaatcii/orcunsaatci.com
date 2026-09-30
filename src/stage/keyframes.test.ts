// src/stage/keyframes.test.ts — §5.8 anahtar tablosu ve D-42 anahtar kaydı
import { describe, expect, it } from 'vitest';
import {
  KEYFRAME_KEYS,
  KEYFRAME_LABEL,
  cameraPosition,
  contentCtx,
  keyframes,
  type KeyframeKey,
} from './keyframes';

/** §5.8.1 ve §5.8.2 tablolarındaki "Kamera konumu" sütunu */
const CAMERA: Record<KeyframeKey, [number, number, number]> = {
  hero: [-2.15, 1.08, 4.61],
  'about-lift': [-2.15, 1.08, 4.61],
  'about-cut-in': [-0.89, 3.09, 3.57],
  'about-half': [-0.64, 3.77, 2.56],
  'areas-plan': [0, 7.2, 0.25],
  'work-specimen': [0, 1.92, 5.26],
  'journey-core': [0, 5.52, 1.79],
  'contact-ring': [0, 1.84, 4.54],
  folio: [0, 1.92, 5.26],
  'plan-small': [0, 7.2, 0.25],
  'cv-core': [0, 5.52, 1.79],
  'about-page': [-0.64, 3.77, 2.56],
  'contact-page': [0, 1.84, 4.54],
};

describe('anahtar kaydı (D-42)', () => {
  it('13 anahtar vardır: K0, K1a, K1b, K1, K2–K5 ve D1–D5', () => {
    expect(KEYFRAME_KEYS).toHaveLength(13);
    expect(KEYFRAME_KEYS.map((k) => KEYFRAME_LABEL[k])).toEqual([
      'K0',
      'K1a',
      'K1b',
      'K1',
      'K2',
      'K3',
      'K4',
      'K5',
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
    ]);
    expect(Object.keys(keyframes(contentCtx(4, [0, 1, 2, 3]))).sort()).toEqual(
      [...KEYFRAME_KEYS].sort(),
    );
  });
});

describe('kamera (§5.7.1)', () => {
  it('r/az/el tablodaki kamera konumunu verir (±0.01)', () => {
    const kf = keyframes(contentCtx(4, [0]));
    for (const key of KEYFRAME_KEYS) {
      const p = cameraPosition(kf[key]);
      CAMERA[key].forEach((v, i) => expect(p[i], `${key}[${i}]`).toBeCloseTo(v, 2));
    }
  });
});

describe('içerik bağlamı ve dönüşler (§5.8.1)', () => {
  it('N = 4, proje 1 alan 0: W₀ = wrapNear(45, −225) = −315', () => {
    const ctx = contentCtx(4, [0, 1, 2, 3]);
    expect(ctx.areasMode).toBe('dial');
    expect(ctx.psi).toEqual([45, -45, -135, -225]);
    expect(ctx.lastPsi).toBe(-225);
    expect(ctx.W0).toBe(-315);
    const kf = keyframes(ctx);
    expect(kf['areas-plan'].rotY).toBe(45);
    expect(kf['work-specimen'].rotY).toBe(-315);
    expect(kf['journey-core'].rotY).toBe(-265);
    expect(kf['contact-ring'].rotY).toBe(-185);
  });

  it('proje 1’in alanı yoksa W₀ = lastPsi; liste modunda referans 45', () => {
    expect(contentCtx(4, [null]).W0).toBe(-225);
    expect(contentCtx(3, []).W0).toBe(-195);
    const list = contentCtx(8, [2]);
    expect(list.areasMode).toBe('list');
    expect(list.lastPsi).toBe(45);
    expect(Math.abs(list.W0 - 45)).toBeLessThanOrEqual(180);
  });

  it('W₀ kadranın son yönelimine ±180° içindedir', () => {
    for (let n = 3; n <= 6; n++) {
      for (let a = 0; a < n; a++) {
        const ctx = contentCtx(n, [a]);
        expect(Math.abs(ctx.W0 - ctx.lastPsi)).toBeLessThanOrEqual(180);
      }
    }
  });

  it('dolgular: K2 fill[0] = 1, diğerleri 0.15; K3 proje alanı 0.6, diğerleri 0.12; K4–K5 0', () => {
    const kf = keyframes(contentCtx(4, [2]));
    expect(kf['areas-plan'].fills).toEqual([1, 0.15, 0.15, 0.15, 0.15, 0.15]);
    expect(kf['work-specimen'].fills).toEqual([0.12, 0.12, 0.6, 0.12, 0.12, 0.12]);
    expect(kf['journey-core'].fills).toEqual([0, 0, 0, 0, 0, 0]);
    expect(kf['contact-ring'].fills).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('tabloda olmayan alanlar: rim K0–K4 0.25, K5 0.35; bant K3–K4 görünür', () => {
    const kf = keyframes(contentCtx(4, [0]));
    expect(kf.hero.rim).toBe(0.25);
    expect(kf['journey-core'].rim).toBe(0.25);
    expect(kf['contact-ring'].rim).toBe(0.35);
    expect(KEYFRAME_KEYS.filter((k) => kf[k].bandVisible === 1)).toEqual([
      'work-specimen',
      'journey-core',
      'folio',
      'cv-core',
    ]);
    expect(kf.hero.cut).toBe(1.1);
    expect(kf['about-half'].cut).toBe(0);
  });
});
