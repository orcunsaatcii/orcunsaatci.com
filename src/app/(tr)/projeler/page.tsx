// src/app/(tr)/projeler/page.tsx — §3.4.3 kalıbı (TR her zaman üretilir).
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/metadata';
import { ProjectsView } from '@/views/projects/ProjectsView';

export const metadata: Metadata = staticPageMetadata({ key: 'projects' }, 'tr');

export default function Page() {
  return <ProjectsView locale="tr" />;
}
