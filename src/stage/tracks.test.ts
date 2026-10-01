// src/stage/tracks.test.ts — §5.9.3 değişmezleri 1–7 (test matrisi), §5.9.4 tablo ve varyant değerleri, §4.12.1
// referans konumları, K-CHOREO-1…3, K-GEN-3 ve measureLayout (jsdom). Layout'lar DOM'suz kurulur (layout.fixture.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Intensity } from '@/experience/profile';
import { psiDeg } from '@/lib/section-geometry';
import type { AnchorId } from './anchors';
import { computeIndices, createEventTargets, eventOwned, resolveEvents } from './event-targets';
import {
  KEYFRAME_LABEL,
  contentCtx,
  keyframes,
  type Keyframe,
  type KeyframeKey,
  type StageContentCtx,
} from './keyframes';
import {
  buildFixture,
  mountFixture,
  type Fixture,
  type FixtureSpec,
  type FixtureVariant,
} from './layout.fixture';
import { PRESETS, presetDef } from './presets';
import { stageTarget, type ChapterId, type PresetName, type StageTarget } from './store';
import {
  AREAS_STEP,
  EASE,
  FILL_PROPS,
  SHORT_VIEWPORT_VH,
  TRACK_PROPS,
  applyBase,
  areasTurnEase,
  buildTracks,
  evaluateTracks,
  lastProjectPattern,
  measureLayout,
  resolveTracks,
  stageCtx,
  variantOf,
  type Ease,
  type Layout,
  type ResolvedTrack,
  type Track,
  type TrackPhase,
  type TrackProp,
  type TrackVariant,
  journeyTurnOf,
} from './tracks';

/* ───────────── düzenek ───────────── */

const INITIAL: StageTarget = { ...stageTarget };
const KEYS = Object.keys(INITIAL) as (keyof StageTarget)[];
const HOME_ANCHORS = presetDef('home').anchors;
const anchorIndex = (id: AnchorId): number => HOME_ANCHORS.indexOf(id);
const EPS = 1e-6;
/** §4.12.2 #2: yalnız event'lerin yazdığı alanlar */
const EVENT_ONLY: readonly string[] = ['rotYEvent', 'bandStart', 'bandEnd'];
const isFill = (p: TrackProp): boolean => (FILL_PROPS as readonly string[]).includes(p);
const differs = (a: number, b: number): boolean => !(Math.abs(a - b) <= EPS);
const pairs = <T>(list: readonly T[]): Array<readonly [T, T]> =>
  list.slice(1).map((c, i) => [list[i] as T, c] as const);

/** İhlalleri toplar (milyonlarca expect yerine); ilk 12'si hata mesajında görünür. */
function expectNone(violations: readonly string[]): void {
  expect(violations.slice(0, 12), `${violations.length} ihlal`).toEqual([]);
}

/** Enterpolasyon sonucu (from + (to − from)·1 ≠ to olabilir): alan başına ±1e-9 */
function expectClose(s: StageTarget, exp: Partial<Record<keyof StageTarget, number>>): void {
  for (const [k, v] of Object.entries(exp))
    expect(s[k as keyof StageTarget], k).toBeCloseTo(v as number, 9);
}

interface Built {
  spec: FixtureSpec;
  name: string;
  fx: Fixture;
  ctx: StageContentCtx;
  v: TrackVariant;
  tracks: Track[];
  groups: Map<TrackProp, ResolvedTrack[]>;
  kf: Record<KeyframeKey, Keyframe>;
  /** dolgu event penceresi: work IN p 0.6 → work BODY p 1 (§5.9.5), soyut (o) ve belge (y) koordinatında */
  win: { o0: number; o1: number; y0: number; y1: number };
}

function phaseOf(layout: Layout, chapter: ChapterId, phase: TrackPhase) {
  const r = layout.phases.find((p) => p.chapter === chapter && p.phase === phase);
  if (!r) throw new Error(`faz yok: ${chapter}·${phase}`);
  return r;
}
const yAt = (layout: Layout, chapter: ChapterId, phase: TrackPhase, p: number): number => {
  const r = phaseOf(layout, chapter, phase);
  return r.y0 + p * (r.y1 - r.y0);
};

const specName = (s: FixtureSpec): string =>
  [
    s.variant,
    `N${s.N} P${s.P} E${s.E}`,
    s.testimonials ? '+testimonials' : '',
    s.short ? 'kısa' : '',
    s.areas ? `alanlar=${JSON.stringify(s.areas)}` : '',
  ]
    .filter(Boolean)
    .join(' ');

function build(spec: FixtureSpec, ease?: Ease): Built {
  const fx = buildFixture(spec);
  const ctx = stageCtx(fx.data, fx.layout);
  const v = variantOf(fx.layout);
  const tracks = ease
    ? buildTracks('home', ctx, fx.layout, v, ease)
    : buildTracks('home', ctx, fx.layout, v);
  const wIn = phaseOf(fx.layout, 'work', 'in');
  const wBody = phaseOf(fx.layout, 'work', 'body');
  return {
    spec,
    name: specName(spec),
    fx,
    ctx,
    v,
    tracks,
    groups: resolveTracks(tracks, fx.layout),
    kf: keyframes(ctx),
    win: {
      o0: wIn.order + 0.6,
      o1: wBody.order + 1,
      y0: wIn.y0 + 0.6 * (wIn.y1 - wIn.y0),
      y1: wBody.y1,
    },
  };
}

/** §5.9.3 adım 1–2: taban (K0) + track'ler. Pencerede dolgulara dokunulmaz (event'lerindir). */
function trackState(b: Built, y: number, out: StageTarget = { ...INITIAL }): StageTarget {
  const owned = (p: TrackProp, yy: number) => eventOwned(b.fx.layout, p, yy);
  applyBase(out, b.kf.hero, anchorIndex, owned('fill0', y));
  evaluateTracks(b.groups, y, out, anchorIndex, owned);
  return out;
}

/** + adım 3 anlık: pencerede dolgular resolveEvents'ten gelir (dinlenmiş tam durum, §4.12.2 #3). */
function fullState(b: Built, y: number, out?: StageTarget): StageTarget {
  const s = trackState(b, y, out);
  const ix = computeIndices(b.fx.layout, y);
  if (ix.fillWindow) {
    const t = resolveEvents('home', ix, b.fx.data, b.ctx, createEventTargets());
    FILL_PROPS.forEach((p, i) => (s[p] = t.fills[i] ?? Number.NaN));
  }
  return s;
}

/* ───────────── test matrisi (§5.9.3 #7) ───────────── */

const VARIANTS: readonly FixtureVariant[] = ['desktop', 'mobile', 'mobile-list', 'landscape'];
/** yoğunluk → areas dönüş easing'i; matris noktaları arasında dönüşümlü kullanılır (§5.6.7) */
const TURN_EASES: readonly Ease[] = (['calm', 'standard', 'expressive'] as const).map((i) =>
  areasTurnEase(i),
);

function matrix(variant: FixtureVariant): FixtureSpec[] {
  const out: FixtureSpec[] = [];
  for (const N of [3, 4, 5, 6, 7])
    for (const P of [3, 4, 5])
      for (let E = 1; E <= 6; E++)
        for (const testimonials of [false, true])
          for (const short of [false, true]) out.push({ variant, N, P, E, testimonials, short });
  // Alanı null olan öne çıkan projeler: proje 1 (W₀ = lastPsi) ve son proje (eksik → null; pattern hep 0.12).
  for (const N of [3, 4, 5, 6])
    for (const testimonials of [false, true])
      out.push({ variant, N, P: 3, E: 4, testimonials, areas: [null, 2] });
  return out;
}

