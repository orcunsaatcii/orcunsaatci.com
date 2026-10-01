// src/app/(tr)/iletisim/page.tsx — §3.4.3 kalıbı (TR her zaman üretilir).
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/metadata';
import { ContactView } from '@/views/contact/ContactView';
import { PageTransition } from '@/components/motion/PageTransition';

export const metadata: Metadata = staticPageMetadata({ key: 'contact' }, 'tr');

export default function Page() {
  return (
    <PageTransition>
      <ContactView locale="tr" />
    </PageTransition>
  );
}
