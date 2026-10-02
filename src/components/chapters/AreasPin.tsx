'use client';
// src/components/chapters/AreasPin.tsx — areas pin'inin istemci parçaları (§4.8.2–§4.8.8, §10.3.4).
// Pin kapısını CSS seçer (html.js, tam hareket, medya, N); burada yalnız sığma ölçümü (mobil 58 svh [SABİT],
// masaüstü aynı güvenlik), etkin adımın DOM durumu, iğne ve adım düğmeleri vardır. Etkin adım GSAP'e BAĞLI
// DEĞİLDİR: hafif kaydırma dinleyicisi ölçülen aralıklardan hesaplar (K-AREAS-12); director çalışırken onun
// areas:step olayları kullanılır (aynı saf fonksiyon, §5.9.5). Kaydırma React render'ı üretmez (DOM yazımı).
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { scrollToY } from '@/components/motion/LenisProvider';
import { useMotionPref } from '@/components/motion/MotionRoot';
import { AREAS_STEP, areasIndexAt, lastStageEvent, onStageEvent } from '@/stage/events';
import { directorApi } from '@/stage/store';

/* ───────────── pin durumu (modül deposu) ───────────── */

let pinned = false;
const subs = new Set<() => void>();
function setPinned(v: boolean) {
  if (v === pinned) return;
  pinned = v;
  subs.forEach((cb) => cb());
}
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
};
/** Pin etkin mi (istemci doğruladıktan sonra). SSR ve hidrasyon: false → düz metin (uyumsuzluk yok). */
export const useAreasPinned = () =>
  useSyncExternalStore(
    subscribe,
    () => pinned,
    () => false,
  );

/** GSAP'siz adım hedefi için son ölçülen geometri (director yoksa) */
let geo: { bodyY0: number; bodyLen: number; S: number; N: number } | null = null;
/** Adım k'nın dwell ortası: sA(k) + 0.65·S (§4.8.7, K-AREAS-6) */
export function areasStepY(k: number): number {
  const y = directorApi.areasStepY(k);
  if (Number.isFinite(y) || !geo) return y;
  return geo.bodyY0 + ((10 + geo.S * k + 0.65 * geo.S) / (20 + geo.S * geo.N)) * geo.bodyLen;
}
const STEP_SCROLL_S = 0.8;
let lockUntil = 0;
let lockSeq = 0;
function goToStep(k: number, o: { lock?: boolean } = {}) {
  const y = areasStepY(k);
  if (!Number.isFinite(y)) return;
  const seq = ++lockSeq;
  if (o.lock) lockUntil = performance.now() + 1500;
  scrollToY(y, {
    duration: STEP_SCROLL_S,
    onComplete: () => {
      // yalnız son adım kaydırması kilidi açar: kesilen önceki kaydırmanın geç bitişi (scrollend / üst sınır) yeni
      // odağın kilidini açıp adımı geri almasın (§10.3.3 örtülmeme)
      if (seq === lockSeq) lockUntil = 0;
    },
  });
}

const pad = (x: number) => String(x).padStart(2, '0');

/* ───────────── bileşenler ───────────── */

/** h3 içeriği; pin modunda <button> (Enter/Space adıma kaydırır). aria-current="step"'i AreasPin yazar. */
export function AreaStepButton({ index, children }: { index: number; children: ReactNode }) {
  const on = useAreasPinned();
  if (!on) return <>{children}</>;
  return (
    <button
      type="button"
      className="area-step"
      data-area-step={index}
      onClick={() => goToStep(index)}
    >
      {children}
    </button>
  );
}

