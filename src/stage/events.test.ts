// src/stage/events.test.ts — §5.9.5: event indeksleri (§4.12.1 DOM olay takvimi), sahiplik penceresi, resolveEvents,
// olay yayıcı ve applyEvents (sahte gsap runtime'ı). Ayrıca store.ts (§5.9.1–§5.9.2). Layout'lar layout.fixture.ts'ten.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { MotionRuntime } from '@/lib/gsap';
import { NO_BAND, psiDeg } from '@/lib/section-geometry';
import {
  applyEvents,
  areasIndexAt,
  areasStepAt,
  computeIndices,
  createEventTargets,
  emit,
  eventOwned,
  lastStageEvent,
  notifyStageUpdate,
  onStageEvent,
  onStageUpdate,
  resetEventState,
  resolveEvents,
  type EventIndices,
  type StageEvent,
} from './events';
import { contentCtx, keyframes } from './keyframes';
import { buildFixture } from './layout.fixture';
import {
  currentSceneOpacity,
  directorApi,
  live,
  nav,
  stageStore,
  stageTarget,
  useStage,
  type PresetName,
  type StageData,
} from './store';
import { TRACK_PROPS, stageCtx, type Layout } from './tracks';

const INITIAL_TARGET = { ...stageTarget };
afterEach(() => {
  Object.assign(stageTarget, INITIAL_TARGET);
});

/* Masaüstü varsayılan içerik (1440×900, N = 4, P = 4, E = 6): §4.5.2 / §4.12.1 referans geometrisi */
const fx = buildFixture({ variant: 'desktop', N: 4, P: 4, E: 6 });
const { layout } = fx;
const y = fx.px; // svh → belge px
const ix = (s: number): EventIndices => computeIndices(layout, y(s));
const ctx = stageCtx(fx.data, layout); // projeler alan 0–3, W₀ = −315
const IX = (o: Partial<EventIndices> = {}): EventIndices => ({
  areas: 0,
  work: -1,
  journey: -1,
  cv: -1,
  fillWindow: false,
  ...o,
});

/* ───────────── indeksler ───────────── */

