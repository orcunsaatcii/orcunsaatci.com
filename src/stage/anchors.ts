// src/stage/anchors.ts — sahne çapası tipleri ve ANCHORS kaydı (§5.7.3).
// DOM öznitelikleri bu kayıttan üretilir (StageAnchor). measureAnchors() ve anchorScreen() M5'te eklenir;
// MeasuredAnchor tipi M4'te director'ün Layout'u için buradadır (liste M4'te boştur).

export type AnchorId =
  | 'hero-rest'
  | 'about-cut'
  | 'areas-dial'
  | 'work-specimen'
  | 'journey-core'
  | 'contact-ring'
  | 'page-folio'
  | 'cv-core';

export type AnchorKind = 'viewport' | 'flow' | 'sticky';

export interface AnchorDef {
  id: AnchorId;
  kind: AnchorKind; // ≥ 64rem (DOM'daki data-anchor-kind ile aynı)
  kindMobile: AnchorKind | null; // < 64rem; null = bu genişlikte anchor yok (sahne sönük)
  size: number; // ≥ 64rem sizeFrac (DOM data-anchor-size varsayılanı)
  sizeMobile: number; // 0.86
  align: 'center' | 'bottom';
  rule?: 'hero'; // D = min(0.68·w, h − 24) (yalnız ≥ 64rem)
}

// prettier-ignore
export const ANCHORS: Readonly<Record<AnchorId, AnchorDef>> = {
  'hero-rest':     { id: 'hero-rest',     kind: 'flow',     kindMobile: 'flow',   size: 0.8,  sizeMobile: 0.86, align: 'bottom', rule: 'hero' },
  'about-cut':     { id: 'about-cut',     kind: 'flow',     kindMobile: 'flow',   size: 0.72, sizeMobile: 0.86, align: 'center' },
  'areas-dial':    { id: 'areas-dial',    kind: 'sticky',   kindMobile: 'sticky', size: 0.8,  sizeMobile: 0.86, align: 'center' },
  'work-specimen': { id: 'work-specimen', kind: 'sticky',   kindMobile: null,     size: 0.72, sizeMobile: 0.86, align: 'center' },
  'journey-core':  { id: 'journey-core',  kind: 'sticky',   kindMobile: 'flow',   size: 0.8,  sizeMobile: 0.86, align: 'center' },
  'contact-ring':  { id: 'contact-ring',  kind: 'viewport', kindMobile: 'flow',   size: 0.8,  sizeMobile: 0.86, align: 'center' },
  'page-folio':    { id: 'page-folio',    kind: 'flow',     kindMobile: 'flow',   size: 0.7,  sizeMobile: 0.86, align: 'center' },
  'cv-core':       { id: 'cv-core',       kind: 'sticky',   kindMobile: null,     size: 0.8,  sizeMobile: 0.86, align: 'center' },
};

/** page-folio'nun preset başına boyutu (§5.7.3 tablosu) */
export const PAGE_FOLIO_SIZE = {
  folio: 0.7,
  'plan-small': 0.8,
  'about-page': 0.72,
  'contact-page': 0.8,
} as const;

/** Ölçülmüş anchor (§5.7.4). M4'te Layout.anchors boştur; alanlar M5'te measureAnchors() ile doldurulur. */
export interface MeasuredAnchor {
  id: AnchorId;
  kind: AnchorKind;
  /** belge koordinatında dikdörtgen (px) */
  docTop: number;
  docLeft: number;
  width: number;
  height: number;
  size: number; // sizeFrac
  align: 'center' | 'bottom';
}
