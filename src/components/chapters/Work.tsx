// src/components/chapters/Work.tsx — "Numune görüntüleyici" (§4.9.3, §6.6.7). Server.
// DOM sırası article → figure çiftleridir. Görüntüleyici düzeni (≥ 64rem, html.js, tam hareket; home.css) çiftleri
// tek ızgaraya açar: makaleler k1–5 (70 svh), figürler k7–12'de aynı alanda üst üste sticky (top 14 svh); etkin olmayan
// figür kırpılıdır, ilk boyamada figür 1 açıktır. Silme ve altyazı SectionWipe'tadır. Kapı yoksa her figür makalesinin
// yanında/altında akıştadır (mobilde başlığın üstünde, bir kez klip reveal'ı). Kapaklar LCP değildir: lazy.
import Image from 'next/image';
import Link from 'next/link';
import { ViewTransition, type CSSProperties } from 'react';
import { SpecimenGlyph } from '@/components/figures/SpecimenGlyph';
import { RevealHeading } from '@/components/motion/RevealHeading';
import { SectionWipe } from '@/components/motion/SectionWipe';
import { HIT_AREA } from '@/components/ui/hit-area';
import { TextLink } from '@/components/ui/TextLink';
import { Txt } from '@/components/ui/Txt';
import { getExperienceProfile } from '@/experience/profile';
import { chapterAnchors, pathOf, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { fill } from '@/i18n/text';
import { getAreas, getHome, getProjects, getSite, getStageData, t } from '@/lib/content';
import { previewAttrs } from '@/stage/preview-attrs';
import { pageLink } from '@/lib/seo/metadata';
import { StageAnchor } from '@/stage/ScenePoster';

const pad = (n: number) => String(n).padStart(2, '0');

export function Work({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const profile = getExperienceProfile(getSite().persona);
  const labels = profile.labels;
  const home = getHome();
  const featured = getProjects(locale, { featured: true });
  const total = getProjects(locale).length;
  const areas = getAreas();
  const stage = getStageData('home', undefined, locale);
  const all = pageLink({ key: 'projects' }, locale);
  const heading = home.work.heading ? t(home.work.heading, locale) : null;
  const P = featured.length;
  const sectionId = chapterAnchors.work[locale];

  return (
    <section
      id={sectionId}
      data-chapter="work"
      data-work-viewer={profile.work.viewer ? '' : undefined}
      aria-labelledby="work-title"
      className="container-page py-section"
      style={{ '--work-p': P } as CSSProperties}
    >
      <div className="work-head max-w-text">
        <p className="type-eyebrow" data-reveal="block">
          {labels.eyebrows.work[locale]}
        </p>
        <RevealHeading id="work-title" className="mt-4 type-h2">
          {heading ? <Txt v={heading} /> : labels.work[locale]}
        </RevealHeading>
        {home.work.intro ? (
          <p className="mt-stack type-lead" data-reveal="block">
            <Txt v={t(home.work.intro, locale)} />
          </p>
        ) : null}
      </div>
      <div className="work-grid mt-block flex flex-col gap-block">
        {featured.map((p, k) => {
          const titleId = `work-${p.slug}`;
          const area = areas.find((a) => a.id === p.primaryArea);
          const stores = p.links.filter((l) => l.kind === 'live');
          const s = stage.projects[k];
          return (
            <div
              key={p.slug}
              className="work-pair grid-page items-start gap-y-6"
              style={{ '--k': k + 1 } as CSSProperties}
            >
              <article
                aria-labelledby={titleId}
                data-work-article=""
                className="col-span-4 md:col-span-8 lg:col-span-5"
                {...previewAttrs({ band: s?.band, sector: s?.area })}
              >
                <p className="type-meta nums-tabular" data-reveal="block">
                  {pad(k + 1)} / {pad(P)}
                </p>
                <RevealHeading as="h3" id={titleId} className="mt-3 type-h3">
                  <ViewTransition name={`project-title-${p.slug}`} share="morph" default="none">
                    <span>
                      <Txt v={t(p.title, locale)} />
                    </span>
                  </ViewTransition>
                </RevealHeading>
                <p className="mt-3 type-body" data-reveal="block">
                  <Txt v={t(p.summary, locale)} />
                </p>
                <dl className="mt-3 flex flex-wrap gap-x-3 type-meta" data-reveal="block">
                  <dt className="sr-only">{dict.project.facts.role}</dt>
                  <dd>
                    <Txt v={t(p.role, locale)} />
                  </dd>
                  <dt className="sr-only">{dict.project.facts.dates}</dt>
                  <dd className="nums-tabular">· {p.year}</dd>
                  {area ? (
                    <>
                      <dt className="sr-only">{dict.project.facts.areas}</dt>
                      <dd>
                        · <Txt v={t(area.title, locale)} />
                      </dd>
                    </>
                  ) : null}
                </dl>
                <div data-reveal="block">
                  <p className="mt-4">
                    <Link
                      transitionTypes={['nav-forward']}
                      href={pathOf({ key: 'project', param: p.slug }, locale)}
                      className="link-inline type-ui"
                    >
                      {dict.home.viewProject}
                      <span aria-hidden="true"> →</span>
                    </Link>
                  </p>
                  {stores.length ? (
                    <ul className="mt-3 flex flex-wrap gap-x-4 type-ui">
                      {stores.map((l) => (
                        <li key={l.url}>
                          <TextLink variant="external" href={l.url} className={HIT_AREA}>
                            <Txt v={t(l.label, locale)} />
                          </TextLink>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <SpecimenGlyph
                  rings={stage.rings}
                  sectors={stage.sectors}
                  band={s?.band ?? null}
                  area={s?.area ?? null}
                  className="work-glyph mt-4"
                />
              </article>
              <figure
                data-work-figure={k}
                data-active={k === 0 ? '' : undefined}
                className="col-span-4 md:col-span-8 lg:col-span-7"
              >
                <div
                  data-reveal="clip"
                  data-reveal-when="(max-width: 63.99rem)"
                  className="relative aspect-card overflow-hidden rounded-md bg-raised"
                >
                  <ViewTransition name={`project-cover-${p.slug}`} share="morph" default="none">
                    <Image
                      src={p.cover.src}
                      alt={t(p.cover.alt, locale).text}
                      width={p.cover.width}
                      height={p.cover.height}
                      sizes="(min-width: 64rem) 50vw, 100vw"
                      className="size-full object-cover"
                      style={{ backgroundColor: p.cover.dominant }}
                    />
                  </ViewTransition>
                  <span aria-hidden="true" className="work-wipe-line" />
                </div>
              </figure>
            </div>
          );
        })}
        <p aria-hidden="true" className="work-caption type-meta nums-tabular">
          {featured.map((p, k) => {
            const area = areas.find((a) => a.id === p.primaryArea);
            return (
              <span key={p.slug} data-work-caption={k} hidden={k !== 0}>
                {pad(k + 1)} / {pad(P)} · {p.year}
                {area ? (
                  <>
                    {' · '}
                    <Txt v={t(area.title, locale)} />
                  </>
                ) : null}
              </span>
            );
          })}
        </p>
        <StageAnchor id="work-specimen" className="work-specimen">
          {stage.projects.map((s, k) => (
            <span key={s.slug} data-work-specimen-glyph={k} hidden={k !== 0}>
              <SpecimenGlyph
                rings={stage.rings}
                sectors={stage.sectors}
                band={s.band}
                area={s.area}
                size={240}
                className="anchor-figure"
              />
            </span>
          ))}
        </StageAnchor>
      </div>
      <p className="work-closing mt-block">
        <Link
          transitionTypes={['nav-forward']}
          href={all.href}
          hrefLang={all.hrefLang}
          className="link-inline type-ui"
        >
          {fill(dict.home.allProjects, { count: total })}
          <span aria-hidden="true"> →</span>
        </Link>
      </p>
      <SectionWipe scopeId={sectionId} />
    </section>
  );
}