describe('indeksler (§5.9.5; §4.12.1 DOM olay takvimi)', () => {
  it('areasStepAt: ofs ≥ 10 + S·k + 0.15·S sağlayan en büyük k ≥ 1 (değişim dönüşün ortasında)', () => {
    // S = 50, N = 4 → 67.5 / 117.5 / 167.5 (L = 220)
    expect(
      [0, 67.49, 67.5, 117.49, 117.5, 167.49, 167.5, 220].map((o) => areasStepAt(o, 50, 4)),
    ).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    // mobil S = 40 → adım başından 6 svh sonra (§4.8.8)
    expect([55.99, 56, 95.99, 96, 135.99, 136].map((o) => areasStepAt(o, 40, 4))).toEqual([
      0, 1, 1, 2, 2, 3,
    ]);
  });

  it('areas: açıklama değişimleri 307.5 / 357.5 / 407.5 svh (K-AREAS-3); BODY öncesi 0, sonrası N − 1', () => {
    expect([0, 239, 240, 307.5 - 1e-6].map((s) => ix(s).areas)).toEqual([0, 0, 0, 0]);
    for (const [k, s] of [
      [1, 307.5],
      [2, 357.5],
      [3, 407.5],
    ] as const) {
      expect(ix(s - 1e-6).areas).toBe(k - 1);
      expect(ix(s + 1e-6).areas).toBe(k);
    }
    expect(ix(460).areas).toBe(3);
    expect(computeIndices(layout, layout.maxScroll).areas).toBe(3);
  });

  it('areas mobil pin (S = 40): değişim sA(k) + 6 svh (§4.8.8); pin yoksa 0; BODY sıfır uzunlukta son adım', () => {
    const m = buildFixture({ variant: 'mobile', N: 4, P: 4, E: 6 });
    const T = m.top.areas ?? Number.NaN;
    for (let k = 1; k <= 3; k++) {
      const s = T + 10 + 40 * k + 6;
      expect(computeIndices(m.layout, m.px(s - 1e-6)).areas).toBe(k - 1);
      expect(computeIndices(m.layout, m.px(s + 1e-6)).areas).toBe(k);
    }
    expect(areasIndexAt(null, 1e6)).toBe(0);
    expect(areasIndexAt({ bodyY0: 100, bodyLen: 0, S: 50, N: 4 }, 100)).toBe(3);
  });

  it('aktivasyon çizgileri "top 55%" = üst − 0.55·vh: work 535…745, journey 875…1050 svh', () => {
    const svh = (lines: readonly number[]) => lines.map((l) => Math.round((l / y(1)) * 1e6) / 1e6);
    expect(svh(layout.activation.work)).toEqual([535, 605, 675, 745]);
    expect(svh(layout.activation.journey)).toEqual([875, 910, 945, 980, 1015, 1050]);
  });

  it('work: −1 → 0 (535, proje 1 work IN p 0.75’te) → … → 3 (745); son projeden sonra P − 1 kalır (K-WORK-2)', () => {
    expect(ix(534).work).toBe(-1);
    layout.activation.work.forEach((line, k) => {
      expect(computeIndices(layout, line - 1e-6).work).toBe(k - 1);
      expect(computeIndices(layout, line).work).toBe(k);
    });
    expect(ix(535).work).toBe(0);
    const workIn = layout.phases.find((p) => p.chapter === 'work' && p.phase === 'in');
    const first = layout.activation.work[0] ?? Number.NaN;
    expect((first - (workIn?.y0 ?? 0)) / layout.vh).toBeCloseTo(0.75, 9); // proje 1: work IN p 0.75
    expect([ix(1000).work, computeIndices(layout, layout.maxScroll).work]).toEqual([3, 3]);
  });

  it('journey: 875 / 910 / 945 / 980 / 1015 / 1050 (K-JOURNEY-2); cv çizgisi yoksa −1', () => {
    expect(ix(874).journey).toBe(-1);
    layout.activation.journey.forEach((line, k) => {
      expect(computeIndices(layout, line - 1e-6).journey).toBe(k - 1);
      expect(computeIndices(layout, line).journey).toBe(k);
    });
    expect(ix(1170)).toMatchObject({ journey: 5, cv: -1 });
    const cv: Layout = { ...layout, activation: { ...layout.activation, cv: [y(100), y(200)] } };
    expect([50, 100, 150, 250].map((s) => computeIndices(cv, y(s)).cv)).toEqual([-1, 0, 0, 1]);
  });

  it('computeIndices saf ve verilen nesneyi yeniden kullanır (kaydırma döngüsünde bellek ayırma yok)', () => {
    const o = computeIndices(layout, y(600));
    expect(o).toEqual({ areas: 3, work: 0, journey: -1, cv: -1, fillWindow: true });
    expect(computeIndices(layout, y(0), o)).toBe(o);
    expect(o).toEqual({ areas: 0, work: -1, journey: -1, cv: -1, fillWindow: false });
    expect(computeIndices(layout, y(600))).toEqual(ix(600));
  });
});

/* ───────────── sahiplik ───────────── */

describe('sahiplik penceresi (§5.9.5 tablo)', () => {
  it('dolgular work IN p 0.6 → work BODY p 1 (520 → 790 svh) boyunca event’lerindir; uçlar dahil', () => {
    expect(eventOwned(layout, 'fill0', y(520) - 1e-6)).toBe(false);
    expect(eventOwned(layout, 'fill0', y(520))).toBe(true);
    expect(eventOwned(layout, 'fill5', y(790))).toBe(true);
    expect(eventOwned(layout, 'fill3', y(790) + 1e-6)).toBe(false);
    expect([500, 600, 800].map((s) => ix(s).fillWindow)).toEqual([false, true, false]);
  });

  it('dolgu dışındaki track alanları hiçbir konumda event’lerin değildir', () => {
    for (const p of TRACK_PROPS.filter((q) => !q.startsWith('fill')))
      for (const s of [0, 520, 600, 790]) expect(eventOwned(layout, p, y(s)), p).toBe(false);
  });

  it('work bölümü yoksa pencere yoktur', () => {
    const noWork: Layout = { ...layout, phases: layout.phases.filter((p) => p.chapter !== 'work') };
    expect(eventOwned(noWork, 'fill0', y(600))).toBe(false);
    expect(computeIndices(noWork, y(600)).fillWindow).toBe(false);
  });
});

