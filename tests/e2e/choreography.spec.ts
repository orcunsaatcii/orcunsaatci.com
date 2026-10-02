// tests/e2e/choreography.spec.ts — ana sayfa koreografisi, KOD (§4.12, §13.3.4, §13.3.5): K-CHOREO-3/4/5/6/7, I2, I3,
// K-GEN-2/9, K-ABOUT-1/2/3, K-AREAS-3/4/5/6, K-WORK-1/2/3, K-JOURNEY-2/3/7, K-CONTACT-3/5, V-48. KESİT'in taş değerleri
// (kamera, cut, rotY, bant, ışık, taş dairesi) ve piksel karşılaştırmaları KOD ile kalktı (§15.8a): panel ?debug
// çıktısından okunur — program anahtarı ve köprü ilerlemesi (live.kod), panelin eğimsiz ekran dikdörtgeni (live.panel),
// çapa çifti ve opaklık çarpanları (stageTarget.anchorFrom/To/Mix, opacityTrack/Cut). Canlı paneli okuyan testler
// /?debug&tier=high (mobil medium) ile koşar; her okumadan önce rig o kaydırmada bir kare çizer. Sahne sönükken (döngü
// never: work, mobil bantlar arası) kare yoktur, panel "yok" sayılır. Yalnız DOM olaylarını ve reveal'ları okuyanlar
// tier=static. Beklenen kaydırma konumları DOM'dan ölçülen düzenden hesaplanır (§13.3.4): §4.12.1'in s değerleri 1170
// svh'lik referans düzendir; her satır (bölüm, faz, yerel p) olarak eşlenir, y = faz.y0 + p·(faz.y1 − faz.y0) (§5.9.3).
// Zaman ölçümleri kare hızından bağımsız okunur: "X ms'den sonra eşiğin öbür yanında YAZIM yok" (--scene-opacity stil
// yazımları ve kare örnekleri kaydedilir; CI'da SwiftShader ≈ 2 fps). Ham süreler ayrıca ek açıklamalara yazılır.
// Bekleme sayfa içindedir (waitForTimeout YASAK). Uyumsuzluklar expect.soft ile toplanır: tek koşu bütün sapmaları listeler.
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { readingScroll, settle } from './helpers/scroll';
import { pageDelay, waitForStagePhase } from './helpers/stage';

test.describe.configure({ timeout: 180_000 }); // §13.3.4: yavaş dosya, test başına 180 s

const HOME = '/?debug&tier=high';
const HOME_MOBILE = '/?debug&tier=medium'; // mobil mutlu yol (§13.3.3)
/**
 * Yalnız DOM olaylarını ve reveal'ları okuyan testler: director kademeden bağımsızdır, canvas gerekmez.
 * SPEC-SAPMA §13.3.4 (M6): WebGL'siz koşarlar; CI'da SwiftShader ≈ 2 fps her kaydırma adımını ≈ 0.5 s'ye çıkarıyor,
 * reveal zamanlamalarını kare aralığının altında ölçülemez kılıyor ve dosyayı iş süresine sığdırmıyordu.
 */
const HOME_TARGET = '/?debug&tier=static';

/**
 * Köprüler (§4.12.1, §4.12.4 #24): IN fazlarındaki anchorMix track'leri (masaüstü); end köprünün bittiği yerel p. vis
 * sahnenin göründüğü kısımdır: masaüstünde sahne work IN p 0.2–0.5'te söner, journey IN p 0.3–0.6'da belirir (K-WORK-6).
 */
const BRIDGES = [
  { chapter: 'about', from: 'hero-rest', to: 'about-cut', end: 0.6, vis: [0, 0.6] },
  { chapter: 'areas', from: 'about-cut', to: 'areas-dial', end: 0.7, vis: [0, 0.7] },
  { chapter: 'work', from: 'areas-dial', to: 'work-specimen', end: 0.8, vis: [0, 0.45] },
  { chapter: 'journey', from: 'work-specimen', to: 'journey-core', end: 0.7, vis: [0.35, 0.7] },
  { chapter: 'contact', from: 'journey-core', to: 'contact-ring', end: 0.5, vis: [0, 0.5] },
] as const;
type Bridge = (typeof BRIDGES)[number];
/** about.dart'ın anahtarı açılan blok oranını taşır (about:0.25 … about:1) */
const ABOUT_KEY = 'about:[\\d.]+';

/* ───────────── türler ───────────── */

type PhaseKind = 'in' | 'body';
interface PhaseRange {
  chapter: string;
  phase: PhaseKind;
  y0: number;
  y1: number;
}
interface Measured {
  vh: number;
  maxScroll: number;
  mobile: boolean;
  chapters: { id: string; top: number; height: number }[];
  phases: PhaseRange[];
  /** "top 55%" çizgileri, belge px (§5.9.5) */
  activation: { work: number[]; journey: number[] };
  areas: { bodyY0: number; bodyLen: number; S: number; N: number } | null;
  heroExit: number;
  counts: { N: number; P: number; E: number };
}
interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}
interface StageData {
  projects: { slug: string }[];
  kod?: { email: string };
}
/** window.__stage (§5.18.1, yalnız ?debug) */
interface DebugStage {
  store: { getState(): { invalidate(): void; loop: string; data: unknown } };
  target: Record<string, number>;
  live: {
    panel: PanelRect;
    kod: { key: string; mix: number };
    frames: number;
    anchors: readonly { id: string }[];
    layout?: {
      phases: PhaseRange[];
      activation: { work: number[]; journey: number[] };
    } | null;
  };
}
type StageWindow = Window & { __stage: DebugStage };
/** Bir kaydırma konumunda rig'in son karesi (§5.20.4) ve yönetmenin çapa çifti */
interface KodState {
  y: number;
  /** --scene-opacity (hesaplanmış) */
  opacity: number;
  /** panel ekranda: sahne opaklığı > 0.01 ve plaka görünür */
  shown: boolean;
  /** görünen program ("A>B" köprüde) ve köprü ilerlemesi */
  key: string;
  mix: number;
  panel: PanelRect;
  anchor: { from: string; to: string; mix: number; at: string };
}

/* ───────────── yardımcılar: sayfa, düzen, okuma ───────────── */

const fmt = (v: number | undefined) =>
  v === undefined ? '—' : String(Math.round(v * 1000) / 1000);
const svh = (m: Measured, y: number) => (y / m.vh) * 100;
const pad = (x: number) => String(x).padStart(2, '0');
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rectStr = (r: PanelRect) =>
  `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)}`;
/** İki panel dikdörtgeninin en büyük kenar farkı (px) */
const rectDiff = (a: PanelRect, b: PanelRect) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));

/** Raporlama: ölçülen sayılar test ek açıklamasına ve stdout'a yazılır (PR / KOD ayar notları için) */
function note(info: TestInfo, type: string, data: unknown): void {
  const description = typeof data === 'string' ? data : JSON.stringify(data);
  info.annotations.push({ type, description });
  console.log(`[koreografi] ${type}: ${description}`);
}

/** Ana sayfa: sahne ready, reveal motoru kurulu; ?debug paneli sol altta tıklamaları yutmasın diye gizlenir */
async function openHome(page: Page, url = HOME): Promise<void> {
  await page.goto(url);
  await ready(page);
}
async function ready(page: Page): Promise<void> {
  const staticTier = new URL(page.url()).searchParams.get('tier') === 'static';
  await waitForStagePhase(page, [staticTier ? 'fallback' : 'ready'], 30_000);
  await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
  await page.evaluate(() =>
    document.querySelector<HTMLElement>('[data-stage-debug]')?.style.setProperty('display', 'none'),
  );
  await settle(page);
  await cutDone(page);
}

/**
 * §5.9.3 fazları, "top 55%" aktivasyon çizgileri, areas pin geometrisi ve heroExit; tracks.ts measureLayout tanımıyla
 * DOM'dan bağımsız hesaplanır. §4.5.2 sayımları (N, P, E) da döner.
 */
async function measure(page: Page): Promise<Measured> {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    const mobile = !window.matchMedia('(min-width: 64rem)').matches;
    const clamp = (y: number) => Math.min(Math.max(y, 0), maxScroll);
    const docTop = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
    const chapters = [...document.querySelectorAll<HTMLElement>('#main [data-chapter]')].map(
      (el) => ({ id: el.dataset.chapter ?? '', top: docTop(el), height: el.offsetHeight }),
    );
    const phases = chapters
      .filter((c) => c.id !== 'hero')
      .flatMap((c) => [
        { chapter: c.id, phase: 'in' as const, y0: clamp(c.top - vh), y1: clamp(c.top) },
        {
          chapter: c.id,
          phase: 'body' as const,
          y0: clamp(c.top),
          y1: clamp(Math.max(c.top, c.top + c.height - vh)),
        },
      ]);
    // Düzen konumu: journey girdileri kendileri [data-reveal="block"]'tır; açılmadan önce translateY(16px) taşır, o
    // dönüşüm çıkarılır (getBoundingClientRect dönüşümü içerir)
    const ownY = (el: Element) => {
      const t = getComputedStyle(el).transform;
      return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m42;
    };
    const line = (el: Element) => docTop(el) - ownY(el) - 0.55 * vh;
    const areasEl = document.querySelector<HTMLElement>('[data-chapter="areas"]');
    const stage = areasEl?.querySelector<HTMLElement>('[data-areas-stage]');
    const N = Number(areasEl?.dataset.areasN);
    const body = phases.find((p) => p.chapter === 'areas' && p.phase === 'body');
    const aboutIn = phases.find((p) => p.chapter === 'about' && p.phase === 'in');
    const pinned = !!stage && getComputedStyle(stage).position === 'sticky';
    return {
      vh,
      maxScroll,
      mobile,
      chapters,
      phases,
      activation: {
        work: [
          ...document.querySelectorAll('[data-chapter="work"] article[data-work-article]'),
        ].map(line),
        journey: [
          ...document.querySelectorAll('[data-chapter="journey"] [data-journey-entry]'),
        ].map(line),
      },
      areas:
        pinned && body && N >= 3 && N <= 6
          ? { bodyY0: body.y0, bodyLen: body.y1 - body.y0, S: mobile ? 40 : 50, N }
          : null,
      heroExit: aboutIn ? aboutIn.y0 + 0.3 * (aboutIn.y1 - aboutIn.y0) : 0,
      counts: {
        N,
        P: document.querySelectorAll('[data-work-article]').length,
        E: document.querySelectorAll('[data-journey-entry]').length,
      },
    };
  });
}

/** Yönetmenin ölçtüğü düzen (live.layout kancası varsa) DOM ölçümüyle ±1 px aynı olmalı */
async function crossCheckLayout(page: Page, m: Measured, info: TestInfo): Promise<void> {
  const d = await page.evaluate(
    () => (window as unknown as StageWindow).__stage.live.layout ?? null,
  );
  if (!d) {
    note(info, 'live.layout', 'kanca yok; düzen yalnız DOM ölçümünden');
    return;
  }
  for (const p of m.phases) {
    const q = d.phases.find((x) => x.chapter === p.chapter && x.phase === p.phase);
    expect.soft(q, `live.layout fazı ${p.chapter} ${p.phase}`).toBeTruthy();
    if (!q) continue;
    expect.soft(Math.abs(q.y0 - p.y0), `${p.chapter} ${p.phase} y0`).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(q.y1 - p.y1), `${p.chapter} ${p.phase} y1`).toBeLessThanOrEqual(1);
  }
  for (const k of ['work', 'journey'] as const)
    m.activation[k].forEach((y, i) =>
      expect
        .soft(Math.abs((d.activation[k][i] ?? Number.NaN) - y), `live.layout ${k} çizgisi ${i}`)
        .toBeLessThanOrEqual(1),
    );
}

async function stageData(page: Page): Promise<StageData> {
  return page.evaluate(
    () => (window as unknown as StageWindow).__stage.store.getState().data as StageData,
  );
}

/**
 * Rig'in geçerli kaydırmada en az bir kare çizmesini bekler: live.panel ve live.kod o karenin çıktısıdır (kare başına
 * yazılır). Döngü 'never' (sahne sönük) ya da canlı sahne yoksa kare çizilmez, beklenmez.
 */
async function freshFrame(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const st = (window as unknown as StageWindow).__stage;
    const phase = document.getElementById('scene-layer')?.dataset.phase;
    if (phase !== 'ready' || st.store.getState().loop === 'never') return false;
    const f0 = st.live.frames;
    st.store.getState().invalidate();
    const t0 = performance.now();
    while (st.live.frames === f0) {
      if (performance.now() - t0 > 15_000) throw new Error('kare: 15 s içinde çizilmedi');
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
    return true;
  });
}

/** Rig'in bu kaydırmada çizdiği kare (program, köprü, panel dikdörtgeni) ve yönetmenin çapa çifti (live.anchors kimlikleri) */
async function kodAt(page: Page): Promise<KodState> {
  await freshFrame(page);
  return page.evaluate(() => {
    const st = (window as unknown as StageWindow).__stage;
    const layer = document.getElementById('scene-layer');
    const opacity = layer ? Number.parseFloat(getComputedStyle(layer).opacity) : 0;
    const ids = st.live.anchors.map((a) => a.id);
    // −1 sanal (route glide), −2 ölçülmemiş / eksik çapa (§5.7.4)
    const id = (i: number | undefined) =>
      i === undefined ? '?' : i === -1 ? 'sanal' : i < 0 ? 'yok' : (ids[i] ?? `#${i}`);
    const t = st.target;
    const from = id(t.anchorFrom);
    const to = id(t.anchorTo);
    const mix = t.anchorMix ?? 0;
    const panel = { ...st.live.panel };
    return {
      y: window.scrollY,
      opacity,
      shown: opacity > 0.01 && panel.visible,
      key: st.live.kod.key,
      mix: st.live.kod.mix,
      panel,
      anchor: { from, to, mix, at: mix >= 0.999 ? to : mix <= 0.001 ? from : `${from}→${to}` },
    };
  });
}

/** Süren kesme (sönme, oturma, belirme) bitene kadar bekler: opacityCut 1 (§5.9.7) */
async function cutDone(page: Page): Promise<void> {
  await page.waitForFunction(
    () => ((window as unknown as Partial<StageWindow>).__stage?.target.opacityCut ?? 1) >= 0.999,
    null,
    { timeout: 15_000 },
  );
}

/** Anında y'ye kaydırır (1.5·vh'den uzunsa kesme, §5.9.7) ve sahne durulana kadar bekler */
async function jumpTo(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.round(y));
  await settle(page);
  await cutDone(page);
}

/**
 * "Kaydırarak gelir": kesme eşiğinin (tek güncellemede 1.5·vh, §5.9.7) altında adımlarla ilerler, her adımdan sonra iki
 * kare bekler (yönetmen güncellemesi, olaylar); sonda durulur.
 */
async function stepTo(page: Page, y: number, stepVh = 0.5, quiet = true): Promise<void> {
  await page.evaluate(
    async ({ target, frac }) => {
      const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      const step = frac * window.innerHeight;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const goal = Math.min(Math.max(0, target), max);
      let y = window.scrollY;
      while (Math.abs(goal - y) > 0.5) {
        y = goal > y ? Math.min(goal, y + step) : Math.max(goal, y - step);
        window.scrollTo({ top: y, behavior: 'instant' });
        await frame();
        await frame();
      }
    },
    { target: Math.round(y), frac: stepVh },
  );
  // quiet = false: olay tween'leri beklenmez (panel dikdörtgeni yalnız çapa çiftine ve kaydırmaya bağlıdır)
  if (quiet) await settle(page);
}

/**
 * Tekerlekle (Lenis) okuma hızında aşağı kaydırır: ortalama svhPerS (varsayılan 10 svh/s, §13.3.2). Olaylar ~50 ms
 * aralıkla gönderilir; hız duvar saatine göre tutulur. Sonda Lenis'in yetişmesi beklenir.
 */
