// src/stage/anchors.ts — sahne çapaları: ANCHORS kaydı ve ölçüm (§5.7.3–§5.7.4). Three-free. DOM öznitelikleri bu
// kayıttan üretilir (StageAnchor). Ölçüm YALNIZ refresh'te (§5.7.4). Kare başına ekran dikdörtgeni ve analitik ölçek
// anchor-screen.ts'tedir (yalnız sahne chunk'ı kullanır; ilk pakete girmez).

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

/** Refresh'te üretilir; kare başına yalnız aritmetik (§5.7.3). */
export interface MeasuredAnchor {
  id: AnchorId;
  slot: number; // aynı id'nin DOM sırası (page-folio: 0 başlık, 1 "Sonraki proje")
  kind: AnchorKind;
  size: number;
  align: 'center' | 'bottom';
  rule?: 'hero';
  left: number;
  width: number;
  height: number;
  docTop: number; // flow / sticky: belge koordinatı
  chapterOffsetTop?: number; // viewport: bölüm üstüne göre ofset
  sticky?: { naturalDocTop: number; top: number; height: number; containerDocBottom: number };
}

/** Ata zincirinde (öğenin kendisi dahil) ilk sticky öğe */
function stickyAncestor(el: HTMLElement): HTMLElement | null {
  for (let x: HTMLElement | null = el; x; x = x.parentElement) {
    if (getComputedStyle(x).position === 'sticky') return x;
  }
  return null;
}

/**
 * §5.7.4: anchor dikdörtgenleri belge koordinatında. Sticky kapsayıcı geçici olarak `position: static` yapılarak
 * doğal konumu okunur (aynı senkron görevde; arada boyama yok). Görünmeyen / kindMobile null anchor atlanır.
 */
export function measureAnchors(root: ParentNode, mobile: boolean): MeasuredAnchor[] {
  const out: MeasuredAnchor[] = [];
  const slots = new Map<AnchorId, number>();
  const y = window.scrollY;
  for (const el of root.querySelectorAll<HTMLElement>('[data-stage-anchor]')) {
    const id = el.dataset.stageAnchor as AnchorId;
    const def = ANCHORS[id];
    if (!def) continue;
    const kind = mobile ? def.kindMobile : def.kind;
    if (!kind) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue; // display: none, liste modu
    const slot = slots.get(id) ?? 0;
    slots.set(id, slot + 1);
    const a: MeasuredAnchor = {
      id,
      slot,
      kind,
      size: mobile ? def.sizeMobile : Number(el.dataset.anchorSize) || def.size,
      align: mobile ? 'center' : def.align,
      ...(mobile || !def.rule ? {} : { rule: def.rule }),
      left: r.left,
      width: r.width,
      height: r.height,
      docTop: r.top + y,
    };
    if (kind === 'viewport') {
      const chapter = el.closest('[data-chapter]');
      a.chapterOffsetTop = chapter ? a.docTop - (chapter.getBoundingClientRect().top + y) : 0;
    } else if (kind === 'sticky') {
      const S = stickyAncestor(el);
      if (S) {
        const top = Number.parseFloat(getComputedStyle(S).top) || 0; // ÖNCE okunur
        // Çapanın S içindeki ofseti sticky hâlde ölçülür (yapışıkken de aynı). static'te S konumlandırılmış kapsayıcı
        // olmaktan çıkar: position: absolute torunlar (masaüstü .areas-dial) belgeye göre yerleşir, okunmaz.
        const offset = r.top - S.getBoundingClientRect().top;
        const prev = S.style.position;
        S.style.position = 'static';
        const sr = S.getBoundingClientRect();
        a.docTop = sr.top + y + offset;
        const parent = S.parentElement;
        const pb = parent ? Number.parseFloat(getComputedStyle(parent).paddingBottom) || 0 : 0;
        const bottom = parent ? parent.getBoundingClientRect().bottom + y - pb : sr.bottom + y;
        a.sticky = {
          naturalDocTop: sr.top + y,
          top,
          height: sr.height,
          containerDocBottom: bottom,
        };
        S.style.position = prev;
      }
    }
    out.push(a);
  }
  return out;
}
