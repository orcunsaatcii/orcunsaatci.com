// src/experience/intensity.ts — persona yoğunluğu (§4.17.4 [SABİT]). Three-free ve küçük: sahne director'ü
// (tracks.ts) ve rig yalnız bunu okur; persona tablosu (profile.ts) director chunk'ına girmez (PB-2).

export type Intensity = 'calm' | 'standard' | 'expressive';

export interface IntensityParams {
  idleDegPerSec: number; // 1 | 2 | 3
  pointerAzDeg: number; // 15 | 25 | 30
  pointerElDeg: number; // 7 | 12 | 15
  ghostAlphaMax: number; // 0.06 | 0.10 | 0.10
  sweepFromAzDeg: number; // -96 | -120 | -140 (bitiş her zaman -60)
  waveWidthPx: number; // 1.5 | 2 | 2.5
  areasTurnEase: 'sine.inOut' | 'smoothstep' | 'power3.inOut';
}

/** §4.17.4 [SABİT]; `standard` final.md değerlerinin aynısıdır. */
export const INTENSITY: Readonly<Record<Intensity, IntensityParams>> = {
  calm: {
    idleDegPerSec: 1,
    pointerAzDeg: 15,
    pointerElDeg: 7,
    ghostAlphaMax: 0.06,
    sweepFromAzDeg: -96,
    waveWidthPx: 1.5,
    areasTurnEase: 'sine.inOut',
  },
  standard: {
    idleDegPerSec: 2,
    pointerAzDeg: 25,
    pointerElDeg: 12,
    ghostAlphaMax: 0.1,
    sweepFromAzDeg: -120,
    waveWidthPx: 2,
    areasTurnEase: 'smoothstep',
  },
  expressive: {
    idleDegPerSec: 3,
    pointerAzDeg: 30,
    pointerElDeg: 15,
    ghostAlphaMax: 0.1,
    sweepFromAzDeg: -140,
    waveWidthPx: 2.5,
    areasTurnEase: 'power3.inOut',
  },
};
