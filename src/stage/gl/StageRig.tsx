// src/stage/gl/StageRig.tsx — kamera, damping, kompozisyon, anchor → ekran ve uniform güncellemesi (§5.7, §5.9.6,
// §5.9.8). three.js ışık nesnesi YOK. Lab modu (§5.16.2) anahtarı merkezde çizer; site modu her karede damped
// `rendered ← stageTarget` (maath smoothTime) + idle drift + işaretçi ışığı + tarama ofsetleri, setViewOffset ve analitik
// ölçekle Taş'ı ölçülmüş DOM çapasına oturtur. useFrame içinde bellek ayırma YASAK (§5.7.6).
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import { easing } from 'maath';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  PerspectiveCamera,
  Quaternion,
  Vector3,
  type Camera,
  type Group,
  type Object3D,
} from 'three';
import type { ThemeName } from '@/design/tokens';
import { INTENSITY, type Intensity } from '@/experience/profile';
import {
  arcFraction,
  capRadius,
  footprintRadius,
  sectorOffsetDeg,
  wrap180,
} from '@/lib/section-geometry';
import { anchorScreen, stoneScale, type AnchorRect } from '../anchor-screen';
import { cameraPosition, type Keyframe } from '../keyframes';
import { TIERS } from '../quality';
import {
  ANCHOR_VIRTUAL,
  live,
  rendered as renderedTarget,
  stageStore,
  stageTarget,
  useStage,
  type StageTarget,
} from '../store';
import { applyTheme, type StageUniforms } from './materials';

/** Posterde Taş çapı / canvas kenarı (§5.16.2); ScenePoster CSS'i aynı oranı kullanır (§5.16.4). */
export const POSTER_STONE_FRAC = 0.8;
const DEG = Math.PI / 180;
const NO_BAND_RING = -10;

// Kare başına bellek ayırma YASAK (§5.7.6): yardımcı nesneler modül düzeyinde bir kez oluşturulur.
const lightWorld = new Vector3();
const invQ = new Quaternion();
const tmpQ = new Quaternion();

/** Lab karesinin tüm girdileri: anahtar değerleri + içerik (StageData) + tema. */
export interface LabFrame {
  keyframe: Keyframe;
  theme: ThemeName;
  rings: number;
  sectors: number; // N (3–6); 0 = liste modu
  band: readonly [number, number] | null;
  ghostAlphaMax: number; // INTENSITY[profile.intensity].ghostAlphaMax
}

export interface StoneShape {
  radii: readonly [number, number, number];
  n1: number; // XZ üssü (uShape.x)
  n2: number; // Y üssü (uShape.y)
}

/** Analitik ölçek (§5.7.5); anchors.ts'teki stoneScale ile aynı (geri uyum adı). */
export const analyticScale = stoneScale;

/** Işık yönü (dünya) → object space; uCamObj, uUpObj, kesit (§5.6.1, §5.7.6). */
function applyObjectSpace(
  camera: Camera,
  stone: Object3D,
  u: StageUniforms,
  lightAz: number,
  lightEl: number,
  cut: number,
  shape: StoneShape,
): void {
  u.uCamObj.value.copy(camera.position);
  stone.worldToLocal(u.uCamObj.value);
  invQ.copy(stone.getWorldQuaternion(tmpQ)).invert();
  const el = lightEl * DEG;
  const az = lightAz * DEG;
  lightWorld.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  u.uLightObj.value.copy(lightWorld).applyQuaternion(invQ).normalize();
  u.uUpObj.value.set(0, 1, 0).applyQuaternion(invQ).normalize();
  u.uPlane.value.w = cut;
  u.uCapRadius.value = capRadius(cut, shape.radii, shape.n2);
}

