// src/views/privacy/PrivacyView.tsx — /gizlilik (§12.4.6): iki ayrı başlıklı kısım + "Son güncelleme". Server.
// noindex, follow; Stage preset none. Hukuki metin M9'da (avukat incelemesi).
import { PageHeader } from '@/components/layout/PageHeader';
import { MdxBody } from '@/components/mdx/MdxBody';
import { JsonLd } from '@/components/seo/JsonLd';
import type { Locale } from '@/i18n/config';
import { formatPartialDate } from '@/i18n/format';
import { getDictionary } from '@/i18n/get-dictionary';
import { fill } from '@/i18n/text';
import { getPageBody, getTestimonials } from '@/lib/content';
import { jsonLdFor } from '@/lib/seo/jsonld';

export function PrivacyView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const body = getPageBody('privacy', locale);
  if (!body) throw new Error(`PrivacyView: privacy.${locale}.mdx yok`);
  const graph = jsonLdFor({ key: 'privacy' }, locale);
  return (
    <>
      {graph ? <JsonLd graph={graph} /> : null}
      <PageHeader pageRef={{ key: 'privacy' }} locale={locale} title={dict.meta.privacy}>
        {body.updatedAt ? (
          <p className="mt-4 type-meta">
            {fill(dict.cv.updated, { date: formatPartialDate(body.updatedAt, locale) })}
          </p>
        ) : null}
      </PageHeader>
      <div className="container-page pt-block pb-section">
        <MdxBody
          code={body.mdx}
          ctx={{ locale, media: body.media, testimonials: getTestimonials(locale) }}
        />
      </div>
    </>
  );
}
