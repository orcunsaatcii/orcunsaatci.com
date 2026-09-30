// src/app/(tr)/hakkimda/page.tsx — M2 kabuğu (§15.3.1 #6); M3'te §3.4.3 kalıbıyla (içerik, pageLocales, staticPageMetadata) değiştirilir.
import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/get-dictionary';
import { AboutView } from '@/views/about/AboutView';

export const metadata: Metadata = { title: getDictionary('tr').meta.about };

export default function Page() {
  return <AboutView locale="tr" />;
}
