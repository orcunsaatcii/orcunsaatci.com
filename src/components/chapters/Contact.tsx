// src/components/chapters/Contact.tsx — "Bir sonraki halka" (§4.11.2, §12.1). Server.
// mailto: + Kopyala + sosyal bağlantılar + CV + yerel saat; compact footer bölümün içindedir (§3.9.3).
// contact-ring çapasında statik K5 posteri; gerçek tarih yayını (ArcFigure) M4'te.
import Link from 'next/link';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { CopyEmail } from '@/components/ui/CopyEmail';
import { CvDownload } from '@/components/ui/CvDownload';
import { EmailLink } from '@/components/ui/EmailLink';
import { LocalTime } from '@/components/ui/LocalTime';
import { SocialLinks } from '@/components/ui/SocialLinks';
import { Txt } from '@/components/ui/Txt';
import { getExperienceProfile } from '@/experience/profile';
import { chapterAnchors, localeMeta, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getContact, getHome, getPerson, getSite, t } from '@/lib/content';
import { listEnPaths, pageLink } from '@/lib/seo/metadata';
import { StageAnchor } from '@/stage/ScenePoster';

export function Contact({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const labels = getExperienceProfile(getSite().persona).labels;
  const home = getHome();
  const person = getPerson();
  const contact = getContact();
  const more = pageLink({ key: 'contact' }, locale);
  const heading = home.contact.heading ? t(home.contact.heading, locale) : null;
  const lead = home.contact.lead ? t(home.contact.lead, locale) : null;
  const status = contact.availability?.status;

  return (
    <section
      id={chapterAnchors.contact[locale]}
      data-chapter="contact"
      aria-labelledby="contact-title"
      className="flex min-h-svh flex-col"
    >
      <div className="container-page grid-page flex-1 content-center gap-y-6 py-section">
        <StageAnchor
          id="contact-ring"
          poster="k5"
          className="col-span-4 h-[36svh] md:col-span-8 lg:col-span-5 lg:col-start-8 lg:row-span-4 lg:h-[72svh] lg:self-center"
        />
        <div className="col-span-4 md:col-span-8 lg:col-span-7 lg:row-start-1">
          <p className="type-eyebrow">{labels.eyebrows.contact[locale]}</p>
          <h2 id="contact-title" className="mt-4 type-h2">
            {heading ? <Txt v={heading} /> : dict.nav.contact}
          </h2>
          <p className="mt-stack type-lead">
            {lead ? <Txt v={lead} /> : labels.contactLead[locale]}
          </p>
        </div>
        <div className="col-span-4 flex flex-col items-start gap-4 md:col-span-8 lg:col-span-7">
          <EmailLink email={contact.email} id="contact-email" size="display" />
          <CopyEmail
            email={contact.email}
            targetId="contact-email"
            labels={{
              copy: dict.contact.copy,
              copied: dict.contact.copied,
              copyLabel: dict.contact.copyLabel,
              toast: dict.contact.toast,
              copyFailed: dict.contact.copyFailed,
              close: dict.a11y.close,
            }}
          />
        </div>
        <div className="col-span-4 flex flex-col gap-4 md:col-span-8 lg:col-span-7">
          <SocialLinks locale={locale} className="flex flex-wrap gap-x-6 gap-y-2 type-ui" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <CvDownload locale={locale} label={dict.contact.cvPdf} />
            <LocalTime
              city={t(person.location.city, locale).text}
              timeZone={person.location.timezone}
              intl={localeMeta[locale].intl}
              frozenSuffix={dict.contact.localTimeSuffix}
            />
          </div>
          {status ? <p className="type-ui text-ink-muted">{dict.availability[status]}</p> : null}
          <p>
            <Link href={more.href} hrefLang={more.hrefLang} className="link-inline type-ui">
              {dict.home.allContact}
              {more.fallback ? dict.lang.trSuffix : null}
            </Link>
          </p>
        </div>
      </div>
      <SiteFooter locale={locale} enPaths={listEnPaths()} variant="compact" />
    </section>
  );
}
