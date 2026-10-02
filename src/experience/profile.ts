// src/experience/profile.ts — three-free; stage/, views/ ve figures/ buradan okur (§4.17.3).
// Değerlerin sahibi §4.17.2 (persona tablosu) ve §4.17.4 (yoğunluk, [SABİT]) tablolarıdır.
import type { PaletteName } from '../design/tokens';
import type { Intensity } from './intensity';

export { INTENSITY, type Intensity, type IntensityParams } from './intensity';

export type { PaletteName };
export type Persona = 'neutral' | 'engineer' | 'designer' | 'architect' | 'researcher' | 'manager';
// 'geode' M1 revizyonunda eklendi (sahip kararı, issue #5): akik yumrusu kabuğu ve kesiti.
export type Surface = 'graphite' | 'anodized' | 'agate' | 'travertine' | 'ice' | 'oak' | 'geode';
export type CapPattern = 'rings' | 'contours' | 'agate' | 'poche' | 'growth' | 'geode';
export type RingsSource = 'years' | 'publications' | 'teamSize';
export type TypePreset = 'hassas' | 'editoryal';
type L = { tr: string; en: string };

export interface ExperienceProfile {
  persona: Persona;
  stone: {
    shape: readonly [n1: number, n2: number]; // superquadric üsleri (uShape)
    radii: readonly [x: number, y: number, z: number]; // uRadii
    disp: number; // uDisp, ≤ 0.045 (cap tekniği için)
    noiseFreq: number; // uNoiseFreq
    seed: number; // uSeed (posterler canlı kareyle aynı olsun diye deterministik)
    surface: Surface;
  };
  cap: { pattern: CapPattern; ringWarp: number; ringsSource: RingsSource };
  palette: PaletteName;
  type: TypePreset;
  intensity: Intensity;
  labels: {
    eyebrows: Record<'about' | 'areas' | 'work' | 'journey' | 'contact', L>;
    areas: L; // ana sayfa areas <h2>
    work: L; // ana sayfa work <h2>
    contactLead: L; // contact lead (yer tutucu; içerik sahibi değiştirebilir, §7.9)
  };
  work: { viewer: boolean; specimen: boolean }; // viewer=false → work her boyutta akış düzeni; specimen=false → work'te tone 0
}

/** Tüm persona'larda ortak değerler (§4.17.2) */
const NOISE_FREQ = 1.3;
const SEED = 7.0;
const RING_WARP = 0.04;

/** Eyebrow'lar normal yazımla saklanır; büyük harfi type-eyebrow'un CSS text-transform'u üretir (§4.17.2). */
/** KOD (§4 KOD, 2026-10-02): bölüm eyebrow'ları editörün dilinden; görünür başlıklar sade kalır */
const EYEBROWS: ExperienceProfile['labels']['eyebrows'] = {
  about: { tr: 'Kaynak', en: 'Source' },
  areas: { tr: 'Modüller', en: 'Modules' },
  work: { tr: 'Derleme', en: 'Build' },
  journey: { tr: 'Sürüm geçmişi', en: 'Version history' },
  contact: { tr: 'Terminal', en: 'Terminal' },
};

const WORK = { viewer: true, specimen: true } as const;