/* ───────────── hedef çözümleyici ───────────── */

describe('resolveEvents (§5.9.5 hedef çözümleyici)', () => {
  const run = (i: EventIndices, d: StageData = fx.data, c = ctx, preset: PresetName = 'home') =>
    resolveEvents(preset, i, d, c, createEventTargets());

  it('bant önceliği: journey ≥ 0 → girdi; work ≥ 0 → proje; değilse proje 1', () => {
    expect(run(IX())).toMatchObject({ bandStart: 0, bandEnd: 2 });
    expect(run(IX({ work: 2 }))).toMatchObject({ bandStart: 2, bandEnd: 4 });
    expect(run(IX({ work: 3, journey: 1 }))).toMatchObject({ bandStart: 9, bandEnd: 10 });
  });

  it('null bant (yılsız proje) ve olmayan kayıt → NO_BAND (−10, −10)', () => {
    const noYears: StageData = {
      ...fx.data,
      projects: fx.data.projects.map((p, k) => (k === 1 ? { ...p, band: null } : p)),
    };
    const none = { bandStart: NO_BAND[0], bandEnd: NO_BAND[1] };
    expect(run(IX({ work: 1 }), noYears)).toMatchObject(none);
    expect(run(IX({ work: 3, journey: 9 }))).toMatchObject(none);
    expect(run(IX(), { ...fx.data, projects: [] })).toMatchObject(none);
  });

  it('rotYEvent = wrap180(ψ(alan) − W₀): proje 1 için 0; etkin dilim saat 9 yönünde (K-WORK-6)', () => {
    const r = [0, 1, 2, 3].map((k) => run(IX({ work: k })).rotYEvent);
    expect(r).toEqual([0, -90, -180, 90]);
    fx.data.projects.forEach((p, k) => {
      const facing = ctx.W0 + (r[k] ?? Number.NaN) - psiDeg(p.area ?? Number.NaN, ctx.N);
      expect(Math.abs(facing % 360)).toBeCloseTo(0, 9);
    });
    expect(run(IX()).rotYEvent).toBe(0); // work −1
    const noArea: StageData = {
      ...fx.data,
      projects: fx.data.projects.map((p, k) => (k === 2 ? { ...p, area: null } : p)),
    };
    expect(run(IX({ work: 2 }), noArea).rotYEvent).toBe(0);
  });

  it('proje 1 için rotYEvent her N, alan ve pin/liste bağlamında 0 (W₀ = wrapNear(ψ(alan₁), lastPsi))', () => {
    for (const variant of ['desktop', 'mobile-list'] as const)
      for (let N = 3; N <= 6; N++)
        for (let a = 0; a < N; a++) {
          const f = buildFixture({ variant, N, P: 3, E: 2, areas: [a, (a + 1) % N] });
          const c = stageCtx(f.data, f.layout);
          expect(run(IX({ work: 0 }), f.data, c).rotYEvent).toBe(0);
          expect(Math.abs(run(IX({ work: 1 }), f.data, c).rotYEvent)).toBeLessThanOrEqual(180);
        }
  });

  it('dolgular yalnız pencerede: work −1 → i < N 0.12; proje k → alanında 0.6; i ≥ N daima 0', () => {
    expect(run(IX({ work: 2 })).fillsActive).toBe(false);
    expect(run(IX({ fillWindow: true }))).toMatchObject({
      fillsActive: true,
      fills: [0.12, 0.12, 0.12, 0.12, 0, 0],
    });
    expect(run(IX({ fillWindow: true, work: 2 })).fills).toEqual([0.12, 0.12, 0.6, 0.12, 0, 0]);
    const six = buildFixture({ variant: 'desktop', N: 6, P: 3, E: 2, areas: [5, null] });
    const c6 = stageCtx(six.data, six.layout);
    expect(run(IX({ fillWindow: true, work: 0 }), six.data, c6).fills).toEqual([
      0.12, 0.12, 0.12, 0.12, 0.12, 0.6,
    ]);
    expect(run(IX({ fillWindow: true, work: 1 }), six.data, c6).fills).toEqual(Array(6).fill(0.12));
  });

  it('liste modu (sectors 0): rotYEvent 0, dolgular 0; derin preset’ler varsayılan hedefi alır (M7)', () => {
    const list = buildFixture({ variant: 'desktop', N: 7, P: 3, E: 2 });
    const c = stageCtx(list.data, list.layout);
    expect(run(IX({ work: 1, fillWindow: true }), list.data, c)).toMatchObject({
      rotYEvent: 0,
      fillsActive: true,
      fills: [0, 0, 0, 0, 0, 0],
      bandStart: 1,
      bandEnd: 3,
    });
    expect(run(IX({ work: 1, journey: 0, fillWindow: true }), fx.data, ctx, 'folio')).toEqual(
      createEventTargets(),
    );
  });

  it('çıktı nesnesi yeniden kullanılır; önceki çağrının durumu sızmaz', () => {
    const out = createEventTargets();
    expect(resolveEvents('home', IX({ work: 1, fillWindow: true }), fx.data, ctx, out)).toBe(out);
    resolveEvents('home', IX(), fx.data, ctx, out);
    expect(out).toMatchObject({ rotYEvent: 0, fillsActive: false, bandStart: 0, bandEnd: 2 });
  });
});