/** Lab karesini sahneye ve uniform'lara uygular (saf olmayan tek nokta; bileşen yalnız çağırır). */
export function applyLabFrame(
  camera: Camera,
  scaleGroup: Object3D,
  stone: Object3D,
  u: StageUniforms,
  frame: LabFrame,
  shape: StoneShape,
  canvas: { width: number; height: number },
): void {
  const k = frame.keyframe;

  // Kamera: hedef daima (0, 0, 0); lab'de görünüm merkezdedir (§5.7.2)
  const [x, y, z] = cameraPosition(k);
  camera.position.set(x, y, z);
  if (camera instanceof PerspectiveCamera) {
    camera.fov = k.fov;
    camera.near = 0.1;
    camera.far = 50;
    camera.clearViewOffset(); // updateProjectionMatrix'i kendisi çağırır
  }
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  // Kompozisyon: kare canvas'ta D = 0.8 · kenar
  const D = POSTER_STONE_FRAC * Math.min(canvas.width, canvas.height);
  const R0 = footprintRadius(shape.radii, shape.n1);
  scaleGroup.scale.setScalar(stoneScale(D, k.r, k.fov, R0, canvas.height));
  stone.rotation.set(k.rotX * DEG, k.rotY * DEG, 0, 'XYZ');
  scaleGroup.updateMatrixWorld(true);

  applyObjectSpace(camera, stone, u, k.lightAz, k.lightEl, k.cut, shape);

  // Track alanları (§5.5)
  u.uRingContrast.value = k.ringContrast;
  u.uSectorMix.value = k.sectorMix;
  k.fills.forEach((f, i) => {
    u.uSectorFill.value[i] = f;
  });
  u.uArcGlow.value = k.arcGlow;
  u.uRimStrength.value = k.rim;
  u.uTone.value = k.tone;
  u.uGhostAlpha.value = Math.min(k.ghost, frame.ghostAlphaMax);
  const [b0, b1] = frame.band ?? [NO_BAND_RING, NO_BAND_RING];
  u.uBand.value.set(b0, b1, k.bandVisible);

  // İçerik ve tema
  u.uRings.value = frame.rings;
  u.uSectors.value = frame.sectors;
  u.uSectorOffset.value = frame.sectors > 0 ? sectorOffsetDeg(frame.sectors) * DEG : 0;
  u.uArc.value = arcFraction(new Date()); // render tarihi; yalnız client (lab client-only)
  applyTheme(u, frame.theme);
}

/* ───────────── site modu: damping (§5.9.8) ───────────── */

type DampKey = keyof StageTarget;
/** Kamera grubu: smoothTime 0.25 s */
const CAMERA_KEYS: readonly DampKey[] = ['camR', 'camAz', 'camEl', 'camFov'];
/** Sahne grubu: smoothTime 0.21 s */
const SCENE_KEYS: readonly DampKey[] = [
  'rotYScroll',
  'rotYEvent',
  'rotX',
  'cut',
  'ringContrast',
  'sectorMix',
  'fill0',
  'fill1',
  'fill2',
  'fill3',
  'fill4',
  'fill5',
  'bandStart',
  'bandEnd',
  'bandVisible',
  'ghost',
  'arcGlow',
  'rim',
  'tone',
  'lightAz',
  'lightEl',
  'anchorMix',
];
const ANGLE_KEYS = new Set<DampKey>([
  'camAz',
  'camEl',
  'camFov',
  'rotYScroll',
  'rotYEvent',
  'rotX',
  'lightAz',
  'lightEl',
]);
const epsOf = (k: DampKey) => (k === 'camR' ? 5e-4 : ANGLE_KEYS.has(k) ? 0.01 : 1e-4);
const DAMP_KEYS = [...CAMERA_KEYS, ...SCENE_KEYS];
const EPS = Object.fromEntries(DAMP_KEYS.map((k) => [k, epsOf(k)])) as Record<DampKey, number>;
const SMOOTH_CAMERA = 0.25;
const SMOOTH_SCENE = 0.21;
const SMOOTH_POINTER = 0.32;
const SMOOTH_IDLE = 0.6;
const SMOOTH_IDLE_RETURN = 0.25;
/** Son girdiden sonra idle drift süresi: ince işaretçi 20 s, kaba 8 s (§4.6.4) */
const IDLE_FINE_MS = 20_000;
const IDLE_COARSE_MS = 8_000;

