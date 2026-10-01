'use client';
// src/components/ui/FloatingPreview.tsx — /projeler yüzen proje önizlemesi (§4.14 #16, §4.14.5). Yalnız masaüstü ve
// ince işaretçi. Satır hover'ı ya da odağı tetikler. Görsel 4:3, genişlik clamp(240px, 22vw, 360px), köşe 6 px; varsa
// projenin 4:3 önizlemesi, yoksa 16:10 kapak object-fit: cover. Konum işaretçiye göre +24 px x, −%50 y; görüntü alanı
// içinde kalır ve satırın başlığının üstüne binmez (sağ yarı tercih edilir). Giriş: opaklık 160 ms + clip-path
// inset(10%) → inset(0) 400 ms + scale 0.96 → 1; işaretçiyi quickTo 0.5 s ile izler; satır değişiminde 160 ms çapraz
// solma; çıkış 160 ms. Klavye odağında satırın sağ ucuna sabitlenir. Azaltılmış harekette solma/takip/ölçek yok:
// satırın yanına sabitlenir. Görsel aria-hidden, alt=""; ilk hover/odakta mount edilir (sizes 384px, §9.3.1).
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useMotionRuntime } from '@/components/motion/MotionRoot';

export interface PreviewImage {
  slug: string;
  src: string;
  width: number;
  height: number;
  dominant?: string;
}

const OFFSET_X = 24;

export function FloatingPreview({ images }: { images: readonly PreviewImage[] }) {
  const rt = useMotionRuntime();
  const box = useRef<HTMLDivElement>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [mounted, setMounted] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const el = box.current;
    if (
      !el ||
      !window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 64rem)').matches
    )
      return;
    const reduce = () => document.documentElement.dataset.motion === 'reduce' || !rt;
    const gsap = rt?.gsap;
    const qx = gsap?.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const qy = gsap?.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    let cur: HTMLElement | null = null;
    let shown = false;

    /** sağ yarı tercih edilir; görüntü alanında kalır, başlığın üstüne binmez */
    const target = (row: HTMLElement, px: number | null, py: number | null) => {
      const r = row.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const title = row.querySelector('h2')?.getBoundingClientRect();
      const minX = Math.max(
        title ? title.right + OFFSET_X : r.left + r.width / 2,
        r.left + r.width / 2,
      );
      let x = px === null ? r.right - w : px + OFFSET_X;
      x = Math.min(Math.max(x, minX), window.innerWidth - w - 16);
      let y = (py ?? r.top + r.height / 2) - h / 2;
      y = Math.min(Math.max(y, 16), window.innerHeight - h - 16);
      return { x, y };
    };
    const show = (row: HTMLElement, px: number | null, py: number | null) => {
      const s = row.dataset.projectSlug ?? null;
      if (!s) return;
      setMounted((m) => (m.has(s) ? m : new Set(m).add(s)));
      setSlug(s);
      const { x, y } = target(row, px, py);
      if (!shown || reduce() || !qx || !qy) {
        if (gsap) gsap.set(el, { x, y });
        else el.style.transform = `translate(${x}px, ${y}px)`;
      } else {
        qx(x);
        qy(y);
      }
      if (!shown) {
        shown = true;
        el.dataset.open = '';
        if (!reduce())
          el.animate(
            [
              { opacity: 0, clipPath: 'inset(10% round 6px)', scale: '0.96' },
              { opacity: 1, clipPath: 'inset(0 round 6px)', scale: '1' },
            ],
            { duration: 400, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          );
      }
    };
    const hide = () => {
      if (!shown) return;
      shown = false;
      cur = null;
      if (reduce()) {
        delete el.dataset.open;
        return;
      }
      el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 160,
        easing: 'cubic-bezier(0.5, 0, 0.75, 0)',
      }).finished.then(() => {
        if (!shown) delete el.dataset.open;
      });
    };
    const rowOf = (t: EventTarget | null) =>
      t instanceof Element ? t.closest<HTMLElement>('li[data-project-slug]') : null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const row = rowOf(e.target);
      if (!row || row.hidden) return hide();
      cur = row;
      show(row, e.clientX, e.clientY);
    };
    const onFocus = (e: FocusEvent) => {
      const row = rowOf(e.target);
      if (row && e.target instanceof Element && e.target.matches(':focus-visible')) {
        cur = row;
        show(row, null, null); // klavye: satırın sağ ucuna sabit
      }
    };
    const onBlur = (e: FocusEvent) => {
      if (cur && !(e.relatedTarget instanceof Node && cur.contains(e.relatedTarget))) hide();
    };
    const list = el.parentElement ?? document;
    list.addEventListener('pointermove', onMove as EventListener, { passive: true });
    list.addEventListener('pointerleave', hide);
    list.addEventListener('focusin', onFocus as EventListener);
    list.addEventListener('focusout', onBlur as EventListener);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      list.removeEventListener('pointermove', onMove as EventListener);
      list.removeEventListener('pointerleave', hide);
      list.removeEventListener('focusin', onFocus as EventListener);
      list.removeEventListener('focusout', onBlur as EventListener);
      window.removeEventListener('scroll', hide);
    };
  }, [rt]);

  return (
    <div ref={box} aria-hidden="true" className="floating-preview">
      {images
        .filter((p) => mounted.has(p.slug))
        .map((p) => (
          <Image
            key={p.slug}
            src={p.src}
            alt=""
            width={p.width}
            height={p.height}
            sizes="384px"
            data-on={p.slug === slug ? '' : undefined}
            style={{ backgroundColor: p.dominant }}
          />
        ))}
    </div>
  );
}
