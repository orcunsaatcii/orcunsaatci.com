// src/views/expertise/ExpertiseView.tsx — /calisma-alanlari gövdesi. M2 kabuğu (§15.3.1 #6); içerik M3'te.
// H1 persona etiketidir (labels.areas, §4.17, §7.8.5); <title> ve breadcrumb dict.meta.expertise kalır (§11.2.2).
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { getExperienceProfile } from '@/experience/profile';
import type { Locale } from '@/i18n/config';

// Geçici (§15.0.6): M3'te getSite().persona'ya bağlanır
const PERSONA = 'engineer';

export function ExpertiseView({ locale }: { locale: Locale }) {
  const { labels } = getExperienceProfile(PERSONA);
  return (
    <div className="container-page pt-block pb-section">
      <Breadcrumbs pageRef={{ key: 'expertise' }} locale={locale} />
      <h1 className="mt-stack type-h1">{labels.areas[locale]}</h1>
    </div>
  );
}
