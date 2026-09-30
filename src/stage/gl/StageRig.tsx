// src/stage/gl/StageRig.tsx — kamera, kompozisyon ve uniform güncellemesi (§5.7). three.js ışık nesnesi YOK.
// M1: yalnız lab modu (§5.16.2): kamera anahtarın r/az/el/fov değerlerinden, clearViewOffset() (merkezde),
// D = POSTER_STONE_FRAC × size; idle, işaretçi ve tarama ofsetleri 0. Damping, anchor'lar ve site modu M5'tedir.
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  PerspectiveCamera,
  Quaternion,
  Vector3,
  type Camera,
  type Group,
  type Object3D,
} from 'three';
import type { ThemeName } from '@/design/tokens';
import { arcFraction, capRadius, footprintRadius, sectorOffsetDeg } from '@/lib/section-geometry';
import { cameraPosition, type Keyframe } from '../keyframes';
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

/**
 * Analitik ölçek: scale = D · (2 · r · tan(fov/2)) / (2 · R0 · H) (§5.7.5).
 * R0 = footprintRadius(radii, n1): ayak izinin çevrel yarıçapı (SPEC-SAPMA §5.7.5, section-geometry.ts).
 */
export function analyticScale(D: number, r: number, fovDeg: number, R0: number, H: number): number {
  return (D * 2 * r * Math.tan((fovDeg * DEG) / 2)) / (2 * R0 * H);
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
  scaleGroup.scale.setScalar(analyticScale(D, k.r, k.fov, R0, canvas.height));
  stone.rotation.set(k.rotX * DEG, k.rotY * DEG, 0, 'XYZ');
  scaleGroup.updateMatrixWorld(true);

  // Object-space dönüşümleri (§5.7.6)
  u.uCamObj.value.copy(camera.position);
  stone.worldToLocal(u.uCamObj.value);
  invQ.copy(stone.getWorldQuaternion(tmpQ)).invert();
  const el = k.lightEl * DEG;
  const az = k.lightAz * DEG;
  lightWorld.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  u.uLightObj.value.copy(lightWorld).applyQuaternion(invQ).normalize();
  u.uUpObj.value.set(0, 1, 0).applyQuaternion(invQ).normalize();
  u.uPlane.value.w = k.cut;
  u.uCapRadius.value = capRadius(k.cut, shape.radii, shape.n2);

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

export interface StageRigProps {
  mode: 'lab';
  frame: LabFrame;
  uniforms: StageUniforms;
  shape: StoneShape;
  children: ReactNode;
}

export function StageRig({ frame, uniforms, shape, children }: StageRigProps) {
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
