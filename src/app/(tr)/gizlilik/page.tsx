// src/app/(tr)/gizlilik/page.tsx — §3.4.3 kalıbı (TR her zaman üretilir).
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/metadata';
import { PrivacyView } from '@/views/privacy/PrivacyView';
import { PageTransition } from '@/components/motion/PageTransition';

export const metadata: Metadata = staticPageMetadata({ key: 'privacy' }, 'tr');

export default function Page() {
  return (
    <PageTransition>
      <PrivacyView locale="tr" />
    </PageTransition>
  );
}
