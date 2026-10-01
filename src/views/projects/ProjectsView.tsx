// src/views/projects/ProjectsView.tsx — /projeler (§7.8). Server; liste sunucuda tam çizilir.
// ?alan= yalnız istemcide okunur (D-06): ProjectFilter sunucuda "Tümü" ile çizilir, JS'siz görünümde gizlidir.
import { DialFigure } from '@/components/figures/DialFigure';
import { PageHeader } from '@/components/layout/PageHeader';
import { JsonLd } from '@/components/seo/JsonLd';
import { ProjectFilter } from '@/components/ui/ProjectFilter';
import { ProjectRow } from '@/components/ui/ProjectRow';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getAreas, getProjects, getStageData, t } from '@/lib/content';
import { jsonLdFor } from '@/lib/seo/jsonld';
import { previewAttrs } from '@/stage/preview-attrs';
import { StagePreset } from '@/stage/StagePreset';
import { FloatingPreview } from '@/components/ui/FloatingPreview';

export function ProjectsView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const projects = getProjects(locale);
  const graph = jsonLdFor({ key: 'projects' }, locale);
  const stage = getStageData('plan-small', undefined, locale); // D2 (§4.13.2)
  const previewOf = (slug: string) => {
    const s = stage.projects.find((x) => x.slug === slug);
    return { band: s?.band, sector: s?.area };
  };
  const areas = getAreas()
    .map((a, k) => {
      const title = t(a.title, locale);
      return {
        id: a.id,
        title: title.text,
        lang: title.fallback ? title.lang : undefined,
        count: projects.filter((p) => p.areas.includes(a.id)).length,
        sector: stage.sectors > 0 ? k : null,
      };
    })
    .filter((a) => a.count > 0); // projesi olmayan alanın çipi çizilmez (§7.8.2)

  return (
    <>
      {graph ? <JsonLd graph={graph} /> : null}
      <StagePreset name="plan-small" data={stage} />
      <PageHeader
        pageRef={{ key: 'projects' }}
        locale={locale}
        title={dict.meta.projects}
        folio={{
          preset: 'plan-small',
          narrow: true,
          figure: (
            <DialFigure
              n={stage.sectors}
              rings={stage.rings}
              active={null}
              ariaLabel=""
              className="anchor-figure"
            />
          ),
        }}
      />
      <div className="container-page pt-block pb-section">
        {projects.length === 0 ? (
          <p className="type-body text-ink-muted">{dict.projects.empty}</p>
        ) : (
          <>
            <ProjectFilter
              locale={locale}
              areas={areas}
              total={projects.length}
              labels={{
                group: dict.a11y.filterGroup,
                all: dict.projects.filterAll,
                count: dict.projects.count,
              }}
            />
            <div>
              <ul className="mt-stack border-t border-line">
                {projects.map((p) => (
                  <ProjectRow
                    key={p.slug}
                    project={p}
                    locale={locale}
                    preview={previewAttrs(previewOf(p.slug))}
                  />
                ))}
              </ul>
              <FloatingPreview
                images={projects.map((p) => {
                  const img = p.preview ?? p.cover;
                  return {
                    slug: p.slug,
                    src: img.src,
                    width: img.width,
                    height: img.height,
                    dominant: img.dominant,
                  };
                })}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
