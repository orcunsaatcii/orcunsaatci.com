// src/components/layout/SiteFooter.tsx — footer (server; full / compact, §3.9.3, §6.6.2).
// full: e-posta + Kopyala, birincil sosyal bağlantılar, CV (PDF), site bağlantıları, Gizlilik, dil, tema, yerel saat,
// "Başa dön", ©. compact (ana sayfa, contact bölümünün içinde): Gizlilik, dil, tema, "Hareketi azalt", "Başa dön", ©.
import Link from 'next/link';
import { CopyEmail } from '@/components/ui/CopyEmail';
import { CvDownload } from '@/components/ui/CvDownload';
import { EmailLink } from '@/components/ui/EmailLink';
import { HIT_AREA } from '@/components/ui/hit-area';
import { MotionToggle } from '@/components/motion/MotionToggle';
import { LocalTime } from '@/components/ui/LocalTime';
import { SocialLinks } from '@/components/ui/SocialLinks';
import { getDictionary } from '@/i18n/get-dictionary';
import { localeMeta, resolveLink, type Locale, type StaticRouteKey } from '@/i18n/config';
import { fill } from '@/i18n/text';
import { getContact, getPerson, isLocaleEnabled, t } from '@/lib/content';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

const SITE_LINKS = [
  'about',
  'expertise',
  'projects',
  'cv',
  'contact',
] as const satisfies readonly StaticRouteKey[];

interface SiteFooterProps {
  locale: Locale;
  enPaths: readonly string[];
  variant: 'full' | 'compact';
}

export function SiteFooter({ locale, enPaths, variant }: SiteFooterProps) {
  const dict = getDictionary(locale);
  const person = getPerson();
  const contact = getContact();
  const showLanguages = isLocaleEnabled('en');
  const enSet = new Set(enPaths);
  const year = new Date().getFullYear(); // build yılı (statik, §3.9.3)
  const label: Record<(typeof SITE_LINKS)[number], string> = {
    about: dict.nav.about,
    expertise: dict.meta.expertise,
    projects: dict.nav.projects,
    cv: dict.nav.cv,
    contact: dict.nav.contact,
  };
  const privacy = resolveLink({ key: 'privacy' }, locale, enSet);
  const [before, after] = fill(dict.footer.copyright, { year }).split('{name}');
  const linkClass =
    'link-nav type-ui inline-flex min-h-11 min-w-11 items-center justify-center text-ink-muted hover:text-ink';
  const hit = HIT_AREA;
  const full = variant === 'full';

  return (
    <footer
      data-site-footer={full ? 'full' : undefined}
      data-print="hide"
      className="border-t border-line"
    >
      <div
        className={['container-page grid-page', full ? 'gap-y-8 py-block' : 'gap-y-4 py-6'].join(
          ' ',
        )}
      >
        {full ? (
          <div className="col-span-4 flex flex-col gap-4 md:col-span-8 lg:col-span-12">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <EmailLink email={contact.email} id="footer-email" className={`type-ui ${hit}`} />
              <CopyEmail
                email={contact.email}
                targetId="footer-email"
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
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <SocialLinks
                locale={locale}
                className="flex flex-wrap gap-x-6 type-ui"
                linkClassName={`${hit} min-w-11`} // li içinde: flex öğesi değil
              />
              <CvDownload
                locale={locale}
                label={dict.footer.cvPdf}
                className={`link-inline type-ui ${hit}`}
              />
              <LocalTime
                city={t(person.location.city, locale).text}
                timeZone={person.location.timezone}
                intl={localeMeta[locale].intl}
                frozenSuffix={dict.contact.localTimeSuffix}
              />
            </div>
          </div>
        ) : null}
        {full ? (
          <nav
            aria-label={dict.footer.siteLinks}
            className="col-span-4 md:col-span-4 lg:col-span-6"
          >
            <ul className="flex flex-wrap gap-x-6">
              {SITE_LINKS.map((key) => {
                const { href, hrefLang, fallback } = resolveLink({ key }, locale, enSet);
                return (
                  <li key={key}>
                    <Link
                      prefetch={false}
                      transitionTypes={['nav-forward']}
                      href={href}
                      hrefLang={hrefLang}
                      className={linkClass}
                    >
                      {label[key]}
                      {fallback ? dict.lang.trSuffix : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
        <div
          className={[
            'col-span-4 flex flex-wrap items-center gap-x-6 gap-y-3 lg:justify-end',
            full ? 'md:col-span-4 lg:col-span-6' : 'md:col-span-8 lg:col-span-12',
          ].join(' ')}
        >
          <Link
            prefetch={false}
            transitionTypes={['nav-forward']}
            href={privacy.href}
            hrefLang={privacy.hrefLang}
            className={linkClass}
          >
            {dict.footer.privacy}
            {privacy.fallback ? dict.lang.trSuffix : null}
          </Link>
          {showLanguages && (
            <LanguageSwitcher
              locale={locale}
              enPaths={enPaths}
              labels={{ group: dict.lang.group, unavailable: dict.lang.unavailable }}
            />
          )}
          <ThemeToggle labels={dict.theme} />
          <MotionToggle label={dict.motion.reduce} />
        </div>
        <div className="col-span-4 flex flex-wrap items-center justify-between gap-4 md:col-span-8 lg:col-span-12">
          <p className="type-meta">
            {before}
            {locale === 'en' ? <span lang="tr">{person.name}</span> : person.name}
            {after}
          </p>
          <a href="#main" className={linkClass}>
            {dict.footer.backToTop}
          </a>
        </div>
      </div>
    </footer>
  );
}
