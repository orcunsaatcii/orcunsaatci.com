// src/views/home/HomeView.tsx — ana sayfa gövdesi (§4.5–§4.11). Server.
// Layout'taki full footer data-chapter="hero" varken CSS ile gizlenir; compact footer Contact bölümündedir (§8.4.4).
// Sahneyle tek konuşma yolu StagePreset'tir (§8.5.2 kural 2). Tek JSON-LD betiği view'dadır (§11.6.1).
import '@/components/chapters/home.css';
import { About } from '@/components/chapters/About';
import { Areas } from '@/components/chapters/Areas';
import { Contact } from '@/components/chapters/Contact';
import { Hero } from '@/components/chapters/Hero';
import { Journey } from '@/components/chapters/Journey';
import { Testimonials } from '@/components/chapters/Testimonials';
import { Work } from '@/components/chapters/Work';
import { JsonLd } from '@/components/seo/JsonLd';
import type { Locale } from '@/i18n/config';
import { getStageData } from '@/lib/content';
import { jsonLdFor } from '@/lib/seo/jsonld';
import { StagePreset } from '@/stage/StagePreset';

export function HomeView({ locale }: { locale: Locale }) {
  const graph = jsonLdFor({ key: 'home' }, locale);
  return (
    <>
      {graph ? <JsonLd graph={graph} /> : null}
      <StagePreset name="home" data={getStageData('home', undefined, locale)} />
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
