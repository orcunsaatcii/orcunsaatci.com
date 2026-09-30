// src/views/about/AboutView.tsx — /hakkimda gövdesi: about.<dil>.mdx (§7.1.1, §7.7.2). Server.
import { PageHeader } from '@/components/layout/PageHeader';
import { MdxBody } from '@/components/mdx/MdxBody';
import { JsonLd } from '@/components/seo/JsonLd';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getPageBody, getTestimonials } from '@/lib/content';
import { jsonLdFor } from '@/lib/seo/jsonld';

export function AboutView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const body = getPageBody('about', locale);
  if (!body) throw new Error(`AboutView: about.${locale}.mdx yok`);
  const graph = jsonLdFor({ key: 'about' }, locale);
  return (
    <>
      {graph ? <JsonLd graph={graph} /> : null}
      <PageHeader
        pageRef={{ key: 'about' }}
        locale={locale}
        title={dict.meta.about}
        lede={body.lede}
        folio={{ preset: 'about-page', poster: 'k1' }}
      />
      <div className="container-page pt-block pb-section">
        <MdxBody
          code={body.mdx}
          ctx={{ locale, media: body.media, testimonials: getTestimonials(locale) }}
        />
      </div>
    </>
  );
}
