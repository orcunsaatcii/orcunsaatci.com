// src/components/chapters/Journey.tsx — "Karot" (§4.10.2, §7.6.1). Server.
// M3: akış düzeni; sticky sahne sütunu, RingsFigure ve EntryGlyph M4'te. Girdiler en yeniden eskiye, E ≤ 6.
import Link from 'next/link';
import { CvDownload } from '@/components/ui/CvDownload';
import { TimelineEntry } from '@/components/ui/TimelineEntry';
import { Txt } from '@/components/ui/Txt';
import { getExperienceProfile } from '@/experience/profile';
import { chapterAnchors, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getHome, getHomeJourney, getSite, t, tList } from '@/lib/content';
import { pageLink } from '@/lib/seo/metadata';

export function Journey({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const labels = getExperienceProfile(getSite().persona).labels;
  const home = getHome();
  const journey = getHomeJourney(locale);
  const cv = pageLink({ key: 'cv' }, locale);
  const heading = home.journey.heading ? t(home.journey.heading, locale) : null;

  return (
    <section
      id={chapterAnchors.journey[locale]}
      data-chapter="journey"
      aria-labelledby="journey-title"
      className="container-page py-section"
    >
      <div className="max-w-text">
        <p className="type-eyebrow">{labels.eyebrows.journey[locale]}</p>
        <h2 id="journey-title" className="mt-4 type-h2">
          {heading ? <Txt v={heading} /> : dict.cv.sections.experience}
        </h2>
        {home.journey.intro ? (
          <p className="mt-stack type-lead">
            <Txt v={t(home.journey.intro, locale)} />
          </p>
        ) : null}
      </div>
      <ol className="mt-block flex flex-col gap-block">
        {journey.experience.map((e) => {
          const highlights = tList(e.highlights, locale);
          return (
            <TimelineEntry
              key={e.id}
              locale={locale}
              start={e.period.start}
              end={e.period.end}
              precision="year"
              presentLabel={dict.cv.present}
              title={<Txt v={t(e.role, locale)} />}
              subtitle={
                <>
                  {e.organization}
                  {e.location ? (
                    <>
                      {' · '}
                      <Txt v={t(e.location, locale)} />
                    </>
                  ) : null}
                </>
              }
            >
              {highlights.items.length ? (
                <ul lang={highlights.fallback ? 'tr' : undefined} className="flex flex-col gap-1">
                  {highlights.items.slice(0, 2).map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              ) : null}
            </TimelineEntry>
          );
        })}
      </ol>
      <div className="mt-block grid gap-block md:grid-cols-3">
        {journey.education.length ? (
          <div>
            <h3 className="type-h4">{dict.cv.sections.education}</h3>
            <ul className="mt-3 flex flex-col gap-2 type-ui">
              {journey.education.map((e) => (
                <li key={e.id}>
                  <Txt v={t(e.degree, locale)} />, <Txt v={t(e.field, locale)} /> — {e.institution}{' '}
                  <span className="type-meta nums-tabular">
                    {e.period.start.slice(0, 4)}
                    {e.period.end ? `–${e.period.end.slice(0, 4)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {journey.awardsTalks.length ? (
          <div>
            <h3 className="type-h4">{dict.home.awardsTalks}</h3>
            <ul className="mt-3 flex flex-col gap-2 type-ui">
              {journey.awardsTalks.map((x) => (
                <li key={x.item.id}>
                  <Txt v={t(x.item.title, locale)} /> —{' '}
                  {x.kind === 'award' ? x.item.awarder : x.item.venue}{' '}
                  <span className="type-meta nums-tabular">{x.item.date.slice(0, 4)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {journey.languages.length ? (
          <div>
            <h3 className="type-h4">{dict.cv.sections.languages}</h3>
            <ul className="mt-3 flex flex-col gap-2 type-ui">
              {journey.languages.map((l) => (
                <li key={l.code}>
                  <Txt v={t(l.name, locale)} /> —{' '}
                  <span className="text-ink-muted">{dict.cv.languageLevels[l.level]}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="mt-block flex flex-wrap items-center gap-x-6 gap-y-3">
        <CvDownload locale={locale} />
        <Link href={cv.href} hrefLang={cv.hrefLang} className="link-inline type-ui">
          {dict.home.fullCv}
          {cv.fallback ? dict.lang.trSuffix : null}
          <span aria-hidden="true"> →</span>
        </Link>
      </div>
    </section>
  );
}
