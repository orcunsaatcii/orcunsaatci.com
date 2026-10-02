// src/views/expertise/ExpertiseView.tsx — /calisma-alanlari (§7.8.5). Server.
// H1 persona etiketi (labels.areas, §4.17); <title> ve breadcrumb dict.meta.expertise kalır (§11.2.2).
// Alan başına: indeks, <h2>, özet, açıklama, yetkinlikler, etiketler, ilgili beceriler ve bağlantı. Dilim glifi M4'te.
import type { Route } from 'next';
import Link from 'next/link';
import { KodPanel } from '@/components/kod/KodPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { JsonLd } from '@/components/seo/JsonLd';
import { Tag } from '@/components/ui/Tag';
import { Txt } from '@/components/ui/Txt';
import { getExperienceProfile } from '@/experience/profile';
import { pathOf, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { fill } from '@/i18n/text';
import {
  getAreaPageIds,
  getAreas,
  getCv,
  getHome,
  getKodData,
  getProjects,
  getSite,
  getStageData,
  t,
} from '@/lib/content';
import { jsonLdFor } from '@/lib/seo/jsonld';
import { pageLink } from '@/lib/seo/metadata';
import { StagePreset } from '@/stage/StagePreset';

export function ExpertiseView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const labels = getExperienceProfile(getSite().persona).labels;
  const areaPages = new Set(getAreaPageIds(locale));
  const projects = getProjects(locale);
  const projectsLink = pageLink({ key: 'projects' }, locale);
  const skills = getCv(locale).sections.flatMap((s) =>
    s.key === 'skills' ? s.entries.flatMap((g) => g.skills) : [],
  );
  const graph = jsonLdFor({ key: 'expertise' }, locale);
  const stage = getStageData('plan-small', undefined, locale); // D2, k8–12 (§4.13.2)

  return (
    <>
      {graph ? <JsonLd graph={graph} /> : null}
      <StagePreset name="plan-small" data={stage} />
      <PageHeader
        pageRef={{ key: 'expertise' }}
        locale={locale}
        title={labels.areas[locale]}
        lede={<Txt v={t(getHome().areas.statement, locale)} />}
        folio={{
          preset: 'plan-small',
          figure: (
            <KodPanel
              data={getKodData('plan-small', undefined, locale)}
              program={{ kind: 'area', index: 0 }}
            />
          ),
        }}
      />
      <ol className="container-page flex flex-col gap-block pt-block pb-section">
        {getAreas().map((a, i) => {
          const count = projects.filter((p) => p.areas.includes(a.id)).length;
          const areaSkills = skills.filter((k) => a.skills.includes(k.id));
          return (
            <li key={a.id} className="grid-page gap-y-4 border-t border-line pt-block">
              <p className="col-span-4 type-meta nums-tabular md:col-span-8 lg:col-span-2">
                {String(i + 1).padStart(2, '0')}
              </p>
              <div className="col-span-4 md:col-span-8 lg:col-span-7">
                <h2 className="type-h2 [overflow-wrap:anywhere]">
                  <Txt v={t(a.title, locale)} />
                </h2>
                <p className="mt-4 type-lead">
                  <Txt v={t(a.summary, locale)} />
                </p>
                <p className="mt-4 type-body">
                  <Txt v={t(a.description, locale)} />
                </p>
                {a.capabilities.length ? (
                  <ul className="mt-4 type-body list-disc space-y-1 pl-5">
                    {a.capabilities.map((c, k) => (
                      <li key={k}>
                        <Txt v={t(c, locale)} />
                      </li>
                    ))}
                  </ul>
                ) : null}
                {a.tags.length ? (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {a.tags.slice(0, 6).map((tag, k) => (
                      <li key={k}>
                        <Tag>
                          <Txt v={t(tag, locale)} />
                        </Tag>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {areaSkills.length ? (
                  <p className="mt-4 type-ui text-ink-muted">
                    {dict.area.skills}:{' '}
                    {areaSkills.map((k, j) => (
                      <span key={k.id}>
                        {j > 0 ? ', ' : ''}
                        <Txt v={t(k.name, locale)} />
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="mt-4">
                  {areaPages.has(a.id) ? (
                    <Link
                      prefetch={false}
                      transitionTypes={['nav-forward']}
                      href={pathOf({ key: 'area', param: a.id }, locale)}
                      className="link-inline type-ui"
                    >
                      {dict.project.areaPage}
                      <span aria-hidden="true"> →</span>
                    </Link>
                  ) : (
                    <Link
                      prefetch={false}
                      transitionTypes={['nav-forward']}
                      href={`${projectsLink.href}?alan=${a.id}` as Route}
                      hrefLang={projectsLink.hrefLang}
                      className="link-inline type-ui"
                    >
                      {fill(dict.home.areaProjectsCount, { count })}
                      <span aria-hidden="true"> →</span>
                    </Link>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