/** Kare başına okunan damped kopya (store.rendered; debug paneli okur) ve zaman tabanlı ek durum */
type Rendered = Record<DampKey, number> & { __damp?: Record<string, number> };
const rendered = renderedTarget as Rendered;
const extra: {
  idleS: number;
  idleAngle: number;
  pAz: number;
  pEl: number;
  __damp?: Record<string, number>;
} = { idleS: 0, idleAngle: 0, pAz: 0, pEl: 0 };
const rectA: AnchorRect = { cx: 0, cy: 0, D: 0 };
const rectB: AnchorRect = { cx: 0, cy: 0, D: 0 };

/** Anchor indeksi → ekran dikdörtgeni; eksikse false (sanal anchor: live.virtualAnchor). */
function rectOf(i: number, y: number, stoneRy: number, out: AnchorRect): boolean {
  if (i === ANCHOR_VIRTUAL) {
    out.cx = live.virtualAnchor.cx;
    out.cy = live.virtualAnchor.cy;
    out.D = live.virtualAnchor.D;
    return live.virtualAnchor.D > 0;
  }
  const a = live.anchors[i];
  if (!a) return false;
  anchorScreen(a, y, stoneRy, out);
  return out.D > 0;
}

interface SiteRigProps {
  uniforms: StageUniforms;
  shape: StoneShape;
  intensity: Intensity;
  children: ReactNode;
}

/** Kare başına bağlam: bileşen render'ından bağımsız, değiştirilebilir (useFrame içinde bellek ayırma yok). */
interface SiteFrameCtx {
  u: StageUniforms;
  shape: StoneShape;
  R0: number;
  stoneRy: number;
  params: (typeof INTENSITY)[Intensity];
  spec: (typeof TIERS)['high'];
  coarse: boolean;
  fine: boolean;
  from: number;
  to: number;
}

/** Mount: yalnız client'ta bilinen değerler (§5.10 açık yay, işaretçi türü) + ilk karede oturma. */
function initSiteFrame(c: SiteFrameCtx): void {
  c.coarse = window.matchMedia('(pointer: coarse)').matches;
  c.fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  c.u.uArc.value = arcFraction(new Date());
  live.snapNextFrame = true;
}

/** İçerik uniform'ları (nadir: preset/route değişimi) */
function applyContent(u: StageUniforms, rings: number, n: number): void {
  u.uRings.value = rings;
  u.uSectors.value = n;
  u.uSectorOffset.value = n > 0 ? sectorOffsetDeg(n) * DEG : 0;
  stageStore.getState().invalidate();
}

