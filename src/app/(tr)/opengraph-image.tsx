// src/app/(tr)/opengraph-image.tsx — TR kök OG görseli (§6.8, §11.5.4). Kendi görseli olmayan TR sayfaları miras alır.
import { getDictionary } from '@/i18n/get-dictionary';
import { getPerson, getStageData, t, termLang } from '@/lib/content';
import { renderOg } from '@/lib/seo/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = getDictionary('tr').og.homeAlt.replace('{name}', getPerson().name);

export default async function Image() {
  const person = getPerson();
  const jobTitle = t(person.jobTitle, 'tr');
  const stage = getStageData('home', undefined, 'tr');
  return renderOg({
    locale: 'tr',
    variant: 'home',
    eyebrow: [{ text: jobTitle.text, lang: termLang(person.jobTitle, 'tr') ?? jobTitle.lang }], // §6.8: kök varyantta yalnız unvan
    title: person.name,
    subtitle: t(person.headline, 'tr').text,
    footerRight: `${person.name} · ${jobTitle.text}`,
    seed: 'home',
    motif: { rings: stage.rings, sectors: stage.sectors },
  });
}
