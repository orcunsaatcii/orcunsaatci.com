'use client';
// src/components/layout/NavLinks.tsx — header ve mobil menünün ortak bağlantı listesi (§3.9.1, D-41).
// "Ana sayfada mı?" kararı matchRoute(usePathname()) ile verilir; SSR'da da doğru href üretir (§8.3 kural 6).
// Etkin öğe (§4.14 #11): route sayfalarında aria-current="page"/"true"; ana sayfada scroll-spy (IntersectionObserver,
// rootMargin '-45% 0px -50% 0px') görünümdeki bölümün bağlantısına aria-current="true" yazar (canlı bölge yok). dot
// iken listenin altında 5 px vurgu noktası etkin öğeye translateX ile kayar (400 ms --ease-tick; globals.css).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  chapterAnchors,
  headerItems,
  matchRoute,
  resolveLink,
  staticRoutes,
  trail,
  type Locale,
} from '@/i18n/config';

/**
 * §9.7 / V-59 (M8): header bağlantıları `load`'dan önce prefetch etmez (görsel ağırlıklı sayfada hidrasyon `load`'dan
 * önce biter ve görünüm alanı prefetch'i LCP görseliyle yarışır). `load` sonrası Link varsayılanına döner; prop
 * değişince Link görünüm alanı gözlemini yeniden kurar. İstemci gezintisinde belge zaten `complete`'tir.
 */
const subscribeLoad = (onChange: () => void) => {
  window.addEventListener('load', onChange);
  return () => window.removeEventListener('load', onChange);
};
const useLoaded = () =>
  useSyncExternalStore(
    subscribeLoad,
    () => document.readyState === 'complete',
    () => false,
  );

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
  /** header: etkin öğenin altında kayan vurgu noktası */
  dot?: boolean;
}

export function NavLinks({
  locale,
  enPaths,
  labels,
  className,
  linkClassName,
  onNavigate,
  dot,
}: NavLinksProps) {
  const pathname = usePathname();
  const enSet = useMemo(() => new Set(enPaths), [enPaths]);
  const match = matchRoute(pathname);
  const isHome = match?.ref.key === 'home';
  const chain = match ? trail(match.ref).map((r) => r.key) : [];
  const [spy, setSpy] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const loaded = useLoaded();

  // Ana sayfa scroll-spy: görünüm ortasındaki bölüm
  useEffect(() => {
    if (!isHome) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries)
          if (en.isIntersecting) setSpy((en.target as HTMLElement).dataset.chapter ?? null);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    document.querySelectorAll('#main [data-chapter]').forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      setSpy(null);
    };
  }, [isHome]);

  // Vurgu noktası etkin öğenin ortasına kayar
  useEffect(() => {
    const ul = list.current;
    if (!dot || !ul) return;
    const place = () => {
      const a = ul.querySelector<HTMLElement>('[aria-current]');
      ul.style.setProperty('--dot-on', a ? '1' : '0');
      if (a) ul.style.setProperty('--dot-x', `${a.offsetLeft + a.offsetWidth / 2 - 2.5}px`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });

  return (
    <ul ref={list} className={[className, dot ? 'nav-dot' : null].filter(Boolean).join(' ')}>
      {headerItems.map(({ chapter, route }) => {
        const label = labels[LABEL_OF[chapter]];
        const emphasis = chapter === 'contact' ? 'font-strong' : undefined;
        if (isHome) {
          // Ana sayfada çapa: düz <a> (Link değil); kaydırmayı Lenis ya da tarayıcı yapar (§3.3)
          return (
            <li key={chapter}>
              <a
                href={`#${chapterAnchors[chapter][locale]}`}
                aria-current={spy === chapter ? 'true' : undefined}
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
              prefetch={loaded ? undefined : false}
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
  const loaded = useLoaded();
  const content = locale === 'en' ? <span lang="tr">{name}</span> : name;
  if (isHome) {
    return (
      <a href={`#${chapterAnchors.hero[locale]}`} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link
      prefetch={loaded ? undefined : false}
      href={staticRoutes.home[locale]}
      transitionTypes={['nav-back']}
      className={className}
    >
      {content}
    </Link>
  );
}
