// src/app/(tr)/calisma-alanlari/page.tsx — §3.4.3 kalıbı (TR her zaman üretilir).
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/metadata';
import { ExpertiseView } from '@/views/expertise/ExpertiseView';
import { PageTransition } from '@/components/motion/PageTransition';

export const metadata: Metadata = staticPageMetadata({ key: 'expertise' }, 'tr');

export default function Page() {
  return (
    <PageTransition>
      <ExpertiseView locale="tr" />
    </PageTransition>
  );
}
