// src/stage/director.ts — ScrollDirector'ün gövdesi (§5.13.5): ölçüm (yalnız refresh'te), track değerlendirme,
// event'ler, kesme kuralı (§5.9.7), --scene-opacity ve DOM olayları (about:cut, areas:step, work:active,
// journey:active). Motion runtime import'uyla aynı anda istenir ve runtime + preset + veri varken çalışır: track'ler,
// keyframe'ler ve event hedefleri ilk pakete girmez (PB-1). Kaydırma döngüsünde React render'ı ve bellek ayırma yoktur.
// Anchor'lar refresh'te ölçülür (live.anchors, §5.7.4); her güncelleme sahneden kare ister (invalidate).
import type { MotionRuntime } from '@/lib/gsap';
import type { AnchorId } from './anchors';
import {
  applyEvents,
  computeIndices,
  createEventTargets,
  eventOwned,
  resetEventState,
  resolveEvents,
  type EventIndices,
} from './event-targets';
import { emit, notifyStageUpdate, type CutReason, type StageEvent } from './events';
import { keyframes, type Keyframe } from './keyframes';
import { presetDef } from './presets';
import { anchorScreen } from './anchor-screen';
import {
  ANCHOR_MISSING,
  ANCHOR_VIRTUAL,
  currentSceneOpacity,
  directorApi,
  live,
  nav,
  stageStore,
  stageTarget,
  type ChapterId,
  type PresetName,
  type StageData,
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
/** Kesmede belirme, oturtulmuş kare çizilene dek bekler; sahne kare çizmiyorsa en geç bu süre sonra başlar */
const SNAP_WAIT_MS = 1500;
const RESIZE_DEBOUNCE_MS = 150;

/** Director'ü root (data-stage-scope) üzerinde kurar; temizlik fonksiyonu döner (preset, veri ya da runtime değişince). */
export function runDirector(
  root: HTMLElement,
  rt: MotionRuntime,
  preset: PresetName,
  data: StageData,
): () => void {
  const { gsap, ScrollTrigger } = rt;
  const def = presetDef(preset);
  let ro: ResizeObserver | undefined;
  let resizeTimer = 0;
  let raf = 0; // kesmede belirme bekleme zinciri (§5.9.7)
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
    /** okuma modu hedefi (§4.13.1): −1 = henüz uygulanmadı */
    let readingTo = -1;
    /** folio "Sonraki proje" çapasının indeksi (page-folio slot 1); yoksa −1 */
    let slot1 = -1;
    /** route glide'ı (§5.15.3): sanal çapadan (eski sayfanın son karesi) yeni çapaya 700 ms */
    let glide: { mix: number } | null = null;
    // anchor id → ölçülmüş listedeki indeks (slot 0); eksik → ANCHOR_MISSING (refresh'te kurulur)
    let anchorIdx = new Map<AnchorId, number>();
    const anchorIndex = (id: AnchorId) => anchorIdx.get(id) ?? ANCHOR_MISSING;

    const writeCssVars = () => {
      const o = currentSceneOpacity();
      if (Math.abs(o - writtenOpacity) <= OPACITY_EPS) return;
      const crossed = writtenOpacity < 0 || o < LOOP_EPS !== writtenOpacity < LOOP_EPS;
      writtenOpacity = o;
      document.getElementById('scene-layer')?.style.setProperty('--scene-opacity', o.toFixed(3));
      // yalnız eşik geçişinde; kesme sürerken döngü açık kalır: oturtulmuş kare görünmezken çizilir (belirme eski
      // kareyle başlamaz). Kesme bitince durum yeniden değerlendirilir (fadeIn onComplete).
      if (crossed && !cutting) stageStore.getState().setLoop(o < LOOP_EPS ? 'never' : 'demand');
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
      next.filter = live.planFilter ?? -1;
      applyBase(stageTarget, base, anchorIndex, next.fillWindow); // §5.9.3 adım 1
      evaluateTracks(groups, y, stageTarget, anchorIndex, owned);
      // folio "Sonraki proje" (§5.9.10): blok etkinken çapa slot 1'dir; değişim opaklık 0 iken olur (okuma modu)
      if (next.slot === 1 && slot1 >= 0) {
        stageTarget.anchorFrom = slot1;
        stageTarget.anchorTo = slot1;
        stageTarget.anchorMix = 0;
      }
      if (glide) {
        stageTarget.anchorFrom = ANCHOR_VIRTUAL;
        stageTarget.anchorMix = glide.mix;
      }
      applyEvents(rt, preset, resolveEvents(preset, next, data, cctx, targets), next, prevIx, {
        instant,
      });
      prevIx = next;
      // Okuma modu (§4.13.1): slot 0 bloğu ya da etkin "Sonraki proje" görünürken 1, değilse 300 ms'de 0
      const reading = y < (layout.reading ?? Number.POSITIVE_INFINITY) || next.slot === 1 ? 1 : 0;
      if (reading !== readingTo) {
        readingTo = reading;
        gsap.killTweensOf(stageTarget, 'opacityReading');
        if (instant) stageTarget.opacityReading = reading;
        else
          gsap.to(stageTarget, {
            opacityReading: reading,
            duration: 0.3,
            ease: 'power2.out',
            onUpdate: () => {
              writeCssVars();
              stageStore.getState().invalidate();
            },
          });
      }
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
      const start = () =>
        gsap.to(stageTarget, {
          opacityCut: 1,
          duration: CUT_TIMING[reason].in,
          ease: 'power2.out',
          overwrite: true,
          onUpdate: writeCssVars,
          onComplete: () => {
            cutting = false;
            const o = currentSceneOpacity();
            stageStore.getState().setLoop(o < LOOP_EPS ? 'never' : 'demand');
            emit({ type: 'cut', stage: 'end', reason });
          },
        });
      // Canlı sahnede belirme, rig oturtulmuş kareyi çizdikten sonra (snapNextFrame sıfırlanır) bir sonraki karede
      // başlar: aksi hâlde opaklık yükselirken ekranda kesme öncesi kare görünüyordu (K-CHOREO-5, K-GEN-9).
      if (stageStore.getState().phase !== 'ready') {
        start();
        return;
      }
      // Zincir tektir ve sökülünce iptal edilir: aksi hâlde sonradan başlayan tween'in onComplete'i döngüyü 'demand'e
      // alıyordu (preset 'none' sayfasında görünmez kareler, §5.19)
      cancelAnimationFrame(raf);
      const t0 = performance.now();
      const wait = () => {
        raf =
          !live.snapNextFrame || performance.now() - t0 > SNAP_WAIT_MS
            ? requestAnimationFrame(() => start())
            : requestAnimationFrame(wait);
      };
      raf = requestAnimationFrame(wait);
    };
    const runCut = (reason: CutReason) => {
      // anlık sönme + aynı güncellemede oturma + geri gelme (instant-scroll, route, restore girişi). Döngü açılır:
      // oturtulmuş kare görünmezken çizilsin (önceki sayfanın 'never'i belirmeyi zaman aşımına bırakıyordu)
      cutting = true;
      stopGlide();
      stageStore.getState().setLoop('demand');
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
      stageStore.getState().setLoop('demand');
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
      slot1 = layout.anchors.findIndex((a) => a.id === 'page-folio' && a.slot === 1);
      cctx = stageCtx(data, layout);
      base = def.base ? keyframes(cctx)[def.base] : null; // refresh'te bir kez (§5.13.5)
      groups = resolveTracks(
        buildTracks(preset, cctx, layout, variantOf(layout), areasTurnEase(data.intensity)),
        layout,
      );
      publish(layout);
      const pending = nav.consume(); // 'push' | 'restore' | null (§5.15.3)
      if (pending === 'push' && canGlide()) startGlide();
      else if (pending) runCut(pending === 'restore' ? 'restore' : 'route');
      update(window.scrollY, { instant: true });
    };

    /** §5.15.3: eski karede Taş görünürdü ve yeni hedef ilk görünümde görünür olacak (opaklık ve çapa ekranda) */
    const canGlide = (): boolean => {
      const s = nav.snapshot;
      if (!layout || !base || !s.visible || s.opacity <= LOOP_EPS) return false;
      const y = window.scrollY;
      if (y >= (layout.reading ?? Number.POSITIVE_INFINITY)) return false;
      const a = layout.anchors[anchorIndex(def.anchors[0] ?? 'page-folio')];
      if (!a) return false;
      const r = anchorScreen(a, y, 1);
      return r.D > 0 && r.cy + r.D / 2 > 0 && r.cy - r.D / 2 < layout.vh;
    };
    const stopGlide = () => {
      if (!glide) return;
      gsap.killTweensOf(glide);
      glide = null;
    };
    const startGlide = () => {
      const s = nav.snapshot;
      live.virtualAnchor.cx = s.cx;
      live.virtualAnchor.cy = s.cy;
      live.virtualAnchor.D = 2 * s.r;
      stopGlide();
      const g = { mix: 0 };
      glide = g;
      gsap.to(g, {
        mix: 1,
        duration: 0.7,
        ease: 'power2.inOut',
        onUpdate: () => update(window.scrollY),
        onComplete: () => {
          if (glide === g) glide = null;
          update(window.scrollY);
        },
      });
    };
    directorApi.update = () => update(window.scrollY);

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
    cancelAnimationFrame(raf);
    ro?.disconnect();
    window.clearTimeout(resizeTimer);
    ctx.revert();
    gsap.killTweensOf(stageTarget);
    stageTarget.opacityCut = 1;
    stageTarget.opacityReading = 1;
    live.layout = null;
    directorApi.update = () => {};
    directorApi.areasStepY = () => Number.NaN;
    directorApi.chapterY = () => Number.NaN;
    directorApi.chapterIndexAt = () => -1;
    directorApi.startCut = () => {};
    directorApi.endCut = () => {};
  };
}
