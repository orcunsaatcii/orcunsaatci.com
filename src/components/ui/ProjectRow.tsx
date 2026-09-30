// src/components/ui/ProjectRow.tsx — /projeler satırı (§6.6.3, §7.8.2, §7.8.3). Server.
// Satırın tek bağlantısı başlıktır (::after ile gerilir); meta <dl> içindedir. data-project/data-areas filtre kancası.
// < 64rem: başlığın üstünde satır içi 16:10 küçük görsel (içerik eşitliği). Yüzen önizleme M7'dedir.
import Image from 'next/image';
import Link from 'next/link';
import { pathOf, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { t, type ProjectDoc } from '@/lib/content';
import { Txt } from './Txt';

export function ProjectRow({ project, locale }: { project: ProjectDoc; locale: Locale }) {
  const dict = getDictionary(locale);
  const cover = project.cover;
  return (
    <li data-project="" data-areas={project.areas.join(' ')} className="border-b border-line">
      <article
        data-focus-ring=""
        className="group relative grid grid-cols-[1fr_auto] items-baseline gap-x-gutter py-6 outline-offset-3 transition-colors duration-(--dur-base) hover:bg-raised has-[a:focus-visible]:bg-raised has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-focus lg:grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,10rem))_4rem_1.5rem] xl:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_repeat(2,minmax(0,10rem))_4rem_1.5rem]"
      >
        <div className="col-span-2 mb-3 aspect-card overflow-hidden rounded-md bg-raised lg:hidden">
          <Image
            src={cover.src}
            alt=""
            width={cover.width}
            height={cover.height}
            sizes="100vw"
            className="size-full object-cover"
            style={{ backgroundColor: cover.dominant }}
          />
        </div>
        <div className="transition-transform duration-(--dur-base) ease-out motion-on:group-hover:translate-x-2 motion-on:group-has-[a:focus-visible]:translate-x-2">
          <h2 className="type-h4">
            <Link
              href={pathOf({ key: 'project', param: project.slug }, locale)}
              className="after:absolute after:inset-0 focus-visible:outline-none"
            >
              <Txt v={t(project.title, locale)} />
            </Link>
          </h2>
          <p className="mt-1 line-clamp-2 type-ui text-ink-muted">
            <Txt v={t(project.summary, locale)} />
          </p>
        </div>
        <dl className="contents type-meta group-hover:text-ink-muted group-has-[a:focus-visible]:text-ink-muted">
          <div className="hidden xl:block">
            <dt className="sr-only">{dict.project.facts.role}</dt>
            <dd>
              <Txt v={t(project.role, locale)} />
            </dd>
          </div>
          <div className="hidden lg:block">
            <dt className="sr-only">{dict.project.facts.kind}</dt>
            <dd>{dict.project.kinds[project.kind]}</dd>
          </div>
          <div className="hidden lg:block">
            <dt className="sr-only">{dict.project.facts.status}</dt>
            <dd>{dict.project.statuses[project.status]}</dd>
          </div>
          <div>
            <dt className="sr-only">{dict.project.facts.dates}</dt>
            <dd className="nums-tabular">{project.year}</dd>
          </div>
        </dl>
        <span
          aria-hidden="true"
          className="hidden text-ink opacity-0 transition-opacity duration-(--dur-fast) group-hover:opacity-100 group-has-[a:focus-visible]:opacity-100 lg:inline"
        >
          →
        </span>
      </article>
    </li>
  );
}
