// src/views/area/AreaView.tsx — tek alan sayfası (§7.8.5; features.areaPages + hasPage). Server.
// Sıra: breadcrumb, <h1>, lede (frontmatter ya da summary), MDX gövdesi, yetkinlikler, ilgili beceriler,
// bu alandaki projeler (kartlar), varsa ilgili referans, iletişim CTA'sı.
import { DialFigure } from '@/components/figures/DialFigure';
import { PageHeader } from '@/components/layout/PageHeader';
import { MdxBody } from '@/components/mdx/MdxBody';
import { JsonLd } from '@/components/seo/JsonLd';
import { Button } from '@/components/ui/Button';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { Txt } from '@/components/ui/Txt';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import {
  getAreaBody,
  getCv,
  getProjects,
  getStageData,
  getTestimonials,
  t,
  type AreaDoc,
} from '@/lib/content';
import { jsonLdFor } from '@/lib/seo/jsonld';
import { pageLink } from '@/lib/seo/metadata';
import { StagePreset } from '@/stage/StagePreset';

export function AreaView({ area, locale }: { area: AreaDoc; locale: Locale }) {
  const dict = getDictionary(locale);
  const body = getAreaBody(area.id, locale);
  if (!body) throw new Error(`AreaView: areas/${area.id}.${locale}.mdx yok`);
  const title = t(area.title, locale);
  const projects = getProjects(locale, { area: area.id });
  const skills = getCv(locale).sections.flatMap((s) =>
    s.key === 'skills' ? s.entries.flatMap((g) => g.skills) : [],
  );
  const areaSkills = skills.filter((k) => area.skills.includes(k.id));
  const projectSlugs = new Set(projects.map((p) => p.slug));
  const testimonial = getTestimonials(locale, { featured: true }).find(
    (x) => x.project !== undefined && projectSlugs.has(x.project),
  );
  const contact = pageLink({ key: 'contact' }, locale);
  const graph = jsonLdFor({ key: 'area', param: area.id }, locale);
  const stage = getStageData('plan-small', area.id, locale); // D2, kadran ψ(alan)'a dönük (§4.13.2)

  return (
    <>
      {graph ? <JsonLd graph={graph} /> : null}
      <StagePreset name="plan-small" data={stage} />
      <PageHeader
        pageRef={{ key: 'area', param: area.id }}
        locale={locale}
        title={title.text}
        titleLang={title.fallback ? title.lang : undefined}
        crumbTitle={title.text}
        lede={body.lede ?? <Txt v={t(area.summary, locale)} />}
        folio={{
          preset: 'plan-small',
          narrow: true,
          figure: (
            <DialFigure
              n={stage.sectors}
              rings={stage.rings}
              active={stage.activeArea ?? null}
              ariaLabel=""
              className="anchor-figure"
            />
          ),
        }}
      />
      <div className="container-page flex flex-col gap-block pt-block pb-section">
        <MdxBody
          code={body.mdx}
          ctx={{ locale, media: body.media, testimonials: getTestimonials(locale) }}
        />
        {area.capabilities.length ? (
          <section aria-labelledby="capabilities-title">
            <h2 id="capabilities-title" className="type-h2">
              {dict.area.capabilities}
            </h2>
            <ul className="mt-stack type-body list-disc space-y-1 pl-5">
              {area.capabilities.map((c, i) => (
                <li key={i}>
                  <Txt v={t(c, locale)} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {areaSkills.length ? (
          <section aria-labelledby="skills-title">
            <h2 id="skills-title" className="type-h2">
              {dict.area.skills}
            </h2>
            <p className="mt-stack type-body">
              {areaSkills.map((k, j) => (
                <span key={k.id}>
                  {j > 0 ? ', ' : ''}
                  <Txt v={t(k.name, locale)} />
                </span>
              ))}
            </p>
          </section>
        ) : null}
        {projects.length ? (
          <section aria-labelledby="area-projects-title">
            <h2 id="area-projects-title" className="type-h2">
              {dict.area.projects}
            </h2>
            <div className="mt-stack grid gap-gutter md:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard key={p.slug} project={p} locale={locale} />
              ))}
            </div>
          </section>
        ) : null}
        {testimonial ? (
          <figure className="rounded-md bg-surface p-6">
            <blockquote lang={t(testimonial.quote, locale).lang} className="type-h4 font-medium">
              <p>{t(testimonial.quote, locale).text}</p>
            </blockquote>
            <figcaption className="mt-4 type-meta">
              {testimonial.author}, <Txt v={t(testimonial.role, locale)} />
            </figcaption>
          </figure>
        ) : null}
        <section className="flex flex-col items-start gap-4 border-t border-line pt-block">
          <p className="type-lead">{dict.contact.cta}</p>
          <Button href={contact.href} hrefLang={contact.hrefLang} variant="secondary">
            {dict.hero.ctaSecondary}
            {contact.fallback ? dict.lang.trSuffix : null}
          </Button>
        </section>
      </div>
    </>
  );
}
