// src/views/project/ProjectView.tsx — yalın proje sayfası (§7.7.1, D-48). Server; veri yalnız project.yaml'dan.
// Sıra: breadcrumb · hero (H1, özet, preload'lu kapak) · künye · mağaza · galeri · video bağlantısı · sonraki proje ·
// benzer projeler · iletişim CTA'sı. Boş bölüm çizilmez; okuma süresi, metrik, ekip, müşteri, teknoloji listesi yok.
import type { Route } from 'next';
import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { preload } from 'react-dom';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { Button } from '@/components/ui/Button';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { Tag } from '@/components/ui/Tag';
import { HIT_AREA } from '@/components/ui/hit-area';
import { TextLink } from '@/components/ui/TextLink';
import { Txt } from '@/components/ui/Txt';
import { pathOf, type Locale } from '@/i18n/config';
import { formatRange } from '@/i18n/format';
import { getDictionary } from '@/i18n/get-dictionary';
import {
  getAdjacentProjects,
  getAreaPageIds,
  getAreas,
  getRelatedProjects,
  t,
  type ProjectDoc,
} from '@/lib/content';
import { jsonLdFor } from '@/lib/seo/jsonld';
import { pageLink } from '@/lib/seo/metadata';

const COVER_SIZES = '(min-width: 64rem) 58vw, 100vw';

/** ≥ 64rem 16:10 kapak; < 64rem mobileCover (4:5) varsa sanat yönetimli <picture> (§7.7.1, §9.3). */
function Cover({ project, locale }: { project: ProjectDoc; locale: Locale }) {
  const { cover, mobileCover } = project;
  const alt = t(cover.alt, locale).text;
  if (!mobileCover) {
    return (
      <Image
        src={cover.src}
        alt={alt}
        width={cover.width}
        height={cover.height}
        sizes={COVER_SIZES}
        preload
        className="aspect-card h-auto w-full rounded-md object-cover"
        style={{ backgroundColor: cover.dominant }}
      />
    );
  }
  const desktop = getImageProps({
    src: cover.src,
    alt,
    width: cover.width,
    height: cover.height,
    sizes: COVER_SIZES,
  });
  const mobile = getImageProps({
    src: mobileCover.src,
    alt,
    width: mobileCover.width,
    height: mobileCover.height,
    sizes: '100vw',
  });
  // Her genişlikte tek kapak preload'u: medya sorguları birbirini dışlar (SPEC-SAPMA §7.7.1)
  const DESKTOP = '(min-width: 64rem)';
  const MOBILE = '(max-width: 63.99rem)';
  preload(desktop.props.src, {
    as: 'image',
    imageSrcSet: desktop.props.srcSet,
    imageSizes: desktop.props.sizes,
    media: DESKTOP,
    fetchPriority: 'high',
  });
  preload(mobile.props.src, {
    as: 'image',
    imageSrcSet: mobile.props.srcSet,
    imageSizes: mobile.props.sizes,
    media: MOBILE,
    fetchPriority: 'high',
  });
  const { srcSet: mobileSrcSet, ...img } = mobile.props;
  return (
    <picture>
      <source media={DESKTOP} srcSet={desktop.props.srcSet} sizes={desktop.props.sizes} />
      <img
        {...img}
        srcSet={mobileSrcSet}
        alt={alt}
        fetchPriority="high"
        className="aspect-portrait h-auto w-full rounded-md object-cover lg:aspect-card"
        style={{ backgroundColor: mobileCover.dominant }}
      />
    </picture>
  );
}

