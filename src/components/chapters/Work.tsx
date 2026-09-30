// src/components/chapters/Work.tsx — "Numune görüntüleyici" (§4.9.3, §6.6.7). Server.
// M3: akış düzeni; her makalenin kapağı yanında/altında (JS'siz ve azaltılmış görünüm). Sticky görüntüleyici,
// SectionWipe ve SpecimenGlyph M4'te; paylaşılan öğe morph'u M7'de. Kapaklar LCP değildir: lazy.
import Image from 'next/image';
import Link from 'next/link';
import { HIT_AREA } from '@/components/ui/hit-area';
import { TextLink } from '@/components/ui/TextLink';
import { Txt } from '@/components/ui/Txt';
import { getExperienceProfile } from '@/experience/profile';
import { chapterAnchors, pathOf, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { fill } from '@/i18n/text';
import { getAreas, getHome, getProjects, getSite, t } from '@/lib/content';
import { pageLink } from '@/lib/seo/metadata';

export function Work({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const labels = getExperienceProfile(getSite().persona).labels;
  const home = getHome();
  const featured = getProjects(locale, { featured: true });
  const total = getProjects(locale).length;
  const areas = getAreas();
  const all = pageLink({ key: 'projects' }, locale);
  const heading = home.work.heading ? t(home.work.heading, locale) : null;
  const P = featured.length;

  return (
    <section
      id={chapterAnchors.work[locale]}
      data-chapter="work"
      aria-labelledby="work-title"
      className="container-page py-section"
    >
      <div className="max-w-text">
        <p className="type-eyebrow">{labels.eyebrows.work[locale]}</p>
        <h2 id="work-title" className="mt-4 type-h2">
          {heading ? <Txt v={heading} /> : labels.work[locale]}
        </h2>
        {home.work.intro ? (
          <p className="mt-stack type-lead">
            <Txt v={t(home.work.intro, locale)} />
          </p>
        ) : null}
      </div>
      <div className="mt-block flex flex-col gap-block">
        {featured.map((p, k) => {
          const titleId = `work-${p.slug}`;
          const area = areas.find((a) => a.id === p.primaryArea);
          const stores = p.links.filter((l) => l.kind === 'live');
          return (
            <div key={p.slug} className="grid-page items-start gap-y-6">
              <article aria-labelledby={titleId} className="col-span-4 md:col-span-8 lg:col-span-5">
                <p className="type-meta nums-tabular">
                  {String(k + 1).padStart(2, '0')} / {String(P).padStart(2, '0')}
                </p>
                <h3 id={titleId} className="mt-3 type-h3">
                  <Txt v={t(p.title, locale)} />
                </h3>
                <p className="mt-3 line-clamp-2 type-body">
                  <Txt v={t(p.summary, locale)} />
                </p>
                <dl className="mt-3 flex flex-wrap gap-x-3 type-meta">
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
                <p className="mt-4">
                  <Link
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
              </article>
              <figure className="col-span-4 md:col-span-8 lg:col-span-7">
                <div className="aspect-card overflow-hidden rounded-md bg-raised">
                  <Image
                    src={p.cover.src}
                    alt={t(p.cover.alt, locale).text}
                    width={p.cover.width}
                    height={p.cover.height}
                    sizes="(min-width: 64rem) 55vw, 100vw"
                    className="size-full object-cover"
                    style={{ backgroundColor: p.cover.dominant }}
                  />
                </div>
              </figure>
            </div>
          );
        })}
      </div>
      <p className="mt-block">
        <Link href={all.href} hrefLang={all.hrefLang} className="link-inline type-ui">
          {fill(dict.home.allProjects, { count: total })}
          <span aria-hidden="true"> →</span>
        </Link>
      </p>
    </section>
  );
}
