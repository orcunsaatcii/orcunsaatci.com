// src/components/mdx/index.ts — kapalı MDX bileşen haritası (§7.7.2). Başka anahtar YASAK.
// Render: <MDXContent code={body.mdx} components={createMdxComponents(ctx)} />. Metin stilleri sarmalayıcıdadır (MdxBody).
import { createElement, type ComponentType } from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import type { TestimonialDoc } from '@/lib/content';
import type { MdxComponentName } from './allowed';
import { Callout, type CalloutProps } from './Callout';
import { Figure, type FigureProps } from './Figure';
import { Gallery } from './Gallery';
import { MdxLink } from './MdxLink';
import { Quote, type QuoteProps } from './Quote';

export { MDX_COMPONENTS, type MdxComponentName } from './allowed';

export type MdxMedia = Record<
  string,
  { width: number; height: number; bytes: number; dominant: string }
>;

export interface MdxContext {
  locale: Locale;
  media: MdxMedia; // gövde belgesinin `media` alanı (§7.3.3)
  testimonials: TestimonialDoc[]; // consent'li kayıtlar
}

/** MDX bileşen haritası props'u serbest tiplidir (derlenmiş MDX her öğeye kendi props'unu verir). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- yukarıdaki gerekçe
type AnyComponent = ComponentType<any>;

export function createMdxComponents(ctx: MdxContext): Record<MdxComponentName | 'a', AnyComponent> {
  const dict = getDictionary(ctx.locale);
  return {
    Figure: (props: FigureProps) => createElement(Figure, { ...props, media: ctx.media }),
    Gallery,
    Callout: (props: CalloutProps) =>
      createElement(Callout, { ...props, fallbackTitle: dict.callout.note }),
    Quote: (props: QuoteProps) =>
      createElement(Quote, {
        ...props,
        ctx: {
          locale: ctx.locale,
          testimonials: ctx.testimonials,
          translatedLabel: dict.project.translated,
        },
      }),
    a: MdxLink,
  };
}