/* ───────────── olay yayıcı ───────────── */

describe('olay yayıcı', () => {
  it('onStageEvent / emit / abonelikten çıkış; lastStageEvent son olayı tutar', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onStageEvent('folio:next', a);
    const offB = onStageEvent('folio:next', b);
    expect(lastStageEvent('refresh')).toBeUndefined();
    const e = { type: 'folio:next', active: true } as const;
    emit(e);
    emit({ type: 'cut', stage: 'start', reason: 'far-jump' });
    expect(a.mock.calls).toEqual([[e]]);
    expect(b).toHaveBeenCalledTimes(1);
    expect(lastStageEvent('folio:next')).toBe(e);
    expect(lastStageEvent('cut')).toEqual({ type: 'cut', stage: 'start', reason: 'far-jump' });
    offA();
    emit({ type: 'folio:next', active: false });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    offB();
  });

  it('onStageUpdate / notifyStageUpdate (statik kademe DialFigure dönüşü)', () => {
    const cb = vi.fn();
    const off = onStageUpdate(cb);
    notifyStageUpdate();
    notifyStageUpdate();
    off();
    notifyStageUpdate();
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

/* ───────────── applyEvents ───────────── */

describe('applyEvents (sahte gsap runtime; §5.9.5)', () => {
  const FILLS = 'fill0,fill1,fill2,fill3,fill4,fill5';
  const initialInvalidate = stageStore.getState().invalidate;
  let gsap: { to: Mock; killTweensOf: Mock };
  let rt: MotionRuntime;
  let invalidate: Mock;
  let seen: StageEvent[];
  let offs: Array<() => void>;

  beforeEach(() => {
    resetEventState();
    gsap = { to: vi.fn(), killTweensOf: vi.fn() };
    rt = { gsap } as unknown as MotionRuntime;
    invalidate = vi.fn();
    stageStore.setState({ invalidate });
    seen = [];
    offs = (['areas:step', 'work:active', 'journey:active', 'cv:active'] as const).map((type) =>
      onStageEvent(type, (e) => seen.push(e)),
    );
  });
  afterEach(() => {
    offs.forEach((off) => off());
    stageStore.setState({ invalidate: initialInvalidate });
  });

  /** director'ün adım 3'ü: indeksler → hedefler → uygula */
  const step = (s: number, prev: EventIndices | null, instant = false): EventIndices => {
    const i = computeIndices(layout, y(s));
    const t = resolveEvents('home', i, fx.data, ctx, createEventTargets());
    applyEvents(rt, 'home', t, i, prev, { instant });
    return i;
  };
  const tween = (vars: Record<string, number | string>) => [
    stageTarget,
    { ...vars, onUpdate: expect.any(Function) },
  ];

  it('ilk kare anlıktır: tween yok, değerler doğrudan yazılır; DOM olayları instant ile yayılır', () => {
    step(600, null); // areas 3, work 0, journey −1, dolgu penceresi
    expect(gsap.to).not.toHaveBeenCalled();
    expect(gsap.killTweensOf.mock.calls).toEqual([
      [stageTarget, 'bandStart,bandEnd'],
      [stageTarget, 'rotYEvent'],
      [stageTarget, FILLS],
    ]);
    expect(stageTarget).toMatchObject({
      bandStart: 0,
      bandEnd: 2,
      rotYEvent: 0,
      fill0: 0.6,
      fill1: 0.12,
      fill2: 0.12,
      fill3: 0.12,
      fill4: 0,
      fill5: 0,
    });
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(seen).toEqual([
      { type: 'areas:step', index: 3, prev: -1, instant: true },
      { type: 'work:active', index: 0, prev: -1, direction: 1, instant: true },
      { type: 'journey:active', index: -1, prev: -1, instant: true },
    ]);
  });

  it('work değişimi: bant, rotYEvent ve dolgular 600 ms power3.inOut; yön aşağı 1, yukarı −1', () => {
    const p0 = step(600, null);
    gsap.killTweensOf.mockClear();
    invalidate.mockClear();
    seen = [];
    const p1 = step(610, p0); // proje 2 (alan 1) 605'te etkin
    expect(gsap.killTweensOf).not.toHaveBeenCalled();
    expect(gsap.to.mock.calls).toEqual([
      tween({ bandStart: 1, bandEnd: 3, duration: 0.6, ease: 'power3.inOut' }),
      tween({ rotYEvent: -90, duration: 0.6, ease: 'power3.inOut' }),
      tween({
        fill0: 0.12,
        fill1: 0.6,
        fill2: 0.12,
        fill3: 0.12,
        fill4: 0,
        fill5: 0,
        duration: 0.6,
        ease: 'power3.inOut',
      }),
    ]);
    expect(seen).toEqual([
      { type: 'work:active', index: 1, prev: 0, direction: 1, instant: false },
    ]);
    expect(invalidate).not.toHaveBeenCalled();
    (gsap.to.mock.calls[0]?.[1] as { onUpdate: () => void }).onUpdate(); // tween karesi sahneyi uyandırır
    expect(invalidate).toHaveBeenCalledTimes(1);
    seen = [];
    step(600, p1);
    expect(seen).toEqual([
      { type: 'work:active', index: 0, prev: 1, direction: -1, instant: false },
    ]);
  });

  it('journey bandı 500 ms power2.out; journey:active yalnız indeks değişince', () => {
    const p0 = step(870, null); // work 3, journey −1
    gsap.to.mockClear();
    seen = [];
    const p1 = step(880, p0); // girdi 1, 875'te
    expect(gsap.to.mock.calls).toEqual([
      tween({ bandStart: 10, bandEnd: 11, duration: 0.5, ease: 'power2.out' }),
    ]);
    expect(seen).toEqual([{ type: 'journey:active', index: 0, prev: -1, instant: false }]);
    gsap.to.mockClear();
    seen = [];
    step(890, p1);
    expect(gsap.to).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
  });

  it('dolgu penceresinden çıkışta dolgu tween’leri ölür; girişte değerler anlık yazılır (§5.9.5 ZORUNLU)', () => {
    const p0 = step(780, null); // work 3, pencere içi
    gsap.killTweensOf.mockClear();
    const p1 = step(800, p0); // pencere dışı: track'ler devralır
    expect(gsap.killTweensOf.mock.calls).toEqual([[stageTarget, FILLS]]);
    expect(gsap.to).not.toHaveBeenCalled();
    Object.assign(stageTarget, { fill0: 0.5, fill3: 0.5 }); // track'lerin yazdığı değerler
    gsap.killTweensOf.mockClear();
    step(780, p1); // yeniden giriş, instant değil
    expect(gsap.to).not.toHaveBeenCalled();
    expect(gsap.killTweensOf.mock.calls).toEqual([[stageTarget, FILLS]]);
    expect(stageTarget).toMatchObject({
      fill0: 0.12,
      fill1: 0.12,
      fill2: 0.12,
      fill3: 0.6,
      fill4: 0,
    });
  });

  it('değişim yoksa hiçbir şey yapılmaz', () => {
    const p0 = step(600, null);
    gsap.killTweensOf.mockClear();
    invalidate.mockClear();
    seen = [];
    step(601, p0);
    expect(gsap.to).not.toHaveBeenCalled();
    expect(gsap.killTweensOf).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
  });

  it('instant (kesme, geri/ileri): hedef aynı olsa da süren tween öldürülür, değer doğrudan yazılır', () => {
    const p1 = step(610, step(600, null)); // proje 2'ye tween'ler başladı (sahte: stageTarget henüz eski)
    expect(stageTarget).toMatchObject({ bandStart: 0, rotYEvent: 0, fill1: 0.12 });
    gsap.to.mockClear();
    gsap.killTweensOf.mockClear();
    invalidate.mockClear();
    seen = [];
    const p2 = step(611, p1, true);
    expect(gsap.to).not.toHaveBeenCalled();
    expect(gsap.killTweensOf.mock.calls).toEqual([
      [stageTarget, 'bandStart,bandEnd'],
      [stageTarget, 'rotYEvent'],
      [stageTarget, FILLS],
    ]);
    expect(stageTarget).toMatchObject({
      bandStart: 1,
      bandEnd: 3,
      rotYEvent: -90,
      fill0: 0.12,
      fill1: 0.6,
    });
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(seen).toEqual([]); // indeksler aynı → DOM olayı yok
    // anlık dizinin sonraki kareleri (kesme sürerken her güncelleme instant): tween yok, yalnız değişim yazılır
    gsap.killTweensOf.mockClear();
    invalidate.mockClear();
    const p3 = step(612, p2, true);
    expect(gsap.killTweensOf).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    step(680, p3, true); // proje 3: değişim anında yazılır
    expect(gsap.to).not.toHaveBeenCalled();
    expect(stageTarget).toMatchObject({
      bandStart: 2,
      bandEnd: 4,
      rotYEvent: -180,
      fill1: 0.12,
      fill2: 0.6,
    });
    expect(seen).toEqual([{ type: 'work:active', index: 2, prev: 1, direction: 1, instant: true }]);
  });

  it('resetEventState: sonraki (anlık olmayan) çağrı bütün hedefleri yeniden tween’ler', () => {
    const p0 = step(600, null);
    resetEventState();
    step(600, p0);
    expect(gsap.to.mock.calls.map((c) => Object.keys(c[1] as object)[0])).toEqual([
      'bandStart',
      'rotYEvent',
      'fill0',
    ]);
  });

  it('home dışı preset: areas/work/journey olayı yok; cv:active yalnız indeks değişince', () => {
    const t = resolveEvents('cv-core', IX({ cv: 0 }), fx.data, ctx, createEventTargets());
    applyEvents(rt, 'cv-core', t, IX(), null, { instant: false });
    expect(seen).toEqual([]);
    expect(stageTarget).toMatchObject({ bandStart: NO_BAND[0], bandEnd: NO_BAND[1], rotYEvent: 0 });
    applyEvents(rt, 'cv-core', t, IX({ cv: 0 }), IX(), { instant: false });
    expect(seen).toEqual([{ type: 'cv:active', index: 0, prev: -1, instant: false }]);
  });
});

/* ───────────── store (§5.9.1–§5.9.2) ───────────── */

describe('stageStore (§5.9.1)', () => {
  const initial = stageStore.getState();
  const s = () => stageStore.getState();
  afterEach(() => stageStore.setState(initial, true));

  it('başlangıç: poster, static, preset none, demand; invalidate no-op', () => {
    expect(initial).toMatchObject({
      phase: 'poster',
      tier: 'static',
      tierReason: null,
      signals: null,
      preset: 'none',
      data: null,
      paused: false,
      loop: 'demand',
      canvasKey: 0,
      contextLost: false,
      contextLosses: 0,
      quality: null,
      debug: false,
    });
    expect(initial.invalidate()).toBeUndefined();
  });

  it('eylemler: setPreset, setPaused, setPhase, startLoading, toFallback, setLoop, setQuality', () => {
    s().setPreset('home', fx.data);
    expect(s()).toMatchObject({ preset: 'home', data: fx.data });
    s().setPaused(true);
    expect(s().paused).toBe(true);
    s().setPhase('probing');
    expect(s().phase).toBe('probing');
    const signals = {
      webgl2: true,
      saveData: false,
      deviceMemory: null,
      cores: 8,
      coarse: false,
      fine: true,
      narrow: false,
      gpu: { type: 'BENCHMARK' as const, tier: 3, name: 'apple m2' },
      query: null,
    };
    s().startLoading('high', signals, 'probe');
    expect(s()).toMatchObject({
      tier: 'high',
      signals: { gpu: { name: 'apple m2' } },
      tierReason: 'probe',
      phase: 'loading',
    });
    s().toFallback('error');
    expect(s()).toMatchObject({ tier: 'static', tierReason: 'error', phase: 'fallback' });
    s().setLoop('never');
    expect(s().loop).toBe('never');
    const q = { dpr: 1.5, ghost: false, octaves: 1, segments: 'medium' } as const;
    s().setQuality(q);
    expect(s().quality).toBe(q);
  });

  it('bağlam kaybı → poster ve sayaç; geri gelince canvasKey++ ve loading; ikinci kayıp static', () => {
    s().onContextLost();
    expect(s()).toMatchObject({ contextLost: true, contextLosses: 1, phase: 'poster' });
    s().onContextRestored();
    expect(s()).toMatchObject({
      contextLost: false,
      contextLosses: 1,
      canvasKey: 1,
      phase: 'loading',
    });
    s().onContextLost();
    expect(s()).toMatchObject({
      contextLosses: 2,
      tier: 'static',
      tierReason: 'context-loss',
      phase: 'fallback',
    });
  });

  it('useStage seçicisi store değişimini React’e taşır', () => {
    const { result } = renderHook(() => useStage((st) => st.paused));
    expect(result.current).toBe(false);
    act(() => s().setPaused(true));
    expect(result.current).toBe(true);
  });
});

describe('stageTarget, live, nav, directorApi (§5.9.2)', () => {
  it('stageTarget K0 değerleriyle başlar; bant yok, dalga −1, opaklıklar 1, önizleme alfaları 0', () => {
    const k0 = keyframes(contentCtx(4, [0])).hero;
    expect(INITIAL_TARGET).toMatchObject({
      camR: k0.r,
      camAz: k0.az,
      camEl: k0.el,
      camFov: k0.fov,
      rotYScroll: k0.rotY,
      rotYEvent: 0,
      rotX: k0.rotX,
      anchorMix: 0,
      cut: k0.cut,
      ringContrast: k0.ringContrast,
      sectorMix: k0.sectorMix,
      fill0: 0,
      fill5: 0,
      bandStart: NO_BAND[0],
      bandEnd: NO_BAND[1],
      bandVisible: k0.bandVisible,
      ghost: k0.ghost,
      arcGlow: k0.arcGlow,
      rim: k0.rim,
      tone: k0.tone,
      lightAz: k0.lightAz,
      lightEl: k0.lightEl,
      sectorPreviewIndex: -1,
      sectorPreviewAlpha: 0,
      bandPreviewAlpha: 0,
      wave: -1,
      opacityTrack: 1,
      opacityCut: 1,
      opacityReading: 1,
    });
  });

  it('currentSceneOpacity = opacityTrack × opacityCut × opacityReading', () => {
    expect(currentSceneOpacity()).toBe(1);
    Object.assign(stageTarget, { opacityTrack: 0.5, opacityCut: 0.5, opacityReading: 0.8 });
    expect(currentSceneOpacity()).toBeCloseTo(0.2, 12);
  });

  it('nav.consume bekleyen geçişi bir kez döndürür (§5.15.3)', () => {
    expect(nav.consume()).toBeNull();
    nav.pending = 'restore';
    expect(nav.consume()).toBe('restore');
    expect(nav.consume()).toBeNull();
  });

  it('directorApi director yokken NaN / −1 / no-op; live başlangıcı (hero, ilk karede snap)', () => {
    expect(directorApi.areasStepY(1)).toBeNaN();
    expect(directorApi.chapterY('work')).toBeNaN();
    expect(directorApi.chapterIndexAt(100)).toBe(-1);
    expect(directorApi.startCut('far-jump')).toBeUndefined();
    expect(directorApi.endCut()).toBeUndefined();
    expect(live).toMatchObject({ scrollY: 0, inHero: true, snapNextFrame: true });
  });
});