/** Tek kare: damping, idle, işaretçi ışığı, anchor → ekran, kamera, ölçek, object space, uniform'lar (§5.7, §5.9.6). */
function siteFrame(
  state: RootState,
  delta: number,
  c: SiteFrameCtx,
  scaleGroup: Group | null,
): void {
  const stone = scaleGroup?.getObjectByName('stone');
  if (!scaleGroup || !stone) return;
  live.frames++;
  const { u, params, spec } = c;
  const dt = Math.min(delta, 1 / 30);
  const t = stageTarget;
  let moving = false;

  // Anchor çifti değişince karışım sürekli kalsın: (A→B, 1) ≡ (B→C, 0) (§5.7.5)
  if (t.anchorFrom !== c.from || t.anchorTo !== c.to) {
    if (t.anchorFrom === c.to) rendered.anchorMix -= 1;
    else if (t.anchorTo === c.from) rendered.anchorMix += 1;
    else rendered.anchorMix = t.anchorMix;
    c.from = t.anchorFrom;
    c.to = t.anchorTo;
  }

  if (live.snapNextFrame) {
    // kesme / ilk kare: damped alanlar hedefe kopyalanır, maath hız durumu sıfırlanır (§5.9.8 ZORUNLU)
    for (const k of DAMP_KEYS) rendered[k] = t[k];
    rendered.__damp = {};
    live.snapNextFrame = false;
  } else {
    for (const k of CAMERA_KEYS)
      moving =
        easing.damp(rendered, k, t[k], SMOOTH_CAMERA, dt, Infinity, undefined, EPS[k]) || moving;
    for (const k of SCENE_KEYS)
      moving =
        easing.damp(rendered, k, t[k], SMOOTH_SCENE, dt, Infinity, undefined, EPS[k]) || moving;
  }

  // Idle drift (§5.9.6): home + hero + tier.idle + duraklatılmamış + tam hareket + son girdiden < 20 s / 8 s
  const st = stageStore.getState();
  const idleMs = c.coarse ? IDLE_COARSE_MS : IDLE_FINE_MS;
  const idleOn =
    st.preset === 'home' &&
    live.inHero &&
    spec.idle &&
    !st.paused &&
    document.documentElement.dataset.motion !== 'reduce' &&
    performance.now() - live.lastInput < idleMs;
  if (st.paused) extra.idleS = 0; // duraklatma drift'i hemen durdurur
  // Hız zarfı gerçek süreyle söner (≤ 1 s adım): yavaş karede kırpılmış dt, 20 s'deki duruşu 10+ kat uzatıyordu
  moving =
    easing.damp(
      extra,
      'idleS',
      idleOn ? 1 : 0,
      SMOOTH_IDLE,
      Math.min(delta, 1),
      Infinity,
      undefined,
      1e-3,
    ) || moving;
  if (live.inHero) {
    extra.idleAngle = wrap180(extra.idleAngle + params.idleDegPerSec * extra.idleS * dt);
  } else {
    moving =
      easing.damp(extra, 'idleAngle', 0, SMOOTH_IDLE_RETURN, dt, Infinity, undefined, 0.01) ||
      moving;
  }
  if (extra.idleS > 0.001) moving = true;
  live.idleAngle = extra.idleAngle;

  // İşaretçi ışığı (§5.6.2): ince işaretçi + tier.pointer; duraklatma durdurmaz (kullanıcı güdümlü)
  const pOn = c.fine && spec.pointer && live.pointer.active;
  const pAz = pOn ? params.pointerAzDeg * live.pointer.x : 0;
  const pEl = pOn ? params.pointerElDeg * live.pointer.y : 0;
  moving = easing.damp(extra, 'pAz', pAz, SMOOTH_POINTER, dt, Infinity, undefined, 0.01) || moving;
  moving = easing.damp(extra, 'pEl', pEl, SMOOTH_POINTER, dt, Infinity, undefined, 0.01) || moving;

  // Anchor → ekran (dikdörtgenler damped DEĞİL; Taş metinle birlikte kayar)
  const y = window.scrollY;
  const hasA = rectOf(t.anchorFrom, y, c.stoneRy, rectA);
  const hasB = rectOf(t.anchorTo, y, c.stoneRy, rectB);
  const m = Math.min(1, Math.max(0, rendered.anchorMix));
  let cx = 0;
  let cy = 0;
  let D = 0;
  if (hasA && hasB) {
    cx = rectA.cx + (rectB.cx - rectA.cx) * m;
    cy = rectA.cy + (rectB.cy - rectA.cy) * m;
    D = rectA.D + (rectB.D - rectA.D) * m;
  } else if (hasA || hasB) {
    const r = hasA ? rectA : rectB;
    cx = r.cx;
    cy = r.cy;
    D = r.D;
  }
  const visible = D > 0;
  const W = state.size.width;
  const H = state.size.height;

  // Kamera (§5.7.1–§5.7.2)
  const camera = state.camera;
  const az = rendered.camAz * DEG;
  const el = rendered.camEl * DEG;
  camera.position.set(
    rendered.camR * Math.cos(el) * Math.sin(az),
    rendered.camR * Math.sin(el),
    rendered.camR * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(0, 0, 0);
  if (camera instanceof PerspectiveCamera) {
    camera.fov = rendered.camFov;
    camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H); // updateProjectionMatrix'i kendisi çağırır
  }
  camera.updateMatrixWorld();

  // Kompozisyon (§5.9.6): rotY = scroll + event + idle (+ wobble/eğim M7'de)
  scaleGroup.visible = visible;
  scaleGroup.scale.setScalar(
    visible ? stoneScale(D, rendered.camR, rendered.camFov, c.R0, H) : 1e-6,
  );
  stone.rotation.set(
    rendered.rotX * DEG,
    (rendered.rotYScroll + rendered.rotYEvent + extra.idleAngle) * DEG,
    0,
    'XYZ',
  );
  scaleGroup.updateMatrixWorld(true);

  applyObjectSpace(
    camera,
    stone,
    u,
    rendered.lightAz + extra.pAz + t.sweepAz,
    rendered.lightEl + extra.pEl + t.sweepEl,
    rendered.cut,
    c.shape,
  );

  // Uniform'lar (§5.5)
  u.uRingContrast.value = rendered.ringContrast;
  u.uSectorMix.value = rendered.sectorMix;
  const fills = u.uSectorFill.value;
  fills[0] = rendered.fill0;
  fills[1] = rendered.fill1;
  fills[2] = rendered.fill2;
  fills[3] = rendered.fill3;
  fills[4] = rendered.fill4;
  fills[5] = rendered.fill5;
  u.uArcGlow.value = rendered.arcGlow;
  u.uRimStrength.value = rendered.rim;
  u.uTone.value = rendered.tone;
  u.uGhostAlpha.value = Math.min(rendered.ghost, params.ghostAlphaMax);
  u.uBand.value.set(rendered.bandStart, rendered.bandEnd, rendered.bandVisible);
  u.uSectorPreview.value.set(t.sectorPreviewIndex, t.sectorPreviewAlpha);
  u.uBandPreview.value.set(t.bandPreviewStart, t.bandPreviewEnd, t.bandPreviewAlpha);
  u.uArcPulse.value = t.arcPulse;
  u.uWave.value = t.wave;

  live.stone.cx = cx;
  live.stone.cy = cy;
  live.stone.r = D / 2;
  live.stone.visible = visible;

  if (moving) state.invalidate();
}

