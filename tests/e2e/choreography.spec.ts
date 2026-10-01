// tests/e2e/choreography.spec.ts — ana sayfa koreografisi (M6; §4.12, §13.3.4, §13.3.5): K-CHOREO-4/5/6/7, I2, I3,
// K-GEN-2/9, K-ABOUT-1/3, K-AREAS-3/4/5/6, K-WORK-1/2/3, K-JOURNEY-2/3, K-CONTACT-3/5. Mutlu yol /?debug&tier=high.
// Beklenen kaydırma konumları DOM'dan ölçülen düzenden hesaplanır (§13.3.4): §4.12.1'in s değerleri 1170 svh'lik referans
// düzendir; her satır (bölüm, faz, yerel p) olarak eşlenir ve y = faz.y0 + p·(faz.y1 − faz.y0) olur (§5.9.3).
// Sahne değerleri stageTarget'tan okunur (yönetmenin kaydırma güncellemesinden hemen sonra deterministiktir). Ekran dairesi
// için bir kare rendered = target yapılır (live.snapNextFrame): yazılım render'ında damping'i beklemek çok yavaştır.
// Zaman ölçümleri kare hızından bağımsız okunur: "X ms'den sonra eşiğin öbür yanında YAZIM yok" (--scene-opacity stil
// yazımları ve kare örnekleri kaydedilir; CI'da SwiftShader ≈ 2 fps). Ham süreler ayrıca ek açıklamalara yazılır.
// Bekleme sayfa içindedir (waitForTimeout YASAK). Uyumsuzluklar expect.soft ile toplanır: tek koşu bütün sapmaları listeler.
import type { Page, TestInfo } from '@playwright/test';
import sharp from 'sharp';
import { expect, test } from './fixtures';
import { readingScroll, settle } from './helpers/scroll';
import { pageDelay, readStage, waitForStagePhase } from './helpers/stage';

test.describe.configure({ timeout: 180_000 }); // §13.3.4: yavaş dosya, test başına 180 s

const HOME = '/?debug&tier=high';
const HOME_MOBILE = '/?debug&tier=medium'; // mobil mutlu yol (§13.3.3)

const FILLS = ['fill0', 'fill1', 'fill2', 'fill3', 'fill4', 'fill5'] as const;
const CAMERA = ['camR', 'camAz', 'camEl', 'camFov'] as const;
/** Derece cinsinden alanlar (K-CHOREO-7 tabanı 0.2°, K-CHOREO-4 ±0.5°) */
const ANGLES = new Set<string>([
  'camAz',
  'camEl',
  'camFov',
  'rotYScroll',
  'rotYEvent',
  'rotX',
  'lightAz',
  'lightEl',
]);
/** Dinlenmiş sahne durumu f(route, scrollY): track ve event alanları; zaman tabanlı süsler ve opacityCut hariç (§4.12.2 #3) */
const STATE = [
  ...CAMERA,
  'rotYScroll',
  'rotYEvent',
  'rotX',
  'cut',
  'ringContrast',
  'sectorMix',
  ...FILLS,
  'bandStart',
  'bandEnd',
  'bandVisible',
  'ghost',
  'arcGlow',
  'rim',
  'tone',
  'lightAz',
  'lightEl',
  'anchorMix',
  'opacityTrack',
] as const;
/** Work / journey BODY dwell'lerinde rotYScroll dışında sabit kalan 3D alanlar (§5.9.3 değişmez 5) */
const STILL = STATE.filter((p) => !(CAMERA as readonly string[]).includes(p) && p !== 'rotYScroll');
const NO_BAND: readonly [number, number] = [-10, -10];

/* ───────────── türler ───────────── */

type Values = Record<string, number>;
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
type Band = readonly [number, number] | null;
interface StageData {
  sectors: number;
  projects: { slug: string; area: number | null; band: Band }[];
  entries: { band: Band }[];
}
/** window.__stage (§5.18.1, yalnız ?debug) */
interface DebugStage {
  store: { getState(): { invalidate(): void; data: unknown } };
  target: Values;
  rendered: Values;
  live: {
    stone: { cx: number; cy: number; r: number; visible: boolean };
    frames: number;
    snapNextFrame: boolean;
    anchors: readonly { id: string }[];
    layout?: {
      phases: PhaseRange[];
      activation: { work: number[]; journey: number[] };
      areas: Measured['areas'];
    } | null;
  };
}
type StageWindow = Window & { __stage: DebugStage };
interface Reading {
  y: number;
  values: Values;
  anchor: { from: string; to: string; mix: number; at: string };
}

/* ───────────── yardımcılar: sayfa, düzen, okuma ───────────── */

const fmt = (v: number | undefined) =>
  v === undefined ? '—' : String(Math.round(v * 1000) / 1000);
const svh = (m: Measured, y: number) => (y / m.vh) * 100;
const pad = (x: number) => String(x).padStart(2, '0');

/** Raporlama: ölçülen sayılar test ek açıklamasına ve stdout'a yazılır (PR / M6 ayar notları için) */
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
  await waitForStagePhase(page, ['ready'], 30_000);
  await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
  await page.evaluate(() =>
    document.querySelector<HTMLElement>('[data-stage-debug]')?.style.setProperty('display', 'none'),
  );
  await settle(page);
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

/** stageTarget (readStage, §13.3.2) + çapa indekslerinin kimlikleri (live.anchors) */
async function readTarget(page: Page): Promise<Reading> {
  const r = await readStage(page);
  const ids = await page.evaluate(() =>
    (window as unknown as StageWindow).__stage.live.anchors.map((a) => a.id),
  );
  const values = Object.fromEntries(
    Object.entries(r.values).filter((e): e is [string, number] => typeof e[1] === 'number'),
  );
  const id = (i: number | undefined) =>
    i === undefined ? '?' : (ids[i] ?? (i === -1 ? 'sanal' : `#${i}`));
  const from = id(values.anchorFrom);
  const to = id(values.anchorTo);
  const mix = values.anchorMix ?? 0;
  return {
    y: r.scrollY,
    values,
    anchor: { from, to, mix, at: mix >= 0.999 ? to : mix <= 0.001 ? from : `${from}→${to}` },
  };
}

/** Anında y'ye kaydırır ve sahne değerleri durulana kadar bekler (scrollToSvh'nin px karşılığı) */
async function jumpTo(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.round(y));
  await settle(page);
}

/**
 * "Kaydırarak gelir": kesme eşiğinin (tek güncellemede 1.5·vh, §5.9.7) altında adımlarla ilerler, her adımdan sonra iki
 * kare bekler (yönetmen güncellemesi, event tween'leri); sonda durulur.
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
  // quiet = false: event tween'leri beklenmez (taş dairesi yalnız track değerlerine — çapa karışımı — bağlıdır)
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

/* ───────────── beklenen değerler (§5.8.1, §5.9.4, §5.9.5) ───────────── */

const psi = (k: number, n: number) => 45 - (k * 360) / n;
const wrapNear = (a: number, ref: number) => a + 360 * Math.round((ref - a) / 360);
const wrap180 = (a: number) => a - 360 * Math.round(a / 360);

interface Ctx {
  m: Measured;
  d: StageData;
  N: number;
  S: number;
  /** areas BODY soyut uzunluğu L = 20 + S·N svh (§5.9.4) */
  L: number;
  lastPsi: number;
  W0: number;
}
function ctxOf(m: Measured, d: StageData): Ctx {
  const N = d.sectors;
  const lastPsi = m.areas ? psi(N - 1, N) : 45;
  const a0 = d.projects[0]?.area ?? null;
  const S = m.areas?.S ?? (m.mobile ? 40 : 50);
  return {
    m,
    d,
    N,
    S,
    L: 20 + S * N,
    lastPsi,
    W0: a0 === null ? lastPsi : wrapNear(psi(a0, N), lastPsi),
  };
}

function phaseOf(m: Measured, chapter: string, phase: PhaseKind): PhaseRange {
  const r = m.phases.find((p) => p.chapter === chapter && p.phase === phase);
  if (!r) throw new Error(`faz yok: ${chapter} · ${phase}`);
  return r;
}
const yAt = (m: Measured, chapter: string, phase: PhaseKind, p: number) => {
  const r = phaseOf(m, chapter, phase);
  return r.y0 + p * (r.y1 - r.y0);
};
/** areas BODY'nin soyut ekseninde ofs svh → belge y (§5.9.4: p = ofs / L) */
function areasY(c: Ctx, ofs: number): number {
  const a = c.m.areas;
  if (!a) throw new Error('areas pin yok (liste modu)');
  return a.bodyY0 + (ofs / c.L) * a.bodyLen;
}
/** Bölümün kaydırma aralığı: IN başı → BODY sonu (hero: 0 → heroExit) */
function chapterRange(m: Measured, id: string): [number, number] {
  if (id === 'hero') return [0, m.heroExit];
  return [phaseOf(m, id, 'in').y0, phaseOf(m, id, 'body').y1];
}

