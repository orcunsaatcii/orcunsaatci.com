// src/views/not-found/NotFoundView.tsx — ağaç 404 gövdesi (§3.7, §4.13.6). SVG ClockFigure; WebGL yok (D-19).
// M2: başlık, alt satır, gövde ve üç iç bağlantı. E-posta bağlantısı ve "Son projeler" M3'te; StagePreset none M5'te.
import Link from 'next/link';
import { ClockFigure } from '@/components/figures/ClockFigure';
import { staticRoutes, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';

export function NotFoundView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.notFound;
  const links = [
    { href: staticRoutes.home[locale], label: t.home },
    { href: staticRoutes.projects[locale], label: t.projects },
    { href: staticRoutes.contact[locale], label: t.contact },
  ];
  return (
    <div
      data-404="tree"
      className="container-page grid-page items-center gap-y-block pt-block pb-section"
    >
      <div className="col-span-4 md:col-span-8 lg:col-span-6">
        <h1 className="type-h1">{t.title}</h1>
        <p className="mt-stack type-lead">{t.lead}</p>
        <p className="mt-4 type-body text-ink-muted">{t.body}</p>
        <ul className="mt-stack flex flex-wrap gap-x-6">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-flex min-h-11 items-center link-inline type-ui">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="col-span-4 mx-auto w-full max-w-sm md:col-span-6 md:col-start-2 lg:col-span-5 lg:col-start-8">
        <ClockFigure label={t.clock} />
      </div>
    </div>
  );
}