async function wheelTo(page: Page, y: number, svhPerS = 10): Promise<void> {
  const s = await page.evaluate(() => ({
    y0: window.scrollY,
    vh: window.innerHeight,
    max: document.documentElement.scrollHeight - window.innerHeight,
  }));
  const goal = Math.min(y, s.max);
  const total = Math.round(goal - s.y0);
  const pxPerMs = (svhPerS * s.vh) / 100 / 1000;
  const t0 = Date.now();
  let sent = 0;
  while (sent < total) {
    const dy = Math.min(total, Math.round((Date.now() - t0) * pxPerMs)) - sent;
    if (dy > 0) {
      await page.mouse.wheel(0, dy);
      sent += dy;
    }
    await pageDelay(page, 50);
  }
  await page
    .waitForFunction((g) => window.scrollY >= g - 2, goal, { timeout: 10_000 })
    .catch(() => {}); // Lenis hedefi kırptıysa son konum aşağıda raporlanır
  await settle(page);
}

/* ───────────── beklenen konumlar ve programlar (§4.12.1, §5.9.3–§5.9.5) ───────────── */

function phaseOf(m: Measured, chapter: string, phase: PhaseKind): PhaseRange {
  const r = m.phases.find((p) => p.chapter === chapter && p.phase === phase);
  if (!r) throw new Error(`faz yok: ${chapter} · ${phase}`);
  return r;
}
/** Fazın yerel ilerlemesi p (fazın dışında < 0 ya da > 1) */
const pOf = (r: PhaseRange, y: number) => (y - r.y0) / Math.max(1, r.y1 - r.y0);
const yAt = (m: Measured, chapter: string, phase: PhaseKind, p: number) => {
  const r = phaseOf(m, chapter, phase);
  return r.y0 + p * (r.y1 - r.y0);
};
/** Bölümün kaydırma aralığı: IN başı → BODY sonu (hero: 0 → heroExit) */
function chapterRange(m: Measured, id: string): [number, number] {
  if (id === 'hero') return [0, m.heroExit];
  return [phaseOf(m, id, 'in').y0, phaseOf(m, id, 'body').y1];
}
/** Çizgisini geçtiği son girdinin indeksi; hiçbiri değilse −1 (§5.9.5) */
const indexAt = (lines: readonly number[], y: number) => lines.filter((l) => l <= y).length - 1;
/** areas BODY'nin soyut ekseninde ofs svh → belge y (§5.9.4: L = 20 + S·N, p = ofs / L) */
function areasY(m: Measured, ofs: number): number {
  const a = m.areas;
  if (!a) throw new Error('areas pin yok (liste modu)');
  return a.bodyY0 + (ofs / (20 + a.S * a.N)) * a.bodyLen;
}
/** Belge y → areas adımı: ofs ≥ 10 + S·k + 0.15·S olan en büyük k ≥ 1, yoksa 0 (events.ts areasIndexAt tanımı) */
function areasStepAt(m: Measured, y: number): number {
  const a = m.areas;
  if (!a || y < a.bodyY0) return 0;
  const L = 20 + a.S * a.N;
  const ofs = a.bodyLen > 0 ? ((y - a.bodyY0) / a.bodyLen) * L : L;
  let k = 0;
  for (let i = 1; i < a.N; i++) if (ofs >= 10 + a.S * i + 0.15 * a.S) k = i;
  return k;
}
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
/**
 * Masaüstü --scene-opacity beklentisi (opacityTrack; kesme ve okuma çarpanları 1): work IN p 0.2–0.5'te 1 → 0, journey
 * IN p 0.3–0.6'da 0 → 1 (§4.12.4 #6, K-WORK-6: work'te panel yok)
 */
function sceneOpacityAt(m: Measured, y: number): number {
  const j = phaseOf(m, 'journey', 'in');
  if (y >= j.y0) return smooth((pOf(j, y) - 0.3) / 0.3);
  return 1 - smooth((pOf(phaseOf(m, 'work', 'in'), y) - 0.2) / 0.3);
}

interface Want {
  /** etkin çapa deseni (RegExp kaynağı); köprüde "A→B" */
  anchor: string;
  /** program anahtarı deseni (RegExp kaynağı); null = panel yok (sahne sönük) */
  key: string | null;
  /** beklenen --scene-opacity */
  opacity: number;
}
interface Row {
  id: string;
  label: string;
  y0: number;
  y1: number;
  want: (y: number) => Want;
}

/**
 * §4.12.1 satırları (masaüstü) ölçülen düzende: hero-rest / main.dart → about-cut / about.dart → areas-dial / alan k →
 * work: panel yok → journey-core / git log → contact-ring / zsh. Köprüde (IN p < end) çapa "A→B", anahtar "A>B".
 */
function choreoRows(m: Measured): Row[] {
  const a = m.areas;
  if (!a) throw new Error('areas pin yok (liste modu)');
  const { S, N } = a;
  const jk = (y: number) => `journey:${indexAt(m.activation.journey, y)}`;
  const area = (y: number) => `area:${areasStepAt(m, y)}`;
  const bridge = Object.fromEntries(BRIDGES.map((b) => [b.chapter, b])) as Record<string, Bridge>;
  // work'ün ucu programsızdır: DOM'da boş work-specimen çapası ya da hiç çapa yok (K-WORK-6); ikisinde de panel yoktur
  const anchorRe = (id: string) => (id === 'work-specimen' ? '(work-specimen|yok)' : esc(id));
  const fixed =
    (anchor: string, key: ((y: number) => string) | null) =>
    (y: number): Want => {
      const opacity = sceneOpacityAt(m, y);
      return { anchor: anchorRe(anchor), key: key && opacity >= 0.005 ? key(y) : null, opacity };
    };
  const across =
    (b: Bridge | undefined, keyA: (y: number) => string, keyB: (y: number) => string) =>
    (y: number): Want => {
      if (!b) throw new Error('köprü tanımı yok');
      const on = pOf(phaseOf(m, b.chapter, 'in'), y) < b.end;
      const opacity = sceneOpacityAt(m, y);
      return {
        anchor: on ? `${anchorRe(b.from)}→${anchorRe(b.to)}` : anchorRe(b.to),
        key: opacity < 0.005 ? null : on ? `${keyA(y)}>${keyB(y)}` : keyB(y),
        opacity,
      };
    };
  const span = (chapter: string, phase: PhaseKind) => {
    const r = phaseOf(m, chapter, phase);
    return { y0: r.y0, y1: r.y1 };
  };
  const rows: Row[] = [
    { id: '0–1', label: 'hero boşta', y0: 0, y1: 0, want: fixed('hero-rest', () => 'hero') },
    {
      id: '2',
      label: 'about IN',
      ...span('about', 'in'),
      want: across(
        bridge.about,
        () => 'hero',
        () => ABOUT_KEY,
      ),
    },
    {
      id: '3',
      label: 'about BODY',
      ...span('about', 'body'),
      want: fixed('about-cut', () => ABOUT_KEY),
    },
    {
      id: '4',
      label: 'areas IN',
      ...span('areas', 'in'),
      want: across(
        bridge.areas,
        () => ABOUT_KEY,
        () => 'area:0',
      ),
    },
    {
      id: '5',
      label: 'areas oturma + adım 0',
      y0: a.bodyY0,
      y1: areasY(m, 10 + S),
      want: fixed('areas-dial', area),
    },
  ];
  for (let k = 1; k < N; k++)
    rows.push({
      id: String(5 + k),
      label: `areas adım ${k}`,
      y0: areasY(m, 10 + S * k),
      y1: areasY(m, 10 + S * (k + 1)),
      want: fixed('areas-dial', area),
    });
  rows.push(
    {
      id: String(5 + N),
      label: 'areas bırakma',
      y0: areasY(m, 10 + S * N),
      y1: phaseOf(m, 'areas', 'body').y1,
      want: fixed('areas-dial', area),
    },
    {
      id: '10',
      label: 'work IN',
      ...span('work', 'in'),
      want: across(
        bridge.work,
        () => esc(`area:${N - 1}`),
        () => '-',
      ),
    },
    { id: '11', label: 'work BODY', ...span('work', 'body'), want: fixed('work-specimen', null) },
    {
      id: '12',
      label: 'journey IN',
      ...span('journey', 'in'),
      want: across(bridge.journey, () => '-', jk),
    },
    {
      id: '13',
      label: 'journey BODY',
      ...span('journey', 'body'),
      want: fixed('journey-core', jk),
    },
    {
      id: '14',
      label: 'contact IN',
      ...span('contact', 'in'),
      want: across(bridge.contact, jk, () => 'contact'),
    },
  );
  return rows;
}

/** Köprülerin ölçülen düzendeki aralıkları: [y0, y1] bildirilen köprü (IN p 0 → end), [v0, v1] sahnenin göründüğü kısım */
function bridgeSpans(m: Measured) {
  return BRIDGES.map((b) => {
    const r = phaseOf(m, b.chapter, 'in');
    const at = (p: number) => r.y0 + p * (r.y1 - r.y0);
    return { ...b, y0: r.y0, y1: at(b.end), v0: at(b.vis[0]), v1: at(b.vis[1]) };
  });
}
/** Yönetmen iki çapa arasında köprüde mi (rig'in köprü koşulu: from ≠ to, 0.001 < anchorMix < 0.999) */
const bridging = (s: KodState) =>
  s.anchor.from !== s.anchor.to && s.anchor.mix > 0.001 && s.anchor.mix < 0.999;

/** Olay çizgisine (±1 svh), köprü ucuna ya da opaklık eşiğine çok yakın konum: tablo değeri iki yana da düşebilir */
function nearEdge(m: Measured, y: number): boolean {
  const lines = [...m.activation.journey];
  const a = m.areas;
  if (a) for (let k = 1; k < a.N; k++) lines.push(areasY(m, 10 + a.S * k + 0.15 * a.S));
  if (lines.some((l) => Math.abs(l - y) < 0.01 * m.vh)) return true;
  for (const b of BRIDGES) {
    const p = pOf(phaseOf(m, b.chapter, 'in'), y);
    if ((p > 0 && p < 0.02) || Math.abs(p - b.end) < 0.04) return true;
  }
  const op = sceneOpacityAt(m, y);
  return op > 0.005 && op < 0.05;
}

/* ───────────── panel ↔ metin (K-CHOREO-6, K-ABOUT-3) ───────────── */

interface Offender {
  sel: string;
  chapter: string;
  text: string;
  /** metin satır kutularına giriş derinliği (px): iki eksendeki örtüşmenin küçüğü */
  textOverlap: number;
  /** öğe dikdörtgenine giriş derinliği (px) */
  boxOverlap: number;
}
interface PanelCheck {
  y: number;
  opacity: number;
  shown: boolean;
  key: string;
  panel: PanelRect;
  offenders: Offender[];
}

/**
 * Rig'e o kaydırmada bir kare çizdirilir ve o karenin panel dikdörtgeni (live.panel: eğimsiz, plaka dahil) kapsamdaki
 * metin öğeleriyle karşılaştırılır: kendi boş olmayan metin düğümü olan, checkVisibility (opaklık ve görünürlük) ile
 * görünen öğeler; aria-hidden alt ağaçları (statik panel kopyaları dahil), .sr-only ve hero H1 (#hero-title, §4.12.2 #7)
 * hariç. Sahne opaklığı ≤ 0.01 ise (döngü never) panel yoktur.
 */
async function panelVsText(page: Page, scope = '#main'): Promise<PanelCheck> {
  await freshFrame(page);
  return page.evaluate((sel) => {
    const st = (window as unknown as StageWindow).__stage;
    const layer = document.getElementById('scene-layer');
    const opacity = layer ? Number.parseFloat(getComputedStyle(layer).opacity) : 0;
    const p = { ...st.live.panel };
    const out: PanelCheck = {
      y: window.scrollY,
      opacity,
      shown: false,
      key: st.live.kod.key,
      panel: p,
      offenders: [],
    };
    if (!(opacity > 0.01) || !p.visible || p.w <= 0 || p.h <= 0) return out;
    out.shown = true;
    const depth = (r: DOMRect) =>
      Math.min(
        Math.min(r.right, p.x + p.w) - Math.max(r.left, p.x),
        Math.min(r.bottom, p.y + p.h) - Math.max(r.top, p.y),
      );
    for (const el of document.querySelector(sel)?.querySelectorAll<HTMLElement>('*') ?? []) {
      const own = [...el.childNodes].filter(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
      );
      if (!own.length) continue;
      if (el.closest('[aria-hidden="true"], .sr-only, #hero-title')) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      let text = Number.NEGATIVE_INFINITY;
      for (const n of own) {
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects())
          if (r.width > 0 && r.height > 0) text = Math.max(text, depth(r));
      }
      const box = depth(el.getBoundingClientRect());
      if (text <= 0 && box <= 0) continue;
      const cls = el.getAttribute('class')?.trim().split(/\s+/)[0];
      out.offenders.push({
        sel: el.id ? `#${el.id}` : `${el.localName}${cls ? `.${cls}` : ''}`,
        chapter: el.closest('[data-chapter]')?.getAttribute('data-chapter') ?? '',
        text: own
          .map((n) => n.textContent?.trim())
          .join(' ')
          .slice(0, 48),
        textOverlap: Math.round(Math.max(0, text) * 10) / 10,
        boxOverlap: Math.round(Math.max(0, box) * 10) / 10,
      });
    }
    return out;
  }, scope);
}

/** Bölüm başına 10 konum (aralığın iç noktaları); metin satırına giren her öğe ihlaldir, yalnız kutusu girenler not edilir */
async function panelNotOverText(
  page: Page,
  info: TestInfo,
  label: string,
  only?: readonly string[],
): Promise<void> {
  const m = await measure(page);
  const ids = m.chapters.map((c) => c.id).filter((id) => !only || only.includes(id));
  const boxOnly: string[] = [];
  let checked = 0;
  for (const id of ids) {
    const [y0, y1] = chapterRange(m, id);
    for (let i = 0; i < 10; i++) {
      const y = y0 + ((i + 0.5) / 10) * (y1 - y0);
      await stepTo(page, y, 0.5, false);
      const r = await panelVsText(page);
      const where = `${label} ${id} #${i + 1} s ${fmt(svh(m, r.y))} (panel ${r.shown ? `${rectStr(r.panel)} "${r.key}"` : 'yok'}, opaklık ${fmt(r.opacity)})`;
      if (r.shown) checked++;
      for (const o of r.offenders) {
        if (o.textOverlap > 0.5)
          expect
            .soft(
              o.textOverlap,
              `${where}: ${o.chapter} ${o.sel} "${o.text}" metnine ${o.textOverlap} px giriyor`,
            )
            .toBeLessThanOrEqual(0.5);
        else boxOnly.push(`${where}: ${o.sel} "${o.text}" kutu ${o.boxOverlap} px`);
      }
    }
  }
  note(info, `${label} denetlenen konum`, `${checked} konumda panel görünür`);
  if (boxOnly.length) note(info, `${label} yalnız öğe kutusu (metin değil)`, boxOnly);
}

/* ───────────── reveal sondası (I2, K-WORK-3) ───────────── */

interface RevealHit {
  sel: string;
  chapter: string;
  kind: string;
  text: string;
  /** üst kenarın ilk kez 0.75·innerHeight'ın altına indiği örnek */
  s: number;
  top: number;
  opacity: string;
  transform: string;
  lines: number;
  clip: string;
  complete: boolean;
  /** ilk kararda tamam değilse: tamamlandığı örnekte üst kenar (·vh) */
  doneTop?: number;
  /** çizgiyi geçen iki örnek arasında öğenin kat ettiği yol (svh): örnekleme çözünürlüğü */
  step?: number;
  /** .is-revealed'ın eklendiği kaydırma konumu (svh) ve anında mı (is-instant: süpürme / zorlama) */
  revealedAt: number | null;
  instant: boolean | null;
}

