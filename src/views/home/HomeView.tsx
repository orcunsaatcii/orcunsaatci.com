// src/views/home/HomeView.tsx — ana sayfa gövdesi. M2 kabuğu (§15.3.1 #6): hero H1'i ve bölüm çapaları; bölüm
// içerikleri, StagePreset ve hero'nun geri kalanı M3–M6'da. Compact footer contact bölümünün içindedir (§3.9.3, §4.11);
// layout'taki full footer data-chapter="hero" varken CSS ile gizlenir (§8.4.4).
import { SiteFooter } from '@/components/layout/SiteFooter';
import { chapterAnchors, type Locale } from '@/i18n/config';
import { getEnPaths, getPerson } from '@/lib/content';

// M3'te About, Areas, Work, Journey bileşenleriyle dolar; şimdilik header çapaları boşa düşmesin diye yalnız hedefler
const BODY_CHAPTERS = ['about', 'areas', 'work', 'journey'] as const;

export function HomeView({ locale }: { locale: Locale }) {
  const { name } = getPerson();
  const cut = name.lastIndexOf(' ');
  const first = cut > 0 ? name.slice(0, cut) : name;
  const last = cut > 0 ? name.slice(cut + 1) : '';

  return (
    <>
      <section
        id={chapterAnchors.hero[locale]}
        data-chapter="hero"
        aria-labelledby="hero-title"
        className="container-page flex min-h-[calc(100svh-var(--header-h))] items-center py-block"
      >
        {/* İki <span>: satır kırılımı fonttan bağımsız (§6.2.3, CLS); EN'de ad Türkçe işaretlenir (§3.8 #2) */}
        <h1 id="hero-title" className="type-display" lang={locale === 'en' ? 'tr' : undefined}>
          <span className="block lg:inline">{first}</span>
          {last && (
            <>
              {' '}
              <span className="block lg:inline">{last}</span>
            </>
          )}
        </h1>
      </section>
      {BODY_CHAPTERS.map((chapter) => (
        <section key={chapter} id={chapterAnchors[chapter][locale]} data-chapter={chapter} />
      ))}
      <section id={chapterAnchors.contact[locale]} data-chapter="contact">
        <SiteFooter locale={locale} enPaths={getEnPaths()} variant="compact" />
      </section>
    </>
  );
}
