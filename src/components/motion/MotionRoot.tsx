'use client';
// src/components/motion/MotionRoot.tsx — motion runtime yükleyici + tek reveal motoru (§5.13.2, §5.14.3, §8.5.2).
// Yaprak bileşen, DOM üretmez. Runtime `load` + boşluktan sonra ve yalnız data-motion="full" iken gelir (D-33).
// Gizli ön-reveal durumu yalnız html[data-motion="full"].motion-ready altında vardır (D-39); JS yoksa her şey görünür.
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { motion } from '@/design/tokens';
import type { MotionRuntime } from '@/lib/gsap';
import { HYDRATED_ATTR } from '@/lib/head-script';
import { MOTION_IDLE, onIdle } from '@/lib/on-idle';
import { onStageEvent } from '@/stage/events';
import { readMotionPref, subscribeMotionPref, useMotionPref, type MotionPref } from './motion-pref';

export { useMotionPref, type MotionPref };

/* ───────────── runtime deposu (tekil) ───────────── */

let runtime: MotionRuntime | null = null;
let loading: Promise<MotionRuntime> | null = null;
const listeners = new Set<() => void>();
const waiters: Array<(rt: MotionRuntime) => void> = [];
const importHooks = new Set<() => void>();

/** import('@/lib/gsap') (tekil). Yalnız MotionRoot çağırır: load sonrası ve data-motion="full" iken. */
export function loadMotion(): Promise<MotionRuntime> {
  if (!loading) {
    performance.mark('os:motion-import');
    loading = import('@/lib/gsap').then((m) => {
      runtime = m.runtime;
      waiters.splice(0).forEach((resolve) => resolve(m.runtime));
      listeners.forEach((cb) => cb());
      return m.runtime;
    });
    loading.catch(() => {
      loading = null; // ağ hatası: bir sonraki tercih değişiminde yeniden denenebilir
    });
    importHooks.forEach((cb) => cb());
  }
  return loading;
}

/**
 * Runtime import'u başlarken (başlamışsa hemen) çağrılır: runtime'la aynı pencerede istenecek chunk'lar içindir
 * (ScrollDirector gövdesi, PB-2). Temizlik fonksiyonu döner.
 */
export function onMotionImport(cb: () => void): () => void {
  if (loading) {
    cb();
    return () => {};
  }
  importHooks.add(cb);
  return () => {
    importHooks.delete(cb);
  };
}

/** Yüklemeyi TETİKLEMEZ; runtime hazır olunca çözülür (StageRoot, M5). */
export function whenMotion(): Promise<MotionRuntime> {
  return runtime ? Promise.resolve(runtime) : new Promise((resolve) => waiters.push(resolve));
}

/** Yüklüyse ve hareket 'full' ise runtime, değilse null (olay işleyicilerinden; yüklemeyi tetiklemez). */
export function currentMotion(): MotionRuntime | null {
  return readMotionPref() === 'full' ? runtime : null;
}

const subscribeRuntime = (cb: () => void) => {
  listeners.add(cb);
  const off = subscribeMotionPref(cb);
  return () => {
    listeners.delete(cb);
    off();
  };
};

/** Runtime; hareket 'reduce' iken null döner (tüketicilerin effect'leri temizlenir, §5.14.7). Sunucuda null. */
export function useMotionRuntime(): MotionRuntime | null {
  return useSyncExternalStore(
    subscribeRuntime,
    () => (readMotionPref() === 'full' ? runtime : null),
    () => null,
  );
}

/* ───────────── reveal motoru (§5.14.3) ───────────── */

const splits = new Map<HTMLElement, { revert: () => void }>();
let readyMarked = false;

