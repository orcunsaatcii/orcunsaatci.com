// src/stage/gl/Scene.tsx — <Canvas>, sahne grafiği ve ilk kare (§5.2, §5.12.4, §5.17). Stage chunk'ının girişi.
// site modu: frameloop="demand" + LoopPolicy, ContextGuard, Perf (PerformanceMonitor + boşluk koruması), tema bağlama,
// FirstFrame (compileAsync → ilk kare → 2 rAF → 'ready') ve step-down varyantlarının ön derlemesi (§5.4.6).
// lab modu (§5.16.2): frameloop="never", dpr 1, high kalite, preserveDrawingBuffer; tek render → #lab-canvas[data-ready].
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Mesh, type WebGLRenderer } from 'three';
import { whenMotion } from '@/components/motion/MotionRoot';
import type { ThemeName } from '@/design/tokens';
import { INTENSITY, PROFILES, type Persona } from '@/experience/profile';
import { STORAGE_KEYS } from '@/lib/head-script';
import { cameraPosition, contentCtx, keyframes, type KeyframeKey } from '../keyframes';
import { initialQuality, stepDown, stepUp, TIERS, type QualityState } from '../quality';
import { trackInput } from '../pointer';
import { live, stageStore, stageTarget, useStage, type StageData } from '../store';
import { Ghost } from './Ghost';
import {
  applyTheme,
  createMaterials,
  createShadowGeometry,
  createStoneGeometry,
  createUniforms,
  disposeMaterials,
  stoneProfileOf,
  type StageMaterials,
  type StageUniforms,
} from './materials';
import { Shadow } from './Shadow';
import { StageRig, type LabFrame, type StoneShape } from './StageRig';
import { Stone } from './Stone';

export const LAB_CANVAS_ID = 'lab-canvas';

/** Lab daima high kalitede çizer (§5.16.2). */
const LAB_TIER = TIERS.high;

type StageWindow = Window & { __stageReady?: boolean; __stageError?: string };

const mark = (name: string) => performance.mark(name);

const shapeOf = (persona: Persona): StoneShape => {
  const p = PROFILES[persona];
  return { radii: p.stone.radii, n1: p.stone.shape[0], n2: p.stone.shape[1] };
};

/* ───────────── lab ───────────── */

export interface LabSceneProps {
  mode: 'lab';
  keyframe: KeyframeKey;
  theme: ThemeName;
  size: number;
  data: StageData;
  persona: Persona;
}

/** Anahtar + içerik → lab karesi. Bant: K3/D1'de öne çıkan proje 1, K4/D3'te ilk kayıt (event'in ilk indeksi). */
export function labFrame(
  key: KeyframeKey,
  theme: ThemeName,
  data: StageData,
  persona: Persona = 'engineer',
): LabFrame {
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
    ghostAlphaMax: INTENSITY[PROFILES[persona].intensity].ghostAlphaMax,
  };
}

function reportLabError(message: string): void {
  (window as StageWindow).__stageError = message;
  document.getElementById(LAB_CANVAS_ID)?.setAttribute('data-error', '');
  console.error(`lab: ${message}`);
}

function onLabCreated({ gl }: { gl: WebGLRenderer }): void {
  // Varsayılan raporlamanın yerine geçer: hata konsola ve #lab-canvas[data-error]'a düşer (§5.12.4, V-15)
  gl.debug.onShaderError = (ctx, program, vs, fs) => {
    const logs = [
      ctx.getProgramInfoLog(program),
      ctx.getShaderInfoLog(vs),
      ctx.getShaderInfoLog(fs),
    ];
    reportLabError(`shader derleme hatası: ${logs.filter(Boolean).join(' | ')}`);
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
    (window as StageWindow).__stageReady = false;
    gl.compileAsync(scene, camera)
      .then(() => {
        if (!alive) return;
        gl.render(scene, camera);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!alive) return;
            (window as StageWindow).__stageReady = true;
            host?.setAttribute('data-ready', '');
          }),
        );
      })
      .catch((err: unknown) => {
        if (alive) reportLabError(`compileAsync başarısız: ${String(err)}`);
      });
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, width, height, frame]);

  return null;
}

