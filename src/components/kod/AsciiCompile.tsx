'use client';
// src/components/kod/AsciiCompile.tsx — KOD "derleme" kaplaması (§4.9.4, §5.20.6): proje kapağı etkinleşince önce
// renkli ASCII olarak çözülür (yoğunluk = parlaklık, renk = görsel), sonra yukarıdan aşağı bir taramayla gerçek görsele
// "derlenir" (≈ 0.4 + 0.8 s). Kapak gerçek DOM görselidir (LCP, view transition morph'u, alt metin korunur); kaplama
// yalnız oynarken DOM'da duran bir canvas'tır. Tetik: work:active (instant değil), ≥ 64rem, tam hareket; görsel
// çözülmemişse çizilmez. Aynı anda tek kaplama: yenisi başlarken süren kaldırılır. Mobilde, azaltılmış harekette ve
// JS'siz yoktur.
import { useEffect, useRef } from 'react';
import { onStageEvent } from '@/stage/events';
import './kod-panel.css';

const RAMP = ' .:-=+*#%@';
const SCR = 'abcdefghijklmnopqrstuvwxyz0123456789{}[]()<>=+-*/;:_$#@&%?!';
const DECODE = 0.4;
const COMPILE = 0.8;
/** Hücre gecikmesi (s): satır sırasıyla, sözde rastgele; çözülme süresine sığar */
const delayOf = (j: number, v: number, index: number) =>
  (0.03 + 0.25 * v + 0.09 * hash(j * 1.37 + index * 17)) * (DECODE / 0.4);
const SCRAMBLE_S = 0.11;
/** Süren kaplamayı anında kaldırır (çakışma kuralı, §4.9.4) */
let stopCurrent: (() => void) | null = null;
const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};

function sample(img: HTMLImageElement, cols: number, rows: number): Uint8ClampedArray | null {
  try {
    const c = document.createElement('canvas');
    c.width = cols;
    c.height = rows;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, cols, rows);
    return g.getImageData(0, 0, cols, rows).data;
  } catch {
    return null; // görsel yüklenmedi ya da kaynak farklı
  }
}

export function AsciiCompile({ index }: { index: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current?.parentElement;
    const img = host?.querySelector('img');
    if (!host || !img) return;
    // canvas yalnız oynarken DOM'dadır (azaltılmış harekette, mobilde ve dinlenmede sayfada canvas yok, K-VAR-1)
    let cv: HTMLCanvasElement | null = null;
    let raf = 0;
    const stop = () => {
      cancelAnimationFrame(raf);
      cv?.remove();
      cv = null;
      if (stopCurrent === stop) stopCurrent = null;
    };
    const play = () => {
      if (document.documentElement.dataset.motion === 'reduce') return;
      if (!window.matchMedia('(min-width: 64rem)').matches) return;
      if (!img.complete || !img.naturalWidth) return; // görsel çözülmemiş: kaplama yok
      const r = host.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return;
      const cols = 96;
      const cw = r.width / cols;
      const rows = Math.max(8, Math.round(r.height / (cw * 2)));
      const ch = r.height / rows;
      const px = sample(img, cols, rows);
      if (!px) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      stopCurrent?.();
      stopCurrent = stop;
      cv = document.createElement('canvas');
      cv.className = 'ascii-compile';
      cv.setAttribute('aria-hidden', 'true');
      host.append(cv);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      const canvas = cv;
      const g = canvas.getContext('2d');
      if (!g) {
        stop();
        return;
      }
      // parlaklık aralığı normalize edilir (2. ve 98.5. yüzdelik): her kapakta tam yoğunluk merdiveni
      const n = cols * rows;
      const L = new Float32Array(n);
      for (let j = 0; j < n; j++)
        L[j] =
          (0.2126 * (px[j * 4] ?? 0) +
            0.7152 * (px[j * 4 + 1] ?? 0) +
            0.0722 * (px[j * 4 + 2] ?? 0)) /
          255;
      const sorted = Float32Array.from(L).sort();
      const lo = sorted[Math.floor(n * 0.02)] ?? 0,
        hi = sorted[Math.floor(n * 0.985)] ?? 1;
      const glyph = new Array<string>(n);
      const color = new Array<string>(n);
      for (let j = 0; j < n; j++) {
        const l = clamp(((L[j] ?? 0) - lo) / Math.max(0.05, hi - lo));
        glyph[j] =
          RAMP[Math.min(RAMP.length - 1, Math.round(Math.pow(l, 0.9) * (RAMP.length - 1)))] ?? ' ';
        const c = (q: number) =>
          Math.round(clamp(((px[j * 4 + q] ?? 0) / 255) * 1.12 + 0.05) * 255);
        color[j] = `rgb(${c(0)},${c(1)},${c(2)})`;
      }
      const cs = getComputedStyle(document.documentElement);
      const surface = cs.getPropertyValue('--color-surface').trim() || '#f7f8fa';
      const accent = cs.getPropertyValue('--color-accent').trim() || '#b0103c';
      const font = cs.getPropertyValue('--font-mono').trim() || 'monospace';
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.font = `500 ${Math.round(ch * 0.78)}px ${font}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      canvas.style.opacity = '1';
      const t0 = performance.now();
      const frame = (now: number) => {
        const t = (now - t0) / 1000;
        g.clearRect(0, 0, r.width, r.height);
        const cmp = clamp((t - DECODE) / COMPILE);
        for (let y = 0; y < rows; y++) {
          const v = y / rows;
          const k = smooth(cmp * 1.3 - v * 0.3); // derleme taraması: üst satırlar önce
          if (k >= 1) continue;
          const a = 1 - k;
          g.globalAlpha = a;
          g.fillStyle = surface;
          g.fillRect(0, y * ch, r.width, ch + 0.5);
          for (let x = 0; x < cols; x++) {
            const j = y * cols + x;
            const d = delayOf(j, v, index);
            let chr = glyph[j] ?? ' ';
            if (t < d - SCRAMBLE_S) continue; // henüz boş
            if (t < d)
              chr = SCR[Math.floor(hash(j * 3.17 + Math.floor(t * 15)) * SCR.length)] ?? ' ';
            if (chr === ' ') continue;
            g.fillStyle = t < d ? accent : (color[j] ?? '#000');
            g.fillText(chr, (x + 0.5) * cw, (y + 0.5) * ch);
          }
          if (cmp > 0 && cmp < 1 && k > 0.35 && k < 0.65) {
            g.globalAlpha = 0.85;
            g.fillStyle = accent;
            g.fillRect(0, y * ch + ch - 1.5, r.width, 1.5); // tarama cephesi
          }
        }
        g.globalAlpha = 1;
        if (cmp < 1) raf = requestAnimationFrame(frame);
        else stop();
      };
      raf = requestAnimationFrame(frame);
    };

    const off = onStageEvent('work:active', (e) => {
      if (e.index === index && !e.instant) play();
    });
    return () => {
      off();
      stop();
    };
  }, [index]);
  return <span ref={ref} hidden />;
}
