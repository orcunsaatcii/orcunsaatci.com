// src/app/(tr)/hakkimda/page.tsx — §3.4.3 kalıbı (TR her zaman üretilir).
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/metadata';
import { AboutView } from '@/views/about/AboutView';

export const metadata: Metadata = staticPageMetadata({ key: 'about' }, 'tr');

export default function Page() {
  return <AboutView locale="tr" />;
}
