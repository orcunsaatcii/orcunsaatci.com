'use client';
// src/components/motion/LenisProvider.tsx — Lenis (yalnız masaüstü tekerlek) + route kaydırma eşitlemesi +
// ana sayfa içi gezinme ve uzak atlama (§5.13.3–§5.13.4, §4.5.5, §10.3.2). Yaprak bileşen; DOM üretmez (§8.5).
import 'lenis/dist/lenis.css'; // yalnız CSS; JS statik import edilmez (D-33)
import type Lenis from 'lenis';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { PREF_EVENTS } from '@/lib/head-script';
import { directorApi, nav } from '@/stage/store';
import { revealUpTo, useMotionPref, useMotionRuntime } from './MotionRoot';

let lenis: Lenis | null = null;
export const getLenis = () => lenis;

/** Sayfa içi atlama süresi **[SABİT]** (§4.12.4 #3) */
const JUMP_S = 0.9;
/** Native smooth kaydırmada scrollend yoksa: 150 ms sessizlik, en geç 1,200 ms (§5.13.4) */
const SCROLL_QUIET_MS = 150;
const SCROLL_END_CAP_MS = 1200;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function LenisProvider() {
  // yaprak bileşen: children almaz (mount sırası §8.5)
  const rt = useMotionRuntime();
  const pref = useMotionPref();
  useEffect(() => {
    if (!rt || pref !== 'full') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return; // yalnız masaüstü tekerlek (D-15)
    let cancelled = false;
    let off: (() => void) | undefined;
    const tick = (time: number) => lenis?.raf(time * 1000); // gsap süresi saniye
    const teardown = () => {
      cancelled = true;
      off?.();
      off = undefined;
      rt.gsap.ticker.remove(tick);
      rt.gsap.ticker.lagSmoothing(500, 33); // GSAP varsayılanı
      lenis?.destroy();
      lenis = null;
    };
    // K-VAR-5: azaltılmış harekete geçişte Lenis tercih olayıyla AYNI görevde sökülür. React'in effect temizliği yavaş
    // makinede MotionToggle'ın konum düzeltme kaydırmasından (2 kare sonra) sonra kalabiliyordu; kaydırmayı gören Lenis'in
    // bekleyen isScrolling zamanlayıcısı destroy()'dan sonra html'e `lenis` sınıfını geri yazıyordu (PR #15 CI).
    const onPref = () => {
      if (document.documentElement.dataset.motion === 'reduce') teardown();
    };
    window.addEventListener(PREF_EVENTS.motion, onPref);
    performance.mark('os:lenis-import');
    void import('lenis').then(({ default: LenisCtor }) => {
      if (cancelled) return;
      lenis = new LenisCtor({
        autoRaf: false,
        lerp: 0.12,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 1,
        anchors: false, // sayfa içi bağlantılar scrollToChapter ile (§5.13.4)
        stopInertiaOnNavigate: true,
        respectReducedMotion: false, // kapıyı data-motion yönetir; kullanıcı açıkça 'full' seçtiyse OS tercihi ezilmez
      });
      off = lenis.on('scroll', rt.ScrollTrigger.update);
      rt.gsap.ticker.add(tick);
      rt.gsap.ticker.lagSmoothing(0);
    });
    return () => {
      window.removeEventListener(PREF_EVENTS.motion, onPref);
      teardown();
    };
  }, [rt, pref]);
  useInPageNavigation(rt !== null);
  return <RouteScrollSync />;
}

