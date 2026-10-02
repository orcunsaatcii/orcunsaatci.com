// src/components/chapters/Areas.tsx — çalışma alanları; DOM'u tutan tek pin (§4.8, §7.8.5). Server.
// Pin kapısı CSS'tedir (home.css): html.js + tam hareket + medya + 3 ≤ N ≤ 6. Kapı yoksa liste modu: tüm
// açıklamalar alt alta. Sağ sütunda KOD paneli etkin alanın diyagramını gösterir (§4 KOD). Pin modunda açıklamalar
// tek ortak yuvada üst üste durur; hiçbiri aria-hidden değildir (K-AREAS-8). İstemci parçaları AreasPin.tsx'te.
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Route } from 'next';
import { KodPanel } from '@/components/kod/KodPanel';
import { RevealHeading } from '@/components/motion/RevealHeading';
import { Tag } from '@/components/ui/Tag';
import { Txt } from '@/components/ui/Txt';
import { getExperienceProfile } from '@/experience/profile';
import { chapterAnchors, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { fill } from '@/i18n/text';
import { getAreaMode, getAreas, getHome, getKodData, getSite, t } from '@/lib/content';
import { pageLink } from '@/lib/seo/metadata';
import { StageAnchor } from '@/stage/StageAnchor';
import { AreaStepButton, AreasPin, AreasProgress } from './AreasPin';

export function Areas({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const labels = getExperienceProfile(getSite().persona).labels;
  const home = getHome();
  const areas = getAreas();
  const N = areas.length;
  const mode = getAreaMode(); // 'dial' (3–6) | 'list' (N ≥ 7)
  const projects = pageLink({ key: 'projects' }, locale);
  const all = pageLink({ key: 'expertise' }, locale);
  const heading = home.areas.heading ? t(home.areas.heading, locale) : null;
  const titles = areas.map((a) => t(a.title, locale));
  const sectionId = chapterAnchors.areas[locale];
  const kod = getKodData('home', undefined, locale);

  return (
    <section
      id={sectionId}
      data-chapter="areas"
      data-areas-mode={mode}
      data-areas-n={N}
      aria-labelledby="areas-title"
      className="py-section"
      style={{ '--areas-n': N } as CSSProperties}
    >
      <div data-areas-stage="" className="areas-stage container-page grid-page gap-y-6">
        <div className="areas-text col-span-4 md:col-span-8 lg:col-span-7">
          {/* sahnenin ilk odaklanabilir öğesi; her zaman kesme kuralı (§4.5.5 [SABİT]) */}
          <a
            href={`#${chapterAnchors.work[locale]}`}
            data-skip-section=""
            className="inline-flex min-h-6 items-center self-start link-nav type-meta"
          >
            {dict.a11y.skipSection}
            <span aria-hidden="true"> ↓</span>
          </a>
          <p className="mt-6 type-eyebrow" data-reveal="block">
            {labels.eyebrows.areas[locale]}
          </p>
          <RevealHeading id="areas-title" className="mt-4 type-h2">
            {heading ? <Txt v={heading} /> : labels.areas[locale]}
          </RevealHeading>
          <p className="areas-statement mt-stack type-lead" data-reveal="block">
            <Txt v={t(home.areas.statement, locale)} />
          </p>
          <ol className="areas-list mt-block flex flex-col gap-block" data-reveal="block">
            {areas.map((a, k) => (
              <li
                key={a.id}
                className="area-item"
                data-area-index={k}
                style={{ '--row': k + 1 } as CSSProperties}
              >
                <h3 className="area-title text-2xl font-semibold">
                  <AreaStepButton index={k}>
                    <span className="type-meta nums-tabular">{String(k + 1).padStart(2, '0')}</span>{' '}
                    <span className="area-name">
                      <Txt v={titles[k] ?? t(a.title, locale)} />
                    </span>
                  </AreaStepButton>
                </h3>
                <div
                  className="area-desc mt-3"
                  data-area-desc={k}
                  data-active={k === 0 ? '' : undefined}
                >
                  <p className="text-lg text-ink-muted">
                    <Txt v={t(a.summary, locale)} />
                  </p>
                  {a.tags.length ? (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {a.tags.slice(0, 6).map((tag, i) => (
                        <li key={i}>
                          <Tag>
                            <Txt v={t(tag, locale)} />
                          </Tag>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-4">
                    <Link
                      prefetch={false}
                      transitionTypes={['nav-forward']}
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
          {mode === 'dial' ? (
            <AreasProgress
              n={N}
              groupLabel={dict.a11y.areaSteps}
              stepLabels={titles.map((x, k) =>
                fill(dict.a11y.areaStep, { k: k + 1, title: x.text }),
              )}
            />
          ) : null}
          <p className="areas-all mt-block">
            <Link
              prefetch={false}
              transitionTypes={['nav-forward']}
              href={all.href}
              hrefLang={all.hrefLang}
              className="link-inline type-ui"
            >
              {dict.home.allAreas}
              {all.fallback ? dict.lang.trSuffix : null}
            </Link>
          </p>
        </div>
        {mode === 'dial' ? (
          <StageAnchor id="areas-dial" className="areas-dial">
            {/* adım kareleri: sahne yokken (statik kademe, açılış öncesi) panel etkin adımı izler (AreasPin) */}
            {areas.map((a, k) => (
              <KodPanel
                key={a.id}
                data={kod}
                program={{ kind: 'area', index: k }}
                step={k}
                active={k === 0}
              />
            ))}
          </StageAnchor>
        ) : null}
        <span aria-hidden="true" data-areas-needle="" className="areas-needle" />
      </div>
      {mode === 'dial' ? (
        <>
          <AreasPin sectionId={sectionId} n={N} />
        </>
      ) : null}
    </section>
  );
}
