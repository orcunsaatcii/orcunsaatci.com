// src/components/chapters/Areas.tsx — çalışma alanları (§4.8.4, §7.8.5). Server.
// M3: liste modu (tüm açıklamalar görünür, pin yok). Pin, adım düğmeleri, iğne ve DialFigure M4'tedir.
import Link from 'next/link';
import type { Route } from 'next';
import { Tag } from '@/components/ui/Tag';
import { Txt } from '@/components/ui/Txt';
import { getExperienceProfile } from '@/experience/profile';
import { chapterAnchors, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getAreas, getHome, getSite, t } from '@/lib/content';
import { pageLink } from '@/lib/seo/metadata';

export function Areas({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const labels = getExperienceProfile(getSite().persona).labels;
  const home = getHome();
  const areas = getAreas();
  const projects = pageLink({ key: 'projects' }, locale);
  const all = pageLink({ key: 'expertise' }, locale);
  const heading = home.areas.heading ? t(home.areas.heading, locale) : null;

  return (
    <section
      id={chapterAnchors.areas[locale]}
      data-chapter="areas"
      aria-labelledby="areas-title"
      className="container-page grid-page gap-y-6 py-section"
    >
      <div className="col-span-4 md:col-span-8 lg:col-span-7">
        <a
          href={`#${chapterAnchors.work[locale]}`}
          className="inline-flex min-h-6 items-center link-nav type-meta"
        >
          {dict.a11y.skipSection}
          <span aria-hidden="true"> ↓</span>
        </a>
        <p className="mt-6 type-eyebrow">{labels.eyebrows.areas[locale]}</p>
        <h2 id="areas-title" className="mt-4 type-h2">
          {heading ? <Txt v={heading} /> : labels.areas[locale]}
        </h2>
        <p className="mt-stack type-lead">
          <Txt v={t(home.areas.statement, locale)} />
        </p>
      </div>
      <ol className="col-span-4 flex flex-col gap-block md:col-span-8 lg:col-span-7">
        {areas.map((a, i) => (
          <li key={a.id}>
            <h3 className="flex items-baseline gap-3 text-2xl font-semibold">
              <span className="type-meta nums-tabular">{String(i + 1).padStart(2, '0')}</span>
              <Txt v={t(a.title, locale)} />
            </h3>
            <div className="area-desc mt-3">
              <p className="text-lg text-ink-muted">
                <Txt v={t(a.summary, locale)} />
              </p>
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
              <p className="mt-4">
                <Link
                  href={`${projects.href}?alan=${a.id}` as Route}
                  hrefLang={projects.hrefLang}
                  className="link-inline type-ui"
                >
                  {dict.home.areaProjects}
                  <span aria-hidden="true"> →</span>
                </Link>
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="col-span-4 md:col-span-8">
        <Link href={all.href} hrefLang={all.hrefLang} className="link-inline type-ui">
          {dict.home.allAreas}
          {all.fallback ? dict.lang.trSuffix : null}
        </Link>
      </p>
    </section>
  );
}
