// src/app/(tr)/gizlilik/page.tsx — M2 kabuğu (§15.3.1 #6); M3'te §3.4.3 kalıbıyla (içerik, pageLocales, staticPageMetadata) değiştirilir.
import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/get-dictionary';
import { PrivacyView } from '@/views/privacy/PrivacyView';

export const metadata: Metadata = {
  title: getDictionary('tr').meta.privacy,
  robots: { index: false, follow: true },
};

export default function Page() {
  return <PrivacyView locale="tr" />;
}
