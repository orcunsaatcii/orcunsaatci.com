// src/app/(tr)/page.tsx — §3.4.3 kalıbı (TR her zaman üretilir).
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/metadata';
import { HomeView } from '@/views/home/HomeView';
import { PageTransition } from '@/components/motion/PageTransition';

export const metadata: Metadata = staticPageMetadata({ key: 'home' }, 'tr');

export default function Page() {
  return (
    <PageTransition>
      <HomeView locale="tr" />
    </PageTransition>
  );
}
