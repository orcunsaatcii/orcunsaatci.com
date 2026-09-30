// src/views/project/ProjectView.tsx — yalın proje sayfası (§7.7.1, D-48). M2 kabuğu: generateStaticParams boş
// döndüğü için render edilmez; M3'te imza { project, locale } olur ve başlık içerikten gelir.
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import type { Locale } from '@/i18n/config';

export function ProjectView({ slug, locale }: { slug: string; locale: Locale }) {
  return (
    <div className="container-page pt-block pb-section">
      <Breadcrumbs pageRef={{ key: 'project', param: slug }} locale={locale} title={slug} />
      <h1 className="mt-stack type-h1">{slug}</h1>
    </div>
  );
}
