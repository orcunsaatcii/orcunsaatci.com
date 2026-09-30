// src/components/ui/ProjectCard.tsx — 16:10 kapaklı proje kartı (§6.6.3, §7.8.3). Server.
// Kart başına tek bağlantı: başlık ::after ile gerilir; iç içe etkileşimli öğe YASAK. Odak halkası kartın tamamında.
import Image from 'next/image';
import Link from 'next/link';
import { pathOf, type Locale } from '@/i18n/config';
import { getAreas, t, type ProjectDoc } from '@/lib/content';
import { Txt } from './Txt';

interface ProjectCardProps {
  project: ProjectDoc;
  locale: Locale;
  headingLevel?: 'h2' | 'h3';
  sizes?: string;
}

export function ProjectCard({
  project,
  locale,
  headingLevel: Heading = 'h3',
  sizes = '(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw',
}: ProjectCardProps) {
  const areas = getAreas();
  const areaTitles = project.areas.map(
    (id) => t(areas.find((a) => a.id === id)?.title, locale).text,
  );
  const cover = project.cover;
  return (
    <article
      data-focus-ring=""
      className="group @container relative rounded-md outline-offset-3 transition-transform duration-(--dur-instant) ease-standard active:scale-[0.99] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-focus"
    >
      <div className="aspect-card overflow-hidden rounded-md bg-raised">
        <Image
          src={cover.src}
          alt={t(cover.alt, locale).text}
          width={cover.width}
          height={cover.height}
          sizes={sizes}
          className="size-full object-cover transition-transform duration-[600ms] ease-out motion-on:group-hover:scale-[1.03]"
          style={{ backgroundColor: cover.dominant }}
        />
      </div>
      <Heading className="mt-4 type-title @[24rem]:type-h4">
        <Link
          href={pathOf({ key: 'project', param: project.slug }, locale)}
          className="after:absolute after:inset-0 focus-visible:outline-none"
        >
          <Txt v={t(project.title, locale)} />
          <span
            aria-hidden="true"
            className="ml-2 opacity-0 transition-opacity duration-(--dur-fast) group-hover:opacity-100"
          >
            →
          </span>
        </Link>
      </Heading>
      <p className="mt-2 line-clamp-2 type-body text-ink-muted">
        <Txt v={t(project.summary, locale)} />
      </p>
      <p className="mt-2 type-meta">
        {project.year} · <Txt v={t(project.role, locale)} />
      </p>
      {areaTitles.length ? <p className="type-meta">{areaTitles.join(' · ')}</p> : null}
    </article>
  );
}
