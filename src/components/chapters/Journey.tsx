// src/components/chapters/Journey.tsx — "Karot" (§4.10.2, §4.10.7, §7.6.1). Server.
// Masaüstü + html.js + tam hareket (home.css): metin k1–7 doğal hızda kayar, yalnız sahne sütunu (journey-core,
// k8–12) sticky; başlık bloğu 40 svh, girdi 35 svh, kuyruk ≥ 30 svh. Mobilde bölüm başında 36 svh bant; her girdide
// 24 px EntryGlyph. Etkin yıl vurgusu JourneyActive'tedir. Girdiler en yeniden eskiye, E ≤ 6.
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { EntryGlyph } from '@/components/figures/EntryGlyph';
import { RingsFigure } from '@/components/figures/RingsFigure';
import { RevealHeading } from '@/components/motion/RevealHeading';
import { CvDownload } from '@/components/ui/CvDownload';
import { TimelineEntry } from '@/components/ui/TimelineEntry';
import { Txt } from '@/components/ui/Txt';
import { getExperienceProfile } from '@/experience/profile';
import { chapterAnchors, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { fill } from '@/i18n/text';
import {
  getCareerStartYear,
  getHome,
  getHomeJourney,
  getSite,
  getStageData,
  t,
  tList,
} from '@/lib/content';
import { pageLink } from '@/lib/seo/metadata';
import { StageAnchor } from '@/stage/ScenePoster';
import { JourneyActive } from './JourneyActive';

export function Journey({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const labels = getExperienceProfile(getSite().persona).labels;
  const home = getHome();
  const journey = getHomeJourney(locale);
  const cv = pageLink({ key: 'cv' }, locale);
  const heading = home.journey.heading ? t(home.journey.heading, locale) : null;
  const stage = getStageData('home', undefined, locale);
  const E = journey.experience.length;
  const startYear = getCareerStartYear();
  const buildYear = new Date().getFullYear(); // build yılı (SSG, §5.10)
  const sectionId = chapterAnchors.journey[locale];

  return (
    <section
      id={sectionId}
      data-chapter="journey"
      aria-labelledby="journey-title"
      className="container-page py-section"
      style={{ '--journey-e': Math.max(E, 1) } as CSSProperties}
    >
      <div className="journey-layout">
        <div className="journey-main">
          <div className="journey-head max-w-text">
            <p className="type-eyebrow" data-reveal="block">
              {labels.eyebrows.journey[locale]}
            </p>
            <RevealHeading id="journey-title" className="mt-4 type-h2">
              {heading ? <Txt v={heading} /> : dict.cv.sections.experience}
            </RevealHeading>
            {home.journey.intro ? (
              <p className="mt-stack type-lead" data-reveal="block">
                <Txt v={t(home.journey.intro, locale)} />
              </p>
            ) : null}
          </div>
          <ol className="journey-list mt-block flex flex-col gap-block">
            {journey.experience.map((e, i) => {
              const highlights = tList(e.highlights, locale);
              return (
                <TimelineEntry
                  key={e.id}
                  entryIndex={i}
                  reveal
                  locale={locale}
                  start={e.period.start}
                  end={e.period.end}
                  precision="year"
                  presentLabel={dict.cv.present}
                  glyph={
                    <EntryGlyph
                      rings={stage.rings}
                      band={stage.entries[i]?.band ?? null}
                      className="journey-glyph mr-2 [display:inline-block] align-middle lg:mr-0 lg:mb-2 lg:ml-auto"
                    />
                  }
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
                    <ul
                      lang={highlights.fallback ? 'tr' : undefined}
                      className="flex flex-col gap-1"
                    >
                      {highlights.items.slice(0, 2).map((h, k) => (
                        <li key={k}>{h}</li>
                      ))}
                    </ul>
                  ) : null}
                </TimelineEntry>
              );
            })}
          </ol>
          <div className="journey-tail">
            <div className="mt-block grid gap-block md:grid-cols-3" data-reveal="block">
              {journey.education.length ? (
                <div>
                  <h3 className="type-h4">{dict.cv.sections.education}</h3>
                  <ul className="mt-3 flex flex-col gap-2 type-ui">
                    {journey.education.map((e) => (
                      <li key={e.id}>
                        <Txt v={t(e.degree, locale)} />, <Txt v={t(e.field, locale)} /> —{' '}
                        {e.institution}{' '}
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
            <div
              className="mt-block flex flex-wrap items-center gap-x-6 gap-y-3"
              data-reveal="block"
            >
              <CvDownload locale={locale} />
              <Link href={cv.href} hrefLang={cv.hrefLang} className="link-inline type-ui">
                {dict.home.fullCv}
                {cv.fallback ? dict.lang.trSuffix : null}
                <span aria-hidden="true"> →</span>
              </Link>
            </div>
          </div>
        </div>
        <StageAnchor id="journey-core" labelled className="journey-core">
          <RingsFigure
            rings={stage.rings}
            startYear={startYear}
            currentYear={buildYear}
            ariaLabel={fill(dict.figures.rings, { start: startYear, end: buildYear })}
            bands={stage.entries.map((x) => x.band)}
            active={null}
            className="anchor-figure"
          />
        </StageAnchor>
      </div>
      <JourneyActive sectionId={sectionId} />
    </section>
  );
}
