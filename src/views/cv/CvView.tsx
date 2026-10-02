// src/views/cv/CvView.tsx — /cv (§7.6.1–§7.6.3). Server; okumak içindir, scroll-jacking yok.
// Bölüm sırası ve çapalar cv.ts selectCv(…, 'web'); boş bölüm çizilmez. KOD ile sahnesiz belge sayfası (§4 KOD).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { JsonLd } from '@/components/seo/JsonLd';
import { CvDownload } from '@/components/ui/CvDownload';
import { EmailLink } from '@/components/ui/EmailLink';
import { PrintButton } from '@/components/ui/PrintButton';
import { SocialLinks } from '@/components/ui/SocialLinks';
import { TextLink } from '@/components/ui/TextLink';
import { TimelineEntry } from '@/components/ui/TimelineEntry';
import { Txt } from '@/components/ui/Txt';
import { absoluteUrl, fileRoutes, pathOf, staticRoutes, type Locale } from '@/i18n/config';
import { formatPartialDate } from '@/i18n/format';
import { getDictionary } from '@/i18n/get-dictionary';
import { duration, fill, plural } from '@/i18n/text';
import {
  getContact,
  getCv,
  getPerson,
  getProject,
  getProjects,
  t,
  tList,
  type CvSection,
} from '@/lib/content';
import { jsonLdFor } from '@/lib/seo/jsonld';
import { StagePreset } from '@/stage/StagePreset';
import './print.css';

const BUILD_MONTH = new Date().toISOString().slice(0, 7); // süren kaydın süresi için (build anı)

