// src/app/en/privacy/page.tsx — §3.4.3 kalıbı: EN varlığı içeriğe bağlı (pageLocales, §7.4.3); yoksa build'de notFound() (V-21).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pageLocales } from '@/lib/content';
import { staticPageMetadata } from '@/lib/seo/metadata';
import { PrivacyView } from '@/views/privacy/PrivacyView';
import { PageTransition } from '@/components/motion/PageTransition';

const ref = { key: 'privacy' } as const;

export function generateMetadata(): Metadata {
  return pageLocales(ref).includes('en') ? staticPageMetadata(ref, 'en') : {};
}

export default function Page() {
  if (!pageLocales(ref).includes('en')) notFound();
  return (
    <PageTransition>
      <PrivacyView locale="en" />
    </PageTransition>
  );
}
