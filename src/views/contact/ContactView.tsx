// src/views/contact/ContactView.tsx — /iletisim (§12.1, §4.13). Server; form yok (D-22, v1.1'de).
import { PageHeader } from '@/components/layout/PageHeader';
import { JsonLd } from '@/components/seo/JsonLd';
import { CopyEmail } from '@/components/ui/CopyEmail';
import { CvDownload } from '@/components/ui/CvDownload';
import { EmailLink } from '@/components/ui/EmailLink';
import { LocalTime } from '@/components/ui/LocalTime';
import { SocialLinks } from '@/components/ui/SocialLinks';
import { Txt } from '@/components/ui/Txt';
import { localeMeta, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getContact, getPerson, getStageData, t } from '@/lib/content';
import { jsonLdFor } from '@/lib/seo/jsonld';
import { StagePreset } from '@/stage/StagePreset';

export function ContactView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const contact = getContact();
  const person = getPerson();
  const status = contact.availability?.status;
  const note = contact.availability?.note;
  const graph = jsonLdFor({ key: 'contact' }, locale);
  return (
    <>
      {graph ? <JsonLd graph={graph} /> : null}
      <StagePreset name="contact-page" data={getStageData('contact-page', undefined, locale)} />
      <PageHeader
        pageRef={{ key: 'contact' }}
        locale={locale}
        title={dict.meta.contact}
        lede={dict.contact.cta}
        folio={{ preset: 'contact-page', poster: 'k5' }}
      />
      <div className="container-page flex flex-col items-start gap-6 pt-block pb-section">
        <div className="flex flex-col items-start gap-4">
          <EmailLink email={contact.email} id="contact-page-email" size="display" />
          <CopyEmail
            email={contact.email}
            targetId="contact-page-email"
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
        {contact.responseTime ? (
          <p className="type-body">
            <Txt v={t(contact.responseTime, locale)} />
          </p>
        ) : null}
        {status ? (
          <p className="type-ui text-ink-muted">
            {dict.availability[status]}
            {note ? (
              <>
                {' — '}
                <Txt v={t(note, locale)} />
              </>
            ) : null}
          </p>
        ) : null}
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
        {contact.phone ? (
          <p className="type-ui">
            <a href={`tel:${contact.phone}`} className="link-inline" translate="no">
              {contact.phone}
            </a>
          </p>
        ) : null}
      </div>
    </>
  );
}