/** Kurulum: görünümdekiler "açılmış" işaretlenir, geri kalanlar tetikleyicilere bağlanır, sonra .motion-ready eklenir. */
export function armReveals(root: HTMLElement, rt: MotionRuntime): () => void {
  const { gsap, ScrollTrigger } = rt;
  const vh = window.innerHeight;
  restoreTorn(root, vh);
  const ctx = gsap.context(() => {
    for (const el of root.querySelectorAll<HTMLElement>(
      '[data-reveal]:not(.is-revealed):not([data-armed])',
    )) {
      const when = el.dataset.revealWhen; // yalnız bu medya koşulunda reveal (ör. mobil work kapakları, §4.5.4 #9)
      if (
        el.getBoundingClientRect().top < vh * 0.88 ||
        (when && !window.matchMedia(when).matches)
      ) {
        el.classList.add('is-revealed'); // zaten görünür → asla gizleme
        continue;
      }
      el.dataset.armed = '';
      const art = el.closest('[data-chapter="work"] article');
      const con = el.closest('[data-chapter="contact"]');
      if (con) {
        // §4.11.4: H2 IN p 0.55, diğerleri 0.70; %75 zorlaması yok (§4.12.3)
        ScrollTrigger.create({
          trigger: con,
          start: el.matches('h2') ? 'top 45%' : 'top 30%',
          once: true,
          onEnter: () => reveal(el, rt, false),
        });
        continue;
      }
      ScrollTrigger.create({
        trigger: art ?? el,
        // work makaleleri top 85%: aktivasyondan (top 55%) 30 svh önce. Başlık satırları (700 ms + kademe) okuma hızında
        // (10 svh/s) ≈ 8 svh sürer; K-WORK-3'ün "≥ 20 svh önce tam açık" koşulu top 80%'de (25 svh) sağlanamıyordu.
        // SPEC-SAPMA §4.9.4, §4.12.1 (M6).
        start: art ? 'top 85%' : 'top 88%',
        once: true,
        onEnter: () => reveal(el, rt, false),
      });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 75%', // en geç burada tam: hızlı kaydırmada animasyon anında biter
        once: true,
        onEnter: () => reveal(el, rt, true),
      });
    }
  }, root);
  document.documentElement.classList.add('motion-ready'); // D-39: kurulumdan SONRA
  if (!readyMarked) {
    readyMarked = true;
    performance.mark('os:motion-ready');
  }
  const stopSafety = armSafety(root, rt);
  return () => {
    stopSafety();
    revertSplits(root);
    ctx.revert();
  };
}

/** Bir öğeyi açar; force = animasyonsuz (is-instant). Satır reveal'ı SplitText maskeleriyle bir kez oynar. */
export function reveal(el: HTMLElement, rt: MotionRuntime, force: boolean): void {
  if (el.classList.contains('is-revealed')) {
    if (force) {
      splits.get(el)?.revert();
      splits.delete(el);
      el.classList.add('is-instant');
    }
    return;
  }
  if (force) {
    el.classList.add('is-instant', 'is-revealed');
    return;
  }
  if (el.dataset.reveal === 'lines') {
    const split = rt.SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      aria: 'auto',
      onSplit: (self) =>
        rt.gsap.from(self.lines, {
          yPercent: motion.distance.revealLineFromYPercent, // 130 (§6.5.4)
          duration: motion.dur.slow / 1000,
          ease: motion.gsapEase.outExpo,
          stagger: (i: number) =>
            (Math.min(i, motion.stagger.maxItems - 1) * motion.stagger.line) / 1000, // ≤ 6 kademe (§6.5.3)
          onComplete: () => {
            self.revert(); // özgün DOM geri gelir: sayfada bul, kopyala, çeviri, ekran okuyucu
            splits.delete(el);
          },
        }),
    });
    splits.set(el, split);
  }
  el.classList.add('is-revealed');
}

function revertSplits(root: HTMLElement) {
  for (const [el, split] of splits) {
    if (!root.contains(el)) continue;
    split.revert();
    splits.delete(el);
  }
}

/** teardownMotion'ın açtığı, görünümün altındaki öğeler yeniden kurulabilir (reduce → full, §5.14.7). */
function restoreTorn(root: HTMLElement, vh: number) {
  for (const el of root.querySelectorAll<HTMLElement>('[data-reveal-torn]')) {
    el.removeAttribute('data-reveal-torn');
    if (el.getBoundingClientRect().top >= vh * 0.88)
      el.classList.remove('is-revealed', 'is-instant');
  }
}

