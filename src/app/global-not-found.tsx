// src/app/global-not-found.tsx — eşleşmeyen her URL için iki dilli 404 (D-19, §3.7). Kendi <html>/<body>'si vardır;
// globals.css, fontlar ve head script'i kendisi yükler. StageRoot, Lenis, GSAP, site header'ı ve footer'ı YOKTUR.
// E-posta bağlantısı yalnız TR listesinde (§3.7 iskeleti). Minimal footer'da "Hareketi azalt" anahtarı (§10.2.2).
import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ClockFigure } from '@/components/figures/ClockFigure';
import { MotionToggle } from '@/components/motion/MotionToggle';
import { EmailLink } from '@/components/ui/EmailLink';
import { fontVariables } from '@/fonts';
import { staticRoutes, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getContact, getPerson, isLocaleEnabled } from '@/lib/content';
import { headScript } from '@/lib/head-script';

const tr = getDictionary('tr');
const en = getDictionary('en');
const hasEn = isLocaleEnabled('en');

// robots yazılmaz: Next 404 yanıtlarına noindex'i kendisi ekler; ikinci bir robots meta'sı çift etiket üretir
// (SPEC-SAPMA §3.7).
export const metadata: Metadata = {
  title: `${tr.meta.notFound}${hasEn ? ` · ${en.meta.notFound}` : ''} — ${getPerson().name}`,
};

function Links({ locale, email }: { locale: Locale; email?: string }) {
  const t = locale === 'tr' ? tr.notFound : en.notFound;
  const links = [
    { href: staticRoutes.home[locale], label: t.home },
    { href: staticRoutes.projects[locale], label: t.projects },
    { href: staticRoutes.contact[locale], label: t.contact },
  ];
  return (
    <ul className="mt-4 flex flex-wrap gap-x-6">
      {links.map((l) => (
        <li key={l.href}>
          <Link
            transitionTypes={['nav-forward']}
            href={l.href}
            className="inline-flex min-h-11 items-center link-inline type-ui"
          >
            {l.label}
          </Link>
        </li>
      ))}
      {email ? (
        <li className="inline-flex min-h-11 items-center">
          <EmailLink email={email} className="type-ui" />
        </li>
      ) : null}
    </ul>
  );
}

export default function GlobalNotFound() {
  return (
    <html lang="tr" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: headScript }} />
      </head>
      <body>
        <main
          id="main"
          data-404="global"
          className="container-page grid-page min-h-svh content-center items-center gap-y-block py-block"
        >
          <div className="col-span-4 md:col-span-8 lg:col-span-6">
            <h1 className="type-h1">
              {tr.notFound.title}
              {hasEn && (
                <span lang="en" className="block text-ink-muted">
                  <span className="sr-only"> · </span>
                  {en.notFound.title}
                </span>
              )}
            </h1>
            <p className="mt-stack type-lead">{tr.notFound.lead}</p>
            <Links locale="tr" email={getContact().email} />
            {hasEn && (
              <div lang="en" className="mt-stack">
                <p className="type-lead">{en.notFound.lead}</p>
                <Links locale="en" />
              </div>
            )}
          </div>
          <div className="col-span-4 mx-auto w-full max-w-sm md:col-span-6 md:col-start-2 lg:col-span-5 lg:col-start-8">
            <ClockFigure label={tr.notFound.clock} />
          </div>
        </main>
        <footer className="container-page border-t border-line py-6">
          <MotionToggle
            markHydrated
            label={
              <>
                {tr.motion.reduce}
                {hasEn && (
                  <span lang="en">
                    {' / '}
                    {en.motion.reduce}
                  </span>
                )}
              </>
            }
          />
        </footer>
      </body>
    </html>
  );
}
