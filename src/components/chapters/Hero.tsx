// src/components/chapters/Hero.tsx — giriş bölümü (§4.6, §6.6.7, §7.9.2). Server; ilk boyamada görünür.
// H1 LCP öğesidir: asla animasyon, maske, opaklık ya da clip yok (D-34). CTA'lar gerçek URL (D-41).
// Magnetic sarmalayıcı M7'de; hero-rest çapasında statik K0 posteri (D-45, §5.16.4). Duraklatma düğmesi sahne
// bölgesinin sağ altında ama aria-hidden çapanın DIŞINDA ve DOM'da sonda (odak sırası = görsel okuma sırası).
import { PauseButton } from '@/components/motion/PauseButton';
import { Button } from '@/components/ui/Button';
import { LocalTime } from '@/components/ui/LocalTime';
import { Txt } from '@/components/ui/Txt';
import { chapterAnchors, localeMeta, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getHome, getPerson, t } from '@/lib/content';
import { pageLink } from '@/lib/seo/metadata';
import { StageAnchor } from '@/stage/ScenePoster';

export function Hero({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const person = getPerson();
  const home = getHome();
  const city = t(person.location.city, locale);
  const jobTitle = t(person.jobTitle, locale);
  const eyebrow = home.hero.eyebrow ? t(home.hero.eyebrow, locale) : null;
  const cut = person.name.lastIndexOf(' ');
  const [first, last] =
    cut > 0 ? [person.name.slice(0, cut), person.name.slice(cut + 1)] : [person.name, ''];
  const projects = pageLink({ key: 'projects' }, locale);
  const contact = pageLink({ key: 'contact' }, locale);

  return (
    <section
      id={chapterAnchors.hero[locale]}
      data-chapter="hero"
      aria-labelledby="hero-title"
      className="container-page grid-page content-center gap-y-6"
    >
      <div className="hero-stage relative col-span-4 row-start-1 h-[40svh] md:col-span-8 lg:col-span-5 lg:col-start-8">
        <StageAnchor id="hero-rest" poster="k0" className="size-full" />
      </div>
      <p className="hero-in col-span-4 type-eyebrow [--i:0] md:col-span-8 lg:col-span-6 lg:row-start-1 lg:self-end">
        {eyebrow ? (
          <Txt v={eyebrow} />
        ) : (
          <>
            <Txt v={jobTitle} /> · <Txt v={city} />
          </>
        )}
      </p>
      <h1
        id="hero-title"
        className="col-span-4 type-display md:col-span-8 lg:col-span-12"
        lang={locale === 'en' ? 'tr' : undefined}
      >
        {first}
        {last ? (
          <>
            {/* §9.5.4 çözüm 1: H1 tek LCP adayı; 64rem altında satır <br> ile kırılır */}
            <br className="lg:hidden" /> {last}
          </>
        ) : null}
      </h1>
      <p className="hero-in col-span-4 type-lead [--i:1] md:col-span-6">
        <Txt v={t(person.headline, locale)} />
      </p>
      <div className="hero-in col-span-4 flex flex-col gap-3 [--i:2] sm:flex-row md:col-span-8">
        <Button href={projects.href} hrefLang={projects.hrefLang}>
          {dict.hero.ctaPrimary}
          {projects.fallback ? dict.lang.trSuffix : null}
          <span aria-hidden="true">→</span>
        </Button>
        <Button href={contact.href} hrefLang={contact.hrefLang} variant="secondary">
          {dict.hero.ctaSecondary}
          {contact.fallback ? dict.lang.trSuffix : null}
        </Button>
      </div>
      <div className="col-span-4 flex items-center justify-between gap-4 md:col-span-8 lg:col-span-12">
        <p aria-hidden="true" className="inline-flex items-center gap-3 type-meta">
          {dict.hero.scrollCue}
          <span className="hero-cue-line [display:inline-block] h-px w-8 bg-ink-subtle" />
        </p>
        <LocalTime
          city={city.text}
          timeZone={person.location.timezone}
          intl={localeMeta[locale].intl}
          frozenSuffix={dict.contact.localTimeSuffix}
        />
      </div>
      {/* DOM'da sonda (§4.6.3 sırası); görsel olarak sahne bölgesinin sağ altında, aynı grid alanında (home.css) */}
      <PauseButton
        labels={{ pause: dict.motion.pause, play: dict.motion.play }}
        className="hero-pause"
      />
    </section>
  );
}
