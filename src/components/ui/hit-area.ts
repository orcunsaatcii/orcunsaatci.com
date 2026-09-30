// src/components/ui/hit-area.ts — tek başına duran satır içi bağlantılar için 44 px vuruş alanı (§6.4.5, WCAG 2.5.8).
// flex değil inline-block: metin sarmalanabilir. Dikey dolgu kutuyu 44 px'e tamamlar; min-h alt piksel yuvarlamasını örter.
export const HIT_AREA = 'inline-block min-h-11 min-w-11 py-[calc((2.75rem-1lh)/2)]';

/** Aynı alan, satır yüksekliği değişmeden (negatif dikey marj): breadcrumb gibi sıkı satırlar için */
export const HIT_AREA_FLUSH = `${HIT_AREA} -my-[calc((2.75rem-1lh)/2)]`;
