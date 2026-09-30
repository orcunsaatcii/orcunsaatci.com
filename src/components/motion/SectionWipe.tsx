'use client';
// src/components/motion/SectionWipe.tsx — work görüntüleyicisinin kesit silmesi ve altyazı değişimi (§4.9.4,
// §5.14.5, §6.5.4). work:active olayında: aşağı kaydırırken figür k soldan sağa açılır (inset(0 100% 0 0) → inset(0));
// yukarıda önce k−1 alta konur, sonra k sağdan sola kapanır. 600 ms --ease-in-out (power2.inOut); 1 px vurgu çizgisi
// kenarı taşır ve son 120 ms'de söner; altyazı 300 ms'de değişir. Süren silme sona atlar, yenisi başlar [SABİT] #9.
// instant (uzak atlama, geri yükleme, ilk durum) → son durum doğrudan yazılır. Yalnız görüntüleyici kapısı açıkken.
import { useEffect, useRef } from 'react';
import type { MotionRuntime } from '@/lib/gsap';
import { onStageEvent } from '@/stage/events';
import { useMotionRuntime } from './MotionRoot';

const WIPE_S = 0.6;
const LINE_FADE_S = 0.12;
const CAPTION_AT_S = 0.3;

type Timeline = ReturnType<MotionRuntime['gsap']['timeline']>;

export function SectionWipe({ scopeId }: { scopeId: string }) {
  const rt = useMotionRuntime();
  const tl = useRef<Timeline | null>(null);

  useEffect(() => {
    const scope = document.getElementById(scopeId);
    if (!rt || !scope) return;
    const { gsap } = rt;
    const figures = [...scope.querySelectorAll<HTMLElement>('[data-work-figure]')];
    const captions = [...scope.querySelectorAll<HTMLElement>('[data-work-caption]')];
    const glyphs = [...scope.querySelectorAll<HTMLElement>('[data-work-specimen-glyph]')];
    const viewerOn = () =>
      figures[0] !== undefined && getComputedStyle(figures[0]).position === 'sticky';

    const setCaption = (k: number) => {
      captions.forEach((c, i) => (c.hidden = i !== k));
    };
    const setGlyph = (k: number) => {
      glyphs.forEach((g, i) => (g.hidden = i !== k));
    };
    const settle = (k: number) => {
      figures.forEach((f, i) => {
        f.toggleAttribute('data-active', i === k);
        gsap.set(f, { clearProps: 'clipPath' });
      });
      scope
        .querySelectorAll<HTMLElement>('.work-wipe-line')
        .forEach((l) => gsap.set(l, { clearProps: 'all' }));
      setCaption(k);
      setGlyph(k);
    };

    const off = onStageEvent('work:active', (e) => {
      const k = Math.max(0, e.index); // proje 1'den önce figür 1 görünür (ilk boyamadaki CSS durumu)
      const prev = Math.max(0, e.prev);
      tl.current?.progress(1); // süren silme anında sona atlar
      tl.current = null;
      if (!viewerOn() || e.instant || k === prev) {
        settle(k);
        return;
      }
      const down = k > prev;
      const top = figures[down ? k : prev]; // DOM sırasında sonraki figür üstte
      const under = figures[down ? prev : k];
      if (!top || !under) return settle(k);
      // çizgi alttaki (tamamen açık) figürdedir: üstteki figürün kırpma kenarının hemen dışında görünür kalır
      const line = under.querySelector<HTMLElement>('.work-wipe-line');
      const width = top.getBoundingClientRect().width;
      under.setAttribute('data-active', '');
      top.setAttribute('data-active', '');
      setGlyph(k); // numune event'iyle aynı başlangıç (§4.9.4 #2)
      const t = gsap.timeline({ onComplete: () => settle(k) });
      const open = 'inset(0% 0% 0% 0%)';
      const shut = 'inset(0% 100% 0% 0%)';
      t.fromTo(
        top,
        { clipPath: down ? shut : open },
        { clipPath: down ? open : shut, duration: WIPE_S, ease: 'power2.inOut' },
        0,
      );
      if (line) {
        t.fromTo(
          line,
          { x: down ? 0 : width, opacity: 1 },
          { x: down ? width : 0, duration: WIPE_S, ease: 'power2.inOut' },
          0,
        );
        t.to(line, { opacity: 0, duration: LINE_FADE_S, ease: 'none' }, WIPE_S - LINE_FADE_S);
      }
      t.call(() => setCaption(k), undefined, CAPTION_AT_S);
      tl.current = t;
    });

    return () => {
      off();
      tl.current?.kill();
      tl.current = null;
      figures.forEach((f) => gsap.set(f, { clearProps: 'clipPath' }));
    };
  }, [rt, scopeId]);

  return null;
}
