// src/stage/kod-atlas.ts — KOD glif atlası (§4 KOD). Çalışma zamanında canvas'a sitenin Martian Mono'su ile çizilir;
// kutu çizgileri, oklar, ✓, ● fontta olmadığından (ya da dikişsiz birleşmesi gerektiğinden) elle çizilir. Three-free:
// yalnız sahne chunk'ı kullanır.
import { DRAWN, GLYPHS } from '@/lib/kod/screen';

/** Atlas düzeni: 16 sütun; hücre 40 × 80 (oran 1 : 2) + 6 px kenar boşluğu (mipmap taşmasına karşı) */
export const ATLAS = (() => {
  const cols = 16,
    cw = 40,
    ch = 80,
    pad = 6;
  const rows = Math.ceil(GLYPHS.length / cols);
  const sw = cw + 2 * pad,
    sh = ch + 2 * pad;
  return { cols, rows, cw, ch, pad, sw, sh, W: cols * sw, H: rows * sh };
})();

type G = CanvasRenderingContext2D;

function drawGlyph(g: G, ch: string, x: number, y: number, w: number, h: number, p: number): void {
  const t = Math.max(2, Math.round(w * 0.11)),
    T = Math.round(t * 2);
  const cx = x + w / 2,
    cy = y + h / 2,
    L = x - p,
    R = x + w + p,
    U = y - p,
    D = y + h + p;
  const hl = (x0: number, x1: number, th = t) => g.fillRect(x0, cy - th / 2, x1 - x0, th);
  const vl = (y0: number, y1: number, th = t) => g.fillRect(cx - th / 2, y0, th, y1 - y0);
  g.lineWidth = t;
  g.lineCap = 'butt';
  g.lineJoin = 'miter';
  switch (ch) {
    case '─':
      hl(L, R);
      break;
    case '━':
      hl(L, R, T);
      break;
    case '│':
      vl(U, D);
      break;
    case '┃':
      vl(U, D, T);
      break;
    case '├':
      vl(U, D);
      hl(cx - t / 2, R);
      break;
    case '┤':
      vl(U, D);
      hl(L, cx + t / 2);
      break;
    case '└':
      vl(U, cy + t / 2);
      hl(cx - t / 2, R);
      break;
    case '┌':
      vl(cy - t / 2, D);
      hl(cx - t / 2, R);
      break;
    case '┐':
      vl(cy - t / 2, D);
      hl(L, cx + t / 2);
      break;
    case '┘':
      vl(U, cy + t / 2);
      hl(L, cx + t / 2);
      break;
    case '┬':
      hl(L, R);
      vl(cy - t / 2, D);
      break;
    case '┴':
      hl(L, R);
      vl(U, cy + t / 2);
      break;
    case '┼':
      hl(L, R);
      vl(U, D);
      break;
    case '╭':
    case '╮':
    case '╰':
    case '╯': {
      const right = ch === '╭' || ch === '╰',
        down = ch === '╭' || ch === '╮';
      g.beginPath();
      g.moveTo(right ? R : L, cy);
      g.arcTo(cx, cy, cx, down ? D : U, w / 2);
      g.lineTo(cx, down ? D : U);
      g.stroke();
      break;
    }
    case '→':
    case '←': {
      const dir = ch === '→' ? 1 : -1,
        tip = dir > 0 ? x + w * 0.9 : x + w * 0.1,
        hs = w * 0.34;
      if (dir > 0) hl(L, tip - t * 0.6);
      else hl(tip + t * 0.6, R);
      g.beginPath();
      g.moveTo(tip - dir * hs, cy - hs);
      g.lineTo(tip, cy);
      g.lineTo(tip - dir * hs, cy + hs);
      g.stroke();
      break;
    }
    case '✓':
      g.lineWidth = t * 1.3;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(x + w * 0.14, cy + h * 0.01);
      g.lineTo(x + w * 0.4, cy + h * 0.15);
      g.lineTo(x + w * 0.88, cy - h * 0.19);
      g.stroke();
      break;
    case '●':
      g.beginPath();
      g.arc(cx, cy, w * 0.3, 0, Math.PI * 2);
      g.fill();
      break;
    case '○':
      g.beginPath();
      g.arc(cx, cy, w * 0.27, 0, Math.PI * 2);
      g.stroke();
      break;
    case '█':
      g.fillRect(L, y + h * 0.18, R - L, h * 0.64);
      break;
    case '░':
      for (let yy = 0; yy < 6; yy++)
        for (let xx = 0; xx < 3; xx++)
          if ((xx + yy) % 2 === 0)
            g.fillRect(x + ((xx + 0.3) * w) / 3, y + h * 0.2 + yy * h * 0.1, w / 7, h * 0.05);
      break;
    case '▸':
      g.beginPath();
      g.moveTo(x + w * 0.3, cy - w * 0.3);
      g.lineTo(x + w * 0.8, cy);
      g.lineTo(x + w * 0.3, cy + w * 0.3);
      g.closePath();
      g.fill();
      break;
  }
}

/** Sitenin mono font ailesi (next/font değişkeni); bulunamazsa sistem monospace'i */
function monoFamily(): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--font-martian').trim();
    if (v) return `${v}, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  } catch {
    // SSR / test
  }
  return 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
}

/** Atlası çizer: font yüklenmesini en çok 3 s bekler, sonra yedek fontla devam eder. */
export async function buildAtlas(): Promise<HTMLCanvasElement> {
  const family = monoFamily();
  const F = 61;
  try {
    await Promise.race([
      document.fonts.load(`500 ${F}px ${family}`, 'AaÇçĞğİıÖöŞşÜü'),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch {
    // yedek font
  }
  const cv = document.createElement('canvas');
  cv.width = ATLAS.W;
  cv.height = ATLAS.H;
  const g = cv.getContext('2d');
  if (!g) return cv;
  g.font = `500 ${F}px ${family}`;
  try {
    g.fontStretch = 'semi-condensed';
  } catch {
    // eski tarayıcı
  }
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const adv = g.measureText('M').width || ATLAS.cw;
  const sx = Math.min(1, (ATLAS.cw * 0.98) / adv);
  const capH = g.measureText('H').actualBoundingBoxAscent || F * 0.72;
  const base = ATLAS.ch / 2 + capH / 2;
  GLYPHS.forEach((ch, k) => {
    const x0 = (k % ATLAS.cols) * ATLAS.sw + ATLAS.pad,
      y0 = Math.floor(k / ATLAS.cols) * ATLAS.sh + ATLAS.pad;
    if (DRAWN.includes(ch)) drawGlyph(g, ch, x0, y0, ATLAS.cw, ATLAS.ch, ATLAS.pad);
    else if (ch !== ' ') {
      g.save();
      g.translate(x0 + ATLAS.cw / 2, y0 + base);
      g.scale(sx, 1);
      g.fillText(ch, 0, 0);
      g.restore();
    }
  });
  return cv;
}
