// src/app/(tr)/projeler/[slug]/opengraph-image.tsx — TR proje OG görseli (§6.8, §11.5.4).
import { getDictionary } from '@/i18n/get-dictionary';
import { getPerson, getProject, getProjectSlugs, getStageData, t } from '@/lib/content';
import { coverDataUri, renderOg } from '@/lib/seo/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = getDictionary('tr').og.projectAlt.replace('{name}', getPerson().name);

// V-25: sayfanın parametreleriyle statik (●) üretim; bilinmeyen slug için görsel yok
export const dynamicParams = false;
export function generateStaticParams(): { slug: string }[] {
  return getProjectSlugs('tr').map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug, 'tr');
  if (!project) throw new Error(`opengraph-image: unknown project "${slug}"`);
  const person = getPerson();
  const jobTitle = t(person.jobTitle, 'tr');
  const stage = getStageData('folio', slug, 'tr');
  const self = stage.projects[0];
  return renderOg({
    locale: 'tr',
    variant: 'project',
    eyebrow: [
      { text: getDictionary('tr').og.projectEyebrow, lang: 'tr' },
      { text: project.start.slice(0, 4), lang: 'tr' }, // başlangıç yılı: `start` = YYYY-MM (D-48)
    ],
    title: t(project.title, 'tr').text,
    subtitle: t(project.summary, 'tr').text, // yalnız başlık, özet ve kapak kullanılır (D-48)
    footerRight: `${person.name} · ${jobTitle.text}`,
    seed: `project:${slug}`,
    motif: { rings: stage.rings, sectors: stage.sectors, band: self?.band, sector: self?.area },
    cover: await coverDataUri(project.cover.src),
  });
}