const indexAt = (lines: readonly number[], y: number) => lines.filter((l) => l <= y).length - 1;
/** §5.9.5 hedef çözümleyici: work / journey indeksleri → rotYEvent, bant, (pencere içinde) dolgular */
function eventsAt(c: Ctx, y: number) {
  const w = indexAt(c.m.activation.work, y);
  const j = indexAt(c.m.activation.journey, y);
  const area = w >= 0 ? (c.d.projects[w]?.area ?? null) : null;
  const band =
    (j >= 0 ? c.d.entries[j]?.band : w >= 0 ? c.d.projects[w]?.band : c.d.projects[0]?.band) ??
    NO_BAND;
  return {
    w,
    j,
    rotYEvent: area === null ? 0 : wrap180(psi(area, c.N) - c.W0),
    band,
    fills: FILLS.map((_, i) => (i >= c.N ? 0 : i === area ? 0.6 : 0.12)),
  };
}

const fillsOf = (f: readonly number[]): Values =>
  Object.fromEntries(FILLS.map((k, i) => [k, f[i] ?? 0]));
// §5.8.1 K0–K5; tabloda olmayan alanlar §5.8.1 notundan (rim, bandVisible) ve track tablosundan (§5.9.4) taşınır
const K0: Values = {
  camR: 5.2,
  camAz: -25,
  camEl: 12,
  camFov: 30,
  rotYScroll: 0,
  rotX: 0,
  cut: 1.1,
  ringContrast: 0,
  sectorMix: 0,
  ghost: 0,
  arcGlow: 0,
  lightAz: -60,
  lightEl: 38,
  rim: 0.25,
  tone: 1,
  bandVisible: 0,
};
const K1B: Values = {
  ...K0,
  camR: 4.8,
  camAz: -14,
  camEl: 40,
  camFov: 28,
  rotYScroll: 30,
  cut: 0.35,
  ringContrast: 0.6,
  ghost: 0.1,
  lightAz: -40,
  lightEl: 48,
};
const K1: Values = {
  ...K1B,
  camR: 4.6,
  camEl: 55,
  rotYScroll: 35,
  cut: 0,
  ringContrast: 1,
  lightAz: -30,
  lightEl: 55,
};
const K2 = (rotY: number): Values => ({
  ...K1,
  camR: 7.2,
  camAz: 0,
  camEl: 88,
  camFov: 18,
  rotYScroll: rotY,
  ringContrast: 0.4,
  sectorMix: 1,
  lightAz: 0,
  lightEl: 80,
});
const K3 = (rotY: number): Values => ({
  camR: 5.6,
  camAz: 0,
  camEl: 20,
  camFov: 26,
  rotYScroll: rotY,
  rotX: 62,
  cut: -0.02,
  ringContrast: 0.9,
  sectorMix: 0.5,
  ghost: 0,
  arcGlow: 0.35,
  lightAz: 25,
  lightEl: 22,
  rim: 0.25,
  tone: 1,
  bandVisible: 1,
});
const K4 = (rotY: number): Values => ({
  ...K3(rotY),
  camR: 5.8,
  camEl: 72,
  rotX: 0,
  cut: 0,
  ringContrast: 1,
  sectorMix: 0,
  ghost: 0.06,
  arcGlow: 0.2,
  lightAz: -20,
  lightEl: 60,
});
const K5 = (rotY: number): Values => ({
  ...K4(rotY),
  camR: 4.9,
  camEl: 22,
  camFov: 30,
  rotX: 68,
  cut: -0.05,
  ringContrast: 0.7,
  ghost: 0,
  arcGlow: 1,
  lightAz: 70,
  lightEl: 14,
  rim: 0.35,
  bandVisible: 0,
});

interface Row {
  id: string;
  label: string;
  y: number;
  want: Values;
  anchor: string;
  mix?: number;
}

/** §4.12.1 satırları, satır aralığının SONUNDA (bölüm, faz, p); areas adımları N'den üretilir (varsayılan N = 4: 7–9) */
function choreoRows(c: Ctx): Row[] {
  const { m, N, S, W0 } = c;
  const rows: Row[] = [];
  const none = [0, 0, 0, 0, 0, 0];
  const dial = (k: number) => FILLS.map((_, i) => (i >= N ? 0 : i === k ? 1 : 0.15));
  const add = (
    id: string,
    label: string,
    y: number,
    want: Values,
    fills: readonly number[] | 'event',
    anchor: string,
    mix?: number,
  ) => {
    const e = eventsAt(c, y);
    rows.push({
      id,
      label,
      y,
      anchor,
      mix,
      want: {
        ...want,
        ...fillsOf(fills === 'event' ? e.fills : fills),
        rotYEvent: e.rotYEvent,
        bandStart: e.band[0],
        bandEnd: e.band[1],
      },
    });
  };
  add('0–1', 'yükleme · hero boşta (s 0)', 0, K0, none, 'hero-rest');
  add(
    '2',
    'about IN p 0.30 (s 0–30 sonu)',
    yAt(m, 'about', 'in', 0.3),
    { ...K0, rotYScroll: 12 },
    none,
    'hero-rest→about-cut',
    0.45,
  );
  add('3', 'about IN sonu (s 30–100)', yAt(m, 'about', 'in', 1), K1B, none, 'about-cut');
  add('4', 'about BODY sonu (s 100–140)', yAt(m, 'about', 'body', 1), K1, none, 'about-cut');
  add(
    '5',
    'areas IN sonu (s 140–240)',
    yAt(m, 'areas', 'in', 1),
    K2(psi(0, N)),
    dial(0),
    'areas-dial',
  );
  if (m.areas) {
    add(
      '6',
      'areas oturma + adım 0 sonu (s 240–300)',
      areasY(c, 10 + S),
      K2(psi(0, N)),
      dial(0),
      'areas-dial',
    );
    for (let k = 1; k < N; k++)
      add(
        String(6 + k),
        `areas adım ${k} (dönüş + dwell) sonu`,
        areasY(c, 10 + S * (k + 1)),
        K2(psi(k, N)),
        dial(k),
        'areas-dial',
      );
    add(
      String(6 + N),
      'areas bırakma sonu (s 450–460)',
      yAt(m, 'areas', 'body', 1),
      { ...K2(psi(N - 1, N)), sectorMix: 0.5 },
      FILLS.map((_, i) => (i < N ? 0.15 : 0)),
      'areas-dial',
    );
  }
  add('11', 'work IN sonu (s 460–560)', yAt(m, 'work', 'in', 1), K3(W0), 'event', 'work-specimen');
  add(
    '12',
    'work BODY sonu (s 560–790)',
    yAt(m, 'work', 'body', 1),
    K3(W0 + 30),
    'event',
    'work-specimen',
  );
  add(
    '13',
    'journey IN sonu (s 790–890)',
    yAt(m, 'journey', 'in', 1),
    K4(W0 + 50),
    none,
    'journey-core',
  );
  add(
    '14',
    'journey BODY sonu (s 890–1070)',
    yAt(m, 'journey', 'body', 1),
    K4(W0 + 110),
    none,
    'journey-core',
  );
  add(
    '15',
    'contact IN p 0.5 (s 1070–1120 sonu)',
    yAt(m, 'contact', 'in', 0.5),
    {
      ...K5(W0 + 130),
      rotX: 0,
      cut: 0,
      ringContrast: 1,
      arcGlow: 0.2,
      lightAz: -20,
      lightEl: 60,
      rim: 0.25,
    },
    none,
    'contact-ring',
  );
  add(
    '16',
    'contact IN sonu (s 1120–1170)',
    yAt(m, 'contact', 'in', 1),
    K5(W0 + 130),
    none,
    'contact-ring',
  );
  return rows;
}

/* ───────────── taş ↔ metin (K-CHOREO-6) ───────────── */

interface Offender {
  sel: string;
  chapter: string;
  text: string;
  /** metin satır kutularına giriş derinliği (px): yarıçap − merkezden kutuya uzaklık */
  textOverlap: number;
  /** öğe dikdörtgenine giriş derinliği (px) */
  boxOverlap: number;
}
interface StoneCheck {
  y: number;
  opacity: number;
  stone: { cx: number; cy: number; r: number; visible: boolean } | null;
  offenders: Offender[];
}

/**
 * Bir kare rendered = target yapılır (live.snapNextFrame) ve o karenin ekran dairesi (live.stone: çapa merkezi, D/2)
 * kapsamdaki metin öğeleriyle karşılaştırılır: kendi boş olmayan metin düğümü olan, checkVisibility (opaklık ve
 * görünürlük) ile görünen öğeler; aria-hidden alt ağaçları, .sr-only ve hero H1 (#hero-title, §4.12.2 #7) hariç.
 * Sahne opaklığı ≤ 0.01 ise (döngü never) taş yoktur.
 */