/**
 * I2 sondası: hedefler §5.14 reveal seçicisidir ([data-reveal]); §4.12.3 istisnası (contact) ve bu kırılımda reveal
 * almayan öğeler (data-reveal-when) hariçtir. KOD'da about lede'si istisna değildir (blok reveal'ı, K-ABOUT-2). mode
 * 'scroll': her kaydırma olayından 90 ms sonra (readingScroll'un bir sonraki adımından hemen önce) örnekler; 'interval':
 * 40 ms'de bir (Lenis sürekli kaydırır).
 */
async function installRevealProbe(page: Page, mode: 'scroll' | 'interval'): Promise<void> {
  await page.evaluate((how) => {
    const vh = window.innerHeight;
    const flat = (t: string) => t === 'none' || new DOMMatrixReadOnly(t).isIdentity;
    const targets = [...document.querySelectorAll<HTMLElement>('#main [data-reveal]')].filter(
      (el) =>
        !el.closest('[data-chapter="contact"]') &&
        !(el.dataset.revealWhen && !window.matchMedia(el.dataset.revealWhen).matches),
    );
    type Hit = { s: number; top: number; complete: boolean; doneTop?: number; step: number };
    const hits = new Map<HTMLElement, Hit & Record<string, unknown>>();
    const lastTop = new Map<HTMLElement, number>(); // %75 çizgisini geçmeden önceki son örnekte üst kenar (·vh)
    const revealed = new Map<HTMLElement, { at: number; instant: boolean }>();
    const mo = new MutationObserver((list) => {
      for (const { target } of list) {
        const el = target as HTMLElement;
        if (!revealed.has(el) && el.classList.contains('is-revealed'))
          revealed.set(el, {
            at: (window.scrollY / vh) * 100,
            instant: el.classList.contains('is-instant'),
          });
      }
    });
    for (const el of targets) mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    const state = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      const lines = [...el.querySelectorAll<HTMLElement>('.split-line')].filter(
        (l) => !flat(getComputedStyle(l).transform),
      ).length;
      const clip = el.dataset.reveal === 'clip' ? cs.clipPath : 'none';
      const clipOk =
        clip === 'none' ||
        (clip.split(' round ')[0] ?? '')
          .replace(/^inset\(|\)$/g, '')
          .split(/\s+/)
          .every((v) => Number.parseFloat(v) === 0);
      const img = el.dataset.reveal === 'clip' ? el.querySelector('img') : null;
      const imgOk = !img || ['none', '1'].includes(getComputedStyle(img).scale);
      return {
        opacity: cs.opacity,
        transform: [cs.transform, cs.translate, cs.scale].join(' | '),
        lines,
        clip,
        complete:
          cs.opacity === '1' &&
          flat(cs.transform) &&
          cs.translate === 'none' &&
          ['none', '1'].includes(cs.scale) &&
          lines === 0 &&
          clipOk &&
          imgOk,
      };
    };
    const sample = () => {
      for (const el of targets) {
        const h = hits.get(el);
        if (h && (h.complete || h.doneTop !== undefined)) continue;
        const r = el.getBoundingClientRect();
        if (!h) {
          if (r.height === 0) continue;
          if (r.top >= 0.75 * vh) {
            lastTop.set(el, r.top / vh);
            continue;
          }
          // örnekleme çözünürlüğü: çizgiyi geçen iki örnek arasında öğenin kat ettiği yol (svh)
          const step = ((lastTop.get(el) ?? r.top / vh) - r.top / vh) * 100;
          hits.set(el, { s: (window.scrollY / vh) * 100, top: r.top / vh, step, ...state(el) });
        } else if (state(el).complete) h.doneTop = r.top / vh; // ilk kararda tamam değildi
      }
    };
    let timer = 0;
    if (how === 'scroll')
      window.addEventListener(
        'scroll',
        () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(sample, 90);
        },
        { passive: true },
      );
    else window.setInterval(sample, 40);
    const describe = (el: HTMLElement) => {
      const cls = el.getAttribute('class')?.trim().split(/\s+/)[0];
      return el.id ? `#${el.id}` : `${el.localName}${cls ? `.${cls}` : ''}`;
    };
    (window as unknown as { __reveal: () => unknown }).__reveal = () => {
      sample();
      return targets.map((el) => {
        const h = hits.get(el);
        const rv = revealed.get(el);
        return {
          sel: describe(el),
          chapter: el.closest('[data-chapter]')?.getAttribute('data-chapter') ?? '',
          kind: el.dataset.reveal ?? '',
          text: (el.textContent ?? '').trim().slice(0, 40),
          ...(h ?? { s: Number.NaN, top: Number.NaN, complete: false }),
          revealedAt: rv?.at ?? null,
          instant: rv?.instant ?? null,
          decided: !!h,
        };
      });
    };
  }, mode);
}
async function revealHits(page: Page): Promise<(RevealHit & { decided: boolean })[]> {
  return page.evaluate(() =>
    (window as unknown as { __reveal: () => (RevealHit & { decided: boolean })[] }).__reveal(),
  );
}

function assertRevealHits(
  info: TestInfo,
  label: string,
  hits: (RevealHit & { decided: boolean })[],
) {
  const decided = hits.filter((h) => h.decided);
  expect(decided.length, `${label}: %75'i geçen reveal hedefi`).toBeGreaterThan(10);
  // Örnekleme payı: ilk örnekte tamam değilse, üst kenar %75 çizgisini en çok 1 svh geçmişken tamamlanmış olmalı
  // (kaydırma ile tetikleyici güncellemesi arasındaki tek karelik yarış). Gecikmeler ayrıca raporlanır.
  const late = decided
    .filter((h) => !h.complete)
    .map((h) => ({
      h,
      by: h.doneTop === undefined ? Infinity : (0.75 - h.doneTop) * 100,
      // pay: 1 svh ya da örnekleme çözünürlüğü (yavaş karede bir kare birkaç svh kaydırır), hangisi büyükse
      grace: Math.max(1, h.step ?? 0),
    }));
  for (const { h, by, grace } of late)
    expect
      .soft(
        by,
        `${label}: ${h.chapter} ${h.sel} "${h.text}" üstü %75'i geçtiğinde (s ${fmt(h.s)}, üst ${fmt(h.top)}·vh) tamam değil: opacity ${h.opacity}, transform ${h.transform}, satır ${h.lines}, clip ${h.clip}; tamamlandığında %75'in ${fmt(by)} svh ötesindeydi (pay ${fmt(grace)} svh)`,
      )
      .toBeLessThanOrEqual(grace);
  if (late.length)
    note(
      info,
      `${label} %75'te tamam olmayanlar (svh gecikme / pay)`,
      late.map(({ h, by, grace }) => `${h.chapter} ${h.sel}: ${fmt(by)} / ${fmt(grace)}`),
    );
  const instant = decided.filter((h) => h.instant).length;
  note(info, `${label} reveal türü`, {
    hedef: hits.length,
    karar: decided.length,
    anında: instant,
    animasyonlu: decided.length - instant,
    kararsız: hits.filter((h) => !h.decided).map((h) => `${h.chapter} ${h.sel}`),
  });
  note(
    info,
    `${label} açılma konumu (svh; üst %75'e indiğinde)`,
    decided.map(
      (h) =>
        `${h.chapter} ${h.sel} açıldı s ${fmt(h.revealedAt ?? undefined)}${h.instant ? ' (anında)' : ''}, %75 s ${fmt(h.s)}`,
    ),
  );
}

/* ───────────── kesme kaydı (K-GEN-9, K-CHOREO-5, K-AREAS-6, K-JOURNEY-7) ───────────── */

interface SceneRec {
  t: number;
  /** op: --scene-opacity yazımı; raf: kare örneği (bir şey değiştiyse); click / popstate; vt …: görünüm geçişi */
  kind: string;
  /** --scene-opacity (hesaplanmış) */
  op: number;
  /** kesme çarpanı stageTarget.opacityCut (§5.9.7) */
  cut: number;
  y: number;
  /** rig'in son karesi: program anahtarı, panel dikdörtgeni [x, y, w, h], plaka görünür mü */
  key: string;
  rect: number[];
  vis: boolean;
  frames: number;
  path: string;
}

/**
 * Init betiği: --scene-opacity yazımları (stil özniteliği), her karede kaydırma / opaklık / kesme çarpanı / rig karesi
 * (değiştiyse), tıklama, popstate ve görünüm geçişi animasyonları zaman damgasıyla. Kaydırma konumu kare örneklerinden
 * okunur: 'scroll' olayı yazımdan bir kare sonra gelir.
 */
function recordScene(): void {
  type Live = {
    frames: number;
    kod: { key: string };
    panel: { x: number; y: number; w: number; h: number; visible: boolean };
  };
  const w = window as unknown as {
    __rec: SceneRec[];
    __stage?: { target: Record<string, number>; live: Live };
  };
  w.__rec = [];
  const seen = new WeakSet<Animation>();
  const start = () => {
    const layer = document.getElementById('scene-layer');
    if (!layer) {
      requestAnimationFrame(start);
      return;
    }
    const read = (kind: string): SceneRec => {
      const st = w.__stage;
      const p = st?.live.panel;
      return {
        t: performance.now(),
        kind,
        op: Number.parseFloat(getComputedStyle(layer).opacity),
        cut: st?.target.opacityCut ?? 1,
        y: window.scrollY,
        key: st?.live.kod.key ?? '',
        rect: p ? [p.x, p.y, p.w, p.h] : [0, 0, 0, 0],
        vis: p?.visible ?? false,
        frames: st?.live.frames ?? -1,
        path: location.pathname + location.hash,
      };
    };
    const push = (kind: string) => w.__rec.push(read(kind));
    new MutationObserver(() => push('op')).observe(layer, {
      attributes: true,
      attributeFilter: ['style'],
    });
    window.addEventListener('click', () => push('click'), true);
    window.addEventListener('popstate', () => push('popstate'));
    // Kare taraması Chromium'da geçiş animasyonlarını kaçırabilir (en fazla bir rAF örneğinde görünürler; M8):
    // startViewTransition sarılır, geçiş hazır olunca kurulan bütün animasyonlar kaydedilir.
    const startVt = document.startViewTransition?.bind(document);
    if (startVt)
      document.startViewTransition = ((arg?: Parameters<typeof startVt>[0]) => {
        const vt = startVt(arg);
        void vt.ready.then(
          () => {
            for (const a of document.getAnimations()) {
              const pe = (a.effect as KeyframeEffect | null)?.pseudoElement ?? '';
              if (pe.includes('view-transition') && !seen.has(a)) {
                seen.add(a);
                push(`vt ${pe}`);
              }
            }
          },
          () => {},
        );
        return vt;
      }) as typeof document.startViewTransition;
    let last = '';
    const frame = () => {
      const r = read('raf');
      const key = [r.y, r.op, r.cut, r.frames, r.path].join();
      if (key !== last) {
        last = key;
        w.__rec.push(r);
      }
      for (const a of document.getAnimations()) {
        const pe = (a.effect as KeyframeEffect | null)?.pseudoElement ?? '';
        if (pe.includes('view-transition') && !seen.has(a)) {
          seen.add(a);
          push(`vt ${pe}`);
        }
      }
      requestAnimationFrame(frame);
    };
    frame();
  };
  start();
}
const records = (page: Page) =>
  page.evaluate(() => (window as unknown as { __rec: SceneRec[] }).__rec.slice());
const clearRecords = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __rec: SceneRec[] }).__rec.length = 0;
  });

/** Kaydırmanın son konuma (±1 px) vardığı kare ve ondan önceki son hareket (kare örneklerinden) */
function arrival(rec: SceneRec[], t0: number) {
  const frames = rec.filter((r) => r.kind === 'raf');
  const finalY = frames.at(-1)?.y;
  if (finalY === undefined) return { finalY: null, arrive: undefined, prevMove: undefined };
  const away = frames.filter((r) => Math.abs(r.y - finalY) > 1);
  const lastAway = away.at(-1);
  const arrive = frames.find((r) => r.t >= t0 && r.t > (lastAway?.t ?? -Infinity))?.t;
  const prevMove = lastAway && lastAway.t >= t0 ? lastAway.t : undefined;
  return { finalY, arrive, prevMove };
}

/**
 * Sönme / geri gelme süreleri, series çarpanı üzerinde: 'op' --scene-opacity (kare hızından bağımsız ölçüt stil
 * yazımlarından: t0'dan sonra > 0.01 YAZILDIĞI son an ve varıştan sonra çizilen ilk rig karesinden / son sıfırdan sonra
 * < 0.99 yazıldığı son an); 'cut' kesme çarpanı opacityCut (DOM yazımı yoktur: kare örnekleri). Ham süreler (eşiğin ilk
 * geçildiği kare) ayrıca döner. Eski kare (KOD): son sıfırdan sonra sahne en az yarı görünürken rig'in son karesi
 * oturmuş durumdan (final: program ve panel dikdörtgeni ± 2 px) farklı — kesmeden önceki kare görünüyor.
 */
function cutTiming(
  rec: SceneRec[],
  t0: number,
  from: 'arrive' | 'zero',
  series: 'op' | 'cut' = 'op',
  final?: { key: string; panel: PanelRect; shown: boolean },
) {
  const val = (r: SceneRec) => (series === 'op' ? r.op : r.cut);
  const after = rec.filter((r) => r.t >= t0);
  const writes = after.filter((r) => r.kind === (series === 'op' ? 'op' : 'raf'));
  const zeroAt = after.find((r) => val(r) <= 0.01);
  const lastAbove = writes.filter((r) => val(r) > 0.01 && (!zeroAt || r.t < zeroAt.t)).at(-1);
  const { finalY, arrive } = arrival(rec, t0);
  const lastZero = after.filter((r) => val(r) <= 0.01).at(-1);
  // §5.9.7 (M6): belirme rig oturtulmuş kareyi çizdikten sonra başlar; varıştan sonraki ilk rig karesinden ölçülür
  // (60 fps'te ≈ 16 ms; CI SwiftShader'da ≈ 500 ms)
  const atArrive = arrive === undefined ? undefined : after.find((r) => r.t >= arrive);
  const drawn =
    atArrive === undefined
      ? undefined
      : after.find((r) => r.kind === 'raf' && r.t >= atArrive.t && r.frames > atArrive.frames)?.t;
  const ref = from === 'arrive' ? (drawn ?? arrive ?? lastZero?.t) : lastZero?.t;
  const back = ref === undefined ? undefined : after.find((r) => r.t >= ref && val(r) >= 0.99);
  const lastBelow =
    ref === undefined || !back
      ? undefined
      : writes.filter((r) => r.t >= ref && r.t < back.t && val(r) < 0.99).at(-1);
  const flash =
    zeroAt && arrive !== undefined
      ? writes.filter((r) => r.t > zeroAt.t && r.t < arrive && val(r) > 0.01)
      : [];
  const fin = final?.shown ? final : null;
  const off = (r: SceneRec) =>
    fin
      ? Math.max(
          ...[fin.panel.x, fin.panel.y, fin.panel.w, fin.panel.h].map((v, i) =>
            Math.abs((r.rect[i] ?? Number.NaN) - v),
          ),
        )
      : 0;
  const stale =
    lastZero && fin
      ? after.filter(
          (r) => r.t > lastZero.t && r.op >= 0.5 && (r.key !== fin.key || !(off(r) <= 2)),
        )
      : [];
  return {
    reachedZero: !!zeroAt,
    dropRaw: zeroAt ? zeroAt.t - t0 : null,
    dropFrameFree: (lastAbove?.t ?? t0) - t0,
    arriveAt: arrive === undefined ? null : arrive - t0,
    backRaw: back && ref !== undefined ? back.t - ref : null,
    backFrameFree: back && ref !== undefined ? (lastBelow?.t ?? ref) - ref : null,
    minOp: Math.min(...after.map((r) => r.op)),
    minCut: Math.min(...after.map((r) => r.cut)),
    flash: flash.length,
    finalY: finalY ?? null,
    stale: stale.map(
      (r) =>
        `t+${fmt(r.t - t0)} ms opaklık ${fmt(r.op)}: rig karesi ${r.frames} "${r.key}" ${r.rect.map((v) => Math.round(v)).join(',')} ≠ oturmuş "${fin?.key}" ${fin ? rectStr(fin.panel) : ''}`,
    ),
  };
}

