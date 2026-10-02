// src/stage/gl/Scene.tsx — <Canvas>, KOD paneli ve ilk kare (§4 KOD, §5.2, §5.12.4, §5.17). Stage chunk'ının girişi.
// frameloop="demand" + LoopPolicy, ContextGuard, Perf (PerformanceMonitor + boşluk koruması), glif atlası (çalışma
// zamanında, sitenin Martian Mono'su), FirstFrame (compileAsync → ilk kare → 2 rAF → 'ready'). Taş, posterler ve lab
// modu KOD ile kaldırıldı (2026-10-02).
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  type WebGLRenderer,
} from 'three';
import type { Persona } from '@/experience/profile';
import { buildAtlas } from '../kod-atlas';
import { initialQuality, stepDown, stepUp, TIERS, type QualityState } from '../quality';
import { trackInput } from '../pointer';
import { live, stageStore, useStage } from '../store';
import { KodRig } from './KodRig';

const mark = (name: string) => performance.mark(name);

export interface SiteSceneProps {
  mode: 'site';
  persona: Persona;
}

/** R3F'in bekleyen kare sayacı (internal.frames) sıfırlanır; modül fonksiyonu (React Compiler immutability kuralı) */
function resetPendingFrames(internal: { frames: number }): void {
  internal.frames = 0;
}

/** §5.9.9: loop 'never' ya da sekme gizli → never; aksi hâlde demand (çıkışta önce demand, sonra invalidate). */
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
    if (mode === 'never') resetPendingFrames(internal);
    else invalidate();
  }, [loop, hidden, setFrameloop, invalidate, internal]);
  return null;
}

/** §5.17: ilk kayıpta statik paneller aynı karede geri gelir; geri yüklemede yeni bağlam (canvasKey++). */
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

/** §5.12.4: compileAsync → ilk kare (panel kaydırma durumuna atlar) → 2 rAF → 'ready'. */
function FirstFrame() {
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
            stageStore.getState().setPhase('ready');
            mark('os:stage-ready');
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
  }, [gl, scene, camera, invalidate]);
  return null;
}

function onSiteCreated({ gl }: { gl: WebGLRenderer }): void {
  // Shader derleme hatası → static (§5.12.4, §5.17)
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

/** Glif atlası dokusu: renk dönüşümü yok (rol renkleri doğrudan), mipmap'li (küçük panelde keskin) */
function atlasTexture(cv: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(cv);
  tex.colorSpace = NoColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  return tex;
}

function SiteScene({ persona }: SiteSceneProps) {
  const tier = useStage((s) => s.tier);
  const t = tier === 'static' ? 'low' : tier;
  const spec = TIERS[t];
  const debug = useStage((s) => s.debug);
  const stored = useStage((s) => s.quality);
  const [base] = useState(() => stored ?? initialQuality(t));
  const quality = stored ?? base;
  const [atlas, setAtlas] = useState<CanvasTexture | null>(null);

  useEffect(() => trackInput(), []); // işaretçi paralaksı ve idle girdisi yalnız canlı sahnede
  useEffect(() => {
    let alive = true;
    let tex: CanvasTexture | null = null;
    buildAtlas()
      .then((cv) => {
        if (!alive) return;
        tex = atlasTexture(cv);
        setAtlas(tex);
      })
      .catch(() => {
        if (alive) stageStore.getState().toFallback('error');
      });
    return () => {
      alive = false;
      tex?.dispose();
    };
  }, []);

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
        depth: false,
        preserveDrawingBuffer: debug,
      }}
      camera={{ fov: 30, near: 0.1, far: 50, position: [0, 0, 10] }}
      resize={{ scroll: false, debounce: { resize: 150, scroll: 0 } }}
      onCreated={onSiteCreated}
    >
      <LoopPolicy />
      <ContextGuard />
      <Perf base={base} />
      {atlas ? (
        <>
          <KodRig atlas={atlas} persona={persona} />
          <FirstFrame />
        </>
      ) : null}
    </Canvas>
  );
}

export default function Scene(props: SiteSceneProps) {
  return <SiteScene {...props} />;
}
