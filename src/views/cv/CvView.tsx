// src/views/cv/CvView.tsx — /cv gövdesi. M2 kabuğu: H1 sözlükten, gövde boş (§15.3.1 #6); içerik M3'te.
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';

export function CvView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  return (
    <div className="container-page pt-block pb-section">
      <Breadcrumbs pageRef={{ key: 'cv' }} locale={locale} />
      <h1 className="mt-stack type-h1">{dict.cv.title}</h1>
    </div>
  );
}