/* ── varyant ve bağlam (§5.9.4 varyantlar, §5.8.1 W₀) ── */
function variantViolations(b: Built): string[] {
  const { spec: s, v, ctx } = b;
  const exp: TrackVariant = {
    layout: s.variant === 'mobile-list' ? 'mobile' : s.variant,
    areasList: !b.fx.pinned,
    testimonials: !!s.testimonials,
    shortViewport: s.variant === 'desktop' && !!s.short,
  };
  const out: string[] = [];
  if (
    (['layout', 'areasList', 'testimonials', 'shortViewport'] as const).some((k) => v[k] !== exp[k])
  )
    out.push(`${b.name}: varyant ${JSON.stringify(v)}`);
  const list = !b.fx.pinned; // pin yoksa referans açı ψ₀ = 45 (§5.8.1)
  const lastPsi = list ? 45 : 45 - ((s.N - 1) * 360) / s.N;
  const a1 = b.fx.data.projects[0]?.area ?? null;
  const w0 =
    a1 === null
      ? ctx.W0 === lastPsi
      : Math.abs(ctx.W0 - lastPsi) <= 180 && Math.abs((ctx.W0 - psiDeg(a1, ctx.N)) % 360) < EPS;
  if (ctx.areasMode !== (list ? 'list' : 'dial') || ctx.lastPsi !== lastPsi || !w0)
    out.push(`${b.name}: bağlam ${ctx.areasMode} lastPsi ${ctx.lastPsi} W₀ ${ctx.W0}`);
  return out;
}

/* ── #1 çakışmama (K-CHOREO-1): o = order + p sırasında o0(i) ≥ o1(i−1); belge y'sinde de ── */
function overlapViolations(b: Built): string[] {
  const out: string[] = [];
  for (const t of b.tracks) {
    if (!(t.start >= 0 && t.start < t.end && t.end <= 1))
      out.push(`${b.name} ${t.prop} ${t.chapter}·${t.phase}: [${t.start}, ${t.end}]`);
    if ((t.prop === 'anchorMix') !== (t.anchors !== undefined))
      out.push(`${b.name} ${t.prop}: anchors yalnız anchorMix'te`);
  }
  for (const [prop, list] of b.groups)
    for (const [a, c] of pairs(list))
      if (c.o0 < a.o0 || c.o0 < a.o1 - EPS || c.y0 < a.y1 - EPS)
        out.push(
          `${b.name} ${prop}: ${a.chapter}·${a.phase} [${a.start}, ${a.end}] ⟂ ${c.chapter}·${c.phase} [${c.start}, ${c.end}]`,
        );
  return out;
}

/* ── #2 süreklilik: from(i) = to(i−1); anchorMix eşdeğeri; dolgu penceresinde event durumu ── */
function continuityViolations(b: Built): string[] {
  const out: string[] = [];
  const { layout, data } = b.fx;
  const eventsAt = (y: number) => {
    const ix = computeIndices(layout, y);
    return { ix, t: resolveEvents('home', ix, data, b.ctx, createEventTargets()) };
  };
  const start = eventsAt(b.win.y0); // work = −1 → i < N için 0.12
  const end = eventsAt(b.win.y1); // son proje etkin → pattern(P)
  if (start.ix.work !== -1 || end.ix.work !== data.projects.length - 1)
    out.push(`${b.name}: pencere uçlarında work ${start.ix.work} / ${end.ix.work}`);
  lastProjectPattern(b.ctx).forEach((v, i) => {
    if (differs(end.t.fills[i] ?? Number.NaN, v))
      out.push(`${b.name} fill${i}: pencere sonu ${end.t.fills[i]} ≠ pattern ${v}`);
  });
  for (const [prop, list] of b.groups)
    for (const [a, c] of pairs(list)) {
      const at = `${b.name} ${prop}: ${a.chapter}·${a.phase} → ${c.chapter}·${c.phase}`;
      if (prop === 'anchorMix') {
        const [a0, a1] = a.anchors ?? [];
        const [c0, c1] = c.anchors ?? [];
        const bad =
          a0 === c0 && a1 === c1
            ? differs(c.from, a.to)
            : differs(a.to, 1) || differs(c.from, 0) || c0 !== a1;
        if (bad) out.push(`${at}: anchorMix ${a1} ${a.to} → ${c0} ${c.from}`);
      } else if (isFill(prop) && a.o1 <= b.win.o0 + EPS && c.o0 >= b.win.o1 - EPS) {
        const i = (FILL_PROPS as readonly string[]).indexOf(prop);
        if (
          differs(a.to, start.t.fills[i] ?? Number.NaN) ||
          differs(c.from, end.t.fills[i] ?? Number.NaN)
        )
          out.push(`${at}: pencere uçları ${a.to} / ${c.from}`);
      } else if (differs(c.from, a.to)) out.push(`${at}: ${a.to} → ${c.from}`);
    }
  return out;
}

/* ── #3 event pencereleri (K-CHOREO-2): dolgu track'i pencereyle kesişmez; event alanlarına track yok ── */
function windowViolations(b: Built): string[] {
  const out: string[] = [];
  const { layout } = b.fx;
  const owned = (y: number) => eventOwned(layout, 'fill0', y);
  // uygulamanın penceresi (eventOwned) şartnameninkiyle aynı: uçlar dahil
  if (!owned(b.win.y0) || owned(b.win.y0 - 1e-3) || !owned(b.win.y1) || owned(b.win.y1 + 1e-3))
    out.push(`${b.name}: eventOwned penceresi work IN p 0.6 → work BODY p 1 değil`);
  for (const t of b.tracks)
    if (!TRACK_PROPS.includes(t.prop) || EVENT_ONLY.includes(t.prop))
      out.push(`${b.name}: event alanına track (${t.prop})`);
  for (const [prop, list] of b.groups) {
    if (!isFill(prop)) continue;
    for (const t of list) {
      const inside = [0.001, 0.25, 0.5, 0.75, 0.999].some((u) => owned(t.y0 + u * (t.y1 - t.y0)));
      if (
        inside ||
        (t.o0 < b.win.o1 - EPS && t.o1 > b.win.o0 + EPS) ||
        (t.y0 < b.win.y1 - EPS && t.y1 > b.win.y0 + EPS)
      )
        out.push(`${b.name} ${prop}: ${t.chapter}·${t.phase} [${t.start}, ${t.end}] pencerede`);
    }
  }
  return out;
}

/* ── #4 anahtar üretimi (§5.8.4 konumları) ── */
const K_AT: ReadonlyArray<readonly [KeyframeKey, ChapterId, TrackPhase, number]> = [
  ['about-lift', 'about', 'in', 0.3],
  ['about-cut-in', 'about', 'in', 1],
  ['about-half', 'about', 'body', 1],
  ['areas-plan', 'areas', 'in', 1],
  ['work-specimen', 'work', 'in', 1],
  ['journey-core', 'journey', 'in', 1],
  ['contact-ring', 'contact', 'in', 1],
];
type NumericKey = Exclude<keyof Keyframe, 'anchor' | 'fills'>;
// prettier-ignore
const KF_FIELDS: ReadonlyArray<readonly [NumericKey, keyof StageTarget]> = [
  ['r', 'camR'], ['az', 'camAz'], ['el', 'camEl'], ['fov', 'camFov'], ['rotY', 'rotYScroll'], ['rotX', 'rotX'],
  ['cut', 'cut'], ['ringContrast', 'ringContrast'], ['sectorMix', 'sectorMix'], ['ghost', 'ghost'],
  ['arcGlow', 'arcGlow'], ['lightAz', 'lightAz'], ['lightEl', 'lightEl'], ['rim', 'rim'], ['tone', 'tone'],
  ['bandVisible', 'bandVisible'],
];

