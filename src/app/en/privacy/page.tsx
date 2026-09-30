// src/app/en/privacy/page.tsx — M2 kabuğu (§15.3.1 #6); M3'te §3.4.3 kalıbıyla (içerik, pageLocales, staticPageMetadata) değiştirilir.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/get-dictionary';
import { getSite } from '@/lib/content';
import { PrivacyView } from '@/views/privacy/PrivacyView';

export const metadata: Metadata = {
  title: getDictionary('en').meta.privacy,
  robots: { index: false, follow: true },
};

export default function Page() {
  if (!getSite().locales.includes('en')) notFound();
  return <PrivacyView locale="en" />;
}
