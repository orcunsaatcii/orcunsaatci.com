// src/experience/profile.test.ts — K-PERSONA-1, K-PERSONA-2 (§4.18, §13.2.2)
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import {
  INTENSITY,
  PROFILES,
  getExperienceProfile,
  resolveTypePreset,
  type Persona,
} from './profile';

const PERSONAS: readonly Persona[] = [
  'neutral',
  'engineer',
  'designer',
  'architect',
  'researcher',
  'manager',
];

/** Her yaprağın dolu olduğunu doğrular: boş dize, NaN ve undefined yok. */
function expectFilled(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    expect(value.length, path).toBeGreaterThan(0);
    value.forEach((v, i) => expectFilled(v, `${path}[${i}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) expectFilled(v, `${path}.${k}`);
  } else if (typeof value === 'string') {
    expect(value.trim(), path).not.toBe('');
  } else if (typeof value === 'number') {
    expect(Number.isFinite(value), path).toBe(true);
  } else {
    expect(typeof value, path).toBe('boolean');
  }
}

describe('K-PERSONA-1', () => {
  it('PROFILES altı persona içerir ve her alan doludur', () => {
    expect(Object.keys(PROFILES).sort()).toEqual([...PERSONAS].sort());
    for (const p of PERSONAS) {
      const profile = PROFILES[p];
      expect(profile.persona).toBe(p);
      expectFilled(profile, p);
      expect(Object.keys(profile.labels.eyebrows).sort()).toEqual(
        ['about', 'areas', 'contact', 'journey', 'work'].sort(),
      );
    }
  });

  it('her persona’da stone.disp ≤ 0.045', () => {
    for (const p of PERSONAS) expect(PROFILES[p].stone.disp).toBeLessThanOrEqual(0.045);
  });

  it('bilinmeyen persona engineer’a düşer (D-35)', () => {
    expect(getExperienceProfile('engineer')).toBe(PROFILES.engineer);
    expect(getExperienceProfile('designer')).toBe(PROFILES.designer);
    expect(getExperienceProfile('toString' as Persona)).toBe(PROFILES.engineer);
    expect(getExperienceProfile('pilot' as Persona)).toBe(PROFILES.engineer);
  });
});

describe('K-PERSONA-2', () => {
  it('neutral değerleri §4.17.2 tablosuyla birebir aynıdır', () => {
    expect(PROFILES.neutral).toEqual({
      persona: 'neutral',
      stone: {
        shape: [2.2, 2.2],
        radii: [1, 0.86, 1],
        disp: 0.035,
        noiseFreq: 1.3,
        seed: 7.0,
        surface: 'graphite',
      },
      cap: { pattern: 'rings', ringWarp: 0.04, ringsSource: 'years' },
      palette: 'mekanizma',
      type: 'hassas',
      intensity: 'standard',
      labels: {
        eyebrows: {
          about: { tr: 'Kaynak', en: 'Source' },
          areas: { tr: 'Modüller', en: 'Modules' },
          work: { tr: 'Derleme', en: 'Build' },
          journey: { tr: 'Sürüm geçmişi', en: 'Version history' },
          contact: { tr: 'Terminal', en: 'Terminal' },
        },
        areas: { tr: 'Çalışma alanları', en: 'Areas of work' },
        work: { tr: 'Seçili projeler', en: 'Selected projects' },
        contactLead: {
          tr: 'Bir sonraki sürümü birlikte yazalım.',
          en: "Let's write the next release together.",
        },
      },
      work: { viewer: true, specimen: true },
    });
  });

  it('standard yoğunluk §4.17.4 tablosuyla birebir aynıdır', () => {
    expect(INTENSITY.standard).toEqual({
      idleDegPerSec: 2,
      pointerAzDeg: 25,
      pointerElDeg: 12,
      ghostAlphaMax: 0.1,
      sweepFromAzDeg: -120,
      waveWidthPx: 2,
      areasTurnEase: 'smoothstep',
    });
  });

  it('etkin persona engineer §4.17.2 sahne değerlerini taşır (M1 revizyonu: akik yumrusu)', () => {
    const e = PROFILES.engineer;
    expect(e.stone).toMatchObject({
      shape: [2.2, 2.3],
      radii: [1, 0.8, 1],
      disp: 0.045,
      surface: 'geode',
    });
    expect(e.cap.pattern).toBe('geode');
    expect(e.palette).toBe('mekanizma');
    expect(e.intensity).toBe('standard');
  });
});

describe('K-PERSONA-4', () => {
  it('editoryal fontları yokken hassas kullanılır ve uyarı yazılır', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveTypePreset(PROFILES.researcher.type)).toBe('hassas');
    expect(warn).toHaveBeenCalledOnce();
    expect(resolveTypePreset('hassas')).toBe('hassas');
    expect(warn).toHaveBeenCalledOnce();
  });
});
