// src/stage/anchors.ts — sahne çapası tipleri (§5.7.3).
// M1'de yalnız kimlikler vardır (keyframes.ts kullanır). ANCHORS kaydı, measureAnchors() ve
// anchorScreen() M5'te eklenir.

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
