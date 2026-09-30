// src/views/home/HomeView.tsx — ana sayfa gövdesi (§4.5–§4.11). Server; bölümler akış düzeninde (M3).
// Layout'taki full footer data-chapter="hero" varken CSS ile gizlenir; compact footer Contact bölümündedir (§8.4.4).
// StagePreset M4/M5'te eklenir. Tek JSON-LD betiği view'dadır (§11.6.1).
import { About } from '@/components/chapters/About';
import { Areas } from '@/components/chapters/Areas';
import { Contact } from '@/components/chapters/Contact';
import { Hero } from '@/components/chapters/Hero';
import { Journey } from '@/components/chapters/Journey';
import { Testimonials } from '@/components/chapters/Testimonials';
import { Work } from '@/components/chapters/Work';
import { JsonLd } from '@/components/seo/JsonLd';
import type { Locale } from '@/i18n/config';
import { jsonLdFor } from '@/lib/seo/jsonld';

export function HomeView({ locale }: { locale: Locale }) {
  const graph = jsonLdFor({ key: 'home' }, locale);
  return (
    <>
      {graph ? <JsonLd graph={graph} /> : null}
      <Hero locale={locale} />
      <About locale={locale} />
      <Areas locale={locale} />
      <Work locale={locale} />
      <Journey locale={locale} />
      <Testimonials locale={locale} />
      <Contact locale={locale} />
    </>
  );
}
