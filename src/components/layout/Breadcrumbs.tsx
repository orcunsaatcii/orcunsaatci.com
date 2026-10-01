// src/components/layout/Breadcrumbs.tsx — derin sayfa izi (server, §3.9.2, §6.6.2).
// Zincir trail(ref) ile kurulur; son öğe bağlantı değildir ve aria-current="page" taşır.
// JSON-LD BreadcrumbList aynı adlarla M3'te üretilir (§11.6).
import Link from 'next/link';
import { HIT_AREA_FLUSH } from '@/components/ui/hit-area';
import { getDictionary } from '@/i18n/get-dictionary';
import { pathOf, trail, type Locale, type PageRef } from '@/i18n/config';

type MetaKey = keyof ReturnType<typeof getDictionary>['meta'];

interface BreadcrumbsProps {
  pageRef: PageRef;
  locale: Locale;
  /** project / area için sayfa başlığı (M3'te içerikten) */
  title?: string;
}

export function Breadcrumbs({ pageRef, locale, title }: BreadcrumbsProps) {
  const dict = getDictionary(locale);
  const name = (ref: PageRef): string => {
    if (ref.key === 'home') return dict.breadcrumb.home;
    if (ref.key === 'project' || ref.key === 'area') return title ?? ref.param;
    return dict.meta[ref.key as MetaKey];
  };
  const chain = trail(pageRef);

  return (
    <nav aria-label={dict.breadcrumb.label} className="type-meta">
      <ol>
        {chain.map((ref, i) => {
          const last = i === chain.length - 1;
          const href = pathOf(ref, locale);
          return (
            <li key={`${ref.key}-${i}`} className="inline">
              {i > 0 && (
                <span aria-hidden="true" className="mx-2 text-ink-subtle">
                  /
                </span>
              )}
              {last || href === null ? (
                <span
                  aria-current={last ? 'page' : undefined}
                  className="[overflow-wrap:anywhere] text-ink"
                >
                  {name(ref)}
                </span>
              ) : (
                <Link
                  transitionTypes={['nav-back']}
                  href={href}
                  className={`${HIT_AREA_FLUSH} text-ink-muted hover:text-ink`}
                >
                  {name(ref)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
