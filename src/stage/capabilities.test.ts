// src/stage/capabilities.test.ts — kademe ataması tablo testleri (§5.11.3) ve ?tier= önceliği (§5.18.1).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assignTier, probeCapabilities, readTierQuery, type ProbeSignals } from './capabilities';

const getGPUTier = vi.fn();
vi.mock('detect-gpu', () => ({ getGPUTier: (...a: unknown[]) => getGPUTier(...a) }));

const base: ProbeSignals = {
  webgl2: true,
  saveData: false,
  deviceMemory: null,
  cores: 8,
  coarse: false,
  fine: true,
  narrow: false,
  gpu: { type: 'BENCHMARK', tier: 3, name: 'apple m1' },
  query: null,
};
const s = (o: Partial<ProbeSignals>): ProbeSignals => ({ ...base, ...o });

describe('assignTier (§5.11.3)', () => {
  it.each<[string, Partial<ProbeSignals>, string]>([
    ['WebGL2 yok', { webgl2: false }, 'static'],
    ['Save-Data', { saveData: true }, 'static'],
    ['deviceMemory ≤ 2', { deviceMemory: 2 }, 'static'],
    ['BLOCKLISTED', { gpu: { type: 'BLOCKLISTED', tier: 0 } }, 'static'],
    ['WEBGL_UNSUPPORTED', { gpu: { type: 'WEBGL_UNSUPPORTED', tier: 0 } }, 'static'],
    ['benchmark kademe 0', { gpu: { type: 'BENCHMARK', tier: 0 } }, 'static'],
    ['cores ≤ 4 + kaba', { cores: 4, coarse: true, fine: false, narrow: true }, 'low'],
    ['deviceMemory ≤ 4', { deviceMemory: 4 }, 'low'],
    ['benchmark kademe 1', { gpu: { type: 'BENCHMARK', tier: 1 } }, 'low'],
    ['kaba işaretçi', { coarse: true, fine: false }, 'medium'],
    ['dar görüntü alanı', { narrow: true }, 'medium'],
    ['benchmark kademe 2', { gpu: { type: 'BENCHMARK', tier: 2 } }, 'medium'],
    ['ince + geniş + kademe 3', {}, 'high'],
    ['kademe 3 ama ince işaretçi yok', { fine: false }, 'medium'],
    ['FALLBACK + cores ≥ 8 + ince + geniş', { gpu: { type: 'FALLBACK', tier: 1 } }, 'high'],
    ['FALLBACK + cores 6', { cores: 6, gpu: { type: 'FALLBACK', tier: 1 } }, 'medium'],
    ['ERROR → 2 sayılır', { gpu: { type: 'ERROR', tier: 2 } }, 'high'],
    ['gpu bilgisi yok (null) + cores null', { gpu: null, cores: null }, 'medium'],
    ['SSR tipi bilinmeyen sayılır', { gpu: { type: 'SSR', tier: 0 }, cores: 4 }, 'medium'],
  ])('%s → %s', (_, o, tier) => {
    expect(assignTier(s(o))).toBe(tier);
  });
});

describe('readTierQuery', () => {
  it('yalnız geçerli kademe adlarını okur', () => {
    expect(readTierQuery('?tier=medium')).toBe('medium');
    expect(readTierQuery('?debug&tier=static')).toBe('static');
    expect(readTierQuery('?tier=ultra')).toBeNull();
    expect(readTierQuery('')).toBeNull();
  });
});

describe('probeCapabilities', () => {
  const lose = vi.fn();
  let contexts: { fail: boolean }[];
  let webgl: 'none' | 'software' | 'hardware';

  beforeEach(() => {
    contexts = [];
    webgl = 'hardware';
    getGPUTier.mockReset();
    lose.mockReset();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      _type: string,
      opts?: unknown,
    ) {
      const fail = !!(opts as { failIfMajorPerformanceCaveat?: boolean } | undefined)
        ?.failIfMajorPerformanceCaveat;
      contexts.push({ fail });
      if (webgl === 'none' || (webgl === 'software' && fail)) return null;
      return { getExtension: () => ({ loseContext: lose }) } as unknown as RenderingContext;
    } as never);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('hover: hover') }));
    // jsdom makinenin çekirdek sayısını döndürür (yerel 8+, CI 4): sinyal sabitlenir
    cores(8);
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    delete (navigator as unknown as { hardwareConcurrency?: number }).hardwareConcurrency;
  });
  const cores = (n: number) =>
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => n });

  it('?tier= bütün sinyalleri geçersiz kılar; yazılım render’ında da açılır (düz WebGL2)', async () => {
    window.history.replaceState(null, '', '/?tier=high');
    webgl = 'software';
    const r = await probeCapabilities();
    expect(r.tier).toBe('high');
    expect(r.signals.query).toBe('high');
    expect(contexts).toEqual([{ fail: false }]);
    expect(getGPUTier).not.toHaveBeenCalled();
    expect(lose).toHaveBeenCalled();
  });

  it('?tier=static bağlam açmaz; WebGL2 yoksa ?tier=medium da static olur', async () => {
    window.history.replaceState(null, '', '/?tier=static');
    expect((await probeCapabilities()).tier).toBe('static');
    expect(contexts).toEqual([]);
    window.history.replaceState(null, '', '/?tier=medium');
    webgl = 'none';
    expect((await probeCapabilities()).tier).toBe('static');
  });

  it('doğal yol: SwiftShader (failIfMajorPerformanceCaveat) → static, detect-gpu istenmez', async () => {
    webgl = 'software';
    const r = await probeCapabilities();
    expect(r.tier).toBe('static');
    expect(r.signals.webgl2).toBe(false);
    expect(getGPUTier).not.toHaveBeenCalled();
  });

  it('doğal yol: detect-gpu kendi sunucumuzdan, sonuç assignTier ile', async () => {
    getGPUTier.mockResolvedValue({ type: 'BENCHMARK', tier: 3, gpu: 'test gpu' });
    const r = await probeCapabilities();
    expect(getGPUTier).toHaveBeenCalledWith(
      expect.objectContaining({ benchmarksURL: '/detect-gpu' }),
    );
    expect(r.signals.gpu).toEqual({ type: 'BENCHMARK', tier: 3, name: 'test gpu' });
    expect(r.tier).toBe('high');
  });

  it('detect-gpu hatası bilinmeyen GPU sayılır: 8 çekirdek + ince + geniş → high, 4 çekirdek → medium', async () => {
    getGPUTier.mockRejectedValue(new Error('ağ'));
    const r = await probeCapabilities();
    expect(r.signals.gpu).toEqual({ type: 'ERROR', tier: 2 });
    expect(r.tier).toBe('high');
    cores(4);
    expect((await probeCapabilities()).tier).toBe('medium');
  });
});
