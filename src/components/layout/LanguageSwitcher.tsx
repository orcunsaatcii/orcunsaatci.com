// src/components/layout/LanguageSwitcher.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useMemo } from 'react';
import { equivalentPath, localeMeta, locales, type Locale } from '@/i18n/config';

interface LanguageSwitcherProps {
  locale: Locale; // içinde bulunulan ağacın dili
  enPaths: readonly string[]; // kök layout: listPages() → EN'de var olan yollar (§11.4)
  labels: { group: string; unavailable: string }; // dict.lang.group, dict.lang.unavailable
}

const CELL = 'inline-flex min-h-11 min-w-11 items-center justify-center px-2';

export function LanguageSwitcher({ locale, enPaths, labels }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const enSet = useMemo(() => new Set(enPaths), [enPaths]);
  const noteId = useId();
  return (
    <div
      role="group"
      aria-label={labels.group}
      data-language-switcher=""
      className="flex items-center type-ui"
    >
      {locales.map((l, i) => {
        const sep =
          i > 0 ? (
            <span aria-hidden="true" className="text-ink-subtle">
              ·
            </span>
          ) : null;
        const meta = localeMeta[l];
        if (l === locale) {
          return (
            <span key={l} className="inline-flex items-center">
              {sep}
              <span lang={meta.htmlLang} aria-current="true" className={CELL + ' text-ink'}>
                {meta.short}
                <span className="sr-only"> — {meta.name}</span>
              </span>
            </span>
          );
        }
        const { href, exact } = equivalentPath(pathname, l, enSet);
        return (
          <span key={l} className="inline-flex items-center">
            {sep}
            <Link
              href={href}
              hrefLang={meta.hreflang}
              lang={meta.htmlLang}
              prefetch={false}
              aria-describedby={exact ? undefined : noteId}
              data-fallback={exact ? undefined : 'home'}
              className={CELL + ' text-ink-muted hover:text-ink'}
            >
              {meta.short}
              <span className="sr-only"> — {meta.name}</span>
            </Link>
            {!exact && (
              <span id={noteId} className="sr-only">
                {labels.unavailable}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
