// src/app/(tr)/projeler/page.tsx — M2 kabuğu (§15.3.1 #6); M3'te §3.4.3 kalıbıyla (içerik, pageLocales, staticPageMetadata) değiştirilir.
import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/get-dictionary';
import { ProjectsView } from '@/views/projects/ProjectsView';

export const metadata: Metadata = { title: getDictionary('tr').meta.projects };

export default function Page() {
  return <ProjectsView locale="tr" />;
}