/** Rapor için kısa zaman çizelgesi: t0'dan sonra opaklık / kesme / rig karesi değişimleri (yalnız kaydırılan kareler atlanır) */
function timeline(rec: SceneRec[], t0: number, limit = 40): string[] {
  const list = rec.filter((r) => r.t >= t0);
  const out: string[] = [];
  list.forEach((r, i) => {
    const prev = list[i - 1];
    const quiet =
      r.kind === 'raf' &&
      prev &&
      r.op === prev.op &&
      r.cut === prev.cut &&
      r.frames === prev.frames &&
      i < list.length - 1;
    if (quiet || out.length >= limit) return;
    out.push(
      `+${fmt(r.t - t0)} ${r.kind} op ${fmt(r.op)} kesme ${fmt(r.cut)} y ${Math.round(r.y)} kare ${r.frames} "${r.key}"`,
    );
  });
  return out;
}

/* ═════════════════════════════ testler ═════════════════════════════ */

test.describe(
  '§4.12 program tablosu, köprüler ve düzen (1440×900)',
  { tag: ['@desktop-chromium'] },
  () => {
    test('K-GEN-2 bölüm yükseklikleri ve toplam kaydırma (yönetmen fazlarıyla)', async ({
      page,
    }, info) => {
      await openHome(page, HOME_TARGET);
      const m = await measure(page);
      await crossCheckLayout(page, m, info);
      const h = Object.fromEntries(m.chapters.map((c) => [c.id, svh(m, c.height)]));
      const { N, P, E } = m.counts;
      note(info, 'bölüm yükseklikleri (svh)', { ...h, N, P, E });
      expect.soft(Math.abs((h.hero ?? 0) - 100), `hero ${fmt(h.hero)}`).toBeLessThanOrEqual(1);
      // §4.5.2: formüller min-height'tır; gerçek içerik uzunsa bölüm uzar (sahibin about metni 140 svh'yi aşar)
      expect.soft(h.about ?? 0, `about ${fmt(h.about)} ≥ 140`).toBeGreaterThanOrEqual(140 - 1);
      expect
        .soft(h.areas ?? 0, `areas ${fmt(h.areas)} ≥ 120 + 50N`)
        .toBeGreaterThanOrEqual(120 + 50 * N - 1);
      expect
        .soft(h.work ?? 0, `work ${fmt(h.work)} ≥ 50 + 70P`)
        .toBeGreaterThanOrEqual(50 + 70 * P - 1);
      expect
        .soft(h.journey ?? 0, `journey ${fmt(h.journey)} ≥ 70 + 35E`)
        .toBeGreaterThanOrEqual(70 + 35 * E - 1);
      expect
        .soft(Math.abs((h.contact ?? 0) - 100), `contact ${fmt(h.contact)}`)
        .toBeLessThanOrEqual(1);
      // Toplam = Σ yükseklik − 100 svh. 1170 svh referansı varsayılan içerik içindir; içerik farkı rapora yazılır
      // (beklenen s değerleri zaten ölçülen düzenden gelir).
      const total = svh(m, m.maxScroll);
      const sum = Object.values(h).reduce((a, b) => a + b, 0) - 100;
      expect
        .soft(Math.abs(total - sum), `toplam ${fmt(total)} = Σ − 100 (${fmt(sum)})`)
        .toBeLessThanOrEqual(2);
      note(info, 'toplam kaydırma (svh)', {
        olculen: fmt(total),
        referans: 1170,
        fark: fmt(total - 1170),
        journeyFazlasi: fmt((h.journey ?? 0) - (70 + 35 * E)),
      });
      note(
        info,
        'fazlar (svh)',
        m.phases.map((p) => `${p.chapter} ${p.phase} ${fmt(svh(m, p.y0))}–${fmt(svh(m, p.y1))}`),
      );
    });

    test('K-CHOREO-7 §4.12.1 her satırın s aralığında çapa ve program anahtarı tablodaki gibi (work’te panel yok)', async ({
      page,
    }, info) => {
      await openHome(page);
      const m = await measure(page);
      expect(m.areas, 'areas pin etkin').not.toBeNull();
      // satır 0 (yükleme): hero-rest, main.dart
      const first = await kodAt(page);
      expect.soft(first.key, 'satır 0 yükleme: program').toBe('hero');
      expect.soft(first.anchor.at, 'satır 0 yükleme: çapa').toBe('hero-rest');
      const misses: string[] = [];
      const skipped: string[] = [];
      for (const r of choreoRows(m)) {
        await test.step(`satır ${r.id}: ${r.label} (s ${fmt(svh(m, r.y0))}–${fmt(svh(m, r.y1))})`, async () => {
          const ys =
            r.y1 > r.y0
              ? [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.round(r.y0 + f * (r.y1 - r.y0)))
              : [Math.round(r.y0)];
          for (const y of ys) {
            if (nearEdge(m, y)) {
              skipped.push(`satır ${r.id} s ${fmt(svh(m, y))}`);
              continue;
            }
            // çapa çifti, olaylar ve --scene-opacity yönetmenin kaydırma güncellemesinde eşzamanlı yazılır: durulma gerekmez
            await stepTo(page, y, 0.5, false);
            const got = await kodAt(page);
            const want = r.want(got.y);
            const at = `satır ${r.id} (${r.label}) s ${fmt(svh(m, got.y))}`;
            const anchorRe = new RegExp(`^${want.anchor}$`);
            if (!anchorRe.test(got.anchor.at))
              misses.push(`${at}: çapa ${got.anchor.at} ≠ /${want.anchor}/`);
            expect.soft(got.anchor.at, `${at}: çapa`).toMatch(anchorRe);
            expect
              .soft(
                Math.abs(got.opacity - want.opacity),
                `${at}: --scene-opacity ${fmt(got.opacity)} (beklenen ${fmt(want.opacity)})`,
              )
              .toBeLessThanOrEqual(0.03);
            if (want.key === null) {
              if (got.opacity > 0.01)
                misses.push(`${at}: panel yok beklenir, opaklık ${got.opacity}`);
              expect.soft(got.opacity, `${at}: panel yok (sahne sönük)`).toBeLessThanOrEqual(0.01);
              continue;
            }
            const re = new RegExp(`^${want.key}$`);
            if (!got.shown || !re.test(got.key))
              misses.push(`${at}: program "${got.key}" (görünür ${got.shown}) ≠ /${want.key}/`);
            expect.soft(got.shown, `${at}: panel görünür`).toBe(true);
            expect.soft(got.key, `${at}: program`).toMatch(re);
            if (want.anchor.includes('→'))
              expect
                .soft(
                  Math.abs(got.mix - got.anchor.mix),
                  `${at}: köprü ilerlemesi ${fmt(got.mix)} = anchorMix ${fmt(got.anchor.mix)}`,
                )
                .toBeLessThanOrEqual(0.002);
          }
        });
      }
      note(info, 'K-CHOREO-7 sapmalar', misses.length ? misses : 'yok');
      if (skipped.length) note(info, 'K-CHOREO-7 eşikte atlanan konumlar', skipped);
    });

    test('K-CHOREO-3 köprüler geri alınabilir: köprü içinde aynı y aşağı ve yukarı gelişte aynı kare; köprü dışında tek program', async ({
      page,
    }, info) => {
      await openHome(page);
      const m = await measure(page);
      const spans = bridgeSpans(m);
      // köprülerin görünen kısmında 3'er konum (iki yönden okunur) + her 20 svh'de bir konum (köprü dışı denetimi)
      const probes = spans.flatMap((s) =>
        [0.25, 0.5, 0.75].map((f) => ({
          bridge: s.chapter,
          y: Math.round(s.v0 + f * (s.v1 - s.v0)),
        })),
      );
      const grid: number[] = [];
      for (let y = 0; y < m.maxScroll; y += 0.2 * m.vh) grid.push(Math.round(y));
      grid.push(Math.round(m.maxScroll));
      const ys = [...new Set([...grid, ...probes.map((p) => p.y)])].sort((a, b) => a - b);
      const down = new Map<number, KodState>();
      for (const y of ys) {
        await stepTo(page, y, 0.5, false);
        down.set(y, await kodAt(page));
      }
      // sayfa sonundan yukarı: köprü konumlarına bu kez aşağıdan gelinir
      const up = new Map<number, KodState>();
      for (const p of [...probes].sort((a, b) => b.y - a.y)) {
        await stepTo(page, p.y, 0.5, false);
        up.set(p.y, await kodAt(page));
      }
      const declared = (y: number) => spans.some((s) => y >= s.y0 - 1 && y <= s.y1 + 1);
      const count = { köprü: 0, dışı: 0, sönük: 0 };
      const classify = (s: KodState, at: string) => {
        if (bridging(s))
          expect
            .soft(declared(s.y), `${at}: köprü yalnız bildirilen IN aralığında (§4.12.4 #24)`)
            .toBe(true);
        if (!s.shown) {
          count.sönük++;
          return;
        }
        if (bridging(s)) {
          count.köprü++;
          expect.soft(s.key, `${at}: köprüde iki program`).toContain('>');
          expect
            .soft(Math.abs(s.mix - s.anchor.mix), `${at}: köprü ilerlemesi = anchorMix`)
            .toBeLessThanOrEqual(0.002);
        } else {
          count.dışı++;
          expect.soft(s.key, `${at}: köprü dışında tek program`).not.toContain('>');
        }
      };
      for (const [y, s] of down) classify(s, `s ${fmt(svh(m, y))} aşağı`);
      const pairs: string[] = [];
      for (const p of probes) {
        const a = down.get(p.y);
        const b = up.get(p.y);
        if (!a || !b) continue;
        const at = `${p.bridge} köprüsü s ${fmt(svh(m, p.y))}`;
        classify(b, `${at} yukarı`);
        pairs.push(`${at}: aşağı "${a.key}" ${fmt(a.mix)}, yukarı "${b.key}" ${fmt(b.mix)}`);
        expect.soft(a.shown, `${at}: köprünün görünen kısmında panel görünür`).toBe(true);
        expect.soft(b.shown, `${at}: panel görünürlüğü yönden bağımsız`).toBe(a.shown);
        if (!a.shown || !b.shown) continue;
        expect.soft(bridging(a), `${at}: köprü içinde`).toBe(true);
        expect.soft(b.key, `${at}: program (aşağı "${a.key}", yukarı "${b.key}")`).toBe(a.key);
        expect
          .soft(Math.abs(b.mix - a.mix), `${at}: köprü ilerlemesi ${fmt(a.mix)} / ${fmt(b.mix)}`)
          .toBeLessThanOrEqual(0.002);
        expect
          .soft(
            rectDiff(a.panel, b.panel),
            `${at}: panel ${rectStr(a.panel)} / ${rectStr(b.panel)}`,
          )
          .toBeLessThanOrEqual(1);
      }
      note(info, 'K-CHOREO-3 konum', { toplam: ys.length, ...count });
      note(info, 'K-CHOREO-3 aşağı / yukarı', pairs);
    });

    test('K-CHOREO-3 köprü içindeki konuma sıçrayarak (kesme) gelmek yavaş kaydırmayla aynı kareyi verir', async ({
      page,
    }, info) => {
      await openHome(page);
      const m = await measure(page);
      const probes = bridgeSpans(m).flatMap((s) =>
        [1 / 3, 2 / 3].map((f) => ({ bridge: s.chapter, y: Math.round(s.v0 + f * (s.v1 - s.v0)) })),
      );
      const jumps: string[] = [];
      for (const p of probes) {
        // yavaş: bir önceki konumdan kesme eşiğinin altında adımlarla; hızlı: sayfanın öbür ucundan tek adımda
        await stepTo(page, p.y, 0.5, false);
        const ref = await kodAt(page);
        await jumpTo(page, p.y > m.maxScroll / 2 ? 0 : m.maxScroll);
        await jumpTo(page, p.y);
        const c = await kodAt(page);
        const at = `${p.bridge} köprüsü s ${fmt(svh(m, p.y))} sıçrama`;
        jumps.push(`${at}: "${c.key}" ${fmt(c.mix)} (yavaş "${ref.key}" ${fmt(ref.mix)})`);
        expect.soft(ref.shown, `${at}: köprünün görünen kısmında panel görünür`).toBe(true);
        expect.soft(c.shown, `${at}: panel görünür`).toBe(ref.shown);
        if (!c.shown || !ref.shown) continue;
        expect.soft(c.key, `${at}: program`).toBe(ref.key);
        expect
          .soft(Math.abs(c.mix - ref.mix), `${at}: köprü ilerlemesi`)
          .toBeLessThanOrEqual(0.002);
        expect
          .soft(rectDiff(c.panel, ref.panel), `${at}: panel dikdörtgeni`)
          .toBeLessThanOrEqual(1);
      }
      note(info, 'K-CHOREO-3 sıçrama', jumps);
    });

    test('K-CONTACT-3 sayfa sonunda panel zsh (contact) programında; yazılan adres DOM’daki mailto adresiyle aynı', async ({
      page,
    }) => {
      await openHome(page);
      const m = await measure(page);
      await stepTo(page, m.maxScroll, 0.9);
      const s = await kodAt(page);
      expect.soft(s.shown, 'panel görünür').toBe(true);
      expect.soft(s.key, 'program').toBe('contact');
      expect.soft(s.anchor.at, 'çapa').toBe('contact-ring');
      const mail = await page.evaluate(() => ({
        data:
          (
            (window as unknown as StageWindow).__stage.store.getState().data as {
              kod?: { email?: string };
            } | null
          )?.kod?.email ?? null,
        dom: [
          ...document.querySelectorAll<HTMLAnchorElement>(
            '[data-chapter="contact"] a[href^="mailto:"]',
          ),
        ].map((a) =>
          decodeURIComponent((a.getAttribute('href') ?? '').slice(7).split('?')[0] ?? ''),
        ),
        panel:
          document.querySelector('[data-stage-anchor="contact-ring"] .kod-panel')?.textContent ??
          '',
      }));
      expect(mail.dom.length, 'contact’ta mailto bağlantısı').toBeGreaterThan(0);
      for (const d of mail.dom)
        expect.soft(mail.data, 'panelin yazdığı adres = DOM mailto').toBe(d);
      expect.soft(mail.panel, 'zsh son karesi: $ mail <e-posta>').toContain(`mail ${mail.data}`);
    });
  },
);

