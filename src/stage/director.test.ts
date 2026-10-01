// src/stage/director.test.ts — director gövdesi (§5.13.5, §5.9.7), sahte gsap/ScrollTrigger runtime'ı ve jsdom'la:
// refresh ölçümü ve director API'si, kaydırma güncellemesi, anlık kaydırma kesmesi, belirme zinciri (oturtulmuş kare ya
// da 1.5 s), far-jump startCut/endCut, route geri yüklemesi, ResizeObserver yenilemesi ve sökme (bekleyen belirme
// iptal edilir: preset 'none' sayfasında döngü 'demand'e dönmez, §5.19).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MotionRuntime } from '@/lib/gsap';
import { runDirector } from './director';
import { onStageEvent, type StageEvent } from './events';
import { buildFixture, mountFixture, type Fixture } from './layout.fixture';
import { directorApi, live, nav, stageStore, stageTarget } from './store';

type Vars = Record<string, unknown> & { onComplete?: () => void };
type Self = { scroll(): number; getVelocity(): number };

function fakeRuntime() {
  const tweens: Array<{ target: unknown; vars: Vars }> = [];
  const st: { onRefresh?: () => void; onUpdate?: (self: Self) => void } = {};
  const revert = vi.fn();
  const gsap = {
    context: vi.fn((fn: () => void) => {
      fn();
      return { revert };
    }),
    to: vi.fn((target: unknown, vars: Vars) => {
      tweens.push({ target, vars });
      return {};
    }),
    killTweensOf: vi.fn(),
  };
  const ScrollTrigger = {
    create: vi.fn((o: typeof st) => Object.assign(st, o)),
    refresh: vi.fn(),
  };
  const rt = { gsap, ScrollTrigger } as unknown as MotionRuntime;
  /** ScrollTrigger onUpdate'i (Lenis / native kaydırma) */
  const scrollTo = (y: number, v = 0) => st.onUpdate?.({ scroll: () => y, getVelocity: () => v });
  const fades = () => tweens.filter((t) => t.vars.opacityCut === 1);
  return { rt, gsap, ScrollTrigger, tweens, st, revert, scrollTo, fades };
}

