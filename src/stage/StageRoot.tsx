'use client';
// src/stage/StageRoot.tsx — kalıcı sahne katmanı #scene-layer, lazy boot, kademe, hata sınırı (§5.12.1, §5.12.3) ve
// LabStage (§5.16.2). İki kök layout'ta bir kez mount olur, client navigasyonunda unmount olmaz (D-18). /lab/ altında ve
// preset 'none' iken boot etmez (K-DEEP-2); gizli sekmede bekler (§9.2.4 kural 5). Stage chunk (three + R3F) yalnız
// yoklama tier ≠ static döndükten sonra istenir; motion runtime'ı da beklenir (sıra: motion → yoklama → stage).
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Component, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useMotionPref, whenMotion } from '@/components/motion/MotionRoot';
import type { ThemeName } from '@/design/tokens';
import type { Persona } from '@/experience/profile';
import { onIdle, STAGE_IDLE } from '@/lib/on-idle';
import { KEYFRAME_KEYS, type KeyframeKey } from './keyframes';
import { stageStore, useStage, type StageData } from './store';

// ssr:false yalnızca Client Component içinde geçerlidir; chunk ilk render'da istenir.
const Scene = dynamic(() => import('./gl/Scene'), { ssr: false, loading: () => null });
/** Stage yükleme zaman aşımı (§5.9.1, §5.12.3); boot gecikme sabitlerinin tek istisnası (§9.2.3) */
export const BOOT_TIMEOUT_MS = 10_000;

const mark = (name: string, detail?: unknown) => {
  try {
    performance.mark(name, detail === undefined ? undefined : { detail });
  } catch {
    // eski tarayıcı: detail desteklenmez
    performance.mark(name);
  }
};

/** Sekme gizliyse görünür olana kadar bekler (arka plan sekmesinde WebGL bağlamı kurulmaz). */
const whenVisible = () =>
  document.visibilityState !== 'hidden'
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        const on = () => {
          if (document.visibilityState === 'hidden') return;
          document.removeEventListener('visibilitychange', on);
          resolve();
        };
        document.addEventListener('visibilitychange', on);
      });