/** Sayaç (aria-hidden) + segmentli ilerleme (≥ 24 × 24 px düğmeler); yalnız pin modunda. */
export function AreasProgress({
  n,
  groupLabel,
  stepLabels,
}: {
  n: number;
  groupLabel: string;
  stepLabels: readonly string[];
}) {
  const on = useAreasPinned();
  if (!on) return null;
  return (
    <div className="areas-progress">
      <p aria-hidden="true" data-areas-counter="" className="type-meta nums-tabular">
        {`${pad(1)} / ${pad(n)}`}
      </p>
      <div role="group" aria-label={groupLabel} className="flex items-center gap-1">
        {stepLabels.map((label, k) => (
          <button
            key={k}
            type="button"
            aria-label={label}
            data-area-seg={k}
            className="areas-seg"
            onClick={() => goToStep(k)}
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Denetleyici: DOM üretmez. */
export function AreasPin({ sectionId, n }: { sectionId: string; n: number }) {
  const pref = useMotionPref();

  useEffect(() => {
    const section = document.getElementById(sectionId);
    const stage = section?.querySelector<HTMLElement>('[data-areas-stage]');
    const text = section?.querySelector<HTMLElement>('.areas-text');
    const list = section?.querySelector<HTMLElement>('.areas-list');
    const needle = section?.querySelector<HTMLElement>('[data-areas-needle]');
    const dial = section?.querySelector<HTMLElement>('.areas-dial');
    if (!section || !stage || !text || !list || !needle || !dial) return;

    let cur = -1;
    let lastY = window.scrollY;
    let raf = 0;
    let resizeTimer = 0;
    let disposed = false;
    const all = (sel: string) => section.querySelectorAll<HTMLElement>(sel);

    const measureGeo = () => {
      const top = section.getBoundingClientRect().top + window.scrollY;
      const mobile = !window.matchMedia('(min-width: 64rem)').matches;
      geo = {
        bodyY0: top,
        bodyLen: Math.max(0, section.offsetHeight - window.innerHeight),
        S: mobile ? AREAS_STEP.mobile : AREAS_STEP.desktop,
        N: n,
      };
    };

    const positionNeedle = (k: number) => {
      const sr = stage.getBoundingClientRect();
      const dr = dial.getBoundingClientRect();
      // statik panel canlı panelle aynı dikdörtgendedir (sahne açıkken de DOM'da, opacity 0)
      const pr = dial.querySelector('.kod-panel')?.getBoundingClientRect() ?? dr;
      const mobile = !window.matchMedia('(min-width: 64rem)').matches;
      const dialLeft = pr.left;
      let x0: number;
      let y: number;
      if (mobile) {
        x0 = dr.left - sr.left; // mobil: panelin sol kenarına kısa iğne
        y = pr.top + pr.height / 2 - sr.top;
      } else {
        const name = section.querySelector<HTMLElement>(`[data-area-index="${k}"] .area-name`);
        if (!name) return;
        const hr = name.getBoundingClientRect();
        x0 = hr.right + 12 - sr.left;
        y = hr.top + hr.height / 2 - sr.top;
      }
      const w = Math.max(0, dialLeft - sr.left - x0);
      needle.style.setProperty('--needle-x', `${x0.toFixed(1)}px`);
      needle.style.setProperty('--needle-y', `${y.toFixed(1)}px`);
      needle.style.setProperty('--needle-w', w.toFixed(1));
    };

    const apply = (k: number, instant: boolean) => {
      if (k === cur || k < 0) return;
      cur = k;
      if (instant) {
        list.classList.add('is-instant');
        needle.classList.add('is-instant');
      }
      all('[data-area-desc]').forEach((d, i) => d.toggleAttribute('data-active', i === k));
      all('.kod-panel[data-kod-step]').forEach((p, i) => p.toggleAttribute('data-active', i === k));
      all('[data-area-step]').forEach((b, i) =>
        i === k ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'),
      );
      all('[data-area-seg]').forEach((s, i) => {
        s.toggleAttribute('data-done', i <= k);
        if (i === k) s.setAttribute('aria-current', 'step');
        else s.removeAttribute('aria-current');
      });
      const counter = section.querySelector('[data-areas-counter]');
      if (counter) counter.textContent = `${pad(k + 1)} / ${pad(n)}`;
      positionNeedle(k);
      if (instant)
        requestAnimationFrame(() => {
          void list.offsetHeight;
          list.classList.remove('is-instant');
          needle.classList.remove('is-instant');
        });
    };

    /** Odak bir açıklamanın içindeyse o adım kalır (§10.3.3 örtülmeme): adım kaydırması kesilse de odak gizlenmez */
    const focusedStep = (): number => {
      const d = (document.activeElement as Element | null)?.closest?.('[data-area-desc]');
      return d && section.contains(d) ? Number(d.getAttribute('data-area-desc')) : -1;
    };

    const compute = () => {
      raf = 0;
      if (!pinned || !geo) return;
      if (Number.isFinite(directorApi.areasStepY(0))) return; // director çalışıyor: areas:step olayları sahip
      if (performance.now() < lockUntil || focusedStep() >= 0) return;
      const y = window.scrollY;
      const instant = cur < 0 || Math.abs(y - lastY) > 1.5 * window.innerHeight;
      lastY = y;
      apply(areasIndexAt(geo, y), instant);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };

    /** Pin CSS kapısı + sığma (scrollHeight > clientHeight, fontlardan sonra) → liste modu (§4.8.8) */
    const pin = (on: boolean) => {
      setPinned(on);
      section.toggleAttribute('data-areas-pinned', on);
    };
    const check = () => {
      if (disposed) return;
      section.removeAttribute('data-areas-fit');
      const on = getComputedStyle(stage).position === 'sticky';
      if (on && text.scrollHeight > text.clientHeight + 1) {
        section.setAttribute('data-areas-fit', 'list');
        pin(false);
        return;
      }
      pin(on);
      if (!on) return;
      measureGeo();
      cur = -1;
      // düğmeler ve ilerleme render edildikten sonra: sığmayı yeniden ölç ve durumu uygula
      requestAnimationFrame(() => {
        if (disposed || !pinned) return;
        if (text.scrollHeight > text.clientHeight + 1) {
          section.setAttribute('data-areas-fit', 'list');
          pin(false);
          return;
        }
        compute();
        if (cur < 0) apply(areasIndexAt(geo, window.scrollY), true);
      });
    };

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(check, 150);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!pinned) return;
      const d = (e.target as Element | null)?.closest?.('[data-area-desc]');
      if (!d) return;
      const k = Number(d.getAttribute('data-area-desc'));
      if (k === cur) return;
      apply(k, true); // odaklanan öğe hiçbir an opacity 0 kalmaz: adım anında etkinleşir, sonra kaydırılır
      goToStep(k, { lock: true });
    };

    /** Odak açıklamalardan çıkınca adım kaydırma konumuna döner (director'ün son olayı ya da ölçülen geometri) */
    const onFocusOut = (e: FocusEvent) => {
      if (!pinned || performance.now() < lockUntil) return;
      const to = (e.relatedTarget as Element | null)?.closest?.('[data-area-desc]');
      if (to && section.contains(to)) return; // açıklamadan açıklamaya: focusin üstlenir
      const last = lastStageEvent('areas:step');
      const k = Number.isFinite(directorApi.areasStepY(0))
        ? (last?.index ?? cur)
        : geo
          ? areasIndexAt(geo, window.scrollY)
          : cur;
      if (k >= 0 && k !== cur) apply(k, false);
    };

    const offStep = onStageEvent('areas:step', (e) => {
      if (!pinned || performance.now() < lockUntil) return;
      const f = focusedStep();
      if (f >= 0 && f !== e.index) return;
      apply(e.index, e.instant);
    });
    const offRefresh = onStageEvent('refresh', () => {
      if (!pinned) return;
      measureGeo();
      positionNeedle(Math.max(cur, 0));
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    section.addEventListener('focusin', onFocusIn);
    section.addEventListener('focusout', onFocusOut);
    check();
    void document.fonts?.ready.then(check);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      section.removeEventListener('focusin', onFocusIn);
      section.removeEventListener('focusout', onFocusOut);
      offStep();
      offRefresh();
      setPinned(false);
      section.removeAttribute('data-areas-pinned');
      geo = null;
    };
  }, [sectionId, n, pref]);

  return null;
}
