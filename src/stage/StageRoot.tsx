'use client';
// src/stage/StageRoot.tsx — kalıcı sahne katmanı #scene-layer, lazy boot, kademe ve hata sınırı (§5.12.1, §5.12.3).
// İki kök layout'ta bir kez mount olur, client navigasyonunda unmount olmaz (D-18). Preset 'none' iken
// boot etmez (K-DEEP-2); gizli sekmede bekler (§9.2.4 kural 5). Stage chunk (three + R3F) yalnız yoklama tier ≠ static
// döndükten sonra istenir; motion runtime'ı ve director gövdesi de beklenir (sıra: motion → yoklama → stage).
import dynamic from 'next/dynamic';
import { Component, useEffect, type ReactNode } from 'react';
import { useMotionPref, whenMotion } from '@/components/motion/MotionRoot';
import type { Persona } from '@/experience/profile';
import { onIdle, STAGE_IDLE } from '@/lib/on-idle';
import { stageStore, useStage } from './store';

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
  const bootable = preset !== 'none'; // D-19, §4.13.1: 'none' preset'te yoklama ve boot yok

  useEffect(() => {
    if (!bootable) return; // ilk görünür preset'e kadar WebGL bağlamı açılmaz (K-DEEP-2)
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
            // director gövdesi runtime'la birlikte istendi; sahne ilk karesinde stageTarget'ı o yazmış olur
            Promise.all([import('./gl/Scene'), whenMotion(), import('./director')]),
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
  }, [motion, bootable]);

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
