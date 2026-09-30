// src/stage/capabilities.ts — yetenek yoklaması ve kademe ataması (§5.11.2–§5.11.3). Three-free.
// detect-gpu yalnız dinamik import edilir (ayrı küçük chunk); benchmark JSON'ları kendi sunucumuzdan
// (/detect-gpu, postinstall kopyası). ?tier= yalnız istemcide okunur (D-06) ve bütün sinyalleri geçersiz kılar (QA).
import type { Tier } from './quality';

export interface ProbeSignals {
  webgl2: boolean; // getContext('webgl2', { failIfMajorPerformanceCaveat: true }) !== null
  saveData: boolean; // navigator.connection?.saveData (yalnız Chromium)
  deviceMemory: number | null; // yalnız Chromium; Safari/Firefox → null (bilinmiyor, koşul atlanır)
  cores: number | null; // navigator.hardwareConcurrency
  coarse: boolean; // (pointer: coarse)
  fine: boolean; // (hover: hover) and (pointer: fine)
  narrow: boolean; // (max-width: 63.99rem)
  gpu: {
    type: 'BENCHMARK' | 'FALLBACK' | 'BLOCKLISTED' | 'WEBGL_UNSUPPORTED' | 'SSR' | 'ERROR';
    tier: number;
    name?: string;
  } | null;
  /** Renderer bir yazılım rasterleştiricisi (SwiftShader, llvmpipe…): failIfMajorPerformanceCaveat onu reddetmiyor */
  software: boolean;
  query: Tier | null; // ?tier=… (yalnız client'ta okunur, D-06)
}

/**
 * Yazılım render'ı (SPEC-SAPMA §5.11.3, M5): Chrome SwiftShader'ı (ANGLE/Vulkan) ve Mesa llvmpipe'ı
 * failIfMajorPerformanceCaveat ile reddetmiyor; detect-gpu'nun kara listesi de ANGLE'ın "google, swiftshader device"
 * adını eşleştirmiyor (V-41). Yazılım render'ında sahne ana iş parçacığını saniyelerce bloklar (LHCI TBT 4.8 s).
 */
export const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|lavapipe|softpipe|software rasterizer|basic render driver|apple software renderer/i;

/** Maskesiz renderer adı: WEBGL_debug_renderer_info varsa oradan, yoksa RENDERER (Firefox maskesiz döndürür) */
function rendererName(gl: WebGL2RenderingContext): string {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name: unknown = gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  return typeof name === 'string' ? name : '';
}

const TIERS: readonly Tier[] = ['static', 'low', 'medium', 'high'];

/** ?tier=static|low|medium|high (§5.18.1); başka değer yok sayılır. */
export function readTierQuery(search = window.location.search): Tier | null {
  const q = new URLSearchParams(search).get('tier');
  return TIERS.find((t) => t === q) ?? null;
}

type GL = WebGL2RenderingContext;

/** webgl2(fail) = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: fail }) (hata → null) */
function webgl2(fail: boolean): GL | null {
  try {
    return document
      .createElement('canvas')
      .getContext('webgl2', { failIfMajorPerformanceCaveat: fail }) as GL | null;
  } catch {
    return null;
  }
}

/** Yoklama bağlamını serbest bırakır (tarayıcının bağlam sınırını yemesin). */
function release(gl: GL | null): void {
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
}

export async function probeCapabilities(): Promise<{ tier: Tier; signals: ProbeSignals }> {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const mm = (q: string) => window.matchMedia(q).matches;
  const query = readTierQuery();
  const s: ProbeSignals = {
    webgl2: false,
    saveData: !!nav.connection?.saveData,
    deviceMemory: nav.deviceMemory ?? null,
    cores: nav.hardwareConcurrency ?? null,
    coarse: mm('(pointer: coarse)'),
    fine: mm('(hover: hover) and (pointer: fine)'),
    narrow: mm('(max-width: 63.99rem)'),
    gpu: null,
    software: false,
    query,
  };
  if (query) {
    // QA: sinyaller atlanır; yalnız düz WebGL2 kontrolü (yazılım render'ında da açılır, §13.3.3)
    const gl = query === 'static' ? null : webgl2(false);
    s.webgl2 = !!gl;
    release(gl);
    return { tier: query !== 'static' && !gl ? 'static' : query, signals: s };
  }
  const gl = webgl2(true); // yazılım render (SwiftShader vb.) → null
  s.webgl2 = !!gl;
  if (!gl || s.saveData || (s.deviceMemory !== null && s.deviceMemory <= 2)) {
    release(gl);
    return { tier: 'static', signals: s };
  }
  s.software = SOFTWARE_RENDERER.test(rendererName(gl));
  if (s.software) {
    release(gl);
    return { tier: 'static', signals: s };
  }
  try {
    const { getGPUTier } = await import('detect-gpu'); // ayrı küçük chunk
    const r = await getGPUTier({ benchmarksURL: '/detect-gpu', glContext: gl });
    s.gpu = { type: r.type, tier: r.tier, name: r.gpu };
  } catch {
    s.gpu = { type: 'ERROR', tier: 2 };
  }
  release(gl);
  return { tier: assignTier(s), signals: s };
}

/** Saf kademe ataması (§5.11.3 tablosu; capabilities.test.ts). Yukarıdan aşağı ilk eşleşen. */
export function assignTier(s: ProbeSignals): Tier {
  if (!s.webgl2 || s.software || s.saveData || (s.deviceMemory !== null && s.deviceMemory <= 2))
    return 'static';
  const g = s.gpu;
  if (g && (g.type === 'BLOCKLISTED' || g.type === 'WEBGL_UNSUPPORTED')) return 'static';
  // detect-gpu benchmark verisi Şubat 2025'te biter: bilinmeyen GPU → FALLBACK (tier 1). Cezalandırma; 2 say.
  const unknown = !g || g.type === 'FALLBACK' || g.type === 'ERROR' || g.type === 'SSR';
  const gpuTier = unknown ? ((s.cores ?? 0) >= 8 && s.fine && !s.narrow ? 3 : 2) : g.tier;
  if (gpuTier <= 0) return 'static';
  if (
    ((s.cores ?? 8) <= 4 && s.coarse) ||
    (s.deviceMemory !== null && s.deviceMemory <= 4) ||
    gpuTier === 1
  )
    return 'low';
  if (s.coarse || s.narrow || gpuTier === 2) return 'medium';
  return s.fine ? 'high' : 'medium';
}
