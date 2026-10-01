'use client';
// src/components/motion/ScenePreviews.tsx — hover-to-scene (§4.14 #3): [data-preview] öğeleri (alan başlığı, proje
// satırı, makale, journey/CV girdisi) taşın bant ve dilim önizlemesini sürer. İnce işaretçide pointerover, klavyede
// :focus-visible; dokunmatikte görünüm merkezinden geçen öğe (IntersectionObserver, 60 ms debounce). Aynı anda tek
// önizleme vardır (son gelen kazanır). [data-arc-pulse] (büyük e-posta) açık yay nabzını sürer (§4.14 #8): hover/odak
// sürdükçe 2.4 s'de bir, dokunmatikte merkezden geçişte bir kez. Sahne yoksa fx no-op'tur. Layout'ta bir kez mount olur.
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { previewScene, pulseArc, type ScenePreview } from '@/stage/fx';

const SEL = '[data-preview]';

function read(el: HTMLElement): ScenePreview {
  const b = el.dataset.previewBand?.split(',').map(Number);
  const s = el.dataset.previewSector;
  return {
    band: b?.length === 2 && b.every(Number.isFinite) ? [b[0]!, b[1]!] : null,
    sector: s === undefined ? null : Number(s),
  };
}

export function ScenePreviews() {
  const pathname = usePathname();
  useEffect(() => {
    let cur: HTMLElement | null = null;
    const show = (el: HTMLElement | null) => {
      if (el === cur) return;
      cur = el;
      previewScene(el ? read(el) : null);
    };
    const closest = (t: EventTarget | null, sel = SEL) =>
      t instanceof Element ? t.closest<HTMLElement>(sel) : null;
    let pulseEl: Element | null = null;
    let stopPulse: (() => void) | null = null;
    const pulse = (el: Element | null) => {
      if (el === pulseEl) return;
      stopPulse?.();
      stopPulse = null;
      pulseEl = el;
      if (el) stopPulse = pulseArc(true);
    };
    const offs: Array<() => void> = [];
    const on = <K extends keyof DocumentEventMap>(
      type: K,
      fn: (e: DocumentEventMap[K]) => void,
    ) => {
      document.addEventListener(type, fn, { capture: true, passive: true });
      offs.push(() => document.removeEventListener(type, fn, { capture: true }));
    };
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      on('pointerover', (e) => {
        show(closest(e.target));
        pulse(closest(e.target, '[data-arc-pulse]'));
      });
      on('pointerout', (e) => {
        if (e.relatedTarget !== null) return; // pencereden çıkış
        show(null);
        pulse(null);
      });
    } else {
      const inside = new Set<HTMLElement>();
      let timer = 0;
      const io = new IntersectionObserver(
        (entries) => {
          for (const en of entries) {
            const el = en.target as HTMLElement;
            if (en.isIntersecting) inside.add(el);
            else inside.delete(el);
          }
          window.clearTimeout(timer);
          timer = window.setTimeout(() => show(inside.values().next().value ?? null), 60);
        },
        { rootMargin: '-45% 0px -45% 0px' },
      );
      document.querySelectorAll<HTMLElement>(SEL).forEach((el) => io.observe(el));
      const arcIo = new IntersectionObserver(
        (entries) => {
          if (entries.some((en) => en.isIntersecting)) pulseArc(false);
        },
        { rootMargin: '-45% 0px -45% 0px' },
      );
      document.querySelectorAll('[data-arc-pulse]').forEach((el) => arcIo.observe(el));
      offs.push(() => {
        io.disconnect();
        arcIo.disconnect();
        window.clearTimeout(timer);
      });
    }
    on('focusin', (e) => {
      if (!(e.target instanceof Element && e.target.matches(':focus-visible'))) return;
      const el = closest(e.target);
      if (el) show(el);
      pulse(closest(e.target, '[data-arc-pulse]'));
    });
    on('focusout', (e) => {
      const to = e.relatedTarget instanceof Node ? e.relatedTarget : null;
      if (cur && !(to && cur.contains(to))) show(null);
      if (pulseEl && !(to && pulseEl.contains(to))) pulse(null);
    });
    return () => {
      offs.forEach((off) => off());
      if (cur) previewScene(null);
      pulse(null);
    };
  }, [pathname]);
  return null;
}