function LabScene({ keyframe, theme, data, persona }: LabSceneProps) {
  const profile = PROFILES[persona];
  const shape = useMemo(() => shapeOf(persona), [persona]);
  const [gpu] = useState(() => {
    const uniforms = createUniforms(stoneProfileOf(profile));
    return {
      uniforms,
      materials: createMaterials(uniforms, {
        octaves: LAB_TIER.octaves,
        pattern: profile.cap.pattern,
        surface: profile.stone.surface,
        waveWidthPx: INTENSITY[profile.intensity].waveWidthPx,
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

  const frame = useMemo(
    () => labFrame(keyframe, theme, data, persona),
    [keyframe, theme, data, persona],
  );
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
      onCreated={onLabCreated}
    >
      <StageRig mode="lab" frame={frame} uniforms={gpu.uniforms} shape={shape}>
        <group name="stone">
          <Stone geometry={gpu.stoneGeometry} material={gpu.materials.stone} />
          {LAB_TIER.ghost && <Ghost geometry={gpu.stoneGeometry} material={gpu.materials.ghost} />}
        </group>
        <Shadow geometry={gpu.shadowGeometry} material={gpu.materials.shadow} radii={shape.radii} />
      </StageRig>
      <LabFrameRenderer frame={frame} />
    </Canvas>
  );
}

/* ───────────── site ───────────── */

export interface SiteSceneProps {
  mode: 'site';
  persona: Persona;
}

/** §5.9.9: loop 'never' ya da sekme gizli → never; aksi hâlde demand (çıkışta önce demand, sonra invalidate). */
/** R3F'in bekleyen kare sayacı (internal.frames) sıfırlanır; modül fonksiyonu (React Compiler immutability kuralı) */
function resetPendingFrames(internal: { frames: number }): void {
  internal.frames = 0;
}

function LoopPolicy() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);
  const internal = useThree((s) => s.internal);
  const loop = useStage((s) => s.loop);
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  useEffect(() => {
    const mode = loop === 'never' || hidden ? 'never' : 'demand';
    setFrameloop(mode);
    // R3F döngüsü bekleyen kareleri frameloop'tan bağımsız çizer (frames > 0): görünmez/gizli sahnede son kare de çizilmez
    if (mode === 'never') resetPendingFrames(internal);
    else invalidate();
  }, [loop, hidden, setFrameloop, invalidate, internal]);
  return null;
}

/** §5.17: ilk kayıpta posterler aynı karede geri gelir; geri yüklemede yeni bağlam (canvasKey++). */
function ContextGuard() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      stageStore.getState().onContextLost();
    };
    const restored = () => stageStore.getState().onContextRestored();
    el.addEventListener('webglcontextlost', lost);
    el.addEventListener('webglcontextrestored', restored);
    return () => {
      el.removeEventListener('webglcontextlost', lost);
      el.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl]);
  return null;
}

/* PerformanceMonitor (§5.11.4): boşluk koruması, 3 yön değişiminde static, merdiven adımları */
const perf = {
  lastGapAt: 0,
  lastInclineAt: 0,
  lastDir: null as 'up' | 'down' | null,
  reversals: 0,
};
const GAP_MS = 100;
const GAP_GRACE_MS = 3500;
const INCLINE_EVERY_MS = 10_000;

function onPerf(dir: 'up' | 'down', base: QualityState) {
  const now = performance.now();
  if (now - perf.lastGapAt < GAP_GRACE_MS) return;
  if (dir === 'up' && now - perf.lastInclineAt < INCLINE_EVERY_MS) return;
  if (perf.lastDir && perf.lastDir !== dir) perf.reversals++;
  perf.lastDir = dir;
  const s = stageStore.getState();
  if (perf.reversals >= 3) return s.toFallback('perf');
  if (!s.quality) return;
  const next = dir === 'down' ? stepDown(s.quality) : stepUp(s.quality, base);
  if (!next) {
    if (dir === 'down') s.toFallback('perf');
    return;
  }
  if (dir === 'up') perf.lastInclineAt = now;
  s.setQuality(next);
}

