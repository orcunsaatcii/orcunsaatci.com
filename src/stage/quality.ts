// src/stage/quality.ts — KOD kademe tablosu ve çalışma zamanı kalite merdiveni (§5.20.7, §5.11.4). Three-free ve saf.

export type Tier = 'static' | 'low' | 'medium' | 'high'; // store.ts'ten yeniden dışa aktarılır

export interface TierSpec {
  dprMax: number; // dpr = clamp(devicePixelRatio, 1, dprMax)
  antialias: boolean;
  motion: boolean; // süzülme + ince işaretçide paralaks (kendiliğinden hareket kuralı §4.4; low'da kapalı)
}

// §5.20.7 tablosu: satır başına bir kademe.
// prettier-ignore
export const TIERS: Record<Exclude<Tier, 'static'>, TierSpec> = {
  high:   { dprMax: 2,   antialias: true,  motion: true },
  medium: { dprMax: 1.5, antialias: false, motion: true },
  low:    { dprMax: 1,   antialias: false, motion: false },
};

/** Çalışma zamanı kalite durumu (§5.11.4) */
export interface QualityState {
  dpr: number;
  motion: boolean;
}

const DPR_STEP = 0.25;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Kademenin başlangıç kalitesi; dpr = clamp(devicePixelRatio, 1, dprMax) (§5.20.7) */
export function initialQuality(
  t: Exclude<Tier, 'static'>,
  deviceDpr: number = typeof window === 'undefined' ? 1 : window.devicePixelRatio,
): QualityState {
  const spec = TIERS[t];
  return {
    dpr: round2(Math.min(Math.max(deviceDpr || 1, 1), spec.dprMax)),
    motion: spec.motion,
  };
}

/** Tek adım aşağı (§5.20.7): 1) dpr −0.25 (1'e kadar) 2) süzülme ve paralaks kapalı. null = merdiven tükendi. */
export function stepDown(q: QualityState): QualityState | null {
  if (q.dpr > 1) return { ...q, dpr: Math.max(1, round2(q.dpr - DPR_STEP)) };
  if (q.motion) return { ...q, motion: false };
  return null;
}

/** stepDown'ın tersi; başlangıç kalitesi (base) aşılmaz. null = zaten base'te. */
export function stepUp(q: QualityState, base: QualityState): QualityState | null {
  if (!q.motion && base.motion) return { ...q, motion: true };
  if (q.dpr < base.dpr) return { ...q, dpr: Math.min(base.dpr, round2(q.dpr + DPR_STEP)) };
  return null;
}