/** Varyantın opaklık track'leri anahtar konumunda (§5.9.4 varyantlar); null = geçiş ortası, karşılaştırılmaz. */
function expectedOpacity(v: TrackVariant, key: KeyframeKey): number | null {
  if (v.layout === 'landscape') return key === 'hero' ? 1 : key === 'about-lift' ? null : 0;
  if (v.layout === 'mobile' && key === 'about-lift') return null; // el değiştirmenin belirme ortası (p 0.26–0.42)
  if (key === 'areas-plan') return v.areasList ? 0 : 1;
  if (key === 'work-specimen') return v.layout === 'mobile' ? 0 : 1;
  return 1;
}

function keyframeViolations(b: Built): string[] {
  const out: string[] = [];
  const { layout } = b.fx;
  if (differs(layout.heroExit, yAt(layout, 'about', 'in', 0.3)))
    out.push(`${b.name}: heroExit about IN p 0.30 değil`);
  const n = Math.min(b.ctx.N, 6); // i ≥ N dolgular anahtar tablosunda yok (§5.9.4: fill i < N)
  const at: Array<readonly [KeyframeKey, number]> = [
    ['hero', 0],
    ...K_AT.map(([k, c, ph, p]) => [k, yAt(layout, c, ph, p)] as const),
  ];
  for (const [key, y] of at) {
    const k = b.kf[key];
    const s = fullState(b, y); // K3'te dolgular event'lerindir: proje 1'in alanı 0.6, diğerleri 0.12
    const label = `${b.name} ${KEYFRAME_LABEL[key]}`;
    const exp = new Map<keyof StageTarget, number>(KF_FIELDS.map(([f, p]) => [p, k[f]]));
    FILL_PROPS.slice(0, n).forEach((p, i) => exp.set(p, k.fills[i] ?? Number.NaN));
    if (key === 'work-specimen' && b.v.shortViewport) exp.set('tone', 0); // §4.9.4 [SABİT] #8
    const op = expectedOpacity(b.v, key);
    if (op !== null) exp.set('opacityTrack', op);
    if (k.anchor === 'blend') {
      // K1a: hero-rest → about-cut, karışım 0.45 (§5.8.4). Mobil ve yatayda el değiştirme (SPEC-SAPMA §4.15.3):
      // mobilde çapa p 0.25'te değişti (1), yatayda p 0.50'de değişecek (0)
      exp.set('anchorMix', b.v.layout === 'desktop' ? 0.45 : b.v.layout === 'mobile' ? 1 : 0);
      exp.set('anchorFrom', anchorIndex('hero-rest'));
      exp.set('anchorTo', anchorIndex('about-cut'));
    } else {
      const settled = s.anchorMix < 0.5 ? s.anchorFrom : s.anchorTo;
      if (settled !== anchorIndex(k.anchor) || Math.min(s.anchorMix, 1 - s.anchorMix) > EPS)
        out.push(`${label}: anchor ${k.anchor} değil (mix ${s.anchorMix})`);
    }
    for (const [p, v] of exp) if (differs(s[p], v)) out.push(`${label} ${p}: ${s[p]} ≠ ${v}`);
  }
  return out;
}

/* ── #5 dwell ── */
const ANCHOR_KEYS: readonly string[] = ['anchorFrom', 'anchorTo', 'anchorMix'];
/** Etkin anchor: mix 0 → from, 1 → to (faz sınırında [a→b, 1] ile [b→c, 0] aynı durumdur, §5.9.3 #2) */
const effectiveAnchor = (s: StageTarget): string =>
  s.anchorMix <= EPS
    ? `${s.anchorFrom}`
    : s.anchorMix >= 1 - EPS
      ? `${s.anchorTo}`
      : `${s.anchorFrom}→${s.anchorTo}@${s.anchorMix}`;

function dwellViolations(b: Built): string[] {
  const out: string[] = [];
  const { layout } = b.fx;
  const constant = (label: string, y0: number, y1: number, free: readonly string[]) => {
    const ref = trackState(b, y0);
    for (let j = 1; j <= 8; j++) {
      const y = y0 + ((y1 - y0) * j) / 8;
      const s = trackState(b, y);
      const moved =
        KEYS.find(
          (k) => !free.includes(k) && !ANCHOR_KEYS.includes(k) && Math.abs(s[k] - ref[k]) > 1e-9,
        ) ?? (effectiveAnchor(s) !== effectiveAnchor(ref) ? 'anchorMix' : undefined);
      if (moved) {
        out.push(`${b.name} ${label} y=${y.toFixed(1)}: ${moved} ${ref[moved]} → ${s[moved]}`);
        return;
      }
    }
  };
  if (layout.areas) {
    // L ölçeğinde (svh): oturma + adım 0 [0, 10 + S]; adım k ≥ 1 dwell [dönüş sonu, sonraki dönüş başı]
    const { bodyY0, bodyLen, S, N } = layout.areas;
    const L = 20 + S * N;
    const at = (ofs: number) => bodyY0 + (ofs / L) * bodyLen;
    constant('areas dwell 0', at(0), at(10 + S), []);
    for (let k = 1; k < N; k++)
      constant(`areas dwell ${k}`, at(10 + S * k + 0.3 * S), at(10 + S * (k + 1)), []);
  }
  const work = phaseOf(layout, 'work', 'body');
  const journey = phaseOf(layout, 'journey', 'body');
  constant('work BODY', work.y0, work.y1, ['rotYScroll']);
  // mobilde bant görünümden çıkarken opacityTrack da değişir (§5.9.4 mobile)
  const band = b.v.layout === 'mobile' ? ['opacityTrack'] : [];
  constant('journey BODY', journey.y0, journey.y1, ['rotYScroll', ...band]);
  return out;
}