function RouteScrollSync() {
  const pathname = usePathname();
  const rt = useMotionRuntime();
  const isPop = useRef(false);
  const first = useRef(true);
  useEffect(() => {
    const onPop = () => {
      isPop.current = true;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (first.current) {
      first.current = false; // yeniden yüklemede tarayıcı geri yüklemesi korunur
      return;
    }
    nav.pending = isPop.current ? 'restore' : 'push'; // director'ün ilk refresh'i okur (§5.15.3)
    const restore = isPop.current;
    isPop.current = false;
    if (lenis) {
      lenis.resize();
      if (!restore && !window.location.hash) lenis.scrollTo(0, { immediate: true, force: true });
    }
    const id = requestAnimationFrame(() => rt?.ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname, rt]);
  useEffect(() => {
    if (!rt) return;
    void document.fonts?.ready.then(() => rt.ScrollTrigger.refresh()); // web fontları satır yüksekliğini değiştirir
    const onOrient = () => rt.ScrollTrigger.refresh();
    window.addEventListener('orientationchange', onOrient);
    return () => window.removeEventListener('orientationchange', onOrient);
  }, [rt]);
  return null;
}

/* ───────────── sayfa içi gezinme (§5.13.4) ───────────── */

/** Native (Lenis'siz) smooth kaydırmanın bitişi: scrollend, yoksa 150 ms sessizlik; üst sınır 1,200 ms. */
function onNativeScrollEnd(cb: () => void): void {
  let done = false;
  let quiet = 0;
  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(quiet);
    window.clearTimeout(cap);
    window.removeEventListener('scrollend', finish);
    window.removeEventListener('scroll', onScroll);
    cb();
  };
  const onScroll = () => {
    window.clearTimeout(quiet);
    quiet = window.setTimeout(finish, SCROLL_QUIET_MS);
  };
  const cap = window.setTimeout(finish, SCROLL_END_CAP_MS);
  const hasScrollEnd = (window as { onscrollend?: unknown }).onscrollend !== undefined; // ⚠️ Safari desteği (§5.13.4)
  if (hasScrollEnd) window.addEventListener('scrollend', finish, { once: true });
  else window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // hiç kaydırma olmazsa da biter
}

/**
 * Lenis 1.3.26: scrollTo süre modunu yalnızca `duration` VE `easing` birlikte verilirse kullanır;
 * aksi hâlde örnek lerp'i ile ilerler ve `duration` yok sayılır (dist/lenis.mjs Animate.advance).
 */
export function scrollToY(y: number, o: { duration?: number; onComplete?: () => void } = {}): void {
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const top = Math.min(Math.max(0, y), max);
  if (lenis) {
    lenis.scrollTo(top, {
      duration: o.duration ?? JUMP_S,
      easing: easeInOutCubic,
      force: true,
      onComplete: () => o.onComplete?.(),
    });
    return;
  }
  window.scrollTo({ top, behavior: 'smooth' });
  if (o.onComplete) onNativeScrollEnd(o.onComplete);
}

/** Hedef y: getBoundingClientRect().top + scrollY − scrollPaddingTop (§5.13.4) */
export function chapterTargetY(target: HTMLElement): number {
  const pad = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  return target.getBoundingClientRect().top + window.scrollY - pad;
}

/** §10.3.2: bölümün ilk başlığı tabIndex −1 alır ve kaydırmadan odaklanır (hero'da H1). */
function focusChapter(target: HTMLElement) {
  const heading = target.querySelector<HTMLElement>('h2, h1') ?? target;
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

/**
 * D-41: ana sayfada header çapaları ve "Bu bölümü atla" bu fonksiyonu kullanır. Komşu bölüm canlı scrub eder;
 * > 1 bölüm uzak hedef ve areas atlama bağlantısı her zaman kesme kuralını uygular (§4.5.5 [SABİT], §5.9.7).
 */
export function scrollToChapter(target: HTMLElement, o: { forceCut?: boolean } = {}): void {
  const chapters = [...document.querySelectorAll<HTMLElement>('#main [data-chapter]')];
  const to = chapters.indexOf(target);
  const from = directorApi.chapterIndexAt(window.scrollY);
  const far = o.forceCut === true || (to >= 0 && from >= 0 && Math.abs(to - from) > 1);
  if (far) directorApi.startCut('far-jump');
  revealUpTo(target); // sayfa içi gezinmede içerik anında görünür (§4.5.4 #5)
  scrollToY(chapterTargetY(target), {
    duration: JUMP_S,
    onComplete: () => {
      if (far) directorApi.endCut();
      focusChapter(target);
    },
  });
}

let stopHashWatch: () => void = () => {};
/** Hash'in düştüğü uzaklaşma: 2 svh (geri dönüş toleransı, K-CHOREO-5) */
const HASH_LEAVE_VH = 0.02;

/**
 * Atlama hedefe vardıktan sonra (çapa scroll-padding konumunda ya da sayfa sonunda) kullanıcı varış konumundan 2 svh'den
 * fazla uzaklaşırsa hash URL'den düşer (`replaceState`, Next'in `history.state`'i korunur). Aksi hâlde başka sayfaya
 * gidip geri gelince Next hash'e kaydırıyor, kalınan yer kayboluyordu (K-CHOREO-5, V-52). Hedefte kalındıysa hash ve
 * geri dönüş aynıdır (± 2 svh).
 */
function watchHashLeave(target: HTMLElement, id: string): void {
  stopHashWatch();
  let base = Number.NaN; // varışta çapanın scroll-padding'e göre konumu
  let raf = 0;
  const check = () => {
    raf = 0;
    if (window.location.hash !== `#${id}`) return stop();
    const pad = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const top = target.getBoundingClientRect().top - pad;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (Number.isNaN(base)) {
      if (Math.abs(top) <= 2 || window.scrollY >= max - 1) base = top;
    } else if (Math.abs(top - base) > HASH_LEAVE_VH * window.innerHeight) {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
      stop();
    }
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(check);
  };
  const stop = () => {
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(raf);
    stopHashWatch = () => {};
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  stopHashWatch = stop;
}

/** Capture aşamasında tek click dinleyicisi: #… ve aynı sayfaya işaret eden /#…, /en#… (runtime varken). */
function useInPageNavigation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href*="#"]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname)
        return;
      const id = decodeURIComponent(url.hash.slice(1));
      if (!id || id === 'main') return; // SkipLink ve "Başa dön" yerel çalışır (§10.3.1)
      const target = document.getElementById(id);
      if (!target?.matches('#main [data-chapter]')) return;
      e.preventDefault();
      scrollToChapter(target, { forceCut: a.hasAttribute('data-skip-section') });
      if (window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`);
      watchHashLeave(target, id);
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      stopHashWatch();
    };
  }, [enabled]);
}
