// src/views/about/AboutView.tsx — /hakkimda gövdesi: about.<dil>.mdx (§7.1.1, §7.7.2). Server.
import { KodPanel } from '@/components/kod/KodPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { MdxBody } from '@/components/mdx/MdxBody';
import { JsonLd } from '@/components/seo/JsonLd';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getKodData, getPageBody, getStageData, getTestimonials } from '@/lib/content';
import { jsonLdFor } from '@/lib/seo/jsonld';
import { StagePreset } from '@/stage/StagePreset';

export function AboutView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const body = getPageBody('about', locale);
  if (!body) throw new Error(`AboutView: about.${locale}.mdx yok`);
  const graph = jsonLdFor({ key: 'about' }, locale);
  return (
    <>
      {graph ? <JsonLd graph={graph} /> : null}
      <StagePreset name="about-page" data={getStageData('about-page', undefined, locale)} />
      <PageHeader
        pageRef={{ key: 'about' }}
        locale={locale}
        title={dict.meta.about}
        lede={body.lede}
        folio={{
          preset: 'about-page',
          figure: (
            <KodPanel
              data={getKodData('about-page', undefined, locale)}
              program={{ kind: 'about', reveal: 1 }}
            />
          ),
        }}
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
