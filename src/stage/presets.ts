// src/stage/presets.ts — preset kaydı (§5.9.10). M4: home ve none. D1–D5 (folio, plan-small, cv-core,
// about-page, contact-page) M7'de eklenir; kayıtta olmayan preset 'none' gibi davranır.
import type { AnchorId } from './anchors';
import type { KeyframeKey } from './keyframes';
import type { PresetName } from './store';

export interface PresetDef {
  /** taban anahtarı (§5.9.3 adım 1); null = sahne yok (opacityTrack 0) */
  base: KeyframeKey | null;
  anchors: readonly AnchorId[];
  events: ReadonlyArray<'areas' | 'work' | 'journey' | 'cv'>;
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
  },
  none: { base: null, anchors: [], events: [] },
};

export const presetDef = (name: PresetName): PresetDef =>
  PRESETS[name] ?? (PRESETS.none as PresetDef);
