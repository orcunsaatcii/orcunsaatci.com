// src/components/layout/SiteFooter.tsx — footer (server; full / compact, §3.9.3, §6.6.2).
// M2: site bağlantıları, Gizlilik, dil, tema, "Başa dön", ©. E-posta, sosyal bağlantılar, CV ve yerel saat M3'te;
// MotionToggle M4'te eklenir.
import Link from 'next/link';
import { getDictionary } from '@/i18n/get-dictionary';
import { resolveLink, type Locale, type StaticRouteKey } from '@/i18n/config';
import { getPerson, getSite } from '@/lib/content';
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
  const { name } = getPerson();
  const showLanguages = getSite().locales.includes('en');
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
  const [before, after] = dict.footer.copyright.replace('{year}', String(year)).split('{name}');
  const linkClass =
    'link-nav type-ui inline-flex min-h-11 min-w-11 items-center justify-center text-ink-muted hover:text-ink';

  return (
    <footer
      data-site-footer={variant === 'full' ? 'full' : undefined}
      className="border-t border-line"
    >
      <div className="container-page grid-page gap-y-8 py-block">
        {variant === 'full' && (
          <nav
            aria-label={dict.footer.siteLinks}
            className="col-span-4 md:col-span-4 lg:col-span-6"
          >
            <ul className="flex flex-wrap gap-x-6">
              {SITE_LINKS.map((key) => {
                const { href, hrefLang, fallback } = resolveLink({ key }, locale, enSet);
                return (
                  <li key={key}>
                    <Link href={href} hrefLang={hrefLang} className={linkClass}>
                      {label[key]}
                      {fallback ? dict.lang.trSuffix : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <div
          className={[
            'col-span-4 flex flex-wrap items-center gap-x-6 gap-y-3 lg:justify-end',
            variant === 'full' ? 'md:col-span-4 lg:col-span-6' : 'md:col-span-8 lg:col-span-12',
          ].join(' ')}
        >
          <Link href={privacy.href} hrefLang={privacy.hrefLang} className={linkClass}>
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
        </div>
        <div className="col-span-4 flex flex-wrap items-center justify-between gap-4 md:col-span-8 lg:col-span-12">
          <p className="type-meta">
            {before}
            {locale === 'en' ? <span lang="tr">{name}</span> : name}
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