export function ProjectView({ project, locale }: { project: ProjectDoc; locale: Locale }) {
  const dict = getDictionary(locale);
  const title = t(project.title, locale);
  const areas = getAreas();
  const areaPages = new Set(getAreaPageIds(locale));
  const projectsLink = pageLink({ key: 'projects' }, locale);
  const contact = pageLink({ key: 'contact' }, locale);
  const stores = project.links.filter((l) => l.kind === 'live');
  const video = project.links.find((l) => l.kind === 'video');
  const next = getAdjacentProjects(project.slug, locale)?.next;
  const related = getRelatedProjects(project.slug, locale);
  const graph = jsonLdFor({ key: 'project', param: project.slug }, locale);

  return (
    <article>
      {graph ? <JsonLd graph={graph} /> : null}
      {/* 1–2 · breadcrumb ve hero */}
      <header className="container-page grid-page gap-y-6 pt-block">
        <div className="col-span-4 md:col-span-8 lg:col-span-5">
          <Breadcrumbs
            pageRef={{ key: 'project', param: project.slug }}
            locale={locale}
            title={title.text}
          />
          <h1
            lang={title.fallback ? title.lang : undefined}
            className="mt-stack type-h1 [overflow-wrap:anywhere]"
          >
            {title.text}
          </h1>
          <p className="mt-stack type-lead">
            <Txt v={t(project.summary, locale)} />
          </p>
        </div>
        <div className="col-span-4 md:col-span-8 lg:col-span-7">
          <Cover project={project} locale={locale} />
        </div>
      </header>

      <div className="container-page flex flex-col gap-block pt-block pb-section">
        {/* 3 · künye şeridi */}
        <dl className="grid grid-cols-1 gap-x-gutter gap-y-4 border-y border-line py-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="type-meta">{dict.project.facts.role}</dt>
            <dd className="mt-1 type-ui">
              <Txt v={t(project.role, locale)} />
            </dd>
          </div>
          <div>
            <dt className="type-meta">{dict.project.facts.dates}</dt>
            <dd className="mt-1 type-ui nums-tabular">
              {formatRange(project.start, project.end, locale, dict.cv.present)}
            </dd>
          </div>
          <div>
            <dt className="type-meta">{dict.project.facts.status}</dt>
            <dd className="mt-1 type-ui">{dict.project.statuses[project.status]}</dd>
          </div>
          <div>
            <dt className="type-meta">{dict.project.facts.areas}</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {project.areas.map((id) => {
                const area = areas.find((a) => a.id === id);
                const href = areaPages.has(id)
                  ? pathOf({ key: 'area', param: id }, locale)
                  : (`${projectsLink.href}?alan=${id}` as Route);
                return (
                  <Link key={id} href={href} className="inline-flex min-h-11 items-center">
                    <Tag>
                      <Txt v={t(area?.title, locale)} />
                    </Tag>
                  </Link>
                );
              })}
            </dd>
          </div>
          {project.facts.map((f, i) => (
            <div key={i}>
              <dt className="type-meta">
                <Txt v={t(f.label, locale)} />
              </dt>
              <dd className="mt-1 type-ui">
                <Txt v={t(f.value, locale)} />
              </dd>
            </div>
          ))}
        </dl>

        {/* 4 · mağaza bağlantıları */}
        {stores.length ? (
          <ul aria-label={dict.project.stores} className="flex flex-wrap gap-x-6 gap-y-2 type-ui">
            {stores.map((l) => (
              <li key={l.url}>
                <TextLink variant="external" href={l.url} className={HIT_AREA}>
                  <Txt v={t(l.label, locale)} />
                </TextLink>
              </li>
            ))}
          </ul>
        ) : null}

        {/* 5 · galeri (lightbox yok; dikey ekran görüntüleri özgün oranında) */}
        {project.gallery.length ? (
          <section aria-labelledby="gallery-title">
            <h2 id="gallery-title" className="type-h2">
              {dict.project.gallery}
            </h2>
            <div className="mt-stack grid grid-cols-1 items-start gap-gutter md:grid-cols-2 lg:grid-cols-3">
              {project.gallery.map((g) => (
                <figure key={g.src}>
                  <Image
                    src={g.src}
                    alt={t(g.alt, locale).text}
                    width={g.width}
                    height={g.height}
                    sizes="(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw"
                    className="h-auto w-full rounded-md"
                    style={{ backgroundColor: g.dominant }}
                  />
                  {g.caption ? (
                    <figcaption className="mt-2 type-meta">
                      <Txt v={t(g.caption, locale)} />
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {/* 6 · video bağlantısı (oynatıcı ve iframe YASAK) */}
        {video ? (
          <p className="type-ui">
            <TextLink variant="external" href={video.url} className={HIT_AREA}>
              <Txt v={t(video.label, locale)} />
            </TextLink>
          </p>
        ) : null}

        {/* 7 · sonraki proje (dairesel) */}
        {next ? (
          <section aria-labelledby="next-title" className="border-t border-line pt-block">
            <p id="next-title" className="type-eyebrow">
              {dict.project.next}
            </p>
            <Link
              href={pathOf({ key: 'project', param: next.slug }, locale)}
              className="group mt-4 grid grid-cols-1 gap-gutter md:grid-cols-2 md:items-center"
            >
              <span className="block aspect-card overflow-hidden rounded-md bg-raised">
                <Image
                  src={next.cover.src}
                  alt=""
                  width={next.cover.width}
                  height={next.cover.height}
                  sizes="(min-width: 48rem) 50vw, 100vw"
                  className="size-full object-cover"
                  style={{ backgroundColor: next.cover.dominant }}
                />
              </span>
              <span className="block">
                <span className="block type-h2 [overflow-wrap:anywhere] group-hover:underline">
                  <Txt v={t(next.title, locale)} />
                </span>
                <span className="mt-2 block type-meta nums-tabular">{next.year}</span>
              </span>
            </Link>
          </section>
        ) : null}

        {/* 8 · benzer projeler */}
        {related.length ? (
          <section aria-labelledby="related-title">
            <h2 id="related-title" className="type-h2">
              {dict.project.related}
            </h2>
            <div className="mt-stack grid gap-gutter md:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <ProjectCard key={p.slug} project={p} locale={locale} />
              ))}
            </div>
          </section>
        ) : null}

        {/* 9 · iletişim CTA'sı (§12.1) */}
        <section className="flex flex-col items-start gap-4 border-t border-line pt-block">
          <p className="type-lead">{dict.contact.cta}</p>
          <Button href={contact.href} hrefLang={contact.hrefLang} variant="secondary">
            {dict.hero.ctaSecondary}
            {contact.fallback ? dict.lang.trSuffix : null}
          </Button>
        </section>
      </div>
    </article>
  );
}