test.describe(
  'K-CHOREO-4 yol bağımsızlığı (kaydırarak gel = o konumda yeniden yükle)',
  { tag: ['@desktop-chromium'] },
  () => {
    // canlı sahne her yeniden yüklemede yeniden kurulur (CI'da yavaş): bölümler üç teste bölünür
    for (const group of [
      ['hero', 'about'],
      ['areas', 'work'],
      ['journey', 'contact'],
    ]) {
      test(`K-CHOREO-4 ${group.join(' / ')}: bölüm başına 3 konum; program ve adım birebir, panel dikdörtgeni ± 2 px`, async ({
        page,
      }, info) => {
        await openHome(page);
        const m = await measure(page);
        const diffs: string[] = [];
        for (const id of group) {
          const [y0, y1] = chapterRange(m, id);
          for (const f of [0.2, 0.5, 0.8]) {
            const y = y0 + f * (y1 - y0);
            await test.step(`${id} p ${f} (s ${fmt(svh(m, y))})`, async () => {
              await stepTo(page, y);
              const a = await kodAt(page);
              await page.reload();
              await ready(page);
              const b = await kodAt(page);
              const at = `${id} s ${fmt(svh(m, a.y))}`;
              const pairA = `${a.anchor.from}→${a.anchor.to}`;
              const pairB = `${b.anchor.from}→${b.anchor.to}`;
              const same =
                Math.abs(b.y - a.y) <= 1 &&
                pairA === pairB &&
                Math.abs(b.anchor.mix - a.anchor.mix) <= 0.01 &&
                b.shown === a.shown &&
                (!a.shown || (b.key === a.key && rectDiff(a.panel, b.panel) <= 2));
              if (!same)
                diffs.push(
                  `${at}: kaydırarak ${pairA} ${fmt(a.anchor.mix)} "${a.key}" ${a.shown ? rectStr(a.panel) : 'yok'}; yeniden yüklemede ${pairB} ${fmt(b.anchor.mix)} "${b.key}" ${b.shown ? rectStr(b.panel) : 'yok'}`,
                );
              expect
                .soft(Math.abs(b.y - a.y), `${at}: geri yüklenen kaydırma ${b.y} ≠ ${a.y}`)
                .toBeLessThanOrEqual(1);
              expect.soft(pairB, `${at}: çapa çifti`).toBe(pairA);
              expect
                .soft(Math.abs(b.anchor.mix - a.anchor.mix), `${at}: anchorMix`)
                .toBeLessThanOrEqual(0.01);
              expect
                .soft(Math.abs(b.opacity - a.opacity), `${at}: --scene-opacity`)
                .toBeLessThanOrEqual(0.02);
              expect.soft(b.shown, `${at}: panel görünürlüğü`).toBe(a.shown);
              if (!a.shown || !b.shown) return;
              expect.soft(b.key, `${at}: program ve adım`).toBe(a.key);
              expect
                .soft(
                  rectDiff(a.panel, b.panel),
                  `${at}: panel ${rectStr(a.panel)} / ${rectStr(b.panel)}`,
                )
                .toBeLessThanOrEqual(2);
            });
          }
        }
        note(info, 'K-CHOREO-4 farklar', diffs.length ? diffs : 'yok');
      });
    }
  },
);

test.describe(
  'K-CHOREO-6 panel metnin arkasında değil (1440×900)',
  { tag: ['@desktop-chromium'] },
  () => {
    for (const group of [
      ['hero', 'about', 'areas'],
      ['work', 'journey', 'testimonials', 'contact'],
    ])
      test(`K-CHOREO-6 ${group.filter((g) => g !== 'testimonials').join(' / ')}: bölüm başına 10 konumda panel dikdörtgeni hiçbir metin satırıyla kesişmez (hero H1 hariç)`, async ({
        page,
      }, info) => {
        await openHome(page);
        await panelNotOverText(page, info, '1440×900', group);
      });

    test('K-ABOUT-3 hero → areas IN boyunca 5 svh adımlarla panel about metnine binmez', async ({
      page,
    }, info) => {
      await openHome(page);
      const m = await measure(page);
      const end = yAt(m, 'areas', 'in', 1);
      let checked = 0;
      for (let y = 0; y <= end + 1; y += 0.05 * m.vh) {
        await stepTo(page, y, 0.5, false);
        const r = await panelVsText(page, '[data-chapter="about"]');
        if (r.shown) checked++;
        for (const o of r.offenders.filter((x) => x.textOverlap > 0.5))
          expect
            .soft(
              o.textOverlap,
              `s ${fmt(svh(m, r.y))}: ${o.sel} "${o.text}" metnine ${o.textOverlap} px (panel ${rectStr(r.panel)} "${r.key}")`,
            )
            .toBeLessThanOrEqual(0.5);
      }
      note(info, 'K-ABOUT-3 panel görünür konum', checked);
    });
  },
);

test.describe(
  'K-CHOREO-6 panel metnin arkasında değil (390×844)',
  { tag: ['@desktop-chromium'] },
  () => {
    test.use({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    for (const group of [
      ['hero', 'about', 'areas'],
      ['work', 'journey', 'testimonials', 'contact'],
    ])
      test(`K-CHOREO-6 mobil ${group.filter((g) => g !== 'testimonials').join(' / ')}: bölüm başına 10 konumda panel dikdörtgeni hiçbir metin satırıyla kesişmez`, async ({
        page,
      }, info) => {
        await openHome(page, HOME_MOBILE);
        await panelNotOverText(page, info, '390×844', group);
      });
  },
);

test.describe('I2 reveal zamanlaması (§13.3.5)', { tag: ['@desktop-chromium'] }, () => {
  test('I2 reveals complete before 75% (readingScroll, 10 svh/s)', async ({ page }, info) => {
    await openHome(page, HOME_TARGET);
    const m = await measure(page);
    await installRevealProbe(page, 'scroll');
    await readingScroll(page, 0, Math.ceil(svh(m, m.maxScroll)));
    assertRevealHits(info, 'I2 readingScroll', await revealHits(page));
  });

  // readingScroll her adımda anında window.scrollTo yapar; Chrome her birinde scrollend yayar ve §5.14.6 süpürmesi
  // görünüme giren öğeyi anında açar. Gerçek tetikleyicileri (top 88% / top 75%) tekerlek + Lenis sınar.
  test('I2 reveals complete before 75% (tekerlek + Lenis, 10 svh/s)', async ({ page }, info) => {
    await openHome(page, HOME_TARGET);
    const m = await measure(page);
    await page.mouse.move(24, 450); // pencerede (Lenis tekerleği) ama içeriğin dışında: hover efektleri ölçüme girmez
    await installRevealProbe(page, 'interval');
    await wheelTo(page, m.maxScroll);
    assertRevealHits(info, 'I2 tekerlek', await revealHits(page));
  });
});

test.describe(
  'I3 dwell sabitliği (§13.3.5, §4.12.2 #5, K-AREAS-5)',
  { tag: ['@desktop-chromium'] },
  () => {
    test('I3 dwell stillness: areas adım ve journey girdi dwell’lerinde program, adım ve panel dikdörtgeni sabit; work dwell’lerinde panel yok', async ({
      page,
    }, info) => {
      await openHome(page);
      await page.mouse.move(-1, -1); // işaretçi pencere dışında (hareketsiz)
      const m = await measure(page);
      const a = m.areas;
      expect(a, 'areas pin etkin').not.toBeNull();
      if (!a) return;
      const windows: {
        kind: 'areas' | 'work' | 'journey';
        name: string;
        y0: number;
        y1: number;
        key: string | null;
      }[] = [];
      // areas: adım k'nın dönüş sonundan sonraki adımın başına (s 250–300, 315–350, 365–400, 415–450 referans)
      for (let k = 0; k < a.N; k++)
        windows.push({
          kind: 'areas',
          name: `areas dwell ${k}`,
          y0: areasY(m, k === 0 ? 10 : 10 + a.S * k + 0.3 * a.S),
          y1: areasY(m, 10 + a.S * (k + 1)),
          key: `area:${k}`,
        });
      for (const kind of ['work', 'journey'] as const) {
        const body = phaseOf(m, kind, 'body');
        const lines = m.activation[kind];
        lines.forEach((l, k) => {
          const y0 = Math.max(l, body.y0);
          const y1 = Math.min(lines[k + 1] ?? Infinity, body.y1);
          if (y1 - y0 > 0.02 * m.vh)
            windows.push({
              kind,
              name: `${kind} ${kind === 'work' ? 'makale' : 'girdi'} ${k + 1}`,
              y0,
              y1,
              key: kind === 'work' ? null : `journey:${k}`,
            });
        });
      }
      const report: string[] = [];
      for (const w of windows) {
        await test.step(`${w.name} (s ${fmt(svh(m, w.y0))}–${fmt(svh(m, w.y1))})`, async () => {
          const pts: KodState[] = [];
          for (let i = 0; i < 5; i++) {
            await stepTo(page, w.y0 + ((i + 0.5) / 5) * (w.y1 - w.y0), 0.5, false);
            pts.push(await kodAt(page));
          }
          const first = pts[0];
          if (!first) return;
          report.push(
            `${w.name}: ${w.key === null ? `opaklık ${pts.map((p) => fmt(p.opacity)).join('/')}` : `"${first.key}" ${rectStr(first.panel)}`}`,
          );
          for (const p of pts) {
            const at = `${w.name} s ${fmt(svh(m, p.y))}`;
            if (w.key === null) {
              // K-WORK-6: work'te panel yok; sahne sönük, kare çizilmez
              expect.soft(p.opacity, `${at}: panel yok (sahne sönük)`).toBeLessThanOrEqual(0.01);
              continue;
            }
            expect.soft(p.shown, `${at}: panel görünür`).toBe(true);
            expect.soft(p.key, `${at}: program ve adım`).toBe(w.key);
            expect
              .soft(
                rectDiff(p.panel, first.panel),
                `${at}: panel ${rectStr(p.panel)} ≠ ${rectStr(first.panel)} (dwell'de kaydırma kaynaklı değişim yok)`,
              )
              .toBeLessThanOrEqual(0.5);
          }
        });
      }
      note(info, 'I3 dwell pencereleri', report);
    });
  },
);

test.describe('K-GEN-9 / K-CHOREO-5 kesme kuralı (§5.9.7)', { tag: ['@desktop-chromium'] }, () => {
  test('K-GEN-9 header’dan uzak atlama (#giris → #yolculuk) ≤ 150 ms’de söner, varışta ≤ 250 ms’de döner; komşu atlama (#giris → #ben) sönmez', async ({
    page,
  }, info) => {
    await page.addInitScript(recordScene);
    await openHome(page);
    await clearRecords(page);
    await page.locator('header a[href="#yolculuk"]').first().click();
    await settle(page, 600);
    await cutDone(page);
    const fin = await kodAt(page);
    let rec = await records(page);
    const t0 = rec.find((r) => r.kind === 'click')?.t ?? 0;
    const far = cutTiming(rec, t0, 'arrive', 'op', fin);
    note(info, 'K-GEN-9 uzak atlama (ms)', far);
    note(info, 'K-GEN-9 uzak atlama zaman çizelgesi', timeline(rec, t0));
    expect(far.reachedZero, 'uzak atlamada --scene-opacity 0’a iner').toBe(true);
    expect
      .soft(far.stale, 'varışta sahne görünürken rig varış karesini çizmiş olmalı (eski kare yok)')
      .toEqual([]);
    expect
      .soft(
        far.dropFrameFree,
        `sönme: tıklamadan ${fmt(far.dropFrameFree)} ms sonra hâlâ > 0 (ham ${fmt(far.dropRaw ?? undefined)} ms)`,
      )
      .toBeLessThanOrEqual(150);
    expect
      .soft(
        far.backFrameFree ?? Number.NaN,
        `geri gelme: varıştan ${fmt(far.backFrameFree ?? undefined)} ms sonra hâlâ < 1 (ham ${fmt(far.backRaw ?? undefined)} ms)`,
      )
      .toBeLessThanOrEqual(250);
    expect.soft(far.flash, 'atlama sürerken sahne görünmez kalır').toBe(0);
    expect.soft(fin.key, 'varış: journey programı').toMatch(/^journey:-?\d+$/);
    const top = await page.evaluate(() => {
      const pad =
        Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      return document.getElementById('yolculuk')!.getBoundingClientRect().top - pad;
    });
    expect.soft(Math.abs(top), 'varış: #yolculuk başı scroll-padding’de').toBeLessThanOrEqual(2);

    // komşu atlama: başa dön (anında sıçrama kendi kesmesini yapar; bitmesini bekle), sonra #giris → #ben. Hedef
    // about'ta opacityTrack 1'dir: sahne görünür kalır ve kesme yoktur (opacityCut 1)
    await jumpTo(page, 0);
    await clearRecords(page);
    await page.locator('header a[href="#ben"]').first().click();
    await settle(page, 600);
    rec = await records(page);
    const t1 = rec.find((r) => r.kind === 'click')?.t ?? 0;
    const near = cutTiming(rec, t1, 'arrive');
    note(info, 'K-GEN-9 komşu atlama', {
      minOp: near.minOp,
      minCut: near.minCut,
      finalY: near.finalY,
    });
    expect.soft(near.minOp, 'komşu atlamada --scene-opacity 0’a inmez').toBeGreaterThan(0.01);
    expect
      .soft(near.minCut, 'komşu atlamada kesme yok (opacityCut 1)')
      .toBeGreaterThanOrEqual(0.999);
  });

  test('K-CHOREO-5 proje sayfasından geri: kaydırma ± 2 svh, sahne keser (100 / 200 ms), morf yeniden oynamaz; ileri en üstte', async ({
    page,
  }, info) => {
    await page.addInitScript(recordScene);
    await openHome(page);
    const m = await measure(page);
    const y = await page.evaluate(() => {
      const a = document.querySelectorAll<HTMLElement>('[data-work-article]')[1]!;
      return a.getBoundingClientRect().top + window.scrollY - 0.1 * window.innerHeight;
    });
    await stepTo(page, y);
    const before = await kodAt(page);
    const link = page.locator('[data-work-article]').nth(1).locator('a[href^="/projeler/"]');
    const href = (await link.getAttribute('href')) ?? '';
    await link.click();
    await page.waitForURL(`**${href}`);
    await settle(page, 600);
    await cutDone(page);
    const projectOpacity = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.getElementById('scene-layer')!).opacity),
    );
    await clearRecords(page);
    await page.goBack();
    await page.waitForURL((u) => u.pathname === '/');
    await settle(page, 600);
    await cutDone(page);
    const after = await kodAt(page);
    const rec = await records(page);
    const pop = rec.find((r) => r.kind === 'popstate')?.t ?? rec[0]?.t ?? 0;
    const t = cutTiming(rec, pop, 'zero', 'op', after);
    // work'te panel yoktur (K-WORK-6): --scene-opacity orada zaten 0'dır; belirme kesme çarpanında (opacityCut) ölçülür
    const dark = after.opacity <= 0.01;
    const back = dark ? cutTiming(rec, pop, 'zero', 'cut') : t;
    note(info, 'K-CHOREO-5 rota geri (ms)', {
      projeSayfasiOpaklik: projectOpacity,
      belirmeOlcutu: dark ? 'opacityCut (work: sahne sönük)' : '--scene-opacity',
      ...t,
      belirme: {
        reachedZero: back.reachedZero,
        backRaw: back.backRaw,
        backFrameFree: back.backFrameFree,
      },
    });
    note(info, 'K-CHOREO-5 rota geri zaman çizelgesi', timeline(rec, pop));
    expect
      .soft(Math.abs(svh(m, after.y - before.y)), `geri: kaydırma ${after.y} ≠ ${before.y}`)
      .toBeLessThanOrEqual(2);
    if (projectOpacity > 0.01) {
      expect(t.reachedZero, 'geri: sahne söner').toBe(true);
      expect
        .soft(t.dropFrameFree, `geri: popstate’ten ${fmt(t.dropFrameFree)} ms sonra hâlâ > 0`)
        .toBeLessThanOrEqual(100);
    } else note(info, 'K-CHOREO-5', 'proje sayfasında sahne zaten gizli (opaklık 0): sönme anlık');
    expect(back.reachedZero, 'geri: kesme (opacityCut 0 → 1)').toBe(true);
    // Görünür hedefte belirme ≤ 200 ms'dir (§5.9.7). work'te sahne sönüktür (--scene-opacity 0, K-WORK-6): belirme
    // görünmez ve ana sayfanın yeniden kurulduğu yerel düzen/boyama işine denk gelebilir (PR #15 CI); orada yalnız
    // kesmenin takılmadan bittiği denetlenir (snapNextFrame tüketilmezse 1.5 s'lik SNAP_WAIT beklenirdi).
    expect
      .soft(
        back.backFrameFree ?? Number.NaN,
        `geri: oturmadan ${fmt(back.backFrameFree ?? undefined)} ms sonra hâlâ < 1 (ham ${fmt(back.backRaw ?? undefined)} ms)`,
      )
      .toBeLessThanOrEqual(dark ? 1000 : 200);
    const morph = rec.filter(
      (r) => r.t >= pop && r.kind.startsWith('vt ') && /project-cover/.test(r.kind),
    );
    expect
      .soft(
        morph.map((r) => r.kind),
        'project-cover-* morph’u yeniden oynamaz',
      )
      .toEqual([]);
    expect
      .soft(t.stale, 'sahne görünürken rig dönüş karesini çizmiş olmalı (eski kare yok)')
      .toEqual([]);
    // dinlenmiş durum (§4.12.2 #3): çapa çifti, opaklık ve (görünürse) program ve panel aynı
    expect
      .soft(`${after.anchor.from}→${after.anchor.to}`, 'geri: çapa çifti')
      .toBe(`${before.anchor.from}→${before.anchor.to}`);
    expect
      .soft(Math.abs(after.anchor.mix - before.anchor.mix), 'geri: anchorMix')
      .toBeLessThanOrEqual(0.01);
    expect
      .soft(Math.abs(after.opacity - before.opacity), 'geri: --scene-opacity')
      .toBeLessThanOrEqual(0.02);
    expect.soft(after.shown, 'geri: panel görünürlüğü').toBe(before.shown);
    if (after.shown && before.shown) {
      expect.soft(after.key, 'geri: program').toBe(before.key);
      expect.soft(rectDiff(after.panel, before.panel), 'geri: panel').toBeLessThanOrEqual(2);
    }
    await page.goForward();
    await page.waitForURL(`**${href}`);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { message: 'ileri: en üstte' })
      .toBe(0);
  });

  test('K-CHOREO-5 sayfa içi geri (#yolculuk → geri): sahne keser, eski kare görünmez', async ({
    page,
  }, info) => {
    await page.addInitScript(recordScene);
    await openHome(page);
    await page.locator('header a[href="#yolculuk"]').first().click();
    await settle(page, 600);
    await cutDone(page);
    await clearRecords(page);
    await page.goBack();
    await settle(page, 600);
    await cutDone(page);
    const fin = await kodAt(page);
    const rec = await records(page);
    const pop = rec.find((r) => r.kind === 'popstate')?.t ?? rec[0]?.t ?? 0;
    const t = cutTiming(rec, pop, 'zero', 'op', fin);
    note(info, 'K-CHOREO-5 çapa geri (ms)', t);
    note(info, 'K-CHOREO-5 çapa geri zaman çizelgesi', timeline(rec, pop));
    expect
      .soft(await page.evaluate(() => window.scrollY), 'geri: başa dönüldü')
      .toBeLessThanOrEqual(2);
    expect.soft(fin.key, 'geri: hero programı').toBe('hero');
    expect(t.reachedZero, 'geri: sahne söner').toBe(true);
    expect
      .soft(t.dropFrameFree, `geri: popstate’ten ${fmt(t.dropFrameFree)} ms sonra hâlâ > 0`)
      .toBeLessThanOrEqual(100);
    expect
      .soft(
        t.backFrameFree ?? Number.NaN,
        `geri: oturmadan ${fmt(t.backFrameFree ?? undefined)} ms sonra hâlâ < 1 (ham ${fmt(t.backRaw ?? undefined)} ms)`,
      )
      .toBeLessThanOrEqual(200);
    expect
      .soft(t.stale, 'sahne görünürken rig dönüş karesini çizmiş olmalı (eski kare yok)')
      .toEqual([]);
  });

  test('K-CHOREO-5 çapa atlamasından sonra elle kaydırılan konum, proje sayfasından geri dönünce geri gelir (± 2 svh)', async ({
    page,
  }, info) => {
    await openHome(page);
    const m = await measure(page);
    await page.locator('header a[href="#yolculuk"]').first().click(); // URL #yolculuk olur
    await settle(page, 600);
    await cutDone(page);
    // ziyaretçi tekerlekle work'ün 2. makalesine geri çıkar
    const y = await page.evaluate(() => {
      const a = document.querySelectorAll<HTMLElement>('[data-work-article]')[1]!;
      return a.getBoundingClientRect().top + window.scrollY - 0.1 * window.innerHeight;
    });
    await page.mouse.move(24, 450); // pencerede (Lenis tekerleği) ama içeriğin dışında: hover efektleri ölçüme girmez
    for (let i = 0; i < 40; i++) {
      const cur = await page.evaluate(() => window.scrollY);
      if (cur <= y + 20) break;
      await page.mouse.wheel(0, -Math.min(450, cur - y));
      await pageDelay(page, 150);
    }
    await settle(page, 600);
    const before = await page.evaluate(() => window.scrollY);
    const link = page.locator('[data-work-article]').nth(1).locator('a[href^="/projeler/"]');
    const href = (await link.getAttribute('href')) ?? '';
    await link.click();
    await page.waitForURL(`**${href}`);
    await settle(page, 600);
    await page.goBack();
    await page.waitForURL((u) => u.pathname === '/');
    await settle(page, 600);
    const after = await page.evaluate(() => window.scrollY);
    note(info, 'K-CHOREO-5 çapa sonrası geri (svh)', {
      once: fmt(svh(m, before)),
      sonra: fmt(svh(m, after)),
      url: page.url(),
    });
    expect
      .soft(
        Math.abs(svh(m, after - before)),
        `geri: kaydırma s ${fmt(svh(m, after))}, ayrılırken s ${fmt(svh(m, before))} (URL ${page.url()})`,
      )
      .toBeLessThanOrEqual(2);
  });
});

