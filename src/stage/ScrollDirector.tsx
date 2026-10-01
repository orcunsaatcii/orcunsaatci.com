'use client';
// src/stage/ScrollDirector.tsx — tek örnek; <div data-stage-scope> sayfa içeriğini sarar ve koşulsuz render edilir
// (§5.13.5, §8.5.2 kural 1). Runtime + preset + veri varken: ölçüm (yalnız refresh'te), track değerlendirme, event'ler,
// kesme kuralı (§5.9.7), --scene-opacity ve DOM olayları (about:cut, areas:step, work:active, journey:active).
// Kaydırma döngüsünde React render'ı ve bellek ayırma yoktur. Anchor'lar refresh'te ölçülür (live.anchors, §5.7.4);
// her güncelleme sahneden kare ister (invalidate).
import { useEffect, useRef, type ReactNode } from 'react';
import { useMotionRuntime } from '@/components/motion/MotionRoot';
import {
  applyEvents,
  computeIndices,
  createEventTargets,
  emit,
  eventOwned,
  notifyStageUpdate,
  resetEventState,
  resolveEvents,
  type CutReason,
  type EventIndices,
  type StageEvent,
} from './events';
import { keyframes, type Keyframe } from './keyframes';
import { presetDef } from './presets';
import type { AnchorId } from './anchors';
import {
  ANCHOR_MISSING,
  currentSceneOpacity,
  directorApi,
  live,
  nav,
  stageStore,
  stageTarget,
  useStage,
  type ChapterId,
} from './store';
import {
  applyBase,
  areasTurnEase,
  buildTracks,
  evaluateTracks,
  measureLayout,
  resolveTracks,
  stageCtx,
  variantOf,
  type Layout,
  type ResolvedTrack,
  type TrackProp,
} from './tracks';

/** §5.9.7 kesme süreleri (s): sönme / geri gelme */
const CUT_TIMING: Readonly<Record<CutReason, { out: number; in: number }>> = {
  'far-jump': { out: 0.15, in: 0.25 },
  restore: { out: 0.1, in: 0.2 },
  route: { out: 0, in: 0.3 },
  'instant-scroll': { out: 0, in: 0.2 },
};
/** Tek güncellemede |Δy| > 1.5·vh → kesme (Home/End, sayfada bul, dokunmatikte native çapa) */
const INSTANT_SCROLL_VH = 1.5;
/** --scene-opacity yazım eşiği ve loop eşiği (§5.9.9, §5.13.5) */
const OPACITY_EPS = 0.001;
const LOOP_EPS = 0.01;
const RESIZE_DEBOUNCE_MS = 150;