async function stoneVsText(page: Page, scope = '#main'): Promise<StoneCheck> {
  return page.evaluate(async (sel) => {
    const st = (window as unknown as StageWindow).__stage;
    const layer = document.getElementById('scene-layer');
    const opacity = layer ? Number.parseFloat(getComputedStyle(layer).opacity) : 0;
    const out: StoneCheck = { y: window.scrollY, opacity, stone: null, offenders: [] };
    if (!(opacity > 0.01)) return out;
    const f0 = st.live.frames;
    st.live.snapNextFrame = true;
    st.store.getState().invalidate();
    const t0 = performance.now();
    while (st.live.frames === f0) {
      if (performance.now() - t0 > 15_000) throw new Error('snap: 15 s içinde kare çizilmedi');
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
    const s = { ...st.live.stone };
    out.stone = s;
    if (!s.visible || s.r <= 0) return out;
    const depth = (r: DOMRect) =>
      s.r -
      Math.hypot(
        Math.max(r.left - s.cx, 0, s.cx - r.right),
        Math.max(r.top - s.cy, 0, s.cy - r.bottom),
      );
    for (const el of document.querySelector(sel)?.querySelectorAll<HTMLElement>('*') ?? []) {
      const own = [...el.childNodes].filter(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
      );
      if (!own.length) continue;
      if (el.closest('[aria-hidden="true"], .sr-only, #hero-title')) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      let text = 0;
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
async function stoneNotBehindText(
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
      const r = await stoneVsText(page);
      const where = `${label} ${id} #${i + 1} s ${fmt(svh(m, r.y))} (taş ${r.stone ? `${fmt(r.stone.cx)},${fmt(r.stone.cy)} r ${fmt(r.stone.r)}` : 'yok'}, opaklık ${fmt(r.opacity)})`;
      if (r.stone?.visible) checked++;
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
  note(info, `${label} denetlenen konum`, `${checked} konumda taş görünür`);
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
 * I2 sondası: hedefler §5.14 reveal seçicisidir ([data-reveal]); §4.12.3 istisnaları (about lede, contact) ve bu kırılımda
 * reveal almayan öğeler (data-reveal-when) hariçtir. mode 'scroll': her kaydırma olayından 90 ms sonra (readingScroll'un
 * bir sonraki adımından hemen önce) örnekler; 'interval': 40 ms'de bir (Lenis sürekli kaydırır).
 */
async function installRevealProbe(page: Page, mode: 'scroll' | 'interval'): Promise<void> {
  await page.evaluate((how) => {
    const vh = window.innerHeight;
    const flat = (t: string) => t === 'none' || new DOMMatrixReadOnly(t).isIdentity;
    const targets = [...document.querySelectorAll<HTMLElement>('#main [data-reveal]')].filter(
      (el) =>
        el.dataset.reveal !== 'lede' &&
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

/* ───────────── kesme kaydı (K-GEN-9, K-CHOREO-5) ───────────── */

interface SceneRec {
  t: number;
  /** op: --scene-opacity yazımı; raf: kare örneği (bir şey değiştiyse); click / popstate; vt …: görünüm geçişi */
  kind: string;
  op: number;
  y: number;
  /** rendered ↔ target farkı: açılar (°) ve skalerler; morf zinciri oynuyorsa ya da rig eski kareyi gösteriyorsa büyür */
  ang: number;
  scl: number;
  frames: number;
  path: string;
}

/**
 * Init betiği: --scene-opacity yazımları (stil özniteliği), her karede kaydırma / opaklık / rig karesi (değiştiyse),
 * tıklama, popstate ve görünüm geçişi animasyonları zaman damgasıyla. Kaydırma konumu kare örneklerinden okunur:
 * 'scroll' olayı yazımdan bir kare sonra gelir.
 */
function recordScene(): void {
  const w = window as unknown as {
    __rec: SceneRec[];
    __stage?: {
      target: Record<string, number>;
      rendered: Record<string, number>;
      live: { frames: number };
    };
  };
  w.__rec = [];
  const seen = new WeakSet<Animation>();
  const start = () => {
    const layer = document.getElementById('scene-layer');
    if (!layer) {
      requestAnimationFrame(start);
      return;
    }
    const gap = (keys: string[]) => {
      const st = w.__stage;
      if (!st) return 0;
      return Math.max(...keys.map((k) => Math.abs((st.rendered[k] ?? 0) - (st.target[k] ?? 0))));
    };
    const read = (kind: string): SceneRec => ({
      t: performance.now(),
      kind,
      op: Number.parseFloat(getComputedStyle(layer).opacity),
      y: window.scrollY,
      ang: gap(['camAz', 'camEl', 'camFov', 'rotYScroll', 'rotYEvent', 'rotX']),
      scl: gap(['camR', 'cut', 'anchorMix']),
      frames: w.__stage?.live.frames ?? -1,
      path: location.pathname + location.hash,
    });
    const push = (kind: string) => w.__rec.push(read(kind));
    new MutationObserver(() => push('op')).observe(layer, {
      attributes: true,
      attributeFilter: ['style'],
    });
    window.addEventListener('click', () => push('click'), true);
    window.addEventListener('popstate', () => push('popstate'));
    let last = '';
    const frame = () => {
      const r = read('raf');
      const key = [r.y, r.op, r.frames, r.path].join();
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
 * Sönme / geri gelme süreleri. Kare hızından bağımsız ölçüt yazımlardan okunur ('op' kayıtları): t0'dan sonra opaklığın
 * > 0.01 YAZILDIĞI son an (sönme) ve varıştan / oturmadan sonra < 0.99 yazıldığı son an (geri gelme). Ham süreler (eşiğin
 * ilk geçildiği kare) ayrıca raporlanır. Eski kare: geri gelme sırasında (son sıfırdan sonra) sahne en az yarı görünürken
 * rig'in son karesi hedeften belirgin farklı (> 5° ya da > 0.05) — morf zinciri ya da kesmeden önceki durum görünüyor.
 */
function cutTiming(rec: SceneRec[], t0: number, from: 'arrive' | 'zero') {
  const after = rec.filter((r) => r.t >= t0);
  const writes = after.filter((r) => r.kind === 'op');
  const zeroAt = after.find((r) => r.op <= 0.01);
  const lastAbove = writes.filter((r) => r.op > 0.01 && (!zeroAt || r.t < zeroAt.t)).at(-1);
  const { finalY, arrive } = arrival(rec, t0);
  const lastZero = after.filter((r) => r.op <= 0.01).at(-1);
  const ref = from === 'arrive' ? (arrive ?? lastZero?.t) : lastZero?.t;
  const back = ref === undefined ? undefined : after.find((r) => r.t >= ref && r.op >= 0.99);
  const lastBelow =
    ref === undefined || !back
      ? undefined
      : writes.filter((r) => r.t >= ref && r.t < back.t && r.op < 0.99).at(-1);
  const flash =
    zeroAt && arrive !== undefined
      ? writes.filter((r) => r.t > zeroAt.t && r.t < arrive && r.op > 0.01)
      : [];
  const stale = lastZero
    ? after.filter((r) => r.t > lastZero.t && r.op >= 0.5 && (r.ang > 5 || r.scl > 0.05))
    : [];
  return {
    reachedZero: !!zeroAt,
    dropRaw: zeroAt ? zeroAt.t - t0 : null,
    dropFrameFree: (lastAbove?.t ?? t0) - t0,
    arriveAt: arrive === undefined ? null : arrive - t0,
    backRaw: back && ref !== undefined ? back.t - ref : null,
    backFrameFree: back && ref !== undefined ? (lastBelow?.t ?? ref) - ref : null,
    minOp: Math.min(...after.map((r) => r.op)),
    flash: flash.length,
    finalY: finalY ?? null,
    stale: stale.map(
      (r) =>
        `t+${fmt(r.t - t0)} ms opaklık ${fmt(r.op)}: açı farkı ${fmt(r.ang)}°, skaler farkı ${fmt(r.scl)} (rig karesi ${r.frames})`,
    ),
  };
}

/** Rapor için kısa zaman çizelgesi: t0'dan sonra opaklık / rig karesi değişimleri (yalnız kaydırılan kareler atlanır) */
function timeline(rec: SceneRec[], t0: number, limit = 40): string[] {
  const list = rec.filter((r) => r.t >= t0);
  const out: string[] = [];
  list.forEach((r, i) => {
    const prev = list[i - 1];
    const quiet =
      r.kind === 'raf' &&
      prev &&
      r.op === prev.op &&
      r.frames === prev.frames &&
      i < list.length - 1;
    if (quiet || out.length >= limit) return;
    out.push(
      `+${fmt(r.t - t0)} ${r.kind} op ${fmt(r.op)} y ${Math.round(r.y)} kare ${r.frames} Δaçı ${fmt(r.ang)}`,
    );
  });
  return out;
}

/* ═════════════════════════════ testler ═════════════════════════════ */

test.describe(
  '§4.12 koreografi tablosu ve düzen (1440×900)',
  { tag: ['@desktop-chromium'] },
  () => {
    test('K-GEN-2 bölüm yükseklikleri ve toplam kaydırma (yönetmen fazlarıyla)', async ({
      page,
    }, info) => {
      await openHome(page);
      const m = await measure(page);
      await crossCheckLayout(page, m, info);
      const h = Object.fromEntries(m.chapters.map((c) => [c.id, svh(m, c.height)]));
      const { N, P, E } = m.counts;
      note(info, 'bölüm yükseklikleri (svh)', { ...h, N, P, E });
      expect.soft(Math.abs((h.hero ?? 0) - 100), `hero ${fmt(h.hero)}`).toBeLessThanOrEqual(1);
      expect.soft(Math.abs((h.about ?? 0) - 140), `about ${fmt(h.about)}`).toBeLessThanOrEqual(1);
      expect
        .soft(Math.abs((h.areas ?? 0) - (120 + 50 * N)), `areas ${fmt(h.areas)} (120 + 50N)`)
        .toBeLessThanOrEqual(1);
      expect
        .soft(Math.abs((h.work ?? 0) - (50 + 70 * P)), `work ${fmt(h.work)} (50 + 70P)`)
        .toBeLessThanOrEqual(1);
      expect
        .soft(h.journey ?? 0, `journey ${fmt(h.journey)} ≥ 70 + 35E`)
        .toBeGreaterThanOrEqual(70 + 35 * E - 1);
      expect
        .soft(Math.abs((h.contact ?? 0) - 100), `contact ${fmt(h.contact)}`)
        .toBeLessThanOrEqual(1);
      // Toplam = Σ yükseklik − 100 svh. 1170 svh referansı journey'nin en küçük yüksekliğiyle (70 + 35E = 280) geçerlidir;
      // içerik journey'yi uzatırsa fark rapora yazılır (beklenen s değerleri zaten ölçülen düzenden gelir).
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
      // fazlar §5.9.3: about IN 0–100, BODY 100–140 … (referans düzene göre konumlar rapora)
      note(
        info,
        'fazlar (svh)',
        m.phases.map((p) => `${p.chapter} ${p.phase} ${fmt(svh(m, p.y0))}–${fmt(svh(m, p.y1))}`),
      );
    });

    test('K-CHOREO-7 §4.12.1 her satırın sonunda stageTarget anahtar değerlerinin ± %2’si içinde', async ({
      page,
    }, info) => {
      await openHome(page);
      const m = await measure(page);
      const c = ctxOf(m, await stageData(page));
      note(info, 'bağlam', { N: c.N, W0: c.W0, lastPsi: c.lastPsi, L: c.L });
      const misses: string[] = [];
      for (const r of choreoRows(c)) {
        await test.step(`satır ${r.id}: ${r.label} → s ${fmt(svh(m, r.y))}`, async () => {
          await stepTo(page, r.y);
          const got = await readTarget(page);
          for (const [prop, want] of Object.entries(r.want)) {
            const have = got.values[prop];
            const tol = Math.max(0.02 * Math.abs(want), ANGLES.has(prop) ? 0.2 : 0.01);
            const msg = `satır ${r.id} (${r.label}, s ${fmt(svh(m, got.y))}) ${prop}: beklenen ${fmt(want)}, ölçülen ${fmt(have)}`;
            if (have === undefined || Math.abs(have - want) > tol) misses.push(msg);
            expect.soft(Math.abs((have ?? Number.NaN) - want), msg).toBeLessThanOrEqual(tol);
          }
          const a = got.anchor;
          if (r.mix !== undefined) {
            expect.soft(`${a.from}→${a.to}`, `satır ${r.id} çapa çifti`).toBe(r.anchor);
            expect
              .soft(Math.abs(a.mix - r.mix), `satır ${r.id} anchorMix ${fmt(a.mix)} ≠ ${r.mix}`)
              .toBeLessThanOrEqual(0.01);
          } else expect.soft(a.at, `satır ${r.id} etkin çapa`).toBe(r.anchor);
        });
      }
      note(info, 'K-CHOREO-7 sapmalar', misses.length ? misses : 'yok');
    });

    test('K-CONTACT-3 sayfa sonunda sahne K5’te: rotX 68 ± 1°, arcGlow 1, ışık 70/14, cut −0.05, rim 0.35', async ({
      page,
    }) => {
      await openHome(page);
      const m = await measure(page);
      await stepTo(page, m.maxScroll, 0.9);
      const v = (await readTarget(page)).values;
      const want: [string, number, number][] = [
        ['rotX', 68, 1],
        ['arcGlow', 1, 0.01],
        ['lightAz', 70, 0.5],
        ['lightEl', 14, 0.5],
        ['cut', -0.05, 0.01],
        ['rim', 0.35, 0.01],
      ];
      for (const [k, w, tol] of want)
        expect
          .soft(Math.abs((v[k] ?? Number.NaN) - w), `${k}: ${fmt(v[k])} ≠ ${w}`)
          .toBeLessThanOrEqual(tol);
    });
  },
);

test.describe(
  'K-CHOREO-4 yol bağımsızlığı (kaydırarak gel = o konumda yeniden yükle)',
  { tag: ['@desktop-chromium'] },
  () => {
    for (const group of [
      ['hero', 'about', 'areas'],
      ['work', 'journey', 'contact'],
    ]) {
      test(`K-CHOREO-4 ${group.join(' / ')}: bölüm başına 3 konum; açılar ± 0.5°, skalerler ± 0.01`, async ({
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
              const a = await readTarget(page);
              await page.reload();
              await ready(page);
              const b = await readTarget(page);
              expect
                .soft(Math.abs(b.y - a.y), `${id} ${f}: geri yüklenen kaydırma ${b.y} ≠ ${a.y}`)
                .toBeLessThanOrEqual(1);
              for (const k of STATE) {
                const tol = ANGLES.has(k) ? 0.5 : 0.01;
                const d = Math.abs((b.values[k] ?? Number.NaN) - (a.values[k] ?? Number.NaN));
                const msg = `${id} s ${fmt(svh(m, a.y))} ${k}: kaydırarak ${fmt(a.values[k])}, yeniden yüklemede ${fmt(b.values[k])}`;
                if (!(d <= tol)) diffs.push(msg);
                expect.soft(d, msg).toBeLessThanOrEqual(tol);
              }
              expect.soft(b.anchor.at, `${id} ${f}: etkin çapa`).toBe(a.anchor.at);
            });
          }
        }
        note(info, 'K-CHOREO-4 farklar', diffs.length ? diffs : 'yok');
      });
    }
  },
);

test.describe(
  'K-CHOREO-6 taş metnin arkasında değil (1440×900)',
  { tag: ['@desktop-chromium'] },
  () => {
    for (const group of [
      ['hero', 'about', 'areas'],
      ['work', 'journey', 'testimonials', 'contact'],
    ])
      test(`K-CHOREO-6 ${group.filter((g) => g !== 'testimonials').join(' / ')}: bölüm başına 10 konumda taş dairesi hiçbir metin satırıyla kesişmez (hero H1 hariç)`, async ({
        page,
      }, info) => {
        await openHome(page);
        await stoneNotBehindText(page, info, '1440×900', group);
      });

    test('K-ABOUT-3 hero → areas IN boyunca 5 svh adımlarla taş about metnine binmez', async ({
      page,
    }, info) => {
      await openHome(page);
      const m = await measure(page);
      const end = yAt(m, 'areas', 'in', 1);
      let checked = 0;
      for (let y = 0; y <= end + 1; y += 0.05 * m.vh) {
        await stepTo(page, y, 0.5, false);
        const r = await stoneVsText(page, '[data-chapter="about"]');
        if (r.stone?.visible) checked++;
        for (const o of r.offenders.filter((x) => x.textOverlap > 0.5))
          expect
            .soft(
              o.textOverlap,
              `s ${fmt(svh(m, r.y))}: ${o.sel} "${o.text}" metnine ${o.textOverlap} px (taş ${fmt(r.stone?.cx)},${fmt(r.stone?.cy)} r ${fmt(r.stone?.r)})`,
            )
            .toBeLessThanOrEqual(0.5);
      }
      note(info, 'K-ABOUT-3 konum', checked);
    });
  },
);

test.describe(
  'K-CHOREO-6 taş metnin arkasında değil (390×844)',
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
      test(`K-CHOREO-6 mobil ${group.filter((g) => g !== 'testimonials').join(' / ')}: bölüm başına 10 konumda taş dairesi hiçbir metin satırıyla kesişmez`, async ({
        page,
      }, info) => {
        await openHome(page, HOME_MOBILE);
        await stoneNotBehindText(page, info, '390×844', group);
      });
  },
);

test.describe('I2 reveal zamanlaması (§13.3.5)', { tag: ['@desktop-chromium'] }, () => {
  test('I2 reveals complete before 75% (readingScroll, 10 svh/s)', async ({ page }, info) => {
    await openHome(page);
    const m = await measure(page);
    await installRevealProbe(page, 'scroll');
    await readingScroll(page, 0, Math.ceil(svh(m, m.maxScroll)));
    assertRevealHits(info, 'I2 readingScroll', await revealHits(page));
  });

  // readingScroll her adımda anında window.scrollTo yapar; Chrome her birinde scrollend yayar ve §5.14.6 süpürmesi
  // görünüme giren öğeyi anında açar. Gerçek tetikleyicileri (top 88% / top 75%) tekerlek + Lenis sınar.
  test('I2 reveals complete before 75% (tekerlek + Lenis, 10 svh/s)', async ({ page }, info) => {
    await openHome(page);
    const m = await measure(page);
    await page.mouse.move(720, 450);
    await installRevealProbe(page, 'interval');
    await wheelTo(page, m.maxScroll);
    assertRevealHits(info, 'I2 tekerlek', await revealHits(page));
  });
});

test.describe('I3 dwell sabitliği (§13.3.5, K-AREAS-5)', { tag: ['@desktop-chromium'] }, () => {
  test('I3 dwell stillness: areas dwell’lerinde rotY sabit; work / journey dwell’lerinde rotYScroll ≤ 33.4°/100 svh, kamera sabit', async ({
    page,
  }, info) => {
    await openHome(page);
    await page.mouse.move(-1, -1); // işaretçi pencere dışında
    const m = await measure(page);
    const c = ctxOf(m, await stageData(page));
    const { S, N } = c;
    const windows: { kind: 'areas' | 'work' | 'journey'; name: string; y0: number; y1: number }[] =
      [];
    if (m.areas)
      for (let k = 0; k < N; k++)
        windows.push({
          kind: 'areas',
          name: `areas dwell ${k}`,
          y0: areasY(c, k === 0 ? 10 : 10 + S * k + 0.3 * S),
          y1: areasY(c, 10 + S * (k + 1)),
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
          });
      });
    }
    const rates: string[] = [];
    for (const w of windows) {
      await test.step(`${w.name} (s ${fmt(svh(m, w.y0))}–${fmt(svh(m, w.y1))})`, async () => {
        const pts: { s: number; v: Values }[] = [];
        for (let i = 0; i < 5; i++) {
          const y = w.y0 + ((i + 0.5) / 5) * (w.y1 - w.y0);
          await jumpTo(page, y);
          const r = await readTarget(page);
          pts.push({ s: svh(m, r.y), v: r.values });
        }
        const first = pts[0]!;
        const last = pts.at(-1)!;
        for (const p of pts.slice(1)) {
          for (const k of CAMERA)
            expect
              .soft(
                Math.abs((p.v[k] ?? 0) - (first.v[k] ?? 0)),
                `${w.name} s ${fmt(p.s)}: ${k} ${fmt(p.v[k])} ≠ ${fmt(first.v[k])}`,
              )
              .toBeLessThanOrEqual(0.01);
          if (w.kind === 'areas') {
            const rot = (x: Values) => (x.rotYScroll ?? 0) + (x.rotYEvent ?? 0);
            expect
              .soft(
                Math.abs(rot(p.v) - rot(first.v)),
                `${w.name} s ${fmt(p.s)}: rotY ${fmt(rot(p.v))} ≠ ${fmt(rot(first.v))}`,
              )
              .toBeLessThanOrEqual(0.5);
          } else {
            for (const k of STILL) {
              const tol = ANGLES.has(k) ? 0.5 : 0.01;
              expect
                .soft(
                  Math.abs((p.v[k] ?? 0) - (first.v[k] ?? 0)),
                  `${w.name} s ${fmt(p.s)}: ${k} ${fmt(p.v[k])} ≠ ${fmt(first.v[k])} (dwell'de yalnız rotYScroll değişir)`,
                )
                .toBeLessThanOrEqual(tol);
            }
          }
        }
        if (w.kind !== 'areas') {
          const ds = last.s - first.s;
          const dr = Math.abs((last.v.rotYScroll ?? 0) - (first.v.rotYScroll ?? 0));
          rates.push(`${w.name}: ${fmt((dr / Math.max(ds, 1e-6)) * 100)}°/100 svh`);
          expect
            .soft(dr, `${w.name}: rotYScroll ${fmt(dr)}° / ${fmt(ds)} svh > 33.4°/100 svh (+1°)`)
            .toBeLessThanOrEqual((33.4 * ds) / 100 + 1);
        }
      });
    }
    note(info, 'I3 dönüş hızları', rates);
  });
});

test.describe('K-GEN-9 / K-CHOREO-5 kesme kuralı (§5.9.7)', { tag: ['@desktop-chromium'] }, () => {
  test('K-GEN-9 header’dan uzak atlama (#giris → #yolculuk) ≤ 150 ms’de söner, varışta ≤ 250 ms’de döner; komşu atlama sönmez', async ({
    page,
  }, info) => {
    await page.addInitScript(recordScene);
    await openHome(page);
    await clearRecords(page);
    await page.locator('header a[href="#yolculuk"]').first().click();
    await settle(page, 600);
    let rec = await records(page);
    const t0 = rec.find((r) => r.kind === 'click')?.t ?? 0;
    const far = cutTiming(rec, t0, 'arrive');
    note(info, 'K-GEN-9 uzak atlama (ms)', far);
    note(info, 'K-GEN-9 uzak atlama zaman çizelgesi', timeline(rec, t0));
    expect(far.reachedZero, 'uzak atlamada --scene-opacity 0’a iner').toBe(true);
    expect
      .soft(far.stale, 'varışta sahne görünürken rig hedef durumu çizmiş olmalı (eski kare yok)')
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
    const top = await page.evaluate(() => {
      const pad =
        Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      return document.getElementById('yolculuk')!.getBoundingClientRect().top - pad;
    });
    expect.soft(Math.abs(top), 'varış: #yolculuk başı scroll-padding’de').toBeLessThanOrEqual(2);

    // komşu atlama: başa dön (anında sıçrama kendi kesmesini yapar; durulmasını bekle), sonra #giris → #ben
    await jumpTo(page, 0);
    await clearRecords(page);
    await page.locator('header a[href="#ben"]').first().click();
    await settle(page, 600);
    rec = await records(page);
    const t1 = rec.find((r) => r.kind === 'click')?.t ?? 0;
    const near = cutTiming(rec, t1, 'arrive');
    note(info, 'K-GEN-9 komşu atlama', { minOp: near.minOp, finalY: near.finalY });
    expect.soft(near.minOp, 'komşu atlamada --scene-opacity 0’a inmez').toBeGreaterThan(0.01);
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
    const before = await readTarget(page);
    const link = page.locator('[data-work-article]').nth(1).locator('a[href^="/projeler/"]');
    const href = (await link.getAttribute('href')) ?? '';
    await link.click();
    await page.waitForURL(`**${href}`);
    await settle(page, 600);
    const projectOpacity = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.getElementById('scene-layer')!).opacity),
    );
    await clearRecords(page);
    await page.goBack();
    await page.waitForURL((u) => u.pathname === '/');
    await settle(page, 600);
    const rec = await records(page);
    const pop = rec.find((r) => r.kind === 'popstate')?.t ?? rec[0]?.t ?? 0;
    const t = cutTiming(rec, pop, 'zero');
    const after = await readTarget(page);
    note(info, 'K-CHOREO-5 rota geri (ms)', { projeSayfasiOpaklik: projectOpacity, ...t });
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
    expect
      .soft(
        t.backFrameFree ?? Number.NaN,
        `geri: oturmadan ${fmt(t.backFrameFree ?? undefined)} ms sonra hâlâ < 1 (ham ${fmt(t.backRaw ?? undefined)} ms)`,
      )
      .toBeLessThanOrEqual(200);
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
      .soft(
        t.stale,
        'sahne görünürken rig hedef durumu çizmiş olmalı (eski kare / morf zinciri yok)',
      )
      .toEqual([]);
    for (const k of STATE) {
      const tol = ANGLES.has(k) ? 0.5 : 0.01;
      expect
        .soft(
          Math.abs((after.values[k] ?? Number.NaN) - (before.values[k] ?? Number.NaN)),
          `geri: ${k} ${fmt(after.values[k])} ≠ ${fmt(before.values[k])}`,
        )
        .toBeLessThanOrEqual(tol);
    }
    await page.goForward();
    await page.waitForURL(`**${href}`);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { message: 'ileri: en üstte' })
      .toBe(0);
  });

  test('K-CHOREO-5 sayfa içi geri (#yolculuk → geri): sahne keser, morf zinciri oynamaz', async ({
    page,
  }, info) => {
    await page.addInitScript(recordScene);
    await openHome(page);
    await page.locator('header a[href="#yolculuk"]').first().click();
    await settle(page, 600);
    await clearRecords(page);
    await page.goBack();
    await settle(page, 600);
    const rec = await records(page);
    const pop = rec.find((r) => r.kind === 'popstate')?.t ?? rec[0]?.t ?? 0;
    const t = cutTiming(rec, pop, 'zero');
    note(info, 'K-CHOREO-5 çapa geri (ms)', t);
    note(info, 'K-CHOREO-5 çapa geri zaman çizelgesi', timeline(rec, pop));
    expect
      .soft(await page.evaluate(() => window.scrollY), 'geri: başa dönüldü')
      .toBeLessThanOrEqual(2);
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
      .soft(
        t.stale,
        'sahne görünürken rig hedef durumu çizmiş olmalı (eski kare / morf zinciri yok)',
      )
      .toEqual([]);
  });

  test('K-CHOREO-5 çapa atlamasından sonra elle kaydırılan konum, proje sayfasından geri dönünce geri gelir (± 2 svh)', async ({
    page,
  }, info) => {
    await openHome(page);
    const m = await measure(page);
    await page.locator('header a[href="#yolculuk"]').first().click(); // URL #yolculuk olur
    await settle(page, 600);
    // ziyaretçi tekerlekle work'ün 2. makalesine geri çıkar
    const y = await page.evaluate(() => {
      const a = document.querySelectorAll<HTMLElement>('[data-work-article]')[1]!;
      return a.getBoundingClientRect().top + window.scrollY - 0.1 * window.innerHeight;
    });
    await page.mouse.move(720, 450);
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

test.describe('about ve areas (K-ABOUT-1, K-AREAS-3/4/6)', { tag: ['@desktop-chromium'] }, () => {
  test('K-ABOUT-1 s 30 / 65 / 100 / 140: kesit çizgisi scaleX = cutProgress (± 0.02); s 100 cut 0.35; s 140 cut 0, ringContrast 1', async ({
    page,
  }) => {
    await openHome(page);
    const m = await measure(page);
    const pts: [string, number][] = [
      ['s 30', yAt(m, 'about', 'in', 0.3)],
      ['s 65', yAt(m, 'about', 'in', 0.65)],
      ['s 100', yAt(m, 'about', 'in', 1)],
      ['s 140', yAt(m, 'about', 'body', 1)],
    ];
    for (const [label, y] of pts) {
      await stepTo(page, y);
      const v = (await readTarget(page)).values;
      const cp = (1.1 - (v.cut ?? Number.NaN)) / 1.1;
      const scaleX = await page.evaluate(() => {
        const t = getComputedStyle(document.querySelector('[data-cut-line]')!).transform;
        return t === 'none' ? 1 : new DOMMatrixReadOnly(t).a;
      });
      expect
        .soft(Math.abs(scaleX - cp), `${label}: scaleX ${fmt(scaleX)} ↔ cutProgress ${fmt(cp)}`)
        .toBeLessThanOrEqual(0.02);
      if (label === 's 100')
        expect
          .soft(Math.abs((v.cut ?? 0) - 0.35), `s 100 cut ${fmt(v.cut)}`)
          .toBeLessThanOrEqual(0.01);
      if (label === 's 140') {
        expect.soft(Math.abs(v.cut ?? 1), `s 140 cut ${fmt(v.cut)}`).toBeLessThanOrEqual(0.01);
        expect
          .soft(Math.abs((v.ringContrast ?? 0) - 1), `s 140 ringContrast ${fmt(v.ringContrast)}`)
          .toBeLessThanOrEqual(0.01);
      }
    }
  });

  test('K-AREAS-3 açıklama değişimleri sA(k) + 0.15·S’de (± 2 svh), sayaç ve aria-current aynı anda; K-AREAS-4 iki açıklama aynı anda görünmez', async ({
    page,
  }, info) => {
    await openHome(page);
    const m = await measure(page);
    const c = ctxOf(m, await stageData(page));
    expect(m.areas, 'areas pin etkin').not.toBeNull();
    const changes: string[] = [];
    for (let k = 1; k < c.N; k++) {
      const sk = areasY(c, 10 + c.S * k + 0.15 * c.S);
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
            .toBe(`${pad(st.active + 1)} / ${pad(c.N)}`);
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
      if (k >= c.N) continue;
      const sk = areasY(c, 10 + c.S * k + 0.15 * c.S);
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

  test('K-AREAS-6 başlık tıklaması 0.8 s içinde sA(k) + 0.65·S’ye (± 2 svh); etkin olmayan açıklamaya focusin o adıma kaydırır', async ({
    page,
  }, info) => {
    await page.addInitScript(recordScene);
    await openHome(page);
    const m = await measure(page);
    const c = ctxOf(m, await stageData(page));
    expect(m.areas, 'areas pin etkin').not.toBeNull();
    const k = Math.min(2, c.N - 1);
    await stepTo(page, areasY(c, 10 + 0.5 * c.S)); // dwell 0
    await clearRecords(page);
    await page.locator(`[data-area-step="${k}"]`).click();
    await settle(page, 600);
    const rec = await records(page);
    const t0 = rec.find((r) => r.kind === 'click')?.t ?? 0;
    // kaydırma konumu kare örneklerinden ('scroll' olayı yazımdan bir kare sonra gelir); varış ±1 px
    const { arrive, prevMove } = arrival(rec, t0);
    const last = arrive === undefined ? undefined : { t: arrive };
    const prev = prevMove === undefined ? undefined : { t: prevMove };
    const want = areasY(c, 10 + c.S * k + 0.65 * c.S);
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

    const j = c.N - 1;
    await page.locator(`[data-area-desc="${j}"] a`).first().focus();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).not.toBe(y);
    await settle(page, 600);
    const y2 = await page.evaluate(() => window.scrollY);
    const want2 = areasY(c, 10 + c.S * j + 0.65 * c.S);
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
  test('K-WORK-2 aktivasyonlar T_work − 25 + 70k svh’de (± 2); K-WORK-1 BODY’de silme dışında tam bir figür açık', async ({
    page,
  }, info) => {
    await openHome(page);
    const m = await measure(page);
    const d = await stageData(page);
    const T = m.chapters.find((x) => x.id === 'work')!.top;
    const found: string[] = [];
    for (let k = 0; k < m.counts.P; k++) {
      // DOM sayımı: başlık bloğu 30 svh + makale 70 svh, aktivasyon "top 55%" (§4.9.3, §5.9.5)
      const sk = T + (0.3 + 0.7 * k - 0.55) * m.vh;
      const area = d.projects[k]?.area ?? null;
      await test.step(`proje ${k + 1} (beklenen s ${fmt(svh(m, sk))})`, async () => {
        await stepTo(page, sk - 0.03 * m.vh);
        const at = await page.evaluate(
          async ({ from, to, step, k, fill }) => {
            const st = (window as unknown as StageWindow).__stage;
            for (let y = from; y <= to; y += step) {
              window.scrollTo({ top: Math.round(y), behavior: 'instant' });
              for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
              await new Promise((r) => setTimeout(r, 60));
              const glyph = [
                ...document.querySelectorAll<HTMLElement>('[data-work-specimen-glyph]'),
              ].findIndex((g) => !g.hidden);
              const on = k === 0 ? fill !== null && (st.target[fill] ?? 0) > 0.13 : glyph === k;
              if (on) return window.scrollY;
            }
            return null;
          },
          {
            from: sk - 0.03 * m.vh,
            to: sk + 0.03 * m.vh,
            step: 0.0025 * m.vh,
            k,
            fill: area === null ? null : `fill${area}`,
          },
        );
        found.push(
          `${k + 1}: ${fmt(at === null ? undefined : svh(m, at))} (beklenen ${fmt(svh(m, sk))})`,
        );
        expect(at, `proje ${k + 1} ±3 svh içinde etkinleşir`).not.toBeNull();
        expect
          .soft(Math.abs(svh(m, (at ?? Number.NaN) - sk)), `proje ${k + 1} aktivasyon konumu`)
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
    await openHome(page);
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
    await page.mouse.move(720, 450);
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
    test('K-JOURNEY-2 aktivasyonlar T_journey − 15 + 35k svh’de (± 2), bant tween’i 500 ms, tek vurgulu yıl; K-JOURNEY-3 bant içe, arcGlow 0.2', async ({
      page,
    }, info) => {
      await openHome(page);
      const m = await measure(page);
      const d = await stageData(page);
      const T = m.chapters.find((x) => x.id === 'journey')!.top;
      const rows: unknown[] = [];
      const centers: number[] = [];
      for (let k = 0; k < m.counts.E; k++) {
        // DOM sayımı: başlık bloğu 40 svh + girdi 35 svh, aktivasyon "top 55%" (§4.10.2, §5.9.5)
        const sk = T + (0.4 + 0.35 * k - 0.55) * m.vh;
        const band = d.entries[k]?.band ?? NO_BAND;
        await test.step(`girdi ${k + 1} (beklenen s ${fmt(svh(m, sk))})`, async () => {
          await stepTo(page, sk - 0.03 * m.vh);
          const r = await page.evaluate(
            async ({ from, to, step, k, band }) => {
              const st = (window as unknown as StageWindow).__stage;
              const [b0 = 0, b1 = 0] = band;
              const active = () =>
                [...document.querySelectorAll('[data-journey-entry]')].findIndex((e) =>
                  e.hasAttribute('data-active'),
                );
              for (let y = from; y <= to; y += step) {
                window.scrollTo({ top: Math.round(y), behavior: 'instant' });
                const t0 = performance.now();
                for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
                if (active() !== k) continue;
                // bant tween'i: hedef değerine ulaşana kadar kare kare örnekle
                const samples: [number, number, number][] = [];
                while (performance.now() - t0 < 1200) {
                  samples.push([
                    performance.now() - t0,
                    st.target.bandStart ?? 0,
                    st.target.bandEnd ?? 0,
                  ]);
                  await new Promise((r) => requestAnimationFrame(r));
                }
                const final = (s: [number, number, number]) =>
                  Math.abs(s[1] - b0) < 1e-3 && Math.abs(s[2] - b1) < 1e-3;
                const firstFinal = samples.find(final)?.[0] ?? null;
                const lastOff = samples.filter((s) => !final(s)).at(-1)?.[0] ?? null;
                const frames = samples
                  .slice(1)
                  .map((s, i) => s[0] - samples[i]![0])
                  .sort((a, b) => a - b);
                return {
                  y: window.scrollY,
                  firstFinal,
                  lastOff,
                  frame: frames[Math.floor(frames.length / 2)] ?? 0,
                };
              }
              return null;
            },
            {
              from: sk - 0.03 * m.vh,
              to: sk + 0.03 * m.vh,
              step: 0.0025 * m.vh,
              k,
              band: [band[0], band[1]],
            },
          );
          expect(r, `girdi ${k + 1} ±3 svh içinde etkinleşir`).not.toBeNull();
          if (!r) return;
          rows.push({
            k: k + 1,
            s: fmt(svh(m, r.y)),
            beklenen: fmt(svh(m, sk)),
            // girdinin düzendeki "top 55%" çizgisi (reveal dönüşümü hariç)
            cizgi: fmt(svh(m, m.activation.journey[k] ?? Number.NaN)),
            bantSon: fmt(r.firstFinal ?? undefined),
            sonAra: fmt(r.lastOff ?? undefined),
            kare: fmt(r.frame),
          });
          expect
            .soft(Math.abs(svh(m, r.y - sk)), `girdi ${k + 1} aktivasyon konumu`)
            .toBeLessThanOrEqual(2);
          // tween ani değildir ve 500 ms'de biter. Kare hızından bağımsız: ilk "varmış" örnek ≥ 400 ms (iki kare
          // beklemesi 400 ms'yi aşarsa ölçülemez), son "arada" örnek ≤ 500 ms + 2 kare (tween bir sonraki tick'te başlar)
          expect
            .soft(
              r.firstFinal ?? 0,
              `girdi ${k + 1}: bant ${fmt(r.firstFinal ?? undefined)} ms’de vardı (tween ≈ 500 ms)`,
            )
            .toBeGreaterThanOrEqual(400);
          expect
            .soft(
              r.lastOff ?? 0,
              `girdi ${k + 1}: bant ${fmt(r.lastOff ?? undefined)} ms’de hâlâ arada`,
            )
            .toBeLessThanOrEqual(500 + 2 * r.frame);
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
            };
          });
          expect.soft(hi.active, `girdi ${k + 1}: tek etkin girdi`).toEqual([k]);
          expect
            .soft([...new Set(hi.accent)], `girdi ${k + 1}: vurgulu yıl yalnız etkin girdide`)
            .toEqual([k]);
          const v = (await readTarget(page)).values;
          centers.push(((v.bandStart ?? 0) + (v.bandEnd ?? 0)) / 2);
        });
      }
      note(info, 'K-JOURNEY-2 aktivasyon ve bant (svh, ms)', rows);
      note(info, 'K-JOURNEY-3 bant merkezleri', centers);
      for (let i = 1; i < centers.length; i++)
        expect
          .soft(centers[i]!, `bant merkezi ${i + 1} ≤ ${i}: içe doğru`)
          .toBeLessThanOrEqual(centers[i - 1]!);
      expect.soft(centers.at(-1)!, 'son bant ilkinden içeride').toBeLessThan(centers[0]!);
      const body = phaseOf(m, 'journey', 'body');
      for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        await jumpTo(page, body.y0 + f * (body.y1 - body.y0));
        const v = (await readTarget(page)).values;
        expect
          .soft(Math.abs((v.arcGlow ?? 0) - 0.2), `journey BODY p ${f}: arcGlow ${fmt(v.arcGlow)}`)
          .toBeLessThanOrEqual(0.01);
      }
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
      await openHome(page);
      const m = await measure(page);
      const cin = phaseOf(m, 'contact', 'in');
      const want = {
        h2: svh(m, cin.y0 + 0.55 * (cin.y1 - cin.y0)),
        text: svh(m, cin.y0 + 0.7 * (cin.y1 - cin.y0)),
      };
      await jumpTo(page, cin.y0 - 0.1 * m.vh);
      await watch();
      await page.mouse.move(720, 450);
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

/* ── §5.19 "Track'ler, event'ler, determinizm": piksel düzeyinde yol bağımsızlığı ── */

type PixelLayout = {
  vh: number;
  maxScroll: number;
  areas: { bodyY0: number; bodyLen: number; S: number; N: number } | null;
  activation: { work: number[]; journey: number[] };
};

const pixelLayout = (page: Page) =>
  page.evaluate(() => {
    const l = (window as unknown as { __stage: { live: { layout: PixelLayout | null } } }).__stage
      .live.layout;
    return l
      ? { vh: l.vh, maxScroll: l.maxScroll, areas: l.areas, activation: l.activation }
      : null;
  });

/** İşaretçi pencere dışında, sahne duraklatılmış (idle ve nabızlar donar); hedef oturunca kare tek adımda oturtulur */
async function freezeAndSnap(page: Page): Promise<{ cx: number; cy: number; r: number }> {
  await page.mouse.move(-1, -1);
  await page.evaluate(() =>
    (
      window as unknown as { __stage: { store: { getState(): { setPaused(v: boolean): void } } } }
    ).__stage.store
      .getState()
      .setPaused(true),
  );
  await settle(page, 400);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        type S = {
          live: { snapNextFrame: boolean; frames: number };
          store: { getState(): { invalidate(): void } };
        };
        const st = (window as unknown as { __stage: S }).__stage;
        st.live.snapNextFrame = true;
        st.store.getState().invalidate();
        const f0 = st.live.frames;
        const wait = () =>
          st.live.frames > f0 && !st.live.snapNextFrame
            ? requestAnimationFrame(() => resolve())
            : requestAnimationFrame(wait);
        requestAnimationFrame(wait);
      }),
  );
  return page.evaluate(() => {
    const s = (
      window as unknown as { __stage: { live: { stone: { cx: number; cy: number; r: number } } } }
    ).__stage.live.stone;
    return { cx: s.cx, cy: s.cy, r: s.r };
  });
}

/** Taş dairesinin kutusu, ham RGB */
async function stoneShot(page: Page, c: { cx: number; cy: number; r: number }) {
  const vp = page.viewportSize()!;
  const x = Math.max(0, Math.floor(c.cx - c.r));
  const y = Math.max(0, Math.floor(c.cy - c.r));
  const clip = {
    x,
    y,
    width: Math.max(1, Math.min(vp.width - x, Math.ceil(2 * c.r))),
    height: Math.max(1, Math.min(vp.height - y, Math.ceil(2 * c.r))),
  };
  return sharp(await page.screenshot({ clip }))
    .raw()
    .toBuffer({ resolveWithObject: true });
}

type RawImage = { data: Buffer; info: { width: number; height: number; channels: number } };

/** Farklı piksellerin oranı (kanal toplam farkı > 30) */
function diffRatio(a: RawImage, b: RawImage): number {
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return 1;
  let diff = 0;
  const n = a.info.width * a.info.height;
  for (let i = 0; i < a.data.length; i += a.info.channels) {
    const d =
      Math.abs(a.data[i]! - b.data[i]!) +
      Math.abs(a.data[i + 1]! - b.data[i + 1]!) +
      Math.abs(a.data[i + 2]! - b.data[i + 2]!);
    if (d > 30) diff++;
  }
  return diff / n;
}

test.describe(
  '§5.19 piksel düzeyinde yol bağımsızlığı (yavaş kaydırma, sıçrama, yeniden yükleme)',
  { tag: ['@desktop-chromium'] },
  () => {
    const targets: ReadonlyArray<readonly [string, (l: PixelLayout) => number]> = [
      [
        'areas adım 1 dwell',
        (l) =>
          l.areas
            ? l.areas.bodyY0 +
              ((10 + l.areas.S * 1 + 0.65 * l.areas.S) / (20 + l.areas.S * l.areas.N)) *
                l.areas.bodyLen
            : Number.NaN,
      ],
      ['work makale 2 dwell', (l) => (l.activation.work[1] ?? Number.NaN) + 0.1 * l.vh],
      ['journey girdi 3 dwell', (l) => (l.activation.journey[2] ?? Number.NaN) + 0.1 * l.vh],
      ['sayfa sonu (K5)', (l) => l.maxScroll],
    ];
    for (const [name, yOf] of targets) {
      test(`${name}: üç yoldan gelinen kanvas görüntüleri ≤ %1 farklı`, async ({ page }) => {
        test.setTimeout(180_000);
        await page.goto('/?debug&tier=high');
        await waitForStagePhase(page, ['ready'], 30_000);
        await settle(page);
        const l = await pixelLayout(page);
        expect(l, 'live.layout').not.toBeNull();
        const y = Math.round(Math.min(l!.maxScroll, yOf(l!)));
        expect(Number.isFinite(y), `${name} konumu`).toBe(true);
        // (a) yavaş kaydırma: 40 svh yukarıdan okuma hızıyla
        const svhOf = (px: number) => (100 * px) / l!.vh;
        await page.evaluate(
          (v) => window.scrollTo({ top: v, behavior: 'instant' }),
          y - 0.4 * l!.vh,
        );
        await settle(page);
        await readingScroll(page, Math.round(svhOf(y) - 40), Math.round(svhOf(y)));
        await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
        const ca = await freezeAndSnap(page);
        const a = await stoneShot(page, ca);
        // (b) sıçrama: en üstten tek adımda (kesme kuralı)
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await settle(page);
        await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
        const cb = await freezeAndSnap(page);
        const b = await stoneShot(page, cb);
        // (c) o konumda yeniden yükleme (tarayıcı geri yüklemesi)
        await page.reload();
        await waitForStagePhase(page, ['ready'], 30_000);
        const cc = await freezeAndSnap(page);
        const c = await stoneShot(page, cc);
        for (const [label, o] of [
          ['sıçrama', cb],
          ['yeniden yükleme', cc],
        ] as const)
          expect
            .soft(
              Math.hypot(o.cx - ca.cx, o.cy - ca.cy) + Math.abs(o.r - ca.r),
              `${name} ${label} daire`,
            )
            .toBeLessThanOrEqual(1);
        expect.soft(diffRatio(a, b), `${name}: yavaş ↔ sıçrama`).toBeLessThanOrEqual(0.01);
        expect.soft(diffRatio(a, c), `${name}: yavaş ↔ yeniden yükleme`).toBeLessThanOrEqual(0.01);
      });
    }
  },
);

/* ───────────── V-48: flow anchor senkronu (§5.19 "Kamera ve anchor") ───────────── */

/** Kare başına örnek: rAF'te gönderilen mesaj karenin boyamasından sonra okunur (Lenis yalnız rAF'te kaydırır) */
interface SyncSample {
  f: number; // live.frames: rig'in çizdiği kare sayısı
  y: number; // boyanan kaydırma
  dom: number; // about-cut çapasının boyanan ekran merkezi
  stone: number; // live.stone.cy: rig'in son karesindeki Taş merkezi
}
type SyncWindow = Window & { __v48?: { out: SyncSample[]; stop: boolean } };

/**
 * V-48 (§16.2): masaüstünde Lenis tekerlek kaydırmasında Taş, flow çapasıyla (about-cut) ≤ 1 kare sapmayla kayar. Her
 * karenin boyamasından sonra boyanan kaydırma, çapanın ekran merkezi ve rig'in son Taş merkezi okunur; rig'in kullandığı
 * kaydırma y_rig = y − (stone − dom) önceki karelerin y'siyle eşlenir (k = kaç kare geride). Lenis gsap.ticker'da kaydırır,
 * rig R3F rAF'inde okur: boştaki döngü kaydırmanın ilk karesinde uyanır (k = 1), sonraki kareler k = 0.
 */
test.describe('V-48 flow anchor senkronu (Lenis, masaüstü)', { tag: ['@desktop-chromium'] }, () => {
  test('about-cut (flow): tekerlek kaydırmasında Taş metinle ≤ 1 kare sapmayla kayar', async ({
    page,
  }, info) => {
    await openHome(page);
    await page.waitForFunction(() => document.documentElement.classList.contains('lenis'));
    const range = await page.evaluate(() => {
      const l = (window as unknown as StageWindow).__stage.live.layout;
      const inn = l?.phases.find((q) => q.chapter === 'about' && q.phase === 'in');
      const body = l?.phases.find((q) => q.chapter === 'about' && q.phase === 'body');
      return inn && body ? { from: inn.y0 + 0.65 * (inn.y1 - inn.y0), to: body.y1 } : null;
    });
    expect(range, 'about IN / BODY fazları').not.toBeNull();
    // about IN 0.6'dan BODY sonuna kadar çapa yalnız about-cut'tır (flow; hero-rest → about-cut karışımı 1'de)
    const start = Math.round(range!.from);
    // İşaretçi pencere içinde (tekerlek olayı sayfaya, dolayısıyla Lenis'e ulaşsın) ama Taş'tan uzakta (eğim yok)
    await page.mouse.move(24, 450);
    await jumpTo(page, start);
    // Damped karışım hedefe otursun (SwiftShader'ın düşük kare hızında ~2.5 s) ve döngü boşa düşsün
    await page.waitForFunction(
      () => {
        const st = (window as unknown as StageWindow).__stage;
        return Math.abs(st.rendered.anchorMix! - st.target.anchorMix!) < 1e-4;
      },
      null,
      { timeout: 15_000 },
    );
    // En kötü durum: döngü boştayken (400 ms kare yok) kaydırma başlar; ilk karede rig henüz uyanmamış olabilir
    await page.evaluate(async () => {
      const st = (window as unknown as StageWindow).__stage;
      const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      let last = st.live.frames;
      let still = performance.now();
      while (performance.now() - still < 400) {
        await frame();
        if (st.live.frames !== last) {
          last = st.live.frames;
          still = performance.now();
        }
      }
    });
    await page.evaluate(() => {
      const st = (window as unknown as StageWindow).__stage;
      const el = document.querySelector<HTMLElement>('[data-stage-anchor="about-cut"]')!;
      const v48 = { out: [] as SyncSample[], stop: false };
      (window as SyncWindow).__v48 = v48;
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        const r = el.getBoundingClientRect();
        v48.out.push({
          f: st.live.frames,
          y: window.scrollY,
          dom: r.top + r.height / 2,
          stone: st.live.stone.cy,
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
    const span = Math.min(900, 0.85 * (range!.to - start));
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
    expect(s.length, 'örnek sayısı').toBeGreaterThan(10);
    const c0 = s[0]!.stone - s[0]!.dom; // durgun hâlde Taş merkezi − çapa merkezi (0 beklenir)
    // Rig'in kullandığı kaydırma: y_rig = y − (stone − dom − c0); k = kaç kare geriden geldiği
    const hist = { k0: 0, k1: 0, k2: 0, unmatched: 0 };
    let maxPx = 0;
    let moving = 0;
    for (let i = 1; i < s.length; i++) {
      const cur = s[i]!;
      if (Math.abs(cur.y - s[i - 1]!.y) < 2) continue; // bu karede hareket yok ya da k ayırt edilemez
      moving++;
      const off = cur.stone - cur.dom - c0;
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
    expect(moving, 'hareketli kare sayısı').toBeGreaterThan(5);
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
    // bant görüntü alanının ortasındayken Taş görünür
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
      () =>
        (
          window as unknown as { __stage: { store: { getState(): { loop: string } } } }
        ).__stage.store.getState().loop,
    );
    expect(loop, 'frame loop').toBe('never');
    const frames = () =>
      page.evaluate(() => (window as unknown as StageWindow).__stage.live.frames);
    const f0 = await frames();
    await pageDelay(page, 1000);
    expect(await frames(), 'bant çıktıktan sonra kare').toBe(f0);
  });
});
