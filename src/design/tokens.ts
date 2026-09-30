// src/design/tokens.ts — renk + hareket token'larının tek kaynağı (three-free; server ve client)
// globals.css aynı değerleri light-dark() ile bildirir; tokens.test.ts ikisini karşılaştırır.

export type PaletteName = 'mekanizma' | 'atolye' | 'emaye';
export type ThemeName = 'light' | 'dark';
export type Hex = `#${string}`;
export interface Rgba {
  readonly rgb: Hex;
  readonly alpha: number;
}

export interface ThemeColors {
  readonly canvas: Hex;
  readonly surface: Hex;
  readonly raised: Hex;
  readonly ink: Hex;
  readonly inkMuted: Hex;
  readonly inkSubtle: Hex;
  readonly inkDisabled: Hex;
  readonly line: Hex;
  readonly lineStrong: Hex;
  readonly accent: Hex;
  readonly accentHover: Hex;
  readonly onAccent: Hex;
  readonly focus: Hex;
  readonly brass: Hex;
  readonly success: Hex;
  readonly danger: Hex;
  readonly selection: Hex;
  readonly scrim: Rgba;
  readonly sceneStoneBase: Hex;
  readonly sceneStoneLight: Hex;
  readonly sceneSky: Hex;
  readonly sceneGround: Hex;
  readonly sceneShadow: Rgba;
}

export type ThemePair = Readonly<Record<ThemeName, ThemeColors>>;

/** ThemeColors anahtarı → globals.css özel özelliği */
export const cssVarOf = {
  canvas: '--color-canvas',
  surface: '--color-surface',
  raised: '--color-raised',
  ink: '--color-ink',
  inkMuted: '--color-ink-muted',
  inkSubtle: '--color-ink-subtle',
  inkDisabled: '--color-ink-disabled',
  line: '--color-line',
  lineStrong: '--color-line-strong',
  accent: '--color-accent',
  accentHover: '--color-accent-hover',
  onAccent: '--color-on-accent',
  focus: '--color-focus',
  brass: '--color-brass',
  success: '--color-success',
  danger: '--color-danger',
  selection: '--color-selection',
  scrim: '--color-scrim',
  sceneStoneBase: '--scene-stone-base',
  sceneStoneLight: '--scene-stone-light',
  sceneSky: '--scene-sky',
  sceneGround: '--scene-ground',
  sceneShadow: '--scene-shadow',
} as const satisfies Record<keyof ThemeColors, `--${string}`>;

const rgba = (rgb: Hex, alpha: number): Rgba => ({ rgb, alpha });

