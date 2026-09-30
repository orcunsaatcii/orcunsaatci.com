// src/stage/gl/Scene.tsx — <Canvas>, sahne grafiği ve ilk kare (§5.2, §5.12.4).
// M1: yalnız mode="lab" (§5.16.2): frameloop="never", dpr 1, high kalite, preserveDrawingBuffer; compileAsync
// sonrası tek render, ardından window.__stageReady ve #lab-canvas[data-ready]. Site modu (boot, LoopPolicy,
// ContextGuard, PerformanceMonitor, PrecompileVariants) M5'tedir.
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import type { WebGLRenderer } from 'three';
import type { ThemeName } from '@/design/tokens';
import { INTENSITY, PROFILES } from '@/experience/profile';
import { cameraPosition, contentCtx, keyframes, type KeyframeKey } from '../keyframes';
import { TIERS } from '../quality';
import type { StageData } from '../store';
import { Ghost } from './Ghost';
import {
  createMaterials,
  createShadowGeometry,
  createStoneGeometry,
  createUniforms,
  disposeMaterials,
  stoneProfileOf,
} from './materials';
import { Shadow } from './Shadow';
import { StageRig, type LabFrame, type StoneShape } from './StageRig';
import { Stone } from './Stone';

export const LAB_CANVAS_ID = 'lab-canvas';

/** Lab daima high kalitede çizer (§5.16.2). */
const LAB_TIER = TIERS.high;
/** Etkin persona (§4.17.1). M3'te site.yaml'daki persona ile değiştirilir. */
const PROFILE = PROFILES.engineer;
const SHAPE: StoneShape = {
  radii: PROFILE.stone.radii,
  n1: PROFILE.stone.shape[0],
  n2: PROFILE.stone.shape[1],
};

type LabWindow = Window & { __stageReady?: boolean; __stageError?: string };

export interface LabSceneProps {
  mode: 'lab';
  keyframe: KeyframeKey;
  theme: ThemeName;
  size: number;
  data: StageData;
}

/** Anahtar + içerik → lab karesi. Bant: K3/D1'de öne çıkan proje 1, K4/D3'te ilk kayıt (event'in ilk indeksi). */
export function labFrame(key: KeyframeKey, theme: ThemeName, data: StageData): LabFrame {
  const ctx = contentCtx(
    data.sectors,
    data.projects.map((p) => p.area),
  );
  const project = key === 'work-specimen' || key === 'folio';
  const entry = key === 'journey-core' || key === 'cv-core';
  const band = project
    ? (data.projects[0]?.band ?? null)
    : entry
      ? (data.entries[0]?.band ?? null)
      : null;
  return {
    keyframe: keyframes(ctx)[key],
    theme,
    rings: data.rings,
    sectors: data.sectors,
    band,
    ghostAlphaMax: INTENSITY[PROFILE.intensity].ghostAlphaMax,
  };
}

function reportShaderError(message: string): void {
  (window as LabWindow).__stageError = message;
  document.getElementById(LAB_CANVAS_ID)?.setAttribute('data-error', '');
  console.error(`lab: ${message}`);
}

function onCreated({ gl }: { gl: WebGLRenderer }): void {
  // Varsayılan raporlamanın yerine geçer: hata konsola ve #lab-canvas[data-error]'a düşer (§5.12.4, V-15)
  gl.debug.onShaderError = (ctx, program, vs, fs) => {
    const logs = [
      ctx.getProgramInfoLog(program),
      ctx.getShaderInfoLog(vs),
      ctx.getShaderInfoLog(fs),
    ];
    reportShaderError(`shader derleme hatası: ${logs.filter(Boolean).join(' | ')}`);
  };
}

/** compileAsync → tek render → 2 rAF → hazır. Boyut veya kare değişirse yeniden çizer. */
function LabFrameRenderer({ frame }: { frame: LabFrame }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useEffect(() => {
    let alive = true;
    const host = document.getElementById(LAB_CANVAS_ID);
    host?.removeAttribute('data-ready');
    (window as LabWindow).__stageReady = false;
    gl.compileAsync(scene, camera)
      .then(() => {
        if (!alive) return;
        gl.render(scene, camera);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!alive) return;
            (window as LabWindow).__stageReady = true;
            host?.setAttribute('data-ready', '');
          }),
        );
      })
      .catch((err: unknown) => {
        if (alive) reportShaderError(`compileAsync başarısız: ${String(err)}`);
      });
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, width, height, frame]);

  return null;
}

export default function Scene({ keyframe, theme, data }: LabSceneProps) {
  const [gpu] = useState(() => {
    const uniforms = createUniforms(stoneProfileOf(PROFILE));
    return {
      uniforms,
      materials: createMaterials(uniforms, {
        octaves: LAB_TIER.octaves,
        pattern: PROFILE.cap.pattern,
        surface: PROFILE.stone.surface,
        waveWidthPx: INTENSITY[PROFILE.intensity].waveWidthPx,
      }),
      stoneGeometry: createStoneGeometry(LAB_TIER.segments),
      shadowGeometry: createShadowGeometry(),
    };
  });
  useEffect(
    () => () => {
      disposeMaterials(gpu.materials);
      gpu.stoneGeometry.dispose();
      gpu.shadowGeometry.dispose();
    },
    [gpu],
  );

  const frame = useMemo(() => labFrame(keyframe, theme, data), [keyframe, theme, data]);
  const k = frame.keyframe;

  return (
    <Canvas
      className="stage-canvas"
      flat
      frameloop="never"
      dpr={1}
      gl={{
        antialias: LAB_TIER.antialias,
        alpha: true,
        powerPreference: 'default',
        stencil: false,
        depth: true,
        preserveDrawingBuffer: true,
      }}
      camera={{ fov: k.fov, near: 0.1, far: 50, position: cameraPosition(k) }}
      resize={{ scroll: false, debounce: { resize: 150, scroll: 0 } }}
      onCreated={onCreated}
    >
      <StageRig mode="lab" frame={frame} uniforms={gpu.uniforms} shape={SHAPE}>
        <group name="stone">
          <Stone geometry={gpu.stoneGeometry} material={gpu.materials.stone} />
          {LAB_TIER.ghost && <Ghost geometry={gpu.stoneGeometry} material={gpu.materials.ghost} />}
        </group>
        <Shadow geometry={gpu.shadowGeometry} material={gpu.materials.shadow} radii={SHAPE.radii} />
      </StageRig>
      <LabFrameRenderer frame={frame} />
    </Canvas>
  );
}
