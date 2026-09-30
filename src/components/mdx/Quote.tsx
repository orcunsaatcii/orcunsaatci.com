// src/components/mdx/Quote.tsx — izinli referans kaydı ya da kaynaklı satır içi alıntı (§6.6.6, §7.7.2).
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import type { TestimonialDoc } from '@/lib/content';

export interface QuoteProps {
  testimonial?: string;
  by?: string;
  role?: string;
  source?: string; // herkese açık kaynağın https URL'si
  children?: ReactNode;
}

interface QuoteContext {
  locale: Locale;
  testimonials: readonly TestimonialDoc[];
  translatedLabel: string;
}

export function Quote({
  testimonial,
  by,
  role,
  source,
  children,
  ctx,
}: QuoteProps & { ctx: QuoteContext }) {
  if (testimonial) {
    const item = ctx.testimonials.find((x) => x.id === testimonial);
    if (!item)
      throw new Error(`<Quote testimonial="${testimonial}">: kayıt yok ya da izinli değil (C12)`);
    const own = ctx.locale === 'en' ? item.quote.en : item.quote.tr;
    const original = item.quoteOriginalLocale;
    // Çeviri gösterilirse "Çeviri" etiketi; çeviri yoksa özgün metin kendi lang'iyle (§7.4.4 kural 5)
    const text = own ?? item.quote.tr;
    const lang: Locale = own ? ctx.locale : 'tr';
    const translated = own !== undefined && lang !== original;
    const roleText = (ctx.locale === 'en' ? item.role.en : undefined) ?? item.role.tr;
    return (
      <figure className="my-block border-l border-line-strong pl-6">
        <blockquote lang={lang} className="type-h4 font-medium">
          <p>{text}</p>
        </blockquote>
        <figcaption className="mt-3 type-meta">
          {item.author}, {roleText}
          {item.organization ? `, ${item.organization}` : ''}
          {translated ? ` · ${ctx.translatedLabel}` : ''}
        </figcaption>
      </figure>
    );
  }
  return (
    <figure className="my-block border-l border-line-strong pl-6">
      <blockquote cite={source} className="type-h4 font-medium">
        {children}
      </blockquote>
      {by ? (
        <figcaption className="mt-3 type-meta">
          {by}
          {role ? `, ${role}` : ''}
        </figcaption>
      ) : null}
    </figure>
  );
}