test.describe('about ve areas (K-ABOUT-1/2, K-AREAS-3/4/6)', { tag: ['@desktop-chromium'] }, () => {
  test('K-ABOUT-1 about’ta panel about.dart’ı gösterir: köprüden sonra about:*, açılan blok oranı azalmaz, BODY sonunda dosya tam', async ({
    page,
  }) => {
    await openHome(page);
    const m = await measure(page);
    const pts: [string, number, RegExp][] = [
      ['about IN p 0.30 (hero → about köprüsü)', yAt(m, 'about', 'in', 0.3), /^hero>about:[\d.]+$/],
      ['about IN p 0.65', yAt(m, 'about', 'in', 0.65), /^about:[\d.]+$/],
      ['about IN sonu', yAt(m, 'about', 'in', 1), /^about:[\d.]+$/],
      ['about BODY p 0.5', yAt(m, 'about', 'body', 0.5), /^about:[\d.]+$/],
      ['about BODY sonu', yAt(m, 'about', 'body', 1), /^about:1$/],
    ];
    let last = 0;
    for (const [label, y, re] of pts) {
      await stepTo(page, y);
      const s = await kodAt(page);
      expect.soft(s.shown, `${label}: panel görünür`).toBe(true);
      expect.soft(s.key, `${label}: program`).toMatch(re);
      const reveal = Number(s.key.split('about:')[1] ?? Number.NaN);
      expect
        .soft(reveal, `${label}: about.dart açılan blok oranı (${s.key}) azalmaz`)
        .toBeGreaterThanOrEqual(last);
      last = Number.isFinite(reveal) ? reveal : last;
    }
  });

  test('K-ABOUT-2 lede bölünmez, global blok reveal’ıyla bir kez açılır (≤ 700 ms) ve geri kaydırmada kapanmaz', async ({
    page,
  }) => {
    await openHome(page, HOME_TARGET);
    const lede = page.locator('[data-chapter="about"] > p[data-reveal]');
    await expect(lede, 'about lede’i').toHaveCount(1);
    await expect(lede, 'global blok reveal’ı').toHaveAttribute('data-reveal', 'block');
    expect(await lede.locator('.split-line').count(), 'split-line yok').toBe(0);
    const ms = await lede.evaluate((el) =>
      Math.max(
        ...getComputedStyle(el)
          .transitionDuration.split(',')
          .map((d) => Number.parseFloat(d) * (d.trim().endsWith('ms') ? 1 : 1000)),
      ),
    );
    expect(ms, 'reveal süresi (transition-duration)').toBeLessThanOrEqual(700);
    // okuma hızında about'a gelinir: açılır ve tam görünür olur
    const m = await measure(page);
    await readingScroll(page, 0, Math.round(svh(m, phaseOf(m, 'about', 'body').y0)));
    await expect(lede).toHaveClass(/\bis-revealed\b/);
    await expect.poll(() => lede.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    // geri kaydırmada kapanmaz
    await jumpTo(page, 0);
    await expect(lede).toHaveClass(/\bis-revealed\b/);
    expect(await lede.evaluate((el) => getComputedStyle(el).opacity), 'başa dönünce').toBe('1');
  });

  test('K-AREAS-3 açıklama değişimleri sA(k) + 0.15·S’de (± 2 svh), sayaç ve aria-current aynı anda; K-AREAS-4 iki açıklama aynı anda görünmez', async ({
    page,
  }, info) => {
    await openHome(page, HOME_TARGET);
    const m = await measure(page);
    const a = m.areas;
    expect(a, 'areas pin etkin').not.toBeNull();
    if (!a) return;
    const changes: string[] = [];
    for (let k = 1; k < a.N; k++) {
      const sk = areasY(m, 10 + a.S * k + 0.15 * a.S);
      await test.step(`değişim ${k} (beklenen s ${fmt(svh(m, sk))})`, async () => {
        await stepTo(page, sk - 0.03 * m.vh);
        // ±3 svh, 0.25 svh adımlarla (kesme eşiğinin çok altında); her adımda iki kare sonra DOM durumu
        const states = await page.evaluate(
          async ({ from, to, step }) => {
            const s = document.querySelector('[data-chapter="areas"]')!;
            const idx = (sel: string, attr: string) =>
              Number(s.querySelector(sel)?.getAttribute(attr) ?? Number.NaN);
            const out: { y: number; active: number; current: number; counter: string }[] = [];
            for (let y = from; y <= to; y += step) {
              window.scrollTo({ top: Math.round(y), behavior: 'instant' });
              for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
              out.push({
                y: window.scrollY,
                active: idx('[data-area-desc][data-active]', 'data-area-desc'),
                current: idx('[data-area-step][aria-current="step"]', 'data-area-step'),
                counter: s.querySelector('[data-areas-counter]')?.textContent ?? '',
              });
            }
            return out;
          },
          { from: sk - 0.03 * m.vh, to: sk + 0.03 * m.vh, step: 0.0025 * m.vh },
        );
        let found: number | null = null;
        for (const st of states) {
          expect
            .soft(st.counter, `s ${fmt(svh(m, st.y))}: sayaç etkin adımla aynı`)
            .toBe(`${pad(st.active + 1)} / ${pad(a.N)}`);
          expect
            .soft(st.current, `s ${fmt(svh(m, st.y))}: aria-current="step" etkin adımda`)
            .toBe(st.active);
          if (found === null && st.active === k) found = st.y;
        }
        expect(found, `adım ${k} ±3 svh içinde etkinleşir`).not.toBeNull();
        changes.push(`${k}: ${fmt(svh(m, found ?? Number.NaN))} (beklenen ${fmt(svh(m, sk))})`);
        expect
          .soft(Math.abs(svh(m, (found ?? Number.NaN) - sk)), `adım ${k} değişim konumu`)
          .toBeLessThanOrEqual(2);
      });
    }
    note(info, 'K-AREAS-3 değişim konumları (svh)', changes);

    // K-AREAS-4: değişim boyunca (aşağı ve yukarı) 20 ms aralıklı örneklemede en çok bir açıklama opacity > 0
    for (const [k, dir] of [
      [1, 1],
      [2, 1],
      [3, 1],
      [2, -1],
    ] as const) {
      if (k >= a.N) continue;
      const sk = areasY(m, 10 + a.S * k + 0.15 * a.S);
      await stepTo(page, sk - dir * 0.02 * m.vh);
      const worst = await page.evaluate(
        async (top) => {
          const descs = [...document.querySelectorAll<HTMLElement>('[data-area-desc]')];
          let max = 0;
          let at = '';
          const sample = () => {
            const on = descs
              .map((d) => Number.parseFloat(getComputedStyle(d).opacity))
              .filter((o) => o > 0);
            if (on.length > max) {
              max = on.length;
              at = on.map((o) => o.toFixed(2)).join(', ');
            }
          };
          const id = window.setInterval(sample, 20);
          window.scrollTo({ top, behavior: 'instant' });
          await new Promise((r) => setTimeout(r, 1000));
          window.clearInterval(id);
          return { max, at };
        },
        Math.round(sk + dir * 0.02 * m.vh),
      );
      expect
        .soft(
          worst.max,
          `K-AREAS-4 adım ${k} ${dir > 0 ? 'aşağı' : 'yukarı'}: aynı anda görünen açıklamalar (${worst.at})`,
        )
        .toBeLessThanOrEqual(1);
    }
  });

  test('K-AREAS-3 (panel) program adımı açıklama, sayaç ve aria-current ile aynı karede değişir (aşağı ve yukarı)', async ({
    page,
  }, info) => {
    await openHome(page);
    const m = await measure(page);
    const a = m.areas;
    expect(a, 'areas pin etkin').not.toBeNull();
    if (!a) return;
    const changes: string[] = [];
    for (const [k, dir] of [
      [1, 1],
      [2, 1],
      [3, 1],
      [2, -1],
    ] as const) {
      if (k >= a.N) continue;
      const sk = areasY(m, 10 + a.S * k + 0.15 * a.S);
      await test.step(`adım ${k} ${dir > 0 ? 'aşağı' : 'yukarı'} (beklenen s ${fmt(svh(m, sk))})`, async () => {
        const from = sk - dir * 0.02 * m.vh;
        await stepTo(page, from);
        // ±2 svh, 0.5 svh adımlarla; her adımda iki kare (yönetmen, areas:step) ve rig'in o kaydırmadaki karesi
        const states = await page.evaluate(
          async ({ start, step, n }) => {
            const st = (window as unknown as StageWindow).__stage;
            const s = document.querySelector('[data-chapter="areas"]')!;
            const idx = (sel: string, attr: string) =>
              Number(s.querySelector(sel)?.getAttribute(attr) ?? Number.NaN);
            const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
            const out: {
              y: number;
              active: number;
              current: number;
              counter: string;
              key: string;
            }[] = [];
            for (let i = 0; i <= n; i++) {
              window.scrollTo({ top: Math.round(start + i * step), behavior: 'instant' });
              await frame();
              await frame();
              if (st.store.getState().loop !== 'never') {
                const f0 = st.live.frames;
                st.store.getState().invalidate();
                const t0 = performance.now();
                while (st.live.frames === f0 && performance.now() - t0 < 10_000) await frame();
              }
              out.push({
                y: window.scrollY,
                active: idx('[data-area-desc][data-active]', 'data-area-desc'),
                current: idx('[data-area-step][aria-current="step"]', 'data-area-step'),
                counter: s.querySelector('[data-areas-counter]')?.textContent ?? '',
                key: st.live.kod.key,
              });
            }
            return out;
          },
          { start: from, step: dir * 0.005 * m.vh, n: 8 },
        );
        let flip: number | null = null;
        states.forEach((st, i) => {
          const at = `s ${fmt(svh(m, st.y))}`;
          expect
            .soft(st.key, `${at}: program adımı = etkin açıklama ${st.active}`)
            .toBe(`area:${st.active}`);
          expect.soft(st.current, `${at}: aria-current="step" etkin adımda`).toBe(st.active);
          expect
            .soft(st.counter, `${at}: sayaç etkin adımla aynı`)
            .toBe(`${pad(st.active + 1)} / ${pad(a.N)}`);
          if (flip === null && i > 0 && st.active !== states[i - 1]?.active) flip = st.y;
        });
        expect(flip, `adım ${k} ±2 svh içinde değişir`).not.toBeNull();
        changes.push(
          `${k} ${dir > 0 ? '↓' : '↑'}: ${fmt(svh(m, flip ?? Number.NaN))} (beklenen ${fmt(svh(m, sk))})`,
        );
        expect
          .soft(Math.abs(svh(m, (flip ?? Number.NaN) - sk)), `adım ${k} değişim konumu`)
          .toBeLessThanOrEqual(2);
      });
    }
    note(info, 'K-AREAS-3 panel değişim konumları (svh)', changes);
  });

  test('K-AREAS-6 başlık tıklaması 0.8 s içinde sA(k) + 0.65·S’ye (± 2 svh); etkin olmayan açıklamaya focusin o adıma kaydırır', async ({
    page,
  }, info) => {
    await page.addInitScript(recordScene);
    await openHome(page, HOME_TARGET);
    const m = await measure(page);
    const a = m.areas;
    expect(a, 'areas pin etkin').not.toBeNull();
    if (!a) return;
    const k = Math.min(2, a.N - 1);
    await stepTo(page, areasY(m, 10 + 0.5 * a.S)); // dwell 0
    await clearRecords(page);
    await page.locator(`[data-area-step="${k}"]`).click();
    await settle(page, 600);
    const rec = await records(page);
    const t0 = rec.find((r) => r.kind === 'click')?.t ?? 0;
    // kaydırma konumu kare örneklerinden ('scroll' olayı yazımdan bir kare sonra gelir); varış ±1 px
    const { arrive, prevMove } = arrival(rec, t0);
    const last = arrive === undefined ? undefined : { t: arrive };
    const prev = prevMove === undefined ? undefined : { t: prevMove };
    const want = areasY(m, 10 + a.S * k + 0.65 * a.S);
    const y = await page.evaluate(() => window.scrollY);
    note(info, 'K-AREAS-6 tıklama', {
      sure: last ? fmt(last.t - t0) : null,
      sonundanOnceki: prev ? fmt(prev.t - t0) : null,
      varis: fmt(svh(m, y)),
      beklenen: fmt(svh(m, want)),
    });
    expect
      .soft(Math.abs(svh(m, y - want)), `tıklama varışı s ${fmt(svh(m, y))}`)
      .toBeLessThanOrEqual(2);
    // kaydırma animasyonunun kendi süresi: ilk hareket karesinden son anlamlı harekete ≤ 800 ms. Tıklamadan ilk
    // harekete kadar geçen süre (yazılım render'ında bir kare ≈ 60–500 ms) ölçüme katılmaz.
    const startY = rec.filter((r) => r.kind === 'raf' && r.t <= t0).at(-1)?.y;
    const firstMove = rec.find(
      (r) => r.kind === 'raf' && r.t >= t0 && startY !== undefined && Math.abs(r.y - startY) > 1,
    )?.t;
    expect
      .soft(
        (prev?.t ?? t0) - (firstMove ?? t0),
        `tıklama: kaydırma ${fmt(last ? last.t - t0 : undefined)} ms’de bitti; ilk hareket ${fmt(firstMove === undefined ? undefined : firstMove - t0)} ms, sondan önceki hareket ${fmt(prev ? prev.t - t0 : undefined)} ms (0.8 s)`,
      )
      .toBeLessThanOrEqual(800);

    const j = a.N - 1;
    await page.locator(`[data-area-desc="${j}"] a`).first().focus();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).not.toBe(y);
    await settle(page, 600);
    const y2 = await page.evaluate(() => window.scrollY);
    const want2 = areasY(m, 10 + a.S * j + 0.65 * a.S);
    expect
      .soft(
        Math.abs(svh(m, y2 - want2)),
        `focusin varışı s ${fmt(svh(m, y2))}, beklenen ${fmt(svh(m, want2))}`,
      )
      .toBeLessThanOrEqual(2);
    await expect(page.locator('[data-area-desc][data-active]')).toHaveAttribute(
      'data-area-desc',
      String(j),
    );
  });
});

