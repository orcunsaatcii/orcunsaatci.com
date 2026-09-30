// src/views/projects/ProjectsView.tsx — /projeler (§7.8). Server; liste sunucuda tam çizilir.
// ?alan= yalnız istemcide okunur (D-06): ProjectFilter <Suspense fallback={null}> içinde; JS'siz çip yoktur.
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { JsonLd } from '@/components/seo/JsonLd';
import { ProjectFilter } from '@/components/ui/ProjectFilter';
import { ProjectRow } from '@/components/ui/ProjectRow';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getAreas, getProjects, t } from '@/lib/content';
import { jsonLdFor } from '@/lib/seo/jsonld';

export function ProjectsView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const projects = getProjects(locale);
  const graph = jsonLdFor({ key: 'projects' }, locale);
  const areas = getAreas()
    .map((a) => {
      const title = t(a.title, locale);
      return {
        id: a.id,
        title: title.text,
        lang: title.fallback ? title.lang : undefined,
        count: projects.filter((p) => p.areas.includes(a.id)).length,
      };
    })
    .filter((a) => a.count > 0); // projesi olmayan alanın çipi çizilmez (§7.8.2)

  return (
    <>
      {graph ? <JsonLd graph={graph} /> : null}
      <PageHeader pageRef={{ key: 'projects' }} locale={locale} title={dict.meta.projects} />
      <div className="container-page pt-block pb-section">
        {projects.length === 0 ? (
          <p className="type-body text-ink-muted">{dict.projects.empty}</p>
        ) : (
          <>
            <Suspense fallback={null}>
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
            </Suspense>
            <ul className="mt-stack border-t border-line">
              {projects.map((p) => (
                <ProjectRow key={p.slug} project={p} locale={locale} />
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
