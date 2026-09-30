// src/components/chapters/About.tsx — "Kesim" bölümü (§4.7.2, §4.7.7, §6.6.7). Server.
// DOM: başlık → bant (çapa + kesit çizgisi) → lede → gövde. Masaüstünde bant 1 px'lik satırdır: çizgi k1–8,
// çapa k8–12 ve dikey merkezi çizgide; mobilde lede'nin üstünde 36 svh bant (home.css). Lede satırları cutProgress
// eşiklerinde açılır (CutLine); JS'siz/azaltılmış hâlde her şey görünür, çizgi tam genişlikte statiktir.
import Image from 'next/image';
import Link from 'next/link';
import { CutLine } from '@/components/motion/CutLine';
import { RevealHeading } from '@/components/motion/RevealHeading';
import { Txt } from '@/components/ui/Txt';
import { getExperienceProfile } from '@/experience/profile';
import { chapterAnchors, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { plural } from '@/i18n/text';
import {
  getCareerStartYear,
  getHome,
  getHomeJourney,
  getPerson,
  getSite,
  getWorksFor,
  t,
} from '@/lib/content';
import { pageLink } from '@/lib/seo/metadata';
import { StageAnchor } from '@/stage/ScenePoster';

export function About({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const site = getSite();
  const person = getPerson();
  const home = getHome();
  const labels = getExperienceProfile(site.persona).labels;
  const years = new Date().getFullYear() - getCareerStartYear(); // build yılı − kariyer başlangıcı
  const languages = getHomeJourney(locale).languages.map((l) => t(l.name, locale));
  const now = home.about.now ? t(home.about.now, locale) : null;
  const worksFor = getWorksFor();
  const portrait = site.features.portraitOnHome ? person.portrait : undefined;
  const more = pageLink({ key: 'about' }, locale);
  const heading = home.about.heading ? t(home.about.heading, locale) : null;

  return (
    <section
      id={chapterAnchors.about[locale]}
      data-chapter="about"
      aria-labelledby="about-title"
      className="container-page grid-page gap-y-6 py-section"
    >
      <div className="col-span-4 md:col-span-8 lg:col-span-6 lg:row-start-1">
        <p className="type-eyebrow" data-reveal="block">
          {labels.eyebrows.about[locale]}
        </p>
        <RevealHeading id="about-title" className="mt-4 type-h2">
          {heading ? <Txt v={heading} /> : dict.meta.about}
        </RevealHeading>
      </div>
      <div aria-hidden="true" className="about-band lg:row-start-3">
        <StageAnchor id="about-cut" poster="k1" />
        <CutLine />
      </div>
      <p
        data-reveal="lede"
        className="col-span-4 max-w-[24ch] text-3xl font-medium md:col-span-8 lg:col-span-6 lg:row-start-2"
      >
        <Txt v={t(home.about.lede, locale)} />
      </p>
      <div className="col-span-4 md:col-span-8 lg:col-span-6 lg:row-start-4">
        {home.about.paragraphs.map((p, i) => (
          <p key={i} data-reveal="block" className="mt-4 type-body first:mt-0">
            <Txt v={t(p, locale)} />
          </p>
        ))}
        <dl
          data-reveal="block"
          className="mt-stack grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 type-meta nums-tabular"
        >
          <dt>{dict.home.facts.location}</dt>
          <dd className="text-ink-muted">
            <Txt v={t(person.location.city, locale)} />
          </dd>
          <dt>{dict.home.facts.experience}</dt>
          <dd className="text-ink-muted">{plural(locale, years, dict.home.years)}</dd>
          {languages.length ? (
            <>
              <dt>{dict.home.facts.languages}</dt>
              <dd className="text-ink-muted">
                {languages.map((l, i) => (
                  <span key={i}>
                    {i > 0 ? ', ' : ''}
                    <Txt v={l} />
                  </span>
                ))}
              </dd>
            </>
          ) : null}
          {now || worksFor ? (
            <>
              <dt>{dict.home.facts.now}</dt>
              <dd className="text-ink-muted">
                {now ? (
                  <Txt v={now} />
                ) : worksFor ? (
                  <>
                    <Txt v={t(worksFor.role, locale)} /> · {worksFor.organization}
                  </>
                ) : null}
              </dd>
            </>
          ) : null}
        </dl>
        {portrait ? (
          <figure className="mt-stack max-w-[16rem]">
            <div data-reveal="clip" className="overflow-hidden rounded-md">
              <Image
                src={portrait.src}
                alt={t(portrait.alt, locale).text}
                width={portrait.width}
                height={portrait.height}
                sizes="16rem"
                className="aspect-portrait h-auto w-full object-cover"
                style={{ backgroundColor: portrait.dominant }}
              />
            </div>
            {portrait.caption ? (
              <figcaption className="mt-2 type-meta">
                <Txt v={t(portrait.caption, locale)} />
              </figcaption>
            ) : null}
          </figure>
        ) : null}
        <p className="mt-stack" data-reveal="block">
          <Link href={more.href} hrefLang={more.hrefLang} className="link-inline type-ui">
            {dict.home.aboutMore}
            {more.fallback ? dict.lang.trSuffix : null}
            <span aria-hidden="true"> →</span>
          </Link>
        </p>
      </div>
    </section>
  );
}