export function StageRoot({ persona }: { persona: Persona }) {
  const phase = useStage((s) => s.phase);
  const tier = useStage((s) => s.tier);
  const canvasKey = useStage((s) => s.canvasKey);
  const contextLost = useStage((s) => s.contextLost);
  const preset = useStage((s) => s.preset);
  const motion = useMotionPref(); // html[data-motion] + 'os-motion-change'
  const lab = usePathname().startsWith('/lab/'); // lab kendi canvas'ını kurar (§5.16)
  const bootable = preset !== 'none'; // D-19, §4.13.1: 'none' preset'te yoklama ve boot yok

  useEffect(() => {
    if (lab || !bootable) return; // ilk görünür preset'e kadar WebGL bağlamı açılmaz (K-DEEP-2)
    const st = stageStore.getState();
    if (motion === 'reduce') {
      // canvas unmount; posterler ve figürler geri gelir (§5.14.7). Önceki kalıcı fallback nedeni (context-loss, perf,
      // error, probe) ezilmez: aksi hâlde azalt → tam geçişi oturum boyu static kuralını delip yeniden boot ederdi.
      if (st.phase !== 'fallback') st.toFallback('reduced-motion');
      return;
    }
    if (st.phase === 'fallback' && st.tierReason === 'reduced-motion') st.setPhase('poster');
    if (stageStore.getState().phase !== 'poster') return; // client navigasyonu: zaten boot edildi
    let cancelled = false;
    const cancel = onIdle(() => {
      void (async () => {
        await whenVisible();
        if (cancelled) return;
        stageStore.getState().setPhase('probing');
        mark('os:stage-probe');
        // yoklama ve kalite tablosu yalnız boot'ta gerekir: ilk pakete girmez (PB-1)
        const [{ probeCapabilities }, { initialQuality }] = await Promise.all([
          import('./capabilities'),
          import('./quality'),
        ]);
        if (cancelled) return;
        const { tier: t, signals } = await probeCapabilities();
        if (cancelled) return;
        mark('os:stage-tier', { tier: t });
        const reason = signals.query ? 'query' : 'probe';
        if (t === 'static') {
          stageStore.setState({ signals });
          stageStore.getState().toFallback(reason);
          return;
        }
        let timer = 0;
        try {
          mark('os:stage-import');
          await Promise.race([
            Promise.all([import('./gl/Scene'), whenMotion()]),
            new Promise((_, reject) => {
              timer = window.setTimeout(reject, BOOT_TIMEOUT_MS);
            }),
          ]);
        } catch {
          if (!cancelled) stageStore.getState().toFallback('error');
          return;
        } finally {
          window.clearTimeout(timer);
        }
        if (cancelled) return;
        stageStore.setState({ quality: initialQuality(t) });
        stageStore.getState().startLoading(t, signals, reason);
      })();
    }, STAGE_IDLE); // §9.2.3, §8.5.2 kural 4
    return () => {
      cancelled = true;
      cancel();
    };
  }, [motion, lab, bootable]);

  useEffect(() => {
    // loading'de takılma koruması
    if (phase !== 'loading') return;
    const t = window.setTimeout(() => stageStore.getState().toFallback('timeout'), BOOT_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [phase, canvasKey]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('debug'))
      void import('./debug').then((m) => m.mountDebug(persona));
  }, [persona]);

  useEffect(() => {
    // preset 'none' (gizlilik, 404, M7 öncesi derin sayfalar): sahne görünmez ve kare çizmez (§5.9.10)
    if (bootable) return;
    document.getElementById('scene-layer')?.style.setProperty('--scene-opacity', '0');
    stageStore.getState().setLoop('never');
  }, [bootable]);

  const mountCanvas =
    !lab &&
    motion === 'full' &&
    tier !== 'static' &&
    (phase === 'loading' || phase === 'ready' || (phase === 'poster' && contextLost));
  return (
    <div id="scene-layer" data-phase={phase} data-tier={tier} aria-hidden="true">
      {mountCanvas && (
        <StageErrorBoundary>
          <Scene key={canvasKey} mode="site" persona={persona} />
        </StageErrorBoundary>
      )}
    </div>
  );
}

class StageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    stageStore.getState().toFallback('error');
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ───────────── /lab/stage (§5.16.2) ───────────── */

export const LAB_DEFAULT_SIZE = 1600;
const LAB_MIN_SIZE = 64;
const LAB_MAX_SIZE = 4096;

export interface LabParams {
  keyframe: KeyframeKey;
  theme: ThemeName;
  size: number;
}

/** ?key → KeyframeKey (varsayılan hero), ?theme → light | dark (varsayılan koyu, §6.3.5), ?size → px (varsayılan 1600) */
export function parseLabParams(search: string): LabParams {
  const q = new URLSearchParams(search);
  const key = q.get('key');
  const keyframe = KEYFRAME_KEYS.find((k) => k === key) ?? 'hero';
  const theme: ThemeName = q.get('theme') === 'light' ? 'light' : 'dark';
  const n = Number(q.get('size'));
  const size = Number.isInteger(n) && n >= LAB_MIN_SIZE && n <= LAB_MAX_SIZE ? n : LAB_DEFAULT_SIZE;
  return { keyframe, theme, size };
}

const subscribeNever = () => () => {};

export function LabStage({ data, persona }: { data: StageData; persona: Persona }) {
  // Sorgu YALNIZ client'ta okunur (D-06): SSR ve hidrasyon null görür, ardından gerçek değer gelir.
  const search = useSyncExternalStore(
    subscribeNever,
    () => window.location.search,
    () => null,
  );
  const params = useMemo(() => (search === null ? null : parseLabParams(search)), [search]);

  useEffect(() => {
    if (!params) return;
    const root = document.documentElement;
    root.dataset.theme = params.theme;
    root.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
  }, [params]);

  if (!params) return null;
  return (
    <div id="lab-canvas" style={{ width: params.size, height: params.size }}>
      <Scene
        mode="lab"
        keyframe={params.keyframe}
        theme={params.theme}
        size={params.size}
        data={data}
        persona={persona}
      />
    </div>
  );
}