/* ── #6 saflık ── */
function rng(seed: number): () => number {
  let a = seed >>> 0; // mulberry32
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function purityViolations(b: Built, seed: number): string[] {
  const out: string[] = [];
  const rand = rng(seed);
  const max = b.fx.layout.maxScroll;
  const shared = { ...INITIAL };
  const n = Math.min(b.ctx.N, 6);
  for (const yStar of [rand() * max, (b.win.y0 + b.win.y1) / 2, max]) {
    // aşırı kaydırma (y < 0, y > maxScroll; iOS lastik bandı) dahil rastgele geçmiş
    for (let j = 0; j < 12; j++) fullState(b, (rand() * 1.1 - 0.05) * max, shared);
    fullState(b, yStar, shared);
    const direct = fullState(b, yStar);
    const diff = KEYS.find((k) => !Object.is(shared[k], direct[k]));
    if (diff)
      out.push(`${b.name} y*=${yStar.toFixed(1)}: ${diff} ${shared[diff]} ≠ ${direct[diff]}`);
    for (const p of FILL_PROPS.slice(n))
      if (direct[p] !== 0) out.push(`${b.name}: ${p} (i ≥ N) = ${direct[p]}`); // §5.9.5: i ≥ N daima 0
  }
  return out;
}

describe.each(VARIANTS)('test matrisi: %s (§5.9.3 #7)', (variant) => {
  const cases = matrix(variant).map((spec, i) => build(spec, TURN_EASES[i % TURN_EASES.length]));

  it('varyant ve içerik bağlamı ölçümden türetilir (§5.9.4 varyantlar, §5.8.1 W₀)', () => {
    expect(cases.length).toBe(368);
    expectNone(cases.flatMap(variantViolations));
  });

  it('#1 çakışmama: aynı prop için örtüşen iki track yok (K-CHOREO-1)', () => {
    expectNone(cases.flatMap(overlapViolations));
  });

  it('#2 süreklilik: from(i) = to(i−1); anchorMix kuralı; dolgu penceresi uçlarında event durumu', () => {
    expectNone(cases.flatMap(continuityViolations));
  });

  it('#3 event pencereleri: dolgu track’i work IN p 0.6 → work BODY p 1 ile kesişmez (K-CHOREO-2)', () => {
    expectNone(cases.flatMap(windowViolations));
  });

  it('#4 anahtar üretimi: K0–K5 konumlarında değerlendirme keyframes(ctx) değerlerini verir', () => {
    expectNone(cases.flatMap(keyframeViolations));
  });

  it('#5 dwell: areas dwell’lerinde hepsi sabit; work/journey BODY’de yalnız rotYScroll değişir', () => {
    expectNone(cases.flatMap(dwellViolations));
  });

  it('#6 saflık: rastgele y dizisinden sonra evaluate(y*) = doğrudan evaluate(y*)', () => {
    expectNone(cases.flatMap((b, i) => purityViolations(b, i + 1)));
  });
});

/* ───────────── §5.9.4 tablo değerleri ve §4.12.1 referans konumları ───────────── */

describe('ana sayfa tablosu: masaüstü varsayılan içerik (N = 4, P = 4, E = 6; §4.12.1)', () => {
  const b = build({ variant: 'desktop', N: 4, P: 4, E: 6 }); // proje 1 alan 0 → W₀ = wrapNear(45, −225) = −315
  const at = (s: number) => trackState(b, b.fx.px(s));
  const full = (s: number) => fullState(b, b.fx.px(s));
  const W0 = -315;

  it('geometri §4.5.2: T = 100 / 240 / 560 / 890 / 1170 svh; kaydırma 1170 svh; heroExit s = 30', () => {
    expect(b.fx.top).toEqual({
      hero: 0,
      about: 100,
      areas: 240,
      work: 560,
      journey: 890,
      contact: 1170,
    });
    expect(b.fx.layout.maxScroll).toBe(b.fx.px(1170));
    expect(b.fx.layout.heroExit).toBe(b.fx.px(30));
    expect(b.ctx.W0).toBe(W0);
  });

  it('about: s 30 rotY 12, karışım 0.45; s 100 rotY 30, cut 0.35 (K-HERO-9); s 140 cut 0, halkalar 1 (K-ABOUT-1)', () => {
    expectClose(at(30), { rotYScroll: 12, anchorMix: 0.45, cut: 1.1, camR: 5.2 });
    expectClose(at(100), { rotYScroll: 30, cut: 0.35, ringContrast: 0.6, camEl: 40 });
    expectClose(at(140), { cut: 0, ringContrast: 1, rotYScroll: 35, camEl: 55 });
  });

  it('about lede: cutProgress 0.05 / 0.25 / 0.45 / 0.65 → s ≈ 35 / 56 / 76 / 97 (cut doğrusal, §4.12.1)', () => {
    const cutProgress = (s: number) => (1.1 - at(s).cut) / 1.1;
    for (const [cp, s] of [
      [0.05, 35],
      [0.25, 56],
      [0.45, 76],
      [0.65, 97],
    ] as const)
      expect(Math.abs(cutProgress(s) - cp)).toBeLessThanOrEqual(0.01);
    expect(
      b.groups
        .get('cut')
        ?.slice(0, 2)
        .map((t) => t.ease),
    ).toEqual(['linear', 'linear']);
  });

  it('areas: dönüşler 300–315 / 350–365 / 400–415 (ψ 45 → −45 → −135 → −225; ortada 0 / −90 / −180)', () => {
    expectClose(at(240), {
      rotYScroll: 45,
      sectorMix: 1,
      fill0: 1,
      fill1: 0.15,
      camFov: 18,
      camEl: 88,
    });
    const psi = [45, -45, -135, -225];
    for (let k = 1; k <= 3; k++) {
      const s0 = 250 + 50 * k;
      const [from, to] = [psi[k - 1] as number, psi[k] as number];
      expectClose(at(s0), { rotYScroll: from, [`fill${k - 1}`]: 1, [`fill${k}`]: 0.15 });
      expectClose(at(s0 + 7.5), { rotYScroll: (from + to) / 2 });
      expectClose(at(s0 + 15), { rotYScroll: to, [`fill${k - 1}`]: 0.15, [`fill${k}`]: 1 });
      expectClose(at(s0 + 50), { rotYScroll: to });
    }
  });

  it('areas bırakma 450–460: sectorMix 1 → 0.5, dolgular → 0.15; work IN: rotX p 0.3–1, bant p 0.7–1, dolgular 0.12', () => {
    expectClose(at(450), { sectorMix: 1, fill3: 1 });
    expectClose(at(460), { sectorMix: 0.5, fill0: 0.15, fill1: 0.15, fill2: 0.15, fill3: 0.15 });
    expectClose(at(490), { rotX: 0, bandVisible: 0 });
    expectClose(at(520 - 1e-4), { fill0: 0.12, fill3: 0.12 }); // track'in sonu = pencere başı
    expectClose(full(520), { fill0: 0.12, fill1: 0.12, fill3: 0.12, fill4: 0 }); // pencere: event (work −1)
    expectClose(at(530), { bandVisible: 0 });
    expectClose(at(560), {
      rotX: 62,
      bandVisible: 1,
      rotYScroll: W0,
      camR: 5.6,
      camEl: 20,
      camFov: 26,
    });
  });

  it('work BODY W₀ → W₀+30 (doğrusal); journey +30 → +50 → +110; contact IN +110 → +130 (§4.12.1 satır 12–15)', () => {
    expectClose(at(675), { rotYScroll: W0 + 15 });
    expectClose(at(790), { rotYScroll: W0 + 30 });
    expectClose(at(840), { sectorMix: 0, fill0: 0, fill1: 0 });
    expectClose(at(890), { rotYScroll: W0 + 50, rotX: 0, camEl: 72, arcGlow: 0.2, ghost: 0.06 });
    expectClose(at(980), { rotYScroll: W0 + 80 });
    expectClose(at(1070), { rotYScroll: W0 + 110 });
    expectClose(at(1110), { bandVisible: 0 });
    expectClose(at(1120), { rotYScroll: W0 + 130, ghost: 0, rotX: 0, camFov: 30 });
  });

  it('s = 1170 K5 (K-CONTACT-3): rotX 68, arcGlow 1, ışık 70/14, cut −0.05, rim 0.35, halkalar 0.7', () => {
    expectClose(at(1170), {
      rotX: 68,
      arcGlow: 1,
      lightAz: 70,
      lightEl: 14,
      cut: -0.05,
      rim: 0.35,
      ringContrast: 0.7,
    });
  });
});

describe('§5.9.4 varyantlar: opaklık ve ton track’leri', () => {
  const val = (b: Built, prop: keyof StageTarget, c: ChapterId, ph: TrackPhase, p: number) =>
    trackState(b, yAt(b.fx.layout, c, ph, p))[prop];
  const opacityTracks = (b: Built) =>
    b.tracks.filter((t) => t.prop === 'opacityTrack').map((t) => `${t.chapter}·${t.phase}`);

  it('areas-list (masaüstü, N = 7): areas IN p 0.2–0.5 1 → 0; work IN p 0.2–0.5 0 → 1; BODY dönüşü yok', () => {
    const b = build({ variant: 'desktop', N: 7, P: 4, E: 6 });
    expect([0.2, 0.5].map((p) => val(b, 'opacityTrack', 'areas', 'in', p))).toEqual([1, 0]);
    expect([0.2, 0.5].map((p) => val(b, 'opacityTrack', 'work', 'in', p))).toEqual([0, 1]);
    expect(
      b.tracks.some((t) => t.prop === 'rotYScroll' && t.chapter === 'areas' && t.phase === 'body'),
    ).toBe(false);
    expect(b.ctx).toMatchObject({ areasMode: 'list', lastPsi: 45, W0: 45, N: 0 });
  });

  it('testimonials (masaüstü): testimonials IN 1 → 0.4; contact IN p 0–0.5 0.4 → 1 (K-JOURNEY-8)', () => {
    const b = build({ variant: 'desktop', N: 4, P: 4, E: 6, testimonials: true });
    expect(val(b, 'opacityTrack', 'testimonials', 'in', 1)).toBeCloseTo(0.4, 9);
    expect(val(b, 'opacityTrack', 'testimonials', 'body', 1)).toBeCloseTo(0.4, 9);
    expect(val(b, 'opacityTrack', 'contact', 'in', 0.5)).toBeCloseTo(1, 9);
    expect(opacityTracks(b)).toEqual(['testimonials·in', 'contact·in']);
  });

  it('mobile: work IN p 0.2–0.5 1 → 0 (K-WORK-8); journey IN p 0.3–0.6 0 → 1; bant çıkarken BODY [0.20, 0.36]·vh; contact IN p 0.3–0.6 (K-CONTACT-7)', () => {
    const b = build({ variant: 'mobile', N: 4, P: 4, E: 6, testimonials: true });
    const { layout } = b.fx;
    expect(layout.areas?.S).toBe(AREAS_STEP.mobile);
    expect([0.2, 0.5].map((p) => val(b, 'opacityTrack', 'work', 'in', p))).toEqual([1, 0]);
    expect(val(b, 'opacityTrack', 'work', 'body', 1)).toBe(0);
    expect([0.3, 0.6].map((p) => val(b, 'opacityTrack', 'journey', 'in', p))).toEqual([0, 1]);
    const body = phaseOf(layout, 'journey', 'body');
    expect(trackState(b, body.y0 + 0.2 * layout.vh).opacityTrack).toBeCloseTo(1, 9);
    expect(trackState(b, body.y0 + 0.36 * layout.vh).opacityTrack).toBeCloseTo(0, 9);
    expect(val(b, 'opacityTrack', 'testimonials', 'in', 0.5)).toBe(0); // mobilde testimonials track'i yok
    expect([0.3, 0.6].map((p) => val(b, 'opacityTrack', 'contact', 'in', p))).toEqual([0, 1]);
    expect(opacityTracks(b)).toEqual([
      'about·in',
      'about·in',
      'areas·in',
      'areas·in',
      'work·in',
      'journey·in',
      'journey·body',
      'contact·in',
    ]);
  });

  it('mobile el değiştirme (§4.15.1, SPEC-SAPMA §4.15.3): bant söner, görünmezken çapa değişir, yeni bantta belirir', () => {
    const b = build({ variant: 'mobile', N: 4, P: 4, E: 6 });
    const op = (c: ChapterId, p: number) => val(b, 'opacityTrack', c, 'in', p);
    /** etkin çapa: (A→B, 1) ≡ (B→C, 0) (§5.9.3 #2) */
    const anchorAt = (c: ChapterId, p: number) => {
      const st = trackState(b, yAt(b.fx.layout, c, 'in', p));
      return st.anchorMix < 0.5 ? st.anchorFrom : st.anchorTo;
    };
    // hero → about: söner p 0.10–0.25, çapa p 0.25–0.26'da değişir, belirir p 0.26–0.42
    expect([0.1, 0.25, 0.26, 0.42].map((p) => op('about', p))).toEqual([1, 0, 0, 1]);
    expect([0.24, 0.27].map((p) => anchorAt('about', p))).toEqual([
      anchorIndex('hero-rest'),
      anchorIndex('about-cut'),
    ]);
    // about → kadran bandı: söner p 0–0.15, değişir 0.15–0.16, belirir 0.45–0.60
    expect([0, 0.15, 0.45, 0.6].map((p) => op('areas', p))).toEqual([1, 0, 0, 1]);
    expect([0.14, 0.17].map((p) => anchorAt('areas', p))).toEqual([
      anchorIndex('about-cut'),
      anchorIndex('areas-dial'),
    ]);
    // journey → contact: çapa değişimi opaklık 0'ken (p < 0.3) biter
    expect(anchorAt('contact', 0.3)).toBe(anchorIndex('contact-ring'));
    expect(op('contact', 0.3)).toBe(0);
  });

  it('mobile-list: areas IN p 0.2–0.5 1 → 0; work IN opaklık track’i yok (zaten 0)', () => {
    const b = build({ variant: 'mobile-list', N: 4, P: 4, E: 6 });
    expect([0.2, 0.5].map((p) => val(b, 'opacityTrack', 'areas', 'in', p))).toEqual([1, 0]);
    expect(val(b, 'opacityTrack', 'work', 'in', 0.5)).toBe(0);
    expect(opacityTracks(b)).toEqual([
      'about·in',
      'about·in',
      'areas·in',
      'journey·in',
      'journey·body',
      'contact·in',
    ]);
    expect(b.ctx).toMatchObject({ areasMode: 'list', lastPsi: 45, N: 4, W0: 45 });
  });

  it('landscape: yalnız about IN p 0.2–0.5 1 → 0; sonra hep 0', () => {
    const b = build({ variant: 'landscape', N: 4, P: 4, E: 6, testimonials: true });
    expect([0.2, 0.5].map((p) => val(b, 'opacityTrack', 'about', 'in', p))).toEqual([1, 0]);
    expect(trackState(b, b.fx.layout.maxScroll).opacityTrack).toBe(0);
    expect(opacityTracks(b)).toEqual(['about·in']);
  });

  it('shortViewport (1440×700): tone work IN p 0–0.5 1 → 0, BODY’de 0 (K-WORK-7); journey IN p 0–0.5 0 → 1', () => {
    const b = build({ variant: 'desktop', N: 4, P: 4, E: 6, short: true });
    expect(b.fx.layout.vh).toBeLessThan(SHORT_VIEWPORT_VH);
    expect([0, 0.5].map((p) => val(b, 'tone', 'work', 'in', p))).toEqual([1, 0]);
    expect(val(b, 'tone', 'work', 'body', 0.5)).toBe(0);
    expect([0, 0.5].map((p) => val(b, 'tone', 'journey', 'in', p))).toEqual([0, 1]);
    expect(
      build({ variant: 'desktop', N: 4, P: 4, E: 6 }).tracks.some((t) => t.prop === 'tone'),
    ).toBe(false);
  });

  it('mobil journey BODY kısaysa bant track’i 1’e kırpılır; journey fazı yoksa track [0, 1] olur ve düşer', () => {
    const short = build({ variant: 'mobile', N: 4, P: 4, E: 1 }); // BODY 20 svh = 0.2·vh
    const band = short.tracks.find(
      (t) => t.prop === 'opacityTrack' && t.chapter === 'journey' && t.phase === 'body',
    );
    expect(band).toMatchObject({ end: 1, from: 1, to: 0 });
    expect(band?.start).toBeCloseTo(1, 5);
    const fx = buildFixture({ variant: 'mobile', N: 4, P: 4, E: 6 });
    const layout: Layout = {
      ...fx.layout,
      phases: fx.layout.phases.filter((p) => p.chapter !== 'journey'),
    };
    const tracks = buildTracks('home', stageCtx(fx.data, layout), layout, variantOf(layout));
    expect(tracks.find((t) => t.prop === 'opacityTrack' && t.phase === 'body')).toMatchObject({
      start: 0,
      end: 1,
    });
    const groups = resolveTracks(tracks, layout);
    expect([...groups.values()].flat().some((t) => t.chapter === 'journey')).toBe(false);
  });

  it('K-CONTACT-3 kırpma: contact < 100 svh iken K5’e maxScroll’da ulaşılır (§5.9.3 ZORUNLU)', () => {
    const b = build({ variant: 'desktop', N: 4, P: 4, E: 6, contactH: 60 });
    const { layout } = b.fx;
    expect(phaseOf(layout, 'contact', 'in').y1).toBe(layout.maxScroll);
    expectClose(trackState(b, layout.maxScroll), { rotX: 68, arcGlow: 1, rim: 0.35, cut: -0.05 });
  });
});

/* ───────────── K-CHOREO-3 (§4.12.2 #6) ───────────── */

describe('K-CHOREO-3: rotY/rotX track hızı ≤ 90°/100 svh; yalnız beyaz liste (a)–(c) aşar', () => {
  /** ortalama hız, °/100 svh (beyaz liste de ortalamayla verilir: 90°/15 svh, 68°/50 svh) */
  const rate = (b: Built, t: ResolvedTrack) =>
    (Math.abs(t.to - t.from) / ((t.y1 - t.y0) / b.fx.px(1))) * 100;
  const whitelist = (t: ResolvedTrack): 'a' | 'b' | 'c' | null =>
    t.prop === 'rotYScroll' && t.chapter === 'areas' && t.phase === 'body'
      ? 'a' // areas adım dönüşleri: Δ / 15 svh
      : t.prop === 'rotYScroll' && t.chapter === 'work' && t.phase === 'in'
        ? 'b' // W₀ kısa yol yeniden yönlenmesi ≤ 180°/100 svh
        : t.prop === 'rotX' && t.chapter === 'contact'
          ? 'c' // contact IN rotX 0 → 68, 50 svh
          : null;
  const rows = (b: Built) =>
    (['rotYScroll', 'rotX'] as const)
      .flatMap((p) => b.groups.get(p) ?? [])
      .map((t) => ({
        id: `${t.prop} ${t.chapter}·${t.phase} [${t.start}]`,
        r: rate(b, t),
        wl: whitelist(t),
      }));

  it('varsayılan geometri (1440×900, N = 4, P = 4, E = 6)', () => {
    const r = rows(build({ variant: 'desktop', N: 4, P: 4, E: 6 }));
    expect(r.filter((x) => x.wl === null && x.r > 90 + EPS)).toEqual([]);
    const a = r.filter((x) => x.wl === 'a');
    expect(a).toHaveLength(3);
    for (const x of a) expect(x.r).toBeCloseTo((90 / 15) * 100, 6);
    expect(r.find((x) => x.wl === 'b')?.r).toBeLessThanOrEqual(180);
    expect(r.find((x) => x.wl === 'c')?.r).toBeCloseTo((68 / 50) * 100, 6);
    // work IN rotX 62°/70 svh ≈ 88.6 ve journey BODY 60°/180 svh ≈ 33.3 tavanın altında kalır
    expect(r.find((x) => x.id.startsWith('rotX work'))?.r).toBeCloseTo((62 / 70) * 100, 6);
  });

  it('(b) W₀ seçimi: her N ve proje 1 alanı (pin ve liste) için ≤ 180°/100 svh; diğerleri ≤ 90', () => {
    const bad: string[] = [];
    for (const variant of ['desktop', 'mobile-list'] as const)
      for (let N = 3; N <= 6; N++)
        for (let a1 = 0; a1 < N; a1++) {
          const b = build({ variant, N, P: 4, E: 6, areas: [a1] });
          for (const x of rows(b)) {
            const cap =
              x.wl === 'a'
                ? (360 / N / (0.3 * AREAS_STEP.desktop)) * 100
                : x.wl === 'b'
                  ? 180
                  : x.wl === 'c'
                    ? 136
                    : 90;
            if (x.r > cap + EPS)
              bad.push(`${b.name} ${x.id}: ${x.r.toFixed(2)} > ${cap.toFixed(2)}`);
          }
        }
    expectNone(bad);
  });
});

describe('§5.9.3 #5 hız: varsayılan içerikte work/journey BODY dönüşü ≤ 33.4°/100 svh', () => {
  it('work 30°/230 svh ≈ 13°, journey 60°/180 svh ≈ 33.3°', () => {
    const b = build({ variant: 'desktop', N: 4, P: 4, E: 6 });
    const speeds = (['work', 'journey'] as const).map((c) => {
      const r = phaseOf(b.fx.layout, c, 'body');
      let max = 0;
      for (let j = 0; j < 40; j++) {
        const y0 = r.y0 + ((r.y1 - r.y0) * j) / 40;
        const y1 = r.y0 + ((r.y1 - r.y0) * (j + 1)) / 40;
        const d = Math.abs(trackState(b, y1).rotYScroll - trackState(b, y0).rotYScroll);
        max = Math.max(max, (d / ((y1 - y0) / b.fx.px(1))) * 100);
      }
      return max;
    });
    expect(speeds[0]).toBeCloseTo((30 / 230) * 100, 6);
    expect(speeds[1]).toBeCloseTo((60 / 180) * 100, 6);
    for (const s of speeds) expect(s).toBeLessThanOrEqual(33.4);
  });

  it('küçük E (M4 notu, SPEC-SAPMA §4.12.2): journey dönüşü BODY’ye ölçeklenir, hız ≤ 33.4°/100 svh; contact +20° sürer', () => {
    for (const variant of ['desktop', 'mobile'] as const) {
      for (let E = 1; E <= 6; E++) {
        const b = build({ variant, N: 4, P: 4, E });
        const r = phaseOf(b.fx.layout, 'journey', 'body');
        const svh = (r.y1 - r.y0) / b.fx.px(1);
        const start = trackState(b, r.y0).rotYScroll;
        const end = trackState(b, r.y1).rotYScroll;
        expect(end - start, `${variant} E=${E}`).toBeCloseTo(Math.min(60, (33.4 * svh) / 100), 6);
        if (svh > 0)
          expect(((end - start) / svh) * 100, `${variant} E=${E}`).toBeLessThanOrEqual(33.4 + 1e-9);
        const c = phaseOf(b.fx.layout, 'contact', 'in');
        expect(trackState(b, c.y0).rotYScroll, `${variant} E=${E} süreklilik`).toBeCloseTo(end, 6);
        expect(trackState(b, c.y0 + 0.5 * (c.y1 - c.y0)).rotYScroll).toBeCloseTo(end + 20, 6);
      }
    }
  });

  it('K-AREAS-5: s 250–300, 315–350, 365–400, 415–450 dwell’lerinde rotY sabit', () => {
    const b = build({ variant: 'desktop', N: 4, P: 4, E: 6 });
    for (const [s0, s1] of [
      [250, 300],
      [315, 350],
      [365, 400],
      [415, 450],
    ] as const) {
      const ref = trackState(b, b.fx.px(s0)).rotYScroll;
      for (let s = s0; s <= s1; s += 2.5) expect(trackState(b, b.fx.px(s)).rotYScroll).toBe(ref);
    }
  });
});

/* ───────────── K-GEN-3 ───────────── */

describe('K-GEN-3: tracks.ts, stageTarget alanları dışında yazmaz', () => {
  it('applyBase / evaluateTracks yalnız track alanlarına ve anchorFrom/To’ya yazar; yeni anahtar yok', () => {
    for (const variant of VARIANTS) {
      const b = build({ variant, N: 4, P: 4, E: 6, testimonials: true, short: true });
      const written = new Set<string>();
      const out = new Proxy(
        { ...INITIAL },
        {
          set: (o, k, v) => {
            written.add(String(k));
            return Reflect.set(o, k, v);
          },
        },
      );
      for (let j = 0; j <= 120; j++) trackState(b, (j / 120) * b.fx.layout.maxScroll, out);
      applyBase(out, null, anchorIndex);
      expect([...written].sort()).toEqual([...TRACK_PROPS, 'anchorFrom', 'anchorTo'].sort());
      expect(Object.keys(out)).toEqual(KEYS);
    }
  });

  it('kaynakta DOM yazımı yok (§4.3 beyaz listesi director ve bileşenlerdedir)', () => {
    const src = readFileSync(join(process.cwd(), 'src/stage/tracks.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    for (const re of [
      /\.style\b/,
      /setProperty\s*\(/,
      /classList/,
      /(?:set|remove|toggle)Attribute\s*\(/,
      /(?:inner|outer)HTML/,
      /textContent\s*=/,
      /\.dataset\.[\w$]+\s*=(?!=)/,
      /\b(?:append|prepend|appendChild|insertBefore|removeChild|replaceChildren|replaceWith)\s*\(/,
      /\bscroll(?:To|By|IntoView)\s*\(/,
    ])
      expect(src, String(re)).not.toMatch(re);
  });
});

/* ───────────── measureLayout (jsdom) ───────────── */

describe('measureLayout (jsdom): fazlar, "top 55%" çizgileri, areas pini (§5.9.3)', () => {
  const mount = mountFixture;

  it.each<[string, FixtureSpec]>([
    ['masaüstü pin (S = 50)', { variant: 'desktop', N: 4, P: 4, E: 6 }],
    [
      'masaüstü liste (N = 7) + testimonials, 1440×700',
      { variant: 'desktop', N: 7, P: 5, E: 3, testimonials: true, short: true },
    ],
    ['mobil pin (S = 40)', { variant: 'mobile', N: 5, P: 3, E: 6 }],
    ['mobil liste', { variant: 'mobile-list', N: 4, P: 4, E: 2 }],
    ['yatay telefon', { variant: 'landscape', N: 3, P: 3, E: 6, testimonials: true }],
    ['contact < 100 svh (kırpma)', { variant: 'desktop', N: 6, P: 3, E: 1, contactH: 60 }],
  ])('%s: ölçüm fixture Layout’unu verir ve DOM’a yazmaz', (_, spec) => {
    const fx = buildFixture(spec);
    const root = mount(fx);
    const html = root.outerHTML;
    expect(measureLayout(root, 'home')).toEqual(fx.layout);
    expect(root.outerHTML).toBe(html);
  });

  it('belge üstü = getBoundingClientRect().top + scrollY', () => {
    const fx = buildFixture({ variant: 'desktop', N: 4, P: 4, E: 6 });
    expect(measureLayout(mount(fx, { scrollY: 3600 }), 'home')).toEqual(fx.layout);
  });

  it('pin koşulu: sticky değilse, N ∉ 3–6 ise ya da data-areas-n yoksa areas null (liste modu)', () => {
    const fx = buildFixture({ variant: 'desktop', N: 4, P: 4, E: 6 });
    expect(measureLayout(mount(fx, { sticky: false }), 'home').areas).toBeNull();
    expect(measureLayout(mount(fx, { n: 7 }), 'home').areas).toBeNull();
    expect(measureLayout(mount(fx, { n: 2 }), 'home').areas).toBeNull();
    expect(measureLayout(mount(fx, { n: null }), 'home').areas).toBeNull();
    expect(measureLayout(mount(fx), 'home').areas).toEqual({
      bodyY0: fx.px(240),
      bodyLen: fx.px(220),
      S: 50,
      N: 4,
    });
  });

  it('home dışı preset: faz, çizgi ve pin ölçülmez (derin preset’ler M7); about yoksa heroExit 0', () => {
    const fx = buildFixture({ variant: 'mobile', N: 4, P: 4, E: 6 });
    const root = mount(fx);
    expect(measureLayout(root, 'folio')).toEqual({
      vh: fx.layout.vh,
      maxScroll: fx.layout.maxScroll,
      mobile: true,
      phases: [],
      anchors: [],
      activation: { work: [], journey: [], cv: [] },
      areas: null,
      heroExit: 0,
    });
    root
      .querySelectorAll('[data-chapter="about"], [data-chapter="areas"]')
      .forEach((el) => el.remove());
    const m = measureLayout(root, 'home');
    expect(m.heroExit).toBe(0);
    expect(m.areas).toBeNull();
    expect(m.phases.map((p) => p.order)).toEqual([2, 3, 4, 5, 6, 7]); // DOM indeksi·2 (+1)
  });
});

/* ───────────── yardımcılar ───────────── */

describe('yardımcılar (§5.9.3–§5.9.4, §5.9.10)', () => {
  it('EASE: uçlar 0 → 1, orta nokta 0.5; power2/power3 ve sine eğrileri', () => {
    for (const f of Object.values(EASE)) {
      expect(f(0)).toBeCloseTo(0, 12);
      expect(f(1)).toBe(1);
      expect(f(0.5)).toBeCloseTo(0.5, 12);
    }
    expect([EASE.linear(0.25), EASE.smooth(0.25), EASE.inOut(0.25), EASE.inOut(0.75)]).toEqual([
      0.25, 0.15625, 0.125, 0.875,
    ]);
    expect([EASE.power3InOut(0.25), EASE.power3InOut(0.75)]).toEqual([0.0625, 0.9375]);
    expect(EASE.sineInOut(0.25)).toBeCloseTo((1 - Math.SQRT1_2) / 2, 12);
  });

  it('areasTurnEase: calm → sineInOut, standard → smooth, expressive → power3InOut (§5.6.7)', () => {
    const map: Record<Intensity, Ease> = {
      calm: 'sineInOut',
      standard: 'smooth',
      expressive: 'power3InOut',
    };
    for (const [i, e] of Object.entries(map)) expect(areasTurnEase(i as Intensity)).toBe(e);
    expect(areasTurnEase()).toBe('smooth');
  });

  it('buildTracks: yalnız home (derin preset’ler M7); dönüş easing’i yalnız areas rotYScroll dönüşlerinde', () => {
    const fx = buildFixture({ variant: 'desktop', N: 4, P: 4, E: 6 });
    const ctx = stageCtx(fx.data, fx.layout);
    const v = variantOf(fx.layout);
    for (const p of [
      'folio',
      'plan-small',
      'cv-core',
      'about-page',
      'contact-page',
      'none',
    ] as PresetName[])
      expect(buildTracks(p, ctx, fx.layout, v)).toEqual([]);
    const tracks = buildTracks('home', ctx, fx.layout, v, 'power3InOut');
    expect(
      tracks
        .filter((t) => t.ease === 'power3InOut')
        .map((t) => `${t.prop} ${t.chapter}·${t.phase}`),
    ).toEqual(Array(3).fill('rotYScroll areas·body'));
    expect(new Set(tracks.map((t) => t.ease))).toEqual(
      new Set(['smooth', 'linear', 'power3InOut']),
    );
  });

  it('lastProjectPattern (§5.9.4 pattern(P)): alanında 0.6, diğer i < N 0.12, i ≥ N 0; alanı yoksa 0.12', () => {
    expect(lastProjectPattern(contentCtx(4, [0, 1, 3]))).toEqual([0.12, 0.12, 0.12, 0.6, 0, 0]);
    expect(lastProjectPattern(contentCtx(5, [2, null]))).toEqual([0.12, 0.12, 0.12, 0.12, 0.12, 0]);
    expect(lastProjectPattern(contentCtx(3, []))).toEqual([0.12, 0.12, 0.12, 0, 0, 0]);
    expect(lastProjectPattern(contentCtx(0, [null]))).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('stageCtx: pin yoksa liste bağlamı (lastPsi 45, W₀ 45’e göre sarılır); layout null ya da pin varsa içerik bağlamı', () => {
    const fx = buildFixture({ variant: 'mobile-list', N: 4, P: 4, E: 6, areas: [2] });
    const base = contentCtx(4, [2, null, null, null]);
    expect(stageCtx(fx.data, null)).toEqual(base);
    // ψ(2) = −135, 45'ten tam 180° uzak: wrapNear +360 seçer (Math.round(0.5) = 1) → 225
    expect(stageCtx(fx.data, fx.layout)).toEqual({
      ...base,
      areasMode: 'list',
      lastPsi: 45,
      W0: 225,
      journeyTurn: journeyTurnOf(fx.layout),
    });
    const pinned = buildFixture({ variant: 'mobile', N: 4, P: 4, E: 6, areas: [2] });
    // W₀ = wrapNear(−135, −225); journey dönüşü ölçülen BODY'ye göre
    expect(stageCtx(pinned.data, pinned.layout)).toEqual({
      ...base,
      journeyTurn: journeyTurnOf(pinned.layout),
    });
    const noArea = buildFixture({ variant: 'mobile-list', N: 4, P: 4, E: 6, areas: [null] });
    expect(stageCtx(noArea.data, noArea.layout).W0).toBe(45);
  });

  it('variantOf: yatay < 500 px (mobil), kısa masaüstü < 760 px', () => {
    const fx = buildFixture({ variant: 'desktop', N: 4, P: 4, E: 6 });
    const at = (vh: number, mobile: boolean) => variantOf({ ...fx.layout, vh, mobile });
    expect(at(SHORT_VIEWPORT_VH - 1, false)).toMatchObject({
      layout: 'desktop',
      shortViewport: true,
    });
    expect(at(SHORT_VIEWPORT_VH, false).shortViewport).toBe(false);
    expect(at(499, true)).toMatchObject({ layout: 'landscape', shortViewport: false });
    expect(at(500, true)).toMatchObject({
      layout: 'mobile',
      areasList: false,
      testimonials: false,
    });
  });

  it('resolveTracks: fazı olmayan bölümün track’i düşer; eşit o0’da y0, sonra ekleme sırası', () => {
    const fx = buildFixture({ variant: 'desktop', N: 4, P: 4, E: 6 });
    const t = (chapter: ChapterId, start: number, end: number): Track => ({
      prop: 'camR',
      chapter,
      phase: 'in',
      start,
      end,
      from: start,
      to: end,
      ease: 'linear',
    });
    const g = resolveTracks(
      [t('testimonials', 0, 1), t('about', 0.5, 1), t('about', 0.5, 0.7)],
      fx.layout,
    );
    expect(g.get('camR')?.map((r) => [r.chapter, r.o0, r.o1, r.y0, r.y1])).toEqual([
      ['about', 2.5, 3, fx.px(50), fx.px(100)],
      ['about', 2.5, 2.7, fx.px(50), fx.px(70)],
    ]);
  });

  it('evaluateTracks: ilk track öncesi ilk from, aralarda son to; sahipli alan ve boş liste atlanır', () => {
    const fx = buildFixture({ variant: 'desktop', N: 4, P: 4, E: 6 });
    const t = (start: number, end: number, from: number, to: number): Track => ({
      prop: 'ghost',
      chapter: 'about',
      phase: 'in',
      start,
      end,
      from,
      to,
      ease: 'linear',
    });
    const groups = resolveTracks([t(0.2, 0.4, 1, 2), t(0.6, 0.8, 2, 3)], fx.layout);
    groups.set('camR', []);
    groups.set('anchorMix', [
      { ...t(0, 1, 0, 1), prop: 'anchorMix', y0: 0, y1: 900, o0: 2, o1: 3 },
    ]);
    const run = (y: number, owned = false) => {
      const out = { ...INITIAL, anchorFrom: 7, anchorTo: 7 };
      evaluateTracks(groups, fx.px(y), out, anchorIndex, (p) => owned && p === 'ghost');
      return out;
    };
    expect([0, 30, 50, 70, 100].map((s) => run(s).ghost)).toEqual([1, 1.5, 2, 2.5, 3]);
    expect(run(30, true).ghost).toBe(INITIAL.ghost);
    expect(run(30).camR).toBe(INITIAL.camR);
    expect(run(50)).toMatchObject({ anchorMix: 0.5, anchorFrom: 7, anchorTo: 7 }); // anchors'suz karışım
  });

  it('applyBase: taban yoksa yalnız opacityTrack 0; K1a blend → anchor −1; fillsOwned dolguları korur', () => {
    const kf = keyframes(contentCtx(4, [0]));
    const out = { ...INITIAL, fill0: 0.5, camR: 9 };
    applyBase(out, null, anchorIndex);
    expect(out).toEqual({ ...INITIAL, fill0: 0.5, camR: 9, opacityTrack: 0 });
    applyBase(out, kf['about-lift'], anchorIndex, true);
    expect(out).toMatchObject({
      anchorFrom: -1,
      anchorTo: -1,
      anchorMix: 0,
      fill0: 0.5,
      camR: 5.2,
      rotYScroll: 12,
      opacityTrack: 1,
    });
    applyBase(out, kf['areas-plan'], anchorIndex);
    expect(out).toMatchObject({
      anchorFrom: 2,
      anchorTo: 2,
      fill0: 1,
      fill1: 0.15,
      fill5: 0.15,
      camFov: 18,
    });
  });

  it('presetDef: home = K0 + 6 home anchor’ı + areas/work/journey; kayıtta olmayan preset none gibi (§5.9.10)', () => {
    expect(presetDef('home')).toEqual({
      base: 'hero',
      anchors: [
        'hero-rest',
        'about-cut',
        'areas-dial',
        'work-specimen',
        'journey-core',
        'contact-ring',
      ],
      events: ['areas', 'work', 'journey'],
    });
    expect(presetDef('none')).toEqual({ base: null, anchors: [], events: [] });
    for (const p of [
      'folio',
      'plan-small',
      'cv-core',
      'about-page',
      'contact-page',
    ] as PresetName[])
      expect(presetDef(p)).toBe(PRESETS.none);
  });
});