describe('runDirector (sahte runtime, jsdom)', () => {
  let fx: Fixture;
  let root: HTMLElement;
  let stops: Array<() => void>;
  let cuts: StageEvent[];
  let offs: Array<() => void>;
  const queue = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  /** bir kare: o ana kadar istenen rAF geri çağrıları */
  const frame = () => {
    const cbs = [...queue.values()];
    queue.clear();
    cbs.forEach((cb) => cb(0));
  };
  let roCallback: (() => void) | undefined;

  beforeEach(() => {
    queue.clear();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queue.set(++nextId, cb);
      return nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id));
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          roCallback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    fx = buildFixture({ variant: 'desktop', N: 4, P: 4, E: 6 });
    root = mountFixture(fx);
    const layer = document.createElement('div');
    layer.id = 'scene-layer';
    document.body.append(layer);
    stageStore.setState({ phase: 'poster', loop: 'demand' });
    stageTarget.opacityCut = 1;
    live.snapNextFrame = false;
    nav.pending = null;
    stops = [];
    cuts = [];
    offs = [onStageEvent('cut', (e) => cuts.push(e))];
  });
  afterEach(() => {
    stops.forEach((stop) => stop());
    offs.forEach((off) => off());
  });

  const start = (preset: 'home' | 'folio' = 'home') => {
    const f = fakeRuntime();
    stops.push(runDirector(root, f.rt, preset, fx.data));
    return f;
  };
  const cutLog = () =>
    cuts.map((e) => (e.type === 'cut' ? `${e.stage}:${e.reason}` : e.type)).join(' ');

  it('kurulum: refresh ölçer (live.layout), director API’si kurulur, refresh olayı bölümleri taşır', () => {
    const refreshes: StageEvent[] = [];
    offs.push(onStageEvent('refresh', (e) => refreshes.push(e)));
    const f = start();
    expect(f.ScrollTrigger.create).toHaveBeenCalledWith(
      expect.objectContaining({ start: 0, end: 'max' }),
    );
    expect(live.layout).toEqual(fx.layout);
    expect(directorApi.chapterY('about')).toBe(fx.px(fx.top.about!));
    expect(directorApi.chapterIndexAt(fx.px(fx.top.work!) + 5)).toBe(
      fx.sections.findIndex((s) => s.id === 'work'),
    );
    expect(Number.isFinite(directorApi.areasStepY(1))).toBe(true);
    expect(refreshes).toHaveLength(1);
    expect(refreshes[0]?.type === 'refresh' && refreshes[0].chapters.length).toBe(
      fx.sections.length,
    );
    expect(document.getElementById('scene-layer')!.style.getPropertyValue('--scene-opacity')).toBe(
      '1.000',
    );
    expect(cuts).toEqual([]); // ilk güncelleme anlık ama kesme değil
  });

  it('kaydırma güncellemesi: live.scrollY, hız ve hero kapısı yazılır', () => {
    const f = start();
    f.scrollTo(fx.px(10), 420);
    expect([live.scrollY, live.velocity, live.inHero]).toEqual([fx.px(10), 420, true]);
    f.scrollTo(fx.px(60));
    expect(live.inHero).toBe(false); // heroExit = about IN p 0.30 (30 svh)
  });

  it('tek güncellemede > 1.5·vh: anlık kesme; belirme rig oturtulmuş kareyi çizince başlar (§5.9.7)', () => {
    stageStore.setState({ phase: 'ready', loop: 'never' });
    const f = start();
    f.scrollTo(fx.px(400));
    expect(stageTarget.opacityCut).toBe(0);
    expect(stageStore.getState().loop).toBe('demand'); // oturtulmuş kare görünmezken çizilsin
    expect(live.snapNextFrame).toBe(true);
    expect(cutLog()).toBe('start:instant-scroll snap:instant-scroll');
    frame();
    frame();
    expect(f.fades()).toHaveLength(0); // rig henüz oturmadı
    live.snapNextFrame = false; // rig oturtulmuş kareyi çizdi
    frame();
    frame();
    const fade = f.fades();
    expect(fade).toHaveLength(1);
    expect(fade[0]?.vars).toMatchObject({ duration: 0.2, ease: 'power2.out' });
    stageTarget.opacityCut = 1;
    fade[0]?.vars.onComplete?.();
    expect(cutLog()).toBe('start:instant-scroll snap:instant-scroll end:instant-scroll');
    expect(stageStore.getState().loop).toBe('demand');
  });

  it('sahne kare çizmiyorsa belirme en geç 1.5 s sonra başlar; canlı sahne yoksa hemen', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    stageStore.setState({ phase: 'ready' });
    const f = start();
    f.scrollTo(fx.px(400));
    frame();
    expect(f.fades()).toHaveLength(0);
    now = 2600;
    frame();
    frame();
    expect(f.fades()).toHaveLength(1);
    f.fades()[0]?.vars.onComplete?.(); // kesme biter (sürerken yeni kesme açılmaz)
    // canlı sahne yok (poster / static): beklemeden
    stageStore.setState({ phase: 'fallback' });
    f.scrollTo(fx.px(10));
    expect(f.fades()).toHaveLength(2);
  });

  it('sökme bekleyen belirmeyi iptal eder: sonradan tween ve döngü yazımı olmaz (§5.19)', () => {
    stageStore.setState({ phase: 'ready' });
    const f = start();
    f.scrollTo(fx.px(400));
    stops.pop()!();
    stageStore.setState({ loop: 'never' }); // StageRoot: preset 'none' → never
    live.snapNextFrame = false;
    frame();
    frame();
    frame();
    expect(f.fades()).toHaveLength(0);
    expect(stageStore.getState().loop).toBe('never');
    expect(stageTarget.opacityCut).toBe(1);
    expect(f.revert).toHaveBeenCalled();
    expect(f.gsap.killTweensOf).toHaveBeenCalledWith(stageTarget);
    expect([live.layout, directorApi.chapterIndexAt(0)]).toEqual([null, -1]);
  });

  it('far-jump: startCut söndürür (150 ms), endCut oturtur ve geri getirir (250 ms)', () => {
    const f = start();
    directorApi.startCut('far-jump');
    expect(f.tweens.at(-1)?.vars).toMatchObject({
      opacityCut: 0,
      duration: 0.15,
      ease: 'power2.in',
    });
    expect(stageStore.getState().loop).toBe('demand');
    directorApi.endCut();
    expect(live.snapNextFrame).toBe(true);
    expect(cutLog()).toBe('start:far-jump snap:far-jump');
    expect(f.fades()[0]?.vars).toMatchObject({ duration: 0.25 }); // canlı sahne yok: hemen
  });

  it('route geri yüklemesi: refresh bekleyen gezinmeyi tüketir ve keser', () => {
    nav.pending = 'restore';
    start();
    expect(cutLog()).toBe('start:restore snap:restore');
    expect(nav.pending).toBeNull();
  });

  it('ResizeObserver: yalnız belge yüksekliği değişince 150 ms sonra ScrollTrigger.refresh', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const f = start();
    roCallback?.();
    vi.advanceTimersByTime(200);
    expect(f.ScrollTrigger.refresh).not.toHaveBeenCalled();
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(99_999);
    roCallback?.();
    roCallback?.();
    vi.advanceTimersByTime(149);
    expect(f.ScrollTrigger.refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(f.ScrollTrigger.refresh).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
