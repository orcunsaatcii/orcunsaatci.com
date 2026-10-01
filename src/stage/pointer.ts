// src/stage/pointer.ts — girdi izleme (§4.6.4, §5.6.2, §5.12.3). İnce işaretçide pasif, rAF-birleştirilmiş
// pointermove: live.pointer (x, y ∈ [−1, 1], y yukarı +; px, py CSS px). Her işaretçi ya da kaydırma girdisi
// live.lastInput'u yazar: idle drift yeniden başlar (dokunmatikte pointerdown). Dokunmatikte taşa kısa dokunuş tek ışık
// taraması yapar (§4.14 #2). Yalnız canlı sahne mount'ken çalışır (gl/Scene.tsx): sahne chunk'ına girer, ilk pakete
// girmez. Three-free.
import { tapSweep } from './fx';
import { live, stageStore } from './store';

/** Dokunuş taraması (§4.14 #2): < 250 ms, < 10 px; etkileşimli öğelerin üstünde değil */
const TAP_MS = 250;
const TAP_PX = 10;
const NO_TAP = 'a, button, input, select, textarea, label, [role=button], [data-no-press]';

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
  let down = { t: 0, x: 0, y: 0, id: -1 };
  const onDown = (e: PointerEvent) => {
    input();
    down = { t: performance.now(), x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || e.pointerId !== down.id) return;
    if (performance.now() - down.t >= TAP_MS) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) >= TAP_PX) return;
    if (e.target instanceof Element && e.target.closest(NO_TAP)) return;
    const s = live.stone;
    if (!s.visible || stageStore.getState().tier === 'low') return;
    if (Math.hypot(e.clientX - s.cx, e.clientY - s.cy) > s.r) return;
    tapSweep();
  };
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('scroll', input, { passive: true });
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerout', onOut);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('scroll', input);
    live.pointer.active = false;
  };
}
