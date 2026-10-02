// src/stage/debug.tsx — ?debug paneli ve kontrast probu (§5.18). YALNIZ ?debug ile dinamik yüklenir (ilk pakete
// girmez). Three-free: WebGL'e yalnız sahnenin canvas'ı üzerinden (readPixels) dokunur. store.debug canvas mount'undan
// ÖNCE yazılır → preserveDrawingBuffer: true (prob için). window.__stage testlerin readStage() kancasıdır (§13.3.2).
import { themeColors, type ThemeName } from '@/design/tokens';
import { PROFILES, type Persona } from '@/experience/profile';
import { live, rendered, stageStore, stageTarget } from './store';

export interface ContrastItem {
  selector: string;
  text: string;
  ratio: number;
  threshold: number;
}
export interface ContrastReport {
  scrollY: number;
  theme: ThemeName;
  checked: number;
  failures: ContrastItem[];
  worst: ContrastItem | null;
}

type Rgb = readonly [number, number, number];

const hexRgb = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const cssRgb = (c: string): Rgb => {
  const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0];
};
const lum = ([r, g, b]: Rgb) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: Rgb, b: Rgb) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
const selectorOf = (el: Element) => {
  // SVG'de className SVGAnimatedString'dir: sınıf öznitelikten okunur
  const cls = el.getAttribute('class')?.trim().split(/\s+/)[0];
  return el.id ? `#${el.id}` : `${el.localName}${cls ? `.${cls}` : ''}`;
};

/**
 * §5.18.2: KOD panelinin dikdörtgeniyle kesişen metin öğelerinin arkasındaki canvas pikselleri okunur (tek readPixels,
 * 8×4 örnek), --scene-opacity ile çarpılıp sayfa rengine bindirilir, metin rengiyle WCAG oranı hesaplanır.
 */
export async function probeContrast(persona: Persona = 'engineer'): Promise<ContrastReport> {
  const theme: ThemeName = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const report: ContrastReport = {
    scrollY: window.scrollY,
    theme,
    checked: 0,
    failures: [],
    worst: null,
  };
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const layer = document.getElementById('scene-layer');
  const canvas = layer?.querySelector('canvas');
  const gl = canvas?.getContext('webgl2');
  const s = live.panel;
  if (!layer || !canvas || !gl || !s.visible || s.w <= 0) return report;
  const dpr = canvas.width / Math.max(1, canvas.clientWidth);
  const sceneOpacity = Number.parseFloat(getComputedStyle(layer).opacity) || 0;
  const page = hexRgb(themeColors(PROFILES[persona].palette, theme).canvas);
  const box = { x0: s.x, y0: s.y, x1: s.x + s.w, y1: s.y + s.h };
  const main = document.getElementById('main');
  if (!main) return report;
  for (const el of main.querySelectorAll<HTMLElement>('*')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
    if (!own || el.closest('[aria-hidden="true"], .sr-only')) continue;
    // ata opaklığı da sayılır: crossfade'de gizlenen çapa figürlerinin metni denetlenmez
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0) continue;
    const x0 = Math.max(box.x0, r.left);
    const y0 = Math.max(box.y0, r.top);
    const x1 = Math.min(box.x1, r.right);
    const y1 = Math.min(box.y1, r.bottom);
    if (x1 <= x0 || y1 <= y0) continue;
    const w = Math.max(1, Math.round((x1 - x0) * dpr));
    const h = Math.max(1, Math.round((y1 - y0) * dpr));
    const px = new Uint8Array(w * h * 4);
    const yGl = canvas.height - Math.round(y1 * dpr);
    gl.readPixels(Math.round(x0 * dpr), yGl, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const text = cssRgb(cs.color);
    const size = Number.parseFloat(cs.fontSize);
    const bold = Number.parseInt(cs.fontWeight, 10) >= 700;
    const threshold = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    let worst = Infinity;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 4; j++) {
        const sx = Math.min(w - 1, Math.floor(((i + 0.5) / 8) * w));
        const sy = Math.min(h - 1, Math.floor(((j + 0.5) / 4) * h));
        const k = (sy * w + sx) * 4;
        const a = ((px[k + 3] ?? 0) / 255) * sceneOpacity;
        // önceden çarpılmış RGBA: c = src·opaklık + sayfa·(1 − a)
        const c: Rgb = [0, 1, 2].map(
          (ch) => (px[k + ch] ?? 0) * sceneOpacity + (page[ch] ?? 0) * (1 - a),
        ) as unknown as Rgb;
        worst = Math.min(worst, ratio(text, c));
      }
    }
    report.checked++;
    const item = {
      selector: selectorOf(el),
      text: el.textContent?.trim().slice(0, 40) ?? '',
      ratio: Math.round(worst * 100) / 100,
      threshold,
    };
    if (!report.worst || item.ratio < report.worst.ratio) report.worst = item;
    if (worst < threshold) {
      report.failures.push(item);
      console.warn(`kontrast ${item.ratio} < ${threshold}: ${item.selector} "${item.text}"`);
    }
  }
  return report;
}

/* ───────────── panel ───────────── */

