// src/stage/fx.ts — sahne mikro etkileşimleri (§4.14 #2, #3, #8, #9; §5.9.10): hover/odak önizlemeleri, dokunuş
// taraması, yay nabzı, halka dalgası ve /projeler filtresi. stageTarget'ın zaman tabanlı alanlarını tween'ler ve kare
// ister. Motion runtime yoksa (azaltılmış hareket, yükleme öncesi) ya da canlı sahne hazır değilse no-op: taş mount
// değildir, DOM vurgusu yeterlidir (§4.14.2). Three-free; ilk pakettedir (yalnız GSAP'i runtime'dan alır).
import { currentMotion } from '@/components/motion/MotionRoot';
import { NO_BAND } from '@/lib/section-geometry';
import { directorApi, live, stageStore, stageTarget } from './store';

const invalidate = () => stageStore.getState().invalidate();
/** Canlı sahne çiziliyorsa runtime; duraklatma nabız ve dalgayı durdurur (§4.14 #12) */
const scene = (pausable = false) => {
  const rt = currentMotion();
  const st = stageStore.getState();
  return rt && st.phase === 'ready' && !(pausable && st.paused) ? rt : null;
};

export interface ScenePreview {
  band?: readonly [number, number] | null;
  sector?: number | null;
}

/**
 * Hover-to-scene (§4.14 #3): bant ve/veya dilim önizlemesi 240 ms'de gelir; null ile 400 ms'de söner. Aynı anda tek
 * önizleme vardır: yenisi süren geçişi keser (son gelen kazanır).
 */
export function previewScene(p: ScenePreview | null): void {
  const rt = scene();
  if (!rt) return;
  rt.gsap.killTweensOf(stageTarget, 'bandPreviewAlpha,sectorPreviewAlpha');
  if (!p) {
    rt.gsap.to(stageTarget, {
      bandPreviewAlpha: 0,
      sectorPreviewAlpha: 0,
      duration: 0.4,
      ease: 'power2.out',
      onUpdate: invalidate,
    });
    return;
  }
  const band = p.band ?? null;
  const sector = p.sector ?? -1;
  stageTarget.bandPreviewStart = band ? band[0] : NO_BAND[0];
  stageTarget.bandPreviewEnd = band ? band[1] : NO_BAND[1];
  stageTarget.sectorPreviewIndex = sector;
  rt.gsap.to(stageTarget, {
    bandPreviewAlpha: band ? 1 : 0,
    sectorPreviewAlpha: sector >= 0 ? 1 : 0,
    duration: 0.24,
    ease: 'power2.out',
    onUpdate: invalidate,
  });
}

/**
 * E-posta yay nabzı (§4.14 #8): uArcPulse 0 → 1 → 0.4; repeat true iken (hover sürdükçe) 2.4 s'de bir tekrarlar.
 * Durdurma fonksiyonu döner (nabız 400 ms'de söner).
 */
export function pulseArc(repeat = true): () => void {
  const rt = scene(true);
  if (!rt) return () => {};
  const { gsap } = rt;
  gsap.killTweensOf(stageTarget, 'arcPulse');
  const tl = gsap.timeline({ repeat: repeat ? -1 : 0, onUpdate: invalidate });
  tl.to(stageTarget, { arcPulse: 1, duration: 0.4, ease: 'power2.out' })
    .to(stageTarget, { arcPulse: 0.4, duration: 0.8, ease: 'power2.inOut' })
    .to(stageTarget, { arcPulse: 0.4, duration: 1.2 });
  return () => {
    tl.kill();
    gsap.to(stageTarget, { arcPulse: 0, duration: 0.4, ease: 'power2.out', onUpdate: invalidate });
  };
}

/** Kopyala halka dalgası (§4.14 #9): uWave 0 → 1 (600 ms), ardından −1 (kapalı) */
export function sendWave(): void {
  const rt = scene(true);
  if (!rt) return;
  rt.gsap.killTweensOf(stageTarget, 'wave');
  rt.gsap.fromTo(
    stageTarget,
    { wave: 0 },
    {
      wave: 1,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: invalidate,
      onComplete: () => {
        stageTarget.wave = -1;
        invalidate();
      },
    },
  );
}

let sweeping = false;
/** Dokunmatikte taşa kısa dokunuş (§4.14 #2): tek tarama, az +60° ve geri (1.2 s); süren tarama bitmeden yok sayılır */
export function tapSweep(): void {
  const rt = scene();
  if (!rt || sweeping) return;
  sweeping = true;
  rt.gsap.fromTo(
    stageTarget,
    { sweepAz: 0 },
    {
      keyframes: [
        { sweepAz: 60, duration: 0.6, ease: 'power2.inOut' },
        { sweepAz: 0, duration: 0.6, ease: 'power2.inOut' },
      ],
      onUpdate: invalidate,
      onComplete: () => {
        sweeping = false;
      },
    },
  );
}

/** /projeler filtre çipi (§5.9.10): alan indeksi ya da null; director dilimi ve dönüşü 400 ms'de tween'ler */
export function setPlanFilter(k: number | null): void {
  live.planFilter = k;
  directorApi.update();
}