function Perf({ base }: { base: QualityState }) {
  const [epoch, setEpoch] = useState(0);
  const last = useRef(0);
  useFrame(() => {
    const now = performance.now();
    if (last.current !== 0 && now - last.current > GAP_MS) {
      perf.lastGapAt = now;
      setEpoch((e) => e + 1); // örnekler sıfırlanır: demand modunda boşta geçen süre düşük FPS sayılmasın
    }
    last.current = now;
  });
  return (
    <PerformanceMonitor
      key={epoch}
      ms={250}
      iterations={10}
      threshold={0.75}
      onDecline={() => onPerf('down', base)}
      onIncline={() => onPerf('up', base)}
    />
  );
}

/** §5.6.6: <html data-theme> değişince renk uniform'ları yeniden uygulanır (getComputedStyle YASAK). */
function ThemeBinding({ uniforms, persona }: { uniforms: StageUniforms; persona: Persona }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const palette = PROFILES[persona].palette;
    const apply = () => {
      applyTheme(
        uniforms,
        document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
        palette,
      );
      invalidate();
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [uniforms, persona, invalidate]);
  return null;
}

/** §5.6.5: ilk 'ready'de koşullar sağlanırsa oturumda bir kez ışık taraması. */
async function maybeLightSweep(persona: Persona): Promise<void> {
  const st = stageStore.getState();
  if (st.preset !== 'home' || st.paused) return;
  if (document.documentElement.dataset.motion === 'reduce') return;
  if (window.scrollY >= 0.2 * window.innerHeight) return;
  try {
    if (window.sessionStorage.getItem(STORAGE_KEYS.sweep) === '1') return;
  } catch {
    // depolama kapalı: yine oynat (D-38)
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEYS.sweep, '1');
  } catch {
    // yazılamazsa sessiz geç
  }
  const { gsap } = await whenMotion();
  const from = INTENSITY[PROFILES[persona].intensity].sweepFromAzDeg;
  stageTarget.sweepAz = from + 60; // K0 ışığı track'te kalır; ofset (from + 60) → 0
  stageTarget.sweepEl = -18; // 20° → 38°
  gsap.to(stageTarget, {
    sweepAz: 0,
    sweepEl: 0,
    duration: 1.2,
    ease: 'expo.out',
    onUpdate: () => stageStore.getState().invalidate(),
  });
}

/** §5.12.4: compileAsync → ilk kare (Taş kaydırma durumuna atlar) → 2 rAF → 'ready'; ardından varyant ön derlemesi. */
function FirstFrame({ variants, persona }: { variants: StageMaterials | null; persona: Persona }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let alive = true;
    stageStore.setState({ invalidate });
    live.snapNextFrame = true;
    gl.compileAsync(scene, camera)
      .then(() => {
        if (!alive) return;
        mark('os:stage-compiled');
        invalidate();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!alive) return;
            const first = stageStore.getState().phase !== 'ready';
            stageStore.getState().setPhase('ready');
            mark('os:stage-ready');
            if (first) void maybeLightSweep(persona);
            if (variants) {
              // görünmez: step-down varyantları (oktav 1) programlarını önceden derler (§5.2, §5.4.6)
              const group = new Group();
              group.add(new Mesh(undefined, variants.stone), new Mesh(undefined, variants.ghost));
              void gl.compileAsync(group, camera, scene).catch(() => {});
            }
          }),
        );
      })
      .catch(() => {
        if (alive) stageStore.getState().toFallback('error');
      });
    return () => {
      alive = false;
      stageStore.setState({ invalidate: () => {} });
      invalidate();
    };
  }, [gl, scene, camera, invalidate, variants, persona]);
  return null;
}