export function ScrollDirector({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const rt = useMotionRuntime();
  const preset = useStage((s) => s.preset);
  const data = useStage((s) => s.data);

  useEffect(() => {
    const root = scope.current;
    if (!rt || !root || !data || preset === 'none') return;
    const { gsap, ScrollTrigger } = rt;
    const def = presetDef(preset);
    let ro: ResizeObserver | undefined;
    let resizeTimer = 0;
    resetEventState();

    const ctx = gsap.context(() => {
      let layout: Layout | null = null;
      let groups = new Map<TrackProp, ResolvedTrack[]>();
      let base: Keyframe | null = null;
      let cctx = stageCtx(data, null);
      let prevIx: EventIndices | null = null;
      // iki indeks tamponu dönüşümlü kullanılır: yeni değer hiçbir zaman prevIx'in üstüne yazılmaz
      const mk = (): EventIndices => ({
        areas: 0,
        work: -1,
        journey: -1,
        cv: -1,
        fillWindow: false,
      });
      const bufs = [mk(), mk()] as const;
      let flip = 0;
      const targets = createEventTargets();
      let lastY = window.scrollY;
      let cutting = false;
      let writtenOpacity = -1;
      let chapters: Array<{ id: ChapterId; y: number }> = [];
      const cutEvent: Extract<StageEvent, { type: 'about:cut' }> = {
        type: 'about:cut',
        cutProgress: 0,
      };
      const owned = (p: TrackProp, y: number) => layout !== null && eventOwned(layout, p, y);
      // anchor id → ölçülmüş listedeki indeks (slot 0); eksik → ANCHOR_MISSING (refresh'te kurulur)
      let anchorIdx = new Map<AnchorId, number>();
      const anchorIndex = (id: AnchorId) => anchorIdx.get(id) ?? ANCHOR_MISSING;

      const writeCssVars = () => {
        const o = currentSceneOpacity();
        if (Math.abs(o - writtenOpacity) <= OPACITY_EPS) return;
        const crossed = writtenOpacity < 0 || o < LOOP_EPS !== writtenOpacity < LOOP_EPS;
        writtenOpacity = o;
        document.getElementById('scene-layer')?.style.setProperty('--scene-opacity', o.toFixed(3));
        if (crossed) stageStore.getState().setLoop(o < LOOP_EPS ? 'never' : 'demand'); // yalnız eşik geçişinde
      };

      const update = (y: number, o: { instant?: boolean; v?: number } = {}) => {
        if (!layout) return;
        let instant = !!o.instant || cutting;
        if (!cutting && !instant && Math.abs(y - lastY) > INSTANT_SCROLL_VH * layout.vh) {
          runCut('instant-scroll');
          instant = true;
        }
        lastY = y;
        live.scrollY = y;
        if (o.v !== undefined) {
          live.velocity = o.v;
          live.velocityAt = live.lastInput = performance.now();
        }
        live.inHero = preset === 'home' && y < layout.heroExit;
        const next = computeIndices(layout, y, bufs[flip]);
        flip ^= 1;
        applyBase(stageTarget, base, anchorIndex, next.fillWindow); // §5.9.3 adım 1
        evaluateTracks(groups, y, stageTarget, anchorIndex, owned);
        applyEvents(rt, preset, resolveEvents(preset, next, data, cctx, targets), next, prevIx, {
          instant,
        });
        prevIx = next;
        cutEvent.cutProgress = Math.min(1, Math.max(0, (1.1 - stageTarget.cut) / 1.1)); // track değeri (§5.9.5)
        emit(cutEvent);
        writeCssVars();
        notifyStageUpdate();
        stageStore.getState().invalidate();
      };

      /** Oturma: evaluate + event'ler instant + DOM olayları instant, sonra snap (§5.9.7 sırası) */
      const snap = (reason: CutReason) => {
        update(window.scrollY, { instant: true });
        live.snapNextFrame = true;
        stageStore.getState().invalidate();
        emit({ type: 'cut', stage: 'snap', reason });
      };
      const fadeIn = (reason: CutReason) => {
        gsap.to(stageTarget, {
          opacityCut: 1,
          duration: CUT_TIMING[reason].in,
          ease: 'power2.out',
          overwrite: true,
          onUpdate: writeCssVars,
          onComplete: () => {
            cutting = false;
            emit({ type: 'cut', stage: 'end', reason });
          },
        });
      };
      const runCut = (reason: CutReason) => {
        // anlık sönme + aynı güncellemede oturma + geri gelme (instant-scroll, route, restore girişi)
        cutting = true;
        emit({ type: 'cut', stage: 'start', reason });
        gsap.killTweensOf(stageTarget, 'opacityCut');
        stageTarget.opacityCut = 0;
        writeCssVars();
        live.snapNextFrame = true;
        emit({ type: 'cut', stage: 'snap', reason });
        fadeIn(reason);
      };
      let pendingCut: CutReason | null = null;
      directorApi.startCut = (reason) => {
        cutting = true;
        pendingCut = reason;
        emit({ type: 'cut', stage: 'start', reason });
        gsap.to(stageTarget, {
          opacityCut: 0,
          duration: CUT_TIMING[reason].out,
          ease: 'power2.in',
          overwrite: true,
          onUpdate: writeCssVars,
        });
      };
      directorApi.endCut = () => {
        const reason = pendingCut ?? 'far-jump';
        pendingCut = null;
        gsap.killTweensOf(stageTarget, 'opacityCut');
        stageTarget.opacityCut = 0;
        cutting = true;
        snap(reason);
        fadeIn(reason);
      };

      const publish = (l: Layout) => {
        const sections = root.querySelectorAll<HTMLElement>('[data-chapter]');
        chapters = [...sections].map((el) => ({
          id: el.dataset.chapter as ChapterId,
          y: Math.max(0, el.getBoundingClientRect().top + window.scrollY),
        }));
        const a = l.areas;
        directorApi.areasStepY = (k) =>
          a ? a.bodyY0 + ((10 + a.S * k + 0.65 * a.S) / (20 + a.S * a.N)) * a.bodyLen : Number.NaN;
        directorApi.chapterY = (id) => chapters.find((c) => c.id === id)?.y ?? Number.NaN;
        directorApi.chapterIndexAt = (y) => {
          let i = -1;
          for (let k = 0; k < chapters.length; k++) if ((chapters[k]?.y ?? 0) <= y + 1) i = k;
          return i;
        };
        emit({ type: 'refresh', chapters });
      };

      const refresh = () => {
        layout = measureLayout(root, preset); // fazlar, anchor'lar, aktivasyon çizgileri, areas pin'i
        anchorIdx = new Map();
        layout.anchors.forEach((a, i) => {
          if (a.slot === 0) anchorIdx.set(a.id, i);
        });
        live.anchors = layout.anchors;
        live.layout = layout;
        cctx = stageCtx(data, layout);
        base = def.base ? keyframes(cctx)[def.base] : null; // refresh'te bir kez (§5.13.5)
        groups = resolveTracks(
          buildTracks(preset, cctx, layout, variantOf(layout), areasTurnEase(data.intensity)),
          layout,
        );
        publish(layout);
        const pending = nav.consume(); // 'push' | 'restore' | null (§5.15.3)
        if (pending) runCut(pending === 'restore' ? 'restore' : 'route');
        update(window.scrollY, { instant: true });
      };

      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onRefresh: refresh, // ölçüm yalnızca burada
        onUpdate: (self) => update(self.scroll(), { v: self.getVelocity() }),
      });
      refresh();

      let lastH = document.documentElement.scrollHeight;
      ro = new ResizeObserver(() => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          const h = document.documentElement.scrollHeight;
          if (h !== lastH) {
            lastH = h; // döngü koruması: yalnız yükseklik değişince
            ScrollTrigger.refresh();
          }
        }, RESIZE_DEBOUNCE_MS);
      });
      ro.observe(document.body);
    }, root);

    return () => {
      ro?.disconnect();
      window.clearTimeout(resizeTimer);
      ctx.revert();
      gsap.killTweensOf(stageTarget);
      stageTarget.opacityCut = 1;
      live.layout = null;
      directorApi.areasStepY = () => Number.NaN;
      directorApi.chapterY = () => Number.NaN;
      directorApi.chapterIndexAt = () => -1;
      directorApi.startCut = () => {};
      directorApi.endCut = () => {};
    };
  }, [rt, preset, data]);

  return (
    <div ref={scope} data-stage-scope="">
      {children}
    </div>
  );
}
