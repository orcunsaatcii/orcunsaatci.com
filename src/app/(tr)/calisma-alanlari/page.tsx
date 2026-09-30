// src/app/(tr)/calisma-alanlari/page.tsx — §3.4.3 kalıbı (TR her zaman üretilir).
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/metadata';
import { ExpertiseView } from '@/views/expertise/ExpertiseView';

export const metadata: Metadata = staticPageMetadata({ key: 'expertise' }, 'tr');

export default function Page() {
  return <ExpertiseView locale="tr" />;
}
