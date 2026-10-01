// src/stage/presets.ts — preset kaydı (§5.9.10): taban anahtarı, çapalar, event türleri, okuma modu ve kaydırma
// dönüşü. Kayıtta olmayan preset 'none' gibi davranır.
import type { AnchorId } from './anchors';
import type { KeyframeKey } from './keyframes';
import type { PresetName } from './store';

export interface PresetDef {
  /** taban anahtarı (§5.9.3 adım 1); null = sahne yok (opacityTrack 0) */
  base: KeyframeKey | null;
  anchors: readonly AnchorId[];
  events: ReadonlyArray<'areas' | 'work' | 'journey' | 'cv' | 'folio' | 'filter'>;
  /** okuma modu (§4.13.1): slot 0 bloğu görünümden çıkınca opacityReading → 0 (300 ms) */
  reading: boolean;
  /** kaydırma dönüşü, derece (§5.9.10): folio başlık bloğu görünürken, cv-core sayfa boyunca */
  turn?: number;
}

export const PRESETS: Readonly<Partial<Record<PresetName, PresetDef>>> = {
  home: {
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
    reading: false,
  },
  folio: { base: 'folio', anchors: ['page-folio'], events: ['folio'], reading: true, turn: 20 },
  'plan-small': { base: 'plan-small', anchors: ['page-folio'], events: ['filter'], reading: true },
  'cv-core': { base: 'cv-core', anchors: ['cv-core'], events: ['cv'], reading: false, turn: 60 },
  'about-page': { base: 'about-page', anchors: ['page-folio'], events: [], reading: true },
  'contact-page': { base: 'contact-page', anchors: ['page-folio'], events: [], reading: false },
  none: { base: null, anchors: [], events: [], reading: false },
};

export const presetDef = (name: PresetName): PresetDef =>
  PRESETS[name] ?? (PRESETS.none as PresetDef);