export const PROFILES: Readonly<Record<Persona, ExperienceProfile>> = {
  neutral: {
    persona: 'neutral',
    stone: {
      shape: [2.2, 2.2],
      radii: [1, 0.86, 1],
      disp: 0.035,
      noiseFreq: NOISE_FREQ,
      seed: SEED,
      surface: 'graphite',
    },
    cap: { pattern: 'rings', ringWarp: RING_WARP, ringsSource: 'years' },
    palette: 'mekanizma',
    type: 'hassas',
    intensity: 'standard',
    labels: {
      eyebrows: EYEBROWS,
      areas: { tr: 'Çalışma alanları', en: 'Areas of work' },
      work: { tr: 'Seçili projeler', en: 'Selected projects' },
      contactLead: {
        tr: 'Bir sonraki sürümü birlikte yazalım.',
        en: "Let's write the next release together.",
      },
    },
    work: WORK,
  },
  // M1 revizyonu (2026-09-30, issue #5): "yuvarlatılmış zar" yerine akik yumrusu (jeot); dışı pürüzlü kaya,
  // kesiti kabuk hattını izleyen akik bantları. Bantlar halkadır (yıllar); en eski yıl druzy kuvars çekirdek.
  engineer: {
    persona: 'engineer',
    stone: {
      shape: [2.2, 2.3],
      radii: [1, 0.8, 1],
      disp: 0.045,
      noiseFreq: NOISE_FREQ,
      seed: SEED,
      surface: 'geode',
    },
    cap: { pattern: 'geode', ringWarp: RING_WARP, ringsSource: 'years' },
    palette: 'mekanizma',
    type: 'hassas',
    intensity: 'standard',
    labels: {
      eyebrows: EYEBROWS,
      areas: { tr: 'Uzmanlık alanları', en: 'Areas of expertise' },
      work: { tr: 'Seçili projeler', en: 'Selected projects' },
      contactLead: {
        tr: 'Bir sonraki sürümü birlikte inşa edelim.',
        en: "Let's build the next release together.",
      },
    },
    work: WORK,
  },
  designer: {
    persona: 'designer',
    stone: {
      shape: [2.0, 2.0],
      radii: [1, 0.9, 1],
      disp: 0.045,
      noiseFreq: NOISE_FREQ,
      seed: SEED,
      surface: 'agate',
    },
    cap: { pattern: 'agate', ringWarp: RING_WARP, ringsSource: 'years' },
    palette: 'atolye',
    type: 'hassas',
    intensity: 'expressive',
    labels: {
      eyebrows: EYEBROWS,
      areas: { tr: 'Disiplinler', en: 'Disciplines' },
      work: { tr: 'Seçili işler', en: 'Selected work' },
      contactLead: {
        tr: 'Bir sonraki sürümü birlikte tasarlayalım.',
        en: "Let's design the next release together.",
      },
    },
    work: WORK,
  },
  architect: {
    persona: 'architect',
    stone: {
      shape: [6, 6],
      radii: [1, 0.7, 1],
      disp: 0.0,
      noiseFreq: NOISE_FREQ,
      seed: SEED,
      surface: 'travertine',
    },
    cap: { pattern: 'poche', ringWarp: RING_WARP, ringsSource: 'years' },
    palette: 'emaye',
    type: 'hassas',
    intensity: 'standard',
    labels: {
      eyebrows: EYEBROWS,
      areas: { tr: 'Ölçekler ve tipolojiler', en: 'Scales and typologies' },
      work: { tr: 'Yapılar ve projeler', en: 'Buildings and projects' },
      contactLead: {
        tr: 'Bir sonraki sürümü birlikte kuralım.',
        en: "Let's raise the next release together.",
      },
    },
    work: WORK,
  },
  researcher: {
    persona: 'researcher',
    stone: {
      shape: [2, 8],
      radii: [0.8, 1.4, 0.8],
      disp: 0.01,
      noiseFreq: NOISE_FREQ,
      seed: SEED,
      surface: 'ice',
    },
    cap: { pattern: 'rings', ringWarp: RING_WARP, ringsSource: 'publications' },
    palette: 'emaye',
    // Editoryal fontlar §6.2 hattına eklenene kadar tip katmanı `hassas`'a düşer ve uyarı yazar (§4.17.2).
    type: 'editoryal',
    intensity: 'calm',
    labels: {
      eyebrows: EYEBROWS,
      areas: { tr: 'Araştırma alanları', en: 'Research areas' },
      work: { tr: 'Yayınlar ve projeler', en: 'Publications and projects' },
      contactLead: {
        tr: 'Bir sonraki sürümü birlikte araştıralım.',
        en: "Let's research the next release together.",
      },
    },
    work: WORK,
  },
  manager: {
    persona: 'manager',
    stone: {
      shape: [2, 8],
      radii: [1, 0.42, 1],
      disp: 0.02,
      noiseFreq: NOISE_FREQ,
      seed: SEED,
      surface: 'oak',
    },
    cap: { pattern: 'growth', ringWarp: RING_WARP, ringsSource: 'teamSize' },
    palette: 'atolye',
    type: 'hassas',
    intensity: 'calm',
    labels: {
      eyebrows: EYEBROWS,
      areas: { tr: 'Liderlik alanları', en: 'Areas of leadership' },
      work: { tr: 'Ekipler ve sonuçlar', en: 'Teams and outcomes' },
      contactLead: {
        tr: 'Bir sonraki sürümü birlikte büyütelim.',
        en: "Let's grow the next release together.",
      },
    },
    work: WORK,
  },
};

/** Font hattında (§6.2.3) bulunan tip preset'leri. `editoryal` fontları eklenince listeye girer (§6.2.8). */
export const AVAILABLE_TYPE_PRESETS: readonly TypePreset[] = ['hassas'];

/**
 * K-PERSONA-4: preset'in fontları yoksa `hassas`'a düşülür; build başarısız olmaz, uyarı yazılır (§4.17.2).
 */
export function resolveTypePreset(type: TypePreset): TypePreset {
  if (AVAILABLE_TYPE_PRESETS.includes(type)) return type;
  console.warn(`[profile] "${type}" tip preset'inin fontları yok; "hassas" kullanılıyor (§6.2.8).`);
  return 'hassas';
}

/** Bilinmeyen değer → PROFILES.engineer (D-35 varsayılanı). */
export function getExperienceProfile(persona: Persona): ExperienceProfile {
  return Object.hasOwn(PROFILES, persona) ? PROFILES[persona] : PROFILES.engineer;
}
