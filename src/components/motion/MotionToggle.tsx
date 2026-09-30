'use client';
// src/components/motion/MotionToggle.tsx — "Hareketi azalt" anahtarı (§4.16.4, §10.2.2, §6.6.4).
// <button aria-pressed>; etiket sabit, durum aria-pressed ile. localStorage['os-motion'] (D-38, try/catch),
// <html data-motion> ve os-motion-change yazılır; tam ↔ azaltılmış geçişi canlıdır (≤ 1 s) ve görüntü alanının
// üstündeki bölüm korunur [SABİT] #17. Görsel durum CSS'te html[data-motion]'dan okunur (hidrasyon öncesi de doğru).
// JS yoksa çalışamayacağı için gizlidir (js: varyantı).
import { useEffect, type ReactNode } from 'react';
import { HYDRATED_ATTR, PREF_EVENTS, STORAGE_KEYS } from '@/lib/head-script';
import { useMotionPref, type MotionPref } from './motion-pref';

interface ScrollAnchor {
  chapter: Element | null;
  offset: number;
  y: number;
}

/** Görüntü alanının üstündeki bölüm ve o bölüme göre kaydırma payı (başlık yüksekliği kadar aşağıdan). */
function captureAnchor(): ScrollAnchor {
  const top = document.querySelector('body > header')?.getBoundingClientRect().bottom ?? 0;
  const chapters = document.querySelectorAll('#main [data-chapter]');
  for (const c of chapters) {
    const r = c.getBoundingClientRect();
    if (r.top <= top + 1 && r.bottom > top + 1)
      return { chapter: c, offset: top - r.top, y: window.scrollY };
  }
  return { chapter: null, offset: 0, y: window.scrollY };
}

function restoreAnchor(a: ScrollAnchor) {
  if (!a.chapter?.isConnected) return;
  const top = document.querySelector('body > header')?.getBoundingClientRect().bottom ?? 0;
  const r = a.chapter.getBoundingClientRect();
  const offset = Math.min(a.offset, Math.max(0, r.height - 1));
  const y = window.scrollY + r.top + offset - top;
  if (Math.abs(y - window.scrollY) > 1) window.scrollTo({ top: y, behavior: 'instant' });
}

export function setMotionPref(next: MotionPref): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.motion, next);
  } catch {
    // depolama kapalı: tercih yalnız bu sayfada geçerli (D-38)
  }
  // P8 (≤ 100 ms, §9.1): geçiş (reveal/Lenis/ScrollTrigger kurulum-sökümü, sahne, pin düzeni) tıklamanın boyamasından
  // sonraki göreve ertelenir; eşzamanlı hâli tıklama görevini 4× CPU kısıtında 120–200 ms'ye uzatıyordu. Öznitelik ve
  // olay aynı görevde kalır: pin düzeni değişince doğan kaydırma olayı sönmüş Lenis'e ulaşmaz (aksi hâlde Lenis'in
  // bekleyen isScrolling zamanlayıcısı destroy()'dan sonra html'e `lenis` sınıfını geri yazıyordu).
  requestAnimationFrame(() =>
    setTimeout(() => {
      const anchor = captureAnchor();
      document.documentElement.setAttribute('data-motion', next);
      window.dispatchEvent(new Event(PREF_EVENTS.motion));
      // düzen (pin yükseklikleri) değişti: iki kare sonra aynı bölüme geri konumla
      requestAnimationFrame(() => requestAnimationFrame(() => restoreAnchor(anchor)));
    }, 0),
  );
}

export function MotionToggle({
  label,
  className,
  markHydrated,
}: {
  label: ReactNode;
  className?: string;
  /**
   * SPEC-SAPMA: §8.4.4 — global-not-found'da MotionRoot yoktur; data-hydrated yazılmazsa head script js sınıfını
   * 4 s sonra kaldırır ve js: ile açılan bu anahtar kaybolurdu. Orada hidrasyon işaretini anahtar yazar.
   */
  markHydrated?: boolean;
}) {
  const pref = useMotionPref();
  const reduce = pref === 'reduce';
  useEffect(() => {
    if (markHydrated) document.documentElement.setAttribute(HYDRATED_ATTR, '');
  }, [markHydrated]);
  return (
    <button
      type="button"
      aria-pressed={reduce}
      onClick={() => setMotionPref(reduce ? 'full' : 'reduce')}
      className={[
        'group hidden min-h-11 items-center gap-3 type-ui text-ink-muted hover:text-ink js:inline-flex',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        aria-hidden="true"
        className="relative [display:inline-block] h-5 w-9 shrink-0 rounded-pill border border-line-strong forced-colors:border-[CanvasText] motion-off:border-ink motion-off:bg-ink"
      >
        <span className="absolute top-1/2 left-0.5 [display:inline-block] size-3.5 -translate-y-1/2 rounded-pill bg-ink transition-transform duration-(--dur-base) ease-(--ease-standard) forced-colors:bg-[CanvasText] motion-off:translate-x-4 motion-off:bg-canvas" />
      </span>
      {label}
    </button>
  );
}