export function CvView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const person = getPerson();
  const contact = getContact();
  const cv = getCv(locale);
  const graph = jsonLdFor({ key: 'cv' }, locale);
  const skillName = new Map<string, ReactNode>();
  const projectTitles = new Map(getProjects('tr').map((p) => [p.slug, p]));

  const projectLink = (slug: string) => {
    const own = getProject(slug, locale);
    const any = projectTitles.get(slug);
    if (own) {
      return (
        <Link
          transitionTypes={['nav-forward']}
          href={pathOf({ key: 'project', param: slug }, locale)}
          className="link-inline"
        >
          <Txt v={t(own.title, locale)} />
        </Link>
      );
    }
    return any ? <Txt v={t(any.title, locale)} /> : slug; // taslak ya da bu dilde yok: düz metin (§7.3.5)
  };

  const sectionBody = (s: CvSection): ReactNode => {
    switch (s.key) {
      case 'profile':
        return (
          <p className="type-body">
            <Txt v={t(s.entries[0], locale)} />
          </p>
        );
      case 'experience':
        return (
          <ol className="flex flex-col gap-block">
            {s.entries.map((e) => {
              const highlights = tList(e.highlights, locale);
              return (
                <TimelineEntry
                  key={e.id}
                  as="li"
                  className="cv-entry"
                  cvEntry
                  locale={locale}
                  start={e.period.start}
                  end={e.period.end}
                  precision="full"
                  presentLabel={dict.cv.present}
                  title={<Txt v={t(e.role, locale)} />}
                  subtitle={
                    <>
                      {e.organizationUrl ? (
                        <TextLink variant="external" href={e.organizationUrl}>
                          {e.organization}
                        </TextLink>
                      ) : (
                        e.organization
                      )}
                      {e.location ? (
                        <>
                          {' · '}
                          <Txt v={t(e.location, locale)} />
                        </>
                      ) : null}
                      {e.remote ? ` · ${dict.cv.remoteShort}` : null}
                      {' · '}
                      {dict.cv.employmentTypes[e.employmentType]}
                      <span className="type-meta">
                        {' · '}
                        {duration(
                          locale,
                          e.period.start,
                          e.period.end,
                          BUILD_MONTH,
                          dict.cv.duration,
                        )}
                      </span>
                    </>
                  }
                >
                  <p>
                    <Txt v={t(e.summary, locale)} />
                  </p>
                  {highlights.items.length ? (
                    <ul
                      lang={highlights.fallback ? 'tr' : undefined}
                      className="mt-3 list-disc space-y-1 pl-5"
                    >
                      {highlights.items.slice(0, 5).map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  ) : null}
                  {e.projects.length ? (
                    <p className="mt-3 type-ui">
                      {dict.cv.relatedProjects}:{' '}
                      {e.projects.map((slug, i) => (
                        <span key={slug}>
                          {i > 0 ? ', ' : ''}
                          {projectLink(slug)}
                        </span>
                      ))}
                    </p>
                  ) : null}
                  {e.skills.length ? (
                    <p className="mt-1 type-ui text-ink-muted">
                      {dict.cv.tools}:{' '}
                      {e.skills
                        .map((id) => skillName.get(id) ?? id)
                        .map((n, i) => (
                          <span key={i}>
                            {i > 0 ? ', ' : ''}
                            {n}
                          </span>
                        ))}
                    </p>
                  ) : null}
                </TimelineEntry>
              );
            })}
          </ol>
        );
      case 'skills':
        return (
          <div className="grid gap-stack md:grid-cols-2">
            {s.entries.map((g) => (
              <div key={g.category}>
                <h3 className="type-h4">{dict.cv.skillCategories[g.category]}</h3>
                <ul className="mt-3 flex type-body flex-col gap-1">
                  {g.skills.map((k) => (
                    <li key={k.id}>
                      <Txt v={t(k.name, locale)} />
                      {k.level ? ` — ${dict.cv.skillLevels[k.level]}` : ''}
                      {k.years ? (
                        <span className="type-meta">
                          {' · '}
                          {plural(locale, k.years, dict.home.years)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      case 'education':
        return (
          <ol className="flex flex-col gap-stack">
            {s.entries.map((e) => (
              <TimelineEntry
                key={e.id}
                className="cv-entry"
                cvEntry
                locale={locale}
                start={e.period.start}
                end={e.period.end}
                precision="full"
                presentLabel={dict.cv.present}
                title={
                  <>
                    <Txt v={t(e.degree, locale)} />, <Txt v={t(e.field, locale)} />
                  </>
                }
                subtitle={
                  e.institutionUrl ? (
                    <TextLink variant="external" href={e.institutionUrl}>
                      {e.institution}
                    </TextLink>
                  ) : (
                    e.institution
                  )
                }
              >
                {e.grade ? (
                  <p className="type-ui">
                    {dict.cv.grade}: {e.grade}
                  </p>
                ) : null}
                {e.thesis ? (
                  <p className="type-ui">
                    {dict.cv.thesis}: <Txt v={t(e.thesis, locale)} />
                  </p>
                ) : null}
                {e.courses.length ? (
                  <p className="type-ui text-ink-muted">
                    {dict.cv.courses}: {e.courses.map((c) => t(c, locale).text).join(', ')}
                  </p>
                ) : null}
              </TimelineEntry>
            ))}
          </ol>
        );
      case 'certifications':
        return (
          <ul className="flex flex-col gap-3">
            {s.entries.map((c) => (
              <li key={c.id} className="cv-entry type-body">
                <Txt v={t(c.name, locale)} /> — {c.issuer}{' '}
                <span className="type-meta">
                  <time dateTime={c.date}>{formatPartialDate(c.date, locale)}</time>
                  {c.expires
                    ? ` · ${dict.cv.expires}: ${formatPartialDate(c.expires, locale)}`
                    : ''}
                </span>
                {c.url ? (
                  <>
                    {' '}
                    <TextLink variant="external" href={c.url}>
                      {dict.cv.verify}
                    </TextLink>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        );
      case 'awards':
        return (
          <ul className="flex flex-col gap-3">
            {s.entries.map((a) => (
              <li key={a.id} className="cv-entry type-body">
                <Txt v={t(a.title, locale)} /> — {a.awarder}{' '}
                <span className="type-meta">
                  <time dateTime={a.date}>{formatPartialDate(a.date, locale)}</time>
                </span>
                {a.summary ? (
                  <p className="type-ui text-ink-muted">
                    <Txt v={t(a.summary, locale)} />
                  </p>
                ) : null}
                {a.project ? <p className="type-ui">{projectLink(a.project)}</p> : null}
              </li>
            ))}
          </ul>
        );
      case 'publications':
        return (
          <ul className="flex flex-col gap-3">
            {s.entries.map((x) => (
              <li key={x.id} className="cv-entry type-body">
                <span className="type-meta">{dict.cv.publicationTypes[x.type]} · </span>
                {x.url ? (
                  <TextLink variant="external" href={x.url}>
                    <Txt v={t(x.title, locale)} />
                  </TextLink>
                ) : (
                  <Txt v={t(x.title, locale)} />
                )}{' '}
                — {x.venue}{' '}
                <span className="type-meta">
                  <time dateTime={x.date}>{formatPartialDate(x.date, locale)}</time>
                  {x.location ? (
                    <>
                      {' · '}
                      <Txt v={t(x.location, locale)} />
                    </>
                  ) : null}
                </span>
                {x.coAuthors.length ? (
                  <p className="type-ui text-ink-muted">
                    {fill(dict.cv.with, { names: x.coAuthors.join(', ') })}
                  </p>
                ) : null}
                {x.doi ? (
                  <p className="type-ui">
                    <TextLink variant="external" href={`https://doi.org/${x.doi}`}>
                      DOI {x.doi}
                    </TextLink>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        );
      case 'languages':
        return (
          <ul className="flex type-body flex-col gap-1">
            {s.entries.map((l) => (
              <li key={l.code}>
                <Txt v={t(l.name, locale)} /> —{' '}
                <span className="text-ink-muted">{dict.cv.languageLevels[l.level]}</span>
              </li>
            ))}
          </ul>
        );
      case 'projects':
        return null; // yalnız PDF (§7.6.1)
    }
  };

  // "Araçlar: …" için yetkinlik adları (düz metin)
  for (const s of cv.sections) {
    if (s.key === 'skills')
      for (const g of s.entries)
        for (const k of g.skills) skillName.set(k.id, <Txt v={t(k.name, locale)} />);
  }

  return (
    <div className="cv-main relative">
      {graph ? <JsonLd graph={graph} /> : null}
      {/* KOD (§4 KOD): CV belge sayfasıdır; dar sağ sütunda 56 sütunluk panel okunamayacağı için sahne yok */}
      <StagePreset name="none" data={null} />
      <PageHeader pageRef={{ key: 'cv' }} locale={locale} title={dict.meta.cv}>
        <p className="mt-stack type-lead">
          {locale === 'en' ? <span lang="tr">{person.name}</span> : person.name} ·{' '}
          <Txt v={t(person.jobTitle, locale)} /> · <Txt v={t(person.location.city, locale)} />
          {person.location.remote ? ` · ${dict.cv.remote}` : null}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 type-ui">
          <EmailLink email={contact.email} />
          <span aria-hidden="true">·</span>
          <TextLink href={staticRoutes.home[locale]}>
            {absoluteUrl('/')
              .replace(/^https:\/\//, '')
              .replace(/\/$/, '')}
          </TextLink>
          <SocialLinks locale={locale} className="flex flex-wrap gap-x-4" />
        </div>
        <div data-print="hide" className="mt-stack flex flex-wrap items-center gap-x-6 gap-y-3">
          <CvDownload locale={locale} />
          <PrintButton label={dict.cv.print} />
          <a href={fileRoutes.resume[locale]} className="link-inline type-meta">
            {dict.cv.jsonResume}
          </a>
        </div>
        <p className="mt-4 type-meta">
          {fill(dict.cv.updated, { date: formatPartialDate(cv.updatedAt, locale) })}
        </p>
      </PageHeader>
      <div className="container-page grid-page gap-y-block pt-block pb-section">
        <nav
          aria-label={dict.a11y.cvSections}
          data-print="hide"
          className="col-span-4 md:col-span-8 lg:col-span-3"
        >
          <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:flex-col">
            {cv.sections.map((s) => (
              <li key={s.key}>
                <a
                  href={`#${s.anchor}`}
                  className="inline-flex min-h-11 items-center link-nav type-ui"
                >
                  {dict.cv.sections[s.key]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="col-span-4 flex flex-col gap-block md:col-span-8 lg:col-span-9 xl:col-span-6">
          {cv.sections.map((s) => (
            <section
              key={s.key}
              id={s.anchor}
              aria-labelledby={`${s.anchor}-title`}
              className="cv-section"
            >
              <h2 id={`${s.anchor}-title`} className="type-h2">
                {dict.cv.sections[s.key]}
              </h2>
              <div className="mt-stack">{sectionBody(s)}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
