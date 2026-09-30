// src/app/(tr)/cv/page.tsx — §3.4.3 kalıbı (TR her zaman üretilir).
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/metadata';
import { CvView } from '@/views/cv/CvView';

export const metadata: Metadata = staticPageMetadata({ key: 'cv' }, 'tr');

export default function Page() {
  return <CvView locale="tr" />;
}
