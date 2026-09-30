// src/components/ui/hit-area.ts — tek başına duran satır içi bağlantılar için 44 px vuruş alanı (§6.4.5, WCAG 2.5.8).
// `inline-block` sınıfı KULLANILMAZ: `--spacing-block` token'ı yüzünden Tailwind v4 aynı sınıfa `inline-size:
// var(--spacing-block)` da üretir (SPEC-SAPMA §6.4); görünüm `[display:inline-block]` ile verilir.
// flex değil satır içi blok: metin sarmalanabilir. Dikey dolgu kutuyu 44 px'e tamamlar; min-h alt piksel yuvarlamasını örter.
// min-w YOK: flex öğesinde açık min-width otomatik en küçük genişliği (min-content) ezer, metin kutudan taşar.
// Kısa etiketli bağlantıda (ör. "X") genişlik kapsayıcı öğede ya da ayrıca min-w-11 ile verilir.
// bg-origin-content: link-inline alt çizgisi (arka plan) dolgunun değil metnin altında kalır.
export const HIT_AREA =
  '[display:inline-block] min-h-11 bg-origin-content py-[calc((2.75rem-1lh)/2)]';

/** Aynı alan, satır yüksekliği değişmeden (negatif dikey marj): breadcrumb gibi sıkı satırlar için */
export const HIT_AREA_FLUSH = `${HIT_AREA} -my-[calc((2.75rem-1lh)/2)]`;
