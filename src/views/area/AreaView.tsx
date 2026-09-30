// src/views/area/AreaView.tsx — tek alan sayfası (features.areaPages). M2 kabuğu: generateStaticParams boş
// döndüğü için render edilmez; M3'te imza { area, locale } olur ve başlık içerikten gelir.
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import type { Locale } from '@/i18n/config';

export function AreaView({ id, locale }: { id: string; locale: Locale }) {
  return (
    <div className="container-page pt-block pb-section">
      <Breadcrumbs pageRef={{ key: 'area', param: id }} locale={locale} title={id} />
      <h1 className="mt-stack type-h1">{id}</h1>
    </div>
  );
}
