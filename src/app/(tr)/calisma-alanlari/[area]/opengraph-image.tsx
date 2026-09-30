// src/app/(tr)/calisma-alanlari/[area]/opengraph-image.tsx
// Kök OG görselinin bu segmentte yeniden dışa aktarımı (SPEC-SAPMA §11.5.1): sayfa metadata'sı openGraph yazınca Next
// üst segmentin dosya tabanlı görselini düşürür (openGraph sığ birleşir); kök görsel burada yeniden bağlanır.
import { getAreaPageIds } from '@/lib/content';

export { alt, contentType, default, size } from '../../opengraph-image';
export const dynamicParams = false;

export function generateStaticParams() {
  return getAreaPageIds('tr').map((id) => ({ area: id }));
}
