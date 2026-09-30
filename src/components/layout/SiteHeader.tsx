// src/components/layout/SiteHeader.tsx — header (server) + istemci adaları (§3.9.1, §4.5.5, §6.6.2).
// ≥ 64rem: marka + 5 bağlantı + dil; < 64rem: marka + "Menü" düğmesi. HalkaIndicator M4'te eklenir.
import { getDictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';
import { getPerson, isLocaleEnabled } from '@/lib/content';
import { HeaderFrame } from './HeaderFrame';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MobileMenu } from './MobileMenu';
import { BrandLink, NavLinks, type NavLabels } from './NavLinks';
import { ThemeToggle } from './ThemeToggle';

export function SiteHeader({ locale, enPaths }: { locale: Locale; enPaths: readonly string[] }) {
  const dict = getDictionary(locale);
  const { name } = getPerson();
  const showLanguages = isLocaleEnabled('en');
  const navLabels: NavLabels = {
    about: dict.nav.about,
    areas: dict.nav.areas,
    projects: dict.nav.projects,
    cv: dict.nav.cv,
    contact: dict.nav.contact,
    trSuffix: dict.lang.trSuffix,
  };
  const langLabels = { group: dict.lang.group, unavailable: dict.lang.unavailable };

  return (
    <HeaderFrame className="sticky top-0 z-(--z-header) border-b border-line bg-canvas/92 pt-[env(safe-area-inset-top)] [view-transition-name:site-header] data-top:border-transparent data-top:bg-transparent">
      <div className="container-page flex h-header items-center justify-between gap-4">
        <BrandLink
          locale={locale}
          name={name}
          className="inline-flex min-h-11 items-center type-ui font-medium text-ink"
        />
        <nav aria-label={dict.nav.label} className="hidden lg:block">
          <NavLinks
            locale={locale}
            enPaths={enPaths}
            labels={navLabels}
            className="flex items-center gap-6"
            linkClassName="link-nav type-ui inline-flex min-h-11 min-w-11 items-center justify-center text-ink aria-[current]:[background-size:100%_1px] forced-colors:aria-[current]:underline"
          />
        </nav>
        <div className="flex items-center gap-2">
          {showLanguages && (
            <div className="hidden md:block">
              <LanguageSwitcher locale={locale} enPaths={enPaths} labels={langLabels} />
            </div>
          )}
          <div className="lg:hidden">
            <MobileMenu
              locale={locale}
              enPaths={enPaths}
              labels={{
                ...navLabels,
                navLabel: dict.nav.label,
                menu: dict.nav.menu,
                menuOpen: dict.a11y.menuOpen,
                menuClose: dict.a11y.menuClose,
              }}
            >
              {showLanguages && (
                <LanguageSwitcher locale={locale} enPaths={enPaths} labels={langLabels} />
              )}
              <ThemeToggle labels={dict.theme} />
            </MobileMenu>
          </div>
        </div>
      </div>
    </HeaderFrame>
  );
}
