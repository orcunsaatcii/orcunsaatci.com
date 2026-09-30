// src/app/en/opengraph-image.tsx — EN kök OG görseli (§6.8, §11.5.4). Kendi görseli olmayan EN sayfaları miras alır.
import { getDictionary } from '@/i18n/get-dictionary';
import { getPerson, getStageData, t } from '@/lib/content';
import { renderOg } from '@/lib/seo/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = getDictionary('en').og.homeAlt.replace('{name}', getPerson().name);

export default async function Image() {
  const person = getPerson();
  const jobTitle = t(person.jobTitle, 'en');
  const stage = getStageData('home', undefined, 'en');
  return renderOg({
    locale: 'en',
    variant: 'home',
    eyebrow: [{ text: jobTitle.text, lang: jobTitle.lang }], // §6.8: kök varyantta yalnız unvan
    title: person.name,
    subtitle: t(person.headline, 'en').text,
    footerRight: `${person.name} · ${jobTitle.text}`,
    seed: 'home',
    motif: { rings: stage.rings, sectors: stage.sectors },
  });
}