test.describe('work (K-WORK-1/2/3)', { tag: ['@desktop-chromium'] }, () => {
  test('K-WORK-2 aktivasyonlar T_work − 25 + 70k svh’de (± 2): silme ya da ASCII derlemesi başlar; K-WORK-1 BODY’de silme dışında tam bir figür açık', async ({
    page,
  }, info) => {
    await openHome(page, HOME_TARGET);
    const m = await measure(page);
    const T = m.chapters.find((x) => x.id === 'work')!.top;
    // Derleme kaplaması yalnız çözülmüş kapakta çizilir (§4.9.4): tembel kapaklar önceden yüklenir
    await page.evaluate(() =>
      Promise.all(
        [...document.querySelectorAll<HTMLImageElement>('[data-work-figure] img')].map((img) => {
          img.loading = 'eager';
          return img.decode().catch(() => undefined);
        }),
      ),
    );
    // Etkinleşme izi (work:active, §5.9.5): figür k'ya data-active eklenir (silme başlar, k ≥ 1) ya da kapağına ASCII
    // derleme kanvası eklenir (proje 1'in figürü ilk boyamadan beri açıktır: tek iz derlemedir)
    await page.evaluate(() => {
      const hits: { k: number; y: number; what: string }[] = [];
      (window as unknown as { __work: typeof hits }).__work = hits;
      const figs = [...document.querySelectorAll<HTMLElement>('[data-work-figure]')];
      const on = figs.map((f) => f.hasAttribute('data-active'));
      new MutationObserver((list) => {
        for (const r of list) {
          if (r.type === 'attributes') {
            const k = figs.indexOf(r.target as HTMLElement);
            if (k < 0) continue;
            const now = figs[k]?.hasAttribute('data-active') ?? false;
            if (now && !on[k]) hits.push({ k, y: window.scrollY, what: 'silme' });
            on[k] = now;
          } else
            for (const n of r.addedNodes)
              if (n instanceof HTMLCanvasElement && n.classList.contains('ascii-compile'))
                hits.push({
                  k: figs.findIndex((f) => f.contains(n)),
                  y: window.scrollY,
                  what: 'derleme',
                });
        }
      }).observe(document.querySelector('[data-chapter="work"]')!, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-active'],
      });
    });
    const found: string[] = [];
    for (let k = 0; k < m.counts.P; k++) {
      // DOM sayımı: başlık bloğu 30 svh + makale 70 svh, aktivasyon "top 55%" (§4.9.3, §5.9.5)
      const sk = T + (0.3 + 0.7 * k - 0.55) * m.vh;
      await test.step(`proje ${k + 1} (beklenen s ${fmt(svh(m, sk))})`, async () => {
        await stepTo(page, sk - 0.03 * m.vh);
        await page.evaluate(() => {
          (window as unknown as { __work: unknown[] }).__work.length = 0;
        });
        await page.evaluate(
          async ({ from, to, step }) => {
            for (let y = from; y <= to; y += step) {
              window.scrollTo({ top: Math.round(y), behavior: 'instant' });
              for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
            }
          },
          { from: sk - 0.03 * m.vh, to: sk + 0.03 * m.vh, step: 0.0025 * m.vh },
        );
        const hits = await page.evaluate(() =>
          (
            window as unknown as { __work: { k: number; y: number; what: string }[] }
          ).__work.slice(),
        );
        const hit = hits.find((h) => h.k === k);
        found.push(
          `${k + 1}: ${fmt(hit ? svh(m, hit.y) : undefined)} ${hit?.what ?? ''} (beklenen ${fmt(svh(m, sk))}; izler ${hits.map((h) => `${h.k + 1} ${h.what}`).join(', ') || 'yok'})`,
        );
        expect(hit, `proje ${k + 1} ±3 svh içinde etkinleşir (silme ya da derleme)`).toBeDefined();
        expect
          .soft(Math.abs(svh(m, (hit?.y ?? Number.NaN) - sk)), `proje ${k + 1} aktivasyon konumu`)
          .toBeLessThanOrEqual(2);
      });
    }
    note(info, 'K-WORK-2 aktivasyon (svh)', found);

    // K-WORK-1: BODY boyunca 10 svh adımla; silme bitince (satır içi clip-path yok) tam bir figür açık ve o etkin proje
    const body = phaseOf(m, 'work', 'body');
    for (let y = body.y0; y <= body.y1 + 1; y += 0.1 * m.vh) {
      await stepTo(page, y);
      await page.waitForFunction(() =>
        [...document.querySelectorAll<HTMLElement>('[data-work-figure]')].every(
          (f) => !f.style.clipPath,
        ),
      );
      const open = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-work-figure]')].map((f) => {
          const c = getComputedStyle(f).clipPath;
          return c === 'none' || /^inset\(0(px)?\)$/.test(c);
        }),
      );
      const yy = await page.evaluate(() => window.scrollY);
      const k = Math.max(0, indexAt(m.activation.work, yy));
      expect.soft(open.filter(Boolean).length, `s ${fmt(svh(m, yy))}: açık figür sayısı`).toBe(1);
      expect.soft(open[k], `s ${fmt(svh(m, yy))}: etkin figür ${k + 1} açık`).toBe(true);
    }
  });

  test('K-WORK-3 makale bağlantıları; başlık ve bağlantılar aktivasyondan ≥ 20 svh önce tamamen açık (tekerlek, 10 svh/s)', async ({
    page,
    context,
  }, info) => {
    await openHome(page, HOME_TARGET);
    const m = await measure(page);
    const d = await stageData(page);
    // bağlantılar: "Projeyi incele →" proje sayfasına; mağaza bağlantıları projenin links listesiyle aynı; video yok
    const articles = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-work-article]')].map((a) => ({
        project: [...a.querySelectorAll<HTMLAnchorElement>('a[href^="/projeler/"]')].map((l) => ({
          href: l.getAttribute('href'),
          text: l.textContent?.trim() ?? '',
        })),
        external: [...a.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')].map((l) => ({
          href: l.href,
          text: l.textContent?.trim() ?? '',
        })),
      })),
    );
    const other = await context.newPage();
    for (const [k, a] of articles.entries()) {
      const slug = d.projects[k]?.slug ?? '';
      expect
        .soft(
          a.project.map((l) => l.href),
          `makale ${k + 1}: proje bağlantısı`,
        )
        .toEqual([`/projeler/${slug}`]);
      expect
        .soft(a.project[0]?.text ?? '', `makale ${k + 1}: bağlantı metni`)
        .toMatch(/^Projeyi incele/);
      for (const l of a.external)
        expect
          .soft(l.text, `makale ${k + 1}: dış bağlantı yalnız mağaza`)
          .toMatch(/^(App Store|Google Play|AppGallery)/);
      await other.goto(`/projeler/${slug}`);
      const proj = await other.evaluate(() => ({
        stores: [
          ...document.querySelectorAll<HTMLAnchorElement>('#main ul[aria-label] a[href^="http"]'),
        ].map((l) => l.href),
        videos: [...document.querySelectorAll<HTMLAnchorElement>('#main p > a[href^="http"]')].map(
          (l) => l.href,
        ),
      }));
      expect
        .soft(
          [...a.external.map((l) => l.href)].sort(),
          `makale ${k + 1}: mağaza bağlantıları = proje links`,
        )
        .toEqual([...proj.stores].sort());
      for (const v of proj.videos)
        expect
          .soft(
            a.external.map((l) => l.href),
            `makale ${k + 1}: video bağlantısı ana sayfada yok`,
          )
          .not.toContain(v);
    }
    await other.close();

    // reveal: work IN başından önce sıçranır (görünümde work yok), sonra tekerlekle okuma hızında BODY sonuna
    await jumpTo(page, phaseOf(m, 'work', 'in').y0 - 0.05 * m.vh);
    await page.mouse.move(24, 450); // pencerede (Lenis tekerleği) ama içeriğin dışında: hover efektleri ölçüme girmez
    await page.evaluate(() => {
      const vh = window.innerHeight;
      const flat = (t: string) => t === 'none' || new DOMMatrixReadOnly(t).isIdentity;
      const done = (el: HTMLElement | null) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        return (
          cs.opacity === '1' &&
          flat(cs.transform) &&
          cs.translate === 'none' &&
          [...el.querySelectorAll<HTMLElement>('.split-line')].every((l) =>
            flat(getComputedStyle(l).transform),
          )
        );
      };
      const arts = [...document.querySelectorAll<HTMLElement>('[data-work-article]')];
      const at: (number | null)[] = arts.map(() => null);
      window.setInterval(() => {
        arts.forEach((a, k) => {
          if (at[k] !== null) return;
          const title = a.querySelector<HTMLElement>('h3');
          const links =
            a
              .querySelector<HTMLElement>('a[href^="/projeler/"]')
              ?.closest<HTMLElement>('[data-reveal]') ?? null;
          if (done(title) && done(links)) at[k] = (window.scrollY / vh) * 100;
        });
      }, 25);
      (window as unknown as { __workDone: (number | null)[] }).__workDone = at;
    });
    await wheelTo(page, phaseOf(m, 'work', 'body').y1);
    const at = await page.evaluate(
      () => (window as unknown as { __workDone: (number | null)[] }).__workDone,
    );
    const rows = at.map((s, k) => {
      const act = svh(m, m.activation.work[k] ?? Number.NaN);
      return {
        k: k + 1,
        tamam: fmt(s ?? undefined),
        aktivasyon: fmt(act),
        once: fmt(s === null ? undefined : act - s),
      };
    });
    note(info, 'K-WORK-3 açılma (svh)', rows);
    at.forEach((s, k) => {
      const act = svh(m, m.activation.work[k] ?? Number.NaN);
      expect
        .soft(
          s === null ? Number.NaN : act - s,
          `makale ${k + 1}: başlık + bağlantılar s ${fmt(s ?? undefined)}’de tamam, aktivasyon ${fmt(act)}`,
        )
        .toBeGreaterThanOrEqual(20);
    });
  });
});