// Palet tabloları §6.10.3'teki satır düzeniyle okunur.
// prettier-ignore
export const palettes = {
  mekanizma: {
    light: {
      canvas: '#ECEEF2', surface: '#F7F8FA', raised: '#E0E4EB',
      ink: '#0E1530', inkMuted: '#454E6B', inkSubtle: '#5A6382', inkDisabled: '#8A91A6',
      line: '#CDD2DC', lineStrong: '#737C97',
      accent: '#B0103C', accentHover: '#8E0A30', onAccent: '#FFFFFF',
      focus: '#2340C4', brass: '#8A6420', success: '#11764A', danger: '#B42318', selection: '#F6C9D4',
      scrim: rgba('#ECEEF2', 0.85),
      sceneStoneBase: '#2B2F3A', sceneStoneLight: '#7C8292', sceneSky: '#FFFFFF', sceneGround: '#9AA1B2',
      sceneShadow: rgba('#0E1530', 0.16),
    },
    dark: {
      canvas: '#0B1020', surface: '#121833', raised: '#1A2244',
      ink: '#E8EBF2', inkMuted: '#A3ACC2', inkSubtle: '#8790AA', inkDisabled: '#5B6480',
      line: '#252E52', lineStrong: '#6B76A0',
      accent: '#FF7A95', accentHover: '#FF9AB0', onAccent: '#0B1020',
      focus: '#F2C46D', brass: '#C9A66B', success: '#5FD4A0', danger: '#FF8A7A', selection: '#5A2238',
      scrim: rgba('#0B1020', 0.85),
      sceneStoneBase: '#5E6577', sceneStoneLight: '#D3D8E2', sceneSky: '#E8EBF2', sceneGround: '#0B1020',
      sceneShadow: rgba('#000000', 0.45),
    },
  },
  atolye: {
    light: {
      canvas: '#E7E6E3', surface: '#F4F3F1', raised: '#DAD8D3',
      ink: '#1B1714', inkMuted: '#55504A', inkSubtle: '#67615A', inkDisabled: '#948E86',
      line: '#CCC9C2', lineStrong: '#878076',
      accent: '#7A5310', accentHover: '#5C3E0A', onAccent: '#FFFFFF',
      focus: '#1F4FD1', brass: '#8A6420', success: '#1E6B45', danger: '#A42A1C', selection: '#EBD3A6',
      scrim: rgba('#E7E6E3', 0.85),
      sceneStoneBase: '#3A342E', sceneStoneLight: '#8C8378', sceneSky: '#FFFFFF', sceneGround: '#A39B90',
      sceneShadow: rgba('#1B1714', 0.16),
    },
    dark: {
      canvas: '#141210', surface: '#1D1A17', raised: '#27231F',
      ink: '#EFE8DC', inkMuted: '#ADA496', inkSubtle: '#8F8778', inkDisabled: '#5F584F',
      line: '#34302A', lineStrong: '#6F675B',
      accent: '#E2B669', accentHover: '#EDCC8F', onAccent: '#141210',
      focus: '#9DB8FF', brass: '#C9A66B', success: '#7FD1A2', danger: '#FF8F7E', selection: '#5A4420',
      scrim: rgba('#141210', 0.85),
      sceneStoneBase: '#6E665C', sceneStoneLight: '#D8CFC2', sceneSky: '#EFE8DC', sceneGround: '#141210',
      sceneShadow: rgba('#000000', 0.45),
    },
  },
  emaye: {
    light: {
      canvas: '#F8F8F6', surface: '#FFFFFF', raised: '#EEEEEA',
      ink: '#0C1230', inkMuted: '#4A5068', inkSubtle: '#5E6580', inkDisabled: '#9A9EAD',
      line: '#DADBE0', lineStrong: '#868B9E',
      accent: '#1F3FCC', accentHover: '#17309E', onAccent: '#FFFFFF',
      focus: '#D22B3B', brass: '#9A6B17', success: '#11764A', danger: '#C21F32', selection: '#CDD6FF',
      scrim: rgba('#F8F8F6', 0.85),
      sceneStoneBase: '#262B3D', sceneStoneLight: '#7A8199', sceneSky: '#FFFFFF', sceneGround: '#9EA3B3',
      sceneShadow: rgba('#0C1230', 0.16),
    },
    dark: {
      canvas: '#0D0F17', surface: '#151826', raised: '#1D2133',
      ink: '#EEF0F6', inkMuted: '#A6ABBD', inkSubtle: '#8A90A5', inkDisabled: '#595E73',
      line: '#272B3D', lineStrong: '#666C85',
      accent: '#8FA4FF', accentHover: '#B3C1FF', onAccent: '#0D0F17',
      focus: '#FF6B78', brass: '#D9B26A', success: '#5FD4A0', danger: '#FF7A85', selection: '#2B3A7A',
      scrim: rgba('#0D0F17', 0.85),
      sceneStoneBase: '#5B6178', sceneStoneLight: '#D0D4E0', sceneSky: '#EEF0F6', sceneGround: '#0D0F17',
      sceneShadow: rgba('#000000', 0.45),
    },
  },
} as const satisfies Record<PaletteName, ThemePair>;

/** Sahne ve OG görselleri bu fonksiyonla okur (tema = <html data-theme>) */
export function themeColors(palette: PaletteName, theme: ThemeName): ThemeColors {
  return palettes[palette][theme];
}

/** Hex → "#RRGGBB", Rgba → "rgb(r g b / a)": globals.css'teki yazımın aynısı */
export function toCss(value: Hex | Rgba): string {
  // eslint-disable-next-line no-restricted-properties -- onaltılık renk ASCII'dir; §3.8'in Türkçe büyük harf kuralı metin içindir
  if (typeof value === 'string') return value.toUpperCase();
  const n = Number.parseInt(value.rgb.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${value.alpha})`;
}

export const motion = {
  /** cubic-bezier kontrol noktaları; CSS --ease-* ile aynı */
  ease: {
    standard: [0.2, 0, 0, 1],
    out: [0.22, 1, 0.36, 1],
    outExpo: [0.16, 1, 0.3, 1],
    inOut: [0.65, 0, 0.35, 1],
    in: [0.5, 0, 0.75, 0],
    tick: [0.34, 1.4, 0.64, 1],
  },
  /** GSAP karşılıkları. standard ve tick yalnız CSS geçişlerinde kullanılır (CustomEase yok) */
  gsapEase: {
    out: 'power4.out',
    outExpo: 'expo.out',
    inOut: 'power2.inOut',
    in: 'power3.in',
    scrub: 'none',
  },
  /** ms */
  dur: { instant: 90, fast: 160, base: 240, medium: 400, slow: 700, slower: 1000 },
  stagger: { line: 70, item: 50, maxItems: 6, maxTotal: 350 },
  /** px, yüzde veya derece */
  distance: {
    heroRise: 12,
    blockRise: 16,
    cardRise: 24,
    hoverLift: 2,
    revealLineFromYPercent: 130,
  },
} as const;

export const zIndex = { stage: 0, content: 10, header: 40, menu: 50, toast: 70, skip: 80 } as const;
