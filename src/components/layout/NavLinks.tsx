'use client';
// src/components/layout/NavLinks.tsx — header ve mobil menünün ortak bağlantı listesi (§3.9.1, D-41).
// "Ana sayfada mı?" kararı matchRoute(usePathname()) ile verilir; SSR'da da doğru href üretir (§8.3 kural 6).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import {
  chapterAnchors,
  headerItems,
  matchRoute,
  resolveLink,
  staticRoutes,
  trail,
  type Locale,
} from '@/i18n/config';

export interface NavLabels {
  about: string;
  areas: string;
  projects: string;
  cv: string;
  contact: string;
  trSuffix: string;
}

/** headerItems bölüm kimliği → etiket anahtarı */
const LABEL_OF = {
  about: 'about',
  areas: 'areas',
  work: 'projects',
  journey: 'cv',
  contact: 'contact',
} as const;

interface NavLinksProps {
  locale: Locale;
  enPaths: readonly string[];
  labels: NavLabels;
  className?: string;
  linkClassName?: string;
  onNavigate?: () => void;
}

export function NavLinks({
  locale,
  enPaths,
  labels,
  className,
  linkClassName,
  onNavigate,
}: NavLinksProps) {
  const pathname = usePathname();
  const enSet = useMemo(() => new Set(enPaths), [enPaths]);
  const match = matchRoute(pathname);
  const isHome = match?.ref.key === 'home';
  const chain = match ? trail(match.ref).map((r) => r.key) : [];

  return (
    <ul className={className}>
      {headerItems.map(({ chapter, route }) => {
        const label = labels[LABEL_OF[chapter]];
        const emphasis = chapter === 'contact' ? 'font-strong' : undefined;
        if (isHome) {
          // Ana sayfada çapa: düz <a> (Link değil); kaydırmayı Lenis ya da tarayıcı yapar (§3.3)
          return (
            <li key={chapter}>
              <a
                href={`#${chapterAnchors[chapter][locale]}`}
                className={[linkClassName, emphasis].filter(Boolean).join(' ')}
                onClick={onNavigate}
              >
                {label}
              </a>
            </li>
          );
        }
        const { href, hrefLang, fallback } = resolveLink({ key: route }, locale, enSet);
        const current =
          match?.ref.key === route ? 'page' : chain.includes(route) ? 'true' : undefined;
        return (
          <li key={chapter}>
            <Link
              href={href}
              hrefLang={hrefLang}
              transitionTypes={['nav-forward']}
              aria-current={current}
              className={[linkClassName, emphasis].filter(Boolean).join(' ')}
              onClick={onNavigate}
            >
              {label}
              {fallback ? labels.trSuffix : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Marka: ana sayfada #giris / #intro çapası, diğer sayfalarda ana sayfa (nav-back). EN'de ad lang="tr" (§3.8). */
export function BrandLink({
  locale,
  name,
  className,
}: {
  locale: Locale;
  name: string;
  className?: string;
}) {
  const isHome = matchRoute(usePathname())?.ref.key === 'home';
  const content = locale === 'en' ? <span lang="tr">{name}</span> : name;
  if (isHome) {
    return (
      <a href={`#${chapterAnchors.hero[locale]}`} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={staticRoutes.home[locale]} transitionTypes={['nav-back']} className={className}>
      {content}
    </Link>
  );
}