test.describe(
  'journey ve contact (K-JOURNEY-2/3, K-CONTACT-5)',
  { tag: ['@desktop-chromium'] },
  () => {
    test('K-JOURNEY-2 aktivasyonlar T_journey − 15 + 35k svh’de (± 2); paneldeki vurgu aynı karede aynı girdiye geçer; tek vurgulu yıl', async ({
      page,
    }, info) => {
      await openHome(page);
      const m = await measure(page);
      const T = m.chapters.find((x) => x.id === 'journey')!.top;
      const rows: unknown[] = [];
      for (let k = 0; k < m.counts.E; k++) {
        // DOM sayımı: başlık bloğu 40 svh + girdi 35 svh, aktivasyon "top 55%" (§4.10.2, §5.9.5)
        const sk = T + (0.4 + 0.35 * k - 0.55) * m.vh;
        await test.step(`girdi ${k + 1} (beklenen s ${fmt(svh(m, sk))})`, async () => {
          await stepTo(page, sk - 0.03 * m.vh);
          // ±3 svh, 0.5 svh adımlarla; her adımda iki kare (yönetmen, journey:active) ve rig'in o kaydırmadaki karesi
          const states = await page.evaluate(
            async ({ start, step, n }) => {
              const st = (window as unknown as StageWindow).__stage;
              const entries = [...document.querySelectorAll('[data-journey-entry]')];
              const layer = document.getElementById('scene-layer');
              const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
              const out: { y: number; active: number[]; key: string; shown: boolean }[] = [];
              for (let i = 0; i <= n; i++) {
                window.scrollTo({ top: Math.round(start + i * step), behavior: 'instant' });
                await frame();
                await frame();
                if (st.store.getState().loop !== 'never') {
                  const f0 = st.live.frames;
                  st.store.getState().invalidate();
                  const t0 = performance.now();
                  while (st.live.frames === f0 && performance.now() - t0 < 10_000) await frame();
                }
                out.push({
                  y: window.scrollY,
                  active: entries.flatMap((e, j) => (e.hasAttribute('data-active') ? [j] : [])),
                  key: st.live.kod.key,
                  shown:
                    !!layer &&
                    Number.parseFloat(getComputedStyle(layer).opacity) > 0.01 &&
                    st.live.panel.visible,
                });
              }
              return out;
            },
            { start: sk - 0.03 * m.vh, step: 0.005 * m.vh, n: 12 },
          );
          for (const s of states) {
            const at = `s ${fmt(svh(m, s.y))}`;
            expect.soft(s.active.length, `${at}: en çok bir etkin girdi`).toBeLessThanOrEqual(1);
            expect.soft(s.shown, `${at}: panel görünür`).toBe(true);
            if (s.shown)
              expect
                .soft(s.key, `${at}: panel vurgusu DOM’daki etkin girdiyle aynı`)
                .toBe(`journey:${s.active[0] ?? -1}`);
          }
          const found = states.find((s) => s.active.includes(k))?.y ?? null;
          expect(found, `girdi ${k + 1} ±3 svh içinde etkinleşir`).not.toBeNull();
          rows.push({
            k: k + 1,
            s: fmt(found === null ? undefined : svh(m, found)),
            beklenen: fmt(svh(m, sk)),
            // girdinin düzendeki "top 55%" çizgisi (reveal dönüşümü hariç)
            cizgi: fmt(svh(m, m.activation.journey[k] ?? Number.NaN)),
          });
          expect
            .soft(Math.abs(svh(m, (found ?? Number.NaN) - sk)), `girdi ${k + 1} aktivasyon konumu`)
            .toBeLessThanOrEqual(2);
          await settle(page);
          const hi = await page.evaluate(() => {
            const probe = document.createElement('span');
            probe.style.color = 'var(--color-accent)';
            document.body.append(probe);
            const accent = getComputedStyle(probe).color;
            probe.remove();
            const entries = [...document.querySelectorAll('[data-journey-entry]')];
            return {
              active: entries.flatMap((e, i) => (e.hasAttribute('data-active') ? [i] : [])),
              accent: entries.flatMap((e, i) =>
                [...e.querySelectorAll('time')]
                  .filter((t) => getComputedStyle(t).color === accent)
                  .map(() => i),
              ),
              times: entries.reduce(
                (n, e) =>
                  n +
                  [...e.querySelectorAll('time')].filter(
                    (t) => getComputedStyle(t).color === accent,
                  ).length,
                0,
              ),
            };
          });
          expect.soft(hi.active, `girdi ${k + 1}: tek etkin girdi`).toEqual([k]);
          expect
            .soft([...new Set(hi.accent)], `girdi ${k + 1}: vurgulu yıl yalnız etkin girdide`)
            .toEqual([k]);
          expect.soft(hi.times, `girdi ${k + 1}: aynı anda tek <time> vurgu renginde`).toBe(1);
        });
      }
      note(info, 'K-JOURNEY-2 aktivasyon (svh)', rows);
    });

    test('K-JOURNEY-3 journey boyunca panel git log’u gösterir (gece paneli yalnız panelin içi); html / body zemini değişmez', async ({
      page,
    }, info) => {
      await openHome(page);
      const m = await measure(page);
      const bg = () =>
        page.evaluate(() => [
          getComputedStyle(document.documentElement).backgroundColor,
          getComputedStyle(document.body).backgroundColor,
        ]);
      const base = await bg();
      await expect(
        page.locator('[data-stage-anchor="journey-core"] .kod-panel').first(),
        'journey statik paneli gece paletinde',
      ).toHaveAttribute('data-night', '');
      const pts: [string, number][] = [
        ...[0.4, 0.55].map((p): [string, number] => [
          `IN p ${p} (köprü)`,
          yAt(m, 'journey', 'in', p),
        ]),
        ...[0.8, 0.95].map((p): [string, number] => [`IN p ${p}`, yAt(m, 'journey', 'in', p)]),
        ...[0.1, 0.3, 0.5, 0.7, 0.9].map((p): [string, number] => [
          `BODY p ${p}`,
          yAt(m, 'journey', 'body', p),
        ]),
      ];
      const seen: string[] = [];
      for (const [label, y] of pts) {
        await stepTo(page, y);
        const s = await kodAt(page);
        seen.push(`${label}: "${s.key}"`);
        expect.soft(s.shown, `${label}: panel görünür`).toBe(true);
        expect
          .soft(s.key, `${label}: git log programı`)
          .toMatch(label.includes('köprü') ? /^->journey:-?\d+$/ : /^journey:-?\d+$/);
        expect.soft(await bg(), `${label}: html / body zemini`).toEqual(base);
      }
      note(info, 'K-JOURNEY-3 programlar', { zemin: base, seen });
    });

    test('K-CONTACT-5 H2 contact IN p 0.55’te, metin p 0.70’te açılır (± 3 svh; tekerlek, 10 svh/s)', async ({
      page,
    }, info) => {
      const watch = () =>
        page.evaluate(() => {
          const vh = window.innerHeight;
          const els = [
            ...document.querySelectorAll<HTMLElement>('[data-chapter="contact"] [data-reveal]'),
          ];
          const at = els.map(() => null as null | { s: number; instant: boolean });
          const mo = new MutationObserver(() =>
            els.forEach((el, i) => {
              if (at[i] === null && el.classList.contains('is-revealed'))
                at[i] = {
                  s: (window.scrollY / vh) * 100,
                  instant: el.classList.contains('is-instant'),
                };
            }),
          );
          els.forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ['class'] }));
          (window as unknown as { __contact: () => unknown }).__contact = () =>
            els.map((el, i) => ({
              h2: el.matches('h2'),
              text: (el.textContent ?? '').trim().slice(0, 24),
              ...at[i],
            }));
        });
      const read = () =>
        page.evaluate(() =>
          (
            window as unknown as {
              __contact: () => { h2: boolean; text: string; s?: number; instant?: boolean }[];
            }
          ).__contact(),
        );
      await openHome(page, HOME_TARGET);
      const m = await measure(page);
      const cin = phaseOf(m, 'contact', 'in');
      const want = {
        h2: svh(m, cin.y0 + 0.55 * (cin.y1 - cin.y0)),
        text: svh(m, cin.y0 + 0.7 * (cin.y1 - cin.y0)),
      };
      await jumpTo(page, cin.y0 - 0.1 * m.vh);
      await watch();
      await page.mouse.move(24, 450); // pencerede (Lenis tekerleği) ama içeriğin dışında: hover efektleri ölçüme girmez
      await wheelTo(page, m.maxScroll);
      const wheel = await read();
      note(info, 'K-CONTACT-5 tekerlek (svh)', {
        beklenen: { h2: fmt(want.h2), metin: fmt(want.text) },
        olculen: wheel,
      });
      for (const e of wheel)
        expect
          .soft(
            Math.abs((e.s ?? Number.NaN) - (e.h2 ? want.h2 : want.text)),
            `${e.h2 ? 'H2' : 'metin'} "${e.text}" s ${fmt(e.s)} (beklenen ${fmt(e.h2 ? want.h2 : want.text)})`,
          )
          .toBeLessThanOrEqual(3);

      // Bilgi: dur-kalk kaydırma (readingScroll, her adımda scrollend) — §5.14.6 süpürmesi görünüme giren öğeyi anında açar.
      // Yeniden yükleme en üstte yapılır: tarayıcı kaydırmayı geri yükler ve görünümdeki reveal'lar kurulumda açılırdı.
      await jumpTo(page, 0);
      await page.reload();
      await ready(page);
      await jumpTo(page, cin.y0 - 0.1 * m.vh);
      await watch();
      await readingScroll(page, Math.floor(svh(m, cin.y0) - 10), Math.ceil(svh(m, m.maxScroll)));
      note(info, 'K-CONTACT-5 dur-kalk readingScroll (svh; bilgi)', await read());
    });
  },
);

/* ───────────── V-48: flow anchor senkronu (§5.19 "Kamera ve anchor") ───────────── */

/** Kare başına örnek: rAF'te gönderilen mesaj karenin boyamasından sonra okunur (Lenis yalnız rAF'te kaydırır) */
interface SyncSample {
  f: number; // live.frames: rig'in çizdiği kare sayısı
  y: number; // boyanan kaydırma
  dom: number; // about-cut çapasının boyanan ekran merkezi
  panel: number; // live.panel merkezi: rig'in son karesindeki panel (eğimsiz düzen kutusu)
}
type SyncWindow = Window & { __v48?: { out: SyncSample[]; stop: boolean } };

/**
 * V-48 (§16.2): masaüstünde Lenis tekerlek kaydırmasında panel, flow çapasıyla (about-cut) ≤ 1 kare sapmayla kayar. Her
 * karenin boyamasından sonra boyanan kaydırma, çapanın ekran merkezi ve rig'in son panel merkezi okunur; rig'in kullandığı
 * kaydırma y_rig = y − (panel − dom) önceki karelerin y'siyle eşlenir (k = kaç kare geride). Lenis gsap.ticker'da kaydırır,
 * rig R3F rAF'inde okur: k = 0 ya da 1 olabilir, ≥ 2 olamaz.
 */
test.describe('V-48 flow anchor senkronu (Lenis, masaüstü)', { tag: ['@desktop-chromium'] }, () => {
  test('about-cut (flow): tekerlek kaydırmasında panel metinle ≤ 1 kare sapmayla kayar', async ({
    page,
  }, info) => {
    await openHome(page);
    await page.waitForFunction(() => document.documentElement.classList.contains('lenis'));
    const m = await measure(page);
    // about IN p 0.6'dan BODY sonuna kadar çapa yalnız about-cut'tır (flow; hero-rest → about-cut köprüsü bitti)
    const start = Math.round(yAt(m, 'about', 'in', 0.65));
    const end = phaseOf(m, 'about', 'body').y1;
    // İşaretçi pencere içinde (tekerlek olayı sayfaya, dolayısıyla Lenis'e ulaşsın) ama panelden uzakta
    await page.mouse.move(24, 450);
    await jumpTo(page, start);
    await freshFrame(page);
    await page.evaluate(() => {
      const st = (window as unknown as StageWindow).__stage;
      const el = document.querySelector<HTMLElement>('[data-stage-anchor="about-cut"]')!;
      const v48 = { out: [] as SyncSample[], stop: false };
      (window as SyncWindow).__v48 = v48;
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        const r = el.getBoundingClientRect();
        const p = st.live.panel;
        v48.out.push({
          f: st.live.frames,
          y: window.scrollY,
          dom: r.top + r.height / 2,
          panel: p.y + p.h / 2,
        });
      };
      const tick = () => {
        if (v48.stop) return;
        ch.port2.postMessage(0);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await pageDelay(page, 200); // durgun örnekler: ofset c0
    const span = Math.min(900, 0.85 * (end - start));
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, Math.round(span / 3));
      await pageDelay(page, 150);
    }
    // Lenis durulana kadar (scrollY 300 ms değişmez)
    await page.evaluate(async () => {
      const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      let last = window.scrollY;
      let still = performance.now();
      while (performance.now() - still < 300) {
        await frame();
        if (window.scrollY !== last) {
          last = window.scrollY;
          still = performance.now();
        }
      }
    });
    const s = await page.evaluate(() => {
      const v = (window as SyncWindow).__v48!;
      v.stop = true;
      return v.out;
    });
    expect(s.length, 'örnek sayısı (CI ≈ 2 fps: 9–16)').toBeGreaterThanOrEqual(6);
    const c0 = s[0]!.panel - s[0]!.dom; // durgun hâlde panel merkezi − çapa merkezi (0 beklenir: panel çapada ortalı)
    // Rig'in kullandığı kaydırma: y_rig = y − (panel − dom − c0); k = kaç kare geriden geldiği
    const hist = { k0: 0, k1: 0, k2: 0, unmatched: 0 };
    let maxPx = 0;
    let moving = 0;
    for (let i = 1; i < s.length; i++) {
      const cur = s[i]!;
      if (Math.abs(cur.y - s[i - 1]!.y) < 2) continue; // bu karede hareket yok ya da k ayırt edilemez
      moving++;
      const off = cur.panel - cur.dom - c0;
      maxPx = Math.max(maxPx, Math.abs(off));
      const yRig = cur.y - off;
      let k = -1;
      for (let j = 0; j <= Math.min(i, 4); j++) {
        if (Math.abs(s[i - j]!.y - yRig) <= 0.75) {
          k = j;
          break;
        }
      }
      if (k === 0) hist.k0++;
      else if (k === 1) hist.k1++;
      else if (k >= 2) hist.k2++;
      else hist.unmatched++;
    }
    const frames = s[s.length - 1]!.f - s[0]!.f;
    note(info, 'V-48', {
      samples: s.length,
      moving,
      rigFrames: frames,
      c0: Math.round(c0 * 100) / 100,
      maxPx: Math.round(maxPx * 10) / 10,
      ...hist,
    });
    expect(Math.abs(c0), 'durgun ofset (px)').toBeLessThanOrEqual(1);
    // CI'da (SwiftShader ≈ 2 fps) Lenis yumuşatması 5–6 karede biter
    expect(moving, 'hareketli kare sayısı').toBeGreaterThanOrEqual(3);
    expect.soft(hist.k2, '≥ 2 kare geride kalan kareler').toBe(0);
    expect.soft(hist.unmatched, 'eşleşmeyen kareler').toBe(0);
  });
});

/* ───────────── K-JOURNEY-7: mobil journey bandı (§4.10.7, [SABİT] #10) ───────────── */

test.describe('K-JOURNEY-7 mobil journey bandı (390×844)', { tag: ['@desktop-chromium'] }, () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  test('bant görüntü alanından çıkınca ≤ 300 ms içinde --scene-opacity 0 ve frame loop durur', async ({
    page,
  }, info) => {
    await page.addInitScript(recordScene);
    await openHome(page, HOME_MOBILE);
    const band = await page.evaluate(() => {
      const r = document
        .querySelector<HTMLElement>('[data-stage-anchor="journey-core"]')!
        .getBoundingClientRect();
      return {
        top: r.top + window.scrollY,
        bottom: r.bottom + window.scrollY,
        vh: window.innerHeight,
      };
    });
    expect(band.bottom - band.top, 'bant yüksekliği (36 svh)').toBeGreaterThan(0.3 * band.vh);
    const layerOpacity = () =>
      page.evaluate(() =>
        Number.parseFloat(getComputedStyle(document.getElementById('scene-layer')!).opacity),
      );
    // bant görüntü alanının ortasındayken panel görünür
    await stepTo(page, band.top - 0.3 * band.vh);
    expect(await layerOpacity(), 'bant görünürken opaklık').toBeGreaterThan(0.99);
    // 5 svh adımlarla bandın çıkışından geçilir (kesme eşiğinin çok altında)
    await clearRecords(page);
    await stepTo(page, band.bottom + 0.1 * band.vh, 0.05, false);
    await pageDelay(page, 400);
    const rec = await records(page);
    const exitAt = rec.find((r) => r.kind === 'raf' && r.y >= band.bottom)?.t;
    expect(exitAt, 'bandın çıktığı kare').toBeDefined();
    // kare hızından bağımsız: çıkıştan 300 ms sonra > 0.01 opaklık YAZIMI yok; son durum 0
    const late = rec.filter((r) => r.kind === 'op' && r.t > exitAt! + 300 && r.op > 0.01);
    const zeroAt = rec.find((r) => r.t >= exitAt! - 1 && r.op <= 0.01)?.t;
    note(info, 'K-JOURNEY-7', {
      bandSvh: Math.round(((band.bottom - band.top) / band.vh) * 1000) / 10,
      zeroAfterExitMs: zeroAt === undefined ? null : Math.round(zeroAt - exitAt!),
      timeline: timeline(rec, rec[0]?.t ?? 0, 12),
    });
    expect(late, 'çıkıştan 300 ms sonra görünür opaklık yazımı').toEqual([]);
    expect(await layerOpacity(), 'bant çıktıktan sonra opaklık').toBeLessThanOrEqual(0.01);
    // frame loop never: 1 s boyunca rig karesi yok
    const loop = await page.evaluate(
      () => (window as unknown as StageWindow).__stage.store.getState().loop,
    );
    expect(loop, 'frame loop').toBe('never');
    const frames = () =>
      page.evaluate(() => (window as unknown as StageWindow).__stage.live.frames);
    const f0 = await frames();
    await pageDelay(page, 1000);
    expect(await frames(), 'bant çıktıktan sonra kare').toBe(f0);
  });
});