function SiteRig({ uniforms, shape, intensity, children }: SiteRigProps) {
  const scaleRef = useRef<Group>(null);
  const tier = useStage((s) => s.tier);
  const data = useStage((s) => s.data);
  const [ctx] = useState<SiteFrameCtx>(() => {
    const R0 = footprintRadius(shape.radii, shape.n1);
    return {
      u: uniforms,
      shape,
      R0,
      stoneRy: shape.radii[1] / R0,
      params: INTENSITY[intensity],
      spec: TIERS[tier === 'static' ? 'low' : tier],
      coarse: false,
      fine: false,
      from: stageTarget.anchorFrom,
      to: stageTarget.anchorTo,
    };
  });

  useEffect(() => initSiteFrame(ctx), [ctx]);
  useEffect(() => applyContent(ctx.u, data?.rings ?? 4, data?.sectors ?? 0), [ctx, data]);
  useFrame((state, delta) => siteFrame(state, delta, ctx, scaleRef.current));

  return (
    <group name="scale" ref={scaleRef}>
      {children}
    </group>
  );
}

/* ───────────── bileşen ───────────── */

export type StageRigProps =
  | {
      mode: 'lab';
      frame: LabFrame;
      uniforms: StageUniforms;
      shape: StoneShape;
      children: ReactNode;
    }
  | {
      mode: 'site';
      uniforms: StageUniforms;
      shape: StoneShape;
      intensity: Intensity;
      children: ReactNode;
    };

export function StageRig(props: StageRigProps) {
  if (props.mode === 'site')
    return (
      <SiteRig uniforms={props.uniforms} shape={props.shape} intensity={props.intensity}>
        {props.children}
      </SiteRig>
    );
  return (
    <LabRig frame={props.frame} uniforms={props.uniforms} shape={props.shape}>
      {props.children}
    </LabRig>
  );
}

function LabRig({
  frame,
  uniforms,
  shape,
  children,
}: {
  frame: LabFrame;
  uniforms: StageUniforms;
  shape: StoneShape;
  children: ReactNode;
}) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const scaleRef = useRef<Group>(null);

  useLayoutEffect(() => {
    const scaleGroup = scaleRef.current;
    const stone = scaleGroup?.getObjectByName('stone');
    if (!scaleGroup || !stone) return;
    applyLabFrame(camera, scaleGroup, stone, uniforms, frame, shape, { width, height });
  }, [camera, width, height, frame, uniforms, shape]);

  return (
    <group name="scale" ref={scaleRef}>
      {children}
    </group>
  );
}