function onSiteCreated({ gl }: { gl: WebGLRenderer }): void {
  // Shader derleme hatası → static (§5.12.4, §5.17; V-15: r186'da gl.debug.onShaderError var)
  gl.debug.onShaderError = (ctx, program, vs, fs) => {
    const logs = [
      ctx.getProgramInfoLog(program),
      ctx.getShaderInfoLog(vs),
      ctx.getShaderInfoLog(fs),
    ];
    console.error(`stage: shader derleme hatası: ${logs.filter(Boolean).join(' | ')}`);
    stageStore.getState().toFallback('error');
  };
}

function SiteScene({ persona }: SiteSceneProps) {
  const profile = PROFILES[persona];
  const shape = useMemo(() => shapeOf(persona), [persona]);
  const tier = useStage((s) => s.tier);
  const t = tier === 'static' ? 'low' : tier;
  const spec = TIERS[t];
  const debug = useStage((s) => s.debug);
  const stored = useStage((s) => s.quality);
  const [base] = useState(() => stored ?? initialQuality(t));
  const quality = stored ?? base;

  // Uniform'lar ve malzemeler bir kez; high kademede oktav 1 varyantı ön derlenir (step-down, §5.4.6)
  const [gpu] = useState(() => {
    const uniforms = createUniforms(stoneProfileOf(profile));
    const opts = {
      pattern: profile.cap.pattern,
      surface: profile.stone.surface,
      waveWidthPx: INTENSITY[profile.intensity].waveWidthPx,
    };
    const primary = createMaterials(uniforms, { ...opts, octaves: spec.octaves });
    const lowOctave =
      spec.octaves === 2 ? createMaterials(uniforms, { ...opts, octaves: 1 }) : null;
    return { uniforms, primary, lowOctave, shadowGeometry: createShadowGeometry() };
  });
  const stoneGeometry = useMemo(() => createStoneGeometry(quality.segments), [quality.segments]);
  useEffect(() => () => stoneGeometry.dispose(), [stoneGeometry]);
  useEffect(() => trackInput(), []); // işaretçi ışığı ve idle girdisi yalnız canlı sahnede (§4.6.4, §5.6.2)
  useEffect(
    () => () => {
      // R3F Canvas unmount'ta renderer'ı dispose eder; elle kurulanlar burada (§5.17)
      disposeMaterials(gpu.primary);
      if (gpu.lowOctave) disposeMaterials(gpu.lowOctave);
      gpu.shadowGeometry.dispose();
    },
    [gpu],
  );
  const set = quality.octaves === 1 && gpu.lowOctave ? gpu.lowOctave : gpu.primary;

  return (
    <Canvas
      className="stage-canvas"
      flat
      frameloop="demand"
      dpr={quality.dpr}
      gl={{
        antialias: spec.antialias,
        alpha: true,
        powerPreference: 'default',
        stencil: false,
        depth: true,
        preserveDrawingBuffer: debug,
      }}
      camera={{ fov: 30, near: 0.1, far: 50, position: [-2.15, 1.08, 4.61] }}
      resize={{ scroll: false, debounce: { resize: 150, scroll: 0 } }}
      onCreated={onSiteCreated}
    >
      <LoopPolicy />
      <ContextGuard />
      <Perf base={base} />
      <ThemeBinding uniforms={gpu.uniforms} persona={persona} />
      <StageRig mode="site" uniforms={gpu.uniforms} shape={shape} intensity={profile.intensity}>
        <group name="stone">
          <Stone geometry={stoneGeometry} material={set.stone} />
          {quality.ghost && <Ghost geometry={stoneGeometry} material={set.ghost} />}
        </group>
        <Shadow geometry={gpu.shadowGeometry} material={gpu.primary.shadow} radii={shape.radii} />
      </StageRig>
      <FirstFrame variants={gpu.lowOctave} persona={persona} />
    </Canvas>
  );
}

export default function Scene(props: LabSceneProps | SiteSceneProps) {
  return props.mode === 'lab' ? <LabScene {...props} /> : <SiteScene {...props} />;
}
