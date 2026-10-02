// src/views/not-found/NotFoundView.tsx — ağaç 404 gövdesi (§3.7, §4.13.6). Statik KOD hata çıktısı; WebGL yok (D-19).
// Başlık, alt satır, gövde, üç iç bağlantı, e-posta ve "Son projeler" (3). StagePreset none M5'te.
import Link from 'next/link';
import { KodPanel } from '@/components/kod/KodPanel';
import { EmailLink } from '@/components/ui/EmailLink';
import { Txt } from '@/components/ui/Txt';
import { staticRoutes, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { pathOf } from '@/i18n/config';
import { getContact, getKodData, getProjects, t } from '@/lib/content';

export function NotFoundView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t_ = dict.notFound;
  const latest = getProjects(locale).slice(0, 3);
  const links = [
    { href: staticRoutes.home[locale], label: t_.home },
    { href: staticRoutes.projects[locale], label: t_.projects },
    { href: staticRoutes.contact[locale], label: t_.contact },
  ];
  return (
    <div
      data-404="tree"
      className="container-page grid-page items-center gap-y-block pt-block pb-section"
    >
      <div className="col-span-4 md:col-span-8 lg:col-span-6">
        <h1 className="type-h1">{t_.title}</h1>
        <p className="mt-stack type-lead">{t_.lead}</p>
        <p className="mt-4 type-body text-ink-muted">{t_.body}</p>
        <ul className="mt-stack flex flex-wrap gap-x-6">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                prefetch={false}
                transitionTypes={['nav-forward']}
                href={l.href}
                className="inline-flex min-h-11 items-center link-inline type-ui"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 type-ui">
          <EmailLink email={getContact().email} />
        </p>
        {latest.length ? (
          <section aria-labelledby="latest-title" className="mt-block">
            <h2 id="latest-title" className="type-h4">
              {t_.latest}
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {latest.map((p) => (
                <li key={p.slug}>
                  <Link
                    prefetch={false}
                    transitionTypes={['nav-forward']}
                    href={pathOf({ key: 'project', param: p.slug }, locale)}
                    className="link-inline type-ui"
                  >
                    <Txt v={t(p.title, locale)} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <div className="col-span-4 mx-auto w-full max-w-sm md:col-span-6 md:col-start-2 lg:col-span-5 lg:col-start-8">
        <KodPanel
          className="kod-inline"
          data={getKodData('about-page', undefined, locale)}
          program={{ kind: 'notfound', path: staticRoutes.home[locale] === '/' ? '/…' : '/en/…' }}
          extra={{ links: links.map((l) => [l.href, l.label] as const) }}
        />
      </div>
    </div>
  );
}
