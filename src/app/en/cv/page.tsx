// src/app/en/cv/page.tsx — §3.4.3 kalıbı: EN varlığı içeriğe bağlı (pageLocales, §7.4.3); yoksa build'de notFound() (V-21).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pageLocales } from '@/lib/content';
import { staticPageMetadata } from '@/lib/seo/metadata';
import { CvView } from '@/views/cv/CvView';
import { PageTransition } from '@/components/motion/PageTransition';

const ref = { key: 'cv' } as const;

export function generateMetadata(): Metadata {
  return pageLocales(ref).includes('en') ? staticPageMetadata(ref, 'en') : {};
}

export default function Page() {
  if (!pageLocales(ref).includes('en')) notFound();
  return (
    <PageTransition>
      <CvView locale="en" />
    </PageTransition>
  );
}
