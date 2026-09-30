// src/stage/gl/materials.ts — uniform nesneleri, ShaderMaterial fabrikaları, tema uygulama (§5.4.6, §5.5, §5.6.6).
// stone, ghost ve shadow AYNI uniform nesnelerini paylaşır; renkler yalnız tokens.ts'ten gelir (getComputedStyle YASAK).
import {
  AddEquation,
  Color,
  CustomBlending,
  DoubleSide,
  FrontSide,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  SrcAlphaFactor,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import { themeColors, type PaletteName, type ThemeName } from '@/design/tokens';
import type { CapPattern, ExperienceProfile, Surface } from '@/experience/profile';
import { capRadius } from '@/lib/section-geometry';
import { SEGMENTS, type SegmentTier } from '../quality';
import { ghostFrag } from './shaders/ghost.frag';
import { shadowFrag, shadowVert } from './shaders/shadow';
import { stoneFrag } from './shaders/stone.frag';
import { stoneVert } from './shaders/stone.vert';

export type { CapPattern, Surface };

export interface StoneProfile {
  // experience/profile.ts → stone + cap (§4.17)
  shape: readonly [number, number];
  radii: readonly [number, number, number];
  disp: number;
  noiseFreq: number;
  seed: number;
  ringWarp: number;
  pattern: CapPattern;
  surface: Surface;
}

/** uDisp üst sınırı: daha içbükey bir şekil stencil-cap tekniği (+2 draw) gerektirir (§5.3.3). */
export const MAX_DISP = 0.045;
/** Kesilmemiş Taş (§0.5 "Kesit"): cut ∈ [−0.10, 1.10] */
export const CUT_WHOLE = 1.1;
/** Taban uniform değerleri (§5.5) */
const WRAP = 0.35;
const AMBIENT = 0.18;
const RIM = 0.25;
const GRAIN = 0.035;
const GRAIN_SCALE = 220;
const BAND_LIFT = 0.18;
/** Bant yok: (−10, −10) (section-geometry NO_BAND) */
const NO_BAND_RING = -10;

type U<T> = { value: T };

/** §5.5'teki her uniform adı için bir { value } nesnesi. */
export type StageUniforms = {
  uShape: U<Vector2>;
  uRadii: U<Vector3>;
  uDisp: U<number>;
  uNoiseFreq: U<number>;
  uSeed: U<number>;
  uPlane: U<Vector4>;
  uPlaneU: U<Vector3>;
  uPlaneV: U<Vector3>;
  uCapRadius: U<number>;
  uCamObj: U<Vector3>;
  uLightObj: U<Vector3>;
  uUpObj: U<Vector3>;
  uWrap: U<number>;
  uAmbient: U<number>;
  uRimStrength: U<number>;
  uGrain: U<number>;
  uGrainScale: U<number>;
  uStoneBase: U<Color>;
  uStoneLight: U<Color>;
  uCapBase: U<Color>;
  uRingLine: U<Color>;
  uAccent: U<Color>;
  uRimColor: U<Color>;
  uSky: U<Color>;
  uGround: U<Color>;
  uCanvas: U<Color>;
  uGhostColor: U<Color>;
  uShadowColor: U<Color>;
  uShadowAlpha: U<number>;
  uRings: U<number>;
  uRingContrast: U<number>;
  uRingWarp: U<number>;
  uRingEdges: U<number[]>;
  uSectors: U<number>;
  uSectorOffset: U<number>;
  uSectorMix: U<number>;
  uSectorFill: U<number[]>;
  uSectorPreview: U<Vector2>;
  uBand: U<Vector3>;
  uBandPreview: U<Vector3>;
  uBandLift: U<number>;
  uArc: U<number>;
  uArcGlow: U<number>;
  uArcPulse: U<number>;
  uWave: U<number>;
  uTone: U<number>;
  uGhostAlpha: U<number>;
};
export type UniformName = keyof StageUniforms;

export interface MaterialOptions {
  octaves: 1 | 2;
  pattern: CapPattern;
  surface: Surface;
  /** IntensityParams.waveWidthPx → WAVE_WIDTH_PX define'ı (§5.6.7); verilmezse shader varsayılanı 2.0 */
  waveWidthPx?: number;
}

export interface StageMaterials {
  stone: ShaderMaterial;
  ghost: ShaderMaterial;
  shadow: ShaderMaterial;
}

/** cap.pattern → #define (§5.4.3). Adlar sabit tabloyla eşlenir; yerel ayara bağlı büyük harf dönüşümü yok. */
const PATTERN_DEFINE: Readonly<Record<CapPattern, string>> = {
  rings: 'CAP_PATTERN_RINGS',
  contours: 'CAP_PATTERN_CONTOURS',
  agate: 'CAP_PATTERN_AGATE',
  poche: 'CAP_PATTERN_POCHE',
  growth: 'CAP_PATTERN_GROWTH',
  geode: 'CAP_PATTERN_GEODE',
};

/** stone.surface → #define (§5.4.3) */
const SURFACE_DEFINE: Readonly<Record<Surface, string>> = {
  graphite: 'SURFACE_GRAPHITE',
  anodized: 'SURFACE_ANODIZED',
  agate: 'SURFACE_AGATE',
  travertine: 'SURFACE_TRAVERTINE',
  ice: 'SURFACE_ICE',
  oak: 'SURFACE_OAK',
  geode: 'SURFACE_GEODE',
};

/** GLSL float sabiti: "2" GLSL ES 3.00'te int'tir ve float parametreye örtük dönüşmez. */
const glslFloat = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** ExperienceProfile → StoneProfile */
export function stoneProfileOf(p: ExperienceProfile): StoneProfile {
  return {
    shape: p.stone.shape,
    radii: p.stone.radii,
    disp: p.stone.disp,
    noiseFreq: p.stone.noiseFreq,
    seed: p.stone.seed,
    ringWarp: p.cap.ringWarp,
    pattern: p.cap.pattern,
    surface: p.stone.surface,
  };
}

export function createUniforms(p: StoneProfile): StageUniforms {
  return {
    uShape: { value: new Vector2(p.shape[0], p.shape[1]) },
    uRadii: { value: new Vector3(p.radii[0], p.radii[1], p.radii[2]) },
    uDisp: { value: Math.min(p.disp, MAX_DISP) },
    uNoiseFreq: { value: p.noiseFreq },
    uSeed: { value: p.seed },
    uPlane: { value: new Vector4(0, 1, 0, CUT_WHOLE) },
    uPlaneU: { value: new Vector3(1, 0, 0) },
    uPlaneV: { value: new Vector3(0, 0, -1) },
    uCapRadius: { value: capRadius(CUT_WHOLE, p.radii, p.shape[1]) },
    uCamObj: { value: new Vector3() },
    uLightObj: { value: new Vector3(0, 1, 0) },
    uUpObj: { value: new Vector3(0, 1, 0) },
    uWrap: { value: WRAP },
    uAmbient: { value: AMBIENT },
    uRimStrength: { value: RIM },
    uGrain: { value: GRAIN },
    uGrainScale: { value: GRAIN_SCALE },
    uStoneBase: { value: new Color() },
    uStoneLight: { value: new Color() },
    uCapBase: { value: new Color() },
    uRingLine: { value: new Color() },
    uAccent: { value: new Color() },
    uRimColor: { value: new Color() },
    uSky: { value: new Color() },
    uGround: { value: new Color() },
    uCanvas: { value: new Color() },
    uGhostColor: { value: new Color() },
    uShadowColor: { value: new Color() },
    uShadowAlpha: { value: 0 },
    uRings: { value: 4 },
    uRingContrast: { value: 0 },
    uRingWarp: { value: p.ringWarp },
    uRingEdges: { value: Array.from({ length: 25 }, () => 0) },
    uSectors: { value: 0 },
    uSectorOffset: { value: 0 },
    uSectorMix: { value: 0 },
    uSectorFill: { value: [0, 0, 0, 0, 0, 0] },
    uSectorPreview: { value: new Vector2(-1, 0) },
    uBand: { value: new Vector3(NO_BAND_RING, NO_BAND_RING, 0) },
    uBandPreview: { value: new Vector3(NO_BAND_RING, NO_BAND_RING, 0) },
    uBandLift: { value: BAND_LIFT },
    uArc: { value: 0 },
    uArcGlow: { value: 0 },
    uArcPulse: { value: 0 },
    uWave: { value: -1 },
    uTone: { value: 1 },
    uGhostAlpha: { value: 0 },
  };
}

export function createMaterials(u: StageUniforms, o: MaterialOptions): StageMaterials {
  const vertexDefines = { OCTAVES: o.octaves };
  const stone = new ShaderMaterial({
    name: 'stoneMat',
    vertexShader: stoneVert,
    fragmentShader: stoneFrag,
    uniforms: u,
    side: DoubleSide,
    defines: {
      ...vertexDefines,
      [PATTERN_DEFINE[o.pattern]]: '',
      [SURFACE_DEFINE[o.surface]]: '',
      ...(o.waveWidthPx === undefined ? {} : { WAVE_WIDTH_PX: glslFloat(o.waveWidthPx) }),
    },
  });
  const ghost = new ShaderMaterial({
    name: 'ghostMat',
    vertexShader: stoneVert,
    fragmentShader: ghostFrag,
    uniforms: u,
    defines: vertexDefines,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
  });
  // SPEC-SAPMA: §5.4.5 — three saydam nesneleri renderOrder'dan bağımsız olarak opaklardan SONRA çizer. Kapak
  // hilesinde yazılan derinlik arka yüzün derinliği olduğundan saydam gölge 62°/68° eğimde kesit yüzünün üstüne
  // düşüyordu. Gölge opak listede (renderOrder −1, Taş'tan önce) normal alfa karışımıyla çizilir; §5.2'nin istediği
  // gibi Taş onu her zaman örter.
  const shadow = new ShaderMaterial({
    name: 'shadowMat',
    vertexShader: shadowVert,
    fragmentShader: shadowFrag,
    uniforms: u,
    transparent: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    depthWrite: false,
  });
  return { stone, ghost, shadow };
}

/** 10 renk uniform'u (9 stone + uGhostColor) + uShadowColor/uShadowAlpha; Color.set() sRGB → lineer çevirir (§5.6.6). */
export function applyTheme(
  u: StageUniforms,
  theme: ThemeName,
  palette: PaletteName = 'mekanizma',
): void {
  const c = themeColors(palette, theme);
  u.uCanvas.value.set(c.canvas);
  u.uCapBase.value.set(c.surface);
  u.uRingLine.value.set(c.inkMuted);
  u.uAccent.value.set(c.accent);
  u.uRimColor.value.set(c.brass);
  u.uStoneBase.value.set(c.sceneStoneBase);
  u.uStoneLight.value.set(c.sceneStoneLight);
  u.uSky.value.set(c.sceneSky);
  u.uGround.value.set(c.sceneGround);
  u.uGhostColor.value.set(c.lineStrong);
  u.uShadowColor.value.set(c.sceneShadow.rgb);
  u.uShadowAlpha.value = c.sceneShadow.alpha;
}

export function disposeMaterials(m: StageMaterials): void {
  m.stone.dispose();
  m.ghost.dispose();
  m.shadow.dispose();
}

/** Birim yön kafesi: şekil vertex shader'da kurulur; Stone ve Ghost aynı örneği paylaşır (§5.3.1). */
export function createStoneGeometry(tier: SegmentTier): SphereGeometry {
  const [w, h] = SEGMENTS[tier];
  return new SphereGeometry(1, w, h);
}

/** Gölge quad'ı: PlaneGeometry(1, 1) (§5.4.5) */
export function createShadowGeometry(): PlaneGeometry {
  return new PlaneGeometry(1, 1);
}