const fmt = (v: unknown) =>
  typeof v === 'number' ? (Math.round(v * 1000) / 1000).toString() : String(v);

export function mountDebug(persona: Persona = 'engineer'): void {
  stageStore.setState({ debug: true }); // canvas mount'undan ÖNCE (preserveDrawingBuffer)
  (window as unknown as { __stage: unknown }).__stage = {
    store: stageStore,
    target: stageTarget,
    rendered,
    live,
    probeContrast: () => probeContrast(persona),
  };
  const panel = document.createElement('div');
  panel.setAttribute('data-stage-debug', '');
  panel.setAttribute('aria-hidden', 'true');
  panel.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:9999;max-height:60vh;overflow:auto;padding:8px;font:11px/1.35 ui-monospace,monospace;background:rgb(0 0 0/.78);color:#e8ebf2;border-radius:6px;pointer-events:auto;max-width:340px';
  const out = document.createElement('pre');
  out.style.margin = '0';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px';
  const button = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'font:inherit;padding:2px 6px;background:#252e52;color:inherit;border:0;border-radius:4px';
    b.addEventListener('click', fn);
    actions.append(b);
  };
  const lose = () =>
    document
      .querySelector<HTMLCanvasElement>('#scene-layer canvas')
      ?.getContext('webgl2')
      ?.getExtension('WEBGL_lose_context');
  /**
   * Kare süresi (§9.1 P17, §9.6 cihaz turu): rig'in art arda iki karede çizdiği rAF aralıkları (son 600). Kaydırma
   * sırasında p95 okunur; "kare sıfırla" ölçümü baştan başlatır.
   */
  const deltas: number[] = [];
  button('kare sıfırla', () => {
    deltas.length = 0;
  });
  button('duraklat', () => stageStore.getState().setPaused(!stageStore.getState().paused));
  button('bağlamı kaybet', () => lose()?.loseContext());
  button('geri yükle', () => lose()?.restoreContext());
  button('kontrast', () => void probeContrast(persona).then((r) => console.table(r.failures)));
  button('hot reload’u oynat', () => {
    live.kod.replayHot = true;
    stageStore.getState().invalidate();
  });
  for (const t of ['static', 'low', 'medium', 'high'])
    button(`tier=${t}`, () => {
      const u = new URL(window.location.href);
      u.searchParams.set('tier', t);
      window.location.assign(u);
    });
  panel.append(out, actions);
  document.body.append(panel);

  const keys = ['anchorFrom', 'anchorTo', 'anchorMix', 'opacityTrack', 'opacityCut'] as const;
  let lastT = 0;
  let lastFrames = live.frames;
  let rendering = false;
  const tick = (t: number) => {
    const drew = live.frames !== lastFrames;
    if (drew && rendering && lastT > 0) {
      deltas.push(t - lastT);
      if (deltas.length > 600) deltas.shift();
    }
    rendering = drew;
    lastFrames = live.frames;
    lastT = t;
    const sorted = [...deltas].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const mean = sorted.reduce((n, d) => n + d, 0) / (sorted.length || 1);
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    const ready = performance.getEntriesByName('os:stage-ready', 'mark')[0]?.startTime;
    const s = stageStore.getState();
    const q = s.quality;
    const sig = s.signals;
    const lines = [
      `phase ${s.phase} · tier ${s.tier} (${s.tierReason ?? '—'}) · preset ${s.preset}`,
      `paused ${s.paused} · loop ${s.loop} · losses ${s.contextLosses}`,
      q ? `dpr ${q.dpr} · süzülme/paralaks ${q.motion}` : 'quality —',
      `gpu ${sig?.gpu ? `${sig.gpu.type}/${sig.gpu.tier} ${sig.gpu.name ?? ''}` : '—'}${sig?.software ? ' · yazılım render' : ''}`,
      `yoklama cores ${sig?.cores ?? '—'} · mem ${sig?.deviceMemory ?? '—'} · ${sig?.coarse ? 'kaba' : 'ince'} işaretçi · cihaz dpr ${window.devicePixelRatio}`,
      `kare p95 ${p95 === undefined ? '—' : `${p95.toFixed(1)} ms`} · ort ${sorted.length ? `${mean.toFixed(1)} ms` : '—'} · n ${sorted.length}`,
      `stage-ready − load ${ready !== undefined && nav ? `${Math.round(ready - nav.loadEventStart)} ms` : '—'}`,
      `program ${live.kod.key || '—'} · köprü ${fmt(live.kod.mix)} · donuk ${live.kod.frozen} · hot ${live.kod.hot}`,
      `panel ${fmt(live.panel.x)},${fmt(live.panel.y)} ${fmt(live.panel.w)}×${fmt(live.panel.h)} ${live.panel.visible ? '' : '(gizli)'}`,
      `anchors ${live.anchors.map((a) => a.id).join(' ')}`,
      ...keys.map(
        (k) => `${k.padEnd(10)} ${fmt(stageTarget[k]).padStart(8)} → ${fmt(rendered[k])}`,
      ),
    ];
    out.textContent = lines.join('\n');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