/** §5.14.6: 3 s güvenliği, scrollend taraması, focusin, hash ve kesme. */
function armSafety(root: HTMLElement, rt: MotionRuntime): () => void {
  const pending = () =>
    root.querySelectorAll<HTMLElement>('[data-reveal][data-armed]:not(.is-revealed)');
  const sweep = () => {
    const limit = window.innerHeight;
    for (const el of pending()) if (el.getBoundingClientRect().top < limit) reveal(el, rt, true);
  };
  const t3 = window.setTimeout(sweep, 3000);

  let debounce = 0;
  const onScroll = () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(sweep, 150);
  };
  // Lenis'in yumuşak kaydırması sürerken tarama ertelenir: yavaş karede Chrome Lenis kareleri arasında scrollend
  // verir ve gecikmeli açılan bloklar (contact, §4.12.3) erken açılıyordu. Lenis durunca (lenis-scrolling kalkar) tarar.
  let settle = 0;
  const sweepWhenSettled = () => {
    window.clearTimeout(settle);
    if (document.documentElement.classList.contains('lenis-scrolling'))
      settle = window.setTimeout(sweepWhenSettled, 150);
    else sweep();
  };
  const endEvent = 'onscrollend' in window ? 'scrollend' : 'scroll';
  const onEnd = endEvent === 'scrollend' ? sweepWhenSettled : onScroll;
  window.addEventListener(endEvent, onEnd, { passive: true });

  const onFocus = (e: FocusEvent) => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>(
      '[data-reveal][data-armed]:not(.is-revealed)',
    );
    if (el && root.contains(el)) reveal(el, rt, true);
  };
  document.addEventListener('focusin', onFocus, true);

  const revealToHash = () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (target && root.contains(target)) revealUpTo(target);
  };
  window.addEventListener('hashchange', revealToHash);
  revealToHash();

  const offCut = onStageEvent('cut', (e) => {
    if (e.stage === 'snap') sweep();
  });

  return () => {
    window.clearTimeout(t3);
    window.clearTimeout(debounce);
    window.clearTimeout(settle);
    window.removeEventListener(endEvent, onEnd);
    document.removeEventListener('focusin', onFocus, true);
    window.removeEventListener('hashchange', revealToHash);
    offCut();
  };
}

/**
 * Hedef öğe ve ondan önceki bütün reveal'lar anında açılır (hash, sayfa içi gezinme; §4.5.4 #5, §5.14.6).
 * Runtime yoksa gizli durum da yoktur; yalnız işaretler temizlenir.
 */
export function revealUpTo(target: Element): void {
  const main = document.getElementById('main');
  if (!main) return;
  for (const el of main.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-revealed)')) {
    const before = el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (!before && !target.contains(el)) continue;
    if (runtime) reveal(el, runtime, true);
    else el.classList.add('is-instant', 'is-revealed');
  }
}

/**
 * full → reduce (§5.13.2, §5.14.7): tetikleyiciler ve SplitText örnekleri kalkar, .motion-ready silinir, bütün
 * reveal'lar anında açık olur. Lenis LenisProvider'ın, sahne StageRoot'un temizliğiyle kapanır.
 */
export function teardownMotion(): void {
  for (const split of splits.values()) split.revert();
  splits.clear();
  runtime?.ScrollTrigger.getAll().forEach((t) => t.kill());
  document.documentElement.classList.remove('motion-ready');
  for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    if (!el.classList.contains('is-revealed')) el.setAttribute('data-reveal-torn', '');
    el.classList.add('is-revealed', 'is-instant');
    el.removeAttribute('data-armed');
  }
}

/* ───────────── bileşen ───────────── */

export function MotionRoot() {
  const pathname = usePathname();
  const pref = useMotionPref();
  const rt = useMotionRuntime();
  const prevPref = useRef<MotionPref | null>(null);

  // §8.5.2 kural 3: hidrasyon işareti (head script'in 4 s yedeğini durdurur), js sınıfı, os:hydrated
  useEffect(() => {
    const d = document.documentElement;
    d.setAttribute(HYDRATED_ATTR, '');
    d.classList.add('js');
    performance.mark('os:hydrated');
  }, []);

  // Tercih: full → runtime'ı load + boşlukta iste; full → reduce geçişinde her şeyi sök
  useEffect(() => {
    const was = prevPref.current;
    prevPref.current = pref;
    if (pref === 'reduce') {
      if (was === 'full') teardownMotion();
      return;
    }
    if (runtime) return;
    return onIdle(() => {
      loadMotion().catch(() => {});
    }, MOTION_IDLE);
  }, [pref]);

  // Her pathname commit'inden sonra rAF'te reveal'ları kur (§8.5.1 #6)
  useEffect(() => {
    if (!rt) return;
    const main = document.getElementById('main');
    if (!main) return;
    let off: (() => void) | undefined;
    const id = requestAnimationFrame(() => {
      off = armReveals(main, rt);
    });
    return () => {
      cancelAnimationFrame(id);
      off?.();
    };
  }, [pathname, rt]);

  return null;
}
