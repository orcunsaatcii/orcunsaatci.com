// src/stage/preview-attrs.ts — hover-to-scene öznitelikleri (§4.14 #3). Sunucu bileşenleri [data-preview] öğelerine
// bant (halka aralığı) ve/veya dilim indeksi yazar; istemcide ScenePreviews okur. Saf; sunucu ve istemcide çalışır.

export interface PreviewSpec {
  band?: readonly [number, number] | null;
  sector?: number | null;
}

/** Önizlemesi olmayan öğe için boş nesne döner (öznitelik yazılmaz) */
export function previewAttrs(p: PreviewSpec): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.band) out['data-preview-band'] = `${p.band[0]},${p.band[1]}`;
  if (p.sector !== null && p.sector !== undefined && p.sector >= 0)
    out['data-preview-sector'] = String(p.sector);
  if (Object.keys(out).length) out['data-preview'] = '';
  return out;
}
