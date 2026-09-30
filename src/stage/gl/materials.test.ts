// src/stage/gl/materials.test.ts — materials.ts sözleşmesi (§5.4.6), uniform referansı (§5.5), tema bağlama (§5.6.6)
import {
  CustomBlending,
  DoubleSide,
  FrontSide,
  OneFactor,
  OneMinusSrcAlphaFactor,
  SrcAlphaFactor,
} from 'three';
import { describe, expect, it } from 'vitest';
import { themeColors } from '@/design/tokens';
import { INTENSITY, PROFILES } from '@/experience/profile';
import { SEGMENTS, TIERS } from '../quality';
import {
  CUT_WHOLE,
  MAX_DISP,
  applyTheme,
  createMaterials,
  createStoneGeometry,
  createUniforms,
  disposeMaterials,
  stoneProfileOf,
} from './materials';
import { ghostFrag } from './shaders/ghost.frag';
import { SNOISE3 } from './shaders/noise.glsl';
import { shadowFrag, shadowVert } from './shaders/shadow';
import { stoneFrag } from './shaders/stone.frag';
import { stoneVert } from './shaders/stone.vert';

const engineer = stoneProfileOf(PROFILES.engineer);

describe('createUniforms', () => {
  it('profil değerlerini taşır; kesilmemiş Taş’ta kapak yarıçapı 0’dır', () => {
    const u = createUniforms(engineer);
    expect(u.uShape.value.toArray()).toEqual([5, 5]);
    expect(u.uRadii.value.toArray()).toEqual([1, 0.8, 1]);
    expect(u.uDisp.value).toBe(0);
    expect(u.uPlane.value.toArray()).toEqual([0, 1, 0, CUT_WHOLE]);
    expect(u.uCapRadius.value).toBe(0);
    expect(u.uRingWarp.value).toBe(0.04);
    expect(u.uBand.value.toArray()).toEqual([-10, -10, 0]);
    expect(u.uWave.value).toBe(-1);
    expect(u.uSectorFill.value).toHaveLength(6);
    expect(u.uRingEdges.value).toHaveLength(25);
  });

  it('uDisp’i 0.045 ile sınırlar (ZORUNLU, §5.3.3)', () => {
    expect(createUniforms({ ...engineer, disp: 0.08 }).uDisp.value).toBe(MAX_DISP);
  });
});

describe('createMaterials', () => {
  const u = createUniforms(engineer);
  const m = createMaterials(u, {
    octaves: TIERS.high.octaves,
    pattern: PROFILES.engineer.cap.pattern,
    surface: PROFILES.engineer.stone.surface,
    waveWidthPx: INTENSITY.standard.waveWidthPx,
  });

  it('engineer varyantı: contours kapak, anodized yüzey, 2 oktav, float dalga kalınlığı', () => {
    expect(m.stone.defines).toEqual({
      OCTAVES: 2,
      CAP_PATTERN_CONTOURS: '',
      SURFACE_ANODIZED: '',
      WAVE_WIDTH_PX: '2.0',
    });
    expect(m.stone.side).toBe(DoubleSide);
    expect(m.stone.transparent).toBe(false);
    expect(m.stone.depthWrite).toBe(true);
  });

  it('ghost saydamdır, derinlik yazmaz, yalnız ön yüz', () => {
    expect(m.ghost.defines).toEqual({ OCTAVES: 2 });
    expect([m.ghost.transparent, m.ghost.depthWrite, m.ghost.side]).toEqual([
      true,
      false,
      FrontSide,
    ]);
  });

  it('shadow opak listede Taş’tan önce, normal alfa karışımıyla çizilir (Taş onu her zaman örter)', () => {
    expect([m.shadow.transparent, m.shadow.depthWrite, m.shadow.blending]).toEqual([
      false,
      false,
      CustomBlending,
    ]);
    expect([m.shadow.blendSrc, m.shadow.blendDst]).toEqual([
      SrcAlphaFactor,
      OneMinusSrcAlphaFactor,
    ]);
    expect([m.shadow.blendSrcAlpha, m.shadow.blendDstAlpha]).toEqual([
      OneFactor,
      OneMinusSrcAlphaFactor,
    ]);
  });

  it('üç malzeme aynı uniform nesnelerini paylaşır', () => {
    expect(m.stone.uniforms).toBe(u);
    expect(m.ghost.uniforms).toBe(u);
    expect(m.shadow.uniforms).toBe(u);
    disposeMaterials(m);
  });

  it('diğer desen ve yüzeyler kendi define’larını seçer', () => {
    const neutral = createMaterials(createUniforms(stoneProfileOf(PROFILES.neutral)), {
      octaves: 1,
      pattern: 'rings',
      surface: 'graphite',
      waveWidthPx: 1.5,
    });
    expect(neutral.stone.defines).toEqual({
      OCTAVES: 1,
      CAP_PATTERN_RINGS: '',
      SURFACE_GRAPHITE: '',
      WAVE_WIDTH_PX: '1.5',
    });
  });
});

describe('applyTheme (§6.3.6)', () => {
  it('renkleri tokens.ts’ten yazar; sRGB’ye geri çevrilince token’la aynıdır', () => {
    for (const theme of ['light', 'dark'] as const) {
      const u = createUniforms(engineer);
      applyTheme(u, theme);
      const c = themeColors('mekanizma', theme);
      // Color.getHex() çalışma uzayından (lineer) sRGB'ye geri çevirir
      const same = (v: { getHex(): number }, token: string) =>
        expect(v.getHex(), token).toBe(Number.parseInt(token.slice(1), 16));
      same(u.uCanvas.value, c.canvas);
      same(u.uCapBase.value, c.surface);
      same(u.uRingLine.value, c.inkMuted);
      same(u.uAccent.value, c.accent);
      same(u.uRimColor.value, c.brass);
      same(u.uGhostColor.value, c.lineStrong);
      same(u.uStoneBase.value, c.sceneStoneBase);
      same(u.uStoneLight.value, c.sceneStoneLight);
      same(u.uSky.value, c.sceneSky);
      same(u.uGround.value, c.sceneGround);
      same(u.uShadowColor.value, c.sceneShadow.rgb);
      expect(u.uShadowAlpha.value).toBe(c.sceneShadow.alpha);
    }
  });
});

describe('geometri (§5.3.1)', () => {
  it('kademe kafesleri tablo vertex ve üçgen sayılarını verir', () => {
    const expected = { high: [12_513, 24_320], medium: [7_081, 13_632], low: [4_015, 7_632] };
    for (const tier of Object.keys(SEGMENTS) as (keyof typeof SEGMENTS)[]) {
      const g = createStoneGeometry(tier);
      expect([g.attributes.position?.count, (g.index?.count ?? 0) / 3]).toEqual(expected[tier]);
      g.dispose();
    }
  });
});

describe('shader modülleri (§5.3, §5.4)', () => {
  it('upstream snoise gövdesi ve MIT başlığı korunur', () => {
    expect(SNOISE3).toContain('Ashima Arts');
    expect(SNOISE3).toContain('Distributed under the MIT License');
    expect(SNOISE3).toContain('return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), ');
  });

  it('parçalar sRGB çıkışla biter ve varsayılan define’ları taşır', () => {
    for (const frag of [stoneFrag, ghostFrag, shadowFrag]) {
      expect(frag).toContain('#include <colorspace_fragment>');
    }
    expect(stoneFrag).toContain('#define WAVE_WIDTH_PX 2.0');
    expect(stoneVert).toContain('i < OCTAVES');
    expect(shadowVert).toContain('vUv = uv;');
  });
});
