// src/stage/pointer.ts — girdi izleme (§4.6.4, §5.6.2, §5.12.3). İnce işaretçide pasif, rAF-birleştirilmiş
// pointermove: live.pointer (x, y ∈ [−1, 1], y yukarı +; px, py CSS px). Her işaretçi ya da kaydırma girdisi
// live.lastInput'u yazar: panelin kendiliğinden hareketi yeniden başlar (dokunmatikte pointerdown, K-HERO-9). Yalnız
// canlı sahne mount'ken çalışır (gl/Scene.tsx): sahne chunk'ına girer, ilk pakete girmez. Three-free.
import { live, stageStore } from './store';

/** Dinleyicileri kurar; temizlik fonksiyonu döner. */
export function trackInput(): () => void {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let raf = 0;
  let px = 0;
  let py = 0;
  const input = () => {
    live.lastInput = performance.now();
    stageStore.getState().invalidate();
  };
  const flush = () => {
    raf = 0;
    const p = live.pointer;
    p.px = px;
    p.py = py;
    p.x = (px / window.innerWidth) * 2 - 1;
    p.y = 1 - (py / window.innerHeight) * 2;
    p.active = true;
    input();
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX;
    py = e.clientY;
    if (!raf) raf = requestAnimationFrame(flush);
  };
  const onOut = (e: PointerEvent) => {
    if (e.relatedTarget !== null) return;
    live.pointer.active = false;
    stageStore.getState().invalidate();
  };
  if (fine) {
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
  }
  live.lastInput = performance.now(); // sahne açılışı girdi sayılır: süzülme ilk 20 s / 8 s oynar
  const onDown = () => input();
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('scroll', input, { passive: true });
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerout', onOut);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('scroll', input);
    live.pointer.active = false;
  };
}
