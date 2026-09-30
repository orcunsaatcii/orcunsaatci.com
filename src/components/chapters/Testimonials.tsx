// src/components/chapters/Testimonials.tsx — İSTEĞE BAĞLI referanslar (§4.10.9, features.testimonials). Server.
// Yalnız bayrak açıksa ve öne çıkan izinli kayıt varsa çizilir; header'da yer almaz.
import { Txt } from '@/components/ui/Txt';
import { chapterAnchors, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getHome, getTestimonials, t } from '@/lib/content';

export function Testimonials({ locale }: { locale: Locale }) {
  const items = getTestimonials(locale, { featured: true });
  if (items.length === 0) return null;
  const dict = getDictionary(locale);
  const heading = getHome().testimonials.heading;
  return (
    <section
      id={chapterAnchors.testimonials[locale]}
      data-chapter="testimonials"
      aria-labelledby="testimonials-title"
      className="container-page py-section"
    >
      <h2 id="testimonials-title" className="type-h2">
        {heading ? <Txt v={t(heading, locale)} /> : dict.home.testimonials}
      </h2>
      <div className="mt-block grid gap-gutter md:grid-cols-2">
        {items.map((x) => {
          const quote = t(x.quote, locale);
          const translated = !quote.fallback && locale !== x.quoteOriginalLocale;
          return (
            <figure key={x.id} className="rounded-md bg-surface p-6">
              <blockquote lang={quote.lang} className="type-h4 font-medium">
                <p>{quote.text}</p>
              </blockquote>
              <figcaption className="mt-4 type-meta">
                {x.author}, <Txt v={t(x.role, locale)} />
                {x.organization ? `, ${x.organization}` : ''}
                {translated ? ` · ${dict.project.translated}` : ''}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
